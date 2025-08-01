"""
Message Protocol Definitions and Binary Protocol Support

This module provides comprehensive protocol support for WebSocket communication:
- Multiple message formats (JSON, MessagePack, Protocol Buffers)
- Protocol negotiation based on client capabilities
- Efficient binary serialization/deserialization
- Message compression and optimization
- Protocol versioning and compatibility
"""

import json
import struct
import zlib
import logging
from typing import Dict, List, Optional, Any, Union, Tuple, Protocol
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
import asyncio

try:
    import msgpack
    MSGPACK_AVAILABLE = True
except ImportError:
    MSGPACK_AVAILABLE = False
    msgpack = None

try:
    import cbor2
    CBOR_AVAILABLE = True
except ImportError:
    CBOR_AVAILABLE = False
    cbor2 = None

logger = logging.getLogger(__name__)


class ProtocolType(Enum):
    """Supported protocol types"""
    JSON = "json"
    MSGPACK = "msgpack"
    CBOR = "cbor"
    BINARY = "binary"
    COMPRESSED_JSON = "compressed_json"


class CompressionType(Enum):
    """Supported compression types"""
    NONE = "none"
    GZIP = "gzip"
    DEFLATE = "deflate"
    LZ4 = "lz4"


@dataclass
class ProtocolCapabilities:
    """Client protocol capabilities"""
    supported_protocols: List[ProtocolType] = field(default_factory=lambda: [ProtocolType.JSON])
    supports_compression: bool = False
    compression_types: List[CompressionType] = field(default_factory=lambda: [CompressionType.NONE])
    max_message_size: int = 1048576  # 1MB
    preferred_protocol: Optional[ProtocolType] = None
    version: str = "1.0"


@dataclass
class MessageHeader:
    """Binary message header"""
    protocol: ProtocolType
    compression: CompressionType
    message_type: str
    payload_length: int
    timestamp: float
    version: int = 1
    flags: int = 0
    checksum: Optional[int] = None
    
    def to_bytes(self) -> bytes:
        """Serialize header to bytes"""
        # Header format: version(1) + protocol(1) + compression(1) + flags(1) + 
        #                message_type_len(1) + message_type + payload_length(4) + 
        #                timestamp(8) + checksum(4)
        
        message_type_bytes = self.message_type.encode('utf-8')[:255]
        message_type_len = len(message_type_bytes)
        
        header = struct.pack(
            '!BBBBIB8sI',
            self.version,
            list(ProtocolType).index(self.protocol),
            list(CompressionType).index(self.compression),
            self.flags,
            message_type_len,
            self.payload_length,
            struct.pack('d', self.timestamp),
            self.checksum or 0
        )
        
        return header + message_type_bytes
    
    @classmethod
    def from_bytes(cls, data: bytes) -> Tuple['MessageHeader', int]:
        """Deserialize header from bytes"""
        if len(data) < 25:  # Minimum header size
            raise ValueError("Invalid header data")
        
        # Unpack fixed part
        version, protocol_idx, compression_idx, flags, msg_type_len, payload_length, timestamp_bytes, checksum = struct.unpack('!BBBBIB8sI', data[:25])
        
        # Extract message type
        if len(data) < 25 + msg_type_len:
            raise ValueError("Invalid header data")
        
        message_type = data[25:25 + msg_type_len].decode('utf-8')
        timestamp = struct.unpack('d', timestamp_bytes)[0]
        
        header = cls(
            version=version,
            protocol=list(ProtocolType)[protocol_idx],
            compression=list(CompressionType)[compression_idx],
            message_type=message_type,
            payload_length=payload_length,
            timestamp=timestamp,
            flags=flags,
            checksum=checksum if checksum != 0 else None
        )
        
        return header, 25 + msg_type_len


