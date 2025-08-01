"""
Simulation API routes for hardware abstraction layer.
Provides endpoints for controlling and monitoring the simulation engine.
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional, Any
from uuid import uuid4
import asyncio
import json
from datetime import datetime

from ..models.auth import User
from ..models.hardware import SimulationConfig, DeviceProfile, ScenarioConfig
from ..dependencies import get_current_user, require_role
from ..hardware.simulation.simulation_engine import SimulationEngine
from ..hardware.simulation.device_profiles import DEVICE_PROFILES
from ..hardware.simulation.scenario_manager import ScenarioManager
from ..hardware.simulation.hal_integration import hal_simulation
from ..websocket.manager import manager

router = APIRouter(prefix="/simulation", tags=["simulation"])

# Global simulation instances
simulation_engine: Optional[SimulationEngine] = None
scenario_manager = ScenarioManager()

class SimulationStatus:
    """Track simulation state and metrics."""
    def __init__(self):
        self.is_running = False
        self.start_time = None
        self.config = None
        self.devices = {}
        self.metrics = {
            "total_messages": 0,
            "error_count": 0,
            "uptime": 0,
            "active_devices": 0
        }

simulation_status = SimulationStatus()

@router.get("/status")
async def get_simulation_status(current_user: User = Depends(get_current_user)):
    """Get current simulation status and metrics."""
    if simulation_status.start_time and simulation_status.is_running:
        simulation_status.metrics["uptime"] = (datetime.utcnow() - simulation_status.start_time).total_seconds()
    
    return {
        "is_running": simulation_status.is_running,
        "start_time": simulation_status.start_time.isoformat() if simulation_status.start_time else None,
        "config": simulation_status.config,
        "devices": list(simulation_status.devices.values()),
        "metrics": simulation_status.metrics
    }

@router.post("/start")
async def start_simulation(
    config: SimulationConfig,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Start the simulation engine with the provided configuration."""
    global simulation_engine
    
    if simulation_status.is_running:
        raise HTTPException(status_code=400, detail="Simulation is already running")
    
    try:
        # Initialize HAL simulation integration
        await hal_simulation.initialize(config.dict())
        
        # Start simulation
        await hal_simulation.start_simulation()
        
        # Update status
        simulation_status.is_running = True
        simulation_status.start_time = datetime.utcnow()
        simulation_status.config = config.dict()
        simulation_status.devices = {}
        
        # Add simulated devices through HAL
        for device_config in config.devices:
            device_id = await hal_simulation.add_simulated_device(
                profile_name=device_config.profile,
                initial_state=device_config.initial_state
            )
            
            # Get device info from HAL
            devices = await hal_simulation.get_simulated_devices()
            device_info = next((d for d in devices if d.id == device_id), None)
            
            if device_info:
                simulation_status.devices[device_id] = {
                    "id": device_id,
                    "profile": device_config.profile,
                    "state": device_config.initial_state,
                    "status": "active",
                    "info": device_info.dict()
                }
        
        # Start background telemetry task
        background_tasks.add_task(broadcast_telemetry)
        
        # Notify via WebSocket
        await manager.broadcast(json.dumps({
            "event": "simulation:started",
            "data": {
                "config": config.dict(),
                "devices": list(simulation_status.devices.values())
            }
        }))
        
        return {
            "status": "started",
            "session_id": str(uuid4()),
            "devices": list(simulation_status.devices.values())
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start simulation: {str(e)}")

@router.post("/stop")
async def stop_simulation(
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Stop the running simulation."""
    global simulation_engine
    
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running")
    
    try:
        # Stop simulation through HAL
        await hal_simulation.stop_simulation()
        
        # Update status
        simulation_status.is_running = False
        
        # Notify via WebSocket
        await manager.broadcast(json.dumps({
            "event": "simulation:stopped",
            "data": {
                "uptime": (datetime.utcnow() - simulation_status.start_time).total_seconds(),
                "metrics": simulation_status.metrics
            }
        }))
        
        return {"status": "stopped", "metrics": simulation_status.metrics}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop simulation: {str(e)}")

@router.get("/devices")
async def get_simulated_devices(
    current_user: User = Depends(get_current_user)
):
    """Get list of available device profiles and active simulated devices."""
    return {
        "profiles": list(DEVICE_PROFILES.keys()),
        "active_devices": list(simulation_status.devices.values()) if simulation_status.is_running else []
    }

@router.put("/devices/{device_id}")
async def update_device_configuration(
    device_id: str,
    config: Dict[str, Any],
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Update configuration of a simulated device."""
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running")
    
    if device_id not in simulation_status.devices:
        raise HTTPException(status_code=404, detail="Device not found")
    
    try:
        # Update device in simulation engine
        if simulation_engine:
            simulation_engine.update_device(device_id, config)
        
        # Update local status
        simulation_status.devices[device_id].update(config)
        
        # Notify via WebSocket
        await manager.broadcast(json.dumps({
            "event": "simulation:device_updated",
            "data": {
                "device_id": device_id,
                "config": config
            }
        }))
        
        return {"status": "updated", "device": simulation_status.devices[device_id]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update device: {str(e)}")

@router.post("/devices/{device_id}/command")
async def send_device_command(
    device_id: str,
    command: Dict[str, Any],
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Send a command to a simulated device."""
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running")
    
    if device_id not in simulation_status.devices:
        raise HTTPException(status_code=404, detail="Device not found")
    
    try:
        # Send command through HAL
        result = await hal_simulation.send_command(device_id, command)
        
        # Update metrics
        simulation_status.metrics["total_messages"] += 1
        
        return {"status": "sent", "result": result}
            
    except Exception as e:
        simulation_status.metrics["error_count"] += 1
        raise HTTPException(status_code=500, detail=f"Failed to send command: {str(e)}")

@router.get("/scenarios")
async def get_scenarios(
    current_user: User = Depends(get_current_user)
):
    """Get list of available simulation scenarios."""
    scenarios = scenario_manager.list_scenarios()
    return {"scenarios": scenarios}

@router.post("/scenarios/{scenario_id}/run")
async def run_scenario(
    scenario_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Execute a simulation scenario."""
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="Simulation must be running to execute scenarios")
    
    try:
        # Load and validate scenario
        scenario = scenario_manager.load_scenario(scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        # Execute scenario in background
        background_tasks.add_task(execute_scenario, scenario_id, scenario)
        
        return {
            "status": "started",
            "scenario_id": scenario_id,
            "estimated_duration": scenario.get("duration", "unknown")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run scenario: {str(e)}")

@router.post("/scenarios/record/start")
async def start_recording(
    name: str,
    description: Optional[str] = None,
    current_user: User = Depends(require_role(["admin", "engineer"]))
):
    """Start recording a new scenario."""
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="Simulation must be running to record scenarios")
    
    try:
        session_id = scenario_manager.start_recording(name, description)
        
        await manager.broadcast(json.dumps({
            "event": "simulation:recording_started",
            "data": {"session_id": session_id, "name": name}
        }))
        
        return {"status": "recording", "session_id": session_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start recording: {str(e)}")

@router.post("/scenarios/record/stop")
async def stop_recording(
    session_id: str,
    current_user: User = Depends(require_role(["admin", "engineer"]))
):
    """Stop recording and save the scenario."""
    try:
        scenario_id = scenario_manager.stop_recording(session_id)
        
        await manager.broadcast(json.dumps({
            "event": "simulation:recording_stopped",
            "data": {"session_id": session_id, "scenario_id": scenario_id}
        }))
        
        return {"status": "saved", "scenario_id": scenario_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop recording: {str(e)}")

@router.get("/network/conditions")
async def get_network_conditions(
    current_user: User = Depends(get_current_user)
):
    """Get current network simulation conditions."""
    if not simulation_status.is_running:
        return {"conditions": None}
    
    # Get from HAL simulation (which maintains the simulation engine)
    metrics = await hal_simulation.get_simulation_metrics()
    return {"conditions": metrics.get("network_conditions", None)}

@router.put("/network/conditions")
async def update_network_conditions(
    conditions: Dict[str, Any],
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Update network simulation conditions."""
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running")
    
    try:
        await hal_simulation.set_network_conditions(conditions)
        
        await manager.broadcast(json.dumps({
            "event": "simulation:network_updated",
            "data": conditions
        }))
        
        return {"status": "updated", "conditions": conditions}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update network conditions: {str(e)}")

@router.get("/environment")
async def get_environment_conditions(
    current_user: User = Depends(get_current_user)
):
    """Get current environmental simulation conditions."""
    if not simulation_status.is_running:
        return {"environment": None}
    
    # Get from HAL simulation
    metrics = await hal_simulation.get_simulation_metrics()
    return {"environment": metrics.get("environment_conditions", None)}

@router.put("/environment")
async def update_environment_conditions(
    conditions: Dict[str, Any],
    current_user: User = Depends(require_role(["admin", "engineer", "operator"]))
):
    """Update environmental simulation conditions."""
    if not simulation_status.is_running:
        raise HTTPException(status_code=400, detail="No simulation is running")
    
    try:
        await hal_simulation.set_environment_conditions(conditions)
        
        await manager.broadcast(json.dumps({
            "event": "simulation:environment_updated",
            "data": conditions
        }))
        
        return {"status": "updated", "environment": conditions}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update environment: {str(e)}")

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time simulation updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Send heartbeat
            await websocket.send_json({
                "event": "heartbeat",
                "timestamp": datetime.utcnow().isoformat()
            })
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Background tasks
async def broadcast_telemetry():
    """Broadcast telemetry data from simulated devices."""
    while simulation_status.is_running:
        try:
            # Get telemetry for all devices
            telemetry = {}
            for device_id in simulation_status.devices:
                try:
                    device_telemetry = await hal_simulation.get_device_telemetry(device_id)
                    telemetry[device_id] = device_telemetry
                except Exception as e:
                    logger.error(f"Error getting telemetry for {device_id}: {e}")
            
            if telemetry:
                await manager.broadcast(json.dumps({
                    "event": "simulation:telemetry",
                    "data": telemetry
                }))
                
                # Update metrics
                simulation_status.metrics["total_messages"] += len(telemetry)
                simulation_status.metrics["active_devices"] = len([d for d in simulation_status.devices.values() if d["status"] == "active"])
                
            await asyncio.sleep(1)  # Broadcast every second
            
        except Exception as e:
            print(f"Error broadcasting telemetry: {e}")
            simulation_status.metrics["error_count"] += 1
            await asyncio.sleep(5)  # Back off on error

async def execute_scenario(scenario_id: str, scenario: Dict[str, Any]):
    """Execute a simulation scenario."""
    try:
        # Notify start
        await manager.broadcast(json.dumps({
            "event": "simulation:scenario_started",
            "data": {"scenario_id": scenario_id, "name": scenario.get("name")}
        }))
        
        # Execute scenario steps
        for idx, step in enumerate(scenario.get("steps", [])):
            if not simulation_status.is_running:
                break
                
            # Execute step based on action type
            action = step.get("action", "")
            target = step.get("target", "")
            params = step.get("parameters", {})
            
            if action == "send_command" and target:
                await hal_simulation.send_command(target, params)
            elif action == "update_device":
                await hal_simulation.update_device_state(target, params)
            elif action == "set_network":
                await hal_simulation.set_network_conditions(params)
            elif action == "set_environment":
                await hal_simulation.set_environment_conditions(params)
            
            # Notify progress
            await manager.broadcast(json.dumps({
                "event": "simulation:scenario_progress",
                "data": {
                    "scenario_id": scenario_id,
                    "step": step.get("name", "Unknown"),
                    "progress": ((idx + 1) / len(scenario.get("steps", []))) * 100
                }
            }))
            
            # Wait if specified
            if "delay" in step:
                await asyncio.sleep(step["delay"])
        
        # Notify completion
        await manager.broadcast(json.dumps({
            "event": "simulation:scenario_completed",
            "data": {"scenario_id": scenario_id}
        }))
        
    except Exception as e:
        # Notify error
        await manager.broadcast(json.dumps({
            "event": "simulation:scenario_error",
            "data": {
                "scenario_id": scenario_id,
                "error": str(e)
            }
        }))