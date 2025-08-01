"""
Device Discovery Mechanism for Hardware Abstraction Layer
Provides automatic and manual device discovery across all supported protocols
"""

import asyncio
import logging
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable, Union, Set
from enum import Enum
import hashlib
import re
from pathlib import Path

from .base import ProtocolType, ProtocolAdapter, ConnectionState
from .manager import HardwareDevice, HardwareManager
from .factory import ProtocolAdapterFactory
from .serial_adapter import SerialConfig
from .i2c_adapter import I2CConfig, I2CDevice
from .spi_adapter import SPIConfig
from .can_adapter import CANConfig
from .ethernet_adapter import EthernetConfig

try:
    import serial.tools.list_ports
    SERIAL_TOOLS_AVAILABLE = True
except ImportError:
    SERIAL_TOOLS_AVAILABLE = False

try:
    import netifaces
    NETIFACES_AVAILABLE = True
except ImportError:
    NETIFACES_AVAILABLE = False


logger = logging.getLogger(__name__)


class DiscoveryMethod(Enum):
    """Device discovery methods"""
    AUTO = "auto"          # Automatic discovery
    MANUAL = "manual"      # Manual registration
    PROBE = "probe"        # Active probing
    PASSIVE = "passive"    # Passive listening
    BROADCAST = "broadcast" # Broadcast discovery


class DeviceClass(Enum):
    """Device classification"""
    SENSOR = "sensor"
    ACTUATOR = "actuator"
    CONTROLLER = "controller"
    COMMUNICATION = "communication"
    POWER = "power"
    STORAGE = "storage"
    DISPLAY = "display"
    INPUT = "input"
    UNKNOWN = "unknown"


@dataclass
class DeviceIdentity:
    """Device identity and fingerprint information"""
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    hardware_version: Optional[str] = None
    protocol_version: Optional[str] = None
    
    def generate_fingerprint(self) -> str:
        """Generate unique device fingerprint"""
        data = f"{self.manufacturer}:{self.model}:{self.serial_number}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]


@dataclass
class DeviceCapability:
    """Represents a device capability"""
    name: str
    category: str
    description: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    read_only: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class DiscoveredDevice:
    """Represents a discovered device"""
    device_id: str
    protocol_type: ProtocolType
    address: Union[str, int, None]
    discovery_method: DiscoveryMethod
    discovered_at: datetime
    device_class: DeviceClass = DeviceClass.UNKNOWN
    identity: DeviceIdentity = field(default_factory=DeviceIdentity)
    capabilities: List[DeviceCapability] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0  # Discovery confidence (0.0 - 1.0)
    
    def to_hardware_device(self, adapter_id: str, name: Optional[str] = None) -> HardwareDevice:
        """Convert to HardwareDevice for registration"""
        return HardwareDevice(
            device_id=self.device_id,
            name=name or self.identity.model or f"{self.device_class.value}_{self.device_id[-8:]}",
            protocol_type=self.protocol_type,
            adapter_id=adapter_id,
            address=self.address,
            capabilities=[cap.name for cap in self.capabilities],
            metadata={
                'discovery': {
                    'method': self.discovery_method.value,
                    'discovered_at': self.discovered_at.isoformat(),
                    'confidence': self.confidence
                },
                'identity': asdict(self.identity),
                'device_class': self.device_class.value
            }
        )


