"""
Tests for Device Discovery Mechanism
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

from ..discovery import (
    DeviceDiscoveryEngine,
    DiscoveredDevice,
    DeviceIdentity,
    DeviceCapability,
    DiscoveryMethod,
    DeviceClass,
    ProtocolType
)
from ..manager import HardwareManager, HardwareDevice


@pytest.fixture
def hardware_manager():
    """Create a mock hardware manager"""
    return HardwareManager()


@pytest.fixture
def discovery_engine(hardware_manager):
    """Create a discovery engine instance"""
    return DeviceDiscoveryEngine(hardware_manager)


@pytest.mark.asyncio
async def test_discovery_engine_initialization(discovery_engine):
    """Test discovery engine initialization"""
    assert discovery_engine is not None
    assert len(discovery_engine._discovered_devices) == 0
    assert len(discovery_engine._discovery_tasks) == 0
    assert discovery_engine._discovery_config['auto_discovery_interval'] == 30.0


@pytest.mark.asyncio
async def test_manual_device_registration(discovery_engine):
    """Test manual device registration"""
    device_data = {
        'protocol_type': 'serial',
        'address': '/dev/ttyUSB0',
        'device_class': 'controller',
        'identity': {
            'manufacturer': 'Arduino',
            'model': 'Uno',
            'serial_number': '12345'
        },
        'capabilities': [
            {
                'name': 'digital_io',
                'category': 'gpio',
                'description': 'Digital I/O pins'
            }
        ]
    }
    
    device_id = await discovery_engine.register_manual_device(device_data)
    
    assert device_id is not None
    assert device_id in discovery_engine._discovered_devices
    
    device = discovery_engine._discovered_devices[device_id]
    assert device.protocol_type == ProtocolType.SERIAL
    assert device.address == '/dev/ttyUSB0'
    assert device.device_class == DeviceClass.CONTROLLER
    assert device.identity.manufacturer == 'Arduino'
    assert len(device.capabilities) == 1


@pytest.mark.asyncio
async def test_device_discovery_serial(discovery_engine):
    """Test serial device discovery"""
    with patch('serial.tools.list_ports.comports') as mock_comports:
        # Mock serial port
        mock_port = Mock()
        mock_port.device = '/dev/ttyUSB0'
        mock_port.description = 'Arduino Uno'
        mock_port.hwid = 'USB VID:PID=2341:0043'
        mock_port.vid = 0x2341
        mock_port.pid = 0x0043
        mock_port.serial_number = '12345'
        mock_port.manufacturer = 'Arduino'
        mock_port.product = 'Arduino Uno'
        mock_port.interface = None
        
        mock_comports.return_value = [mock_port]
        
        devices = await discovery_engine._discover_serial_devices()
        
        assert len(devices) == 1
        device = devices[0]
        assert device.protocol_type == ProtocolType.SERIAL
        assert device.address == '/dev/ttyUSB0'
        assert device.device_class == DeviceClass.CONTROLLER
        assert device.confidence >= 0.9


@pytest.mark.asyncio
async def test_discovered_device_to_hardware_device(discovery_engine):
    """Test conversion from discovered device to hardware device"""
    discovered = DiscoveredDevice(
        device_id='test_device_123',
        protocol_type=ProtocolType.I2C,
        address=0x68,
        discovery_method=DiscoveryMethod.PROBE,
        discovered_at=datetime.utcnow(),
        device_class=DeviceClass.SENSOR,
        identity=DeviceIdentity(
            manufacturer='Invensense',
            model='MPU6050'
        ),
        capabilities=[
            DeviceCapability(
                name='accelerometer',
                category='motion',
                description='3-axis accelerometer'
            )
        ],
        confidence=0.95
    )
    
    hardware_device = discovered.to_hardware_device('i2c_adapter_1', 'Motion Sensor')
    
    assert isinstance(hardware_device, HardwareDevice)
    assert hardware_device.device_id == 'test_device_123'
    assert hardware_device.name == 'Motion Sensor'
    assert hardware_device.protocol_type == ProtocolType.I2C
    assert hardware_device.adapter_id == 'i2c_adapter_1'
    assert hardware_device.address == 0x68
    assert 'accelerometer' in hardware_device.capabilities
    assert hardware_device.metadata['device_class'] == 'sensor'
    assert hardware_device.metadata['discovery']['confidence'] == 0.95


@pytest.mark.asyncio
async def test_discovery_status(discovery_engine):
    """Test getting discovery status"""
    # Add some test devices
    await discovery_engine.register_manual_device({
        'protocol_type': 'serial',
        'device_class': 'controller'
    })
    await discovery_engine.register_manual_device({
        'protocol_type': 'i2c',
        'device_class': 'sensor'
    })
    
    status = discovery_engine.get_discovery_status()
    
    assert status['discovered_devices'] == 2
    assert status['devices_by_protocol']['serial'] == 1
    assert status['devices_by_protocol']['i2c'] == 1
    assert status['devices_by_class']['controller'] == 1
    assert status['devices_by_class']['sensor'] == 1


@pytest.mark.asyncio
async def test_device_filtering(discovery_engine):
    """Test filtering discovered devices"""
    # Add test devices
    await discovery_engine.register_manual_device({
        'protocol_type': 'serial',
        'device_class': 'controller'
    })
    await discovery_engine.register_manual_device({
        'protocol_type': 'i2c',
        'device_class': 'sensor'
    })
    await discovery_engine.register_manual_device({
        'protocol_type': 'i2c',
        'device_class': 'actuator'
    })
    
    # Test protocol filtering
    serial_devices = discovery_engine.get_discovered_devices(protocol=ProtocolType.SERIAL)
    assert len(serial_devices) == 1
    
    i2c_devices = discovery_engine.get_discovered_devices(protocol=ProtocolType.I2C)
    assert len(i2c_devices) == 2
    
    # Test device class filtering
    sensors = discovery_engine.get_discovered_devices(device_class=DeviceClass.SENSOR)
    assert len(sensors) == 1
    
    # Test combined filtering
    i2c_sensors = discovery_engine.get_discovered_devices(
        protocol=ProtocolType.I2C,
        device_class=DeviceClass.SENSOR
    )
    assert len(i2c_sensors) == 1


@pytest.mark.asyncio
async def test_device_removal(discovery_engine):
    """Test removing discovered devices"""
    device_id = await discovery_engine.register_manual_device({
        'protocol_type': 'serial',
        'device_class': 'controller'
    })
    
    assert device_id in discovery_engine._discovered_devices
    
    result = discovery_engine.remove_discovered_device(device_id)
    assert result is True
    assert device_id not in discovery_engine._discovered_devices
    
    # Try removing non-existent device
    result = discovery_engine.remove_discovered_device('non_existent')
    assert result is False


@pytest.mark.asyncio
async def test_event_handling(discovery_engine):
    """Test event emission and handling"""
    events_received = []
    
    def event_handler(event_data):
        events_received.append(event_data)
    
    discovery_engine.register_event_handler('device_discovered', event_handler)
    
    # Trigger a device discovery
    await discovery_engine.register_manual_device({
        'protocol_type': 'serial',
        'device_class': 'controller'
    })
    
    # Check that event was emitted
    assert len(events_received) == 1
    assert 'device' in events_received[0]
    assert 'timestamp' in events_received[0]


@pytest.mark.asyncio
async def test_device_identity_fingerprint():
    """Test device identity fingerprint generation"""
    identity = DeviceIdentity(
        manufacturer='Arduino',
        model='Uno',
        serial_number='12345'
    )
    
    fingerprint = identity.generate_fingerprint()
    assert len(fingerprint) == 16  # 16 character hex string
    
    # Same identity should generate same fingerprint
    identity2 = DeviceIdentity(
        manufacturer='Arduino',
        model='Uno',
        serial_number='12345'
    )
    assert identity.generate_fingerprint() == identity2.generate_fingerprint()
    
    # Different identity should generate different fingerprint
    identity3 = DeviceIdentity(
        manufacturer='Arduino',
        model='Mega',
        serial_number='12345'
    )
    assert identity.generate_fingerprint() != identity3.generate_fingerprint()


@pytest.mark.asyncio
async def test_discovery_start_stop(discovery_engine):
    """Test starting and stopping discovery"""
    # Start discovery
    await discovery_engine.start_discovery(
        protocols=[ProtocolType.SERIAL],
        methods=[DiscoveryMethod.AUTO]
    )
    
    assert 'discovery_serial' in discovery_engine._discovery_tasks
    
    # Stop discovery
    await discovery_engine.stop_discovery([ProtocolType.SERIAL])
    
    assert 'discovery_serial' not in discovery_engine._discovery_tasks


@pytest.mark.asyncio
async def test_export_import_registry(discovery_engine, tmp_path):
    """Test exporting and importing device registry"""
    # Add some devices
    await discovery_engine.register_manual_device({
        'protocol_type': 'serial',
        'device_class': 'controller',
        'identity': {'manufacturer': 'Arduino'}
    })
    await discovery_engine.register_manual_device({
        'protocol_type': 'i2c',
        'device_class': 'sensor',
        'identity': {'model': 'MPU6050'}
    })
    
    # Export registry
    export_file = tmp_path / 'devices.json'
    await discovery_engine.export_device_registry(str(export_file))
    
    assert export_file.exists()
    
    # Clear devices
    discovery_engine._discovered_devices.clear()
    assert len(discovery_engine._discovered_devices) == 0
    
    # Import registry
    imported = await discovery_engine.import_device_registry(str(export_file))
    
    assert imported == 2
    assert len(discovery_engine._discovered_devices) == 2