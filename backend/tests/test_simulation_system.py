"""
Comprehensive end-to-end tests for the simulation system.
Tests all components including backend, API routes, WebSocket communication,
and hardware abstraction layer integration.
"""

import pytest
import asyncio
import json
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import WebSocket
from httpx import AsyncClient

# Import simulation components
from backend.hardware.simulation.simulation_engine import SimulationEngine
from backend.hardware.simulation.device_profiles import DEVICE_PROFILES, DeviceProfile
from backend.hardware.simulation.physics_simulator import PhysicsSimulator
from backend.hardware.simulation.network_simulator import NetworkSimulator
from backend.hardware.simulation.scenario_manager import ScenarioManager
from backend.hardware.simulation.hal_integration import hal_simulation
from backend.routes.simulation_routes import router, simulation_status
from backend.models.hardware import SimulationConfig, DeviceConfig
from backend.models.auth import User, UserRole
from backend.websocket.connection_manager import ConnectionManager

# Test fixtures
@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    return User(
        id=1,
        username="test_operator",
        email="operator@test.com",
        role=UserRole.OPERATOR,
        is_active=True
    )

@pytest.fixture
def mock_admin():
    """Create a mock admin user."""
    return User(
        id=2,
        username="test_admin",
        email="admin@test.com",
        role=UserRole.ADMIN,
        is_active=True
    )

@pytest.fixture
def simulation_config():
    """Create a test simulation configuration."""
    return SimulationConfig(
        name="Test Simulation",
        description="End-to-end test simulation",
        devices=[
            DeviceConfig(
                profile="temperature_sensor",
                initial_state={
                    "temperature": 20.0,
                    "unit": "celsius"
                }
            ),
            DeviceConfig(
                profile="rover",
                initial_state={
                    "position": {"x": 0, "y": 0, "z": 0},
                    "battery": 100,
                    "status": "idle"
                }
            )
        ],
        network_profile="satellite",
        environment={
            "temperature": 25.0,
            "pressure": 101.325,
            "humidity": 45.0
        }
    )

@pytest.fixture
def test_scenario():
    """Create a test scenario."""
    return {
        "id": "test_scenario_1",
        "name": "Basic Rover Movement",
        "description": "Test rover movement and sensor readings",
        "duration": 60,
        "steps": [
            {
                "name": "Start rover",
                "action": "send_command",
                "target": "rover_1",
                "parameters": {"command": "start", "mode": "autonomous"},
                "delay": 2
            },
            {
                "name": "Move forward",
                "action": "send_command",
                "target": "rover_1",
                "parameters": {"command": "move", "direction": "forward", "distance": 10},
                "delay": 5
            },
            {
                "name": "Update network conditions",
                "action": "set_network",
                "parameters": {"profile": "cellular_4g"},
                "delay": 3
            },
            {
                "name": "Check temperature",
                "action": "send_command",
                "target": "temp_sensor_1",
                "parameters": {"command": "read"},
                "delay": 2
            }
        ]
    }

class TestSimulationEngine:
    """Test the core simulation engine functionality."""
    
    @pytest.mark.asyncio
    async def test_engine_initialization(self):
        """Test simulation engine initialization."""
        engine = SimulationEngine()
        assert not engine.is_running
        assert engine.devices == {}
        assert engine.start_time is None
    
    @pytest.mark.asyncio
    async def test_engine_start_stop(self):
        """Test starting and stopping the simulation engine."""
        engine = SimulationEngine()
        
        # Start engine
        await engine.start()
        assert engine.is_running
        assert engine.start_time is not None
        
        # Stop engine
        await engine.stop()
        assert not engine.is_running
    
    @pytest.mark.asyncio
    async def test_add_device(self):
        """Test adding devices to the simulation."""
        engine = SimulationEngine()
        await engine.start()
        
        # Add temperature sensor
        device_id = engine.add_device("temperature_sensor", {"temperature": 25.0})
        assert device_id in engine.devices
        assert engine.devices[device_id].profile_name == "temperature_sensor"
        
        # Add rover
        rover_id = engine.add_device("rover", {"position": {"x": 0, "y": 0}})
        assert rover_id in engine.devices
        
        await engine.stop()
    
    @pytest.mark.asyncio
    async def test_device_telemetry(self):
        """Test getting telemetry from simulated devices."""
        engine = SimulationEngine()
        await engine.start()
        
        # Add device and get telemetry
        device_id = engine.add_device("temperature_sensor", {"temperature": 20.0})
        telemetry = engine.get_telemetry(device_id)
        
        assert "temperature" in telemetry
        assert 19.5 <= telemetry["temperature"] <= 20.5  # Allow for noise
        assert "timestamp" in telemetry
        
        await engine.stop()
    
    @pytest.mark.asyncio
    async def test_send_command(self):
        """Test sending commands to devices."""
        engine = SimulationEngine()
        await engine.start()
        
        # Add rover and send move command
        rover_id = engine.add_device("rover", {"position": {"x": 0, "y": 0}})
        result = await engine.send_command(rover_id, {
            "command": "move",
            "direction": "forward",
            "distance": 10
        })
        
        assert result["status"] == "success"
        assert "command_id" in result
        
        # Wait for movement to complete
        await asyncio.sleep(0.5)
        
        # Check position updated
        telemetry = engine.get_telemetry(rover_id)
        assert telemetry["position"]["x"] > 0
        
        await engine.stop()

