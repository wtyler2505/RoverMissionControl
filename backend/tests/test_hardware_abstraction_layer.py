"""
Comprehensive Hardware Abstraction Layer (HAL) testing for Rover Mission Control
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional
import serial
import time
import json

# Import HAL components
from backend.hardware.base import BaseAdapter
from backend.hardware.mock_adapter import MockAdapter
from backend.hardware.serial_adapter import SerialAdapter
from backend.hardware.manager import HardwareManager
from backend.hardware.factory import AdapterFactory
from backend.hardware.discovery import DeviceDiscovery

pytestmark = pytest.mark.hardware


class TestBaseAdapter:
    """Test the base hardware adapter functionality."""
    
    def test_base_adapter_initialization(self):
        """Test base adapter initialization."""
        adapter = BaseAdapter(device_id="test_device", port="/dev/ttyUSB0")
        assert adapter.device_id == "test_device"
        assert adapter.port == "/dev/ttyUSB0"
        assert adapter.is_connected() is False
    
    @pytest.mark.asyncio
    async def test_base_adapter_abstract_methods(self):
        """Test that base adapter abstract methods raise NotImplementedError."""
        adapter = BaseAdapter(device_id="test_device", port="/dev/ttyUSB0")
        
        with pytest.raises(NotImplementedError):
            await adapter.connect()
        
        with pytest.raises(NotImplementedError):
            await adapter.disconnect()
        
        with pytest.raises(NotImplementedError):
            await adapter.send_command("test_command")
        
        with pytest.raises(NotImplementedError):
            await adapter.read_data()
    
    def test_base_adapter_str_representation(self):
        """Test base adapter string representation."""
        adapter = BaseAdapter(device_id="test_device", port="/dev/ttyUSB0")
        str_repr = str(adapter)
        assert "test_device" in str_repr
        assert "/dev/ttyUSB0" in str_repr


class TestMockAdapter:
    """Test the mock hardware adapter."""
    
    def test_mock_adapter_initialization(self):
        """Test mock adapter initialization."""
        adapter = MockAdapter(device_id="mock_device", port="/dev/mock0")
        assert adapter.device_id == "mock_device"
        assert adapter.device_type == "mock"
        assert adapter.is_connected() is False
    
    @pytest.mark.asyncio
    async def test_mock_adapter_connection(self):
        """Test mock adapter connection and disconnection."""
        adapter = MockAdapter(device_id="mock_device", port="/dev/mock0")
        
        # Test connection
        result = await adapter.connect()
        assert result is True
        assert adapter.is_connected() is True
        
        # Test disconnection
        result = await adapter.disconnect()
        assert result is True
        assert adapter.is_connected() is False
    
    @pytest.mark.asyncio
    async def test_mock_adapter_send_command(self):
        """Test sending commands to mock adapter."""
        adapter = MockAdapter(device_id="mock_device", port="/dev/mock0")
        await adapter.connect()
        
        # Test basic command
        result = await adapter.send_command("test_command")
        assert "status" in result
        assert result["status"] == "success"
        
        # Test command with parameters
        result = await adapter.send_command("move", {"distance": 10, "speed": 0.5})
        assert "status" in result
        assert "echo" in result
    
    @pytest.mark.asyncio
    async def test_mock_adapter_read_data(self):
        """Test reading data from mock adapter."""
        adapter = MockAdapter(device_id="mock_device", port="/dev/mock0")
        await adapter.connect()
        
        data = await adapter.read_data()
        assert isinstance(data, dict)
        assert "timestamp" in data
        assert "sensors" in data
    
    @pytest.mark.asyncio
    async def test_mock_adapter_failure_simulation(self):
        """Test mock adapter failure simulation."""
        adapter = MockAdapter(device_id="mock_device", port="/dev/mock0")
        adapter.simulate_failure = True
        
        with pytest.raises(Exception):
            await adapter.connect()
    
    @pytest.mark.asyncio
    async def test_mock_adapter_latency_simulation(self):
        """Test mock adapter latency simulation."""
        adapter = MockAdapter(device_id="mock_device", port="/dev/mock0")
        adapter.simulate_latency = 0.1  # 100ms latency
        await adapter.connect()
        
        start_time = time.time()
        await adapter.send_command("test")
        end_time = time.time()
        
        assert (end_time - start_time) >= 0.1


class TestSerialAdapter:
    """Test the serial hardware adapter."""
    
    @patch('serial.Serial')
    def test_serial_adapter_initialization(self, mock_serial):
        """Test serial adapter initialization."""
        adapter = SerialAdapter(
            device_id="arduino_uno",
            port="/dev/ttyUSB0",
            baudrate=9600
        )
        assert adapter.device_id == "arduino_uno"
        assert adapter.port == "/dev/ttyUSB0"
        assert adapter.baudrate == 9600
        assert adapter.device_type == "serial"
    
    @patch('serial.Serial')
    @pytest.mark.asyncio
    async def test_serial_adapter_connection(self, mock_serial):
        """Test serial adapter connection."""
        mock_port = Mock()
        mock_port.is_open = True
        mock_serial.return_value = mock_port
        
        adapter = SerialAdapter(device_id="arduino_uno", port="/dev/ttyUSB0")
        result = await adapter.connect()
        
        assert result is True
        assert adapter.is_connected() is True
        mock_serial.assert_called_once()
    
    @patch('serial.Serial')
    @pytest.mark.asyncio
    async def test_serial_adapter_connection_failure(self, mock_serial):
        """Test serial adapter connection failure."""
        mock_serial.side_effect = serial.SerialException("Port not available")
        
        adapter = SerialAdapter(device_id="arduino_uno", port="/dev/ttyUSB0")
        result = await adapter.connect()
        
        assert result is False
        assert adapter.is_connected() is False
    
    @patch('serial.Serial')
    @pytest.mark.asyncio
    async def test_serial_adapter_send_command(self, mock_serial):
        """Test sending commands via serial adapter."""
        mock_port = Mock()
        mock_port.is_open = True
        mock_port.write.return_value = 10
        mock_port.readline.return_value = b"OK\n"
        mock_serial.return_value = mock_port
        
        adapter = SerialAdapter(device_id="arduino_uno", port="/dev/ttyUSB0")
        await adapter.connect()
        
        result = await adapter.send_command("LED_ON")
        assert "response" in result
        assert result["response"] == "OK"
        mock_port.write.assert_called_once()
    
    @patch('serial.Serial')
    @pytest.mark.asyncio
    async def test_serial_adapter_read_data(self, mock_serial):
        """Test reading data via serial adapter."""
        mock_port = Mock()
        mock_port.is_open = True
        mock_port.in_waiting = 20
        mock_port.readline.return_value = b'{"temperature": 25.5, "humidity": 60.2}\n'
        mock_serial.return_value = mock_port
        
        adapter = SerialAdapter(device_id="arduino_uno", port="/dev/ttyUSB0")
        await adapter.connect()
        
        data = await adapter.read_data()
        assert "temperature" in data
        assert data["temperature"] == 25.5
    
    @patch('serial.Serial')
    @pytest.mark.asyncio
    async def test_serial_adapter_timeout_handling(self, mock_serial):
        """Test serial adapter timeout handling."""
        mock_port = Mock()
        mock_port.is_open = True
        mock_port.readline.side_effect = serial.SerialTimeoutException("Timeout")
        mock_serial.return_value = mock_port
        
        adapter = SerialAdapter(device_id="arduino_uno", port="/dev/ttyUSB0", timeout=1.0)
        await adapter.connect()
        
        with pytest.raises(Exception):
            await adapter.send_command("SLOW_COMMAND")


class TestHardwareManager:
    """Test the hardware manager functionality."""
    
    def test_hardware_manager_initialization(self):
        """Test hardware manager initialization."""
        manager = HardwareManager()
        assert isinstance(manager.adapters, dict)
        assert len(manager.adapters) == 0
    
    @pytest.mark.asyncio
    async def test_hardware_manager_register_adapter(self):
        """Test registering adapters with hardware manager."""
        manager = HardwareManager()
        adapter = MockAdapter(device_id="test_device", port="/dev/mock0")
        
        manager.register_adapter("test_device", adapter)
        assert "test_device" in manager.adapters
        assert manager.adapters["test_device"] == adapter
    
    @pytest.mark.asyncio
    async def test_hardware_manager_get_adapter(self):
        """Test getting adapters from hardware manager."""
        manager = HardwareManager()
        adapter = MockAdapter(device_id="test_device", port="/dev/mock0")
        manager.register_adapter("test_device", adapter)
        
        retrieved_adapter = manager.get_adapter("test_device")
        assert retrieved_adapter == adapter
        
        # Test non-existent adapter
        non_existent = manager.get_adapter("non_existent")
        assert non_existent is None
    
    @pytest.mark.asyncio
    async def test_hardware_manager_connect_all(self):
        """Test connecting all registered adapters."""
        manager = HardwareManager()
        
        # Register multiple adapters
        adapter1 = MockAdapter(device_id="device1", port="/dev/mock0")
        adapter2 = MockAdapter(device_id="device2", port="/dev/mock1")
        manager.register_adapter("device1", adapter1)
        manager.register_adapter("device2", adapter2)
        
        # Connect all
        results = await manager.connect_all()
        assert len(results) == 2
        assert all(result is True for result in results.values())
        assert adapter1.is_connected()
        assert adapter2.is_connected()
    
    @pytest.mark.asyncio
    async def test_hardware_manager_disconnect_all(self):
        """Test disconnecting all registered adapters."""
        manager = HardwareManager()
        
        # Register and connect adapters
        adapter1 = MockAdapter(device_id="device1", port="/dev/mock0")
        adapter2 = MockAdapter(device_id="device2", port="/dev/mock1")
        manager.register_adapter("device1", adapter1)
        manager.register_adapter("device2", adapter2)
        await manager.connect_all()
        
        # Disconnect all
        results = await manager.disconnect_all()
        assert len(results) == 2
        assert all(result is True for result in results.values())
        assert not adapter1.is_connected()
        assert not adapter2.is_connected()
    
    @pytest.mark.asyncio
    async def test_hardware_manager_send_command_to_device(self):
        """Test sending commands to specific devices."""
        manager = HardwareManager()
        adapter = MockAdapter(device_id="test_device", port="/dev/mock0")
        manager.register_adapter("test_device", adapter)
        await adapter.connect()
        
        result = await manager.send_command("test_device", "test_command")
        assert "status" in result
        assert result["status"] == "success"
    
    @pytest.mark.asyncio
    async def test_hardware_manager_broadcast_command(self):
        """Test broadcasting commands to all devices."""
        manager = HardwareManager()
        
        # Register multiple adapters
        adapter1 = MockAdapter(device_id="device1", port="/dev/mock0")
        adapter2 = MockAdapter(device_id="device2", port="/dev/mock1")
        manager.register_adapter("device1", adapter1)
        manager.register_adapter("device2", adapter2)
        await manager.connect_all()
        
        # Broadcast command
        results = await manager.broadcast_command("test_command")
        assert len(results) == 2
        assert all("status" in result for result in results.values())
    
    @pytest.mark.asyncio
    async def test_hardware_manager_get_device_status(self):
        """Test getting status of all devices."""
        manager = HardwareManager()
        
        # Register adapters with different states
        adapter1 = MockAdapter(device_id="device1", port="/dev/mock0")
        adapter2 = MockAdapter(device_id="device2", port="/dev/mock1")
        manager.register_adapter("device1", adapter1)
        manager.register_adapter("device2", adapter2)
        await adapter1.connect()  # Only connect first adapter
        
        status = await manager.get_device_status()
        assert "device1" in status
        assert "device2" in status
        assert status["device1"]["connected"] is True
        assert status["device2"]["connected"] is False


class TestAdapterFactory:
    """Test the adapter factory functionality."""
    
    def test_adapter_factory_create_mock_adapter(self):
        """Test creating mock adapter via factory."""
        config = {
            "device_id": "mock_device",
            "type": "mock",
            "port": "/dev/mock0"
        }
        
        adapter = AdapterFactory.create_adapter(config)
        assert isinstance(adapter, MockAdapter)
        assert adapter.device_id == "mock_device"
    
    @patch('serial.Serial')
    def test_adapter_factory_create_serial_adapter(self, mock_serial):
        """Test creating serial adapter via factory."""
        config = {
            "device_id": "arduino_device",
            "type": "serial",
            "port": "/dev/ttyUSB0",
            "baudrate": 9600
        }
        
        adapter = AdapterFactory.create_adapter(config)
        assert isinstance(adapter, SerialAdapter)
        assert adapter.device_id == "arduino_device"
        assert adapter.baudrate == 9600
    
    def test_adapter_factory_invalid_type(self):
        """Test factory handling of invalid adapter types."""
        config = {
            "device_id": "invalid_device",
            "type": "invalid_type",
            "port": "/dev/invalid"
        }
        
        with pytest.raises(ValueError):
            AdapterFactory.create_adapter(config)
    
    def test_adapter_factory_missing_config(self):
        """Test factory handling of missing configuration."""
        config = {
            "device_id": "incomplete_device"
            # Missing type and port
        }
        
        with pytest.raises(KeyError):
            AdapterFactory.create_adapter(config)


class TestDeviceDiscovery:
    """Test the device discovery functionality."""
    
    @patch('serial.tools.list_ports.comports')
    @pytest.mark.asyncio
    async def test_device_discovery_serial_ports(self, mock_comports):
        """Test discovering serial port devices."""
        # Mock serial ports
        mock_port1 = Mock()
        mock_port1.device = "/dev/ttyUSB0"
        mock_port1.description = "Arduino Uno"
        mock_port1.vid = 0x2341  # Arduino VID
        mock_port1.pid = 0x0043  # Arduino Uno PID
        
        mock_port2 = Mock()
        mock_port2.device = "/dev/ttyUSB1"
        mock_port2.description = "CP2102 USB to UART Bridge"
        mock_port2.vid = 0x10C4
        mock_port2.pid = 0xEA60
        
        mock_comports.return_value = [mock_port1, mock_port2]
        
        discovery = DeviceDiscovery()
        devices = await discovery.discover_serial_devices()
        
        assert len(devices) == 2
        assert any(device["port"] == "/dev/ttyUSB0" for device in devices)
        assert any(device["description"] == "Arduino Uno" for device in devices)
    
    @patch('socket.socket')
    @pytest.mark.asyncio
    async def test_device_discovery_network_devices(self, mock_socket):
        """Test discovering network-connected devices."""
        # Mock network scan results
        mock_sock = Mock()
        mock_sock.connect_ex.return_value = 0  # Connection successful
        mock_socket.return_value = mock_sock
        
        discovery = DeviceDiscovery()
        devices = await discovery.discover_network_devices("192.168.1.0/24", [80, 8080])
        
        # Should find devices on open ports
        assert isinstance(devices, list)
    
    @pytest.mark.asyncio
    async def test_device_discovery_combined(self):
        """Test combined device discovery."""
        discovery = DeviceDiscovery()
        
        with patch.object(discovery, 'discover_serial_devices') as mock_serial, \
             patch.object(discovery, 'discover_network_devices') as mock_network:
            
            mock_serial.return_value = [{"type": "serial", "port": "/dev/ttyUSB0"}]
            mock_network.return_value = [{"type": "network", "host": "192.168.1.100"}]
            
            all_devices = await discovery.discover_all_devices()
            
            assert len(all_devices) == 2
            assert any(device["type"] == "serial" for device in all_devices)
            assert any(device["type"] == "network" for device in all_devices)


class TestHardwareFailureScenarios:
    """Test hardware failure and recovery scenarios."""
    
    @pytest.mark.asyncio
    async def test_adapter_connection_retry(self):
        """Test adapter connection retry mechanism."""
        adapter = MockAdapter(device_id="flaky_device", port="/dev/mock0")
        
        # Simulate initial connection failures
        connection_attempts = 0
        original_connect = adapter.connect
        
        async def flaky_connect():
            nonlocal connection_attempts
            connection_attempts += 1
            if connection_attempts < 3:
                raise Exception("Connection failed")
            return await original_connect()
        
        adapter.connect = flaky_connect
        
        # Test retry mechanism
        for attempt in range(5):
            try:
                result = await adapter.connect()
                if result:
                    break
            except Exception:
                if attempt < 4:  # Allow retries
                    await asyncio.sleep(0.1)
                    continue
                raise
        
        assert adapter.is_connected()
        assert connection_attempts == 3
    
    @pytest.mark.asyncio
    async def test_adapter_communication_timeout(self):
        """Test adapter communication timeout handling."""
        adapter = MockAdapter(device_id="slow_device", port="/dev/mock0")
        adapter.simulate_latency = 2.0  # 2 second delay
        await adapter.connect()
        
        # Test command with timeout
        start_time = time.time()
        try:
            result = await asyncio.wait_for(
                adapter.send_command("slow_command"),
                timeout=1.0
            )
        except asyncio.TimeoutError:
            pass  # Expected timeout
        
        end_time = time.time()
        assert (end_time - start_time) < 1.5  # Should timeout around 1 second
    
    @pytest.mark.asyncio
    async def test_adapter_unexpected_disconnection(self):
        """Test handling of unexpected disconnections."""
        adapter = MockAdapter(device_id="unreliable_device", port="/dev/mock0")
        await adapter.connect()
        assert adapter.is_connected()
        
        # Simulate unexpected disconnection
        adapter._connected = False
        
        # Attempt to send command after disconnection
        with pytest.raises(Exception):
            await adapter.send_command("test_command")
    
    @pytest.mark.asyncio
    async def test_hardware_manager_partial_failure(self):
        """Test hardware manager handling partial device failures."""
        manager = HardwareManager()
        
        # Register working and failing adapters
        working_adapter = MockAdapter(device_id="working_device", port="/dev/mock0")
        failing_adapter = MockAdapter(device_id="failing_device", port="/dev/mock1")
        failing_adapter.simulate_failure = True
        
        manager.register_adapter("working_device", working_adapter)
        manager.register_adapter("failing_device", failing_adapter)
        
        # Attempt to connect all
        results = await manager.connect_all()
        
        # Should have mixed results
        assert results["working_device"] is True
        assert results["failing_device"] is False
        assert working_adapter.is_connected()
        assert not failing_adapter.is_connected()


class TestHardwarePerformance:
    """Test hardware performance characteristics."""
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_adapter_command_throughput(self):
        """Test adapter command throughput."""
        adapter = MockAdapter(device_id="performance_device", port="/dev/mock0")
        await adapter.connect()
        
        # Send 100 commands and measure time
        start_time = time.time()
        commands_sent = 0
        
        for i in range(100):
            await adapter.send_command(f"command_{i}")
            commands_sent += 1
        
        end_time = time.time()
        duration = end_time - start_time
        throughput = commands_sent / duration
        
        # Should handle at least 50 commands per second
        assert throughput > 50
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_hardware_manager_concurrent_operations(self):
        """Test hardware manager concurrent operations."""
        manager = HardwareManager()
        
        # Register multiple adapters
        adapters = []
        for i in range(10):
            adapter = MockAdapter(device_id=f"device_{i}", port=f"/dev/mock{i}")
            manager.register_adapter(f"device_{i}", adapter)
            adapters.append(adapter)
        
        # Connect all concurrently
        start_time = time.time()
        await manager.connect_all()
        connect_time = time.time() - start_time
        
        # Send commands concurrently
        start_time = time.time()
        tasks = []
        for i in range(10):
            task = manager.send_command(f"device_{i}", f"test_command_{i}")
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        command_time = time.time() - start_time
        
        # Performance assertions
        assert connect_time < 1.0   # Should connect within 1 second
        assert command_time < 0.5   # Should send commands within 0.5 seconds
        assert all(adapter.is_connected() for adapter in adapters)
    
    @pytest.mark.load
    @pytest.mark.asyncio
    async def test_sustained_hardware_operations(self):
        """Test sustained hardware operations under load."""
        adapter = MockAdapter(device_id="load_test_device", port="/dev/mock0")
        await adapter.connect()
        
        # Run sustained operations for 10 seconds
        start_time = time.time()
        operations_completed = 0
        
        while time.time() - start_time < 10:
            try:
                await adapter.send_command("load_test_command")
                await adapter.read_data()
                operations_completed += 1
            except Exception as e:
                # Log but continue
                print(f"Operation failed: {e}")
        
        # Should complete at least 100 operations in 10 seconds
        assert operations_completed > 100
        assert adapter.is_connected()  # Should still be connected