class MessageEncoder:
    """Message encoding utilities"""
    
    @staticmethod
    def encode_json(data: Any, compressed: bool = False) -> bytes:
        """Encode data as JSON"""
        json_str = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
        json_bytes = json_str.encode('utf-8')
        
        if compressed:
            return zlib.compress(json_bytes)
        return json_bytes
    
    @staticmethod
    def decode_json(data: bytes, compressed: bool = False) -> Any:
        """Decode JSON data"""
        if compressed:
            data = zlib.decompress(data)
        return json.loads(data.decode('utf-8'))
    
    @staticmethod
    def encode_msgpack(data: Any) -> bytes:
        """Encode data as MessagePack"""
        if not MSGPACK_AVAILABLE:
            raise RuntimeError("MessagePack not available")
        return msgpack.packb(data, use_bin_type=True)
    
    @staticmethod
    def decode_msgpack(data: bytes) -> Any:
        """Decode MessagePack data"""
        if not MSGPACK_AVAILABLE:
            raise RuntimeError("MessagePack not available")
        return msgpack.unpackb(data, raw=False, strict_map_key=False)
    
    @staticmethod
    def encode_cbor(data: Any) -> bytes:
        """Encode data as CBOR"""
        if not CBOR_AVAILABLE:
            raise RuntimeError("CBOR not available")
        return cbor2.dumps(data)
    
    @staticmethod
    def decode_cbor(data: bytes) -> Any:
        """Decode CBOR data"""
        if not CBOR_AVAILABLE:
            raise RuntimeError("CBOR not available")
        return cbor2.loads(data)
    
    @staticmethod
    def compress_data(data: bytes, compression_type: CompressionType) -> bytes:
        """Compress data using specified method"""
        if compression_type == CompressionType.GZIP:
            return zlib.compress(data)
        elif compression_type == CompressionType.DEFLATE:
            return zlib.compress(data, wbits=-15)  # Raw deflate
        elif compression_type == CompressionType.LZ4:
            try:
                import lz4.frame
                return lz4.frame.compress(data)
            except ImportError:
                logger.warning("LZ4 not available, falling back to gzip")
                return zlib.compress(data)
        else:
            return data
    
    @staticmethod
    def decompress_data(data: bytes, compression_type: CompressionType) -> bytes:
        """Decompress data using specified method"""
        if compression_type == CompressionType.GZIP:
            return zlib.decompress(data)
        elif compression_type == CompressionType.DEFLATE:
            return zlib.decompress(data, wbits=-15)  # Raw deflate
        elif compression_type == CompressionType.LZ4:
            try:
                import lz4.frame
                return lz4.frame.decompress(data)
            except ImportError:
                logger.warning("LZ4 not available, assuming gzip")
                return zlib.decompress(data)
        else:
            return data


