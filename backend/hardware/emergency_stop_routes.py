"""
Emergency Stop API Routes
RESTful endpoints for emergency stop hardware management

This module provides HTTP endpoints for managing emergency stop devices,
monitoring system state, and handling emergency events.
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, Query
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

from ..dependencies import get_current_user
from ..rbac.decorators import require_permission
from ..models.hardware import User
from .emergency_stop_manager import (
    EmergencyStopManager, SafetyConfiguration, SystemSafetyState,
    EmergencyEvent, EmergencyStopState, ButtonType
)
from .emergency_stop_websocket import EmergencyStopWebSocketHandler

# Import secure logging
try:
    from ..secure_logging.secure_logging_service import SecureLoggingService, EXAMPLE_CONFIG
    secure_logging_enabled = True
    secure_logging_service = SecureLoggingService(EXAMPLE_CONFIG)
except ImportError:
    secure_logging_enabled = False
    secure_logging_service = None

import logging

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(
    prefix="/api/emergency-stop",
    tags=["emergency-stop"],
    responses={404: {"description": "Not found"}}
)

# Global emergency stop manager instance
emergency_manager: Optional[EmergencyStopManager] = None
websocket_handler: Optional[EmergencyStopWebSocketHandler] = None


# Pydantic models for requests/responses
class EmergencyActivationRequest(BaseModel):
    """Request to activate emergency stop"""
    reason: str = Field(..., description="Reason for activation")
    source: Optional[str] = Field(None, description="Source identifier")
    notify_all: bool = Field(True, description="Notify all connected clients")


class EmergencyDeactivationRequest(BaseModel):
    """Request to deactivate emergency stop"""
    safety_checks_confirmed: bool = Field(..., description="Safety checks confirmed")
    override_safety: bool = Field(False, description="Override safety checks")
    operator_notes: Optional[str] = Field(None, description="Operator notes")


class DeviceAddRequest(BaseModel):
    """Request to add a new emergency stop device"""
    device_type: str = Field(..., description="Device type (serial, usb, gpio)")
    connection_params: Dict[str, Any] = Field(..., description="Connection parameters")
    button_type: ButtonType = Field(ButtonType.SECONDARY, description="Button type")
    
    
class SafetyConfigUpdate(BaseModel):
    """Update safety configuration"""
    require_redundancy: Optional[bool] = None
    auto_discovery_enabled: Optional[bool] = None
    heartbeat_check_enabled: Optional[bool] = None
    fail_safe_on_fault: Optional[bool] = None
    allow_software_override: Optional[bool] = None
    minimum_buttons_required: Optional[int] = None
    alarm_on_activation: Optional[bool] = None
    test_mode_allowed: Optional[bool] = None


class SystemStatusResponse(BaseModel):
    """System status response"""
    system_state: str
    is_emergency_active: bool
    device_count: int
    active_faults: List[str]
    last_state_change: Optional[str]
    devices: Dict[str, Dict[str, Any]]


class EmergencyEventResponse(BaseModel):
    """Emergency event response"""
    timestamp: str
    trigger_source: str
    trigger_reason: str
    system_state_before: str
    system_state_after: str
    actions_taken: List[str]
    cleared_timestamp: Optional[str]
    cleared_by: Optional[str]


# Initialize emergency stop system
async def initialize_emergency_system():
    """Initialize the emergency stop system"""
    global emergency_manager, websocket_handler
    
    if emergency_manager is None:
        # Create default configuration
        config = SafetyConfiguration(
            require_redundancy=True,
            auto_discovery_enabled=True,
            heartbeat_check_enabled=True,
            fail_safe_on_fault=True,
            minimum_buttons_required=1,
            alarm_on_activation=True,
            log_all_events=True
        )
        
        # Create manager
        emergency_manager = EmergencyStopManager(config)
        await emergency_manager.initialize()
        
        # Create WebSocket handler
        websocket_handler = EmergencyStopWebSocketHandler(emergency_manager)
        
        logger.info("Emergency stop system initialized")


# Shutdown emergency stop system
async def shutdown_emergency_system():
    """Shutdown the emergency stop system"""
    global emergency_manager
    
    if emergency_manager:
        await emergency_manager.shutdown()
        emergency_manager = None
        logger.info("Emergency stop system shutdown")


@router.on_event("startup")
async def startup_event():
    """Initialize on router startup"""
    await initialize_emergency_system()
    
    # Start secure logging if available
    if secure_logging_enabled and secure_logging_service:
        await secure_logging_service.start()
        logger.info("Secure logging service started")


@router.on_event("shutdown")
async def shutdown_event():
    """Cleanup on router shutdown"""
    await shutdown_emergency_system()
    
    # Stop secure logging if available
    if secure_logging_enabled and secure_logging_service:
        await secure_logging_service.stop()
        logger.info("Secure logging service stopped")


@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    current_user: User = Depends(get_current_user)
):
    """Get current emergency stop system status"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    device_states = emergency_manager.get_device_states()
    
    return SystemStatusResponse(
        system_state=emergency_manager.system_state.value,
        is_emergency_active=emergency_manager.is_emergency_active,
        device_count=emergency_manager.device_count,
        active_faults=[f.name for f in emergency_manager._active_faults],
        last_state_change=emergency_manager._last_state_change.isoformat() 
                         if emergency_manager._last_state_change else None,
        devices={
            device_id: {
                'state': status.state.value,
                'button_type': status.button_type.value,
                'is_healthy': status.is_healthy,
                'voltage': status.voltage_level,
                'response_time_ms': status.response_time_ms,
                'fault_codes': [f.name for f in status.fault_codes],
                'activation_count': status.activation_count
            }
            for device_id, status in device_states.items()
        }
    )


