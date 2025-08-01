# Testing Architecture

## Overview

Comprehensive testing infrastructure for RoverMissionControl covering hardware interfaces, real-time WebSocket communication, 3D visualization, and full-stack integration. This architecture emphasizes automated testing, continuous integration, and production-grade quality assurance.

## Directory Structure
```
tests/
├── __init__.py                    # Python package initializer
├── unit/                          # Unit tests
│   ├── backend/
│   │   ├── test_rover_control.py  # Rover control logic tests
│   │   ├── test_serial_comm.py    # Serial communication tests
│   │   ├── test_auth.py           # Authentication tests
│   │   └── test_validators.py     # Input validation tests
│   └── frontend/
│       ├── components/            # React component tests
│       ├── hooks/                 # Custom hook tests
│       └── utils/                 # Utility function tests
├── integration/                   # Integration tests
│   ├── test_api_integration.py    # API endpoint integration
│   ├── test_websocket_flow.py     # WebSocket communication
│   ├── test_database_ops.py       # Database operations
│   └── test_hardware_sim.py       # Hardware simulation tests
├── e2e/                          # End-to-end tests
│   ├── rover_control.spec.js      # Full rover control flow
│   ├── telemetry_streaming.spec.js # Real-time telemetry
│   └── 3d_visualization.spec.js   # 3D UI interaction
├── performance/                   # Performance tests
│   ├── load_tests.py             # Load testing with Locust
│   ├── stress_tests.py           # Stress testing
│   └── k6_scripts/               # k6 performance scripts
├── security/                     # Security tests
│   ├── test_auth_security.py     # Authentication security
│   ├── test_api_security.py      # API security tests
│   └── owasp_zap_config.yaml    # OWASP ZAP configuration
├── fixtures/                     # Test data and fixtures
│   ├── telemetry_data.py        # Sample telemetry data
│   ├── rover_commands.py        # Test command sequences
│   └── mock_hardware.py         # Hardware mock configurations
├── mocks/                       # Mock implementations
│   ├── serial_mock.py          # Serial port mocking
│   ├── websocket_mock.py       # WebSocket server mock
│   └── hardware_simulator.py    # Hardware behavior simulation
└── ci/                         # CI/CD configurations
    ├── github_actions.yml      # GitHub Actions workflow
    ├── gitlab_ci.yml          # GitLab CI pipeline
    └── jenkins/               # Jenkins pipeline scripts
```

## Test Pyramid Implementation

### 1. Unit Tests (70% coverage target)

#### Backend Unit Tests

##### Rover Control Logic Tests
```python
# tests/unit/backend/test_rover_control.py
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import asyncio

from backend.services.rover_control import RoverController, RoverCommand
from backend.exceptions import HardwareException, CommandException

class TestRoverController:
    """Test suite for rover control logic"""
    
    @pytest.fixture
    def mock_serial(self):
        """Mock serial port for isolated testing"""
        serial_mock = Mock()
        serial_mock.write = Mock(return_value=10)
        serial_mock.read = Mock(return_value=b'OK\n')
        serial_mock.in_waiting = 5
        return serial_mock
    
    @pytest.fixture
    def rover_controller(self, mock_serial):
        """Create rover controller with mocked serial"""
        with patch('serial.Serial', return_value=mock_serial):
            controller = RoverController(port='COM3', baudrate=9600)
            yield controller
            controller.close()
    
    @pytest.mark.asyncio
    async def test_move_command_validation(self, rover_controller):
        """Test movement command validation"""
        # Valid command
        command = RoverCommand(forward=0.5, turn=0.0, duration=1.0)
        result = await rover_controller.execute_command(command)
        assert result.status == "success"
        assert result.command_id is not None
        
        # Invalid command - out of range
        with pytest.raises(CommandException) as exc:
            invalid_command = RoverCommand(forward=1.5, turn=0.0)
            await rover_controller.execute_command(invalid_command)
        assert "Invalid forward speed" in str(exc.value)
    
    @pytest.mark.asyncio
    async def test_emergency_stop(self, rover_controller):
        """Test emergency stop functionality"""
        # Start movement
        await rover_controller.execute_command(
            RoverCommand(forward=0.8, turn=0.0)
        )
        
        # Emergency stop
        result = await rover_controller.emergency_stop()
        assert result.status == "stopped"
        assert rover_controller.is_stopped
        
        # Verify stop command sent to hardware
        rover_controller._serial.write.assert_called_with(b'STOP\n')
    
    @pytest.mark.asyncio
    async def test_command_queue_management(self, rover_controller):
        """Test command queuing and execution order"""
        commands = [
            RoverCommand(forward=0.5, turn=0.0),
            RoverCommand(forward=0.0, turn=0.5),
            RoverCommand(forward=-0.5, turn=0.0)
        ]
        
        # Queue commands
        tasks = [rover_controller.execute_command(cmd) for cmd in commands]
        results = await asyncio.gather(*tasks)
        
        # Verify execution order
        assert len(results) == 3
        assert all(r.status == "success" for r in results)
        
        # Check serial write calls
        expected_calls = [
            b'MOVE:0.50,0.00\n',
            b'MOVE:0.00,0.50\n',
            b'MOVE:-0.50,0.00\n'
        ]
        actual_calls = [
            call[0][0] for call in rover_controller._serial.write.call_args_list
        ]
        assert actual_calls == expected_calls
    
    @pytest.mark.asyncio
    async def test_hardware_disconnection_handling(self, rover_controller):
        """Test graceful handling of hardware disconnection"""
        # Simulate disconnection
        rover_controller._serial.write.side_effect = SerialException("Device disconnected")
        
        with pytest.raises(HardwareException) as exc:
            await rover_controller.execute_command(
                RoverCommand(forward=0.5, turn=0.0)
            )
        assert "Hardware communication failed" in str(exc.value)
        assert not rover_controller.is_connected
    
    @pytest.mark.parametrize("forward,turn,expected_output", [
        (0.0, 0.0, b'MOVE:0.00,0.00\n'),
        (1.0, 0.0, b'MOVE:1.00,0.00\n'),
        (0.5, -0.5, b'MOVE:0.50,-0.50\n'),
        (-1.0, 1.0, b'MOVE:-1.00,1.00\n'),
    ])
    def test_command_serialization(self, rover_controller, forward, turn, expected_output):
        """Test command serialization to hardware protocol"""
        command = RoverCommand(forward=forward, turn=turn)
        serialized = rover_controller._serialize_command(command)
        assert serialized == expected_output
```

##### Hardware Mock Implementation
```python
# tests/mocks/hardware_simulator.py
import asyncio
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Callable
import numpy as np

@dataclass
class SensorReading:
    """Simulated sensor data"""
    battery_voltage: float
    temperature: float
    current_draw: float
    wheel_encoders: Dict[str, float]
    imu_data: Dict[str, float]
    timestamp: float

class RoverHardwareSimulator:
    """Digital twin for rover hardware testing"""
    
    def __init__(self):
        self.position = np.array([0.0, 0.0, 0.0])
        self.rotation = np.array([0.0, 0.0, 0.0])
        self.wheel_speeds = {"fl": 0.0, "fr": 0.0, "rl": 0.0, "rr": 0.0}
        self.battery_voltage = 12.6
        self.is_emergency_stopped = False
        self.command_history: List[Dict] = []
        self._callbacks: Dict[str, List[Callable]] = {}
        self._simulation_task = None
        
    async def start_simulation(self):
        """Start hardware simulation loop"""
        self._simulation_task = asyncio.create_task(self._simulation_loop())
        
    async def stop_simulation(self):
        """Stop hardware simulation"""
        if self._simulation_task:
            self._simulation_task.cancel()
            await asyncio.gather(self._simulation_task, return_exceptions=True)
    
    async def _simulation_loop(self):
        """Main simulation loop with physics"""
        dt = 0.05  # 50ms time step
        while True:
            try:
                # Update physics
                self._update_position(dt)
                self._update_sensors(dt)
                
                # Generate telemetry
                telemetry = self.get_telemetry()
                await self._emit_event('telemetry', telemetry)
                
                await asyncio.sleep(dt)
            except asyncio.CancelledError:
                break
    
    def _update_position(self, dt: float):
        """Update rover position based on wheel speeds"""
        if self.is_emergency_stopped:
            self.wheel_speeds = {k: 0.0 for k in self.wheel_speeds}
            return
            
        # Differential drive kinematics
        left_speed = (self.wheel_speeds['fl'] + self.wheel_speeds['rl']) / 2
        right_speed = (self.wheel_speeds['fr'] + self.wheel_speeds['rr']) / 2
        
        linear_velocity = (left_speed + right_speed) / 2
        angular_velocity = (right_speed - left_speed) / 0.5  # wheelbase
        
        # Update position
        self.position[0] += linear_velocity * np.cos(self.rotation[2]) * dt
        self.position[1] += linear_velocity * np.sin(self.rotation[2]) * dt
        self.rotation[2] += angular_velocity * dt
        
        # Add realistic noise
        self.position += np.random.normal(0, 0.001, 3)
        self.rotation += np.random.normal(0, 0.0001, 3)
    
    def _update_sensors(self, dt: float):
        """Update sensor readings with realistic behavior"""
        # Battery discharge model
        current = sum(abs(v) * 2.0 for v in self.wheel_speeds.values())
        self.battery_voltage -= current * dt * 0.0001
        self.battery_voltage = max(10.0, self.battery_voltage)
        
        # Temperature model (increases with current)
        ambient_temp = 25.0
        heat_generation = current * 0.5
        self.temperature = ambient_temp + heat_generation + random.gauss(0, 0.5)
    
    def execute_command(self, command: str) -> str:
        """Execute hardware command and return response"""
        self.command_history.append({
            'command': command,
            'timestamp': asyncio.get_event_loop().time()
        })
        
        if command == "STOP":
            self.is_emergency_stopped = True
            self.wheel_speeds = {k: 0.0 for k in self.wheel_speeds}
            return "OK:STOPPED"
            
        elif command.startswith("MOVE:"):
            if self.is_emergency_stopped:
                return "ERROR:EMERGENCY_STOP_ACTIVE"
                
            # Parse movement command
            parts = command[5:].split(',')
            forward = float(parts[0])
            turn = float(parts[1])
            
            # Convert to wheel speeds
            self.wheel_speeds['fl'] = forward - turn
            self.wheel_speeds['fr'] = forward + turn
            self.wheel_speeds['rl'] = forward - turn
            self.wheel_speeds['rr'] = forward + turn
            
            return f"OK:MOVING:{forward},{turn}"
            
        elif command == "RESUME":
            self.is_emergency_stopped = False
            return "OK:RESUMED"
            
        elif command == "STATUS":
            return self._get_status_response()
            
        else:
            return f"ERROR:UNKNOWN_COMMAND:{command}"
    
    def get_telemetry(self) -> SensorReading:
        """Get current sensor readings"""
        return SensorReading(
            battery_voltage=self.battery_voltage + random.gauss(0, 0.01),
            temperature=self.temperature,
            current_draw=sum(abs(v) * 2.0 for v in self.wheel_speeds.values()),
            wheel_encoders={
                k: v * 100 + random.gauss(0, 0.1) 
                for k, v in self.wheel_speeds.items()
            },
            imu_data={
                'pitch': self.rotation[0] + random.gauss(0, 0.001),
                'roll': self.rotation[1] + random.gauss(0, 0.001),
                'yaw': self.rotation[2] + random.gauss(0, 0.001),
                'acc_x': random.gauss(0, 0.1),
                'acc_y': random.gauss(0, 0.1),
                'acc_z': random.gauss(9.81, 0.1),
            },
            timestamp=asyncio.get_event_loop().time()
        )
    
    def add_fault(self, fault_type: str, duration: float = None):
        """Inject fault for testing error handling"""
        if fault_type == "battery_low":
            self.battery_voltage = 10.5
        elif fault_type == "overheating":
            self.temperature = 85.0
        elif fault_type == "wheel_stuck":
            self.wheel_speeds['fl'] = 0.0
        elif fault_type == "imu_drift":
            self.rotation += np.array([0.1, 0.1, 0.1])
            
        if duration:
            asyncio.create_task(self._clear_fault_after(fault_type, duration))
    
    async def _clear_fault_after(self, fault_type: str, duration: float):
        """Clear fault after specified duration"""
        await asyncio.sleep(duration)
        if fault_type == "battery_low":
            self.battery_voltage = 12.6
        elif fault_type == "overheating":
            self.temperature = 25.0
        # ... other fault clearing logic
```

