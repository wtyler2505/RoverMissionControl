"""
I2C Protocol Adapter
Supports I2C/TWI communication with multiple devices on the bus
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum

try:
    import smbus2
    I2C_AVAILABLE = True
except ImportError:
    I2C_AVAILABLE = False
    smbus2 = None

from .base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, DataPacket,
    ConnectionError, TransmissionError, ConfigurationError,
    DataDirection
)


logger = logging.getLogger(__name__)


class I2CSpeed(Enum):
    """I2C bus speeds"""
    STANDARD = 100000    # 100 kHz
    FAST = 400000        # 400 kHz
    FAST_PLUS = 1000000  # 1 MHz
    HIGH_SPEED = 3400000 # 3.4 MHz


@dataclass
class I2CDevice:
    """Represents an I2C device on the bus"""
    address: int  # 7-bit address (0x00 - 0x7F)
    name: str = ""
    description: str = ""
    registers: Dict[int, str] = field(default_factory=dict)  # Register map


@dataclass
class I2CConfig(ProtocolConfig):
    """Configuration for I2C protocol adapter"""
    bus_number: int = 1  # I2C bus number (e.g., 1 for /dev/i2c-1)
    speed: I2CSpeed = I2CSpeed.STANDARD
    
    # Device management
    devices: List[I2CDevice] = field(default_factory=list)
    scan_on_connect: bool = True
    
    # Advanced options
    force_mode: bool = False  # Force access to busy devices
    enable_pec: bool = False  # Enable Packet Error Checking (SMBus)
    
    def validate(self) -> None:
        """Validate I2C configuration"""
        super().validate()
        
        if not I2C_AVAILABLE:
            raise ConfigurationError("smbus2 not installed. Install with: pip install smbus2")
        
        if self.bus_number < 0:
            raise ConfigurationError("Bus number must be non-negative")
        
        # Validate device addresses
        for device in self.devices:
            if not 0x00 <= device.address <= 0x7F:
                raise ConfigurationError(f"Invalid I2C address: 0x{device.address:02X}")


class I2CAdapter(ProtocolAdapter):
    """
    I2C protocol adapter for Inter-Integrated Circuit communication
    """
    
    def __init__(self, config: I2CConfig):
        super().__init__(config)
        self.config: I2CConfig = config
        self._bus = None
        self._device_map: Dict[int, I2CDevice] = {}
        self._lock = asyncio.Lock()  # For thread-safe I2C operations
        
        # Build device map
        for device in config.devices:
            self._device_map[device.address] = device
    
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.I2C
    
    async def _connect_impl(self) -> None:
        """Establish I2C connection"""
        if not I2C_AVAILABLE:
            raise ConnectionError("smbus2 not available")
        
        try:
            # Open I2C bus
            self._bus = smbus2.SMBus(self.config.bus_number)
            
            # Set bus speed if supported by the platform
            # Note: This is platform-specific and may not work on all systems
            
            # Store bus info in metadata
            self._status.metadata['bus_info'] = {
                'bus_number': self.config.bus_number,
                'speed': self.config.speed.name,
                'device_count': len(self._device_map)
            }
            
            # Scan for devices if requested
            if self.config.scan_on_connect:
                await self.scan_bus()
            
        except Exception as e:
            raise ConnectionError(f"Failed to open I2C bus: {e}")
    
    async def _disconnect_impl(self) -> None:
        """Close I2C connection"""
        if self._bus:
            self._bus.close()
            self._bus = None
    
    async def scan_bus(self) -> List[int]:
        """
        Scan I2C bus for devices
        Returns list of detected device addresses
        """
        if not self._bus:
            raise ConnectionError("Not connected to I2C bus")
        
        detected_devices = []
        
        async with self._lock:
            for address in range(0x08, 0x78):  # Valid 7-bit addresses
                try:
                    # Try to read one byte to detect device
                    self._bus.read_byte(address)
                    detected_devices.append(address)
                    
                    if address not in self._device_map:
                        # Add unknown device
                        device = I2CDevice(
                            address=address,
                            name=f"Unknown_0x{address:02X}",
                            description="Detected device"
                        )
                        self._device_map[address] = device
                        
                except Exception:
                    # No device at this address
                    pass
        
        logger.info(f"I2C scan found {len(detected_devices)} devices: " + 
                   ", ".join(f"0x{addr:02X}" for addr in detected_devices))
        
        self._status.metadata['detected_devices'] = detected_devices
        return detected_devices
    
    async def _write_impl(self, packet: DataPacket) -> None:
        """Write data to I2C device"""
        if not self._bus:
            raise TransmissionError("I2C bus not available")
        
        # Extract device address from metadata
        address = packet.metadata.get('address')
        if address is None:
            raise TransmissionError("No I2C address specified in metadata")
        
        if not 0x00 <= address <= 0x7F:
            raise TransmissionError(f"Invalid I2C address: 0x{address:02X}")
        
        try:
            async with self._lock:
                if len(packet.data) == 1:
                    # Write single byte
                    self._bus.write_byte(address, packet.data[0])
                else:
                    # Write multiple bytes
                    self._bus.write_i2c_block_data(address, packet.data[0], list(packet.data[1:]))
            
            # Update metadata
            packet.metadata.update({
                'bus': self.config.bus_number,
                'device': self._device_map.get(address, {}).name or f"0x{address:02X}"
            })
            
        except Exception as e:
            raise TransmissionError(f"I2C write error: {e}")
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read data from I2C device"""
        if not self._bus:
            raise TransmissionError("I2C bus not available")
        
        # For I2C, we need the device address
        # This should be set via a separate method or in metadata
        raise TransmissionError("Use read_from_device() for I2C reads")
    
    async def write_to_device(self, address: int, data: bytes, 
                            register: Optional[int] = None) -> None:
        """
        Write data to specific I2C device
        
        Args:
            address: I2C device address (7-bit)
            data: Data to write
            register: Optional register address
        """
        metadata = {'address': address}
        if register is not None:
            # Prepend register to data
            data = bytes([register]) + data
            metadata['register'] = register
        
        packet = DataPacket(
            data=data,
            direction=DataDirection.TX,
            metadata=metadata
        )
        
        await self.write(packet)
    
    async def read_from_device(self, address: int, size: int,
                              register: Optional[int] = None) -> bytes:
        """
        Read data from specific I2C device
        
        Args:
            address: I2C device address (7-bit)
            size: Number of bytes to read
            register: Optional register address to read from
        """
        if not self._bus:
            raise TransmissionError("I2C bus not available")
        
        if not 0x00 <= address <= 0x7F:
            raise TransmissionError(f"Invalid I2C address: 0x{address:02X}")
        
        try:
            async with self._lock:
                if register is not None:
                    # Read from register
                    if size == 1:
                        data = bytes([self._bus.read_byte_data(address, register)])
                    else:
                        data = bytes(self._bus.read_i2c_block_data(address, register, size))
                else:
                    # Read directly
                    if size == 1:
                        data = bytes([self._bus.read_byte(address)])
                    else:
                        data = bytes(self._bus.read_i2c_block_data(address, 0, size))
            
            packet = DataPacket(
                data=data,
                direction=DataDirection.RX,
                metadata={
                    'address': address,
                    'register': register,
                    'bus': self.config.bus_number,
                    'device': self._device_map.get(address, {}).name or f"0x{address:02X}"
                }
            )
            
            self._status.bytes_received += len(data)
            self._status.last_activity = packet.timestamp
            
            await self._emit_event('data_received', {
                'address': address,
                'size': len(data),
                'register': register
            })
            
            return data
            
        except Exception as e:
            raise TransmissionError(f"I2C read error: {e}")
    
    async def write_register(self, address: int, register: int, value: int) -> None:
        """Write single byte to device register"""
        await self.write_to_device(address, bytes([value]), register)
    
    async def read_register(self, address: int, register: int) -> int:
        """Read single byte from device register"""
        data = await self.read_from_device(address, 1, register)
        return data[0]
    
    async def write_register_word(self, address: int, register: int, value: int) -> None:
        """Write 16-bit word to device register (little-endian)"""
        data = bytes([value & 0xFF, (value >> 8) & 0xFF])
        await self.write_to_device(address, data, register)
    
    async def read_register_word(self, address: int, register: int) -> int:
        """Read 16-bit word from device register (little-endian)"""
        data = await self.read_from_device(address, 2, register)
        return data[0] | (data[1] << 8)
    
    async def write_block(self, address: int, register: int, data: bytes) -> None:
        """Write block of data to device register"""
        if len(data) > 32:
            raise TransmissionError("I2C block write limited to 32 bytes")
        await self.write_to_device(address, data, register)
    
    async def read_block(self, address: int, register: int, size: int) -> bytes:
        """Read block of data from device register"""
        if size > 32:
            raise TransmissionError("I2C block read limited to 32 bytes")
        return await self.read_from_device(address, size, register)
    
    async def probe_device(self, address: int) -> bool:
        """Check if device exists at address"""
        try:
            await self.read_from_device(address, 1)
            return True
        except TransmissionError:
            return False
    
    def get_device_info(self, address: int) -> Optional[I2CDevice]:
        """Get device information if available"""
        return self._device_map.get(address)
    
    def add_device(self, device: I2CDevice) -> None:
        """Add or update device information"""
        self._device_map[device.address] = device
        self.config.devices.append(device)
    
    async def _check_connection_health(self) -> bool:
        """Check if I2C connection is healthy"""
        if not self._bus:
            return False
        
        # Try to probe a known device
        if self._device_map:
            # Check first device
            address = next(iter(self._device_map))
            return await self.probe_device(address)
        
        return True
    
    # SMBus specific functions
    async def smbus_process_call(self, address: int, register: int, value: int) -> int:
        """SMBus process call - write word, read word"""
        if not self._bus:
            raise TransmissionError("I2C bus not available")
        
        async with self._lock:
            return self._bus.process_call(address, register, value)
    
    async def smbus_block_process_call(self, address: int, register: int, 
                                     data: bytes) -> bytes:
        """SMBus block process call - write block, read block"""
        if not self._bus:
            raise TransmissionError("I2C bus not available")
        
        async with self._lock:
            result = self._bus.block_process_call(address, register, list(data))
            return bytes(result)