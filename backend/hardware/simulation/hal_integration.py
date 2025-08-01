"""
HAL Integration for Simulation Engine
Integrates the simulation engine with the Hardware Abstraction Layer
"""

import logging
from typing import Dict, Any, Optional, List, Callable
import asyncio
from datetime import datetime
from dataclasses import dataclass
import random

from ..base import ProtocolAdapter, ProtocolConfig, ProtocolType
from ..factory import ProtocolAdapterFactory
from ..mock_adapter import MockAdapter, MockConfig
from .simulation_engine import SimulationEngine, SimulationConfig
from .device_profiles import DeviceProfile, SensorProfile, ActuatorProfile, create_default_profiles, SensorType
from models.hardware import DeviceInfo


logger = logging.getLogger(__name__)


@dataclass
class SimulationDevice:
    """Represents a simulated device in the HAL"""
    device_id: str
    protocol_type: ProtocolType
    adapter_id: str
    profile: DeviceProfile
    device_info: DeviceInfo
    mock_device: Any  # MockDevice instance


class HALSimulationIntegration:
    """
    Integrates simulation engine with the Hardware Abstraction Layer
    """
    
    def __init__(self):
        self.simulation_engine: Optional[SimulationEngine] = None
        self.simulated_devices: Dict[str, SimulationDevice] = {}
        self.adapters: Dict[str, MockAdapter] = {}
        self.profiles = create_default_profiles()
        self._device_counter = 0
        
    async def initialize(self, config: Dict[str, Any]):
        """
        Initialize the simulation integration
        
        Args:
            config: Simulation configuration
        """
        logger.info("Initializing HAL simulation integration")
        
        # Create simulation engine
        self.simulation_engine = SimulationEngine(SimulationConfig(**config))
        
        # Initialize default profiles
        await self._load_device_profiles()
        
    async def start_simulation(self):
        """Start the simulation engine"""
        if not self.simulation_engine:
            raise RuntimeError("Simulation engine not initialized")
            
        await self.simulation_engine.start()
        logger.info("Simulation started")
        
    async def stop_simulation(self):
        """Stop the simulation engine"""
        if not self.simulation_engine:
            return
            
        await self.simulation_engine.stop()
        
        # Clean up adapters
        for adapter in self.adapters.values():
            await adapter.disconnect()
            
        self.adapters.clear()
        self.simulated_devices.clear()
        logger.info("Simulation stopped")
        
    async def add_simulated_device(self, 
                                 profile_name: str,
                                 protocol_type: ProtocolType = ProtocolType.MOCK,
                                 initial_state: Optional[Dict[str, Any]] = None) -> str:
        """
        Add a simulated device to the HAL
        
        Args:
            profile_name: Name of the device profile to use
            protocol_type: Protocol type (default: MOCK)
            initial_state: Initial device state
            
        Returns:
            Device ID
        """
        if profile_name not in self.profiles:
            raise ValueError(f"Unknown device profile: {profile_name}")
            
        profile = self.profiles[profile_name]
        
        # Generate device ID
        self._device_counter += 1
        device_id = f"sim_device_{self._device_counter}"
        
        # Create or get adapter
        adapter_id = f"sim_adapter_{protocol_type.value}"
        if adapter_id not in self.adapters:
            # Create mock adapter config
            mock_config = MockConfig(
                name=f"Simulation {protocol_type.value} Adapter",
                transmission_delay=0.01,
                transmission_error_rate=0.0
            )
            
            # Create adapter through factory
            adapter = ProtocolAdapterFactory.create_adapter(
                ProtocolType.MOCK, 
                mock_config,
                adapter_id
            )
            
            if isinstance(adapter, MockAdapter):
                self.adapters[adapter_id] = adapter
                await adapter.connect()
            else:
                raise TypeError("Expected MockAdapter instance")
        
        adapter = self.adapters[adapter_id]
        
        # Update profile with device_id and add to simulation engine
        if self.simulation_engine:
            # Create a copy of the profile with the new device_id
            import copy
            device_profile = copy.deepcopy(profile)
            device_profile.device_id = device_id
            
            # Add device with profile
            await self.simulation_engine.add_device(device_profile)
        
        # Create device info
        device_info = DeviceInfo(
            id=device_id,
            name=f"{profile.name} (Simulated)",
            type=profile.device_type,
            protocol=protocol_type,
            address=f"sim://{device_id}",
            status="connected",
            capabilities=self._profile_to_capabilities(profile),
            firmware_version="1.0.0-sim",
            last_seen=datetime.utcnow(),
            metadata={
                "simulated": True,
                "profile": profile_name,
                "profile_model": profile.model,
                "profile_manufacturer": profile.manufacturer
            }
        )
        
        # Create mock device
        from ..mock_adapter import MockDevice
        
        # Get response delay if available
        response_delay = 0.01  # default
        if hasattr(profile, 'response_profile') and profile.response_profile:
            response_delay = profile.response_profile.get_response_delay()
        
        mock_device = MockDevice(
            device_id=device_id,
            name=profile.name,
            response_delay=response_delay
        )
        
        # Configure default responses based on device type
        if isinstance(profile, SensorProfile):
            # For sensors, respond to read commands with simulated data
            import json
            
            # Default read command response
            read_cmd = json.dumps({"action": "read"}).encode('utf-8')
            
            # Generate response based on sensor type
            if profile.sensor_type == SensorType.TEMPERATURE:
                response_data = {
                    "status": "ok",
                    "value": 25.0,  # Default temperature
                    "unit": "celsius",
                    "device_id": device_id
                }
            elif profile.sensor_type == SensorType.ACCELEROMETER:
                response_data = {
                    "status": "ok", 
                    "accel": {"x": 0.0, "y": 0.0, "z": 9.81},
                    "gyro": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "device_id": device_id
                }
            else:
                response_data = {
                    "status": "ok",
                    "value": 0.0,
                    "device_id": device_id
                }
            
            mock_device.responses[read_cmd] = json.dumps(response_data).encode('utf-8')
        
        # Add device to adapter
        adapter.add_device(mock_device)
        
        # Store device
        sim_device = SimulationDevice(
            device_id=device_id,
            protocol_type=protocol_type,
            adapter_id=adapter_id,
            profile=profile,
            device_info=device_info,
            mock_device=mock_device
        )
        
        self.simulated_devices[device_id] = sim_device
        
        logger.info(f"Added simulated device: {device_id} with profile: {profile_name}")
        return device_id
        
    async def remove_simulated_device(self, device_id: str):
        """
        Remove a simulated device
        
        Args:
            device_id: Device to remove
        """
        if device_id not in self.simulated_devices:
            return
            
        device = self.simulated_devices[device_id]
        
        # Remove from simulation engine
        if self.simulation_engine:
            await self.simulation_engine.remove_device(device_id)
        
        # Remove from adapter
        if device.adapter_id in self.adapters:
            adapter = self.adapters[device.adapter_id]
            adapter.remove_device(device_id)
        
        del self.simulated_devices[device_id]
        logger.info(f"Removed simulated device: {device_id}")
        
    async def get_simulated_devices(self) -> List[DeviceInfo]:
        """
        Get list of all simulated devices
        
        Returns:
            List of device info
        """
        return [device.device_info for device in self.simulated_devices.values()]
        
    async def update_device_state(self, device_id: str, state: Dict[str, Any]):
        """
        Update simulated device state
        
        Args:
            device_id: Device to update
            state: New state values
        """
        if device_id not in self.simulated_devices:
            raise ValueError(f"Unknown device: {device_id}")
            
        device = self.simulated_devices[device_id]
        
        # Update in simulation engine
        if self.simulation_engine:
            await self.simulation_engine.set_device_state(device_id, state)
        
        # Update mock device behavior if needed
        if "behavior" in state and hasattr(device.mock_device, 'behavior'):
            device.mock_device.behavior.update(state["behavior"])
            
        logger.debug(f"Updated device {device_id} state: {state}")
        
    async def get_device_telemetry(self, device_id: str) -> Dict[str, Any]:
        """
        Get current telemetry from a simulated device
        
        Args:
            device_id: Device to query
            
        Returns:
            Telemetry data
        """
        if not self.simulation_engine:
            return {}
            
        if device_id not in self.simulated_devices:
            raise ValueError(f"Unknown device: {device_id}")
            
        telemetry = await self.simulation_engine.get_device_telemetry(device_id)
        return telemetry
        
    async def send_command(self, device_id: str, command: Dict[str, Any]) -> Any:
        """
        Send command to a simulated device
        
        Args:
            device_id: Target device
            command: Command to send
            
        Returns:
            Command response
        """
        if device_id not in self.simulated_devices:
            raise ValueError(f"Unknown device: {device_id}")
            
        device = self.simulated_devices[device_id]
        
        # Get adapter
        if device.adapter_id not in self.adapters:
            raise RuntimeError(f"Adapter not found: {device.adapter_id}")
            
        adapter = self.adapters[device.adapter_id]
        
        # Convert command to bytes for protocol transmission
        # For simulation, we'll use a simple JSON encoding
        import json
        command_bytes = json.dumps(command).encode('utf-8')
        
        # Use the adapter's query method to send command and get response
        # Include device_id in metadata for the mock adapter to route properly
        response_packet = await adapter.query(
            command_bytes,
            timeout=5.0,
            device_id=device_id
        )
        
        # Decode response
        try:
            response_data = json.loads(response_packet.data.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            # If response isn't JSON, return raw bytes as hex string
            response_data = {'raw_response': response_packet.data.hex()}
        
        # Also notify simulation engine if it has the method
        if self.simulation_engine and hasattr(self.simulation_engine, 'send_command'):
            await self.simulation_engine.send_command(device_id, command)
        
        return response_data
        
    def _profile_to_capabilities(self, profile: DeviceProfile) -> List[Dict[str, Any]]:
        """Convert device profile to capability list"""
        capabilities = []
        
        # Generate capabilities based on profile type
        if isinstance(profile, SensorProfile):
            capabilities.append({
                "name": "measure",
                "type": "sensor",
                "description": f"Measure {profile.sensor_type.value}",
                "parameters": {
                    "range_min": profile.range_min,
                    "range_max": profile.range_max,
                    "resolution": profile.resolution,
                    "accuracy": profile.accuracy,
                    "sampling_rate": profile.sampling_rate
                }
            })
        elif isinstance(profile, ActuatorProfile):
            capabilities.append({
                "name": "control",
                "type": "actuator",
                "description": f"Control {profile.actuator_type.value}",
                "parameters": {
                    "control_type": profile.control_type,
                    "range_min": profile.control_range_min,
                    "range_max": profile.control_range_max,
                    "max_speed": profile.max_speed,
                    "max_acceleration": profile.max_acceleration
                }
            })
        else:
            # Generic device capabilities
            capabilities.append({
                "name": "status",
                "type": "generic",
                "description": "Get device status",
                "parameters": {}
            })
            
        return capabilities
        
    async def _load_device_profiles(self):
        """Load additional device profiles"""
        # This could load from configuration files
        # For now, we use the default profiles
        pass
        
    async def set_network_conditions(self, conditions: Dict[str, Any]):
        """Set network simulation conditions"""
        if self.simulation_engine:
            self.simulation_engine.set_network_conditions(conditions)
            
    async def set_environment_conditions(self, conditions: Dict[str, Any]):
        """Set environmental simulation conditions"""
        if self.simulation_engine:
            self.simulation_engine.set_environment_conditions(conditions)
            
    async def get_simulation_metrics(self) -> Dict[str, Any]:
        """Get simulation metrics"""
        if not self.simulation_engine:
            return {}
            
        return self.simulation_engine.get_metrics()


# Global instance
hal_simulation = HALSimulationIntegration()