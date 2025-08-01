"""
Base classes and interfaces for hardware protocol adapters
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional, List, Callable, Union
from enum import Enum
import asyncio
import logging
from contextlib import asynccontextmanager


logger = logging.getLogger(__name__)


class ProtocolType(Enum):
    """Supported protocol types"""
    SERIAL = "serial"
    I2C = "i2c"
    SPI = "spi"
    CAN = "can"
    ETHERNET = "ethernet"
    MOCK = "mock"  # For testing


class ConnectionState(Enum):
    """Connection states for protocol adapters"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"
    RECONNECTING = "reconnecting"


class DataDirection(Enum):
    """Data transmission direction"""
    TX = "transmit"
    RX = "receive"
    BIDIRECTIONAL = "bidirectional"


@dataclass
class ProtocolStatus:
    """Status information for a protocol adapter"""
    state: ConnectionState
    connected_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    bytes_sent: int = 0
    bytes_received: int = 0
    error_count: int = 0
    last_error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DataPacket:
    """Represents a data packet for transmission/reception"""
    data: bytes
    timestamp: datetime = field(default_factory=datetime.utcnow)
    direction: DataDirection = DataDirection.BIDIRECTIONAL
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def size(self) -> int:
        """Size of the data in bytes"""
        return len(self.data)
    
    def to_hex(self) -> str:
        """Convert data to hex string representation"""
        return self.data.hex()
    
    @classmethod
    def from_hex(cls, hex_string: str, **kwargs) -> 'DataPacket':
        """Create DataPacket from hex string"""
        return cls(data=bytes.fromhex(hex_string), **kwargs)


class ProtocolError(Exception):
    """Base exception for protocol adapter errors"""
    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.error_code = error_code
        self.details = details or {}


class ConnectionError(ProtocolError):
    """Error during connection establishment"""
    pass


class TransmissionError(ProtocolError):
    """Error during data transmission"""
    pass


class ConfigurationError(ProtocolError):
    """Error in protocol configuration"""
    pass


@dataclass
class ProtocolConfig(ABC):
    """Base configuration for protocol adapters"""
    name: str
    timeout: float = 5.0  # Default timeout in seconds
    retry_count: int = 3
    retry_delay: float = 1.0
    buffer_size: int = 4096
    auto_reconnect: bool = True
    reconnect_delay: float = 5.0
    
    @abstractmethod
    def validate(self) -> None:
        """Validate configuration parameters"""
        if self.timeout <= 0:
            raise ConfigurationError("Timeout must be positive")
        if self.retry_count < 0:
            raise ConfigurationError("Retry count must be non-negative")
        if self.buffer_size <= 0:
            raise ConfigurationError("Buffer size must be positive")


