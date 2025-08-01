"""
Simulation Engine
Main engine that coordinates all simulation components
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Callable, Set
from enum import Enum
import asyncio
import logging
from datetime import datetime, timedelta
import json
import random
from pathlib import Path

from ..mock_adapter import MockAdapter, MockConfig, MockDevice
from .device_profiles import (
    DeviceProfile, SensorProfile, ActuatorProfile, 
    create_default_profiles, SensorType, ActuatorType, DeviceType
)
from .physics_simulator import (
    PhysicsSimulator, PhysicsState, EnvironmentalConditions,
    SensorPhysics, ActuatorPhysics, Vector3, TerrainType
)
from .network_simulator import (
    NetworkSimulator, NetworkProfile, create_network_profiles
)
from .scenario_manager import (
    ScenarioManager, Scenario, ScenarioStep, ScenarioActionType,
    ScenarioExecutionContext
)


logger = logging.getLogger(__name__)


class SimulationMode(Enum):
    """Simulation operation modes"""
    REALTIME = "realtime"  # Real-time simulation
    ACCELERATED = "accelerated"  # Faster than real-time
    STEP = "step"  # Step-by-step execution
    PLAYBACK = "playback"  # Playback recorded data


class SimulationState(Enum):
    """Simulation state"""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


@dataclass
class SimulationConfig:
    """Configuration for simulation engine"""
    # Timing
    simulation_rate: float = 100.0  # Hz
    time_acceleration: float = 1.0  # 1.0 = realtime, 2.0 = 2x speed
    
    # Recording
    enable_recording: bool = True
    recording_buffer_size: int = 10000  # Number of events to buffer
    auto_save_interval: float = 60.0  # Seconds between auto-saves
    
    # Physics
    enable_physics: bool = True
    physics_rate: float = 100.0  # Hz
    
    # Network
    enable_network_simulation: bool = True
    default_network_profile: str = "wifi_good"
    
    # Devices
    auto_discover_devices: bool = True
    device_startup_delay: float = 0.5  # Seconds between device startups
    
    # Scenarios
    scenarios_directory: Path = field(default_factory=lambda: Path("scenarios"))
    recordings_directory: Path = field(default_factory=lambda: Path("recordings"))
    
    # Performance
    max_concurrent_devices: int = 100
    event_queue_size: int = 1000
    
    # Debugging
    verbose_logging: bool = False
    debug_mode: bool = False


@dataclass
class SimulationEvent:
    """An event in the simulation"""
    timestamp: datetime
    event_type: str
    source: str
    data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SimulationRecording:
    """Recording of simulation events"""
    recording_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    events: List[SimulationEvent] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_event(self, event: SimulationEvent):
        """Add an event to the recording"""
        self.events.append(event)
    
    def save(self, filepath: Path):
        """Save recording to file"""
        data = {
            'recording_id': self.recording_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'events': [
                {
                    'timestamp': e.timestamp.isoformat(),
                    'event_type': e.event_type,
                    'source': e.source,
                    'data': e.data,
                    'metadata': e.metadata
                }
                for e in self.events
            ],
            'metadata': self.metadata
        }
        
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    
    @classmethod
    def load(cls, filepath: Path) -> 'SimulationRecording':
        """Load recording from file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        recording = cls(
            recording_id=data['recording_id'],
            start_time=datetime.fromisoformat(data['start_time']),
            end_time=datetime.fromisoformat(data['end_time']) if data['end_time'] else None,
            metadata=data.get('metadata', {})
        )
        
        for event_data in data['events']:
            event = SimulationEvent(
                timestamp=datetime.fromisoformat(event_data['timestamp']),
                event_type=event_data['event_type'],
                source=event_data['source'],
                data=event_data['data'],
                metadata=event_data.get('metadata', {})
            )
            recording.add_event(event)
        
        return recording