class DeviceDiscoveryEngine:
    """
    Central engine for device discovery across all protocols
    Handles automatic discovery, device identification, and registration
    """
    
    def __init__(self, hardware_manager: HardwareManager):
        self.hardware_manager = hardware_manager
        self._discovered_devices: Dict[str, DiscoveredDevice] = {}
        self._discovery_tasks: Dict[str, asyncio.Task] = {}
        self._event_handlers: Dict[str, List[Callable]] = {}
        self._device_patterns: Dict[str, Dict] = self._load_device_patterns()
        self._discovery_config = {
            'auto_discovery_interval': 30.0,  # seconds
            'probe_timeout': 5.0,
            'max_retries': 3,
            'enable_passive_discovery': True,
            'enable_broadcast': True
        }
        
    def _load_device_patterns(self) -> Dict[str, Dict]:
        """Load device identification patterns"""
        # Common device patterns for identification
        return {
            'arduino': {
                'serial': {
                    'vid_pid': [(0x2341, 0x0043), (0x2341, 0x0001)],  # Arduino Uno
                    'description_pattern': r'Arduino',
                    'response_pattern': r'Arduino.*\d+\.\d+',
                    'probe_command': b'v\n',  # Version command
                    'device_class': DeviceClass.CONTROLLER
                }
            },
            'esp32': {
                'serial': {
                    'vid_pid': [(0x10C4, 0xEA60)],  # CP2102
                    'description_pattern': r'CP210x|ESP32',
                    'device_class': DeviceClass.CONTROLLER
                }
            },
            'imu_sensor': {
                'i2c': {
                    'addresses': [0x68, 0x69],  # MPU6050/9250
                    'who_am_i_register': 0x75,
                    'expected_values': [0x68, 0x71],
                    'device_class': DeviceClass.SENSOR
                }
            },
            'temperature_sensor': {
                'i2c': {
                    'addresses': [0x48, 0x49, 0x4A, 0x4B],  # TMP102
                    'device_class': DeviceClass.SENSOR
                }
            },
            'motor_controller': {
                'can': {
                    'node_ids': range(0x600, 0x680),  # CANopen motor controllers
                    'device_class': DeviceClass.ACTUATOR
                }
            }
        }
    
    async def start_discovery(self, protocols: Optional[List[ProtocolType]] = None,
                            methods: Optional[List[DiscoveryMethod]] = None) -> None:
        """Start device discovery for specified protocols and methods"""
        protocols = protocols or list(ProtocolType)
        methods = methods or [DiscoveryMethod.AUTO, DiscoveryMethod.PROBE]
        
        for protocol in protocols:
            if protocol == ProtocolType.MOCK:
                continue
                
            task_id = f"discovery_{protocol.value}"
            if task_id not in self._discovery_tasks:
                self._discovery_tasks[task_id] = asyncio.create_task(
                    self._discovery_loop(protocol, methods)
                )
                logger.info(f"Started discovery for {protocol.value}")
    
    async def stop_discovery(self, protocols: Optional[List[ProtocolType]] = None) -> None:
        """Stop device discovery"""
        protocols = protocols or list(ProtocolType)
        
        for protocol in protocols:
            task_id = f"discovery_{protocol.value}"
            if task_id in self._discovery_tasks:
                self._discovery_tasks[task_id].cancel()
                try:
                    await self._discovery_tasks[task_id]
                except asyncio.CancelledError:
                    pass
                del self._discovery_tasks[task_id]
                logger.info(f"Stopped discovery for {protocol.value}")
    
    async def discover_now(self, protocol: Optional[ProtocolType] = None) -> List[DiscoveredDevice]:
        """Perform immediate discovery scan"""
        protocols = [protocol] if protocol else list(ProtocolType)
        discovered = []
        
        for proto in protocols:
            if proto == ProtocolType.MOCK:
                continue
                
            try:
                devices = await self._discover_protocol(proto)
                discovered.extend(devices)
            except Exception as e:
                logger.error(f"Discovery error for {proto.value}: {e}")
        
        return discovered
    
    async def _discovery_loop(self, protocol: ProtocolType, methods: List[DiscoveryMethod]) -> None:
        """Continuous discovery loop for a protocol"""
        while True:
            try:
                if DiscoveryMethod.AUTO in methods or DiscoveryMethod.PROBE in methods:
                    await self._discover_protocol(protocol)
                
                await asyncio.sleep(self._discovery_config['auto_discovery_interval'])
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Discovery loop error for {protocol.value}: {e}")
                await asyncio.sleep(10)  # Brief delay before retry
    
    async def _discover_protocol(self, protocol: ProtocolType) -> List[DiscoveredDevice]:
        """Discover devices for a specific protocol"""
        discovered = []
        
        if protocol == ProtocolType.SERIAL:
            discovered = await self._discover_serial_devices()
        elif protocol == ProtocolType.I2C:
            discovered = await self._discover_i2c_devices()
        elif protocol == ProtocolType.SPI:
            discovered = await self._discover_spi_devices()
        elif protocol == ProtocolType.CAN:
            discovered = await self._discover_can_devices()
        elif protocol == ProtocolType.ETHERNET:
            discovered = await self._discover_ethernet_devices()
        
        # Process discovered devices
        for device in discovered:
            await self._process_discovered_device(device)
        
        return discovered
    
    async def _discover_serial_devices(self) -> List[DiscoveredDevice]:
        """Discover serial devices"""
        discovered = []
        
        if not SERIAL_TOOLS_AVAILABLE:
            logger.warning("pyserial not available for serial discovery")
            return discovered
        
        try:
            ports = serial.tools.list_ports.comports()
            
            for port in ports:
                # Create device ID
                device_id = f"serial_{port.device.replace('/', '_').replace('\\', '_')}"
                
                # Skip if already discovered
                if device_id in self._discovered_devices:
                    continue
                
                # Create discovered device
                device = DiscoveredDevice(
                    device_id=device_id,
                    protocol_type=ProtocolType.SERIAL,
                    address=port.device,
                    discovery_method=DiscoveryMethod.AUTO,
                    discovered_at=datetime.utcnow(),
                    metadata={
                        'port': port.device,
                        'description': port.description,
                        'hwid': port.hwid,
                        'vid': port.vid,
                        'pid': port.pid,
                        'serial_number': port.serial_number,
                        'manufacturer': port.manufacturer,
                        'product': port.product,
                        'interface': port.interface
                    }
                )
                
                # Identify device type
                await self._identify_serial_device(device, port)
                
                discovered.append(device)
                logger.info(f"Discovered serial device: {device_id} at {port.device}")
                
        except Exception as e:
            logger.error(f"Serial discovery error: {e}")
        
        return discovered
    
    async def _identify_serial_device(self, device: DiscoveredDevice, port_info) -> None:
        """Identify serial device type and capabilities"""
        # Check against known patterns
        for device_type, patterns in self._device_patterns.items():
            if 'serial' not in patterns:
                continue
                
            pattern = patterns['serial']
            
            # Check VID/PID
            if 'vid_pid' in pattern and port_info.vid and port_info.pid:
                if (port_info.vid, port_info.pid) in pattern['vid_pid']:
                    device.device_class = pattern.get('device_class', DeviceClass.UNKNOWN)
                    device.identity.manufacturer = port_info.manufacturer
                    device.identity.model = device_type.upper()
                    device.confidence = 0.9
                    
                    # Add capabilities based on device type
                    if device_type == 'arduino':
                        device.capabilities = [
                            DeviceCapability(
                                name="digital_io",
                                category="gpio",
                                description="Digital input/output pins",
                                parameters={'pins': 14}
                            ),
                            DeviceCapability(
                                name="analog_input",
                                category="adc",
                                description="Analog input channels",
                                parameters={'channels': 6, 'resolution': 10}
                            ),
                            DeviceCapability(
                                name="pwm_output",
                                category="pwm",
                                description="PWM output channels",
                                parameters={'channels': 6}
                            )
                        ]
                    break
            
            # Check description pattern
            if 'description_pattern' in pattern and port_info.description:
                if re.search(pattern['description_pattern'], port_info.description, re.I):
                    device.device_class = pattern.get('device_class', DeviceClass.UNKNOWN)
                    device.confidence = 0.7
                    break
    
    async def _discover_i2c_devices(self) -> List[DiscoveredDevice]:
        """Discover I2C devices"""
        discovered = []
        
        # Get I2C adapters
        i2c_adapters = self.hardware_manager.get_adapters_by_protocol(ProtocolType.I2C)
        
        for adapter in i2c_adapters:
            if not adapter.is_connected:
                continue
                
            try:
                # Scan I2C bus
                if hasattr(adapter, 'scan_bus'):
                    addresses = await adapter.scan_bus()
                    
                    for address in addresses:
                        device_id = f"i2c_{adapter.config.name}_{address:02X}"
                        
                        if device_id in self._discovered_devices:
                            continue
                        
                        device = DiscoveredDevice(
                            device_id=device_id,
                            protocol_type=ProtocolType.I2C,
                            address=address,
                            discovery_method=DiscoveryMethod.PROBE,
                            discovered_at=datetime.utcnow(),
                            metadata={
                                'bus': adapter.config.bus_number,
                                'address_hex': f"0x{address:02X}"
                            }
                        )
                        
                        # Identify device type
                        await self._identify_i2c_device(device, adapter, address)
                        
                        discovered.append(device)
                        logger.info(f"Discovered I2C device: {device_id} at 0x{address:02X}")
                        
            except Exception as e:
                logger.error(f"I2C discovery error: {e}")
        
        return discovered
    
    async def _identify_i2c_device(self, device: DiscoveredDevice, adapter, address: int) -> None:
        """Identify I2C device type"""
        # Check against known patterns
        for device_type, patterns in self._device_patterns.items():
            if 'i2c' not in patterns:
                continue
                
            pattern = patterns['i2c']
            
            if address in pattern.get('addresses', []):
                device.device_class = pattern.get('device_class', DeviceClass.UNKNOWN)
                device.identity.model = device_type.upper()
                
                # Try to read WHO_AM_I register if available
                if 'who_am_i_register' in pattern and hasattr(adapter, 'read_register'):
                    try:
                        value = await adapter.read_register(address, pattern['who_am_i_register'])
                        if value in pattern.get('expected_values', []):
                            device.confidence = 0.95
                        else:
                            device.confidence = 0.5
                    except:
                        device.confidence = 0.6
                else:
                    device.confidence = 0.7
                
                # Add capabilities based on device type
                if device_type == 'imu_sensor':
                    device.capabilities = [
                        DeviceCapability(
                            name="accelerometer",
                            category="motion",
                            description="3-axis accelerometer",
                            parameters={'axes': 3, 'range': '±16g'}
                        ),
                        DeviceCapability(
                            name="gyroscope",
                            category="motion",
                            description="3-axis gyroscope",
                            parameters={'axes': 3, 'range': '±2000°/s'}
                        )
                    ]
                elif device_type == 'temperature_sensor':
                    device.capabilities = [
                        DeviceCapability(
                            name="temperature",
                            category="environmental",
                            description="Temperature measurement",
                            parameters={'range': '-40°C to 125°C', 'resolution': '0.0625°C'}
                        )
                    ]
                
                break
    
    async def _discover_spi_devices(self) -> List[DiscoveredDevice]:
        """Discover SPI devices"""
        discovered = []
        
        # SPI discovery is more limited as devices don't have addresses
        # Typically requires manual configuration or known chip select pins
        spi_adapters = self.hardware_manager.get_adapters_by_protocol(ProtocolType.SPI)
        
        for adapter in spi_adapters:
            if not adapter.is_connected:
                continue
                
            # Check for pre-configured devices
            if hasattr(adapter.config, 'devices'):
                for spi_device in adapter.config.devices:
                    device_id = f"spi_{adapter.config.name}_cs{spi_device.chip_select}"
                    
                    if device_id in self._discovered_devices:
                        continue
                    
                    device = DiscoveredDevice(
                        device_id=device_id,
                        protocol_type=ProtocolType.SPI,
                        address=spi_device.chip_select,
                        discovery_method=DiscoveryMethod.MANUAL,
                        discovered_at=datetime.utcnow(),
                        metadata={
                            'chip_select': spi_device.chip_select,
                            'spi_mode': spi_device.mode,
                            'max_speed': spi_device.max_speed
                        }
                    )
                    
                    discovered.append(device)
        
        return discovered
    
    async def _discover_can_devices(self) -> List[DiscoveredDevice]:
        """Discover CAN devices"""
        discovered = []
        
        can_adapters = self.hardware_manager.get_adapters_by_protocol(ProtocolType.CAN)
        
        for adapter in can_adapters:
            if not adapter.is_connected:
                continue
                
            try:
                # Listen for CAN messages to discover active nodes
                if hasattr(adapter, 'scan_network'):
                    nodes = await adapter.scan_network()
                    
                    for node_id in nodes:
                        device_id = f"can_{adapter.config.name}_node{node_id}"
                        
                        if device_id in self._discovered_devices:
                            continue
                        
                        device = DiscoveredDevice(
                            device_id=device_id,
                            protocol_type=ProtocolType.CAN,
                            address=node_id,
                            discovery_method=DiscoveryMethod.PASSIVE,
                            discovered_at=datetime.utcnow(),
                            metadata={
                                'node_id': node_id,
                                'interface': adapter.config.interface
                            }
                        )
                        
                        # Check if it's a known motor controller
                        if 0x600 <= node_id < 0x680:
                            device.device_class = DeviceClass.ACTUATOR
                            device.identity.model = "CANopen Motor Controller"
                            device.confidence = 0.8
                        
                        discovered.append(device)
                        
            except Exception as e:
                logger.error(f"CAN discovery error: {e}")
        
        return discovered
    
    async def _discover_ethernet_devices(self) -> List[DiscoveredDevice]:
        """Discover Ethernet devices"""
        discovered = []
        
        if not NETIFACES_AVAILABLE:
            logger.warning("netifaces not available for network discovery")
            return discovered
        
        # Discover devices through mDNS, SSDP, or custom broadcast
        # This is a simplified example - real implementation would use proper discovery protocols
        
        return discovered
    
    async def _process_discovered_device(self, device: DiscoveredDevice) -> None:
        """Process a discovered device"""
        # Check if device already exists
        if device.device_id in self._discovered_devices:
            # Update existing device
            existing = self._discovered_devices[device.device_id]
            existing.discovered_at = device.discovered_at
            existing.metadata.update(device.metadata)
        else:
            # Add new device
            self._discovered_devices[device.device_id] = device
            
            # Emit discovery event
            await self._emit_event('device_discovered', {
                'device': device,
                'timestamp': datetime.utcnow()
            })
    
    async def register_device(self, device_id: str, adapter_id: str,
                            name: Optional[str] = None) -> HardwareDevice:
        """Register a discovered device with the hardware manager"""
        if device_id not in self._discovered_devices:
            raise ValueError(f"Device {device_id} not found in discovered devices")
        
        discovered = self._discovered_devices[device_id]
        hardware_device = discovered.to_hardware_device(adapter_id, name)
        
        self.hardware_manager.add_device(hardware_device)
        
        await self._emit_event('device_registered', {
            'device_id': device_id,
            'hardware_device': hardware_device,
            'timestamp': datetime.utcnow()
        })
        
        return hardware_device
    
    async def register_manual_device(self, device_data: Dict[str, Any]) -> str:
        """Manually register a device"""
        # Create discovered device from manual data
        device_id = device_data.get('device_id') or f"manual_{datetime.utcnow().timestamp()}"
        
        device = DiscoveredDevice(
            device_id=device_id,
            protocol_type=ProtocolType[device_data['protocol_type'].upper()],
            address=device_data.get('address'),
            discovery_method=DiscoveryMethod.MANUAL,
            discovered_at=datetime.utcnow(),
            device_class=DeviceClass[device_data.get('device_class', 'UNKNOWN').upper()],
            metadata=device_data.get('metadata', {})
        )
        
        # Set identity if provided
        if 'identity' in device_data:
            for key, value in device_data['identity'].items():
                if hasattr(device.identity, key):
                    setattr(device.identity, key, value)
        
        # Add capabilities
        if 'capabilities' in device_data:
            for cap_data in device_data['capabilities']:
                device.capabilities.append(DeviceCapability(**cap_data))
        
        # Process the device
        await self._process_discovered_device(device)
        
        return device_id
    
    def get_discovered_devices(self, protocol: Optional[ProtocolType] = None,
                             device_class: Optional[DeviceClass] = None) -> List[DiscoveredDevice]:
        """Get discovered devices with optional filtering"""
        devices = list(self._discovered_devices.values())
        
        if protocol:
            devices = [d for d in devices if d.protocol_type == protocol]
        
        if device_class:
            devices = [d for d in devices if d.device_class == device_class]
        
        return devices
    
    def get_device_info(self, device_id: str) -> Optional[DiscoveredDevice]:
        """Get information about a discovered device"""
        return self._discovered_devices.get(device_id)
    
    def remove_discovered_device(self, device_id: str) -> bool:
        """Remove a device from discovered devices"""
        if device_id in self._discovered_devices:
            del self._discovered_devices[device_id]
            return True
        return False
    
    def register_event_handler(self, event: str, handler: Callable) -> None:
        """Register an event handler"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
    
    async def _emit_event(self, event: str, data: Dict[str, Any]) -> None:
        """Emit event to registered handlers"""
        if event in self._event_handlers:
            for handler in self._event_handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error in event handler for {event}: {e}")
    
    def get_discovery_status(self) -> Dict[str, Any]:
        """Get discovery engine status"""
        return {
            'discovered_devices': len(self._discovered_devices),
            'active_discovery_tasks': list(self._discovery_tasks.keys()),
            'devices_by_protocol': {
                protocol.value: len([d for d in self._discovered_devices.values() 
                                   if d.protocol_type == protocol])
                for protocol in ProtocolType
            },
            'devices_by_class': {
                dev_class.value: len([d for d in self._discovered_devices.values() 
                                    if d.device_class == dev_class])
                for dev_class in DeviceClass
            },
            'configuration': self._discovery_config
        }
    
    async def export_device_registry(self, file_path: str) -> None:
        """Export discovered devices to JSON file"""
        registry = {
            'exported_at': datetime.utcnow().isoformat(),
            'devices': []
        }
        
        for device in self._discovered_devices.values():
            device_data = {
                'device_id': device.device_id,
                'protocol_type': device.protocol_type.value,
                'address': device.address,
                'discovery_method': device.discovery_method.value,
                'discovered_at': device.discovered_at.isoformat(),
                'device_class': device.device_class.value,
                'identity': asdict(device.identity),
                'capabilities': [cap.to_dict() for cap in device.capabilities],
                'metadata': device.metadata,
                'confidence': device.confidence
            }
            registry['devices'].append(device_data)
        
        with open(file_path, 'w') as f:
            json.dump(registry, f, indent=2)
        
        logger.info(f"Exported {len(registry['devices'])} devices to {file_path}")
    
    async def import_device_registry(self, file_path: str) -> int:
        """Import devices from JSON file"""
        with open(file_path, 'r') as f:
            registry = json.load(f)
        
        imported = 0
        for device_data in registry.get('devices', []):
            try:
                device_id = await self.register_manual_device(device_data)
                imported += 1
                logger.info(f"Imported device: {device_id}")
            except Exception as e:
                logger.error(f"Failed to import device: {e}")
        
        return imported
    
    async def shutdown(self) -> None:
        """Shutdown discovery engine"""
        # Stop all discovery tasks
        await self.stop_discovery()
        
        # Clear data
        self._discovered_devices.clear()
        self._event_handlers.clear()
        
        logger.info("Device discovery engine shutdown complete")


# Global discovery engine instance (created when needed)
_discovery_engine: Optional[DeviceDiscoveryEngine] = None


def get_discovery_engine(hardware_manager: HardwareManager) -> DeviceDiscoveryEngine:
    """Get or create the global discovery engine"""
    global _discovery_engine
    if _discovery_engine is None:
        _discovery_engine = DeviceDiscoveryEngine(hardware_manager)
    return _discovery_engine