class ProtocolAdapter(ABC):
    """
    Abstract base class for all protocol adapters
    Provides a unified interface for hardware communication
    """
    
    def __init__(self, config: ProtocolConfig):
        self.config = config
        self.config.validate()
        
        self._status = ProtocolStatus(state=ConnectionState.DISCONNECTED)
        self._lock = asyncio.Lock()
        self._read_queue: asyncio.Queue[DataPacket] = asyncio.Queue()
        self._write_queue: asyncio.Queue[DataPacket] = asyncio.Queue()
        self._event_handlers: Dict[str, List[Callable]] = {}
        self._connection_task: Optional[asyncio.Task] = None
        self._monitor_task: Optional[asyncio.Task] = None
        
        logger.info(f"Initialized {self.__class__.__name__} with config: {config.name}")
    
    @property
    def protocol_type(self) -> ProtocolType:
        """Get the protocol type"""
        return self._get_protocol_type()
    
    @abstractmethod
    def _get_protocol_type(self) -> ProtocolType:
        """Implementation must return the protocol type"""
        pass
    
    @property
    def status(self) -> ProtocolStatus:
        """Get current adapter status"""
        return self._status
    
    @property
    def is_connected(self) -> bool:
        """Check if adapter is connected"""
        return self._status.state == ConnectionState.CONNECTED
    
    async def connect(self) -> None:
        """
        Establish connection using the protocol
        """
        async with self._lock:
            if self.is_connected:
                logger.warning(f"{self.config.name}: Already connected")
                return
            
            logger.info(f"{self.config.name}: Connecting...")
            self._status.state = ConnectionState.CONNECTING
            
            try:
                await self._connect_impl()
                self._status.state = ConnectionState.CONNECTED
                self._status.connected_at = datetime.utcnow()
                self._status.last_activity = datetime.utcnow()
                
                # Start monitoring task
                self._monitor_task = asyncio.create_task(self._monitor_connection())
                
                logger.info(f"{self.config.name}: Connected successfully")
                await self._emit_event('connected', {'timestamp': datetime.utcnow()})
                
            except Exception as e:
                self._status.state = ConnectionState.ERROR
                self._status.last_error = str(e)
                self._status.error_count += 1
                logger.error(f"{self.config.name}: Connection failed - {e}")
                await self._emit_event('error', {'error': str(e)})
                raise ConnectionError(f"Failed to connect: {e}")
    
    @abstractmethod
    async def _connect_impl(self) -> None:
        """Implementation-specific connection logic"""
        pass
    
    async def disconnect(self) -> None:
        """
        Disconnect from the protocol
        """
        async with self._lock:
            if not self.is_connected:
                logger.warning(f"{self.config.name}: Not connected")
                return
            
            logger.info(f"{self.config.name}: Disconnecting...")
            
            # Cancel monitoring task
            if self._monitor_task:
                self._monitor_task.cancel()
                try:
                    await self._monitor_task
                except asyncio.CancelledError:
                    pass
            
            try:
                await self._disconnect_impl()
                self._status.state = ConnectionState.DISCONNECTED
                logger.info(f"{self.config.name}: Disconnected successfully")
                await self._emit_event('disconnected', {'timestamp': datetime.utcnow()})
                
            except Exception as e:
                logger.error(f"{self.config.name}: Disconnect error - {e}")
                raise
    
    @abstractmethod
    async def _disconnect_impl(self) -> None:
        """Implementation-specific disconnect logic"""
        pass
    
    async def write(self, data: Union[bytes, DataPacket], **kwargs) -> None:
        """
        Write data to the protocol
        """
        if not self.is_connected:
            raise ConnectionError("Not connected")
        
        packet = data if isinstance(data, DataPacket) else DataPacket(
            data=data,
            direction=DataDirection.TX,
            metadata=kwargs
        )
        
        await self._write_impl(packet)
        
        self._status.bytes_sent += packet.size
        self._status.last_activity = datetime.utcnow()
        
        await self._emit_event('data_sent', {
            'size': packet.size,
            'timestamp': packet.timestamp
        })
    
    @abstractmethod
    async def _write_impl(self, packet: DataPacket) -> None:
        """Implementation-specific write logic"""
        pass
    
    async def read(self, size: Optional[int] = None, timeout: Optional[float] = None) -> DataPacket:
        """
        Read data from the protocol
        """
        if not self.is_connected:
            raise ConnectionError("Not connected")
        
        timeout = timeout or self.config.timeout
        
        packet = await self._read_impl(size, timeout)
        
        self._status.bytes_received += packet.size
        self._status.last_activity = datetime.utcnow()
        
        await self._emit_event('data_received', {
            'size': packet.size,
            'timestamp': packet.timestamp
        })
        
        return packet
    
    @abstractmethod
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Implementation-specific read logic"""
        pass
    
    async def query(self, data: Union[bytes, DataPacket], 
                   timeout: Optional[float] = None, **kwargs) -> DataPacket:
        """
        Send data and wait for response (request-response pattern)
        """
        await self.write(data, **kwargs)
        return await self.read(timeout=timeout)
    
    @asynccontextmanager
    async def transaction(self):
        """
        Context manager for transactional operations
        Ensures atomic read/write operations
        """
        async with self._lock:
            yield self
    
    async def flush(self) -> None:
        """
        Flush any buffered data
        """
        if hasattr(self, '_flush_impl'):
            await self._flush_impl()
    
    def register_event_handler(self, event: str, handler: Callable) -> None:
        """
        Register an event handler
        Events: connected, disconnected, data_sent, data_received, error
        """
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
    
    async def _emit_event(self, event: str, data: Dict[str, Any]) -> None:
        """Emit an event to registered handlers"""
        if event in self._event_handlers:
            for handler in self._event_handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error in event handler for {event}: {e}")
    
    async def _monitor_connection(self) -> None:
        """
        Monitor connection health and handle auto-reconnection
        """
        while self.is_connected:
            try:
                # Check connection health
                if hasattr(self, '_check_connection_health'):
                    is_healthy = await self._check_connection_health()
                    
                    if not is_healthy and self.config.auto_reconnect:
                        logger.warning(f"{self.config.name}: Connection unhealthy, reconnecting...")
                        self._status.state = ConnectionState.RECONNECTING
                        
                        await self.disconnect()
                        await asyncio.sleep(self.config.reconnect_delay)
                        await self.connect()
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"{self.config.name}: Monitor error - {e}")
                await asyncio.sleep(5)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get adapter statistics"""
        return {
            'protocol_type': self.protocol_type.value,
            'state': self._status.state.value,
            'connected_at': self._status.connected_at.isoformat() if self._status.connected_at else None,
            'last_activity': self._status.last_activity.isoformat() if self._status.last_activity else None,
            'bytes_sent': self._status.bytes_sent,
            'bytes_received': self._status.bytes_received,
            'error_count': self._status.error_count,
            'last_error': self._status.last_error,
            'metadata': self._status.metadata
        }
    
    async def reset(self) -> None:
        """Reset the adapter (disconnect and clear state)"""
        await self.disconnect()
        self._status = ProtocolStatus(state=ConnectionState.DISCONNECTED)
        self._read_queue = asyncio.Queue()
        self._write_queue = asyncio.Queue()
    
    def __str__(self) -> str:
        return f"{self.__class__.__name__}(name={self.config.name}, state={self._status.state.value})"
    
    def __repr__(self) -> str:
        return self.__str__()
    
    # Diagnostic support methods
    async def echo_test(self, test_data: bytes = b'\x01\x02\x03\x04') -> bool:
        """
        Basic echo test for connectivity verification
        Override in protocol-specific adapters for better implementation
        """
        try:
            # Send test data
            await self.write(test_data)
            
            # Try to read response
            response = await self.read(len(test_data), timeout=1.0)
            
            # Check if response matches
            return response.data == test_data
        except Exception:
            return False
    
    async def get_capabilities(self) -> List[Any]:
        """
        Get device-specific capabilities
        Override in protocol-specific adapters
        """
        return []
    
    async def run_self_test(self) -> Dict[str, Any]:
        """
        Run device self-test if supported
        Override in protocol-specific adapters
        """
        return {
            "supported": False,
            "message": "Self-test not implemented for this adapter"
        }
    
    async def _check_connection_health(self) -> bool:
        """
        Check if connection is healthy
        Override for protocol-specific health checks
        """
        # Basic implementation - just check if connected
        return self.is_connected