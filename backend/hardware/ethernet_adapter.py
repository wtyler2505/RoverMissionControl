"""
Ethernet Protocol Adapter
Supports TCP/UDP communication over Ethernet interfaces
"""

import asyncio
import logging
import socket
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Tuple, Union, List
from enum import Enum

from .base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, DataPacket,
    ConnectionError, TransmissionError, ConfigurationError,
    DataDirection
)


logger = logging.getLogger(__name__)


class EthernetProtocol(Enum):
    """Ethernet protocol types"""
    TCP = "tcp"
    UDP = "udp"
    RAW = "raw"  # Raw socket (requires privileges)


class SocketRole(Enum):
    """Socket role (client or server)"""
    CLIENT = "client"
    SERVER = "server"


@dataclass
class EthernetConfig(ProtocolConfig):
    """Configuration for Ethernet protocol adapter"""
    protocol: EthernetProtocol = EthernetProtocol.TCP
    role: SocketRole = SocketRole.CLIENT
    
    # Connection parameters
    host: str = "localhost"  # For client: target host, for server: bind address
    port: int = 8080
    
    # TCP specific
    keep_alive: bool = True
    no_delay: bool = True  # Disable Nagle's algorithm
    reuse_address: bool = True
    
    # UDP specific
    broadcast: bool = False
    multicast_group: Optional[str] = None
    multicast_ttl: int = 1
    
    # Server specific
    max_connections: int = 10  # For TCP server
    bind_interface: Optional[str] = None  # Network interface to bind to
    
    # Raw socket specific (requires root/admin)
    ethernet_type: int = 0x0800  # IPv4 by default
    interface_name: Optional[str] = None
    
    # Advanced options
    send_buffer_size: Optional[int] = None
    recv_buffer_size: Optional[int] = None
    
    def validate(self) -> None:
        """Validate Ethernet configuration"""
        super().validate()
        
        if not 1 <= self.port <= 65535:
            raise ConfigurationError(f"Invalid port number: {self.port}")
        
        if self.role == SocketRole.SERVER and self.protocol == EthernetProtocol.UDP:
            if not self.host:
                self.host = "0.0.0.0"  # Bind to all interfaces for UDP server
        
        if self.multicast_group and self.protocol != EthernetProtocol.UDP:
            raise ConfigurationError("Multicast is only supported with UDP")
        
        if self.protocol == EthernetProtocol.RAW and not self.interface_name:
            raise ConfigurationError("Raw sockets require interface_name")


