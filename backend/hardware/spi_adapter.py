"""
SPI Protocol Adapter
Supports Serial Peripheral Interface communication with multiple devices
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum

try:
    import spidev
    SPI_AVAILABLE = True
except ImportError:
    SPI_AVAILABLE = False
    spidev = None

from .base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, DataPacket,
    ConnectionError, TransmissionError, ConfigurationError,
    DataDirection
)


logger = logging.getLogger(__name__)


class SPIMode(Enum):
    """SPI modes (Clock Polarity and Phase)"""
    MODE_0 = 0  # CPOL=0, CPHA=0
    MODE_1 = 1  # CPOL=0, CPHA=1
    MODE_2 = 2  # CPOL=1, CPHA=0
    MODE_3 = 3  # CPOL=1, CPHA=1


class BitOrder(Enum):
    """Bit order for SPI transmission"""
    MSB_FIRST = "msb"
    LSB_FIRST = "lsb"


@dataclass
class SPIDevice:
    """Represents an SPI device on the bus"""
    chip_select: int  # CS/SS pin number
    name: str = ""
    description: str = ""
    max_speed: int = 1000000  # Max speed for this device
    mode: SPIMode = SPIMode.MODE_0
    bits_per_word: int = 8
    cs_active_high: bool = False


@dataclass
class SPIConfig(ProtocolConfig):
    """Configuration for SPI protocol adapter"""
    bus: int = 0      # SPI bus number (usually 0)
    device: int = 0   # SPI device number (CS pin)
    
    # SPI parameters
    max_speed_hz: int = 1000000  # 1 MHz default
    mode: SPIMode = SPIMode.MODE_0
    bits_per_word: int = 8
    bit_order: BitOrder = BitOrder.MSB_FIRST
    
    # Chip select options
    cs_active_high: bool = False
    cs_delay: float = 0.0  # Delay between CS assertion and transmission
    
    # Device management
    devices: List[SPIDevice] = field(default_factory=list)
    
    # Advanced options
    loop_back: bool = False
    no_cs: bool = False  # 3-wire mode (no CS)
    ready: bool = False  # Use READY pin
    
    def validate(self) -> None:
        """Validate SPI configuration"""
        super().validate()
        
        if not SPI_AVAILABLE:
            raise ConfigurationError("spidev not installed. Install with: pip install spidev")
        
        if self.bus < 0:
            raise ConfigurationError("Bus number must be non-negative")
        
        if self.device < 0:
            raise ConfigurationError("Device number must be non-negative")
        
        if not 1000 <= self.max_speed_hz <= 50000000:  # 1 kHz to 50 MHz
            logger.warning(f"SPI speed {self.max_speed_hz} Hz may be out of range")
        
        if self.bits_per_word not in [8, 16, 32]:
            raise ConfigurationError(f"Unsupported bits per word: {self.bits_per_word}")
        
        # Validate device configurations
        for device in self.devices:
            if device.chip_select < 0:
                raise ConfigurationError(f"Invalid chip select: {device.chip_select}")


class SPIAdapter(ProtocolAdapter):
    """
    SPI protocol adapter for Serial Peripheral Interface communication
    """
    
    def __init__(self, config: SPIConfig):
        super().__init__(config)
        self.config: SPIConfig = config
        self._spi = None
        self._device_map: Dict[int, SPIDevice] = {}
        self._current_device: Optional[SPIDevice] = None
        self._lock = asyncio.Lock()
        
        # Build device map
        for device in config.devices:
            self._device_map[device.chip_select] = device
    
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.SPI
    
    async def _connect_impl(self) -> None:
        """Establish SPI connection"""
        if not SPI_AVAILABLE:
            raise ConnectionError("spidev not available")
        
        try:
            # Open SPI device
            self._spi = spidev.SpiDev()
            self._spi.open(self.config.bus, self.config.device)
            
            # Configure SPI parameters
            self._spi.max_speed_hz = self.config.max_speed_hz
            self._spi.mode = self.config.mode.value
            self._spi.bits_per_word = self.config.bits_per_word
            
            # Set additional flags
            if hasattr(self._spi, 'lsbfirst'):
                self._spi.lsbfirst = (self.config.bit_order == BitOrder.LSB_FIRST)
            if hasattr(self._spi, 'cshigh'):
                self._spi.cshigh = self.config.cs_active_high
            if hasattr(self._spi, 'loop'):
                self._spi.loop = self.config.loop_back
            if hasattr(self._spi, 'no_cs'):
                self._spi.no_cs = self.config.no_cs
            
            # Store connection info in metadata
            self._status.metadata['spi_info'] = {
                'bus': self.config.bus,
                'device': self.config.device,
                'max_speed_hz': self.config.max_speed_hz,
                'mode': self.config.mode.name,
                'bits_per_word': self.config.bits_per_word,
                'device_count': len(self._device_map)
            }
            
        except Exception as e:
            raise ConnectionError(f"Failed to open SPI device: {e}")
    
    async def _disconnect_impl(self) -> None:
        """Close SPI connection"""
        if self._spi:
            self._spi.close()
            self._spi = None
            self._current_device = None
    
    async def _write_impl(self, packet: DataPacket) -> None:
        """Write data to SPI device"""
        if not self._spi:
            raise TransmissionError("SPI device not available")
        
        # Switch to device if specified
        device_cs = packet.metadata.get('chip_select')
        if device_cs is not None:
            await self._select_device(device_cs)
        
        try:
            async with self._lock:
                # Convert data to list for spidev
                data_list = list(packet.data)
                
                # Perform SPI transfer (write-only)
                self._spi.writebytes(data_list)
            
            # Update metadata
            packet.metadata.update({
                'bus': self.config.bus,
                'device': self.config.device,
                'chip_select': device_cs,
                'speed_hz': self._spi.max_speed_hz
            })
            
        except Exception as e:
            raise TransmissionError(f"SPI write error: {e}")
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read data from SPI device"""
        if not self._spi:
            raise TransmissionError("SPI device not available")
        
        if size is None:
            size = 1
        
        try:
            async with self._lock:
                # SPI is full-duplex, so we need to send dummy data to read
                dummy_data = [0x00] * size
                response = self._spi.readbytes(size)
            
            packet = DataPacket(
                data=bytes(response),
                direction=DataDirection.RX,
                metadata={
                    'bus': self.config.bus,
                    'device': self.config.device,
                    'speed_hz': self._spi.max_speed_hz
                }
            )
            
            return packet
            
        except Exception as e:
            raise TransmissionError(f"SPI read error: {e}")
    
    async def transfer(self, data: bytes, chip_select: Optional[int] = None) -> bytes:
        """
        Perform full-duplex SPI transfer
        
        Args:
            data: Data to transmit
            chip_select: Optional chip select to use
            
        Returns:
            Data received during transmission
        """
        if not self._spi:
            raise TransmissionError("SPI device not available")
        
        # Switch to device if specified
        if chip_select is not None:
            await self._select_device(chip_select)
        
        try:
            async with self._lock:
                # Convert to list for spidev
                tx_data = list(data)
                
                # Perform full-duplex transfer
                rx_data = self._spi.xfer2(tx_data)
                
                # Update statistics
                self._status.bytes_sent += len(data)
                self._status.bytes_received += len(rx_data)
                self._status.last_activity = datetime.utcnow()
            
            await self._emit_event('spi_transfer', {
                'tx_size': len(data),
                'rx_size': len(rx_data),
                'chip_select': chip_select
            })
            
            return bytes(rx_data)
            
        except Exception as e:
            raise TransmissionError(f"SPI transfer error: {e}")
    
    async def transfer_multiple(self, transfers: List[Tuple[bytes, Optional[int]]]) -> List[bytes]:
        """
        Perform multiple SPI transfers atomically
        
        Args:
            transfers: List of (data, chip_select) tuples
            
        Returns:
            List of received data for each transfer
        """
        results = []
        
        async with self._lock:
            for data, chip_select in transfers:
                result = await self.transfer(data, chip_select)
                results.append(result)
        
        return results
    
    async def _select_device(self, chip_select: int) -> None:
        """Select SPI device by chip select"""
        device = self._device_map.get(chip_select)
        if not device:
            logger.warning(f"Unknown SPI device at CS {chip_select}")
            return
        
        if self._current_device != device:
            # Reconfigure SPI for this device
            if device.max_speed != self._spi.max_speed_hz:
                self._spi.max_speed_hz = min(device.max_speed, self.config.max_speed_hz)
            
            if device.mode.value != self._spi.mode:
                self._spi.mode = device.mode.value
            
            if device.bits_per_word != self._spi.bits_per_word:
                self._spi.bits_per_word = device.bits_per_word
            
            self._current_device = device
            
            # Add delay if configured
            if self.config.cs_delay > 0:
                await asyncio.sleep(self.config.cs_delay)
    
    async def write_to_device(self, chip_select: int, data: bytes) -> None:
        """Write data to specific SPI device"""
        packet = DataPacket(
            data=data,
            direction=DataDirection.TX,
            metadata={'chip_select': chip_select}
        )
        await self.write(packet)
    
    async def read_from_device(self, chip_select: int, size: int) -> bytes:
        """Read data from specific SPI device"""
        await self._select_device(chip_select)
        packet = await self.read(size)
        return packet.data
    
    async def write_register(self, chip_select: int, register: int, value: int) -> None:
        """Write to device register"""
        # Common pattern: register address + data
        data = bytes([register, value])
        await self.write_to_device(chip_select, data)
    
    async def read_register(self, chip_select: int, register: int) -> int:
        """Read from device register"""
        # Common pattern: write register address, then read response
        write_data = bytes([register | 0x80])  # Read bit often set high
        response = await self.transfer(write_data + b'\x00', chip_select)
        return response[1]  # Skip echo of register address
    
    async def write_register_multi(self, chip_select: int, register: int, 
                                  values: List[int]) -> None:
        """Write multiple bytes to consecutive registers"""
        data = bytes([register] + values)
        await self.write_to_device(chip_select, data)
    
    async def read_register_multi(self, chip_select: int, register: int, 
                                 count: int) -> List[int]:
        """Read multiple bytes from consecutive registers"""
        write_data = bytes([register | 0x80] + [0x00] * count)
        response = await self.transfer(write_data, chip_select)
        return list(response[1:])  # Skip echo of register address
    
    def add_device(self, device: SPIDevice) -> None:
        """Add SPI device to the bus"""
        self._device_map[device.chip_select] = device
        self.config.devices.append(device)
    
    def get_device_info(self, chip_select: int) -> Optional[SPIDevice]:
        """Get device information if available"""
        return self._device_map.get(chip_select)
    
    async def _check_connection_health(self) -> bool:
        """Check if SPI connection is healthy"""
        if not self._spi:
            return False
        
        try:
            # Try a simple loopback test if available
            if self.config.loop_back:
                test_data = b'\xAA\x55'
                response = await self.transfer(test_data)
                return response == test_data
            
            # If we have devices, try to communicate with one
            if self._device_map:
                # This would be device-specific
                pass
            
            return True
            
        except Exception:
            return False
    
    def get_current_settings(self) -> Dict[str, Any]:
        """Get current SPI settings"""
        if not self._spi:
            return {}
        
        return {
            'max_speed_hz': self._spi.max_speed_hz,
            'mode': self._spi.mode,
            'bits_per_word': self._spi.bits_per_word,
            'lsbfirst': getattr(self._spi, 'lsbfirst', False),
            'cshigh': getattr(self._spi, 'cshigh', False),
            'loop': getattr(self._spi, 'loop', False),
            'no_cs': getattr(self._spi, 'no_cs', False),
            'current_device': self._current_device.name if self._current_device else None
        }