@router.post("/activate")
@require_permission("emergency_stop.activate")
async def activate_emergency_stop(
    request: EmergencyActivationRequest,
    current_user: User = Depends(get_current_user)
):
    """Activate emergency stop"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    logger.warning(f"Emergency stop activation requested by {current_user.username}: {request.reason}")
    
    # Log to secure logging system
    if secure_logging_enabled and secure_logging_service:
        try:
            event_id = await secure_logging_service.log_event(
                event_type="emergency_stop_activation",
                severity="critical",
                data={
                    "reason": request.reason,
                    "source": request.source or f"user:{current_user.username}",
                    "activated_by": current_user.username,
                    "device_states": emergency_manager.get_device_states() if emergency_manager else {},
                    "system_state": emergency_manager.system_state.value if emergency_manager else "unknown"
                },
                actor=current_user.username,
                correlation_id=f"estop-{datetime.utcnow().timestamp()}",
                notify=True,
                compliance_evidence=True
            )
            logger.info(f"Emergency stop activation logged with event ID: {event_id}")
        except Exception as e:
            logger.error(f"Failed to log emergency stop activation to secure logging: {e}")
    
    success = await emergency_manager.activate_emergency_stop(
        source=request.source or f"user:{current_user.username}",
        reason=request.reason
    )
    
    if not success:
        # Log failure
        if secure_logging_enabled and secure_logging_service:
            try:
                await secure_logging_service.log_event(
                    event_type="emergency_stop_activation_failed",
                    severity="critical",
                    data={
                        "reason": request.reason,
                        "source": request.source or f"user:{current_user.username}",
                        "attempted_by": current_user.username,
                        "error": "Activation failed"
                    },
                    actor=current_user.username,
                    notify=True
                )
            except Exception as e:
                logger.error(f"Failed to log activation failure: {e}")
                
        raise HTTPException(status_code=500, detail="Failed to activate emergency stop")
        
    return {
        "status": "activated",
        "timestamp": datetime.utcnow().isoformat(),
        "activated_by": current_user.username,
        "reason": request.reason
    }


@router.post("/deactivate")
@require_permission("emergency_stop.deactivate")
async def deactivate_emergency_stop(
    request: EmergencyDeactivationRequest,
    current_user: User = Depends(get_current_user)
):
    """Deactivate emergency stop (requires authorization)"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    if not emergency_manager.is_emergency_active:
        raise HTTPException(status_code=400, detail="Emergency stop is not active")
        
    if not request.safety_checks_confirmed and not request.override_safety:
        raise HTTPException(
            status_code=400, 
            detail="Safety checks must be confirmed or override must be enabled"
        )
        
    logger.info(f"Emergency stop deactivation requested by {current_user.username}")
    
    # Log deactivation attempt
    if secure_logging_enabled and secure_logging_service:
        try:
            event_id = await secure_logging_service.log_event(
                event_type="emergency_stop_deactivation_attempt",
                severity="high",
                data={
                    "operator": current_user.username,
                    "safety_checks_confirmed": request.safety_checks_confirmed,
                    "override_safety": request.override_safety,
                    "operator_notes": request.operator_notes,
                    "device_states": emergency_manager.get_device_states() if emergency_manager else {},
                    "system_state": emergency_manager.system_state.value if emergency_manager else "unknown"
                },
                actor=current_user.username,
                correlation_id=f"estop-deact-{datetime.utcnow().timestamp()}",
                notify=True,
                compliance_evidence=True
            )
            logger.info(f"Emergency stop deactivation attempt logged with event ID: {event_id}")
        except Exception as e:
            logger.error(f"Failed to log deactivation attempt: {e}")
    
    success = await emergency_manager.deactivate_emergency_stop(
        operator_id=current_user.username,
        override_safety=request.override_safety
    )
    
    if not success:
        # Log failure
        if secure_logging_enabled and secure_logging_service:
            try:
                await secure_logging_service.log_event(
                    event_type="emergency_stop_deactivation_failed",
                    severity="high",
                    data={
                        "operator": current_user.username,
                        "error": "Deactivation failed",
                        "safety_override_attempted": request.override_safety
                    },
                    actor=current_user.username,
                    notify=True
                )
            except Exception as e:
                logger.error(f"Failed to log deactivation failure: {e}")
                
        raise HTTPException(status_code=500, detail="Failed to deactivate emergency stop")
    
    # Log successful deactivation
    if secure_logging_enabled and secure_logging_service:
        try:
            await secure_logging_service.log_event(
                event_type="emergency_stop_deactivated",
                severity="high",
                data={
                    "operator": current_user.username,
                    "safety_override_used": request.override_safety,
                    "operator_notes": request.operator_notes,
                    "timestamp": datetime.utcnow().isoformat()
                },
                actor=current_user.username,
                notify=True,
                compliance_evidence=True
            )
        except Exception as e:
            logger.error(f"Failed to log successful deactivation: {e}")
        
    return {
        "status": "deactivated",
        "timestamp": datetime.utcnow().isoformat(),
        "deactivated_by": current_user.username,
        "safety_override": request.override_safety
    }