class SimulationEngine:
    """Main simulation engine coordinating all components"""
    
    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()
        
        # Core components
        self.physics_simulator = PhysicsSimulator() if self.config.enable_physics else None
        self.network_simulator = None
        self.scenario_manager = ScenarioManager(self.config.scenarios_directory)
        
        # Device management
        self.device_profiles: Dict[str, DeviceProfile] = {}
        self.mock_adapters: Dict[str, MockAdapter] = {}
        self.device_states: Dict[str, Dict[str, Any]] = {}
        
        # Simulation state
        self.state = SimulationState.STOPPED
        self.mode = SimulationMode.REALTIME
        self.simulation_time = 0.0
        self.real_start_time: Optional[datetime] = None
        
        # Event handling
        self.event_queue: asyncio.Queue = asyncio.Queue(maxsize=self.config.event_queue_size)
        self.event_handlers: Dict[str, List[Callable]] = {}
        
        # Recording
        self.current_recording: Optional[SimulationRecording] = None
        self.recordings: Dict[str, SimulationRecording] = {}
        
        # Tasks
        self._simulation_task: Optional[asyncio.Task] = None
        self._physics_task: Optional[asyncio.Task] = None
        self._recording_task: Optional[asyncio.Task] = None
        self._event_task: Optional[asyncio.Task] = None
        
        # Initialize
        self._initialize()
    
    def _initialize(self):
        """Initialize simulation components"""
        # Load default device profiles
        self.device_profiles.update(create_default_profiles())
        
        # Initialize network simulator
        if self.config.enable_network_simulation:
            network_profiles = create_network_profiles()
            profile = network_profiles.get(
                self.config.default_network_profile, 
                network_profiles['wifi_good']
            )
            self.network_simulator = NetworkSimulator(profile)
        
        # Register scenario action handlers
        self._register_scenario_handlers()
    
    def _register_scenario_handlers(self):
        """Register handlers for scenario actions"""
        self.scenario_manager.register_action_handler(
            ScenarioActionType.SET_ENVIRONMENT, 
            self._handle_set_environment
        )
        self.scenario_manager.register_action_handler(
            ScenarioActionType.SET_DEVICE_STATE,
            self._handle_set_device_state
        )
        self.scenario_manager.register_action_handler(
            ScenarioActionType.SEND_COMMAND,
            self._handle_send_command
        )
        self.scenario_manager.register_action_handler(
            ScenarioActionType.ASSERT_STATE,
            self._handle_assert_state
        )
        self.scenario_manager.register_action_handler(
            ScenarioActionType.INJECT_FAULT,
            self._handle_inject_fault
        )
        self.scenario_manager.register_action_handler(
            ScenarioActionType.SET_NETWORK,
            self._handle_set_network
        )
    
    async def start(self, mode: SimulationMode = SimulationMode.REALTIME):
        """Start the simulation"""
        if self.state == SimulationState.RUNNING:
            logger.warning("Simulation already running")
            return
        
        self.mode = mode
        self.state = SimulationState.RUNNING
        self.real_start_time = datetime.utcnow()
        
        # Start network simulator
        if self.network_simulator:
            await self.network_simulator.start()
        
        # Start recording if enabled
        if self.config.enable_recording:
            self._start_recording()
        
        # Start simulation tasks
        self._simulation_task = asyncio.create_task(self._simulation_loop())
        self._event_task = asyncio.create_task(self._event_processing_loop())
        
        if self.physics_simulator:
            self._physics_task = asyncio.create_task(self._physics_loop())
        
        if self.config.enable_recording:
            self._recording_task = asyncio.create_task(self._recording_loop())
        
        # Emit start event
        await self.emit_event("simulation_started", {
            'mode': mode.value,
            'time_acceleration': self.config.time_acceleration
        })
        
        logger.info(f"Simulation started in {mode.value} mode")
    
    async def stop(self):
        """Stop the simulation"""
        if self.state == SimulationState.STOPPED:
            return
        
        self.state = SimulationState.STOPPED
        
        # Stop network simulator
        if self.network_simulator:
            await self.network_simulator.stop()
        
        # Cancel tasks
        tasks = [
            self._simulation_task,
            self._physics_task,
            self._recording_task,
            self._event_task
        ]
        
        for task in tasks:
            if task:
                task.cancel()
        
        await asyncio.gather(*[t for t in tasks if t], return_exceptions=True)
        
        # Stop recording
        if self.current_recording:
            self._stop_recording()
        
        # Emit stop event
        await self.emit_event("simulation_stopped", {
            'duration': self.simulation_time
        })
        
        logger.info("Simulation stopped")
    
    async def pause(self):
        """Pause the simulation"""
        if self.state == SimulationState.RUNNING:
            self.state = SimulationState.PAUSED
            await self.emit_event("simulation_paused", {
                'simulation_time': self.simulation_time
            })
            logger.info("Simulation paused")
    
    async def resume(self):
        """Resume the simulation"""
        if self.state == SimulationState.PAUSED:
            self.state = SimulationState.RUNNING
            await self.emit_event("simulation_resumed", {
                'simulation_time': self.simulation_time
            })
            logger.info("Simulation resumed")
    
    async def step(self, dt: Optional[float] = None):
        """Execute one simulation step"""
        if self.state != SimulationState.PAUSED:
            logger.warning("Step mode only available when paused")
            return
        
        dt = dt or (1.0 / self.config.simulation_rate)
        await self._simulation_step(dt)
    
    # Device management
    
    async def add_device(self, device_profile: DeviceProfile) -> MockAdapter:
        """Add a device to the simulation"""
        # Create mock device
        # Get response delay if available (for sensors and actuators)
        response_delay = 0.01  # default
        if hasattr(device_profile, 'response_profile') and device_profile.response_profile:
            response_delay = device_profile.response_profile.get_response_delay()
        
        mock_device = MockDevice(
            device_id=device_profile.device_id,
            name=device_profile.name,
            response_delay=response_delay
        )
        
        # Create mock adapter
        mock_config = MockConfig(
            name=f"Sim_{device_profile.name}",
            devices=[mock_device],
            transmission_delay=0.001
        )
        
        mock_adapter = MockAdapter(mock_config)
        
        # Store references
        self.device_profiles[device_profile.device_id] = device_profile
        self.mock_adapters[device_profile.device_id] = mock_adapter
        self.device_states[device_profile.device_id] = {
            'profile': device_profile,
            'adapter': mock_adapter,
            'physics_state': PhysicsState() if self.physics_simulator else None,
            'sensor_data': {},
            'actuator_state': {}
        }
        
        # Add to physics simulation
        if self.physics_simulator and device_profile.device_type in [DeviceType.SENSOR, DeviceType.ACTUATOR]:
            self.physics_simulator.add_object(
                device_profile.device_id,
                self.device_states[device_profile.device_id]['physics_state']
            )
        
        # Connect adapter
        await mock_adapter.connect()
        
        # Emit event
        await self.emit_event("device_added", {
            'device_id': device_profile.device_id,
            'device_type': device_profile.device_type.value,
            'name': device_profile.name
        })
        
        logger.info(f"Added device: {device_profile.device_id}")
        
        return mock_adapter
    
    async def remove_device(self, device_id: str):
        """Remove a device from the simulation"""
        if device_id not in self.device_profiles:
            logger.warning(f"Device not found: {device_id}")
            return
        
        # Disconnect adapter
        if device_id in self.mock_adapters:
            adapter = self.mock_adapters[device_id]
            if adapter.is_connected:
                await adapter.disconnect()
            del self.mock_adapters[device_id]
        
        # Remove from physics
        if self.physics_simulator:
            self.physics_simulator.remove_object(device_id)
        
        # Clean up
        del self.device_profiles[device_id]
        del self.device_states[device_id]
        
        # Emit event
        await self.emit_event("device_removed", {
            'device_id': device_id
        })
        
        logger.info(f"Removed device: {device_id}")
    
    def get_device_state(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get current state of a device"""
        return self.device_states.get(device_id)
    
    async def set_device_state(self, device_id: str, state: Dict[str, Any]):
        """Set device state"""
        if device_id not in self.device_states:
            logger.warning(f"Device not found: {device_id}")
            return
        
        self.device_states[device_id].update(state)
        
        # Emit event
        await self.emit_event("device_state_changed", {
            'device_id': device_id,
            'state': state
        })
    
    # Environmental control
    
    def set_environment(self, conditions: EnvironmentalConditions):
        """Set environmental conditions"""
        if self.physics_simulator:
            self.physics_simulator.set_environment(conditions)
        
        asyncio.create_task(self.emit_event("environment_changed", {
            'temperature': conditions.temperature,
            'pressure': conditions.pressure,
            'humidity': conditions.humidity,
            'wind_speed': conditions.wind_speed,
            'terrain_type': conditions.terrain_type.value
        }))
    
    def get_environment(self) -> Optional[EnvironmentalConditions]:
        """Get current environmental conditions"""
        if self.physics_simulator:
            return self.physics_simulator.env
        return None
    
    # Network control
    
    def set_network_profile(self, profile_name: str):
        """Set network profile"""
        if not self.network_simulator:
            logger.warning("Network simulation not enabled")
            return
        
        profiles = create_network_profiles()
        if profile_name in profiles:
            self.network_simulator.set_profile(profiles[profile_name])
            
            asyncio.create_task(self.emit_event("network_profile_changed", {
                'profile': profile_name
            }))
        else:
            logger.warning(f"Unknown network profile: {profile_name}")
    
    def get_network_stats(self) -> Optional[Dict[str, Any]]:
        """Get network statistics"""
        if self.network_simulator:
            stats = self.network_simulator.get_stats()
            return {
                'packets_sent': stats.packets_sent,
                'packets_received': stats.packets_received,
                'packets_lost': stats.packets_lost,
                'loss_rate': stats.get_loss_rate(),
                'avg_latency': stats.avg_latency,
                'min_latency': stats.min_latency,
                'max_latency': stats.max_latency
            }
        return None
    
    # Event handling
    
    async def emit_event(self, event_type: str, data: Dict[str, Any], 
                        source: str = "simulation_engine"):
        """Emit a simulation event"""
        event = SimulationEvent(
            timestamp=datetime.utcnow(),
            event_type=event_type,
            source=source,
            data=data,
            metadata={
                'simulation_time': self.simulation_time,
                'mode': self.mode.value
            }
        )
        
        # Add to queue
        try:
            await self.event_queue.put(event)
        except asyncio.QueueFull:
            logger.warning("Event queue full, dropping event")
        
        # Record if enabled
        if self.current_recording:
            self.current_recording.add_event(event)
    
    def register_event_handler(self, event_type: str, handler: Callable):
        """Register an event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    def unregister_event_handler(self, event_type: str, handler: Callable):
        """Unregister an event handler"""
        if event_type in self.event_handlers:
            if handler in self.event_handlers[event_type]:
                self.event_handlers[event_type].remove(handler)
    
    # Recording
    
    def _start_recording(self):
        """Start recording simulation events"""
        recording_id = f"recording_{int(datetime.utcnow().timestamp())}"
        self.current_recording = SimulationRecording(
            recording_id=recording_id,
            start_time=datetime.utcnow(),
            metadata={
                'config': {
                    'simulation_rate': self.config.simulation_rate,
                    'time_acceleration': self.config.time_acceleration,
                    'physics_enabled': self.config.enable_physics,
                    'network_enabled': self.config.enable_network_simulation
                }
            }
        )
        self.recordings[recording_id] = self.current_recording
        logger.info(f"Started recording: {recording_id}")
    
    def _stop_recording(self):
        """Stop recording simulation events"""
        if self.current_recording:
            self.current_recording.end_time = datetime.utcnow()
            
            # Auto-save
            filename = f"{self.current_recording.recording_id}.json"
            filepath = self.config.recordings_directory / filename
            self.current_recording.save(filepath)
            
            logger.info(f"Stopped recording: {self.current_recording.recording_id}")
            self.current_recording = None
    
    async def playback_recording(self, recording_id: str, speed: float = 1.0):
        """Playback a recorded simulation"""
        if recording_id not in self.recordings:
            # Try loading from file
            filepath = self.config.recordings_directory / f"{recording_id}.json"
            if filepath.exists():
                recording = SimulationRecording.load(filepath)
                self.recordings[recording_id] = recording
            else:
                logger.error(f"Recording not found: {recording_id}")
                return
        
        recording = self.recordings[recording_id]
        self.mode = SimulationMode.PLAYBACK
        
        # Playback events
        start_time = recording.events[0].timestamp if recording.events else datetime.utcnow()
        
        for event in recording.events:
            if self.state != SimulationState.RUNNING:
                break
            
            # Calculate delay
            delay = (event.timestamp - start_time).total_seconds() / speed
            if delay > 0:
                await asyncio.sleep(delay)
            
            # Re-emit event
            await self.event_queue.put(event)
            start_time = event.timestamp
    
    # Simulation loops
    
    async def _simulation_loop(self):
        """Main simulation loop"""
        dt = 1.0 / self.config.simulation_rate
        
        while self.state in [SimulationState.RUNNING, SimulationState.PAUSED]:
            try:
                if self.state == SimulationState.RUNNING:
                    await self._simulation_step(dt)
                
                # Sleep based on mode
                if self.mode == SimulationMode.REALTIME:
                    await asyncio.sleep(dt / self.config.time_acceleration)
                elif self.mode == SimulationMode.ACCELERATED:
                    await asyncio.sleep(0.001)  # Minimal delay
                else:
                    await asyncio.sleep(dt)
                
            except Exception as e:
                logger.error(f"Simulation loop error: {e}")
                self.state = SimulationState.ERROR
                break
    
    async def _simulation_step(self, dt: float):
        """Execute one simulation step"""
        # Update simulation time
        self.simulation_time += dt * self.config.time_acceleration
        
        # Update all devices
        for device_id, device_state in self.device_states.items():
            profile = device_state['profile']
            
            if isinstance(profile, SensorProfile):
                await self._update_sensor(device_id, device_state, dt)
            elif isinstance(profile, ActuatorProfile):
                await self._update_actuator(device_id, device_state, dt)
    
    async def _update_sensor(self, device_id: str, device_state: Dict[str, Any], dt: float):
        """Update sensor simulation"""
        profile: SensorProfile = device_state['profile']
        adapter: MockAdapter = device_state['adapter']
        
        # Generate sensor reading based on physics
        if self.physics_simulator:
            physics_state = device_state['physics_state']
            env = self.physics_simulator.env
            
            # Generate reading based on sensor type
            if profile.sensor_type == SensorType.TEMPERATURE:
                true_value = env.temperature
                reading = SensorPhysics.simulate_temperature_sensor(
                    true_value, physics_state.position, env
                )
            elif profile.sensor_type == SensorType.ACCELEROMETER:
                reading = SensorPhysics.simulate_accelerometer(physics_state, env)
            elif profile.sensor_type == SensorType.GYROSCOPE:
                reading = SensorPhysics.simulate_gyroscope(physics_state, env)
            elif profile.sensor_type == SensorType.GPS:
                reading = SensorPhysics.simulate_gps(physics_state.position, env)
            else:
                # Default random reading
                reading = profile.generate_reading(
                    random.uniform(profile.range_min, profile.range_max),
                    self.simulation_time
                )
            
            # Store sensor data
            device_state['sensor_data'][profile.sensor_type.value] = reading
            
            # Inject data into mock adapter
            if adapter.is_connected:
                # Format data based on sensor type
                if isinstance(reading, dict):
                    data = json.dumps(reading).encode()
                elif isinstance(reading, tuple):
                    data = ','.join(map(str, reading)).encode()
                else:
                    data = str(reading).encode()
                
                await adapter.inject_data(data, device_id)
    
    async def _update_actuator(self, device_id: str, device_state: Dict[str, Any], dt: float):
        """Update actuator simulation"""
        profile: ActuatorProfile = device_state['profile']
        actuator_state = device_state.get('actuator_state', {})
        
        # Update actuator physics
        if self.physics_simulator and profile.actuator_type == ActuatorType.MOTOR:
            current_speed = actuator_state.get('speed', 0.0)
            command_voltage = actuator_state.get('command', 0.0)
            load_torque = actuator_state.get('load_torque', 0.0)
            
            new_speed, current, power = ActuatorPhysics.simulate_dc_motor(
                command_voltage, current_speed, load_torque, dt=dt
            )
            
            actuator_state.update({
                'speed': new_speed,
                'current': current,
                'power': power
            })
            
            device_state['actuator_state'] = actuator_state
    
    async def _physics_loop(self):
        """Physics simulation loop"""
        dt = 1.0 / self.config.physics_rate
        
        while self.state in [SimulationState.RUNNING, SimulationState.PAUSED]:
            try:
                if self.state == SimulationState.RUNNING and self.physics_simulator:
                    self.physics_simulator.update(dt * self.config.time_acceleration)
                
                await asyncio.sleep(dt)
                
            except Exception as e:
                logger.error(f"Physics loop error: {e}")
                break
    
    async def _recording_loop(self):
        """Recording auto-save loop"""
        while self.state != SimulationState.STOPPED:
            await asyncio.sleep(self.config.auto_save_interval)
            
            if self.current_recording:
                try:
                    filename = f"{self.current_recording.recording_id}_autosave.json"
                    filepath = self.config.recordings_directory / filename
                    self.current_recording.save(filepath)
                except Exception as e:
                    logger.error(f"Auto-save error: {e}")
    
    async def _event_processing_loop(self):
        """Process events from the queue"""
        while self.state != SimulationState.STOPPED:
            try:
                # Get event with timeout
                event = await asyncio.wait_for(
                    self.event_queue.get(), 
                    timeout=1.0
                )
                
                # Process event handlers
                if event.event_type in self.event_handlers:
                    for handler in self.event_handlers[event.event_type]:
                        try:
                            await handler(event)
                        except Exception as e:
                            logger.error(f"Event handler error: {e}")
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Event processing error: {e}")
    
    # Scenario action handlers
    
    async def _handle_set_environment(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle SET_ENVIRONMENT action"""
        params = step.parameters
        
        env = EnvironmentalConditions(
            temperature=params.get('temperature', 20.0),
            pressure=params.get('pressure', 101325.0),
            humidity=params.get('humidity', 50.0),
            wind_speed=params.get('wind_speed', 0.0),
            terrain_type=TerrainType(params.get('terrain_type', 'flat'))
        )
        
        self.set_environment(env)
    
    async def _handle_set_device_state(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle SET_DEVICE_STATE action"""
        device_id = step.parameters.get('device_id')
        state = step.parameters.get('state', {})
        
        await self.set_device_state(device_id, state)
    
    async def _handle_send_command(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle SEND_COMMAND action"""
        device_id = step.parameters.get('device_id')
        command = step.parameters.get('command')
        
        if device_id in self.mock_adapters:
            adapter = self.mock_adapters[device_id]
            if adapter.is_connected:
                await adapter.write(command.encode())
    
    async def _handle_assert_state(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle ASSERT_STATE action"""
        device_id = step.parameters.get('device_id')
        expected_state = step.parameters.get('state', {})
        
        actual_state = self.get_device_state(device_id)
        if not actual_state:
            raise AssertionError(f"Device not found: {device_id}")
        
        for key, expected_value in expected_state.items():
            actual_value = actual_state.get(key)
            if actual_value != expected_value:
                raise AssertionError(
                    f"State mismatch for {device_id}.{key}: "
                    f"expected {expected_value}, got {actual_value}"
                )
        
        context.assertions_passed += 1
    
    async def _handle_inject_fault(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle INJECT_FAULT action"""
        device_id = step.parameters.get('device_id')
        fault_type = step.parameters.get('fault_type', 'error')
        
        if device_id in self.mock_adapters:
            adapter = self.mock_adapters[device_id]
            
            if fault_type == 'disconnect':
                adapter.simulate_connection_loss()
            elif fault_type == 'error':
                adapter.trigger_device_error(device_id)
    
    async def _handle_set_network(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle SET_NETWORK action"""
        profile_name = step.parameters.get('profile')
        if profile_name:
            self.set_network_profile(profile_name)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get simulation metrics"""
        metrics = {
            'simulation_time': self.simulation_time,
            'real_time_elapsed': (datetime.utcnow() - self.real_start_time).total_seconds() if self.real_start_time else 0,
            'state': self.state.value,
            'mode': self.mode.value,
            'device_count': len(self.device_profiles),
            'event_queue_size': self.event_queue.qsize() if hasattr(self.event_queue, 'qsize') else 0,
            'time_acceleration': self.config.time_acceleration
        }
        
        # Add network stats if available
        if self.network_simulator:
            metrics['network_stats'] = self.get_network_stats()
        
        # Add physics info if available
        if self.physics_simulator:
            env = self.get_environment()
            if env:
                metrics['environment'] = {
                    'temperature': env.temperature,
                    'pressure': env.pressure,
                    'humidity': env.humidity,
                    'wind_speed': env.wind_speed,
                    'terrain_type': env.terrain_type.value
                }
        
        return metrics
    
    async def get_device_telemetry(self, device_id: str) -> Dict[str, Any]:
        """Get telemetry data from a device"""
        if device_id not in self.device_states:
            return {}
        
        device_state = self.device_states[device_id]
        telemetry = {
            'device_id': device_id,
            'timestamp': datetime.utcnow().isoformat(),
            'profile_type': device_state['profile'].device_type.value
        }
        
        # Add sensor data if available
        if 'sensor_data' in device_state:
            telemetry['sensor_data'] = device_state['sensor_data']
        
        # Add actuator state if available
        if 'actuator_state' in device_state:
            telemetry['actuator_state'] = device_state['actuator_state']
        
        # Add physics state if available
        if device_state.get('physics_state'):
            physics_state = device_state['physics_state']
            telemetry['physics'] = {
                'position': {
                    'x': physics_state.position.x,
                    'y': physics_state.position.y,
                    'z': physics_state.position.z
                },
                'velocity': {
                    'x': physics_state.velocity.x,
                    'y': physics_state.velocity.y,
                    'z': physics_state.velocity.z
                }
            }
        
        return telemetry