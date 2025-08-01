"""
Serial Protocol Adapter (RS232/RS485)
Supports UART communication with configurable parameters
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional, Union, Dict, Any
from enum import Enum

try:
    import serial
    import serial.tools.list_ports
    from serial_asyncio import create_serial_connection
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False
    serial = None

from .base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, DataPacket,
    ConnectionError, TransmissionError, ConfigurationError,
    DataDirection
)


logger = logging.getLogger(__name__)


class Parity(Enum):
    """Serial parity options"""
    NONE = 'N'
    EVEN = 'E'
    ODD = 'O'
    MARK = 'M'
    SPACE = 'S'


class StopBits(Enum):
    """Serial stop bits options"""
    ONE = 1
    ONE_POINT_FIVE = 1.5
    TWO = 2


class FlowControl(Enum):
    """Serial flow control options"""
    NONE = 'none'
    SOFTWARE = 'software'  # XON/XOFF
    HARDWARE = 'hardware'  # RTS/CTS
    DSR_DTR = 'dsr_dtr'


@dataclass
class SerialConfig(ProtocolConfig):
    """Configuration for Serial protocol adapter"""
    port: str = ""  # COM port or device path (e.g., 'COM3', '/dev/ttyUSB0') - required but with default for dataclass
    baudrate: int = 115200
    bytesize: int = 8  # 5, 6, 7, or 8
    parity: Parity = Parity.NONE
    stopbits: StopBits = StopBits.ONE
    flow_control: FlowControl = FlowControl.NONE
    
    # RS485 specific
    rs485_mode: bool = False
    rs485_rts_delay: float = 0.0
    
    # Advanced options
    exclusive: bool = True
    inter_byte_timeout: Optional[float] = None
    write_timeout: Optional[float] = None
    dsrdtr: bool = False
    rtscts: bool = False
    xonxoff: bool = False
    
    def validate(self) -> None:
        """Validate serial configuration"""
        super().validate()
        
        if not self.port:
            raise ConfigurationError("Serial port must be specified")
        
        if not SERIAL_AVAILABLE:
            raise ConfigurationError("pyserial not installed. Install with: pip install pyserial pyserial-asyncio")
        
        if self.baudrate not in [300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 
                                38400, 57600, 115200, 230400, 460800, 921600]:
            logger.warning(f"Non-standard baudrate: {self.baudrate}")
        
        if self.bytesize not in [5, 6, 7, 8]:
            raise ConfigurationError(f"Invalid bytesize: {self.bytesize}")
        
        # Set flow control flags based on enum
        if self.flow_control == FlowControl.SOFTWARE:
            self.xonxoff = True
        elif self.flow_control == FlowControl.HARDWARE:
            self.rtscts = True
        elif self.flow_control == FlowControl.DSR_DTR:
            self.dsrdtr = True


class SerialProtocol(asyncio.Protocol):
    """Asyncio protocol for serial communication"""
    
    def __init__(self, adapter: 'SerialAdapter'):
        self.adapter = adapter
        self.transport = None
        
    def connection_made(self, transport):
        self.transport = transport
        logger.debug(f"Serial connection made: {self.adapter.config.port}")
        
    def data_received(self, data: bytes):
        packet = DataPacket(
            data=data,
            direction=DataDirection.RX,
            metadata={'port': self.adapter.config.port}
        )
        asyncio.create_task(self.adapter._handle_received_data(packet))
        
    def connection_lost(self, exc):
        logger.warning(f"Serial connection lost: {self.adapter.config.port}, exc: {exc}")
        if self.adapter.is_connected:
            asyncio.create_task(self.adapter._handle_connection_lost())


class SerialAdapter(ProtocolAdapter):
    """
    Serial protocol adapter for RS232/RS485 communication
    """
    
    def __init__(self, config: SerialConfig):
        super().__init__(config)
        self.config: SerialConfig = config
        self._transport = None
        self._protocol = None
        self._reader_task = None
        
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.SERIAL
    
    @staticmethod
    def list_ports() -> Dict[str, Dict[str, Any]]:
        """List available serial ports"""
        if not SERIAL_AVAILABLE:
            return {}
        
        ports = {}
        for port in serial.tools.list_ports.comports():
            ports[port.device] = {
                'description': port.description,
                'hwid': port.hwid,
                'vid': port.vid,
                'pid': port.pid,
                'serial_number': port.serial_number,
                'location': port.location,
                'manufacturer': port.manufacturer,
                'product': port.product
            }
        return ports
    
    async def _connect_impl(self) -> None:
        """Establish serial connection"""
        if not SERIAL_AVAILABLE:
            raise ConnectionError("pyserial not available")
        
        # Create serial connection parameters
        serial_kwargs = {
            'baudrate': self.config.baudrate,
            'bytesize': self.config.bytesize,
            'parity': self.config.parity.value,
            'stopbits': self.config.stopbits.value,
            'xonxoff': self.config.xonxoff,
            'rtscts': self.config.rtscts,
            'dsrdtr': self.config.dsrdtr,
            'timeout': self.config.timeout,
            'write_timeout': self.config.write_timeout,
            'inter_byte_timeout': self.config.inter_byte_timeout,
            'exclusive': self.config.exclusive
        }
        
        # Add RS485 settings if enabled
        if self.config.rs485_mode:
            serial_kwargs['rs485_mode'] = serial.rs485.RS485Settings(
                rts_level_for_tx=True,
                rts_level_for_rx=False,
                delay_before_tx=self.config.rs485_rts_delay,
                delay_before_rx=self.config.rs485_rts_delay
            )
        
        try:
            # Create asyncio serial connection
            self._transport, self._protocol = await create_serial_connection(
                asyncio.get_event_loop(),
                lambda: SerialProtocol(self),
                self.config.port,
                **serial_kwargs
            )
            
            # Store port info in metadata
            self._status.metadata['port_info'] = {
                'port': self.config.port,
                'baudrate': self.config.baudrate,
                'settings': f"{self.config.bytesize}{self.config.parity.value}{self.config.stopbits.value}"
            }
            
        except serial.SerialException as e:
            raise ConnectionError(f"Serial port error: {e}")
        except Exception as e:
            raise ConnectionError(f"Failed to open serial port: {e}")
    
    async def _disconnect_impl(self) -> None:
        """Close serial connection"""
        if self._transport:
            self._transport.close()
            self._transport = None
            self._protocol = None
    
    async def _write_impl(self, packet: DataPacket) -> None:
        """Write data to serial port"""
        if not self._transport:
            raise TransmissionError("Serial transport not available")
        
        try:
            self._transport.write(packet.data)
            
            # Add write metadata
            packet.metadata.update({
                'port': self.config.port,
                'baudrate': self.config.baudrate
            })
            
        except serial.SerialTimeoutException:
            raise TransmissionError("Serial write timeout")
        except Exception as e:
            raise TransmissionError(f"Serial write error: {e}")
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read data from serial port"""
        if not self._transport:
            raise TransmissionError("Serial transport not available")
        
        try:
            # For serial, we rely on the protocol's data_received callback
            # This is a simplified implementation - in practice, you'd want
            # to implement a proper queue-based system
            
            # Wait for data with timeout
            try:
                async with asyncio.timeout(timeout):
                    while True:
                        if hasattr(self, '_received_data'):
                            data = self._received_data
                            delattr(self, '_received_data')
                            return data
                        await asyncio.sleep(0.01)
            except asyncio.TimeoutError:
                raise TransmissionError("Serial read timeout")
                
        except Exception as e:
            raise TransmissionError(f"Serial read error: {e}")
    
    async def _handle_received_data(self, packet: DataPacket):
        """Handle data received from serial port"""
        # Store for read operations (simplified)
        self._received_data = packet
        
        # Emit event
        await self._emit_event('data_received', {
            'size': packet.size,
            'data': packet.to_hex()
        })
    
    async def _handle_connection_lost(self):
        """Handle lost connection"""
        self._status.state = ConnectionState.ERROR
        self._status.last_error = "Connection lost"
        
        if self.config.auto_reconnect:
            logger.info(f"Attempting to reconnect to {self.config.port}...")
            await asyncio.sleep(self.config.reconnect_delay)
            try:
                await self.connect()
            except Exception as e:
                logger.error(f"Reconnection failed: {e}")
    
    async def _check_connection_health(self) -> bool:
        """Check if serial connection is healthy"""
        if not self._transport:
            return False
        
        # Check if transport is closing
        if self._transport.is_closing():
            return False
        
        # Could implement additional health checks here
        # like sending a probe command if the protocol supports it
        
        return True
    
    async def set_dtr(self, value: bool) -> None:
        """Set DTR line state"""
        if self._transport and hasattr(self._transport, 'serial'):
            self._transport.serial.dtr = value
    
    async def set_rts(self, value: bool) -> None:
        """Set RTS line state"""
        if self._transport and hasattr(self._transport, 'serial'):
            self._transport.serial.rts = value
    
    async def get_cts(self) -> bool:
        """Get CTS line state"""
        if self._transport and hasattr(self._transport, 'serial'):
            return self._transport.serial.cts
        return False
    
    async def get_dsr(self) -> bool:
        """Get DSR line state"""
        if self._transport and hasattr(self._transport, 'serial'):
            return self._transport.serial.dsr
        return False
    
    async def send_break(self, duration: float = 0.25) -> None:
        """Send break condition"""
        if self._transport and hasattr(self._transport, 'serial'):
            self._transport.serial.send_break(duration)
    
    async def reset_input_buffer(self) -> None:
        """Clear input buffer"""
        if self._transport and hasattr(self._transport, 'serial'):
            self._transport.serial.reset_input_buffer()
    
    async def reset_output_buffer(self) -> None:
        """Clear output buffer"""
        if self._transport and hasattr(self._transport, 'serial'):
            self._transport.serial.reset_output_buffer()
    
    def get_in_waiting(self) -> int:
        """Get number of bytes in receive buffer"""
        if self._transport and hasattr(self._transport, 'serial'):
            return self._transport.serial.in_waiting
        return 0
    
    def get_out_waiting(self) -> int:
        """Get number of bytes in transmit buffer"""
        if self._transport and hasattr(self._transport, 'serial'):
            return self._transport.serial.out_waiting
        return 0