#### Frontend Unit Tests

##### React Component Tests
```javascript
// tests/unit/frontend/components/RoverModel.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import * as THREE from 'three';
import { RoverModel } from '../../../../frontend/src/components/RoverModel';

// Mock Three.js
jest.mock('three', () => ({
  ...jest.requireActual('three'),
  WebGLRenderer: jest.fn().mockImplementation(() => ({
    setSize: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    domElement: document.createElement('canvas')
  })),
  PerspectiveCamera: jest.fn(),
  Scene: jest.fn(),
  AmbientLight: jest.fn(),
  DirectionalLight: jest.fn()
}));

describe('RoverModel Component', () => {
  const defaultProps = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    wheelSpeeds: { fl: 0, fr: 0, rl: 0, rr: 0 },
    scale: 1,
    showGrid: true,
    cameraMode: 'orbit'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders rover model with correct initial position', () => {
    const { container } = render(<RoverModel {...defaultProps} />);
    
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(THREE.WebGLRenderer).toHaveBeenCalled();
    expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(
      75, 
      expect.any(Number), 
      0.1, 
      1000
    );
  });

  test('updates rover position when props change', async () => {
    const { rerender } = render(<RoverModel {...defaultProps} />);
    
    const newPosition = [5, 0, 3];
    await act(async () => {
      rerender(<RoverModel {...defaultProps} position={newPosition} />);
    });
    
    // Verify position update in Three.js scene
    // Note: In real implementation, you'd check the mesh position
  });

  test('animates wheel rotation based on speed', async () => {
    jest.useFakeTimers();
    
    const wheelSpeeds = { fl: 1.0, fr: 1.0, rl: 1.0, rr: 1.0 };
    render(<RoverModel {...defaultProps} wheelSpeeds={wheelSpeeds} />);
    
    // Advance animation frames
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    
    // Verify wheel rotation updates
    // Note: Check wheel mesh rotation values
    
    jest.useRealTimers();
  });

  test('switches camera mode correctly', async () => {
    const { rerender } = render(<RoverModel {...defaultProps} />);
    
    // Switch to follow mode
    await act(async () => {
      rerender(<RoverModel {...defaultProps} cameraMode="follow" />);
    });
    
    // Verify camera position relative to rover
    
    // Switch to fpv mode
    await act(async () => {
      rerender(<RoverModel {...defaultProps} cameraMode="fpv" />);
    });
    
    // Verify camera attached to rover front
  });

  test('handles resize events', () => {
    const { container } = render(<RoverModel {...defaultProps} />);
    
    // Trigger resize
    act(() => {
      window.innerWidth = 1024;
      window.innerHeight = 768;
      window.dispatchEvent(new Event('resize'));
    });
    
    const renderer = THREE.WebGLRenderer.mock.instances[0];
    expect(renderer.setSize).toHaveBeenCalledWith(1024, 768);
  });

  test('cleans up resources on unmount', () => {
    const { unmount } = render(<RoverModel {...defaultProps} />);
    
    const renderer = THREE.WebGLRenderer.mock.instances[0];
    
    unmount();
    
    expect(renderer.dispose).toHaveBeenCalled();
  });
});
```

##### WebSocket Hook Tests
```javascript
// tests/unit/frontend/hooks/useWebSocket.test.js
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../../../../frontend/src/hooks/useWebSocket';
import WS from 'jest-websocket-mock';

describe('useWebSocket Hook', () => {
  let server;
  const wsUrl = 'ws://localhost:8001/api/ws/telemetry';

  beforeEach(() => {
    server = new WS(wsUrl, { jsonProtocol: true });
  });

  afterEach(() => {
    WS.clean();
  });

  test('establishes connection and handles messages', async () => {
    const onMessage = jest.fn();
    const onError = jest.fn();
    const onClose = jest.fn();

    const { result } = renderHook(() => 
      useWebSocket(wsUrl, {
        onMessage,
        onError,
        onClose,
        reconnectInterval: 100
      })
    );

    // Wait for connection
    await server.connected;
    expect(result.current.readyState).toBe(WebSocket.OPEN);

    // Send message from server
    const telemetryData = {
      type: 'telemetry',
      data: {
        position: { x: 1, y: 2, z: 0 },
        battery: 12.5
      }
    };

    act(() => {
      server.send(telemetryData);
    });

    expect(onMessage).toHaveBeenCalledWith(telemetryData);
  });

  test('handles automatic reconnection', async () => {
    const onReconnect = jest.fn();
    
    const { result } = renderHook(() => 
      useWebSocket(wsUrl, {
        reconnectInterval: 50,
        maxReconnectAttempts: 3,
        onReconnect
      })
    );

    await server.connected;

    // Simulate connection loss
    act(() => {
      server.close();
    });

    expect(result.current.readyState).toBe(WebSocket.CLOSED);

    // Wait for reconnection attempt
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(onReconnect).toHaveBeenCalled();
  });

  test('sends messages correctly', async () => {
    const { result } = renderHook(() => useWebSocket(wsUrl));

    await server.connected;

    const command = {
      type: 'command',
      payload: { action: 'move', forward: 0.5 }
    };

    act(() => {
      result.current.sendMessage(command);
    });

    await expect(server).toReceiveMessage(command);
  });

  test('implements exponential backoff for reconnection', async () => {
    const reconnectTimes = [];
    const onReconnect = jest.fn(() => {
      reconnectTimes.push(Date.now());
    });

    renderHook(() => 
      useWebSocket(wsUrl, {
        reconnectInterval: 50,
        maxReconnectAttempts: 3,
        exponentialBackoff: true,
        onReconnect
      })
    );

    await server.connected;
    server.close();

    // Wait for multiple reconnection attempts
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // Verify exponential delays
    expect(reconnectTimes.length).toBeGreaterThan(1);
    for (let i = 1; i < reconnectTimes.length; i++) {
      const delay = reconnectTimes[i] - reconnectTimes[i-1];
      expect(delay).toBeGreaterThan(50 * Math.pow(2, i-1) * 0.8);
    }
  });
});
```

### 2. Integration Tests (20% coverage target)

#### API Integration Tests
```python
# tests/integration/test_api_integration.py
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from backend.server import app
from backend.database import Base
from tests.fixtures.test_data import create_test_user, create_test_project

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_db():
    """Create test database"""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    yield async_session
    
    await engine.dispose()

@pytest.fixture
async def authenticated_client(test_db):
    """Create authenticated test client"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Create test user
        user = await create_test_user(test_db, "testuser", "testpass")
        
        # Login
        response = await client.post(
            "/api/auth/login",
            json={"username": "testuser", "password": "testpass"}
        )
        
        token = response.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"
        
        yield client

class TestRoverAPIIntegration:
    """Integration tests for rover control API"""
    
    @pytest.mark.asyncio
    async def test_full_control_flow(self, authenticated_client, mocker):
        """Test complete rover control flow from API to hardware"""
        # Mock hardware
        mock_serial = mocker.patch('serial.Serial')
        mock_instance = mock_serial.return_value
        mock_instance.write.return_value = 10
        mock_instance.read.return_value = b'OK:MOVING:0.50,0.00\n'
        
        # Get initial status
        response = await authenticated_client.get("/api/rover/status")
        assert response.status_code == 200
        initial_status = response.json()
        assert initial_status["emergency_stop"] is False
        
        # Send movement command
        response = await authenticated_client.post(
            "/api/rover/control",
            json={"forward": 0.5, "turn": 0.0, "duration": 2.0}
        )
        assert response.status_code == 200
        command_result = response.json()
        assert command_result["status"] == "success"
        assert command_result["command_id"] is not None
        
        # Verify hardware command
        mock_instance.write.assert_called_with(b'MOVE:0.50,0.00\n')
        
        # Emergency stop
        response = await authenticated_client.post("/api/rover/emergency-stop")
        assert response.status_code == 200
        assert response.json()["status"] == "stopped"
        
        # Verify stop command sent
        mock_instance.write.assert_called_with(b'STOP\n')
        
        # Check status reflects emergency stop
        response = await authenticated_client.get("/api/rover/status")
        assert response.status_code == 200
        assert response.json()["emergency_stop"] is True
        
        # Resume operations
        response = await authenticated_client.post("/api/rover/resume")
        assert response.status_code == 200
        mock_instance.write.assert_called_with(b'RESUME\n')
    
    @pytest.mark.asyncio
    async def test_telemetry_persistence(self, authenticated_client, test_db):
        """Test telemetry data persistence through API"""
        # Create test project
        project = await create_test_project(test_db, "Test Rover Mission")
        
        # Send telemetry data
        telemetry_data = {
            "project_id": project.id,
            "position": {"x": 5.0, "y": 3.0, "z": 0.0},
            "rotation": {"pitch": 0.1, "roll": 0.0, "yaw": 1.57},
            "battery_voltage": 12.4,
            "temperature": 28.5,
            "wheel_speeds": {"fl": 0.5, "fr": 0.5, "rl": 0.5, "rr": 0.5}
        }
        
        response = await authenticated_client.post(
            "/api/telemetry/record",
            json=telemetry_data
        )
        assert response.status_code == 201
        record_id = response.json()["id"]
        
        # Query telemetry
        response = await authenticated_client.get(
            f"/api/telemetry/project/{project.id}",
            params={"limit": 10}
        )
        assert response.status_code == 200
        telemetry_records = response.json()["records"]
        assert len(telemetry_records) == 1
        assert telemetry_records[0]["position_x"] == 5.0
        assert telemetry_records[0]["battery_voltage"] == 12.4
        
        # Test aggregation
        response = await authenticated_client.get(
            f"/api/telemetry/project/{project.id}/stats"
        )
        assert response.status_code == 200
        stats = response.json()
        assert stats["total_records"] == 1
        assert stats["avg_battery_voltage"] == 12.4
        assert stats["max_temperature"] == 28.5

@pytest.mark.asyncio
async def test_websocket_integration(authenticated_client):
    """Test WebSocket integration with authentication"""
    # Connect to WebSocket with auth token
    token = authenticated_client.headers["Authorization"].split()[1]
    
    async with authenticated_client.websocket_connect(
        f"/api/ws/telemetry?token={token}&client_id=test123"
    ) as websocket:
        # Subscribe to channels
        await websocket.send_json({
            "type": "subscribe",
            "channels": ["telemetry", "alerts", "commands"]
        })
        
        # Receive subscription confirmation
        response = await websocket.receive_json()
        assert response["type"] == "subscription_confirmed"
        assert set(response["channels"]) == {"telemetry", "alerts", "commands"}
        
        # Send heartbeat
        await websocket.send_json({"type": "heartbeat"})
        pong = await websocket.receive_json()
        assert pong["type"] == "pong"
        
        # Simulate telemetry broadcast
        await websocket.send_json({
            "type": "command",
            "payload": {
                "action": "request_telemetry",
                "interval": 100
            }
        })
        
        # Receive telemetry
        telemetry = await websocket.receive_json()
        assert telemetry["type"] == "telemetry"
        assert "position" in telemetry["data"]
        assert "battery" in telemetry["data"]["sensors"]
```

