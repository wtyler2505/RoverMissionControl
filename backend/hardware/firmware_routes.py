"""
Firmware Management API Routes
Provides REST endpoints for firmware detection, updates, and management
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import json
import io
import os
from pathlib import Path

from .firmware_manager import (
    FirmwareManager, FirmwareVersion, FirmwareMetadata, FirmwareUpdateSession,
    FirmwareUpdateState, FirmwareValidationResult, UpdatePriority
)
from .manager import hardware_manager
from ..auth.dependencies import get_current_user
from ..auth.models import User
from ..rbac.permissions import require_permission


# Initialize firmware manager
firmware_manager = FirmwareManager(hardware_manager)

# Create router
router = APIRouter(prefix="/api/firmware", tags=["firmware"])


@router.get("/devices/{device_id}/version")
@require_permission("hardware.firmware.read")
async def get_device_firmware_version(
    device_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get current firmware version of a device"""
    try:
        version = await firmware_manager.detect_firmware_version(device_id)
        if not version:
            raise HTTPException(status_code=404, detail="Could not detect firmware version")
        
        return {
            "device_id": device_id,
            "version": str(version),
            "major": version.major,
            "minor": version.minor,
            "patch": version.patch,
            "build": version.build,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices/{device_id}/check-updates")
@require_permission("hardware.firmware.read")
async def check_firmware_updates(
    device_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check if firmware updates are available for a device"""
    try:
        update = await firmware_manager.check_for_updates(device_id)
        
        if update:
            return {
                "update_available": True,
                "current_version": str(await firmware_manager.detect_firmware_version(device_id)),
                "latest_version": str(update.version),
                "update_priority": update.update_priority.value,
                "critical_update": update.critical_update,
                "release_date": update.release_date.isoformat() if update.release_date else None,
                "changelog": update.changelog,
                "size": update.size
            }
        else:
            current = await firmware_manager.detect_firmware_version(device_id)
            return {
                "update_available": False,
                "current_version": str(current) if current else "unknown",
                "message": "Device is up to date"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repository")
@require_permission("hardware.firmware.read")
async def list_firmware_repository(
    device_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, List[Dict[str, Any]]]:
    """List available firmware in repository"""
    try:
        if device_id:
            # Get firmware for specific device
            versions = firmware_manager.repository.index.get(device_id, [])
            return {
                device_id: [v.to_dict() for v in versions]
            }
        else:
            # Get all firmware
            result = {}
            for dev_id, versions in firmware_manager.repository.index.items():
                result[dev_id] = [v.to_dict() for v in versions]
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/repository/upload")
@require_permission("hardware.firmware.write")
async def upload_firmware(
    device_id: str,
    device_model: str,
    version: str,
    file: UploadFile = File(...),
    update_priority: UpdatePriority = UpdatePriority.NORMAL,
    critical_update: bool = False,
    changelog: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Upload new firmware to repository"""
    try:
        # Read firmware data
        firmware_data = await file.read()
        
        # Calculate checksum
        import hashlib
        checksum = hashlib.sha256(firmware_data).hexdigest()
        
        # Create metadata
        metadata = FirmwareMetadata(
            device_id=device_id,
            device_model=device_model,
            version=FirmwareVersion.from_string(version),
            size=len(firmware_data),
            checksum_sha256=checksum,
            release_date=datetime.utcnow(),
            update_priority=update_priority,
            critical_update=critical_update,
            changelog=changelog
        )
        
        # Add to repository
        path = firmware_manager.repository.add_firmware(metadata, firmware_data)
        
        return {
            "success": True,
            "path": path,
            "metadata": metadata.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/devices/{device_id}/update")
@require_permission("hardware.firmware.write")
async def start_firmware_update(
    device_id: str,
    target_version: str,
    force: bool = False,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start firmware update for a device"""
    try:
        # Check if emergency stop is active
        if firmware_manager.emergency_stop_flag:
            raise HTTPException(
                status_code=503,
                detail="Emergency stop is active - firmware updates are disabled"
            )
        
        # Start update
        session_id = await firmware_manager.start_update(device_id, target_version, force)
        
        return {
            "success": True,
            "session_id": session_id,
            "message": f"Firmware update started for device {device_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
@require_permission("hardware.firmware.read")
async def get_update_sessions(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Dict[str, Any]]:
    """Get all active firmware update sessions"""
    return firmware_manager.get_all_sessions()


@router.get("/sessions/{session_id}")
@require_permission("hardware.firmware.read")
async def get_session_status(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get status of a specific update session"""
    status = firmware_manager.get_session_status(session_id)
    if not status:
        raise HTTPException(status_code=404, detail="Session not found")
    return status


@router.post("/sessions/{session_id}/cancel")
@require_permission("hardware.firmware.write")
async def cancel_update_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Cancel an ongoing firmware update"""
    success = await firmware_manager.cancel_update(session_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not cancel update session")
    
    return {
        "success": True,
        "message": f"Update session {session_id} cancelled"
    }


@router.post("/emergency-stop")
@require_permission("hardware.firmware.emergency")
async def trigger_emergency_stop(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Trigger emergency stop for all firmware updates"""
    await firmware_manager.emergency_stop()
    
    return {
        "success": True,
        "message": "Emergency stop triggered - all firmware updates halted",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/emergency-stop/clear")
@require_permission("hardware.firmware.emergency")
async def clear_emergency_stop(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Clear emergency stop flag"""
    firmware_manager.clear_emergency_stop()
    
    return {
        "success": True,
        "message": "Emergency stop cleared - firmware updates enabled",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/emergency-stop/status")
@require_permission("hardware.firmware.read")
async def get_emergency_stop_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get emergency stop status"""
    return {
        "emergency_stop_active": firmware_manager.emergency_stop_flag,
        "active_sessions": len(firmware_manager.active_sessions),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/devices/{device_id}/history")
@require_permission("hardware.firmware.read")
async def get_device_update_history(
    device_id: str,
    limit: int = 10,
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get firmware update history for a device"""
    return firmware_manager.get_update_history(device_id, limit)


@router.post("/devices/{device_id}/validate")
@require_permission("hardware.firmware.read")
async def validate_device_firmware(
    device_id: str,
    version: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Validate firmware file for a device"""
    try:
        firmware_path = firmware_manager.repository.get_firmware_path(device_id, version)
        if not firmware_path:
            raise HTTPException(status_code=404, detail="Firmware not found")
        
        result = await firmware_manager.validate_firmware(device_id, firmware_path)
        
        return {
            "device_id": device_id,
            "version": version,
            "validation_result": result.value,
            "valid": result == FirmwareValidationResult.VALID,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices/{device_id}/download/{version}")
@require_permission("hardware.firmware.read")
async def download_firmware(
    device_id: str,
    version: str,
    current_user: User = Depends(get_current_user)
):
    """Download firmware file"""
    try:
        firmware_path = firmware_manager.repository.get_firmware_path(device_id, version)
        if not firmware_path or not firmware_path.exists():
            raise HTTPException(status_code=404, detail="Firmware not found")
        
        return FileResponse(
            path=firmware_path,
            filename=firmware_path.name,
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/repository/{device_id}/{version}")
@require_permission("hardware.firmware.write")
async def delete_firmware(
    device_id: str,
    version: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Delete firmware from repository"""
    try:
        firmware_path = firmware_manager.repository.get_firmware_path(device_id, version)
        if not firmware_path:
            raise HTTPException(status_code=404, detail="Firmware not found")
        
        # Remove from index
        if device_id in firmware_manager.repository.index:
            firmware_manager.repository.index[device_id] = [
                v for v in firmware_manager.repository.index[device_id]
                if str(v.version) != version
            ]
            firmware_manager.repository.save_index()
        
        # Delete file
        if firmware_path.exists():
            firmware_path.unlink()
        
        return {
            "success": True,
            "message": f"Firmware {version} for device {device_id} deleted"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/repository/cleanup")
@require_permission("hardware.firmware.write")
async def cleanup_old_firmware(
    device_id: str,
    keep_count: int = 3,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Clean up old firmware versions"""
    try:
        firmware_manager.repository.cleanup_old_versions(device_id, keep_count)
        
        return {
            "success": True,
            "message": f"Cleaned up old firmware for device {device_id}, keeping {keep_count} recent versions"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint for real-time updates
from fastapi import WebSocket, WebSocketDisconnect
from ..websocket.manager import WebSocketManager

ws_manager = WebSocketManager()


@router.websocket("/ws/updates")
async def firmware_update_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time firmware update progress"""
    await ws_manager.connect(websocket, "firmware_updates")
    
    try:
        while True:
            # Send update status periodically
            for session_id, session in firmware_manager.active_sessions.items():
                status = firmware_manager.get_session_status(session_id)
                if status:
                    await ws_manager.send_to_group("firmware_updates", {
                        "type": "update_progress",
                        "data": status
                    })
            
            await asyncio.sleep(1)  # Update every second
            
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "firmware_updates")


# Register progress callbacks for WebSocket updates
async def broadcast_progress(session: FirmwareUpdateSession):
    """Broadcast progress updates via WebSocket"""
    status = {
        "session_id": session.session_id,
        "device_id": session.device_id,
        "state": session.state.value,
        "progress": session.progress,
        "source_version": str(session.source_version),
        "target_version": str(session.target_version)
    }
    
    await ws_manager.send_to_group("firmware_updates", {
        "type": "update_progress",
        "data": status
    })


async def broadcast_completion(session: FirmwareUpdateSession, success: bool):
    """Broadcast completion updates via WebSocket"""
    status = {
        "session_id": session.session_id,
        "device_id": session.device_id,
        "success": success,
        "state": session.state.value,
        "source_version": str(session.source_version),
        "target_version": str(session.target_version),
        "errors": len(session.error_log)
    }
    
    await ws_manager.send_to_group("firmware_updates", {
        "type": "update_completed",
        "data": status
    })


# Health check endpoint
@router.get("/health")
async def firmware_system_health() -> Dict[str, Any]:
    """Get firmware management system health"""
    return {
        "healthy": not firmware_manager.emergency_stop_flag,
        "emergency_stop_active": firmware_manager.emergency_stop_flag,
        "active_updates": len(firmware_manager.active_sessions),
        "repository_size": sum(
            len(versions) for versions in firmware_manager.repository.index.values()
        ),
        "timestamp": datetime.utcnow().isoformat()
    }