class TestPhysicsSimulator:
    """Test physics simulation functionality."""
    
    def test_temperature_simulation(self):
        """Test temperature sensor physics simulation."""
        simulator = PhysicsSimulator()
        
        # Test temperature with environmental effects
        env_conditions = {"temperature": 30.0, "pressure": 101.0}
        readings = []
        
        for _ in range(10):
            temp = simulator.simulate_temperature(
                base_value=25.0,
                env_conditions=env_conditions
            )
            readings.append(temp)
        
        # Check readings are within expected range with noise
        assert all(24.5 <= t <= 30.5 for t in readings)
        # Check readings vary (noise is applied)
        assert len(set(readings)) > 1
    
    def test_imu_simulation(self):
        """Test IMU sensor physics simulation."""
        simulator = PhysicsSimulator()
        
        # Test stationary IMU
        imu_data = simulator.simulate_imu(
            acceleration={"x": 0, "y": 0, "z": 9.81},
            angular_velocity={"x": 0, "y": 0, "z": 0}
        )
        
        assert "acceleration" in imu_data
        assert "angular_velocity" in imu_data
        assert abs(imu_data["acceleration"]["z"] - 9.81) < 0.1  # Gravity with noise
    
    def test_battery_simulation(self):
        """Test battery discharge simulation."""
        simulator = PhysicsSimulator()
        
        # Test battery discharge
        initial_charge = 100.0
        new_charge = simulator.simulate_battery(
            current_charge=initial_charge,
            power_draw=5.0,  # 5W
            time_delta=3600  # 1 hour
        )
        
        assert new_charge < initial_charge
        assert new_charge > 0

class TestNetworkSimulator:
    """Test network condition simulation."""
    
    @pytest.mark.asyncio
    async def test_network_profiles(self):
        """Test different network profiles."""
        simulator = NetworkSimulator()
        
        # Test satellite profile
        simulator.set_profile("satellite")
        conditions = await simulator.apply_conditions(b"test_data")
        assert conditions["latency"] >= 500  # High latency for satellite
        
        # Test cellular profile
        simulator.set_profile("cellular_4g")
        conditions = await simulator.apply_conditions(b"test_data")
        assert conditions["latency"] <= 100  # Lower latency for 4G
    
    @pytest.mark.asyncio
    async def test_packet_loss(self):
        """Test packet loss simulation."""
        simulator = NetworkSimulator()
        simulator.set_custom_conditions({
            "packet_loss": 0.5,  # 50% packet loss
            "latency": 10
        })
        
        # Send multiple packets and check loss
        lost_count = 0
        for _ in range(100):
            result = await simulator.apply_conditions(b"test_packet")
            if result["data"] is None:
                lost_count += 1
        
        # Should lose approximately 50% of packets
        assert 40 <= lost_count <= 60

