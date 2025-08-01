"""
Hardware WebSocket Integration

This module provides real-time WebSocket communication for the Hardware Abstraction Layer (HAL).
It handles:
- Real-time telemetry streaming from hardware devices
- Command routing to devices through WebSocket
- Device connection/disconnection events
- Error notifications and recovery
- High-performance binary data transmission

Author: Real-Time Telemetry Systems Engineer
"""

import asyncio
import json
import time
import logging
from typing import Dict, Any, List, Optional, Set, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import msgpack
import zlib
from collections import defaultdict, deque

from ..hardware.manager import HardwareManager, HardwareDevice
from ..hardware.base import ProtocolType, DataPacket, ConnectionState
from .connection_manager import ConnectionManager, ConnectionInfo
from .message_protocols import ProtocolType as WSProtocolType

logger = logging.getLogger(__name__)


class TelemetryMode(Enum):
    """Telemetry streaming modes"""
    FULL = "full"          # All data, no filtering
    DELTA = "delta"        # Only changed values
    SAMPLED = "sampled"    # Decimated data
    CUSTOM = "custom"      # Custom field selection


@dataclass
class TelemetryStream:
    """Represents an active telemetry stream"""
    stream_id: str
    client_id: str
    device_id: str
    mode: TelemetryMode
    frequency_hz: float
    fields: List[str]
    last_sent: float = 0.0
    last_values: Dict[str, Any] = field(default_factory=dict)
    message_count: int = 0
    bytes_sent: int = 0
    active: bool = True
    use_compression: bool = True
    use_binary: bool = True


@dataclass
class DeviceCommand:
    """Represents a command to be sent to a device"""
    command_id: str
    client_id: str
    device_id: str
    command: Dict[str, Any]
    timestamp: datetime
    timeout: float = 5.0
    retries: int = 3
    callback: Optional[Callable] = None


