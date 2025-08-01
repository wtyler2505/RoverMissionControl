"""
Device Discovery API Routes
Provides REST endpoints for device discovery and management
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

from .discovery import (
    get_discovery_engine, 
    DiscoveryMethod, 
    DeviceClass, 
    ProtocolType,
    DeviceCapability
)
from .manager import hardware_manager


router = APIRouter(prefix="/api/hardware/discovery", tags=["hardware-discovery"])


class DeviceIdentityModel(BaseModel):
    """Device identity model"""
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    hardware_version: Optional[str] = None
    protocol_version: Optional[str] = None


class DeviceCapabilityModel(BaseModel):
    """Device capability model"""
    name: str
    category: str
    description: str = ""
    parameters: Dict[str, Any] = Field(default_factory=dict)
    read_only: bool = False


class DiscoveredDeviceModel(BaseModel):
    """Discovered device model"""
    device_id: str
    protocol_type: str
    address: Optional[Any] = None
    discovery_method: str
    discovered_at: datetime
    device_class: str = "unknown"
    identity: DeviceIdentityModel
    capabilities: List[DeviceCapabilityModel] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)


class ManualDeviceRegistration(BaseModel):
    """Manual device registration request"""
    device_id: Optional[str] = None
    protocol_type: str
    address: Optional[Any] = None
    device_class: str = "unknown"
    identity: Optional[DeviceIdentityModel] = None
    capabilities: List[DeviceCapabilityModel] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DeviceRegistrationRequest(BaseModel):
    """Device registration request"""
    device_id: str
    adapter_id: str
    name: Optional[str] = None


class DiscoveryConfigUpdate(BaseModel):
    """Discovery configuration update"""
    auto_discovery_interval: Optional[float] = Field(None, gt=0)
    probe_timeout: Optional[float] = Field(None, gt=0)
    max_retries: Optional[int] = Field(None, ge=0)
    enable_passive_discovery: Optional[bool] = None
    enable_broadcast: Optional[bool] = None


@router.post("/start")
async def start_discovery(
    background_tasks: BackgroundTasks,
    protocols: Optional[List[str]] = Query(None, description="Protocol types to discover"),
    methods: Optional[List[str]] = Query(None, description="Discovery methods to use")
):
    """Start device discovery for specified protocols"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        # Convert string parameters to enums
        protocol_list = None
        if protocols:
            protocol_list = [ProtocolType[p.upper()] for p in protocols]
        
        method_list = None
        if methods:
            method_list = [DiscoveryMethod[m.upper()] for m in methods]
        
        # Start discovery in background
        background_tasks.add_task(
            discovery_engine.start_discovery,
            protocols=protocol_list,
            methods=method_list
        )
        
        return {
            "status": "discovery_started",
            "protocols": protocols or "all",
            "methods": methods or ["auto", "probe"]
        }
        
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_discovery(
    protocols: Optional[List[str]] = Query(None, description="Protocol types to stop")
):
    """Stop device discovery"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        protocol_list = None
        if protocols:
            protocol_list = [ProtocolType[p.upper()] for p in protocols]
        
        await discovery_engine.stop_discovery(protocols=protocol_list)
        
        return {
            "status": "discovery_stopped",
            "protocols": protocols or "all"
        }
        
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid protocol: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan")
async def scan_now(
    protocol: Optional[str] = Query(None, description="Protocol type to scan")
):
    """Perform immediate device scan"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        protocol_type = None
        if protocol:
            protocol_type = ProtocolType[protocol.upper()]
        
        devices = await discovery_engine.discover_now(protocol=protocol_type)
        
        return {
            "status": "scan_complete",
            "discovered": len(devices),
            "devices": [
                DiscoveredDeviceModel(
                    device_id=d.device_id,
                    protocol_type=d.protocol_type.value,
                    address=d.address,
                    discovery_method=d.discovery_method.value,
                    discovered_at=d.discovered_at,
                    device_class=d.device_class.value,
                    identity=DeviceIdentityModel(**d.identity.__dict__),
                    capabilities=[DeviceCapabilityModel(**c.__dict__) for c in d.capabilities],
                    metadata=d.metadata,
                    confidence=d.confidence
                )
                for d in devices
            ]
        }
        
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid protocol: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices", response_model=List[DiscoveredDeviceModel])
async def get_discovered_devices(
    protocol: Optional[str] = Query(None, description="Filter by protocol type"),
    device_class: Optional[str] = Query(None, description="Filter by device class")
):
    """Get all discovered devices"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        protocol_type = None
        if protocol:
            protocol_type = ProtocolType[protocol.upper()]
        
        device_class_enum = None
        if device_class:
            device_class_enum = DeviceClass[device_class.upper()]
        
        devices = discovery_engine.get_discovered_devices(
            protocol=protocol_type,
            device_class=device_class_enum
        )
        
        return [
            DiscoveredDeviceModel(
                device_id=d.device_id,
                protocol_type=d.protocol_type.value,
                address=d.address,
                discovery_method=d.discovery_method.value,
                discovered_at=d.discovered_at,
                device_class=d.device_class.value,
                identity=DeviceIdentityModel(**d.identity.__dict__),
                capabilities=[DeviceCapabilityModel(**c.__dict__) for c in d.capabilities],
                metadata=d.metadata,
                confidence=d.confidence
            )
            for d in devices
        ]
        
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices/{device_id}", response_model=DiscoveredDeviceModel)
async def get_device_info(device_id: str):
    """Get information about a specific discovered device"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        device = discovery_engine.get_device_info(device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return DiscoveredDeviceModel(
            device_id=device.device_id,
            protocol_type=device.protocol_type.value,
            address=device.address,
            discovery_method=device.discovery_method.value,
            discovered_at=device.discovered_at,
            device_class=device.device_class.value,
            identity=DeviceIdentityModel(**device.identity.__dict__),
            capabilities=[DeviceCapabilityModel(**c.__dict__) for c in device.capabilities],
            metadata=device.metadata,
            confidence=device.confidence
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/devices/register")
async def register_device(request: DeviceRegistrationRequest):
    """Register a discovered device with the hardware manager"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        hardware_device = await discovery_engine.register_device(
            device_id=request.device_id,
            adapter_id=request.adapter_id,
            name=request.name
        )
        
        return {
            "status": "registered",
            "device_id": hardware_device.device_id,
            "name": hardware_device.name,
            "adapter_id": hardware_device.adapter_id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/devices/manual")
async def register_manual_device(device: ManualDeviceRegistration):
    """Manually register a device"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        device_data = device.dict()
        device_id = await discovery_engine.register_manual_device(device_data)
        
        return {
            "status": "registered",
            "device_id": device_id
        }
        
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/devices/{device_id}")
async def remove_device(device_id: str):
    """Remove a discovered device"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        if discovery_engine.remove_discovered_device(device_id):
            return {"status": "removed", "device_id": device_id}
        else:
            raise HTTPException(status_code=404, detail="Device not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_discovery_status():
    """Get discovery engine status"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        return discovery_engine.get_discovery_status()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/config")
