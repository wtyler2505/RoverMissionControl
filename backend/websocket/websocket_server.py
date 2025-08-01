"""
WebSocket Server Core Implementation using Socket.IO v4.x with FastAPI Integration

This module provides a comprehensive WebSocket server infrastructure for the rover mission control system.
Features:
- Socket.IO v4.x integration with FastAPI
- Authentication and authorization
- Binary protocol support
- Connection pooling and resource management
- Heartbeat/ping-pong mechanism
- Message queuing and backpressure handling
- Subprotocol negotiation
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any, Set, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

import socketio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .connection_manager import ConnectionManager, ConnectionInfo
from .event_handlers import EventHandlerRegistry
from .message_protocols import MessageProtocolManager, ProtocolType
from .websocket_middleware import WebSocketAuthMiddleware, SecurityConfig
from ..auth.dependencies import get_current_user, get_optional_user
from ..auth.models import User

# Configure logging
logger = logging.getLogger(__name__)


class ServerState(Enum):
    """WebSocket server state"""
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"


@dataclass
class ServerConfig:
    """WebSocket server configuration"""
    # Connection settings
    cors_allowed_origins: List[str] = field(default_factory=lambda: ["*"])
    cors_allowed_methods: List[str] = field(default_factory=lambda: ["GET", "POST"])
    cors_credentials: bool = True
    
    # Socket.IO settings
    async_mode: str = "asgi"
    logger_enabled: bool = True
    engineio_logger_enabled: bool = False
    ping_timeout: int = 20
    ping_interval: int = 25
    max_http_buffer_size: int = 1000000  # 1MB
    
    # Connection management
    max_connections: int = 1000
    connection_timeout: int = 300  # 5 minutes
    heartbeat_interval: int = 10
    heartbeat_timeout: int = 30
    
    # Message handling
    max_message_size: int = 1048576  # 1MB
    message_queue_size: int = 1000
    backpressure_threshold: float = 0.8
    rate_limit_messages: int = 100
    rate_limit_window: int = 60
    
    # Security
    require_auth: bool = True
    session_secret: str = "your-secret-key-change-in-production"
    csrf_protection: bool = True
    
    # Performance
    enable_compression: bool = True
    compression_threshold: int = 1024
    enable_binary: bool = True
    
    # Compression settings
    compression_level: int = 6  # 1-9, where 9 is max compression
    compression_min_size: int = 860  # RFC 7692 recommends 860 bytes
    compression_memory_level: int = 8  # 1-9, memory usage for compression
    compression_window_bits: int = 15  # 8-15, compression window size


class WebSocketServer:
    """
    Comprehensive WebSocket server with enterprise-grade features
    """
    
    def __init__(self, app: FastAPI, config: Optional[ServerConfig] = None):
        self.app = app
        self.config = config or ServerConfig()
        self.state = ServerState.STARTING
        
        # Initialize Socket.IO server
        self.sio = socketio.AsyncServer(
            async_mode=self.config.async_mode,
            cors_allowed_origins=self.config.cors_allowed_origins,
            logger=self.config.logger_enabled,
            engineio_logger=self.config.engineio_logger_enabled,
            ping_timeout=self.config.ping_timeout,
            ping_interval=self.config.ping_interval,
            max_http_buffer_size=self.config.max_http_buffer_size,
            compression=self.config.enable_compression,
            compression_threshold=self.config.compression_threshold
        )
        
        # Initialize components
        self.connection_manager = ConnectionManager(
            max_connections=self.config.max_connections,
            timeout=self.config.connection_timeout
        )
        self.event_registry = EventHandlerRegistry()
        self.protocol_manager = MessageProtocolManager()
        self.auth_middleware = WebSocketAuthMiddleware(
            require_auth=self.config.require_auth
        )
        
        # Internal state
        self._handlers_registered = False
        self._middleware_applied = False
        self._background_tasks: Set[asyncio.Task] = set()
        self._shutdown_event = asyncio.Event()
        
        # Statistics
        self.stats = {
            "start_time": None,
            "total_connections": 0,
            "total_messages": 0,
            "total_errors": 0,
            "current_connections": 0,
            "bytes_sent": 0,
            "bytes_received": 0
        }
        
        self._setup_middleware()
        self._register_core_handlers()
    
    def _setup_middleware(self):
        """Setup FastAPI middleware"""
        if self._middleware_applied:
            return
        
        # Session middleware for CSRF protection
        self.app.add_middleware(
            SessionMiddleware,
            secret_key=self.config.session_secret
        )
        
        # CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=self.config.cors_allowed_origins,
            allow_credentials=self.config.cors_credentials,
            allow_methods=self.config.cors_allowed_methods,
            allow_headers=["*"]
        )
        
        self._middleware_applied = True
    
    def _register_core_handlers(self):
        """Register core Socket.IO event handlers"""
        if self._handlers_registered:
            return
        
        @self.sio.event
        async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]] = None):
            """Handle client connection"""
            try:
                # Authenticate connection
                user = await self.auth_middleware.authenticate_connection(sid, environ, auth)
                
                # Check connection limits
                if not await self.connection_manager.can_accept_connection():
                    logger.warning(f"Connection rejected - limit reached: {sid}")
                    await self.sio.disconnect(sid)
                    return False
                
                # Determine client type and negotiate protocol
                client_type = self._determine_client_type(environ, auth)
                protocol = await self.protocol_manager.negotiate_protocol(
                    sid, client_type, environ.get("HTTP_USER_AGENT", "")
                )
                
                # Create connection info
                connection_info = ConnectionInfo(
                    sid=sid,
                    user_id=user.id if user else None,
                    user=user,
                    client_type=client_type,
                    protocol=protocol,
                    remote_addr=environ.get("REMOTE_ADDR", "unknown"),
                    user_agent=environ.get("HTTP_USER_AGENT", "unknown"),
                    subprotocols=environ.get("HTTP_SEC_WEBSOCKET_PROTOCOL", "").split(","),
                    connect_time=datetime.utcnow()
                )
                
                # Register connection
                await self.connection_manager.register_connection(connection_info)
                
                # Join appropriate rooms based on user roles
                if user:
                    await self._join_user_rooms(sid, user)
                
                # Send connection acknowledgment
                await self.sio.emit("connected", {
                    "sid": sid,
                    "protocol": protocol.value,
                    "server_time": datetime.utcnow().isoformat(),
                    "heartbeat_interval": self.config.heartbeat_interval,
                    "compression": self.config.enable_compression,
                    "binary_support": self.config.enable_binary
                }, room=sid)
                
                # Update statistics
                self.stats["total_connections"] += 1
                self.stats["current_connections"] = await self.connection_manager.get_connection_count()
                
                logger.info(f"Client connected: {sid} (user: {user.username if user else 'anonymous'})")
                return True
                
            except Exception as e:
                logger.error(f"Connection error for {sid}: {e}")
                await self.sio.disconnect(sid)
                return False
        
        @self.sio.event
        async def disconnect(sid: str):
            """Handle client disconnection"""
            try:
                connection_info = await self.connection_manager.get_connection(sid)
                if connection_info:
                    logger.info(f"Client disconnected: {sid} (user: {connection_info.user.username if connection_info.user else 'anonymous'})")
                    
                    # Leave all rooms
                    await self.sio.leave_room(sid, sid)
                    if connection_info.user:
                        await self._leave_user_rooms(sid, connection_info.user)
                    
                    # Unregister connection
                    await self.connection_manager.unregister_connection(sid)
                    
                    # Update statistics
                    self.stats["current_connections"] = await self.connection_manager.get_connection_count()
                
            except Exception as e:
                logger.error(f"Disconnection error for {sid}: {e}")
        
        @self.sio.event
        async def ping(sid: str, data: Optional[Dict[str, Any]] = None):
            """Handle ping messages for heartbeat"""
            try:
                await self.connection_manager.update_heartbeat(sid)
                await self.sio.emit("pong", {
                    "timestamp": datetime.utcnow().isoformat(),
                    "latency": data.get("timestamp") if data else None
                }, room=sid)
                
            except Exception as e:
                logger.error(f"Ping error for {sid}: {e}")
        
        @self.sio.event
        async def subscribe(sid: str, data: Dict[str, Any]):
            """Handle subscription requests"""
            try:
                connection_info = await self.connection_manager.get_connection(sid)
                if not connection_info:
                    return {"error": "Connection not found"}
                
                channels = data.get("channels", [])
                filters = data.get("filters", {})
                
                # Validate and authorize subscriptions
                authorized_channels = []
                for channel in channels:
                    if await self._authorize_subscription(connection_info.user, channel):
                        authorized_channels.append(channel)
                        await self.sio.enter_room(sid, f"channel:{channel}")
                
                # Store subscription info
                await self.connection_manager.update_subscriptions(sid, authorized_channels, filters)
                
                return {
                    "subscribed": authorized_channels,
                    "rejected": list(set(channels) - set(authorized_channels))
                }
                
            except Exception as e:
                logger.error(f"Subscription error for {sid}: {e}")
                return {"error": str(e)}
        
        @self.sio.event
        async def unsubscribe(sid: str, data: Dict[str, Any]):
            """Handle unsubscription requests"""
            try:
                channels = data.get("channels", [])
                
                for channel in channels:
                    await self.sio.leave_room(sid, f"channel:{channel}")
                
                await self.connection_manager.remove_subscriptions(sid, channels)
                
                return {"unsubscribed": channels}
                
            except Exception as e:
                logger.error(f"Unsubscription error for {sid}: {e}")
                return {"error": str(e)}
        
        # Register protocol-specific handlers
        self._register_protocol_handlers()
        
        self._handlers_registered = True
    
    def _register_protocol_handlers(self):
        """Register protocol-specific message handlers"""
        
        @self.sio.event
        async def rover_command(sid: str, data: Dict[str, Any]):
            """Handle rover control commands"""
            try:
                connection_info = await self.connection_manager.get_connection(sid)
                if not connection_info:
                    return {"error": "Connection not found"}
                
                # Check authorization
                if not await self._authorize_rover_control(connection_info.user):
                    return {"error": "Unauthorized"}
                
                # Validate and process command
                command_result = await self.event_registry.handle_rover_command(
                    sid, data, connection_info
                )
                
                # Update statistics
                self.stats["total_messages"] += 1
                
                return command_result
                
            except Exception as e:
                logger.error(f"Rover command error for {sid}: {e}")
                self.stats["total_errors"] += 1
                return {"error": str(e)}
        
        @self.sio.event
        async def binary_data(sid: str, data: bytes):
            """Handle binary data transmission"""
            try:
                connection_info = await self.connection_manager.get_connection(sid)
                if not connection_info:
                    return
                
                # Check if binary is supported for this connection
                if connection_info.protocol not in [ProtocolType.BINARY, ProtocolType.MSGPACK]:
                    await self.sio.emit("error", {
                        "message": "Binary protocol not supported for this connection"
                    }, room=sid)
                    return
                
                # Process binary data
                result = await self.protocol_manager.process_binary_message(
                    sid, data, connection_info.protocol
                )
                
                # Update statistics
                self.stats["total_messages"] += 1
                self.stats["bytes_received"] += len(data)
                
                if result:
                    await self.sio.emit("binary_ack", result, room=sid)
                
            except Exception as e:
                logger.error(f"Binary data error for {sid}: {e}")
                self.stats["total_errors"] += 1
    
    def _determine_client_type(self, environ: Dict[str, Any], auth: Optional[Dict[str, Any]]) -> str:
        """Determine client type from connection info"""
        user_agent = environ.get("HTTP_USER_AGENT", "").lower()
        
        if auth and auth.get("client_type"):
            return auth["client_type"]
        
        if "mobile" in user_agent:
            return "mobile"
        elif "tablet" in user_agent:
            return "tablet"
        elif any(browser in user_agent for browser in ["chrome", "firefox", "safari", "edge"]):
            return "browser"
        else:
            return "unknown"
    
    async def _join_user_rooms(self, sid: str, user: User):
        """Join user to appropriate rooms based on their roles"""
        await self.sio.enter_room(sid, f"user:{user.id}")
        
        for role in user.roles:
            await self.sio.enter_room(sid, f"role:{role.name}")
    
    async def _leave_user_rooms(self, sid: str, user: User):
        """Leave user rooms"""
        await self.sio.leave_room(sid, f"user:{user.id}")
        
        for role in user.roles:
            await self.sio.leave_room(sid, f"role:{role.name}")
    
    async def _authorize_subscription(self, user: Optional[User], channel: str) -> bool:
        """Check if user is authorized to subscribe to a channel"""
        if not self.config.require_auth:
            return True
        
        if not user:
            return channel in ["public", "telemetry:basic"]
        
        # Define channel permissions
        channel_permissions = {
            "telemetry:full": ["admin", "operator"],
            "rover:control": ["admin", "operator"],
            "system:logs": ["admin"],
            "alerts": ["admin", "operator", "viewer"],
            "telemetry:basic": ["admin", "operator", "viewer"]
        }
        
        allowed_roles = channel_permissions.get(channel, [])
        if not allowed_roles:
            return True  # Public channel
        
        user_roles = [role.name for role in user.roles]
        return any(role in allowed_roles for role in user_roles)
    
    async def _authorize_rover_control(self, user: Optional[User]) -> bool:
        """Check if user is authorized to control the rover"""
        if not self.config.require_auth:
            return True
        
        if not user:
            return False
        
        # Check for control permissions
        for role in user.roles:
            for permission in role.permissions:
                if permission.resource == "rover" and permission.action in ["execute", "write"]:
                    return True
        
        return False
    
    async def start_background_tasks(self):
        """Start background tasks for maintenance and monitoring"""
        if self.state != ServerState.STARTING:
            return
        
        # Heartbeat monitor
        heartbeat_task = asyncio.create_task(self._heartbeat_monitor())
        self._background_tasks.add(heartbeat_task)
        heartbeat_task.add_done_callback(self._background_tasks.discard)
        
        # Connection cleanup
        cleanup_task = asyncio.create_task(self._connection_cleanup())
        self._background_tasks.add(cleanup_task)
        cleanup_task.add_done_callback(self._background_tasks.discard)
        
        # Statistics update
        stats_task = asyncio.create_task(self._stats_updater())
        self._background_tasks.add(stats_task)
        stats_task.add_done_callback(self._background_tasks.discard)
        
        self.stats["start_time"] = datetime.utcnow()
        self.state = ServerState.RUNNING
        
        logger.info("WebSocket server background tasks started")
    
    async def _heartbeat_monitor(self):
        """Monitor connection heartbeats and disconnect stale connections"""
        while not self._shutdown_event.is_set():
            try:
                stale_connections = await self.connection_manager.get_stale_connections(
                    timeout=timedelta(seconds=self.config.heartbeat_timeout)
                )
                
                for connection_info in stale_connections:
                    logger.warning(f"Disconnecting stale connection: {connection_info.sid}")
                    await self.sio.disconnect(connection_info.sid)
                
                await asyncio.sleep(self.config.heartbeat_interval)
                
            except Exception as e:
                logger.error(f"Heartbeat monitor error: {e}")
                await asyncio.sleep(5)
    
    async def _connection_cleanup(self):
        """Clean up expired connections and resources"""
        while not self._shutdown_event.is_set():
            try:
                await self.connection_manager.cleanup_expired_connections()
                await asyncio.sleep(60)  # Run every minute
                
            except Exception as e:
                logger.error(f"Connection cleanup error: {e}")
                await asyncio.sleep(10)
    
    async def _stats_updater(self):
        """Update server statistics"""
        while not self._shutdown_event.is_set():
            try:
                self.stats["current_connections"] = await self.connection_manager.get_connection_count()
                await asyncio.sleep(10)  # Update every 10 seconds
                
            except Exception as e:
                logger.error(f"Stats updater error: {e}")
                await asyncio.sleep(5)
    
    async def broadcast_to_channel(
        self,
        channel: str,
        event: str,
        data: Any,
        namespace: Optional[str] = None,
        binary: bool = False
    ):
        """Broadcast message to all subscribers of a channel"""
        try:
            room = f"channel:{channel}"
            
            if binary and self.config.enable_binary:
                # Convert to binary format if needed
                if isinstance(data, dict):
                    data = await self.protocol_manager.encode_binary_message(data, ProtocolType.MSGPACK)
            
            await self.sio.emit(event, data, room=room, namespace=namespace)
            
            # Update statistics
            self.stats["total_messages"] += 1
            if binary:
                self.stats["bytes_sent"] += len(data) if isinstance(data, bytes) else 0
            
        except Exception as e:
            logger.error(f"Broadcast error for channel {channel}: {e}")
            self.stats["total_errors"] += 1
    
    async def send_to_user(
        self,
        user_id: int,
        event: str,
        data: Any,
        namespace: Optional[str] = None
    ):
        """Send message to a specific user"""
        try:
            room = f"user:{user_id}"
            await self.sio.emit(event, data, room=room, namespace=namespace)
            
            self.stats["total_messages"] += 1
            
        except Exception as e:
            logger.error(f"Send to user error for user {user_id}: {e}")
            self.stats["total_errors"] += 1
    
    async def send_to_role(
        self,
        role: str,
        event: str,
        data: Any,
        namespace: Optional[str] = None
    ):
        """Send message to all users with a specific role"""
        try:
            room = f"role:{role}"
            await self.sio.emit(event, data, room=room, namespace=namespace)
            
            self.stats["total_messages"] += 1
            
        except Exception as e:
            logger.error(f"Send to role error for role {role}: {e}")
            self.stats["total_errors"] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get server statistics"""
        stats = self.stats.copy()
        if stats["start_time"]:
            stats["uptime"] = (datetime.utcnow() - stats["start_time"]).total_seconds()
        return stats
    
    async def shutdown(self):
        """Gracefully shutdown the WebSocket server"""
        if self.state in [ServerState.STOPPING, ServerState.STOPPED]:
            return
        
        self.state = ServerState.STOPPING
        logger.info("Shutting down WebSocket server...")
        
        # Signal background tasks to stop
        self._shutdown_event.set()
        
        # Disconnect all clients
        await self.sio.disconnect()
        
        # Wait for background tasks to complete
        if self._background_tasks:
            await asyncio.gather(*self._background_tasks, return_exceptions=True)
        
        # Cleanup resources
        await self.connection_manager.cleanup()
        
        self.state = ServerState.STOPPED
        logger.info("WebSocket server shutdown complete")


def create_websocket_server(app: FastAPI, config: Optional[ServerConfig] = None) -> WebSocketServer:
    """Factory function to create and configure WebSocket server"""
    server = WebSocketServer(app, config)
    
    # Mount Socket.IO app
    socketio_app = socketio.ASGIApp(server.sio, app)
    app.mount("/socket.io", socketio_app)
    
    # Add startup and shutdown events
    @app.on_event("startup")
    async def startup_event():
        await server.start_background_tasks()
    
    @app.on_event("shutdown")
    async def shutdown_event():
        await server.shutdown()
    
    return server