"""
Testing utilities and helpers for Rover Mission Control Backend
"""

import asyncio
import json
import time
import tempfile
import shutil
from typing import Dict, Any, List, Optional, Callable
from unittest.mock import Mock, AsyncMock, patch
from pathlib import Path
import sqlite3
import threading
import queue
import contextlib
import psutil
import os

# Test data generators
class TestDataGenerator:
    """Generate realistic test data for various components."""
    
    @staticmethod
    def telemetry_data(device_id: str = "rover_01", num_sensors: int = 5) -> Dict[str, Any]:
        """Generate realistic telemetry data."""
        import random
        
        sensors = {}
        sensor_types = ["temperature", "humidity", "pressure", "battery", "gps", "accelerometer", "gyroscope"]
        
        for i, sensor_type in enumerate(sensor_types[:num_sensors]):
            if sensor_type == "temperature":
                sensors[sensor_type] = {"value": random.uniform(-10, 50), "unit": "°C"}
            elif sensor_type == "humidity":
                sensors[sensor_type] = {"value": random.uniform(0, 100), "unit": "%"}
            elif sensor_type == "pressure":
                sensors[sensor_type] = {"value": random.uniform(900, 1100), "unit": "hPa"}
            elif sensor_type == "battery":
                sensors[sensor_type] = {"value": random.uniform(0, 100), "unit": "%"}
            elif sensor_type == "gps":
                sensors[sensor_type] = {
                    "latitude": random.uniform(-90, 90),
                    "longitude": random.uniform(-180, 180),
                    "altitude": random.uniform(0, 1000),
                    "unit": "degrees"
                }
            elif sensor_type == "accelerometer":
                sensors[sensor_type] = {
                    "x": random.uniform(-10, 10),
                    "y": random.uniform(-10, 10),
                    "z": random.uniform(-10, 10),
                    "unit": "m/s²"
                }
            elif sensor_type == "gyroscope":
                sensors[sensor_type] = {
                    "x": random.uniform(-360, 360),
                    "y": random.uniform(-360, 360),
                    "z": random.uniform(-360, 360),
                    "unit": "°/s"
                }
        
        return {
            "device_id": device_id,
            "timestamp": time.time(),
            "sensors": sensors
        }
    
    @staticmethod
    def command_data(command_type: str = "move_forward") -> Dict[str, Any]:
        """Generate realistic command data."""
        import random
        
        commands = {
            "move_forward": {
                "command": "move_forward",
                "parameters": {
                    "distance": random.uniform(1, 10),
                    "speed": random.uniform(0.1, 1.0)
                },
                "priority": random.choice(["low", "normal", "high"]),
                "timeout": random.randint(10, 60)
            },
            "rotate": {
                "command": "rotate",
                "parameters": {
                    "angle": random.uniform(-180, 180),
                    "speed": random.uniform(0.1, 0.5)
                },
                "priority": "normal",
                "timeout": 30
            },
            "capture_image": {
                "command": "capture_image",
                "parameters": {
                    "resolution": random.choice(["640x480", "1280x720", "1920x1080"]),
                    "format": random.choice(["jpg", "png"])
                },
                "priority": "normal",
                "timeout": 15
            },
            "emergency_stop": {
                "command": "emergency_stop",
                "parameters": {},
                "priority": "critical",
                "timeout": 5
            }
        }
        
        return commands.get(command_type, commands["move_forward"])
    
    @staticmethod
    def hardware_device_config(device_type: str = "mock") -> Dict[str, Any]:
        """Generate hardware device configuration."""
        import random
        
        configs = {
            "mock": {
                "device_id": f"mock_device_{random.randint(1000, 9999)}",
                "type": "mock",
                "port": f"/dev/mock{random.randint(0, 10)}",
                "parameters": {
                    "simulate_latency": random.uniform(0.01, 0.1),
                    "simulate_failure": False,
                    "response_format": "json"
                }
            },
            "serial": {
                "device_id": f"arduino_{random.randint(1000, 9999)}",
                "type": "serial",
                "port": f"/dev/ttyUSB{random.randint(0, 3)}",
                "parameters": {
                    "baudrate": random.choice([9600, 115200, 230400]),
                    "timeout": random.uniform(1.0, 5.0),
                    "databits": 8,
                    "stopbits": 1,
                    "parity": "none"
                }
            },
            "network": {
                "device_id": f"raspberry_pi_{random.randint(1000, 9999)}",
                "type": "network",
                "port": f"192.168.1.{random.randint(100, 200)}",
                "parameters": {
                    "protocol": random.choice(["tcp", "udp"]),
                    "port_number": random.choice([8080, 9090, 5000]),
                    "timeout": random.uniform(5.0, 30.0)
                }
            }
        }
        
        return configs.get(device_type, configs["mock"])
    
    @staticmethod
    def user_data(username: str = None) -> Dict[str, Any]:
        """Generate user test data."""
        import random
        import string
        
        if not username:
            username = f"testuser_{''.join(random.choices(string.ascii_lowercase, k=6))}"
        
        return {
            "username": username,
            "email": f"{username}@test.com",
            "password": "TestPassword123!",
            "is_active": True,
            "permissions": random.sample(["read", "write", "execute", "admin"], 
                                       random.randint(1, 4))
        }


