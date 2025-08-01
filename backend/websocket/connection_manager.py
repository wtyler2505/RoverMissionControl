"""
Connection Manager for WebSocket Server

This module provides comprehensive connection lifecycle management with:
- Connection pooling and resource management
- Authentication state tracking
- Subscription management
- Rate limiting and backpressure handling
- Connection health monitoring
- Graceful cleanup
"""

import asyncio
import time
from typing import Dict, List, Optional, Set, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque

from ..auth.models import User
from .message_protocols import ProtocolType


class ConnectionState(Enum):
    """Connection state enumeration"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    AUTHENTICATED = "authenticated"
    ACTIVE = "active"
    IDLE = "idle"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"


@dataclass
class RateLimitInfo:
    """Rate limiting information for a connection"""
    messages: deque = field(default_factory=deque)
    window_start: float = field(default_factory=time.time)
    blocked_until: Optional[float] = None
    violations: int = 0


@dataclass
class SubscriptionInfo:
    """Subscription information for a connection"""
    channels: Set[str] = field(default_factory=set)
    filters: Dict[str, Any] = field(default_factory=dict)
    last_activity: datetime = field(default_factory=datetime.utcnow)
    message_count: int = 0


@dataclass
class ConnectionMetrics:
    """Connection performance metrics"""
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    last_ping: Optional[datetime] = None
    latency_ms: Optional[float] = None
    avg_latency_ms: float = 0.0
    latency_samples: deque = field(default_factory=lambda: deque(maxlen=10))


@dataclass
class ConnectionInfo:
    """Complete connection information"""
    # Basic connection info
    sid: str
    user_id: Optional[int] = None
    user: Optional[User] = None
    client_type: str = "unknown"
    protocol: ProtocolType = ProtocolType.JSON
    remote_addr: str = "unknown"
    user_agent: str = "unknown"
    subprotocols: List[str] = field(default_factory=list)
    
    # Connection lifecycle
    connect_time: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = field(default_factory=datetime.utcnow)
    state: ConnectionState = ConnectionState.CONNECTING
    
    # Feature support
    supports_binary: bool = False
    supports_compression: bool = False
    max_message_size: int = 1048576  # 1MB default
    
    # Subscription and rate limiting
    subscriptions: SubscriptionInfo = field(default_factory=SubscriptionInfo)
    rate_limit: RateLimitInfo = field(default_factory=RateLimitInfo)
    
    # Performance metrics
    metrics: ConnectionMetrics = field(default_factory=ConnectionMetrics)
    
    # Security
    auth_time: Optional[datetime] = None
    session_id: Optional[str] = None
    csrf_token: Optional[str] = None
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_seen = datetime.utcnow()
        self.subscriptions.last_activity = self.last_seen
    
    def update_heartbeat(self, latency_ms: Optional[float] = None):
        """Update heartbeat timestamp and latency"""
        self.last_heartbeat = datetime.utcnow()
        self.update_activity()
        
        if latency_ms is not None:
            self.metrics.latency_ms = latency_ms
            self.metrics.latency_samples.append(latency_ms)
            if self.metrics.latency_samples:
                self.metrics.avg_latency_ms = sum(self.metrics.latency_samples) / len(self.metrics.latency_samples)
    
    def is_authenticated(self) -> bool:
        """Check if connection is authenticated"""
        return self.state in [ConnectionState.AUTHENTICATED, ConnectionState.ACTIVE] and self.user is not None
    
    def is_stale(self, timeout: timedelta) -> bool:
        """Check if connection is stale (no heartbeat)"""
        return datetime.utcnow() - self.last_heartbeat > timeout
    
    def is_idle(self, timeout: timedelta) -> bool:
        """Check if connection is idle (no activity)"""
        return datetime.utcnow() - self.last_seen > timeout
    
    def get_uptime(self) -> timedelta:
        """Get connection uptime"""
        return datetime.utcnow() - self.connect_time


class ConnectionManager:
    """
    Comprehensive connection manager with enterprise features
    """
    
    def __init__(
        self,
        max_connections: int = 1000,
        timeout: int = 300,
        rate_limit_messages: int = 100,
        rate_limit_window: int = 60,
        backpressure_threshold: float = 0.8
    ):
        self.max_connections = max_connections
        self.timeout = timeout
        self.rate_limit_messages = rate_limit_messages
        self.rate_limit_window = rate_limit_window
        self.backpressure_threshold = backpressure_threshold
        
        # Connection storage
        self._connections: Dict[str, ConnectionInfo] = {}
        self._user_connections: Dict[int, Set[str]] = defaultdict(set)
        self._ip_connections: Dict[str, Set[str]] = defaultdict(set)
        
        # Locks for thread safety
        self._connection_lock = asyncio.Lock()
        
        # Background task tracking
        self._cleanup_task: Optional[asyncio.Task] = None
        self._monitor_task: Optional[asyncio.Task] = None
        
        # Statistics
        self.stats = {
            "total_connections": 0,
            "peak_connections": 0,
            "rejected_connections": 0,
            "rate_limited_connections": 0,
            "expired_connections": 0
        }
    
    async def can_accept_connection(self, remote_addr: Optional[str] = None) -> bool:
        """Check if a new connection can be accepted"""
        async with self._connection_lock:
            current_count = len(self._connections)
            
            # Check global connection limit
            if current_count >= self.max_connections:
                self.stats["rejected_connections"] += 1
                return False
            
            # Check per-IP limits (optional)
            if remote_addr:
                ip_connections = len(self._ip_connections.get(remote_addr, set()))
                if ip_connections >= 10:  # Max 10 connections per IP
                    self.stats["rejected_connections"] += 1
                    return False
            
            return True
    
    async def register_connection(self, connection_info: ConnectionInfo) -> bool:
        """Register a new connection"""
        async with self._connection_lock:
            if not await self.can_accept_connection(connection_info.remote_addr):
                return False
            
            # Store connection
            self._connections[connection_info.sid] = connection_info
            
            # Index by user
            if connection_info.user_id:
                self._user_connections[connection_info.user_id].add(connection_info.sid)
            
            # Index by IP
            self._ip_connections[connection_info.remote_addr].add(connection_info.sid)
            
            # Update statistics
            self.stats["total_connections"] += 1
            current_count = len(self._connections)
            if current_count > self.stats["peak_connections"]:
                self.stats["peak_connections"] = current_count
            
            connection_info.state = ConnectionState.CONNECTED
            return True
    
    async def unregister_connection(self, sid: str) -> Optional[ConnectionInfo]:
        """Unregister a connection"""
        async with self._connection_lock:
            connection_info = self._connections.pop(sid, None)
            if not connection_info:
                return None
            
            # Remove from indexes
            if connection_info.user_id:
                self._user_connections[connection_info.user_id].discard(sid)
                if not self._user_connections[connection_info.user_id]:
                    del self._user_connections[connection_info.user_id]
            
            self._ip_connections[connection_info.remote_addr].discard(sid)
            if not self._ip_connections[connection_info.remote_addr]:
                del self._ip_connections[connection_info.remote_addr]
            
            connection_info.state = ConnectionState.DISCONNECTED
            return connection_info
    
    async def get_connection(self, sid: str) -> Optional[ConnectionInfo]:
        """Get connection information"""
        return self._connections.get(sid)
    
    async def get_user_connections(self, user_id: int) -> List[ConnectionInfo]:
        """Get all connections for a user"""
        sids = self._user_connections.get(user_id, set())
        return [self._connections[sid] for sid in sids if sid in self._connections]
    
    async def get_connection_count(self) -> int:
        """Get current connection count"""
        return len(self._connections)
    
    async def get_connections_by_state(self, state: ConnectionState) -> List[ConnectionInfo]:
        """Get connections by state"""
        return [conn for conn in self._connections.values() if conn.state == state]
    
    async def authenticate_connection(self, sid: str, user: User) -> bool:
        """Mark connection as authenticated"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return False
        
        async with self._connection_lock:
            # Update user information
            if connection_info.user_id != user.id:
                # Remove from old user index
                if connection_info.user_id:
                    self._user_connections[connection_info.user_id].discard(sid)
                
                # Add to new user index
                connection_info.user_id = user.id
                self._user_connections[user.id].add(sid)
            
            connection_info.user = user
            connection_info.auth_time = datetime.utcnow()
            connection_info.state = ConnectionState.AUTHENTICATED
            
            return True
    
    async def update_heartbeat(self, sid: str, latency_ms: Optional[float] = None) -> bool:
        """Update connection heartbeat"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return False
        
        connection_info.update_heartbeat(latency_ms)
        
        # Update state based on activity
        if connection_info.state == ConnectionState.IDLE:
            connection_info.state = ConnectionState.ACTIVE
        
        return True
    
    async def update_subscriptions(
        self,
        sid: str,
        channels: List[str],
        filters: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update connection subscriptions"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return False
        
        connection_info.subscriptions.channels.update(channels)
        if filters:
            connection_info.subscriptions.filters.update(filters)
        connection_info.subscriptions.last_activity = datetime.utcnow()
        
        return True
    
    async def remove_subscriptions(self, sid: str, channels: List[str]) -> bool:
        """Remove connection subscriptions"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return False
        
        connection_info.subscriptions.channels.difference_update(channels)
        connection_info.subscriptions.last_activity = datetime.utcnow()
        
        return True
    
    async def check_rate_limit(self, sid: str) -> bool:
        """Check if connection is rate limited"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return False
        
        now = time.time()
        rate_limit = connection_info.rate_limit
        
        # Check if currently blocked
        if rate_limit.blocked_until and now < rate_limit.blocked_until:
            return False
        
        # Reset window if needed
        if now - rate_limit.window_start > self.rate_limit_window:
            rate_limit.messages.clear()
            rate_limit.window_start = now
            rate_limit.blocked_until = None
        
        # Check message count in current window
        rate_limit.messages.append(now)
        
        # Remove old messages outside window
        while rate_limit.messages and rate_limit.messages[0] < now - self.rate_limit_window:
            rate_limit.messages.popleft()
        
        # Check limit
        if len(rate_limit.messages) > self.rate_limit_messages:
            # Rate limit exceeded
            rate_limit.violations += 1
            
            # Progressive penalties
            penalty_duration = min(60 * rate_limit.violations, 300)  # Max 5 minutes
            rate_limit.blocked_until = now + penalty_duration
            
            self.stats["rate_limited_connections"] += 1
            return False
        
        return True
    
    async def update_metrics(
        self,
        sid: str,
        messages_sent: int = 0,
        messages_received: int = 0,
        bytes_sent: int = 0,
        bytes_received: int = 0,
        errors: int = 0
    ):
        """Update connection metrics"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return
        
        metrics = connection_info.metrics
        metrics.messages_sent += messages_sent
        metrics.messages_received += messages_received
        metrics.bytes_sent += bytes_sent
        metrics.bytes_received += bytes_received
        metrics.errors += errors
        
        connection_info.update_activity()
    
    async def get_stale_connections(self, timeout: timedelta) -> List[ConnectionInfo]:
        """Get connections that haven't sent heartbeat recently"""
        stale_connections = []
        
        for connection_info in self._connections.values():
            if connection_info.is_stale(timeout):
                stale_connections.append(connection_info)
        
        return stale_connections
    
    async def get_idle_connections(self, timeout: timedelta) -> List[ConnectionInfo]:
        """Get connections that have been idle"""
        idle_connections = []
        
        for connection_info in self._connections.values():
            if connection_info.is_idle(timeout):
                connection_info.state = ConnectionState.IDLE
                idle_connections.append(connection_info)
        
        return idle_connections
    
    async def cleanup_expired_connections(self):
        """Clean up expired and stale connections"""
        now = datetime.utcnow()
        expired_sids = []
        
        for sid, connection_info in self._connections.items():
            # Check for various expiry conditions
            if (
                connection_info.is_stale(timedelta(seconds=self.timeout)) or
                (connection_info.state == ConnectionState.CONNECTING and 
                 now - connection_info.connect_time > timedelta(minutes=5)) or
                (connection_info.state == ConnectionState.DISCONNECTING and
                 now - connection_info.last_seen > timedelta(minutes=1))
            ):
                expired_sids.append(sid)
        
        # Remove expired connections
        for sid in expired_sids:
            await self.unregister_connection(sid)
            self.stats["expired_connections"] += 1
    
    async def get_connection_summary(self) -> Dict[str, Any]:
        """Get summary of all connections"""
        connections_by_state = defaultdict(int)
        connections_by_type = defaultdict(int)
        connections_by_protocol = defaultdict(int)
        total_messages = 0
        total_bytes = 0
        
        for connection_info in self._connections.values():
            connections_by_state[connection_info.state.value] += 1
            connections_by_type[connection_info.client_type] += 1
            connections_by_protocol[connection_info.protocol.value] += 1
            
            total_messages += connection_info.metrics.messages_sent + connection_info.metrics.messages_received
            total_bytes += connection_info.metrics.bytes_sent + connection_info.metrics.bytes_received
        
        return {
            "total_connections": len(self._connections),
            "connections_by_state": dict(connections_by_state),
            "connections_by_type": dict(connections_by_type),
            "connections_by_protocol": dict(connections_by_protocol),
            "unique_users": len(self._user_connections),
            "unique_ips": len(self._ip_connections),
            "total_messages": total_messages,
            "total_bytes": total_bytes,
            "stats": self.stats
        }
    
    async def is_backpressure_active(self) -> bool:
        """Check if system is under backpressure"""
        current_count = await self.get_connection_count()
        return current_count / self.max_connections > self.backpressure_threshold
    
    async def get_connection_details(self, sid: str) -> Optional[Dict[str, Any]]:
        """Get detailed connection information"""
        connection_info = await self.get_connection(sid)
        if not connection_info:
            return None
        
        return {
            "sid": connection_info.sid,
            "user_id": connection_info.user_id,
            "username": connection_info.user.username if connection_info.user else None,
            "client_type": connection_info.client_type,
            "protocol": connection_info.protocol.value,
            "remote_addr": connection_info.remote_addr,
            "user_agent": connection_info.user_agent,
            "state": connection_info.state.value,
            "connect_time": connection_info.connect_time.isoformat(),
            "last_seen": connection_info.last_seen.isoformat(),
            "last_heartbeat": connection_info.last_heartbeat.isoformat(),
            "uptime_seconds": connection_info.get_uptime().total_seconds(),
            "subscriptions": {
                "channels": list(connection_info.subscriptions.channels),
                "message_count": connection_info.subscriptions.message_count
            },
            "metrics": {
                "messages_sent": connection_info.metrics.messages_sent,
                "messages_received": connection_info.metrics.messages_received,
                "bytes_sent": connection_info.metrics.bytes_sent,
                "bytes_received": connection_info.metrics.bytes_received,
                "errors": connection_info.metrics.errors,
                "latency_ms": connection_info.metrics.latency_ms,
                "avg_latency_ms": connection_info.metrics.avg_latency_ms
            },
            "rate_limit": {
                "violations": connection_info.rate_limit.violations,
                "blocked": connection_info.rate_limit.blocked_until is not None and 
                         time.time() < connection_info.rate_limit.blocked_until
            }
        }
    
    async def force_disconnect(self, sid: str, reason: str = "Administrative action"):
        """Force disconnect a connection"""
        connection_info = await self.get_connection(sid)
        if connection_info:
            connection_info.state = ConnectionState.DISCONNECTING
            # The actual disconnection will be handled by the WebSocket server
    
    async def cleanup(self):
        """Clean up all resources"""
        async with self._connection_lock:
            self._connections.clear()
            self._user_connections.clear()
            self._ip_connections.clear()
        
        # Cancel background tasks
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._monitor_task:
            self._monitor_task.cancel()