class EthernetAdapter(ProtocolAdapter):
    """
    Ethernet protocol adapter for TCP/UDP communication
    """
    
    def __init__(self, config: EthernetConfig):
        super().__init__(config)
        self.config: EthernetConfig = config
        self._socket = None
        self._server = None
        self._connections: Dict[str, asyncio.StreamWriter] = {}
        self._read_task = None
        
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.ETHERNET
    
    async def _connect_impl(self) -> None:
        """Establish Ethernet connection"""
        try:
            if self.config.protocol == EthernetProtocol.TCP:
                await self._connect_tcp()
            elif self.config.protocol == EthernetProtocol.UDP:
                await self._connect_udp()
            elif self.config.protocol == EthernetProtocol.RAW:
                await self._connect_raw()
            
            # Store connection info
            self._status.metadata['ethernet_info'] = {
                'protocol': self.config.protocol.value,
                'role': self.config.role.value,
                'host': self.config.host,
                'port': self.config.port,
                'local_address': self._get_local_address(),
                'remote_address': self._get_remote_address() if self.config.role == SocketRole.CLIENT else None
            }
            
        except Exception as e:
            raise ConnectionError(f"Failed to establish Ethernet connection: {e}")
    
    async def _connect_tcp(self) -> None:
        """Connect TCP socket"""
        if self.config.role == SocketRole.CLIENT:
            # TCP Client
            try:
                self._reader, self._writer = await asyncio.open_connection(
                    self.config.host, 
                    self.config.port
                )
                
                # Configure socket options
                sock = self._writer.get_extra_info('socket')
                if self.config.keep_alive:
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
                if self.config.no_delay:
                    sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                if self.config.reuse_address:
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                
                # Start reading task
                self._read_task = asyncio.create_task(self._tcp_read_loop())
                
            except Exception as e:
                raise ConnectionError(f"TCP client connection failed: {e}")
                
        else:
            # TCP Server
            try:
                self._server = await asyncio.start_server(
                    self._handle_tcp_client,
                    self.config.host or '0.0.0.0',
                    self.config.port,
                    limit=self.config.max_connections,
                    reuse_address=self.config.reuse_address
                )
                
                # Start serving
                asyncio.create_task(self._server.serve_forever())
                
            except Exception as e:
                raise ConnectionError(f"TCP server start failed: {e}")
    
    async def _connect_udp(self) -> None:
        """Connect UDP socket"""
        try:
            # Create UDP endpoint
            if self.config.role == SocketRole.CLIENT:
                transport, protocol = await asyncio.get_event_loop().create_datagram_endpoint(
                    lambda: UDPProtocol(self),
                    remote_addr=(self.config.host, self.config.port)
                )
            else:
                transport, protocol = await asyncio.get_event_loop().create_datagram_endpoint(
                    lambda: UDPProtocol(self),
                    local_addr=(self.config.host or '0.0.0.0', self.config.port)
                )
            
            self._transport = transport
            self._protocol = protocol
            
            # Configure socket options
            sock = transport.get_extra_info('socket')
            if self.config.broadcast:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            
            # Join multicast group if specified
            if self.config.multicast_group:
                self._join_multicast(sock)
                
        except Exception as e:
            raise ConnectionError(f"UDP connection failed: {e}")
    
    async def _connect_raw(self) -> None:
        """Connect raw socket (requires privileges)"""
        try:
            # Create raw socket
            sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(self.config.ethernet_type))
            
            # Bind to interface
            if self.config.interface_name:
                sock.bind((self.config.interface_name, 0))
            
            # Create asyncio transport
            transport, protocol = await asyncio.get_event_loop().create_connection(
                lambda: RawProtocol(self),
                sock=sock
            )
            
            self._transport = transport
            self._protocol = protocol
            
        except PermissionError:
            raise ConnectionError("Raw sockets require root/administrator privileges")
        except Exception as e:
            raise ConnectionError(f"Raw socket connection failed: {e}")
    
    async def _disconnect_impl(self) -> None:
        """Close Ethernet connection"""
        # Cancel read task
        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass
        
        # Close connections
        if hasattr(self, '_writer') and self._writer:
            self._writer.close()
            await self._writer.wait_closed()
        
        # Close server
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        
        # Close transport
        if hasattr(self, '_transport') and self._transport:
            self._transport.close()
        
        # Close all client connections
        for writer in self._connections.values():
            writer.close()
            await writer.wait_closed()
        self._connections.clear()
    
    async def _write_impl(self, packet: DataPacket) -> None:
        """Send data over Ethernet"""
        try:
            if self.config.protocol == EthernetProtocol.TCP:
                await self._write_tcp(packet)
            elif self.config.protocol == EthernetProtocol.UDP:
                await self._write_udp(packet)
            elif self.config.protocol == EthernetProtocol.RAW:
                await self._write_raw(packet)
                
        except Exception as e:
            raise TransmissionError(f"Ethernet write error: {e}")
    
    async def _write_tcp(self, packet: DataPacket) -> None:
        """Write TCP data"""
        if self.config.role == SocketRole.CLIENT:
            if not hasattr(self, '_writer') or not self._writer:
                raise TransmissionError("TCP client not connected")
            
            self._writer.write(packet.data)
            await self._writer.drain()
            
        else:
            # Server - send to all connections or specific connection
            target_addr = packet.metadata.get('target_address')
            if target_addr:
                writer = self._connections.get(target_addr)
                if writer:
                    writer.write(packet.data)
                    await writer.drain()
            else:
                # Broadcast to all connections
                for writer in self._connections.values():
                    writer.write(packet.data)
                    await writer.drain()
    
    async def _write_udp(self, packet: DataPacket) -> None:
        """Write UDP data"""
        if not hasattr(self, '_transport'):
            raise TransmissionError("UDP transport not available")
        
        # Get target address from metadata or use configured address
        target_host = packet.metadata.get('target_host', self.config.host)
        target_port = packet.metadata.get('target_port', self.config.port)
        
        if self.config.role == SocketRole.CLIENT:
            self._transport.sendto(packet.data, (target_host, target_port))
        else:
            # For server, target must be specified
            if 'target_host' not in packet.metadata or 'target_port' not in packet.metadata:
                raise TransmissionError("UDP server requires target_host and target_port in metadata")
            self._transport.sendto(packet.data, (target_host, target_port))
    
    async def _write_raw(self, packet: DataPacket) -> None:
        """Write raw ethernet frame"""
        if not hasattr(self, '_transport'):
            raise TransmissionError("Raw transport not available")
        
        self._transport.write(packet.data)
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read data from Ethernet"""
        # For Ethernet, reading is handled by the protocol handlers
        # This method waits for data to be available
        try:
            async with asyncio.timeout(timeout):
                while True:
                    if hasattr(self, '_received_data') and self._received_data:
                        packet = self._received_data.pop(0)
                        return packet
                    await asyncio.sleep(0.01)
        except asyncio.TimeoutError:
            raise TransmissionError("Ethernet read timeout")
    
    async def _tcp_read_loop(self) -> None:
        """Read loop for TCP client"""
        while True:
            try:
                data = await self._reader.read(self.config.buffer_size)
                if not data:
                    break  # Connection closed
                
                packet = DataPacket(
                    data=data,
                    direction=DataDirection.RX,
                    metadata={'protocol': 'tcp'}
                )
                await self._handle_received_data(packet)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"TCP read error: {e}")
                break
    
    async def _handle_tcp_client(self, reader: asyncio.StreamReader, 
                                writer: asyncio.StreamWriter) -> None:
        """Handle TCP client connection (server mode)"""
        addr = writer.get_extra_info('peername')
        addr_str = f"{addr[0]}:{addr[1]}"
        self._connections[addr_str] = writer
        
        logger.info(f"TCP client connected: {addr_str}")
        
        try:
            while True:
                data = await reader.read(self.config.buffer_size)
                if not data:
                    break
                
                packet = DataPacket(
                    data=data,
                    direction=DataDirection.RX,
                    metadata={
                        'protocol': 'tcp',
                        'client_address': addr_str
                    }
                )
                await self._handle_received_data(packet)
                
        except Exception as e:
            logger.error(f"TCP client error: {e}")
        finally:
            writer.close()
            await writer.wait_closed()
            if addr_str in self._connections:
                del self._connections[addr_str]
            logger.info(f"TCP client disconnected: {addr_str}")
    
    async def _handle_received_data(self, packet: DataPacket) -> None:
        """Handle received data"""
        if not hasattr(self, '_received_data'):
            self._received_data = []
        
        self._received_data.append(packet)
        
        await self._emit_event('data_received', {
            'size': packet.size,
            'protocol': packet.metadata.get('protocol', 'unknown'),
            'source': packet.metadata.get('client_address') or packet.metadata.get('remote_addr')
        })
    
    def _join_multicast(self, sock: socket.socket) -> None:
        """Join multicast group"""
        if not self.config.multicast_group:
            return
        
        import struct
        
        # Convert multicast address to binary
        mreq = struct.pack("4sl", socket.inet_aton(self.config.multicast_group), socket.INADDR_ANY)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        
        # Set TTL
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, self.config.multicast_ttl)
    
    def _get_local_address(self) -> Optional[str]:
        """Get local socket address"""
        if hasattr(self, '_writer') and self._writer:
            addr = self._writer.get_extra_info('sockname')
            return f"{addr[0]}:{addr[1]}" if addr else None
        elif hasattr(self, '_transport') and self._transport:
            addr = self._transport.get_extra_info('sockname')
            return f"{addr[0]}:{addr[1]}" if addr else None
        return None
    
    def _get_remote_address(self) -> Optional[str]:
        """Get remote socket address"""
        if hasattr(self, '_writer') and self._writer:
            addr = self._writer.get_extra_info('peername')
            return f"{addr[0]}:{addr[1]}" if addr else None
        return None
    
    async def send_to(self, host: str, port: int, data: bytes) -> None:
        """Send data to specific address (UDP only)"""
        if self.config.protocol != EthernetProtocol.UDP:
            raise TransmissionError("send_to() only supported for UDP")
        
        packet = DataPacket(
            data=data,
            direction=DataDirection.TX,
            metadata={'target_host': host, 'target_port': port}
        )
        await self.write(packet)
    
    async def broadcast(self, data: bytes, port: Optional[int] = None) -> None:
        """Send broadcast message (UDP only)"""
        if self.config.protocol != EthernetProtocol.UDP:
            raise TransmissionError("broadcast() only supported for UDP")
        
        if not self.config.broadcast:
            raise TransmissionError("Broadcast not enabled in configuration")
        
        await self.send_to('255.255.255.255', port or self.config.port, data)
    
    async def multicast(self, data: bytes) -> None:
        """Send multicast message (UDP only)"""
        if self.config.protocol != EthernetProtocol.UDP:
            raise TransmissionError("multicast() only supported for UDP")
        
        if not self.config.multicast_group:
            raise TransmissionError("No multicast group configured")
        
        await self.send_to(self.config.multicast_group, self.config.port, data)
    
    def get_connection_count(self) -> int:
        """Get number of active connections (TCP server only)"""
        return len(self._connections)
    
    def get_connection_addresses(self) -> List[str]:
        """Get list of connected client addresses (TCP server only)"""
        return list(self._connections.keys())


class UDPProtocol(asyncio.DatagramProtocol):
    """Asyncio protocol for UDP communication"""
    
    def __init__(self, adapter: EthernetAdapter):
        self.adapter = adapter
        self.transport = None
    
    def connection_made(self, transport):
        self.transport = transport
    
    def datagram_received(self, data: bytes, addr: Tuple[str, int]):
        packet = DataPacket(
            data=data,
            direction=DataDirection.RX,
            metadata={
                'protocol': 'udp',
                'remote_addr': f"{addr[0]}:{addr[1]}"
            }
        )
        asyncio.create_task(self.adapter._handle_received_data(packet))
    
    def error_received(self, exc: Exception):
        logger.error(f"UDP error: {exc}")


class RawProtocol(asyncio.Protocol):
    """Asyncio protocol for raw socket communication"""
    
    def __init__(self, adapter: EthernetAdapter):
        self.adapter = adapter
        self.transport = None
    
    def connection_made(self, transport):
        self.transport = transport
    
    def data_received(self, data: bytes):
        packet = DataPacket(
            data=data,
            direction=DataDirection.RX,
            metadata={'protocol': 'raw'}
        )
        asyncio.create_task(self.adapter._handle_received_data(packet))