### 3. End-to-End Tests (10% coverage target)

#### Playwright E2E Tests
```typescript
// tests/e2e/rover_control.spec.ts
import { test, expect, Page } from '@playwright/test';
import { mockWebSocket } from './helpers/websocket-mock';

test.describe('Rover Control E2E', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Mock backend API
    await page.route('**/api/rover/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          emergency_stop: false,
          position: { x: 0, y: 0, z: 0 },
          battery: { voltage: 12.6, percentage: 85 }
        })
      });
    });

    await page.goto('http://localhost:3000');
  });

  test('complete rover control flow with joystick', async () => {
    // Wait for 3D scene to load
    await page.waitForSelector('canvas');
    await expect(page.locator('[data-testid="rover-model"]')).toBeVisible();

    // Mock WebSocket connection
    const ws = await mockWebSocket(page, 'ws://localhost:8001/api/ws/telemetry');

    // Verify initial telemetry display
    await expect(page.locator('[data-testid="battery-gauge"]')).toContainText('85%');
    await expect(page.locator('[data-testid="position-display"]')).toContainText('X: 0.0');

    // Test joystick control
    const joystick = page.locator('[data-testid="virtual-joystick"]');
    const joystickBounds = await joystick.boundingBox();
    
    // Drag joystick forward
    await page.mouse.move(
      joystickBounds.x + joystickBounds.width / 2,
      joystickBounds.y + joystickBounds.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      joystickBounds.x + joystickBounds.width / 2,
      joystickBounds.y + joystickBounds.height * 0.25,
      { steps: 10 }
    );

    // Verify command sent
    const command = await ws.waitForMessage('command');
    expect(command).toMatchObject({
      type: 'command',
      payload: {
        action: 'move',
        parameters: {
          forward: expect.any(Number),
          turn: 0
        }
      }
    });

    // Simulate telemetry update
    await ws.send({
      type: 'telemetry',
      data: {
        position: { x: 1.5, y: 0, z: 0 },
        sensors: { battery: 84 }
      }
    });

    // Verify UI updates
    await expect(page.locator('[data-testid="position-display"]')).toContainText('X: 1.5');
    await expect(page.locator('[data-testid="battery-gauge"]')).toContainText('84%');

    // Release joystick
    await page.mouse.up();

    // Test emergency stop
    await page.click('[data-testid="emergency-stop-button"]');
    
    // Verify emergency stop command
    const stopCommand = await ws.waitForMessage('command');
    expect(stopCommand).toMatchObject({
      type: 'command',
      payload: { action: 'emergency_stop' }
    });

    // Verify UI shows stopped state
    await expect(page.locator('[data-testid="status-indicator"]')).toHaveClass(/emergency-stop/);
  });

  test('3D visualization camera controls', async () => {
    await page.waitForSelector('canvas');

    // Test orbit camera mode
    await page.selectOption('[data-testid="camera-mode-select"]', 'orbit');
    
    // Simulate mouse drag for orbit
    const canvas = page.locator('canvas');
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100, { steps: 5 });
    await page.mouse.up();

    // Switch to follow mode
    await page.selectOption('[data-testid="camera-mode-select"]', 'follow');
    
    // Verify camera follows rover movement
    const ws = await mockWebSocket(page, 'ws://localhost:8001/api/ws/telemetry');
    
    // Send position updates
    for (let i = 0; i < 5; i++) {
      await ws.send({
        type: 'telemetry',
        data: {
          position: { x: i * 2, y: 0, z: 0 },
          rotation: { pitch: 0, roll: 0, yaw: i * 0.1 }
        }
      });
      await page.waitForTimeout(100);
    }

    // Test FPV mode
    await page.selectOption('[data-testid="camera-mode-select"]', 'fpv');
    await expect(page.locator('[data-testid="fpv-overlay"]')).toBeVisible();
  });

  test('responsive design and mobile controls', async () => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-sidebar"]')).not.toBeVisible();

    // Open mobile menu
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Test touch controls
    const joystick = page.locator('[data-testid="virtual-joystick"]');
    const bounds = await joystick.boundingBox();
    
    // Simulate touch drag
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.touchscreen.down(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.touchscreen.move(bounds.x + bounds.width / 2, bounds.y);
    await page.touchscreen.up();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Verify tablet layout
    await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).not.toBeVisible();
  });
});
```

### 4. Performance Testing

#### Load Testing with Locust
```python
# tests/performance/load_tests.py
from locust import HttpUser, TaskSet, task, between, events
from locust.contrib.fasthttp import FastHttpUser
import json
import time
import random
from websocket import create_connection
import threading

class RoverControlUser(FastHttpUser):
    """Simulated user for load testing rover control"""
    wait_time = between(0.5, 2.0)
    
    def on_start(self):
        """Login and get auth token"""
        response = self.client.post("/api/auth/login", json={
            "username": f"testuser_{random.randint(1, 100)}",
            "password": "testpass"
        })
        
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.client.headers["Authorization"] = f"Bearer {self.token}"
        else:
            self.token = None
    
    @task(3)
    def get_rover_status(self):
        """Frequently check rover status"""
        with self.client.get(
            "/api/rover/status",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if "position" not in data:
                    response.failure("Missing position data")
            else:
                response.failure(f"Status code: {response.status_code}")
    
    @task(5)
    def send_movement_command(self):
        """Send movement commands"""
        if not self.token:
            return
            
        command = {
            "forward": random.uniform(-1.0, 1.0),
            "turn": random.uniform(-1.0, 1.0),
            "duration": random.uniform(0.5, 3.0)
        }
        
        with self.client.post(
            "/api/rover/control",
            json=command,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                result = response.json()
                if result.get("status") != "success":
                    response.failure("Command not successful")
            elif response.status_code == 429:
                response.failure("Rate limited")
    
    @task(1)
    def emergency_stop_test(self):
        """Occasionally trigger emergency stop"""
        if not self.token:
            return
            
        # Emergency stop
        self.client.post("/api/rover/emergency-stop")
        time.sleep(random.uniform(1, 3))
        
        # Resume
        self.client.post("/api/rover/resume")
    
    @task(2)
    def query_telemetry(self):
        """Query historical telemetry data"""
        params = {
            "limit": random.randint(10, 100),
            "offset": random.randint(0, 1000)
        }
        
        self.client.get("/api/telemetry/latest", params=params)

class WebSocketUser(HttpUser):
    """WebSocket connection load testing"""
    wait_time = between(1, 3)
    
    def on_start(self):
        """Establish WebSocket connection"""
        self.ws_url = f"{self.host.replace('http', 'ws')}/api/ws/telemetry"
        self.ws_url += f"?client_id=load_test_{random.randint(1, 10000)}"
        
        # Get auth token
        response = self.client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass"
        })
        
        if response.status_code == 200:
            token = response.json()["access_token"]
            self.ws_url += f"&token={token}"
            
            # Connect WebSocket in background thread
            self.ws_thread = threading.Thread(target=self._ws_client)
            self.ws_thread.daemon = True
            self.ws_thread.start()
    
    def _ws_client(self):
        """WebSocket client thread"""
        try:
            ws = create_connection(self.ws_url)
            
            # Subscribe to channels
            ws.send(json.dumps({
                "type": "subscribe",
                "channels": ["telemetry", "alerts"]
            }))
            
            # Listen for messages
            while True:
                message = ws.recv()
                data = json.loads(message)
                
                # Send heartbeat
                if random.random() < 0.1:
                    ws.send(json.dumps({"type": "heartbeat"}))
                    
        except Exception as e:
            print(f"WebSocket error: {e}")
    
    @task
    def http_requests_while_ws_connected(self):
        """Make HTTP requests while maintaining WebSocket"""
        self.client.get("/api/rover/status")

# Custom event handlers for detailed metrics
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Load test starting...")

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, **kwargs):
    """Track detailed request metrics"""
    if response_time > 1000:  # Log slow requests
        print(f"Slow request: {name} took {response_time}ms")

# k6 Performance Script
"""
// tests/performance/k6_scripts/rover_control_scenario.js
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Spike
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],             // Error rate under 10%
    ws_connecting: ['p(95)<1000'],    // WebSocket connection under 1s
  },
};

const BASE_URL = 'http://localhost:8001';
const WS_URL = 'ws://localhost:8001/api/ws/telemetry';

export function setup() {
  // Login and get token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: 'testuser',
    password: 'testpass'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  return { token: loginRes.json('access_token') };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json'
  };

  // Scenario 1: Status polling
  const statusRes = http.get(`${BASE_URL}/api/rover/status`, { headers });
  check(statusRes, {
    'status check succeeded': (r) => r.status === 200,
    'has position data': (r) => JSON.parse(r.body).position !== undefined
  });
  errorRate.add(statusRes.status !== 200);

  sleep(1);

  // Scenario 2: Movement commands
  const moveRes = http.post(
    `${BASE_URL}/api/rover/control`,
    JSON.stringify({
      forward: Math.random() * 2 - 1,
      turn: Math.random() * 2 - 1
    }),
    { headers }
  );
  check(moveRes, {
    'movement command accepted': (r) => r.status === 200
  });

  // Scenario 3: WebSocket telemetry
  const wsUrl = `${WS_URL}?client_id=k6_${__VU}_${__ITER}&token=${data.token}`;
  
  ws.connect(wsUrl, {}, function(socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'subscribe',
        channels: ['telemetry']
      }));
    });

    socket.on('message', (data) => {
      const msg = JSON.parse(data);
      check(msg, {
        'received telemetry': () => msg.type === 'telemetry'
      });
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000); // Keep connection for 30s
  });

  sleep(2);
}
"""
```

