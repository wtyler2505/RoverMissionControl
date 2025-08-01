"""
CAN Bus Protocol Adapter
Supports Controller Area Network communication with multiple nodes
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Callable, Union
from enum import Enum
from datetime import datetime

try:
    import can
    CAN_AVAILABLE = True
except ImportError:
    CAN_AVAILABLE = False
    can = None

from .base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, DataPacket,
    ConnectionError, TransmissionError, ConfigurationError,
    DataDirection
)


logger = logging.getLogger(__name__)


class CANInterface(Enum):
    """CAN interface types"""
    SOCKETCAN = "socketcan"  # Linux SocketCAN
    PCAN = "pcan"           # Peak CAN
    IXXAT = "ixxat"         # IXXAT CAN
    VECTOR = "vector"       # Vector CANtech
    VIRTUAL = "virtual"     # Virtual CAN for testing
    USB2CAN = "usb2can"     # USB to CAN adapters


class CANFrameType(Enum):
    """CAN frame types"""
    DATA = "data"
    REMOTE = "remote"
    ERROR = "error"
    EXTENDED = "extended"


@dataclass
class CANNode:
    """Represents a CAN node on the network"""
    node_id: int
    name: str = ""
    description: str = ""
    supported_messages: List[int] = field(default_factory=list)  # Message IDs


@dataclass
class CANMessage:
    """Represents a CAN message"""
    arbitration_id: int
    data: bytes
    is_extended_id: bool = False
    is_remote_frame: bool = False
    is_error_frame: bool = False
    timestamp: Optional[float] = None
    channel: Optional[str] = None
    
    @property
    def dlc(self) -> int:
        """Data Length Code"""
        return len(self.data)
    
    def to_can_message(self) -> 'can.Message':
        """Convert to python-can Message"""
        if not CAN_AVAILABLE:
            raise RuntimeError("python-can not available")
        
        return can.Message(
            arbitration_id=self.arbitration_id,
            data=self.data,
            is_extended_id=self.is_extended_id,
            is_remote_frame=self.is_remote_frame,
            is_error_frame=self.is_error_frame,
            timestamp=self.timestamp,
            channel=self.channel
        )
    
    @classmethod
    def from_can_message(cls, msg: 'can.Message') -> 'CANMessage':
        """Create from python-can Message"""
        return cls(
            arbitration_id=msg.arbitration_id,
            data=msg.data,
            is_extended_id=msg.is_extended_id,
            is_remote_frame=msg.is_remote_frame,
            is_error_frame=msg.is_error_frame,
            timestamp=msg.timestamp,
            channel=msg.channel
        )


@dataclass
class CANConfig(ProtocolConfig):
    """Configuration for CAN protocol adapter"""
    interface: CANInterface = CANInterface.SOCKETCAN
    channel: str = "can0"  # Interface name (e.g., 'can0', 'PCAN_USBBUS1')
    bitrate: int = 500000  # 500 kbps default
    
    # Filtering
    can_filters: List[Dict[str, Any]] = field(default_factory=list)
    
    # Nodes on the network
    nodes: List[CANNode] = field(default_factory=list)
    
    # Interface-specific options
    interface_config: Dict[str, Any] = field(default_factory=dict)
    
    # Advanced options
    fd: bool = False  # CAN FD (Flexible Data-rate)
    data_bitrate: Optional[int] = None  # For CAN FD
    receive_own_messages: bool = False
    
    def validate(self) -> None:
        """Validate CAN configuration"""
        super().validate()
        
        if not CAN_AVAILABLE:
            raise ConfigurationError("python-can not installed. Install with: pip install python-can")
        
        if self.bitrate not in [125000, 250000, 500000, 1000000]:
            logger.warning(f"Non-standard CAN bitrate: {self.bitrate}")
        
        if self.fd and not self.data_bitrate:
            raise ConfigurationError("CAN FD requires data_bitrate to be specified")
        
        # Validate filters
        for can_filter in self.can_filters:
            if 'can_id' not in can_filter:
                raise ConfigurationError("CAN filter must specify 'can_id'")


if CAN_AVAILABLE:
    class CANListener(can.Listener):
        """CAN message listener for receiving messages"""
        
        def __init__(self, adapter: 'CANAdapter'):
            self.adapter = adapter
        
        def on_message_received(self, msg: can.Message):
            """Handle received CAN message"""
            can_msg = CANMessage.from_can_message(msg)
            asyncio.create_task(self.adapter._handle_received_message(can_msg))
        
        def on_error(self, exc: Exception):
            """Handle CAN errors"""
            logger.error(f"CAN error: {exc}")
            asyncio.create_task(self.adapter._handle_error(exc))


class CANAdapter(ProtocolAdapter):
    """
    CAN Bus protocol adapter for Controller Area Network communication
    """
    
    def __init__(self, config: CANConfig):
        super().__init__(config)
        self.config: CANConfig = config
        self._bus = None
        self._notifier = None
        self._listener = None
        self._node_map: Dict[int, CANNode] = {}
        self._message_handlers: Dict[int, List[Callable]] = {}
        self._received_messages: asyncio.Queue = asyncio.Queue()
        
        # Build node map
        for node in config.nodes:
            self._node_map[node.node_id] = node
    
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.CAN
    
    async def _connect_impl(self) -> None:
        """Establish CAN connection"""
        if not CAN_AVAILABLE:
            raise ConnectionError("python-can not available")
        
        try:
            # Build interface configuration
            interface_config = {
                'interface': self.config.interface.value,
                'channel': self.config.channel,
                'bitrate': self.config.bitrate,
                'receive_own_messages': self.config.receive_own_messages,
                **self.config.interface_config
            }
            
            # Add CAN FD configuration
            if self.config.fd:
                interface_config['fd'] = True
                interface_config['data_bitrate'] = self.config.data_bitrate
            
            # Create CAN bus
            self._bus = can.interface.Bus(**interface_config)
            
            # Set up message filtering
            if self.config.can_filters:
                self._bus.set_filters(self.config.can_filters)
            
            # Set up message listener
            self._listener = CANListener(self)
            self._notifier = can.Notifier(self._bus, [self._listener])
            
            # Store connection info
            self._status.metadata['can_info'] = {
                'interface': self.config.interface.value,
                'channel': self.config.channel,
                'bitrate': self.config.bitrate,
                'fd': self.config.fd,
                'node_count': len(self._node_map)
            }
            
        except Exception as e:
            raise ConnectionError(f"Failed to connect to CAN bus: {e}")
    
    async def _disconnect_impl(self) -> None:
        """Close CAN connection"""
        if self._notifier:
            self._notifier.stop()
            self._notifier = None
        
        if self._bus:
            self._bus.shutdown()
            self._bus = None
        
        self._listener = None
    
    async def _write_impl(self, packet: DataPacket) -> None:
        """Send CAN message"""
        if not self._bus:
            raise TransmissionError("CAN bus not available")
        
        # Extract CAN message from metadata
        arbitration_id = packet.metadata.get('arbitration_id')
        if arbitration_id is None:
            raise TransmissionError("No arbitration_id specified in metadata")
        
        is_extended_id = packet.metadata.get('is_extended_id', False)
        is_remote_frame = packet.metadata.get('is_remote_frame', False)
        
        if len(packet.data) > 8 and not self.config.fd:
            raise TransmissionError("Standard CAN data limited to 8 bytes")
        
        if len(packet.data) > 64:
            raise TransmissionError("CAN FD data limited to 64 bytes")
        
        try:
            # Create CAN message
            msg = can.Message(
                arbitration_id=arbitration_id,
                data=packet.data,
                is_extended_id=is_extended_id,
                is_remote_frame=is_remote_frame
            )
            
            # Send message
            self._bus.send(msg, timeout=self.config.timeout)
            
            # Update metadata
            packet.metadata.update({
                'interface': self.config.interface.value,
                'channel': self.config.channel,
                'dlc': len(packet.data),
                'timestamp': datetime.utcnow().timestamp()
            })
            
        except can.CanError as e:
            raise TransmissionError(f"CAN send error: {e}")
        except Exception as e:
            raise TransmissionError(f"CAN transmission error: {e}")
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Receive CAN message"""
        try:
            # Wait for message from queue
            can_msg = await asyncio.wait_for(
                self._received_messages.get(),
                timeout=timeout
            )
            
            packet = DataPacket(
                data=can_msg.data,
                direction=DataDirection.RX,
                metadata={
                    'arbitration_id': can_msg.arbitration_id,
                    'is_extended_id': can_msg.is_extended_id,
                    'is_remote_frame': can_msg.is_remote_frame,
                    'is_error_frame': can_msg.is_error_frame,
                    'dlc': can_msg.dlc,
                    'timestamp': can_msg.timestamp,
                    'channel': can_msg.channel
                }
            )
            
            return packet
            
        except asyncio.TimeoutError:
            raise TransmissionError("CAN receive timeout")
    
    async def send_message(self, arbitration_id: int, data: bytes,
                          is_extended_id: bool = False,
                          is_remote_frame: bool = False) -> None:
        """Send CAN message with specified parameters"""
        packet = DataPacket(
            data=data,
            direction=DataDirection.TX,
            metadata={
                'arbitration_id': arbitration_id,
                'is_extended_id': is_extended_id,
                'is_remote_frame': is_remote_frame
            }
        )
        await self.write(packet)
    
    async def receive_message(self, timeout: Optional[float] = None) -> CANMessage:
        """Receive CAN message"""
        timeout = timeout or self.config.timeout
        packet = await self.read(timeout=timeout)
        
        return CANMessage(
            arbitration_id=packet.metadata['arbitration_id'],
            data=packet.data,
            is_extended_id=packet.metadata.get('is_extended_id', False),
            is_remote_frame=packet.metadata.get('is_remote_frame', False),
            is_error_frame=packet.metadata.get('is_error_frame', False),
            timestamp=packet.metadata.get('timestamp'),
            channel=packet.metadata.get('channel')
        )
    
    async def _handle_received_message(self, msg: CANMessage):
        """Handle received CAN message"""
        # Put message in queue for read operations
        await self._received_messages.put(msg)
        
        # Call registered message handlers
        handlers = self._message_handlers.get(msg.arbitration_id, [])
        handlers.extend(self._message_handlers.get(-1, []))  # Global handlers
        
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(msg)
                else:
                    handler(msg)
            except Exception as e:
                logger.error(f"Error in CAN message handler: {e}")
        
        # Emit event
        await self._emit_event('can_message_received', {
            'arbitration_id': msg.arbitration_id,
            'dlc': msg.dlc,
            'is_extended': msg.is_extended_id,
            'data': msg.data.hex()
        })
    
    async def _handle_error(self, exc: Exception):
        """Handle CAN errors"""
        self._status.error_count += 1
        self._status.last_error = str(exc)
        
        await self._emit_event('can_error', {
            'error': str(exc),
            'error_type': type(exc).__name__
        })
    
    def register_message_handler(self, arbitration_id: int, 
                                handler: Callable[[CANMessage], None]) -> None:
        """
        Register handler for specific CAN message ID
        Use arbitration_id = -1 for global handler (all messages)
        """
        if arbitration_id not in self._message_handlers:
            self._message_handlers[arbitration_id] = []
        self._message_handlers[arbitration_id].append(handler)
    
    def unregister_message_handler(self, arbitration_id: int, 
                                  handler: Callable[[CANMessage], None]) -> None:
        """Unregister message handler"""
        if arbitration_id in self._message_handlers:
            try:
                self._message_handlers[arbitration_id].remove(handler)
            except ValueError:
                pass
    
    async def send_remote_frame(self, arbitration_id: int, dlc: int = 0) -> None:
        """Send remote transmission request (RTR) frame"""
        await self.send_message(
            arbitration_id=arbitration_id,
            data=b'\x00' * dlc,
            is_remote_frame=True
        )
    
    async def request_response(self, arbitration_id: int, data: bytes,
                              response_id: int, timeout: float = 1.0) -> CANMessage:
        """Send message and wait for specific response"""
        # Send request
        await self.send_message(arbitration_id, data)
        
        # Wait for response
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout:
            try:
                msg = await self.receive_message(timeout=0.1)
                if msg.arbitration_id == response_id:
                    return msg
            except TransmissionError:
                continue
        
        raise TransmissionError(f"No response received for ID 0x{response_id:X}")
    
    def add_node(self, node: CANNode) -> None:
        """Add CAN node to the network"""
        self._node_map[node.node_id] = node
        self.config.nodes.append(node)
    
    def get_node_info(self, node_id: int) -> Optional[CANNode]:
        """Get node information if available"""
        return self._node_map.get(node_id)
    
    async def scan_network(self, timeout: float = 5.0) -> List[int]:
        """
        Scan for active nodes on the CAN network
        This is a basic implementation - actual scanning depends on the protocol
        """
        active_nodes = set()
        start_time = asyncio.get_event_loop().time()
        
        # Listen for any traffic
        while asyncio.get_event_loop().time() - start_time < timeout:
            try:
                msg = await self.receive_message(timeout=0.1)
                # Extract node ID from arbitration ID (protocol-specific)
                # This is a simplified example
                node_id = msg.arbitration_id >> 3  # Assuming upper bits are node ID
                active_nodes.add(node_id)
            except TransmissionError:
                continue
        
        return list(active_nodes)
    
    async def _check_connection_health(self) -> bool:
        """Check if CAN connection is healthy"""
        if not self._bus:
            return False
        
        try:
            # Check bus state
            state = self._bus.state
            return state == can.BusState.ACTIVE
        except Exception:
            return False
    
    def get_bus_statistics(self) -> Dict[str, Any]:
        """Get CAN bus statistics"""
        if not self._bus:
            return {}
        
        return {
            'state': str(self._bus.state) if hasattr(self._bus, 'state') else 'unknown',
            'protocol': str(self._bus.protocol) if hasattr(self._bus, 'protocol') else 'unknown',
            'channel_info': str(self._bus.channel_info) if hasattr(self._bus, 'channel_info') else 'unknown'
        }