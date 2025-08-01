"""
Example: Using the Device Discovery System

This example demonstrates how to use the device discovery engine
to automatically discover and register hardware devices.
"""

import asyncio
import logging
from datetime import datetime

from ..discovery import (
    get_discovery_engine,
    DiscoveryMethod,
    DeviceClass,
    ProtocolType
)
from ..manager import hardware_manager
from ..factory import ProtocolAdapterFactory
from ..serial_adapter import SerialConfig
from ..i2c_adapter import I2CConfig


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def setup_adapters():
    """Setup some protocol adapters for discovery"""
    # Create a serial adapter
    serial_config = SerialConfig(
        name="main_serial",
        port="/dev/ttyUSB0",  # Adjust for your system
        baudrate=115200
    )
    serial_adapter = ProtocolAdapterFactory.create_adapter(
        ProtocolType.SERIAL,
        serial_config
    )
    await hardware_manager.add_adapter("serial_main", serial_adapter)
    
    # Create an I2C adapter
    i2c_config = I2CConfig(
        name="main_i2c",
        bus_number=1  # Adjust for your system
    )
    i2c_adapter = ProtocolAdapterFactory.create_adapter(
        ProtocolType.I2C,
        i2c_config
    )
    await hardware_manager.add_adapter("i2c_main", i2c_adapter)
    
    logger.info("Protocol adapters configured")


async def discovery_event_handler(event_data):
    """Handle discovery events"""
    if 'device' in event_data:
        device = event_data['device']
        logger.info(f"Device discovered: {device.device_id} "
                   f"({device.protocol_type.value}) - "
                   f"Class: {device.device_class.value}, "
                   f"Confidence: {device.confidence:.2f}")


async def main():
    """Main example function"""
    logger.info("Device Discovery Example Starting...")
    
    # Setup adapters
    await setup_adapters()
    
    # Get discovery engine
    discovery_engine = get_discovery_engine(hardware_manager)
    
    # Register event handler
    discovery_engine.register_event_handler('device_discovered', discovery_event_handler)
    
    # Configure discovery settings
    discovery_engine._discovery_config.update({
        'auto_discovery_interval': 15.0,  # Scan every 15 seconds
        'probe_timeout': 3.0,
        'max_retries': 2
    })
    
    logger.info("Starting device discovery...")
    
    # Method 1: Immediate scan
    logger.info("\n=== Performing immediate scan ===")
    discovered = await discovery_engine.discover_now()
    logger.info(f"Found {len(discovered)} devices")
    
    for device in discovered:
        logger.info(f"  - {device.device_id}: {device.identity.model or 'Unknown'} "
                   f"on {device.protocol_type.value}")
    
    # Method 2: Continuous discovery
    logger.info("\n=== Starting continuous discovery ===")
    await discovery_engine.start_discovery(
        protocols=[ProtocolType.SERIAL, ProtocolType.I2C],
        methods=[DiscoveryMethod.AUTO, DiscoveryMethod.PROBE]
    )
    
    # Let discovery run for 30 seconds
    await asyncio.sleep(30)
    
    # Method 3: Manual device registration
    logger.info("\n=== Registering manual device ===")
    manual_device_id = await discovery_engine.register_manual_device({
        'protocol_type': 'serial',
        'address': '/dev/ttyUSB1',
        'device_class': 'controller',
        'identity': {
            'manufacturer': 'Custom',
            'model': 'MyController',
            'firmware_version': '1.0.0'
        },
        'capabilities': [
            {
                'name': 'motor_control',
                'category': 'actuator',
                'description': 'Controls up to 4 motors'
            },
            {
                'name': 'encoder_input',
                'category': 'sensor',
                'description': 'Reads 4 quadrature encoders'
            }
        ]
    })
    logger.info(f"Manually registered device: {manual_device_id}")
    
    # Get discovery status
    logger.info("\n=== Discovery Status ===")
    status = discovery_engine.get_discovery_status()
    logger.info(f"Total discovered devices: {status['discovered_devices']}")
    logger.info(f"Active discovery tasks: {status['active_discovery_tasks']}")
    logger.info("Devices by protocol:")
    for protocol, count in status['devices_by_protocol'].items():
        logger.info(f"  - {protocol}: {count}")
    logger.info("Devices by class:")
    for dev_class, count in status['devices_by_class'].items():
        logger.info(f"  - {dev_class}: {count}")
    
    # Register discovered devices with hardware manager
    logger.info("\n=== Registering devices with hardware manager ===")
    all_devices = discovery_engine.get_discovered_devices()
    
    for device in all_devices[:3]:  # Register first 3 devices as example
        try:
            # Determine appropriate adapter
            if device.protocol_type == ProtocolType.SERIAL:
                adapter_id = "serial_main"
            elif device.protocol_type == ProtocolType.I2C:
                adapter_id = "i2c_main"
            else:
                continue
            
            # Register device
            hw_device = await discovery_engine.register_device(
                device.device_id,
                adapter_id,
                device.identity.model or f"Device_{device.device_id[-6:]}"
            )
            logger.info(f"Registered: {hw_device.name} ({hw_device.device_id})")
            
        except Exception as e:
            logger.error(f"Failed to register {device.device_id}: {e}")
    
    # Export device registry
    logger.info("\n=== Exporting device registry ===")
    await discovery_engine.export_device_registry("discovered_devices.json")
    logger.info("Device registry exported to discovered_devices.json")
    
    # Stop discovery
    logger.info("\n=== Stopping discovery ===")
    await discovery_engine.stop_discovery()
    
    # Cleanup
    await hardware_manager.shutdown()
    await discovery_engine.shutdown()
    
    logger.info("Example completed!")


async def example_filtering():
    """Example of filtering discovered devices"""
    discovery_engine = get_discovery_engine(hardware_manager)
    
    # Filter by protocol
    serial_devices = discovery_engine.get_discovered_devices(
        protocol=ProtocolType.SERIAL
    )
    logger.info(f"Serial devices: {len(serial_devices)}")
    
    # Filter by device class
    sensors = discovery_engine.get_discovered_devices(
        device_class=DeviceClass.SENSOR
    )
    logger.info(f"Sensor devices: {len(sensors)}")
    
    # Combined filter
    i2c_sensors = discovery_engine.get_discovered_devices(
        protocol=ProtocolType.I2C,
        device_class=DeviceClass.SENSOR
    )
    logger.info(f"I2C sensors: {len(i2c_sensors)}")
    
    # Get specific device info
    if serial_devices:
        device_info = discovery_engine.get_device_info(serial_devices[0].device_id)
        logger.info(f"Device details: {device_info.identity.model} - "
                   f"Capabilities: {[c.name for c in device_info.capabilities]}")


if __name__ == "__main__":
    asyncio.run(main())