### 5. Security Testing

#### OWASP ZAP Configuration
```yaml
# tests/security/owasp_zap_config.yaml
env:
  contexts:
    - name: "RoverMissionControl"
      urls:
        - "http://localhost:8001"
        - "http://localhost:3000"
      includePaths:
        - "http://localhost:8001/api/.*"
        - "http://localhost:3000/.*"
      excludePaths:
        - ".*\\.js"
        - ".*\\.css"
        - ".*\\.png"
      authentication:
        method: "json"
        loginUrl: "http://localhost:8001/api/auth/login"
        loginRequestData: '{"username":"{%username%}","password":"{%password%}"}'
        usernameParameter: "username"
        passwordParameter: "password"
        loggedInIndicator: "access_token"
      users:
        - name: "testuser"
          credentials:
            username: "testuser"
            password: "testpass"

jobs:
  - type: passiveScan-config
    parameters:
      maxAlertsPerRule: 10
      scanOnlyInScope: true
      
  - type: spider
    parameters:
      maxDuration: 10
      maxDepth: 5
      maxChildren: 10
      
  - type: passiveScan-wait
    parameters:
      maxDuration: 5
      
  - type: activeScan
    parameters:
      maxDuration: 60
      maxRuleDurationInMins: 5
      policy: "API-scan"
      
  - type: report
    parameters:
      template: "risk-confidence-html"
      reportDir: "tests/security/reports"
      reportFile: "ZAP-Report-{timestamp}.html"
      reportTitle: "RoverMissionControl Security Report"
      reportDescription: "Automated security scan results"
```

#### Security Test Suite
```python
# tests/security/test_auth_security.py
import pytest
import jwt
import time
from datetime import datetime, timedelta
import asyncio
from httpx import AsyncClient

class TestAuthenticationSecurity:
    """Security tests for authentication system"""
    
    @pytest.mark.asyncio
    async def test_jwt_token_expiration(self, async_client):
        """Test JWT token expiration is enforced"""
        # Login
        response = await async_client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass"
        })
        
        token = response.json()["access_token"]
        
        # Decode token to check expiration
        decoded = jwt.decode(token, options={"verify_signature": False})
        exp_time = datetime.fromtimestamp(decoded["exp"])
        
        # Token should expire in 30 minutes
        assert (exp_time - datetime.utcnow()).seconds < 1860  # 31 minutes
        
        # Create expired token
        expired_payload = {
            "sub": "testuser",
            "exp": datetime.utcnow() - timedelta(hours=1)
        }
        expired_token = jwt.encode(
            expired_payload, 
            "test_secret", 
            algorithm="HS256"
        )
        
        # Try to use expired token
        async_client.headers["Authorization"] = f"Bearer {expired_token}"
        response = await async_client.get("/api/rover/control")
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_brute_force_protection(self, async_client):
        """Test rate limiting on login attempts"""
        attempts = []
        
        # Make rapid login attempts
        for i in range(15):
            response = await async_client.post("/api/auth/login", json={
                "username": "testuser",
                "password": f"wrongpass{i}"
            })
            attempts.append(response.status_code)
            await asyncio.sleep(0.1)
        
        # Should get rate limited after 10 attempts
        assert 429 in attempts[10:]
        assert attempts[0] == 401  # First attempts should be auth failures
    
    @pytest.mark.asyncio
    async def test_sql_injection_prevention(self, async_client):
        """Test SQL injection prevention in login"""
        injection_attempts = [
            "admin' --",
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin'/*",
            "' or 1=1#"
        ]
        
        for payload in injection_attempts:
            response = await async_client.post("/api/auth/login", json={
                "username": payload,
                "password": "password"
            })
            
            # Should get normal auth failure, not SQL error
            assert response.status_code == 401
            assert "SQL" not in response.text
            assert "syntax" not in response.text.lower()
    
    @pytest.mark.asyncio
    async def test_password_requirements(self, async_client):
        """Test password complexity requirements"""
        weak_passwords = [
            "1234",
            "password",
            "12345678",
            "qwerty",
            "abc123"
        ]
        
        for weak_pass in weak_passwords:
            response = await async_client.post("/api/auth/register", json={
                "username": "newuser",
                "password": weak_pass,
                "email": "test@example.com"
            })
            
            assert response.status_code == 422
            assert "password" in response.json()["detail"][0]["loc"]
    
    @pytest.mark.asyncio
    async def test_session_fixation_prevention(self, async_client):
        """Test session fixation attack prevention"""
        # Get initial session
        response1 = await async_client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass"
        })
        
        token1 = response1.json()["access_token"]
        session1 = response1.cookies.get("session_id")
        
        # Login again
        response2 = await async_client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass"
        })
        
        token2 = response2.json()["access_token"]
        session2 = response2.cookies.get("session_id")
        
        # Tokens and sessions should be different
        assert token1 != token2
        assert session1 != session2
    
    @pytest.mark.asyncio
    async def test_cors_headers(self, async_client):
        """Test CORS headers are properly configured"""
        response = await async_client.options(
            "/api/rover/control",
            headers={"Origin": "http://evil.com"}
        )
        
        # Should not allow arbitrary origins
        allowed_origin = response.headers.get("Access-Control-Allow-Origin")
        assert allowed_origin != "http://evil.com"
        assert allowed_origin != "*"
```

### 6. CI/CD Pipeline Configuration

#### GitHub Actions Workflow
```yaml
# tests/ci/github_actions.yml
name: RoverMissionControl CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'  # Weekly security scan

env:
  NODE_VERSION: '18.x'
  PYTHON_VERSION: '3.11'
  DOCKER_BUILDKIT: 1

jobs:
  # Backend Tests
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: rover_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
        
    - name: Cache Python dependencies
      uses: actions/cache@v3
      with:
        path: ~/.cache/pip
        key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements*.txt') }}
        restore-keys: |
          ${{ runner.os }}-pip-
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r backend/requirements.txt
        pip install -r backend/requirements-dev.txt
        
    - name: Run linting
      run: |
        ruff check backend/
        mypy backend/ --strict
        
    - name: Run security checks
      run: |
        pip install safety bandit
        safety check
        bandit -r backend/ -ll
        
    - name: Run unit tests
      run: |
        pytest tests/unit/backend/ -v --cov=backend --cov-report=xml
        
    - name: Run integration tests
      env:
        DATABASE_URL: postgresql://postgres:testpass@localhost:5432/rover_test
      run: |
        pytest tests/integration/ -v --cov-append --cov=backend --cov-report=xml
        
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: backend
        name: backend-coverage

  # Frontend Tests
  frontend-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'yarn'
        cache-dependency-path: frontend/yarn.lock
        
    - name: Install dependencies
      working-directory: ./frontend
      run: yarn install --frozen-lockfile
      
    - name: Run linting
      working-directory: ./frontend
      run: |
        yarn lint
        yarn prettier --check .
        
    - name: Type checking
      working-directory: ./frontend
      run: yarn tsc --noEmit
      
    - name: Run unit tests
      working-directory: ./frontend
      run: yarn test --coverage --watchAll=false
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./frontend/coverage/lcov.info
        flags: frontend
        name: frontend-coverage

  # E2E Tests
  e2e-test:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
        
    - name: Install dependencies
      run: |
        # Backend
        pip install -r backend/requirements.txt
        
        # Frontend
        cd frontend && yarn install --frozen-lockfile
        
        # Playwright
        npx playwright install --with-deps
        
    - name: Build frontend
      working-directory: ./frontend
      run: yarn build
      
    - name: Start services
      run: |
        # Start backend
        cd backend && python server.py &
        
        # Start frontend
        cd frontend && yarn start &
        
        # Wait for services
        npx wait-on http://localhost:8001/health http://localhost:3000 -t 60000
        
    - name: Run E2E tests
      run: |
        cd tests/e2e
        npx playwright test --reporter=html
        
    - name: Upload E2E test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: playwright-report
        path: tests/e2e/playwright-report/
        retention-days: 30

  # Performance Tests
  performance-test:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup k6
      run: |
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
        
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
        
    - name: Install dependencies
      run: |
        pip install -r backend/requirements.txt
        pip install locust
        
    - name: Start backend
      run: |
        cd backend && python server.py &
        npx wait-on http://localhost:8001/health -t 30000
        
    - name: Run k6 tests
      run: |
        k6 run tests/performance/k6_scripts/rover_control_scenario.js \
          --out influxdb=http://localhost:8086/k6 \
          --summary-export=tests/performance/k6-summary.json
          
    - name: Run Locust tests
      run: |
        locust -f tests/performance/load_tests.py \
          --headless \
          --users 100 \
          --spawn-rate 10 \
          --run-time 5m \
          --host http://localhost:8001 \
          --html tests/performance/locust-report.html
          
    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-reports
        path: |
          tests/performance/k6-summary.json
          tests/performance/locust-report.html
        retention-days: 30

  # Security Scan
  security-scan:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
        
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
        
    - name: OWASP ZAP Scan
      uses: zaproxy/action-full-scan@v0.7.0
      with:
        target: 'http://localhost:8001'
        rules_file_name: 'tests/security/owasp_zap_config.yaml'
        allow_issue_writing: false
        
    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # Build and Push Docker Images
  docker-build:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test, e2e-test]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
      
    - name: Log in to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
        
    - name: Build and push backend
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: |
          ${{ secrets.DOCKER_USERNAME }}/rover-backend:latest
          ${{ secrets.DOCKER_USERNAME }}/rover-backend:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        
    - name: Build and push frontend
      uses: docker/build-push-action@v4
      with:
        context: ./frontend
        push: true
        tags: |
          ${{ secrets.DOCKER_USERNAME }}/rover-frontend:latest
          ${{ secrets.DOCKER_USERNAME }}/rover-frontend:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  # Deploy to staging
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [docker-build, security-scan]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: staging
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v4
      with:
        manifests: |
          k8s/staging/
        images: |
          ${{ secrets.DOCKER_USERNAME }}/rover-backend:${{ github.sha }}
          ${{ secrets.DOCKER_USERNAME }}/rover-frontend:${{ github.sha }}
        namespace: rover-staging
```

## Test Data Management