class TestScenarioManager:
    """Test scenario management functionality."""
    
    def test_save_load_scenario(self, test_scenario):
        """Test saving and loading scenarios."""
        manager = ScenarioManager()
        
        # Save scenario
        scenario_id = manager.save_scenario(test_scenario)
        assert scenario_id is not None
        
        # Load scenario
        loaded = manager.load_scenario(scenario_id)
        assert loaded["name"] == test_scenario["name"]
        assert len(loaded["steps"]) == len(test_scenario["steps"])
    
    def test_scenario_recording(self):
        """Test scenario recording functionality."""
        manager = ScenarioManager()
        
        # Start recording
        session_id = manager.start_recording("Test Recording", "Testing recording feature")
        assert session_id in manager.active_recordings
        
        # Record some events
        manager.record_event(session_id, {
            "action": "send_command",
            "target": "device_1",
            "parameters": {"command": "test"}
        })
        
        # Stop recording
        scenario_id = manager.stop_recording(session_id)
        assert scenario_id is not None
        assert session_id not in manager.active_recordings
        
        # Verify saved scenario
        scenario = manager.load_scenario(scenario_id)
        assert len(scenario["steps"]) == 1

class TestSimulationAPI:
    """Test simulation API endpoints."""
    
    @pytest.fixture
    def client(self, mock_user):
        """Create test client with mocked dependencies."""
        from backend.main import app
        
        # Override dependencies
        def override_get_current_user():
            return mock_user
        
        app.dependency_overrides[get_current_user] = override_get_current_user
        
        with TestClient(app) as client:
            yield client
        
        app.dependency_overrides.clear()
    
    def test_get_simulation_status(self, client):
        """Test getting simulation status."""
        response = client.get("/api/simulation/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "is_running" in data
        assert "metrics" in data
        assert data["is_running"] is False
    
    @pytest.mark.asyncio
    async def test_start_simulation(self, client, simulation_config):
        """Test starting simulation via API."""
        # Mock HAL integration
        with patch('backend.routes.simulation_routes.hal_simulation') as mock_hal:
            mock_hal.initialize = AsyncMock()
            mock_hal.start_simulation = AsyncMock()
            mock_hal.add_simulated_device = AsyncMock(return_value="device_1")
            mock_hal.get_simulated_devices = AsyncMock(return_value=[
                Mock(id="device_1", profile="temperature_sensor")
            ])
            
            response = client.post(
                "/api/simulation/start",
                json=simulation_config.dict()
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "started"
            assert "session_id" in data
            assert len(data["devices"]) == 2
    
    def test_get_device_profiles(self, client):
        """Test getting available device profiles."""
        response = client.get("/api/simulation/devices")
        assert response.status_code == 200
        
        data = response.json()
        assert "profiles" in data
        assert "temperature_sensor" in data["profiles"]
        assert "rover" in data["profiles"]
    
    def test_scenario_endpoints(self, client, test_scenario):
        """Test scenario-related endpoints."""
        # Get scenarios
        response = client.get("/api/simulation/scenarios")
        assert response.status_code == 200
        
        # Mock scenario manager
        with patch('backend.routes.simulation_routes.scenario_manager') as mock_manager:
            mock_manager.list_scenarios.return_value = [test_scenario]
            mock_manager.load_scenario.return_value = test_scenario
            
            # Run scenario
            response = client.post(f"/api/simulation/scenarios/{test_scenario['id']}/run")
            assert response.status_code == 200
            assert response.json()["status"] == "started"

class TestWebSocketIntegration:
    """Test WebSocket integration for real-time updates."""
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test WebSocket connection and messages."""
        from backend.main import app
        from fastapi.testclient import TestClient
        
        with TestClient(app) as client:
            with client.websocket_connect("/api/simulation/ws") as websocket:
                # Should receive heartbeat
                data = websocket.receive_json()
                assert data["event"] == "heartbeat"
                assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_telemetry_broadcast(self):
        """Test telemetry broadcasting via WebSocket."""
        manager = ConnectionManager()
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.send_json = AsyncMock()
        
        # Connect mock websocket
        await manager.connect(mock_websocket)
        
        # Broadcast telemetry
        telemetry_data = {
            "event": "simulation:telemetry",
            "data": {
                "device_1": {"temperature": 25.0},
                "device_2": {"position": {"x": 10, "y": 5}}
            }
        }
        
        await manager.broadcast(json.dumps(telemetry_data))
        
        # Verify broadcast was sent
        mock_websocket.send_json.assert_called()

class TestHALIntegration:
    """Test Hardware Abstraction Layer integration."""
    
    @pytest.mark.asyncio
    async def test_hal_simulation_integration(self):
        """Test HAL simulation integration."""
        # Initialize HAL simulation
        config = {
            "name": "Test",
            "devices": [{"profile": "temperature_sensor", "initial_state": {}}]
        }
        
        await hal_simulation.initialize(config)
        
        # Start simulation
        await hal_simulation.start_simulation()
        assert hal_simulation.engine is not None
        assert hal_simulation.engine.is_running
        
        # Add device
        device_id = await hal_simulation.add_simulated_device(
            "temperature_sensor",
            {"temperature": 20.0}
        )
        assert device_id is not None
        
        # Get telemetry
        telemetry = await hal_simulation.get_device_telemetry(device_id)
        assert "temperature" in telemetry
        
        # Stop simulation
        await hal_simulation.stop_simulation()
        assert not hal_simulation.engine.is_running

class TestEndToEndScenarios:
    """Comprehensive end-to-end test scenarios."""
    
    @pytest.mark.asyncio
    async def test_complete_simulation_workflow(self):
        """Test complete simulation workflow from start to finish."""
        # 1. Initialize simulation engine
        engine = SimulationEngine()
        await engine.start()
        
        # 2. Add devices
        temp_sensor = engine.add_device("temperature_sensor", {"temperature": 20.0})
        rover = engine.add_device("rover", {
            "position": {"x": 0, "y": 0, "z": 0},
            "battery": 100
        })
        
        # 3. Set network conditions
        engine.network_simulator.set_profile("satellite")
        
        # 4. Set environmental conditions
        engine.set_environment({
            "temperature": -10.0,  # Cold environment
            "pressure": 100.0,
            "humidity": 20.0
        })
        
        # 5. Run simulation for a period
        telemetry_history = []
        for i in range(10):
            # Get telemetry
            temp_telemetry = engine.get_telemetry(temp_sensor)
            rover_telemetry = engine.get_telemetry(rover)
            
            telemetry_history.append({
                "iteration": i,
                "temperature": temp_telemetry["temperature"],
                "rover_position": rover_telemetry["position"],
                "rover_battery": rover_telemetry["battery"]
            })
            
            # Send rover command
            if i == 5:
                await engine.send_command(rover, {
                    "command": "move",
                    "direction": "forward",
                    "distance": 10
                })
            
            await asyncio.sleep(0.1)
        
        # 6. Verify simulation results
        assert len(telemetry_history) == 10
        
        # Temperature should trend toward environmental temperature
        initial_temp = telemetry_history[0]["temperature"]
        final_temp = telemetry_history[-1]["temperature"]
        assert final_temp < initial_temp  # Cooling down
        
        # Rover should have moved
        initial_pos = telemetry_history[0]["rover_position"]
        final_pos = telemetry_history[-1]["rover_position"]
        assert final_pos["x"] > initial_pos["x"]
        
        # Battery should have depleted
        initial_battery = telemetry_history[0]["rover_battery"]
        final_battery = telemetry_history[-1]["rover_battery"]
        assert final_battery < initial_battery
        
        # 7. Stop simulation
        await engine.stop()
    
    @pytest.mark.asyncio
    async def test_scenario_execution(self, test_scenario):
        """Test executing a complete scenario."""
        # Initialize components
        engine = SimulationEngine()
        scenario_manager = ScenarioManager()
        
        # Start simulation
        await engine.start()
        
        # Add devices for scenario
        rover_id = engine.add_device("rover", {
            "position": {"x": 0, "y": 0, "z": 0},
            "status": "idle"
        })
        temp_id = engine.add_device("temperature_sensor", {"temperature": 20.0})
        
        # Execute scenario steps
        events = []
        for step in test_scenario["steps"]:
            event = {
                "timestamp": datetime.utcnow().isoformat(),
                "step": step["name"],
                "action": step["action"]
            }
            
            if step["action"] == "send_command":
                # Map target to actual device ID
                target = rover_id if "rover" in step["target"] else temp_id
                result = await engine.send_command(target, step["parameters"])
                event["result"] = result
            elif step["action"] == "set_network":
                engine.network_simulator.set_profile(
                    step["parameters"]["profile"]
                )
                event["result"] = {"status": "network_updated"}
            
            events.append(event)
            
            # Wait for specified delay
            if "delay" in step:
                await asyncio.sleep(step["delay"] / 10)  # Speed up for testing
        
        # Verify scenario execution
        assert len(events) == len(test_scenario["steps"])
        assert all(e.get("result", {}).get("status") in ["success", "network_updated"] 
                  for e in events)
        
        # Stop simulation
        await engine.stop()

if __name__ == "__main__":
    # Run all tests
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])