class TelemetryProtocol:
    """Specialized protocol for telemetry data"""
    
    @staticmethod
    def encode_telemetry(telemetry_data: Dict[str, Any], protocol: ProtocolType) -> bytes:
        """Encode telemetry data efficiently"""
        if protocol == ProtocolType.BINARY:
            return TelemetryProtocol._encode_telemetry_binary(telemetry_data)
        elif protocol == ProtocolType.MSGPACK:
            return MessageEncoder.encode_msgpack(telemetry_data)
        elif protocol == ProtocolType.CBOR:
            return MessageEncoder.encode_cbor(telemetry_data)
        else:
            return MessageEncoder.encode_json(telemetry_data)
    
    @staticmethod
    def _encode_telemetry_binary(data: Dict[str, Any]) -> bytes:
        """Encode telemetry data in custom binary format for maximum efficiency"""
        # Custom binary format for telemetry:
        # timestamp(8) + battery_motor_voltage(4) + battery_logic_voltage(4) + 
        # temperature(4) + wheel_rpms(4*4) + position(4*3) + flags(2)
        
        try:
            timestamp = struct.pack('d', data.get('timestamp', datetime.utcnow().timestamp()))
            
            battery = data.get('battery', {})
            motor_voltage = struct.pack('f', battery.get('motor', {}).get('voltage', 0.0))
            logic_voltage = struct.pack('f', battery.get('logic', {}).get('voltage', 0.0))
            
            temperature = struct.pack('f', data.get('temp', 0.0))
            
            wheels = data.get('wheels', {})
            wheel_rpms = b''.join([
                struct.pack('f', wheels.get('fl', {}).get('rpm', 0)),
                struct.pack('f', wheels.get('fr', {}).get('rpm', 0)),
                struct.pack('f', wheels.get('rl', {}).get('rpm', 0)),
                struct.pack('f', wheels.get('rr', {}).get('rpm', 0))
            ])
            
            position = data.get('position', [0.0, 0.0, 0.0])
            position_data = b''.join([struct.pack('f', float(p)) for p in position[:3]])
            
            # Flags: bit 0 = emergency_stop, bit 1 = watchdog_triggered
            flags = 0
            if data.get('emergency_stop', False):
                flags |= 1
            if data.get('watchdog_triggered', False):
                flags |= 2
            flags_data = struct.pack('H', flags)
            
            return timestamp + motor_voltage + logic_voltage + temperature + wheel_rpms + position_data + flags_data
            
        except Exception as e:
            logger.error(f"Binary telemetry encoding error: {e}")
            # Fallback to JSON
            return MessageEncoder.encode_json(data)
    
    @staticmethod
    def decode_telemetry_binary(data: bytes) -> Dict[str, Any]:
        """Decode binary telemetry data"""
        if len(data) < 46:  # Minimum expected size
            raise ValueError("Invalid binary telemetry data")
        
        try:
            offset = 0
            
            timestamp = struct.unpack('d', data[offset:offset+8])[0]
            offset += 8
            
            motor_voltage = struct.unpack('f', data[offset:offset+4])[0]
            offset += 4
            
            logic_voltage = struct.unpack('f', data[offset:offset+4])[0]
            offset += 4
            
            temperature = struct.unpack('f', data[offset:offset+4])[0]
            offset += 4
            
            wheel_rpms = struct.unpack('ffff', data[offset:offset+16])
            offset += 16
            
            position = struct.unpack('fff', data[offset:offset+12])
            offset += 12
            
            flags = struct.unpack('H', data[offset:offset+2])[0]
            
            return {
                'timestamp': datetime.fromtimestamp(timestamp).isoformat(),
                'battery': {
                    'motor': {'voltage': motor_voltage},
                    'logic': {'voltage': logic_voltage}
                },
                'temp': temperature,
                'wheels': {
                    'fl': {'rpm': wheel_rpms[0]},
                    'fr': {'rpm': wheel_rpms[1]},
                    'rl': {'rpm': wheel_rpms[2]},
                    'rr': {'rpm': wheel_rpms[3]}
                },
                'position': list(position),
                'emergency_stop': bool(flags & 1),
                'watchdog_triggered': bool(flags & 2)
            }
            
        except Exception as e:
            logger.error(f"Binary telemetry decoding error: {e}")
            raise ValueError("Failed to decode binary telemetry data")