### Test Fixtures Factory
```python
# tests/fixtures/factories.py
import factory
from factory import Factory, Faker, SubFactory, LazyAttribute
from datetime import datetime, timedelta
import random
import numpy as np

from backend.models import User, Project, Task, Part, TelemetryRecord

class UserFactory(Factory):
    """Factory for creating test users"""
    class Meta:
        model = User
    
    username = Faker('user_name')
    email = Faker('email')
    password_hash = LazyAttribute(lambda obj: hash_password('testpass123'))
    role = factory.fuzzy.FuzzyChoice(['admin', 'operator', 'viewer'])
    is_active = True
    created_at = Faker('date_time_between', start_date='-1y', end_date='now')

class ProjectFactory(Factory):
    """Factory for creating test projects"""
    class Meta:
        model = Project
    
    name = Faker('catch_phrase')
    description = Faker('text', max_nb_chars=200)
    created_by = SubFactory(UserFactory)
    hardware_config = factory.LazyFunction(lambda: {
        'rover_model': random.choice(['MK1', 'MK2', 'MK3']),
        'sensors': ['camera', 'lidar', 'temperature', 'gps'],
        'max_speed': random.uniform(0.5, 2.0)
    })
    is_active = True

class TelemetryFactory(Factory):
    """Factory for creating realistic telemetry data"""
    class Meta:
        model = TelemetryRecord
    
    project = SubFactory(ProjectFactory)
    session_id = Faker('uuid4')
    timestamp = factory.LazyFunction(datetime.utcnow)
    
    # Realistic position data with movement patterns
    position_x = factory.LazyAttribute(
        lambda obj: obj._previous_x + random.gauss(0.1, 0.02) 
        if hasattr(obj, '_previous_x') else 0.0
    )
    position_y = factory.LazyAttribute(
        lambda obj: obj._previous_y + random.gauss(0.05, 0.01)
        if hasattr(obj, '_previous_y') else 0.0
    )
    position_z = 0.0
    
    # Rotation with drift
    rotation_pitch = factory.LazyFunction(lambda: random.gauss(0, 0.05))
    rotation_roll = factory.LazyFunction(lambda: random.gauss(0, 0.05))
    rotation_yaw = factory.LazyAttribute(
        lambda obj: (obj._previous_yaw + random.gauss(0.01, 0.005)) % (2 * np.pi)
        if hasattr(obj, '_previous_yaw') else 0.0
    )
    
    # Battery discharge curve
    battery_voltage = factory.LazyAttribute(
        lambda obj: max(10.0, 12.6 - (datetime.utcnow() - obj.timestamp).seconds * 0.0001)
    )
    
    # Temperature with environmental factors
    temperature = factory.LazyFunction(
        lambda: 25.0 + 5 * np.sin(datetime.utcnow().hour * np.pi / 12) + random.gauss(0, 1)
    )
    
    # Wheel speeds correlated with movement
    wheel_speed_fl = factory.LazyAttribute(lambda obj: obj.position_x * 10 + random.gauss(0, 0.1))
    wheel_speed_fr = factory.LazyAttribute(lambda obj: obj.position_x * 10 + random.gauss(0, 0.1))
    wheel_speed_rl = factory.LazyAttribute(lambda obj: obj.position_x * 10 + random.gauss(0, 0.1))
    wheel_speed_rr = factory.LazyAttribute(lambda obj: obj.position_x * 10 + random.gauss(0, 0.1))
    
    @classmethod
    def create_sequence(cls, count, **kwargs):
        """Create a sequence of telemetry with realistic continuity"""
        records = []
        previous = {'x': 0, 'y': 0, 'yaw': 0}
        
        for i in range(count):
            record = cls.create(
                _previous_x=previous['x'],
                _previous_y=previous['y'],
                _previous_yaw=previous['yaw'],
                timestamp=datetime.utcnow() - timedelta(seconds=count-i),
                **kwargs
            )
            
            previous['x'] = record.position_x
            previous['y'] = record.position_y
            previous['yaw'] = record.rotation_yaw
            
            records.append(record)
            
        return records

# Test data scenarios
class TestScenarios:
    """Pre-defined test scenarios for complex testing"""
    
    @staticmethod
    def emergency_stop_scenario():
        """Generate data for emergency stop testing"""
        return {
            'telemetry_before': TelemetryFactory.create_sequence(
                10,
                wheel_speed_fl=1.0,
                wheel_speed_fr=1.0,
                wheel_speed_rl=1.0,
                wheel_speed_rr=1.0
            ),
            'stop_command': {
                'type': 'emergency_stop',
                'timestamp': datetime.utcnow()
            },
            'telemetry_after': TelemetryFactory.create_sequence(
                5,
                wheel_speed_fl=0.0,
                wheel_speed_fr=0.0,
                wheel_speed_rl=0.0,
                wheel_speed_rr=0.0,
                position_x=5.0,  # Stopped position
                position_y=2.0
            )
        }
    
    @staticmethod
    def battery_drain_scenario():
        """Generate battery drain test data"""
        start_voltage = 12.6
        records = []
        
        for i in range(100):
            voltage = start_voltage - (i * 0.025)  # Linear drain
            if i > 80:
                voltage -= (i - 80) * 0.01  # Accelerated drain at low battery
                
            records.append(TelemetryFactory.create(
                battery_voltage=max(10.0, voltage),
                timestamp=datetime.utcnow() - timedelta(minutes=100-i)
            ))
            
        return records
```

## Testing Best Practices Implementation

### 1. Test Organization
```
- Group tests by feature and layer
- Use descriptive test names that explain the scenario
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated
```

### 2. Mocking Strategy
```python
# tests/mocks/mock_strategy.py
from unittest.mock import Mock, patch
from contextlib import contextmanager

class MockStrategy:
    """Centralized mocking strategies for consistent testing"""
    
    @staticmethod
    @contextmanager
    def mock_hardware(connected=True, responsive=True):
        """Mock hardware interface for testing"""
        with patch('serial.Serial') as mock_serial:
            instance = mock_serial.return_value
            instance.is_open = connected
            
            if responsive:
                instance.write.return_value = 10
                instance.read.return_value = b'OK\n'
            else:
                instance.write.side_effect = Exception("Hardware not responding")
                
            yield instance
    
    @staticmethod
    @contextmanager
    def mock_websocket_server():
        """Mock WebSocket server for client testing"""
        with patch('websockets.serve') as mock_serve:
            async def mock_handler(websocket, path):
                async for message in websocket:
                    data = json.loads(message)
                    if data['type'] == 'ping':
                        await websocket.send(json.dumps({'type': 'pong'}))
                    elif data['type'] == 'subscribe':
                        await websocket.send(json.dumps({
                            'type': 'subscription_confirmed',
                            'channels': data['channels']
                        }))
                        
            mock_serve.side_effect = mock_handler
            yield mock_serve
```

### 3. Test Coverage Requirements

#### Coverage Configuration
```ini
# .coveragerc
[run]
source = backend,frontend/src
omit = 
    */tests/*
    */migrations/*
    */venv/*
    */node_modules/*
    */__pycache__/*
    */test_*.py

[report]
precision = 2
show_missing = True
skip_covered = False

[html]
directory = htmlcov

[xml]
output = coverage.xml

# Coverage thresholds
fail_under = 80
```

### 4. Continuous Testing

#### Pre-commit Hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      
  - repo: https://github.com/psf/black
    rev: 23.1.0
    hooks:
      - id: black
        language_version: python3.11
        
  - repo: https://github.com/charliermarsh/ruff-pre-commit
    rev: v0.0.254
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
        
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.0.1
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
        
  - repo: local
    hooks:
      - id: pytest-unit
        name: pytest unit tests
        entry: pytest tests/unit/ -x --tb=short
        language: system
        pass_filenames: false
        always_run: true
```

## Test Monitoring and Reporting

### Test Metrics Dashboard
```python
# tests/monitoring/test_metrics.py
import json
from pathlib import Path
from datetime import datetime
import matplotlib.pyplot as plt
import pandas as pd

class TestMetricsCollector:
    """Collect and visualize test metrics"""
    
    def __init__(self, results_dir: Path):
        self.results_dir = results_dir
        self.metrics = {
            'coverage': [],
            'duration': [],
            'failures': [],
            'flaky_tests': []
        }
    
    def collect_from_junit(self, junit_file: Path):
        """Parse JUnit XML for test metrics"""
        # Implementation details...
        pass
    
    def generate_report(self):
        """Generate HTML report with visualizations"""
        fig, axes = plt.subplots(2, 2, figsize=(12, 8))
        
        # Coverage trend
        df = pd.DataFrame(self.metrics)
        df['date'] = pd.to_datetime(df['date'])
        
        axes[0, 0].plot(df['date'], df['coverage'])
        axes[0, 0].set_title('Code Coverage Trend')
        axes[0, 0].set_ylabel('Coverage %')
        
        # Test duration
        axes[0, 1].plot(df['date'], df['duration'])
        axes[0, 1].set_title('Test Suite Duration')
        axes[0, 1].set_ylabel('Duration (seconds)')
        
        # Failure rate
        axes[1, 0].bar(df['date'], df['failures'])
        axes[1, 0].set_title('Test Failures')
        axes[1, 0].set_ylabel('Failed Tests')
        
        # Flaky tests
        axes[1, 1].scatter(df['date'], df['flaky_tests'])
        axes[1, 1].set_title('Flaky Tests Detection')
        axes[1, 1].set_ylabel('Flaky Test Count')
        
        plt.tight_layout()
        plt.savefig(self.results_dir / 'test_metrics.png')
        
        # Generate HTML
        self._generate_html_report()
```

## Mutation Testing

### Mutation Testing Configuration
```python
# mutmut_config.py
def init():
    """Initialize mutation testing configuration"""
    return {
        'paths_to_mutate': ['backend/', 'frontend/src/'],
        'tests_dir': 'tests/',
        'runner': 'python -m pytest -x',
        'dict_synonyms': ['Dict', 'dict'],
        'total_timeout': 3600,
        'test_time_multiplier': 1.5,
        'test_time_base': 0.0,
        'swallow_output': True,
        'use_coverage': True
    }

# Run mutation testing
# mutmut run --paths-to-mutate=backend/services/
# mutmut results
# mutmut html
```

## Visual Regression Testing

### Visual Test Configuration
```javascript
// tests/visual/visual.config.js
module.exports = {
  // Backstop.js configuration
  id: "rover_visual_tests",
  viewports: [
    { label: "phone", width: 320, height: 480 },
    { label: "tablet", width: 768, height: 1024 },
    { label: "desktop", width: 1366, height: 768 }
  ],
  scenarios: [
    {
      label: "Rover 3D View",
      url: "http://localhost:3000",
      selectors: ["[data-testid='rover-canvas']"],
      delay: 2000,
      misMatchThreshold: 0.1
    },
    {
      label: "Control Panel",
      url: "http://localhost:3000",
      selectors: ["[data-testid='control-panel']"],
      hoverSelector: "[data-testid='joystick']",
      misMatchThreshold: 0.05
    },
    {
      label: "Telemetry Dashboard",
      url: "http://localhost:3000/telemetry",
      selectors: ["[data-testid='telemetry-dashboard']"],
      delay: 1000,
      misMatchThreshold: 0.1
    }
  ],
  paths: {
    bitmaps_reference: "tests/visual/reference",
    bitmaps_test: "tests/visual/test",
    html_report: "tests/visual/report"
  },
  report: ["browser", "CI"],
  engine: "playwright",
  engineOptions: {
    args: ["--no-sandbox"]
  },
  asyncCaptureLimit: 5,
  debug: false,
  debugWindow: false
};
```

## Contract Testing

### API Contract Tests
```python
# tests/contract/test_api_contracts.py
import pytest
from pactman import Consumer, Provider, Term
from pactman.verifier import verify_pact