class DatabaseTestHelper:
    """Helper for database testing operations."""
    
    def __init__(self, db_connection: sqlite3.Connection):
        self.db = db_connection
    
    def insert_test_telemetry(self, count: int = 100, device_id: int = 1) -> None:
        """Insert test telemetry data."""
        cursor = self.db.cursor()
        
        for i in range(count):
            cursor.execute("""
                INSERT INTO telemetry_data (device_id, sensor_type, value, unit, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (device_id, f"sensor_{i % 10}", float(i % 100), "unit", 
                  f"2024-01-01 12:{i // 60:02d}:{i % 60:02d}"))
        
        self.db.commit()
    
    def insert_test_devices(self, count: int = 5) -> List[int]:
        """Insert test hardware devices."""
        cursor = self.db.cursor()
        device_ids = []
        
        for i in range(count):
            cursor.execute("""
                INSERT INTO hardware_devices (name, type, port, status)
                VALUES (?, ?, ?, ?)
            """, (f"Device_{i}", f"type_{i % 3}", f"/dev/test{i}", "active"))
            device_ids.append(cursor.lastrowid)
        
        self.db.commit()
        return device_ids
    
    def insert_test_users(self, count: int = 3) -> List[int]:
        """Insert test users."""
        cursor = self.db.cursor()
        user_ids = []
        
        for i in range(count):
            user_data = TestDataGenerator.user_data(f"testuser_{i}")
            cursor.execute("""
                INSERT INTO users (username, email, hashed_password, is_active)
                VALUES (?, ?, ?, ?)
            """, (user_data["username"], user_data["email"], 
                  f"hashed_{user_data['password']}", 1))
            user_ids.append(cursor.lastrowid)
        
        self.db.commit()
        return user_ids
    
    def count_records(self, table: str) -> int:
        """Count records in a table."""
        cursor = self.db.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        return cursor.fetchone()[0]
    
    def clear_table(self, table: str) -> None:
        """Clear all records from a table."""
        cursor = self.db.cursor()
        cursor.execute(f"DELETE FROM {table}")
        self.db.commit()


class PerformanceProfiler:
    """Profile performance of test operations."""
    
    def __init__(self):
        self.metrics = {}
        self.start_times = {}
    
    def start_timer(self, operation: str) -> None:
        """Start timing an operation."""
        self.start_times[operation] = time.time()
    
    def end_timer(self, operation: str) -> float:
        """End timing an operation and return duration."""
        if operation not in self.start_times:
            raise ValueError(f"Timer for '{operation}' was not started")
        
        duration = time.time() - self.start_times[operation]
        if operation not in self.metrics:
            self.metrics[operation] = []
        self.metrics[operation].append(duration)
        
        del self.start_times[operation]
        return duration
    
    @contextlib.contextmanager
    def time_operation(self, operation: str):
        """Context manager for timing operations."""
        self.start_timer(operation)
        try:
            yield
        finally:
            self.end_timer(operation)
    
    def get_statistics(self, operation: str) -> Dict[str, float]:
        """Get statistics for an operation."""
        if operation not in self.metrics:
            return {}
        
        times = self.metrics[operation]
        return {
            "count": len(times),
            "total": sum(times),
            "average": sum(times) / len(times),
            "min": min(times),
            "max": max(times)
        }
    
    def reset(self) -> None:
        """Reset all metrics."""
        self.metrics.clear()
        self.start_times.clear()


class MockHardwareSimulator:
    """Simulate hardware responses for testing."""
    
    def __init__(self):
        self.devices = {}
        self.response_delay = 0.01  # 10ms default delay
        self.failure_rate = 0.0     # No failures by default
    
    def add_device(self, device_id: str, device_type: str, responses: Dict[str, Any]) -> None:
        """Add a simulated device."""
        self.devices[device_id] = {
            "type": device_type,
            "responses": responses,
            "connected": False,
            "command_count": 0
        }
    
    async def simulate_connect(self, device_id: str) -> bool:
        """Simulate device connection."""
        await asyncio.sleep(self.response_delay)
        
        if device_id in self.devices:
            # Simulate connection failure
            if self._should_fail():
                return False
            
            self.devices[device_id]["connected"] = True
            return True
        return False
    
    async def simulate_command(self, device_id: str, command: str) -> Dict[str, Any]:
        """Simulate command execution."""
        await asyncio.sleep(self.response_delay)
        
        if device_id not in self.devices:
            raise ValueError(f"Device {device_id} not found")
        
        device = self.devices[device_id]
        if not device["connected"]:
            raise ConnectionError(f"Device {device_id} not connected")
        
        # Simulate command failure
        if self._should_fail():
            raise Exception(f"Command {command} failed")
        
        device["command_count"] += 1
        
        # Return predefined response or default
        responses = device["responses"]
        if command in responses:
            return responses[command]
        else:
            return {"status": "success", "command": command, "response": "OK"}
    
    async def simulate_data_read(self, device_id: str) -> Dict[str, Any]:
        """Simulate reading data from device."""
        await asyncio.sleep(self.response_delay)
        
        if device_id not in self.devices:
            raise ValueError(f"Device {device_id} not found")
        
        device = self.devices[device_id]
        if not device["connected"]:
            raise ConnectionError(f"Device {device_id} not connected")
        
        # Generate simulated sensor data
        return TestDataGenerator.telemetry_data(device_id)
    
    def set_failure_rate(self, rate: float) -> None:
        """Set the failure rate (0.0 to 1.0)."""
        self.failure_rate = max(0.0, min(1.0, rate))
    
    def set_response_delay(self, delay: float) -> None:
        """Set the response delay in seconds."""
        self.response_delay = max(0.0, delay)
    
    def _should_fail(self) -> bool:
        """Determine if operation should fail based on failure rate."""
        import random
        return random.random() < self.failure_rate


class WebSocketTestHelper:
    """Helper for WebSocket testing."""
    
    def __init__(self):
        self.messages = []
        self.connections = []
    
    def create_mock_websocket(self) -> Mock:
        """Create a mock WebSocket connection."""
        mock_ws = Mock()
        mock_ws.send_json = Mock()
        mock_ws.receive_json = Mock()
        mock_ws.send_text = Mock()
        mock_ws.receive_text = Mock()
        mock_ws.send_bytes = Mock()
        mock_ws.receive_bytes = Mock()
        mock_ws.close = AsyncMock()
        
        self.connections.append(mock_ws)
        return mock_ws
    
    def simulate_message_exchange(self, websocket: Mock, messages: List[Dict[str, Any]]) -> None:
        """Simulate a series of WebSocket message exchanges."""
        responses = []
        
        for i, message in enumerate(messages):
            # Create response based on message type
            if message.get("type") == "ping":
                response = {"type": "pong", "timestamp": time.time()}
            elif message.get("type") == "subscribe":
                response = {"type": "subscription_confirmed", "channel": message.get("channel")}
            elif message.get("type") == "command":
                response = {"type": "command_ack", "command_id": f"cmd_{i}"}
            else:
                response = {"type": "ack", "message_id": i}
            
            responses.append(response)
        
        # Configure mock to return responses
        websocket.receive_json.side_effect = responses
        websocket.send_json.side_effect = lambda msg: self.messages.append(msg)
    
    def get_sent_messages(self) -> List[Dict[str, Any]]:
        """Get all messages that were sent."""
        return self.messages.copy()
    
    def clear_messages(self) -> None:
        """Clear the message history."""
        self.messages.clear()


class SystemResourceMonitor:
    """Monitor system resources during tests."""
    
    def __init__(self):
        self.monitoring = False
        self.metrics = {
            "memory": [],
            "cpu": [],
            "disk_io": [],
            "network_io": []
        }
        self.monitor_thread = None
    
    def start_monitoring(self, interval: float = 1.0) -> None:
        """Start monitoring system resources."""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,),
            daemon=True
        )
        self.monitor_thread.start()
    
    def stop_monitoring(self) -> Dict[str, Any]:
        """Stop monitoring and return collected metrics."""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5.0)
        
        return self._calculate_statistics()
    
    def _monitor_loop(self, interval: float) -> None:
        """Main monitoring loop."""
        process = psutil.Process(os.getpid())
        
        while self.monitoring:
            try:
                # Memory usage
                memory_info = process.memory_info()
                self.metrics["memory"].append(memory_info.rss / 1024 / 1024)  # MB
                
                # CPU usage
                cpu_percent = process.cpu_percent()
                self.metrics["cpu"].append(cpu_percent)
                
                # Disk I/O
                io_counters = process.io_counters()
                self.metrics["disk_io"].append({
                    "read_bytes": io_counters.read_bytes,
                    "write_bytes": io_counters.write_bytes
                })
                
                # Network I/O (if available)
                try:
                    net_io = psutil.net_io_counters()
                    self.metrics["network_io"].append({
                        "bytes_sent": net_io.bytes_sent,
                        "bytes_recv": net_io.bytes_recv
                    })
                except:
                    pass
                
                time.sleep(interval)
            except Exception:
                # Continue monitoring even if some metrics fail
                pass
    
    def _calculate_statistics(self) -> Dict[str, Any]:
        """Calculate statistics from collected metrics."""
        stats = {}
        
        # Memory statistics
        if self.metrics["memory"]:
            memory_values = self.metrics["memory"]
            stats["memory"] = {
                "min": min(memory_values),
                "max": max(memory_values),
                "avg": sum(memory_values) / len(memory_values),
                "samples": len(memory_values)
            }
        
        # CPU statistics
        if self.metrics["cpu"]:
            cpu_values = self.metrics["cpu"]
            stats["cpu"] = {
                "min": min(cpu_values),
                "max": max(cpu_values),
                "avg": sum(cpu_values) / len(cpu_values),
                "samples": len(cpu_values)
            }
        
        return stats


# Test decorators
def timeout_test(seconds: int):
    """Decorator to add timeout to test functions."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = None
            exception = None
            
            def target():
                nonlocal result, exception
                try:
                    result = func(*args, **kwargs)
                except Exception as e:
                    exception = e
            
            thread = threading.Thread(target=target)
            thread.start()
            thread.join(timeout=seconds)
            
            if thread.is_alive():
                raise TimeoutError(f"Test {func.__name__} timed out after {seconds} seconds")
            
            if exception:
                raise exception
            
            return result
        return wrapper
    return decorator


def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """Decorator to retry test functions on failure."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries:
                        time.sleep(delay)
                        continue
                    else:
                        raise last_exception
        return wrapper
    return decorator


# Context managers for testing
@contextlib.contextmanager
def temporary_file(content: str = "", suffix: str = ".tmp"):
    """Create a temporary file for testing."""
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix=suffix) as f:
        f.write(content)
        temp_path = f.name
    
    try:
        yield temp_path
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@contextlib.contextmanager
def temporary_directory():
    """Create a temporary directory for testing."""
    temp_dir = tempfile.mkdtemp()
    try:
        yield Path(temp_dir)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@contextlib.contextmanager
def mock_environment_variables(**kwargs):
    """Temporarily set environment variables for testing."""
    old_values = {}
    
    # Save old values and set new ones
    for key, value in kwargs.items():
        old_values[key] = os.environ.get(key)
        os.environ[key] = str(value)
    
    try:
        yield
    finally:
        # Restore old values
        for key, old_value in old_values.items():
            if old_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old_value


# Assertion helpers
def assert_response_time(func: Callable, max_time: float, *args, **kwargs):
    """Assert that a function completes within the specified time."""
    start_time = time.time()
    result = func(*args, **kwargs)
    end_time = time.time()
    
    actual_time = end_time - start_time
    assert actual_time <= max_time, f"Operation took {actual_time:.3f}s, expected <= {max_time:.3f}s"
    
    return result


def assert_memory_usage(func: Callable, max_memory_mb: float, *args, **kwargs):
    """Assert that a function doesn't use more than specified memory."""
    import psutil
    
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / 1024 / 1024
    
    result = func(*args, **kwargs)
    
    final_memory = process.memory_info().rss / 1024 / 1024
    memory_used = final_memory - initial_memory
    
    assert memory_used <= max_memory_mb, f"Operation used {memory_used:.2f}MB, expected <= {max_memory_mb}MB"
    
    return result