async def update_discovery_config(config: DiscoveryConfigUpdate):
    """Update discovery configuration"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        
        # Update configuration
        update_dict = config.dict(exclude_unset=True)
        discovery_engine._discovery_config.update(update_dict)
        
        return {
            "status": "updated",
            "configuration": discovery_engine._discovery_config
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export")
async def export_device_registry(file_path: str = Query(..., description="Export file path")):
    """Export discovered devices to file"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        await discovery_engine.export_device_registry(file_path)
        
        return {
            "status": "exported",
            "file_path": file_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_device_registry(file_path: str = Query(..., description="Import file path")):
    """Import devices from file"""
    try:
        discovery_engine = get_discovery_engine(hardware_manager)
        imported = await discovery_engine.import_device_registry(file_path)
        
        return {
            "status": "imported",
            "imported_devices": imported,
            "file_path": file_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# WebSocket endpoint for real-time discovery events
from fastapi import WebSocket, WebSocketDisconnect
import json


@router.websocket("/events")
async def discovery_events_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time discovery events"""
    await websocket.accept()
    
    discovery_engine = get_discovery_engine(hardware_manager)
    
    # Event handler that sends to websocket
    async def send_event(event_data: Dict[str, Any]):
        try:
            # Serialize the event data
            if 'device' in event_data:
                device = event_data['device']
                event_data['device'] = {
                    'device_id': device.device_id,
                    'protocol_type': device.protocol_type.value,
                    'address': device.address,
                    'device_class': device.device_class.value,
                    'confidence': device.confidence
                }
            
            if 'timestamp' in event_data and hasattr(event_data['timestamp'], 'isoformat'):
                event_data['timestamp'] = event_data['timestamp'].isoformat()
            
            await websocket.send_json(event_data)
        except Exception as e:
            print(f"Error sending event: {e}")
    
    # Register event handlers
    discovery_engine.register_event_handler('device_discovered', send_event)
    discovery_engine.register_event_handler('device_registered', send_event)
    
    try:
        # Keep connection alive
        while True:
            # Wait for any message from client (ping/pong)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
                
    except WebSocketDisconnect:
        # Client disconnected
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Could unregister handlers here if we tracked them
        pass