@router.get("/devices")
async def list_devices(
    current_user: User = Depends(get_current_user)
):
    """List all connected emergency stop devices"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    device_states = emergency_manager.get_device_states()
    
    return {
        "devices": [
            {
                "device_id": device_id,
                "state": status.state.value,
                "button_type": status.button_type.value,
                "is_healthy": status.is_healthy,
                "voltage": status.voltage_level,
                "response_time_ms": status.response_time_ms,
                "fault_codes": [f.name for f in status.fault_codes],
                "last_heartbeat": status.last_heartbeat.isoformat() 
                                if status.last_heartbeat else None
            }
            for device_id, status in device_states.items()
        ]
    }


@router.post("/devices/discover")
@require_permission("emergency_stop.manage")
async def discover_devices(
    current_user: User = Depends(get_current_user)
):
    """Discover new emergency stop devices"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    discovered = await emergency_manager.discover_devices()
    
    return {
        "discovered": discovered,
        "count": len(discovered),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/devices/add")
@require_permission("emergency_stop.manage")
async def add_device(
    request: DeviceAddRequest,
    current_user: User = Depends(get_current_user)
):
    """Manually add an emergency stop device"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    # Create appropriate adapter based on device type
    # This would be implemented based on specific device types
    
    return {
        "status": "Device addition not yet implemented",
        "device_type": request.device_type
    }


@router.delete("/devices/{device_id}")
@require_permission("emergency_stop.manage")
async def remove_device(
    device_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove an emergency stop device"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    await emergency_manager.remove_device(device_id)
    
    return {
        "status": "removed",
        "device_id": device_id,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/test")
@require_permission("emergency_stop.test")
async def test_system(
    current_user: User = Depends(get_current_user)
):
    """Test the emergency stop system"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    logger.info(f"Emergency stop system test requested by {current_user.username}")
    
    results = await emergency_manager.test_system()
    
    return results


@router.get("/events", response_model=List[EmergencyEventResponse])
async def get_emergency_events(
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user)
):
    """Get emergency stop event history"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    events = emergency_manager.get_emergency_events(limit=limit)
    
    return [
        EmergencyEventResponse(
            timestamp=event.timestamp.isoformat(),
            trigger_source=event.trigger_source.value,
            trigger_reason=event.trigger_reason,
            system_state_before=event.system_state_before.value,
            system_state_after=event.system_state_after.value,
            actions_taken=[action.name for action in event.actions_taken],
            cleared_timestamp=event.cleared_timestamp.isoformat() 
                            if event.cleared_timestamp else None,
            cleared_by=event.cleared_by
        )
        for event in events
    ]


@router.get("/diagnostics")
@require_permission("emergency_stop.diagnostics")
async def get_diagnostics(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive system diagnostics"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    return emergency_manager.export_diagnostics()


@router.put("/config")
@require_permission("emergency_stop.configure")
async def update_configuration(
    config: SafetyConfigUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update safety system configuration"""
    if not emergency_manager:
        raise HTTPException(status_code=503, detail="Emergency system not initialized")
        
    # Update configuration
    current_config = emergency_manager.config
    
    if config.require_redundancy is not None:
        current_config.require_redundancy = config.require_redundancy
    if config.auto_discovery_enabled is not None:
        current_config.auto_discovery_enabled = config.auto_discovery_enabled
    if config.heartbeat_check_enabled is not None:
        current_config.heartbeat_check_enabled = config.heartbeat_check_enabled
    if config.fail_safe_on_fault is not None:
        current_config.fail_safe_on_fault = config.fail_safe_on_fault
    if config.allow_software_override is not None:
        current_config.allow_software_override = config.allow_software_override
    if config.minimum_buttons_required is not None:
        current_config.minimum_buttons_required = config.minimum_buttons_required
    if config.alarm_on_activation is not None:
        current_config.alarm_on_activation = config.alarm_on_activation
    if config.test_mode_allowed is not None:
        current_config.test_mode_allowed = config.test_mode_allowed
        
    logger.info(f"Safety configuration updated by {current_user.username}")
    
    return {
        "status": "updated",
        "timestamp": datetime.utcnow().isoformat(),
        "updated_by": current_user.username
    }


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str
):
    """WebSocket endpoint for real-time emergency stop updates"""
    if not websocket_handler:
        await websocket.close(code=1011, reason="Emergency system not initialized")
        return
        
    await websocket_handler.handle_connection(websocket, client_id)


# Health check endpoint
@router.get("/health")
async def health_check():
    """Check if emergency stop system is healthy"""
    if not emergency_manager:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "reason": "System not initialized"}
        )
        
    is_healthy = (
        emergency_manager.device_count >= emergency_manager.config.minimum_buttons_required and
        emergency_manager.system_state != SystemSafetyState.CRITICAL
    )
    
    return {
        "status": "healthy" if is_healthy else "unhealthy",
        "system_state": emergency_manager.system_state.value,
        "device_count": emergency_manager.device_count,
        "timestamp": datetime.utcnow().isoformat()
    }