@pytest.fixture
def pact():
    """Setup Pact consumer"""
    return Consumer('RoverFrontend').has_pact_with(
        Provider('RoverBackend'),
        host_name='localhost',
        port=8001
    )

def test_rover_status_contract(pact):
    """Test contract for rover status endpoint"""
    expected = {
        'connected': True,
        'emergency_stop': False,
        'position': {
            'x': Term(r'\d+\.\d+', 0.0),
            'y': Term(r'\d+\.\d+', 0.0),
            'z': Term(r'\d+\.\d+', 0.0)
        },
        'battery': {
            'voltage': Term(r'\d+\.\d+', 12.6),
            'percentage': Term(r'\d+', 85)
        }
    }
    
    (pact
     .given('rover is connected')
     .upon_receiving('a request for rover status')
     .with_request('GET', '/api/rover/status')
     .will_respond_with(200, body=expected))
    
    with pact:
        # Frontend would make request here
        result = requests.get(pact.uri + '/api/rover/status')
        assert result.json() == expected

# Provider verification
@pytest.mark.contract
def test_provider_contract_verification():
    """Verify provider meets contract"""
    verify_pact(
        'RoverBackend',
        pact_url='./pacts/roverfrontend-roverbackend.json',
        base_url='http://localhost:8001',
        provider_states_setup_url='http://localhost:8001/test/setup'
    )
```

## Chaos Engineering

### Chaos Testing Framework
```python
# tests/chaos/chaos_tests.py
import asyncio
import random
from datetime import datetime, timedelta

class ChaosMonkey:
    """Inject failures for resilience testing"""
    
    def __init__(self, target_system):
        self.target = target_system
        self.chaos_scenarios = [
            self.network_latency,
            self.packet_loss,
            self.hardware_disconnect,
            self.memory_pressure,
            self.cpu_spike
        ]
    
    async def unleash_chaos(self, duration_minutes=10):
        """Run random chaos scenarios"""
        end_time = datetime.now() + timedelta(minutes=duration_minutes)
        
        while datetime.now() < end_time:
            scenario = random.choice(self.chaos_scenarios)
            await scenario()
            await asyncio.sleep(random.randint(30, 120))
    
    async def network_latency(self):
        """Inject network latency"""
        latency_ms = random.randint(100, 2000)
        print(f"Injecting {latency_ms}ms network latency")
        # Implementation using tc or iptables
        
    async def hardware_disconnect(self):
        """Simulate hardware disconnection"""
        print("Simulating hardware disconnect")
        self.target.disconnect_hardware()
        await asyncio.sleep(random.randint(5, 30))
        self.target.reconnect_hardware()
```

## Testing Documentation

### Test Strategy Document
```markdown
# RoverMissionControl Test Strategy

## Overview
Comprehensive testing approach covering unit, integration, E2E, performance, and security testing.

## Test Pyramid
- Unit Tests: 70% (Fast, isolated, extensive)
- Integration Tests: 20% (API and component integration)
- E2E Tests: 10% (Critical user journeys)

## Key Testing Areas
1. Hardware interface reliability
2. Real-time communication stability
3. 3D visualization performance
4. Security and authentication
5. Data persistence and integrity

## Test Environments
- Local: Docker Compose setup
- CI: GitHub Actions runners
- Staging: Kubernetes cluster
- Performance: Dedicated load testing infrastructure

## Quality Gates
- Code coverage: 80% minimum
- All tests passing
- No critical security vulnerabilities
- Performance benchmarks met
- Visual regression checks passed

## Continuous Improvement
- Weekly test failure analysis
- Monthly performance baseline updates
- Quarterly security assessment
- Annual test strategy review
```

## Next Steps

1. **Implement Missing Tests**
   - [ ] Complete hardware mock implementation
   - [ ] Add WebSocket connection tests
   - [ ] Create visual regression baseline
   - [ ] Set up contract testing

2. **Enhance CI/CD Pipeline**
   - [ ] Add parallel test execution
   - [ ] Implement test result caching
   - [ ] Set up test failure notifications
   - [ ] Create test dashboard

3. **Performance Optimization**
   - [ ] Implement test parallelization
   - [ ] Add test data factories
   - [ ] Optimize fixture creation
   - [ ] Reduce test execution time

4. **Documentation**
   - [ ] Create test writing guidelines
   - [ ] Document test patterns
   - [ ] Add troubleshooting guide
   - [ ] Create onboarding materials

## Advanced Pytest Patterns

### Modern Fixture Architecture
```python
# tests/conftest.py - Root configuration with advanced patterns
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from httpx import AsyncClient
import pytest_asyncio
from collections.abc import Iterator

# Fixture scope hierarchy for optimal performance
pytest_plugins = [
    "tests.fixtures.database",
    "tests.fixtures.hardware", 
    "tests.fixtures.websocket",
    "tests.fixtures.auth"
]

@pytest.fixture(scope="session")
def event_loop_policy():
    """Custom event loop policy for Windows compatibility"""
    if sys.platform.startswith('win'):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    return asyncio.get_event_loop_policy()

@pytest.fixture(scope="session")
def event_loop(event_loop_policy) -> Iterator[asyncio.AbstractEventLoop]:
    """Session-scoped event loop for async tests"""
    loop = event_loop_policy.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def database_engine():
    """Shared database engine for test session"""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(database_engine) -> AsyncGenerator[AsyncSession, None]:
    """Database session with automatic transaction rollback"""
    async with database_engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                future=True
            )
            
            yield session
            
            await session.close()
            await transaction.rollback()

@pytest.fixture
def anyio_backend():
    """Use asyncio backend for anyio compatibility"""
    return "asyncio"

# Advanced parametrization with indirect fixtures
class RoverConfig:
    """Configuration for rover hardware tests"""
    def __init__(self, model: str, firmware: str, features: list):
        self.model = model
        self.firmware = firmware  
        self.features = features

@pytest.fixture
def rover_config(request) -> RoverConfig:
    """Indirect fixture for rover configuration"""
    return RoverConfig(**request.param)

@pytest.mark.parametrize(
    "rover_config",
    [
        {"model": "MK1", "firmware": "1.0", "features": ["basic"]},
        {"model": "MK2", "firmware": "2.0", "features": ["gps", "lidar"]},
        {"model": "MK3", "firmware": "3.0", "features": ["gps", "lidar", "camera"]}
    ],
    indirect=True
)
def test_rover_initialization(rover_config):
    """Test rover init with different configurations"""
    assert rover_config.model in ["MK1", "MK2", "MK3"]
```

### Advanced Pytest Hooks
```python
# tests/conftest.py - Custom hooks for enhanced testing
import time
import json
from pathlib import Path
import pytest
from _pytest.nodes import Item
from _pytest.reports import TestReport

# Test timing and performance tracking
class TestTimingPlugin:
    def __init__(self):
        self.test_durations = {}
        self.slow_tests = []
        self.threshold = 1.0  # seconds
        
    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_makereport(self, item: Item, call):
        outcome = yield
        report: TestReport = outcome.get_result()
        
        if report.when == "call":
            duration = report.duration
            test_name = item.nodeid
            
            self.test_durations[test_name] = duration
            
            if duration > self.threshold:
                self.slow_tests.append({
                    "test": test_name,
                    "duration": duration,
                    "outcome": report.outcome
                })
    
    def pytest_sessionfinish(self, session, exitstatus):
        """Generate performance report after test session"""
        if self.slow_tests:
            report_path = Path("test-performance-report.json")
            with open(report_path, "w") as f:
                json.dump({
                    "slow_tests": self.slow_tests,
                    "total_tests": len(self.test_durations),
                    "average_duration": sum(self.test_durations.values()) / len(self.test_durations)
                }, f, indent=2)
            
            print(f"\n⚠️  {len(self.slow_tests)} slow tests detected (>{self.threshold}s)")
            print(f"📊 Performance report saved to {report_path}")

# Register the plugin
def pytest_configure(config):
    config.pluginmanager.register(TestTimingPlugin(), "test_timing")

# Custom markers with validation
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "hardware: mark test as requiring hardware connection"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running (>5s)"
    )
    config.addinivalue_line(
        "markers", "flaky(max_runs=3, min_passes=1): mark test as flaky"
    )

# Automatic test categorization
def pytest_collection_modifyitems(config, items):
    for item in items:
        # Auto-mark integration tests
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
            
        # Auto-mark slow tests based on historical data
        if hasattr(config, "_test_durations"):
            historical_duration = config._test_durations.get(item.nodeid, 0)
            if historical_duration > 5.0:
                item.add_marker(pytest.mark.slow)
                
        # Mark hardware tests
        if "hardware" in item.fixturenames or "serial" in str(item.fspath):
            item.add_marker(pytest.mark.hardware)

# Screenshot capture on failure
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    
    if report.failed and "browser" in item.fixturenames:
        browser = item.funcargs["browser"]
        screenshot_dir = Path("test-screenshots")
        screenshot_dir.mkdir(exist_ok=True)
        
        screenshot_path = screenshot_dir / f"{item.nodeid.replace('::', '_')}.png"
        browser.screenshot(path=str(screenshot_path))
        
        # Attach to pytest-html report if available
        if hasattr(report, "extra"):
            report.extra.append(
                pytest.html.extras.image(str(screenshot_path))
            )
```

### Hypothesis Property-Based Testing
```python
# tests/unit/backend/test_property_based.py
import hypothesis
from hypothesis import given, strategies as st, settings, assume
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant, Bundle
import numpy as np

# Custom strategies for rover domain
@st.composite
def rover_position(draw):
    """Generate valid rover positions"""
    return {
        "x": draw(st.floats(min_value=-100, max_value=100, allow_nan=False)),
        "y": draw(st.floats(min_value=-100, max_value=100, allow_nan=False)),
        "z": draw(st.floats(min_value=0, max_value=10, allow_nan=False))
    }

@st.composite  
def rover_command(draw):
    """Generate valid rover commands"""
    return {
        "forward": draw(st.floats(min_value=-1.0, max_value=1.0)),
        "turn": draw(st.floats(min_value=-1.0, max_value=1.0)),
        "duration": draw(st.one_of(
            st.none(),
            st.floats(min_value=0.1, max_value=10.0)
        ))
    }

# Property-based tests
class TestRoverPhysics:
    @given(cmd=rover_command())
    @settings(max_examples=1000, deadline=None)
    def test_command_validation_properties(self, cmd):
        """Test that all generated commands are valid"""
        validator = RoverCommandValidator()
        
        # Property: validation should never raise for valid ranges
        result = validator.validate(cmd)
        assert result.is_valid or result.errors
        
        # Property: normalized commands stay in bounds
        if result.is_valid:
            normalized = validator.normalize(cmd)
            assert -1.0 <= normalized["forward"] <= 1.0
            assert -1.0 <= normalized["turn"] <= 1.0
    
    @given(
        initial_pos=rover_position(),
        commands=st.lists(rover_command(), min_size=1, max_size=10)
    )
    def test_physics_simulation_properties(self, initial_pos, commands):
        """Test physics simulation maintains invariants"""
        sim = RoverPhysicsSimulator(initial_pos)
        
        for cmd in commands:
            prev_energy = sim.total_energy
            sim.execute_command(cmd)
            
            # Property: Energy conservation (with tolerance for numerical errors)
            assert abs(sim.total_energy - prev_energy) < 0.1
            
            # Property: Position remains finite
            assert all(np.isfinite(v) for v in sim.position.values())
            
            # Property: No teleportation (max speed limit)
            max_distance = 2.0 * (cmd.get("duration") or 0.1)  # max_speed * duration
            actual_distance = np.linalg.norm([
                sim.position[k] - initial_pos[k] for k in ["x", "y", "z"]
            ])
            assert actual_distance <= max_distance * len(commands)

