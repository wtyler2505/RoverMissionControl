"""
Global pytest configuration and fixtures for Rover Mission Control Backend
"""

import asyncio
import os
import tempfile
import json
from typing import AsyncGenerator, Generator, Dict, Any, Optional
from unittest.mock import Mock, AsyncMock, MagicMock, patch
import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import sqlite3
from pathlib import Path

# Import application components
from backend.server import app
from backend.database import get_database
from backend.hardware.manager import HardwareManager
from backend.hardware.mock_adapter import MockAdapter
from backend.websocket.connection_manager import ConnectionManager
from backend.websocket.hardware_websocket import HardwareWebSocketManager
from backend.auth.services import AuthService
from backend.command_queue.command_queue import CommandQueue

# Test database path
TEST_DB_PATH = "test_rover_platform.db"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture(scope="function")
def test_db_path(temp_dir: Path) -> str:
    """Provide a unique test database path for each test."""
    db_path = temp_dir / f"test_db_{os.getpid()}_{id(temp_dir)}.db"
    return str(db_path)


@pytest.fixture(scope="function")
def test_db(test_db_path: str) -> Generator[sqlite3.Connection, None, None]:
    """Create a test database connection with cleanup."""
    # Initialize test database schema
    conn = sqlite3.connect(test_db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    
    # Create basic tables for testing
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS hardware_devices (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            port TEXT,
            status TEXT DEFAULT 'inactive',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS command_history (
            id INTEGER PRIMARY KEY,
            command TEXT NOT NULL,
            device_id INTEGER,
            status TEXT DEFAULT 'pending',
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES hardware_devices (id)
        );
        
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS telemetry_data (
            id INTEGER PRIMARY KEY,
            device_id INTEGER,
            sensor_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES hardware_devices (id)
        );
    """)
    
    conn.commit()
    yield conn
    conn.close()
    
    # Clean up test database file
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest.fixture
def mock_hardware_adapter() -> Mock:
    """Create a mock hardware adapter for testing."""
    adapter = Mock(spec=MockAdapter)
    adapter.is_connected.return_value = True
    adapter.device_type = "mock"
    adapter.port = "/dev/mock0"
    adapter.connect = AsyncMock(return_value=True)
    adapter.disconnect = AsyncMock(return_value=True)
    adapter.send_command = AsyncMock(return_value={"status": "success", "data": "mock_response"})
    adapter.read_data = AsyncMock(return_value={"sensor": "temperature", "value": 25.5, "unit": "°C"})
    adapter.get_status = AsyncMock(return_value={"connected": True, "health": "good"})
    return adapter


@pytest.fixture
def mock_hardware_manager(mock_hardware_adapter: Mock) -> Mock:
    """Create a mock hardware manager with registered adapters."""
    manager = Mock(spec=HardwareManager)
    manager.adapters = {"mock_device": mock_hardware_adapter}
    manager.get_adapter = Mock(return_value=mock_hardware_adapter)
    manager.discover_devices = AsyncMock(return_value=["mock_device"])
    manager.connect_all = AsyncMock(return_value=True)
    manager.disconnect_all = AsyncMock(return_value=True)
    manager.get_device_status = AsyncMock(return_value={"mock_device": {"connected": True}})
    return manager


@pytest.fixture
def mock_websocket_manager() -> Mock:
    """Create a mock WebSocket connection manager."""
    manager = Mock(spec=ConnectionManager)
    manager.active_connections = []
    manager.connect = AsyncMock()
    manager.disconnect = AsyncMock()
    manager.send_personal_message = AsyncMock()
    manager.broadcast = AsyncMock()
    manager.send_hardware_update = AsyncMock()
    return manager


@pytest.fixture
def mock_auth_service() -> Mock:
    """Create a mock authentication service."""
    auth_service = Mock(spec=AuthService)
    auth_service.authenticate_user = AsyncMock(return_value={"id": 1, "username": "testuser"})
    auth_service.create_access_token = Mock(return_value="test_token")
    auth_service.verify_token = Mock(return_value={"user_id": 1, "username": "testuser"})
    auth_service.hash_password = Mock(return_value="hashed_password")
    auth_service.verify_password = Mock(return_value=True)
    return auth_service


@pytest.fixture
def mock_command_queue() -> Mock:
    """Create a mock command queue for testing."""
    queue = Mock(spec=CommandQueue)
    queue.add_command = AsyncMock(return_value="cmd_123")
    queue.execute_command = AsyncMock(return_value={"status": "completed"})
    queue.cancel_command = AsyncMock(return_value=True)
    queue.get_command_status = AsyncMock(return_value="completed")
    queue.get_command_history = AsyncMock(return_value=[])
    return queue


@pytest.fixture
def test_app(
    test_db: sqlite3.Connection,
    mock_hardware_manager: Mock,
    mock_websocket_manager: Mock,
    mock_auth_service: Mock,
    mock_command_queue: Mock
) -> FastAPI:
    """Create a test FastAPI application with mocked dependencies."""
    test_app = FastAPI(title="Test Rover Mission Control API")
    
    # Override dependencies with mocks
    test_app.dependency_overrides[get_database] = lambda: test_db
    test_app.dependency_overrides[HardwareManager] = lambda: mock_hardware_manager
    test_app.dependency_overrides[ConnectionManager] = lambda: mock_websocket_manager
    test_app.dependency_overrides[AuthService] = lambda: mock_auth_service
    test_app.dependency_overrides[CommandQueue] = lambda: mock_command_queue
    
    # Include routes from main app
    for route in app.routes:
        test_app.routes.append(route)
    
    return test_app


@pytest.fixture
def client(test_app: FastAPI) -> Generator[TestClient, None, None]:
    """Create a test client for synchronous API testing."""
    with TestClient(test_app) as test_client:
        yield test_client


@pytest_asyncio.fixture
async def async_client(test_app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client for asynchronous API testing."""
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_telemetry_data() -> Dict[str, Any]:
    """Generate sample telemetry data for testing."""
    return {
        "device_id": "rover_01",
        "timestamp": "2024-01-01T12:00:00Z",
        "sensors": {
            "temperature": {"value": 25.5, "unit": "°C"},
            "humidity": {"value": 65.2, "unit": "%"},
            "battery": {"value": 89, "unit": "%"},
            "gps": {
                "latitude": 40.7128,
                "longitude": -74.0060,
                "altitude": 10.5,
                "unit": "degrees"
            }
        },
        "actuators": {
            "motor_left": {"speed": 50, "unit": "%"},
            "motor_right": {"speed": 50, "unit": "%"},
            "camera_pan": {"angle": 0, "unit": "degrees"},
            "camera_tilt": {"angle": 15, "unit": "degrees"}
        }
    }


@pytest.fixture
def sample_command_data() -> Dict[str, Any]:
    """Generate sample command data for testing."""
    return {
        "command": "move_forward",
        "parameters": {
            "distance": 10,
            "speed": 0.5,
            "duration": 20
        },
        "priority": "normal",
        "timeout": 30
    }


@pytest.fixture
def mock_serial_port() -> Mock:
    """Create a mock serial port for hardware testing."""
    mock_port = Mock()
    mock_port.is_open = True
    mock_port.port = "/dev/ttyUSB0"
    mock_port.baudrate = 9600
    mock_port.write = Mock(return_value=10)
    mock_port.read = Mock(return_value=b"OK\n")
    mock_port.readline = Mock(return_value=b"sensor_data:25.5\n")
    mock_port.in_waiting = 0
    mock_port.close = Mock()
    return mock_port


@pytest.fixture
def hardware_test_data() -> Dict[str, Any]:
    """Generate hardware test data."""
    return {
        "devices": [
            {
                "id": "arduino_uno_01",
                "type": "arduino",
                "port": "/dev/ttyUSB0",
                "baudrate": 9600,
                "sensors": ["temperature", "humidity", "light"],
                "actuators": ["motor", "servo", "led"]
            },
            {
                "id": "raspberry_pi_01", 
                "type": "raspberry_pi",
                "port": "192.168.1.100",
                "protocol": "tcp",
                "sensors": ["camera", "gps", "accelerometer"],
                "actuators": ["display", "speaker"]
            }
        ],
        "commands": [
            {"name": "get_temperature", "type": "query"},
            {"name": "move_forward", "type": "action", "parameters": ["distance", "speed"]},
            {"name": "capture_image", "type": "action", "parameters": ["resolution", "format"]},
            {"name": "emergency_stop", "type": "emergency", "parameters": []}
        ]
    }


@pytest.fixture
def websocket_test_messages() -> Dict[str, Any]:
    """Generate WebSocket test messages."""
    return {
        "connect": {"type": "connect", "client_id": "test_client_01"},
        "telemetry_request": {"type": "subscribe", "channel": "telemetry"},
        "command_request": {
            "type": "command",
            "command": "move_forward",
            "parameters": {"distance": 5, "speed": 0.3}
        },
        "heartbeat": {"type": "ping", "timestamp": "2024-01-01T12:00:00Z"},
        "disconnect": {"type": "disconnect", "client_id": "test_client_01"}
    }


@pytest.fixture
def test_user_data() -> Dict[str, Any]:
    """Generate test user data."""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "TestPassword123!",
        "is_active": True,
        "permissions": ["read", "write", "execute"]
    }


# Performance testing fixtures
@pytest.fixture
def performance_test_config() -> Dict[str, Any]:
    """Configuration for performance tests."""
    return {
        "max_response_time": 1.0,  # seconds
        "max_memory_usage": 100,   # MB
        "concurrent_requests": 10,
        "test_duration": 30,       # seconds
        "acceptable_error_rate": 0.01  # 1%
    }


# Database seeding fixtures
@pytest.fixture
def seed_test_data(test_db: sqlite3.Connection) -> None:
    """Seed the test database with sample data."""
    cursor = test_db.cursor()
    
    # Insert sample hardware devices
    cursor.execute("""
        INSERT INTO hardware_devices (name, type, port, status)
        VALUES (?, ?, ?, ?)
    """, ("Arduino Uno", "arduino", "/dev/ttyUSB0", "active"))
    
    cursor.execute("""
        INSERT INTO hardware_devices (name, type, port, status)
        VALUES (?, ?, ?, ?)
    """, ("Raspberry Pi", "raspberry_pi", "192.168.1.100", "active"))
    
    # Insert sample users
    cursor.execute("""
        INSERT INTO users (username, email, hashed_password, is_active)
        VALUES (?, ?, ?, ?)
    """, ("admin", "admin@rover.com", "hashed_admin_password", 1))
    
    cursor.execute("""
        INSERT INTO users (username, email, hashed_password, is_active)
        VALUES (?, ?, ?, ?)
    """, ("operator", "operator@rover.com", "hashed_operator_password", 1))
    
    test_db.commit()


# Cleanup fixture
@pytest.fixture(autouse=True)
def cleanup_test_environment():
    """Automatically clean up test environment after each test."""
    yield
    # Cleanup code runs after each test
    # Close any open connections, clear caches, reset singletons, etc.
    pass


# Mock external services
@pytest.fixture
def mock_external_api():
    """Mock external API calls."""
    with patch('httpx.AsyncClient') as mock_client:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "success", "data": "mocked"}
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value.post.return_value = mock_response
        yield mock_client