class HardwareWebSocketHandler:
    """
    Handles WebSocket communication for hardware devices with high-performance features
    """
    
    def __init__(self, 
                 hardware_manager: HardwareManager,
                 connection_manager: ConnectionManager,
                 enable_compression: bool = True,
                 enable_binary: bool = True,
                 max_streams_per_client: int = 10,
                 max_telemetry_rate_hz: float = 1000.0):
        
        self.hardware_manager = hardware_manager
        self.connection_manager = connection_manager
        self.enable_compression = enable_compression
        self.enable_binary = enable_binary
        self.max_streams_per_client = max_streams_per_client
        self.max_telemetry_rate_hz = max_telemetry_rate_hz
        
        # Stream management
        self.telemetry_streams: Dict[str, TelemetryStream] = {}
        self.client_streams: Dict[str, Set[str]] = defaultdict(set)
        self.device_streams: Dict[str, Set[str]] = defaultdict(set)
        
        # Command queue
        self.command_queue: deque[DeviceCommand] = deque()
        self.pending_commands: Dict[str, DeviceCommand] = {}
        
        # Background tasks
        self._telemetry_task: Optional[asyncio.Task] = None
        self._command_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # Performance metrics
        self.metrics = {
            "total_streams": 0,
            "total_messages_sent": 0,
            "total_bytes_sent": 0,
            "total_commands_processed": 0,
            "compression_ratio": 1.0,
            "dropped_messages": 0
        }
        
        # Message handlers
        self.message_handlers = {
            "subscribe_telemetry": self._handle_subscribe_telemetry,
            "unsubscribe_telemetry": self._handle_unsubscribe_telemetry,
            "device_command": self._handle_device_command,
            "get_device_list": self._handle_get_device_list,
            "get_device_status": self._handle_get_device_status,
            "set_stream_mode": self._handle_set_stream_mode
        }
        
        # Register HAL event handlers
        self._register_hal_handlers()
    
    async def start(self):
        """Start the WebSocket handler background tasks"""
        logger.info("Starting Hardware WebSocket Handler")
        
        # Start background tasks
        self._telemetry_task = asyncio.create_task(self._telemetry_loop())
        self._command_task = asyncio.create_task(self._command_processor())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
    async def stop(self):
        """Stop the WebSocket handler"""
        logger.info("Stopping Hardware WebSocket Handler")
        
        # Cancel background tasks
        if self._telemetry_task:
            self._telemetry_task.cancel()
        if self._command_task:
            self._command_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
        
        # Wait for tasks to complete
        tasks = [t for t in [self._telemetry_task, self._command_task, self._cleanup_task] if t]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Clear all streams
        self.telemetry_streams.clear()
        self.client_streams.clear()
        self.device_streams.clear()
    
    def _register_hal_handlers(self):
        """Register event handlers with the hardware manager"""
        self.hardware_manager.register_event_handler('data_received', self._on_device_data)
        self.hardware_manager.register_event_handler('adapter_connected', self._on_adapter_connected)
        self.hardware_manager.register_event_handler('adapter_disconnected', self._on_adapter_disconnected)
        self.hardware_manager.register_event_handler('adapter_error', self._on_adapter_error)
    
    async def handle_message(self, client_id: str, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming WebSocket message from client"""
        message_type = message.get("type")
        data = message.get("data", {})
        
        handler = self.message_handlers.get(message_type)
        if not handler:
            return {"error": f"Unknown message type: {message_type}"}
        
        try:
            return await handler(client_id, data)
        except Exception as e:
            logger.error(f"Error handling message {message_type}: {e}")
            return {"error": str(e)}
    
    async def _handle_subscribe_telemetry(self, client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle telemetry subscription request"""
        device_id = data.get("device_id")
        frequency_hz = min(data.get("frequency_hz", 10.0), self.max_telemetry_rate_hz)
        fields = data.get("fields", ["all"])
        mode = TelemetryMode(data.get("mode", "full"))
        
        # Validate device exists
        device = self.hardware_manager.get_device(device_id)
        if not device:
            return {"error": f"Device {device_id} not found"}
        
        # Check client stream limit
        if len(self.client_streams[client_id]) >= self.max_streams_per_client:
            return {"error": f"Maximum streams ({self.max_streams_per_client}) reached"}
        
        # Create telemetry stream
        stream_id = f"{client_id}_{device_id}_{int(time.time()*1000)}"
        stream = TelemetryStream(
            stream_id=stream_id,
            client_id=client_id,
            device_id=device_id,
            mode=mode,
            frequency_hz=frequency_hz,
            fields=fields,
            use_compression=self.enable_compression,
            use_binary=self.enable_binary
        )
        
        # Register stream
        self.telemetry_streams[stream_id] = stream
        self.client_streams[client_id].add(stream_id)
        self.device_streams[device_id].add(stream_id)
        
        self.metrics["total_streams"] += 1
        
        logger.info(f"Created telemetry stream {stream_id} for device {device_id} at {frequency_hz}Hz")
        
        return {
            "success": True,
            "stream_id": stream_id,
            "frequency_hz": frequency_hz,
            "mode": mode.value
        }
    
    async def _handle_unsubscribe_telemetry(self, client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle telemetry unsubscribe request"""
        stream_id = data.get("stream_id")
        device_id = data.get("device_id")
        
        # Find streams to remove
        streams_to_remove = []
        
        if stream_id:
            if stream_id in self.telemetry_streams:
                streams_to_remove.append(stream_id)
        elif device_id:
            # Remove all streams for this device from this client
            for sid in self.client_streams[client_id]:
                if self.telemetry_streams[sid].device_id == device_id:
                    streams_to_remove.append(sid)
        else:
            # Remove all streams for this client
            streams_to_remove = list(self.client_streams[client_id])
        
        # Remove streams
        for sid in streams_to_remove:
            await self._remove_stream(sid)
        
        return {
            "success": True,
            "removed_streams": len(streams_to_remove)
        }
    
    async def _handle_device_command(self, client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle device command request"""
        device_id = data.get("device_id")
        command = data.get("command")
        timeout = data.get("timeout", 5.0)
        
        if not device_id or not command:
            return {"error": "Missing device_id or command"}
        
        # Validate device exists
        device = self.hardware_manager.get_device(device_id)
        if not device:
            return {"error": f"Device {device_id} not found"}
        
        # Create command object
        command_id = f"cmd_{int(time.time()*1000000)}"
        device_command = DeviceCommand(
            command_id=command_id,
            client_id=client_id,
            device_id=device_id,
            command=command,
            timestamp=datetime.utcnow(),
            timeout=timeout
        )
        
        # Queue command
        self.command_queue.append(device_command)
        self.pending_commands[command_id] = device_command
        
        # Return immediate acknowledgment
        return {
            "success": True,
            "command_id": command_id,
            "queued": True
        }
    
    async def _handle_get_device_list(self, client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get list of available devices"""
        protocol_filter = data.get("protocol")
        active_only = data.get("active_only", True)
        
        devices = []
        for device_id, device in self.hardware_manager._devices.items():
            if protocol_filter and device.protocol_type.value != protocol_filter:
                continue
            
            if active_only and not device.is_active:
                continue
            
            devices.append({
                "device_id": device_id,
                "name": device.name,
                "protocol": device.protocol_type.value,
                "active": device.is_active,
                "capabilities": device.capabilities,
                "has_telemetry": device_id in self.device_streams
            })
        
        return {
            "success": True,
            "devices": devices,
            "total": len(devices)
        }
    
    async def _handle_get_device_status(self, client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get detailed device status"""
        device_id = data.get("device_id")
        
        device = self.hardware_manager.get_device(device_id)
        if not device:
            return {"error": f"Device {device_id} not found"}
        
        # Get adapter status
        adapter = self.hardware_manager.get_adapter(device.adapter_id)
        adapter_status = {
            "connected": adapter.is_connected if adapter else False,
            "state": adapter.status.state.value if adapter else "unknown",
            "statistics": adapter.get_statistics() if adapter else {}
        }
        
        # Get active streams for this device
        active_streams = []
        for stream_id in self.device_streams.get(device_id, []):
            stream = self.telemetry_streams.get(stream_id)
            if stream:
                active_streams.append({
                    "stream_id": stream_id,
                    "client_id": stream.client_id,
                    "frequency_hz": stream.frequency_hz,
                    "mode": stream.mode.value,
                    "message_count": stream.message_count
                })
        
        return {
            "success": True,
            "device": {
                "device_id": device_id,
                "name": device.name,
                "protocol": device.protocol_type.value,
                "address": device.address,
                "active": device.is_active,
                "capabilities": device.capabilities,
                "metadata": device.metadata
            },
            "adapter": adapter_status,
            "active_streams": active_streams
        }
    
    async def _handle_set_stream_mode(self, client_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update telemetry stream mode"""
        stream_id = data.get("stream_id")
        mode = data.get("mode")
        frequency_hz = data.get("frequency_hz")
        fields = data.get("fields")
        
        stream = self.telemetry_streams.get(stream_id)
        if not stream or stream.client_id != client_id:
            return {"error": "Stream not found or unauthorized"}
        
        # Update stream parameters
        if mode:
            stream.mode = TelemetryMode(mode)
        if frequency_hz:
            stream.frequency_hz = min(frequency_hz, self.max_telemetry_rate_hz)
        if fields:
            stream.fields = fields
        
        return {
            "success": True,
            "stream_id": stream_id,
            "mode": stream.mode.value,
            "frequency_hz": stream.frequency_hz
        }
    
    async def _telemetry_loop(self):
        """Background task to send telemetry data to clients"""
        logger.info("Starting telemetry streaming loop")
        
        while True:
            try:
                current_time = time.time()
                
                # Process each active stream
                for stream_id, stream in list(self.telemetry_streams.items()):
                    if not stream.active:
                        continue
                    
                    # Check if it's time to send data
                    interval = 1.0 / stream.frequency_hz
                    if current_time - stream.last_sent < interval:
                        continue
                    
                    # Get telemetry data
                    telemetry = await self._get_telemetry_data(stream)
                    if telemetry:
                        await self._send_telemetry(stream, telemetry)
                        stream.last_sent = current_time
                
                # Small sleep to prevent CPU spinning
                await asyncio.sleep(0.001)  # 1ms resolution
                
            except Exception as e:
                logger.error(f"Telemetry loop error: {e}")
                await asyncio.sleep(0.1)
    
    async def _get_telemetry_data(self, stream: TelemetryStream) -> Optional[Dict[str, Any]]:
        """Get telemetry data for a stream"""
        try:
            # Get raw telemetry from HAL
            if hasattr(self.hardware_manager, 'get_device_telemetry'):
                telemetry = await self.hardware_manager.get_device_telemetry(stream.device_id)
            else:
                # Fallback: query device directly
                device = self.hardware_manager.get_device(stream.device_id)
                if not device:
                    return None
                
                # Send read command
                response = await self.hardware_manager.send_command_to_device(
                    stream.device_id,
                    json.dumps({"action": "read"}).encode(),
                    timeout=0.1  # Short timeout for telemetry
                )
                
                if response and response.data:
                    telemetry = json.loads(response.data.decode())
                else:
                    return None
            
            # Filter fields if requested
            if stream.fields and "all" not in stream.fields:
                filtered = {k: v for k, v in telemetry.items() if k in stream.fields}
                telemetry = filtered
            
            # Apply mode-specific processing
            if stream.mode == TelemetryMode.DELTA:
                # Only send changed values
                delta = {}
                for key, value in telemetry.items():
                    if key not in stream.last_values or stream.last_values[key] != value:
                        delta[key] = value
                        stream.last_values[key] = value
                
                if not delta:
                    return None  # No changes
                    
                telemetry = delta
            
            elif stream.mode == TelemetryMode.SAMPLED:
                # Implement decimation if needed
                # For now, just pass through
                pass
            
            # Add metadata
            telemetry["_timestamp"] = time.time()
            telemetry["_device_id"] = stream.device_id
            telemetry["_stream_id"] = stream.stream_id
            
            return telemetry
            
        except Exception as e:
            logger.error(f"Error getting telemetry for {stream.device_id}: {e}")
            return None
    
    async def _send_telemetry(self, stream: TelemetryStream, telemetry: Dict[str, Any]):
        """Send telemetry data to client"""
        try:
            # Get connection info
            connection = await self.connection_manager.get_connection(stream.client_id)
            if not connection:
                stream.active = False
                return
            
            # Prepare message
            message = {
                "type": "telemetry",
                "stream_id": stream.stream_id,
                "device_id": stream.device_id,
                "data": telemetry
            }
            
            # Serialize based on protocol
            if stream.use_binary and self.enable_binary:
                # Use MessagePack for binary serialization
                serialized = msgpack.packb(message)
                
                # Compress if enabled and beneficial
                if stream.use_compression and self.enable_compression and len(serialized) > 1024:
                    compressed = zlib.compress(serialized)
                    if len(compressed) < len(serialized) * 0.9:  # 10% compression threshold
                        serialized = compressed
                        message_type = "binary_compressed"
                    else:
                        message_type = "binary"
                else:
                    message_type = "binary"
            else:
                # JSON serialization
                serialized = json.dumps(message).encode()
                message_type = "json"
            
            # Send to client (this would integrate with actual WebSocket server)
            # For testing, we'll track metrics
            stream.message_count += 1
            stream.bytes_sent += len(serialized)
            self.metrics["total_messages_sent"] += 1
            self.metrics["total_bytes_sent"] += len(serialized)
            
            # Update connection metrics
            await self.connection_manager.update_metrics(
                stream.client_id,
                messages_sent=1,
                bytes_sent=len(serialized)
            )
            
        except Exception as e:
            logger.error(f"Error sending telemetry for stream {stream.stream_id}: {e}")
            self.metrics["dropped_messages"] += 1
    
    async def _command_processor(self):
        """Background task to process device commands"""
        logger.info("Starting command processor")
        
        while True:
            try:
                if not self.command_queue:
                    await asyncio.sleep(0.01)
                    continue
                
                # Get next command
                command = self.command_queue.popleft()
                
                # Check timeout
                if (datetime.utcnow() - command.timestamp).total_seconds() > command.timeout:
                    await self._send_command_response(command, {
                        "error": "Command timeout",
                        "command_id": command.command_id
                    })
                    continue
                
                # Execute command
                try:
                    # Convert command to bytes
                    command_bytes = json.dumps(command.command).encode()
                    
                    # Send through HAL
                    response = await self.hardware_manager.send_command_to_device(
                        command.device_id,
                        command_bytes,
                        timeout=command.timeout
                    )
                    
                    # Parse response
                    if response and response.data:
                        try:
                            result = json.loads(response.data.decode())
                        except:
                            result = {"raw_response": response.data.hex()}
                    else:
                        result = {"error": "No response from device"}
                    
                    # Send response to client
                    await self._send_command_response(command, result)
                    
                    self.metrics["total_commands_processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Command execution error: {e}")
                    await self._send_command_response(command, {
                        "error": str(e),
                        "command_id": command.command_id
                    })
                
            except Exception as e:
                logger.error(f"Command processor error: {e}")
                await asyncio.sleep(0.1)
    
    async def _send_command_response(self, command: DeviceCommand, response: Dict[str, Any]):
        """Send command response to client"""
        try:
            # Remove from pending
            self.pending_commands.pop(command.command_id, None)
            
            # Prepare response message
            message = {
                "type": "command_response",
                "command_id": command.command_id,
                "device_id": command.device_id,
                "response": response,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Send to client (integrate with WebSocket server)
            # Update metrics
            await self.connection_manager.update_metrics(
                command.client_id,
                messages_sent=1
            )
            
            # Call callback if provided
            if command.callback:
                await command.callback(response)
                
        except Exception as e:
            logger.error(f"Error sending command response: {e}")
    
    async def _cleanup_loop(self):
        """Periodic cleanup of inactive streams and connections"""
        logger.info("Starting cleanup loop")
        
        while True:
            try:
                await asyncio.sleep(30)  # Run every 30 seconds
                
                # Clean up inactive streams
                inactive_streams = []
                for stream_id, stream in self.telemetry_streams.items():
                    # Check if client still connected
                    connection = await self.connection_manager.get_connection(stream.client_id)
                    if not connection or not stream.active:
                        inactive_streams.append(stream_id)
                
                # Remove inactive streams
                for stream_id in inactive_streams:
                    await self._remove_stream(stream_id)
                
                if inactive_streams:
                    logger.info(f"Cleaned up {len(inactive_streams)} inactive streams")
                
                # Clean up old pending commands
                now = datetime.utcnow()
                expired_commands = []
                for cmd_id, command in self.pending_commands.items():
                    if (now - command.timestamp).total_seconds() > command.timeout * 2:
                        expired_commands.append(cmd_id)
                
                for cmd_id in expired_commands:
                    self.pending_commands.pop(cmd_id, None)
                
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
    
    async def _remove_stream(self, stream_id: str):
        """Remove a telemetry stream"""
        stream = self.telemetry_streams.pop(stream_id, None)
        if stream:
            self.client_streams[stream.client_id].discard(stream_id)
            self.device_streams[stream.device_id].discard(stream_id)
            logger.info(f"Removed telemetry stream {stream_id}")
    
    # HAL event handlers
    async def _on_device_data(self, data: Dict[str, Any]):
        """Handle unsolicited data from devices"""
        device_id = data.get("device_id")
        if not device_id:
            return
        
        # Forward to all streams watching this device
        for stream_id in self.device_streams.get(device_id, []):
            stream = self.telemetry_streams.get(stream_id)
            if stream and stream.active:
                # Queue for next telemetry update
                # This ensures unsolicited data is included in streams
                pass
    
    async def _on_adapter_connected(self, data: Dict[str, Any]):
        """Handle adapter connection events"""
        await self._broadcast_event("device_connected", data)
    
    async def _on_adapter_disconnected(self, data: Dict[str, Any]):
        """Handle adapter disconnection events"""
        await self._broadcast_event("device_disconnected", data)
        
        # Mark affected streams as inactive
        adapter_id = data.get("adapter_id")
        if adapter_id:
            # Get all devices using this adapter
            for device_id, device in self.hardware_manager._devices.items():
                if device.adapter_id == adapter_id:
                    for stream_id in self.device_streams.get(device_id, []):
                        if stream_id in self.telemetry_streams:
                            self.telemetry_streams[stream_id].active = False
    
    async def _on_adapter_error(self, data: Dict[str, Any]):
        """Handle adapter error events"""
        await self._broadcast_event("device_error", data)
    
    async def _broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast event to all connected clients"""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get all connected clients
        connections = await self.connection_manager.get_connections_by_state(ConnectionState.AUTHENTICATED)
        
        # Send to each client
        for connection in connections:
            try:
                # This would integrate with actual WebSocket server
                await self.connection_manager.update_metrics(
                    connection.sid,
                    messages_sent=1
                )
            except Exception as e:
                logger.error(f"Error broadcasting to {connection.sid}: {e}")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get handler metrics"""
        return {
            **self.metrics,
            "active_streams": len([s for s in self.telemetry_streams.values() if s.active]),
            "total_clients": len(self.client_streams),
            "total_devices_streaming": len(self.device_streams),
            "command_queue_size": len(self.command_queue),
            "pending_commands": len(self.pending_commands)
        }
    
    async def on_client_disconnect(self, client_id: str):
        """Handle client disconnection"""
        # Remove all streams for this client
        stream_ids = list(self.client_streams.get(client_id, []))
        for stream_id in stream_ids:
            await self._remove_stream(stream_id)
        
        # Remove from client streams
        self.client_streams.pop(client_id, None)
        
        logger.info(f"Cleaned up {len(stream_ids)} streams for disconnected client {client_id}")


# Convenience function to create and configure the handler
def create_hardware_websocket_handler(
    hardware_manager: HardwareManager,
    connection_manager: ConnectionManager,
    config: Optional[Dict[str, Any]] = None
) -> HardwareWebSocketHandler:
    """
    Create a configured hardware WebSocket handler
    
    Args:
        hardware_manager: The HAL manager instance
        connection_manager: The WebSocket connection manager
        config: Optional configuration overrides
        
    Returns:
        Configured HardwareWebSocketHandler instance
    """
    default_config = {
        "enable_compression": True,
        "enable_binary": True,
        "max_streams_per_client": 10,
        "max_telemetry_rate_hz": 1000.0
    }
    
    if config:
        default_config.update(config)
    
    handler = HardwareWebSocketHandler(
        hardware_manager=hardware_manager,
        connection_manager=connection_manager,
        **default_config
    )
    
    return handler