# Stateful testing for complex scenarios
class RoverStateMachine(RuleBasedStateMachine):
    """Stateful testing of rover behavior"""
    
    def __init__(self):
        super().__init__()
        self.rover = RoverController()
        self.positions = []
        self.emergency_stops = 0
        
    commands = Bundle("commands")
    
    @rule(target=commands, cmd=rover_command())
    def send_command(self, cmd):
        """Send command to rover"""
        result = self.rover.execute_command(cmd)
        self.positions.append(self.rover.position.copy())
        return result
    
    @rule()
    def emergency_stop(self):
        """Trigger emergency stop"""
        self.rover.emergency_stop()
        self.emergency_stops += 1
    
    @rule()
    def resume(self):
        """Resume after emergency stop"""
        if self.emergency_stops > 0:
            self.rover.resume()
    
    @invariant()
    def position_history_consistent(self):
        """Position history should be consistent"""
        if len(self.positions) > 1:
            for i in range(1, len(self.positions)):
                # Positions should change gradually
                delta = np.linalg.norm([
                    self.positions[i][k] - self.positions[i-1][k]
                    for k in ["x", "y", "z"]
                ])
                assert delta < 5.0  # Max single-step movement
    
    @invariant()
    def emergency_stop_works(self):
        """Emergency stop should halt movement"""
        if self.rover.is_emergency_stopped:
            assert all(v == 0 for v in self.rover.wheel_speeds.values())

# Run stateful test
TestRoverState = RoverStateMachine.TestCase
TestRoverState.settings = settings(
    max_examples=50,
    stateful_step_count=100,
    deadline=None
)
```

## Advanced Playwright Patterns

### Page Object Model with TypeScript
```typescript
// tests/e2e/pages/BasePage.ts
import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  // Common navigation helpers
  async goto(path: string = '') {
    await this.page.goto(`${process.env.BASE_URL || 'http://localhost:3000'}${path}`);
    await this.waitForPageLoad();
  }
  
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for React to hydrate
    await this.page.waitForFunction(() => {
      const root = document.querySelector('#root');
      return root && root.children.length > 0;
    });
  }
  
  // WebSocket helpers
  async mockWebSocket(url: string) {
    return await this.page.route(url, async (route, request) => {
      // Create mock WebSocket
      const ws = new MockWebSocket(url);
      await route.fulfill({ websocket: ws });
      return ws;
    });
  }
  
  // Visual regression helpers
  async checkVisualRegression(name: string, options?: any) {
    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      fullPage: false,
      animations: 'disabled',
      mask: [this.page.locator('[data-testid="timestamp"]')],
      ...options
    });
  }
  
  // Accessibility testing
  async checkAccessibility(options?: any) {
    const violations = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-ignore
        window.axe.run(options, (err, results) => {
          resolve(results.violations);
        });
      });
    });
    expect(violations).toHaveLength(0);
  }
}

// tests/e2e/pages/RoverControlPage.ts  
export class RoverControlPage extends BasePage {
  // Locators
  readonly canvas: Locator;
  readonly joystick: Locator;
  readonly emergencyStop: Locator;
  readonly telemetryPanel: Locator;
  readonly batteryGauge: Locator;
  readonly positionDisplay: Locator;
  readonly statusIndicator: Locator;
  
  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.canvas = page.locator('[data-testid="rover-canvas"]');
    this.joystick = page.locator('[data-testid="virtual-joystick"]');
    this.emergencyStop = page.locator('[data-testid="emergency-stop-button"]');
    this.telemetryPanel = page.locator('[data-testid="telemetry-panel"]');
    this.batteryGauge = page.locator('[data-testid="battery-gauge"]');
    this.positionDisplay = page.locator('[data-testid="position-display"]');
    this.statusIndicator = page.locator('[data-testid="status-indicator"]');
  }
  
  async waitFor3DScene() {
    // Wait for Three.js to initialize
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.getContext('webgl2');
    });
    
    // Wait for first render
    await this.page.waitForTimeout(1000);
  }
  
  async moveJoystick(direction: 'forward' | 'backward' | 'left' | 'right', amount: number = 0.5) {
    const box = await this.joystick.boundingBox();
    if (!box) throw new Error('Joystick not found');
    
    const center = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    };
    
    let target = { ...center };
    
    switch (direction) {
      case 'forward':
        target.y -= box.height * amount * 0.4;
        break;
      case 'backward':
        target.y += box.height * amount * 0.4;
        break;
      case 'left':
        target.x -= box.width * amount * 0.4;
        break;
      case 'right':
        target.x += box.width * amount * 0.4;
        break;
    }
    
    // Simulate touch/mouse drag
    await this.page.mouse.move(center.x, center.y);
    await this.page.mouse.down();
    await this.page.mouse.move(target.x, target.y, { steps: 10 });
    await this.page.waitForTimeout(100);
    await this.page.mouse.up();
  }
  
  async getPosition(): Promise<{ x: number; y: number; z: number }> {
    const text = await this.positionDisplay.textContent();
    const match = text?.match(/X:\s*([\d.-]+).*Y:\s*([\d.-]+).*Z:\s*([\d.-]+)/);
    
    if (!match) throw new Error('Could not parse position');
    
    return {
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3])
    };
  }
  
  async getBatteryLevel(): Promise<number> {
    const text = await this.batteryGauge.textContent();
    const match = text?.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }
  
  async triggerEmergencyStop() {
    await this.emergencyStop.click();
    await expect(this.statusIndicator).toHaveClass(/emergency-stop/, { timeout: 1000 });
  }
  
  async verifyTelemetryUpdate(expectedData: any) {
    await expect(this.telemetryPanel).toContainText(
      JSON.stringify(expectedData), 
      { timeout: 5000 }
    );
  }
}
```

### Advanced Playwright Testing Patterns
```typescript
// tests/e2e/fixtures/test-fixtures.ts
import { test as base, expect } from '@playwright/test';
import { RoverControlPage } from '../pages/RoverControlPage';
import { MockWebSocketServer } from '../helpers/MockWebSocketServer';

type TestFixtures = {
  roverPage: RoverControlPage;
  wsServer: MockWebSocketServer;
  authenticated: void;
};

export const test = base.extend<TestFixtures>({
  // Page fixture with automatic navigation
  roverPage: async ({ page }, use) => {
    const roverPage = new RoverControlPage(page);
    await roverPage.goto();
    await roverPage.waitFor3DScene();
    await use(roverPage);
  },
  
  // WebSocket mock server
  wsServer: async ({ page }, use) => {
    const server = new MockWebSocketServer();
    await server.start();
    
    // Override WebSocket constructor
    await page.addInitScript(() => {
      window.WebSocket = class extends WebSocket {
        constructor(url: string) {
          // Redirect to mock server
          super(url.replace('ws://localhost:8001', 'ws://localhost:8002'));
        }
      };
    });
    
    await use(server);
    await server.stop();
  },
  
  // Authentication fixture
  authenticated: async ({ page }, use) => {
    // Mock authentication
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-token',
          user: { id: 1, username: 'testuser', role: 'operator' }
        })
      });
    });
    
    // Set auth cookie/storage
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock-jwt-token');
    });
    
    await use();
  }
});

export { expect };

// tests/e2e/specs/rover-control-advanced.spec.ts
import { test, expect } from '../fixtures/test-fixtures';

test.describe('Advanced Rover Control', () => {
  test.beforeEach(async ({ page }) => {
    // Set up request interception
    await page.route('**/api/rover/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          position: { x: 0, y: 0, z: 0 },
          battery: { voltage: 12.6, percentage: 85 }
        })
      });
    });
  });
  
  test('complex movement sequence with telemetry verification', async ({ 
    roverPage, 
    wsServer,
    authenticated 
  }) => {
    // Set up WebSocket expectations
    wsServer.on('connection', (ws) => {
      ws.on('message', async (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'subscribe') {
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            channels: msg.channels
          }));
        }
        
        if (msg.type === 'command' && msg.payload.action === 'move') {
          // Simulate telemetry updates
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            ws.send(JSON.stringify({
              type: 'telemetry',
              data: {
                position: { 
                  x: i * msg.payload.parameters.forward,
                  y: 0,
                  z: 0 
                },
                sensors: { battery: 85 - i * 0.1 }
              }
            }));
          }
        }
      });
    });
    
    // Execute movement sequence
    const movements = [
      { direction: 'forward' as const, duration: 2000 },
      { direction: 'right' as const, duration: 1000 },
      { direction: 'forward' as const, duration: 1500 },
      { direction: 'left' as const, duration: 1000 }
    ];
    
    for (const movement of movements) {
      await roverPage.moveJoystick(movement.direction);
      await roverPage.page.waitForTimeout(movement.duration);
      
      // Verify position updates
      const position = await roverPage.getPosition();
      expect(position.x).toBeGreaterThan(0);
    }
    
    // Verify final state
    const finalPosition = await roverPage.getPosition();
    expect(finalPosition).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: 0
    });
    
    // Check battery drain
    const battery = await roverPage.getBatteryLevel();
    expect(battery).toBeLessThan(85);
  });
  
  test('handles network interruptions gracefully', async ({ roverPage, page }) => {
    // Simulate network offline
    await page.context().setOffline(true);
    
    // Attempt movement
    await roverPage.moveJoystick('forward');
    
    // Should show connection error
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Should auto-reconnect
    await expect(page.locator('[data-testid="connection-error"]')).not.toBeVisible({ timeout: 5000 });
  });
  
  test('performance metrics collection', async ({ roverPage, page }) => {
    // Start performance measurement
    await page.coverage.startJSCoverage();
    const performanceMetrics = await page.evaluate(() => {
      const entries: any[] = [];
      const observer = new PerformanceObserver((list) => {
        entries.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      return { observer, entries };
    });
    
    // Perform actions
    for (let i = 0; i < 10; i++) {
      await roverPage.moveJoystick('forward');
      await page.waitForTimeout(100);
    }
    
    // Collect metrics
    const metrics = await page.evaluate(() => performance.getEntriesByType('measure'));
    const coverage = await page.coverage.stopJSCoverage();
    
    // Analyze performance
    const renderMetrics = metrics.filter((m: any) => m.name.includes('render'));
    const avgRenderTime = renderMetrics.reduce((sum: number, m: any) => sum + m.duration, 0) / renderMetrics.length;
    
    expect(avgRenderTime).toBeLessThan(16.67); // 60 FPS target
    
    // Check coverage
    const totalBytes = coverage.reduce((sum, entry) => sum + entry.text.length, 0);
    const usedBytes = coverage.reduce((sum, entry) => {
      return sum + entry.ranges.reduce((s, range) => s + (range.end - range.start), 0);
    }, 0);
    
    console.log(`Code coverage: ${((usedBytes / totalBytes) * 100).toFixed(2)}%`);
  });
});