class MessageProtocolManager:
    """Manages protocol negotiation and message encoding/decoding"""
    
    def __init__(self):
        self.client_protocols: Dict[str, ProtocolCapabilities] = {}
        self.default_protocol = ProtocolType.JSON
        self.compression_threshold = 1024  # Compress messages larger than 1KB
        
        # Statistics
        self.stats = {
            "messages_encoded": 0,
            "messages_decoded": 0,
            "bytes_saved_compression": 0,
            "protocol_negotiations": 0,
            "encoding_errors": 0
        }
    
    async def negotiate_protocol(
        self,
        sid: str,
        client_type: str,
        user_agent: str,
        requested_protocols: Optional[List[str]] = None
    ) -> ProtocolType:
        """Negotiate the best protocol for a client connection"""
        try:
            # Parse client capabilities
            capabilities = self._parse_client_capabilities(client_type, user_agent, requested_protocols)
            
            # Store client capabilities
            self.client_protocols[sid] = capabilities
            
            # Choose best protocol
            protocol = self._select_best_protocol(capabilities)
            
            self.stats["protocol_negotiations"] += 1
            
            logger.info(f"Negotiated protocol {protocol.value} for client {sid} ({client_type})")
            return protocol
            
        except Exception as e:
            logger.error(f"Protocol negotiation error for {sid}: {e}")
            return self.default_protocol
    
    def _parse_client_capabilities(
        self,
        client_type: str,
        user_agent: str,
        requested_protocols: Optional[List[str]] = None
    ) -> ProtocolCapabilities:
        """Parse client capabilities from connection info"""
        capabilities = ProtocolCapabilities()
        
        # Default capabilities based on client type
        if client_type == "browser":
            capabilities.supported_protocols = [ProtocolType.JSON, ProtocolType.COMPRESSED_JSON]
            capabilities.supports_compression = True
            capabilities.compression_types = [CompressionType.GZIP]
        elif client_type == "mobile":
            capabilities.supported_protocols = [ProtocolType.JSON]
            if MSGPACK_AVAILABLE:
                capabilities.supported_protocols.append(ProtocolType.MSGPACK)
            capabilities.supports_compression = True
            capabilities.compression_types = [CompressionType.GZIP]
        else:
            # Unknown client - use conservative defaults
            capabilities.supported_protocols = [ProtocolType.JSON]
        
        # Override with explicitly requested protocols
        if requested_protocols:
            supported = []
            for proto_str in requested_protocols:
                try:
                    proto = ProtocolType(proto_str.lower())
                    if self._is_protocol_available(proto):
                        supported.append(proto)
                except ValueError:
                    continue
            
            if supported:
                capabilities.supported_protocols = supported
        
        # Set preferred protocol (first in list)
        if capabilities.supported_protocols:
            capabilities.preferred_protocol = capabilities.supported_protocols[0]
        
        return capabilities
    
    def _is_protocol_available(self, protocol: ProtocolType) -> bool:
        """Check if a protocol is available on the server"""
        if protocol == ProtocolType.MSGPACK and not MSGPACK_AVAILABLE:
            return False
        if protocol == ProtocolType.CBOR and not CBOR_AVAILABLE:
            return False
        return True
    
    def _select_best_protocol(self, capabilities: ProtocolCapabilities) -> ProtocolType:
        """Select the best protocol based on capabilities"""
        # Priority order (most efficient first)
        priority_order = [
            ProtocolType.MSGPACK,
            ProtocolType.CBOR,
            ProtocolType.BINARY,
            ProtocolType.COMPRESSED_JSON,
            ProtocolType.JSON
        ]
        
        # Return first available protocol from priority list
        for protocol in priority_order:
            if protocol in capabilities.supported_protocols and self._is_protocol_available(protocol):
                return protocol
        
        return ProtocolType.JSON  # Fallback
    
    async def encode_message(
        self,
        sid: str,
        message_type: str,
        data: Any,
        force_protocol: Optional[ProtocolType] = None
    ) -> Union[bytes, str]:
        """Encode message using the negotiated protocol"""
        try:
            capabilities = self.client_protocols.get(sid)
            if not capabilities:
                # No negotiation happened, use default
                protocol = force_protocol or self.default_protocol
                compression = CompressionType.NONE
            else:
                protocol = force_protocol or capabilities.preferred_protocol or self.default_protocol
                compression = capabilities.compression_types[0] if capabilities.supports_compression else CompressionType.NONE
            
            # Special handling for telemetry
            if message_type == "telemetry" and isinstance(data, dict):
                encoded_data = TelemetryProtocol.encode_telemetry(data, protocol)
            else:
                # Regular message encoding
                if protocol == ProtocolType.JSON:
                    encoded_data = MessageEncoder.encode_json(data)
                elif protocol == ProtocolType.COMPRESSED_JSON:
                    encoded_data = MessageEncoder.encode_json(data, compressed=True)
                elif protocol == ProtocolType.MSGPACK:
                    encoded_data = MessageEncoder.encode_msgpack(data)
                elif protocol == ProtocolType.CBOR:
                    encoded_data = MessageEncoder.encode_cbor(data)
                elif protocol == ProtocolType.BINARY:
                    # For binary protocol, create a structured message
                    binary_message = {
                        "type": message_type,
                        "timestamp": datetime.utcnow().isoformat(),
                        "data": data
                    }
                    encoded_data = MessageEncoder.encode_msgpack(binary_message)
                else:
                    encoded_data = MessageEncoder.encode_json(data)
            
            # Apply compression if beneficial
            if (compression != CompressionType.NONE and 
                isinstance(encoded_data, bytes) and 
                len(encoded_data) > self.compression_threshold):
                
                original_size = len(encoded_data)
                compressed_data = MessageEncoder.compress_data(encoded_data, compression)
                
                if len(compressed_data) < original_size:
                    self.stats["bytes_saved_compression"] += original_size - len(compressed_data)
                    
                    # Create binary message with header for compressed data
                    header = MessageHeader(
                        protocol=protocol,
                        compression=compression,
                        message_type=message_type,
                        payload_length=len(compressed_data),
                        timestamp=datetime.utcnow().timestamp()
                    )
                    
                    encoded_data = header.to_bytes() + compressed_data
            
            self.stats["messages_encoded"] += 1
            
            # Return string for JSON, bytes for binary protocols
            if protocol == ProtocolType.JSON and isinstance(encoded_data, bytes) and not compression:
                return encoded_data.decode('utf-8')
            else:
                return encoded_data
            
        except Exception as e:
            logger.error(f"Message encoding error for {sid}: {e}")
            self.stats["encoding_errors"] += 1
            
            # Fallback to JSON
            return json.dumps({
                "type": message_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat(),
                "error": "Encoding fallback"
            })
    
    async def decode_message(self, sid: str, data: Union[bytes, str]) -> Tuple[str, Any]:
        """Decode incoming message"""
        try:
            if isinstance(data, str):
                # JSON message
                message = json.loads(data)
                message_type = message.get("type", "unknown")
                payload = message.get("data", message)
                
            elif isinstance(data, bytes):
                # Binary message - check for header
                if len(data) > 25:  # Minimum header size
                    try:
                        header, header_size = MessageHeader.from_bytes(data)
                        payload_data = data[header_size:header_size + header.payload_length]
                        
                        # Decompress if needed
                        if header.compression != CompressionType.NONE:
                            payload_data = MessageEncoder.decompress_data(payload_data, header.compression)
                        
                        # Decode based on protocol
                        if header.protocol == ProtocolType.MSGPACK:
                            message = MessageEncoder.decode_msgpack(payload_data)
                        elif header.protocol == ProtocolType.CBOR:
                            message = MessageEncoder.decode_cbor(payload_data)
                        elif header.protocol == ProtocolType.JSON:
                            message = MessageEncoder.decode_json(payload_data)
                        else:
                            message = MessageEncoder.decode_msgpack(payload_data)  # Default for binary
                        
                        message_type = header.message_type
                        payload = message.get("data", message) if isinstance(message, dict) else message
                        
                    except Exception as header_error:
                        logger.warning(f"Binary header parsing failed, trying direct decode: {header_error}")
                        # Try direct MessagePack decode
                        message = MessageEncoder.decode_msgpack(data)
                        message_type = message.get("type", "unknown") if isinstance(message, dict) else "binary_data"
                        payload = message.get("data", message) if isinstance(message, dict) else message
                else:
                    # Small binary data, try direct decode
                    message = MessageEncoder.decode_msgpack(data)
                    message_type = message.get("type", "unknown") if isinstance(message, dict) else "binary_data"
                    payload = message.get("data", message) if isinstance(message, dict) else message
            else:
                raise ValueError(f"Unsupported data type: {type(data)}")
            
            self.stats["messages_decoded"] += 1
            return message_type, payload
            
        except Exception as e:
            logger.error(f"Message decoding error for {sid}: {e}")
            # Return error message
            return "error", {"error": f"Decoding failed: {str(e)}", "original_data_type": type(data).__name__}
    
    async def process_binary_message(self, sid: str, data: bytes, protocol: ProtocolType) -> Optional[Dict[str, Any]]:
        """Process binary message specifically"""
        try:
            message_type, payload = await self.decode_message(sid, data)
            
            # Return acknowledgment for binary messages
            return {
                "type": "binary_ack",
                "message_type": message_type,
                "bytes_received": len(data),
                "protocol": protocol.value,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Binary message processing error: {e}")
            return None
    
    def get_client_protocol(self, sid: str) -> Optional[ProtocolType]:
        """Get the negotiated protocol for a client"""
        capabilities = self.client_protocols.get(sid)
        return capabilities.preferred_protocol if capabilities else None
    
    def cleanup_client(self, sid: str):
        """Clean up client protocol info"""
        self.client_protocols.pop(sid, None)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get protocol manager statistics"""
        return {
            **self.stats,
            "active_clients": len(self.client_protocols),
            "available_protocols": [p.value for p in ProtocolType if self._is_protocol_available(p)]
        }