// tests/e2e/specs/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('rover control page meets WCAG standards', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await injectAxe(page);
    
    // Check entire page
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
    
    // Check specific components
    await checkA11y(page, '[data-testid="control-panel"]', {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa']
      }
    });
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'emergency-stop-button');
    
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'virtual-joystick');
    
    // Test screen reader announcements
    await page.locator('[data-testid="emergency-stop-button"]').click();
    await expect(page.locator('[role="alert"]')).toContainText('Emergency stop activated');
  });
});
```

### Playwright Component Testing
```typescript
// tests/component/RoverModel.spec.tsx
import { test, expect } from '@playwright/experimental-ct-react';
import { RoverModel } from '../../frontend/src/components/RoverModel';

test.describe('RoverModel Component', () => {
  test('renders and updates position', async ({ mount, page }) => {
    const component = await mount(
      <RoverModel
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        wheelSpeeds={{ fl: 0, fr: 0, rl: 0, rr: 0 }}
      />
    );
    
    // Check canvas rendered
    await expect(component.locator('canvas')).toBeVisible();
    
    // Update props
    await component.update(
      <RoverModel
        position={[5, 0, 0]}
        rotation={[0, 0, Math.PI / 4]}
        wheelSpeeds={{ fl: 1, fr: 1, rl: 1, rr: 1 }}
      />
    );
    
    // Verify Three.js scene updated
    const sceneData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      // Get scene info via Three.js
      return { hasContext: !!gl };
    });
    
    expect(sceneData.hasContext).toBe(true);
  });
  
  test('handles prop validation', async ({ mount }) => {
    // Test invalid props
    await expect(async () => {
      await mount(
        <RoverModel
          position={[NaN, 0, 0]}
          rotation={[0, 0, 0]}
          wheelSpeeds={{ fl: 0, fr: 0, rl: 0, rr: 0 }}
        />
      );
    }).rejects.toThrow();
  });
});
```

## Test Optimization Strategies

### Parallel Execution Configuration
```javascript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
    ['github']
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  webServer: [
    {
      command: 'cd backend && python server.py',
      port: 8001,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd frontend && yarn start',
      port: 3000,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    }
  ],
});

// pytest.ini - Pytest parallel configuration
[tool.pytest.ini_options]
minversion = "7.0"
addopts = [
    "-ra",
    "--strict-markers",
    "--strict-config",
    "--cov=backend",
    "--cov-branch",
    "--cov-report=term-missing:skip-covered",
    "--cov-report=html",
    "--cov-report=xml",
    "-n auto",  # Parallel execution
    "--dist loadgroup",  # Group tests by xdist_group marker
    "--maxfail=5",
    "--tb=short"
]
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
markers = [
    "slow: marks tests as slow (deselect with '-m "not slow"')",
    "hardware: marks tests requiring hardware connection",
    "integration: marks integration tests",
    "unit: marks unit tests",
    "e2e: marks end-to-end tests"
]
```

### Test Result Analysis
```python
# tests/analysis/test_analyzer.py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json
import xml.etree.ElementTree as ET

class TestResultAnalyzer:
    """Analyze test results for patterns and improvements"""
    
    def __init__(self, results_dir: Path):
        self.results_dir = results_dir
        self.test_history = pd.DataFrame()
        
    def load_pytest_results(self, junit_file: Path):
        """Load pytest JUnit XML results"""
        tree = ET.parse(junit_file)
        root = tree.getroot()
        
        results = []
        for testcase in root.findall('.//testcase'):
            result = {
                'name': testcase.get('name'),
                'classname': testcase.get('classname'),
                'time': float(testcase.get('time', 0)),
                'status': 'passed'
            }
            
            if testcase.find('failure') is not None:
                result['status'] = 'failed'
                result['message'] = testcase.find('failure').get('message')
            elif testcase.find('error') is not None:
                result['status'] = 'error'
                result['message'] = testcase.find('error').get('message')
            elif testcase.find('skipped') is not None:
                result['status'] = 'skipped'
                result['message'] = testcase.find('skipped').get('message')
                
            results.append(result)
            
        return pd.DataFrame(results)
    
    def analyze_flaky_tests(self, threshold: int = 3):
        """Identify flaky tests based on inconsistent results"""
        # Group by test name and calculate failure rate
        test_stability = self.test_history.groupby('name').agg({
            'status': lambda x: (x == 'failed').sum() / len(x),
            'time': ['mean', 'std']
        })
        
        # Identify flaky tests
        flaky_tests = test_stability[
            (test_stability[('status', '')] > 0.1) & 
            (test_stability[('status', '')] < 0.9)
        ]
        
        return flaky_tests
    
    def generate_insights_report(self):
        """Generate comprehensive test insights"""
        insights = {
            'summary': {
                'total_tests': len(self.test_history),
                'unique_tests': self.test_history['name'].nunique(),
                'pass_rate': (self.test_history['status'] == 'passed').mean(),
                'avg_duration': self.test_history['time'].mean()
            },
            'slow_tests': self._identify_slow_tests(),
            'flaky_tests': self.analyze_flaky_tests().to_dict(),
            'failure_patterns': self._analyze_failure_patterns(),
            'recommendations': self._generate_recommendations()
        }
        
        return insights
    
    def _identify_slow_tests(self, percentile: float = 0.95):
        """Identify tests in the top percentile of duration"""
        threshold = self.test_history['time'].quantile(percentile)
        slow_tests = self.test_history[
            self.test_history['time'] > threshold
        ].groupby('name')['time'].agg(['mean', 'count'])
        
        return slow_tests.sort_values('mean', ascending=False).head(10)
    
    def _analyze_failure_patterns(self):
        """Analyze common failure patterns"""
        failures = self.test_history[self.test_history['status'] == 'failed']
        
        if 'message' in failures.columns:
            # Extract error types
            failures['error_type'] = failures['message'].str.extract(
                r'(\w+Error|\w+Exception)'
            )
            
            return failures['error_type'].value_counts().to_dict()
        
        return {}
    
    def visualize_trends(self, output_file: Path):
        """Create visualization of test trends"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # Test duration distribution
        self.test_history['time'].hist(bins=50, ax=axes[0, 0])
        axes[0, 0].set_title('Test Duration Distribution')
        axes[0, 0].set_xlabel('Duration (seconds)')
        
        # Pass rate over time
        if 'timestamp' in self.test_history.columns:
            daily_stats = self.test_history.groupby(
                pd.Grouper(key='timestamp', freq='D')
            )['status'].apply(lambda x: (x == 'passed').mean())
            
            daily_stats.plot(ax=axes[0, 1])
            axes[0, 1].set_title('Pass Rate Trend')
            axes[0, 1].set_ylabel('Pass Rate')
        
        # Test categories performance
        if 'classname' in self.test_history.columns:
            category_stats = self.test_history.groupby('classname').agg({
                'status': lambda x: (x == 'passed').mean(),
                'time': 'mean'
            })
            
            category_stats.plot.bar(ax=axes[1, 0])
            axes[1, 0].set_title('Performance by Test Category')
        
        # Failure heatmap
        if 'timestamp' in self.test_history.columns and 'name' in self.test_history.columns:
            pivot_data = self.test_history.pivot_table(
                index='name',
                columns=pd.Grouper(key='timestamp', freq='D'),
                values='status',
                aggfunc=lambda x: (x == 'failed').sum()
            )
            
            sns.heatmap(pivot_data, cmap='YlOrRd', ax=axes[1, 1])
            axes[1, 1].set_title('Failure Heatmap')
        
        plt.tight_layout()
        plt.savefig(output_file)
```

## MCP Integration for Test Intelligence

### Test Generation with AI
```python
# tests/generation/ai_test_generator.py
import ast
import black
from pathlib import Path
from typing import List, Dict

class AITestGenerator:
    """Generate tests using MCP AI capabilities"""
    
    def __init__(self, mcp_client):
        self.mcp = mcp_client
        
    async def generate_tests_for_module(self, module_path: Path) -> str:
        """Generate comprehensive tests for a Python module"""
        # Read the source code
        source_code = module_path.read_text()
        
        # Analyze code structure
        tree = ast.parse(source_code)
        functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        
        # Generate test prompt
        prompt = f"""
        Generate comprehensive pytest tests for the following Python module:
        
        {source_code}
        
        Requirements:
        1. Test all public functions and methods
        2. Include edge cases and error conditions
        3. Use pytest fixtures and parametrization
        4. Add property-based tests where appropriate
        5. Include async tests if functions are async
        6. Follow the existing test patterns in the codebase
        """
        
        # Use AI to generate tests
        response = await self.mcp.generate_tests(prompt)
        
        # Format with black
        formatted_tests = black.format_str(response, mode=black.Mode())
        
        return formatted_tests
    
    async def generate_e2e_test_scenarios(self, user_stories: List[str]) -> Dict[str, str]:
        """Generate E2E test scenarios from user stories"""
        scenarios = {}
        
        for story in user_stories:
            prompt = f"""
            Generate a Playwright E2E test for the following user story:
            
            {story}
            
            Use the RoverControlPage page object model and include:
            1. Setup and authentication
            2. User actions with realistic timing
            3. Assertions for expected behavior
            4. Error handling and recovery
            5. Cleanup
            """
            
            test_code = await self.mcp.generate_e2e_test(prompt)
            scenario_name = story.split("\n")[0].lower().replace(" ", "_")
            scenarios[scenario_name] = test_code
            
        return scenarios
```

## Recommended Testing Architecture

### 1. **Test Organization Best Practices**
```
tests/
├── unit/              # Fast, isolated tests
├── integration/       # Component integration tests  
├── e2e/              # Full user journey tests
├── performance/      # Load and stress tests
├── security/         # Security-focused tests
├── fixtures/         # Shared test data and mocks
├── helpers/          # Test utilities
└── reports/          # Test results and analysis
```

### 2. **Continuous Testing Pipeline**
- Pre-commit: Linting, type checking, unit tests
- PR checks: Full test suite with coverage
- Main branch: Performance and security tests
- Nightly: Full regression with visual tests
- Weekly: Chaos engineering and load tests

### 3. **Test Quality Metrics**
- Code coverage: 80% minimum (90% for critical paths)
- Test execution time: <5 minutes for PR checks
- Flaky test rate: <1%
- Test maintainability index
- Mean time to test failure resolution

### 4. **Future Enhancements**
- AI-powered test generation and maintenance
- Self-healing tests with automatic updates
- Predictive test selection based on code changes
- Real-time test impact analysis
- Distributed test execution infrastructure