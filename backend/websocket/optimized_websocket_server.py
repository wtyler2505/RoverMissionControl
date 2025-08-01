"""
Optimized WebSocket Server for High-Performance Telemetry Streaming
Targets <50ms latency and 200Hz telemetry updates
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any, Set, Callable
from datetime import datetime
import weakref
from dataclasses import dataclass

import socketio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .performance_optimizer import (
    OptimizedTelemetryStreamer,
    MessagePriority,
    PerformanceMetrics,
    LatencyTracker,
    BackpressureController
)
from .connection_manager import ConnectionManager, ConnectionInfo
from .message_protocols import MessageProtocolManager, ProtocolType, TelemetryProtocol

logger = logging.getLogger(__name__)


@dataclass
class OptimizedServerConfig:
    """Configuration for optimized WebSocket server"""
    # Performance targets
    target_latency_ms: float = 50.0
    target_frequency_hz: int = 200
    
    # Connection limits
    max_connections: int = 100
    max_connections_per_ip: int = 10
    
    # Batching configuration
    enable_batching: bool = True
    max_batch_size: int = 50
    max_batch_delay_ms: int = 5
    
    # Compression settings
    enable_compression: bool = True
    compression_threshold: int = 512
    
    # Backpressure settings
    queue_warning_threshold: float = 0.7
    queue_drop_threshold: float = 0.9
    max_queue_size: int = 400  # 2 seconds at 200Hz
    
    # Monitoring
    enable_performance_monitoring: bool = True
    metrics_update_interval: int = 5
    
    # Socket.IO settings
    ping_timeout: int = 10
    ping_interval: int = 5
    max_http_buffer_size: int = 2000000  # 2MB for batched data


class OptimizedWebSocketServer:
    """High-performance WebSocket server optimized for real-time telemetry"""
    
    def __init__(self, app: FastAPI, config: Optional[OptimizedServerConfig] = None):
        self.app = app
        self.config = config or OptimizedServerConfig()
        
        # Initialize Socket.IO with optimized settings
        self.sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            logger=False,  # Disable to reduce overhead
            engineio_logger=False,
            ping_timeout=self.config.ping_timeout,
            ping_interval=self.config.ping_interval,
            max_http_buffer_size=self.config.max_http_buffer_size,
            compression=self.config.enable_compression
        )
        
        # Initialize performance components
        self.telemetry_streamer = OptimizedTelemetryStreamer(
            target_frequency=self.config.target_frequency_hz,
            max_latency_ms=self.config.target_latency_ms,
            enable_compression=self.config.enable_compression
        )
        
        self.connection_manager = ConnectionManager()
        self.protocol_manager = MessageProtocolManager()
        self.latency_tracker = LatencyTracker()
        
        # Performance monitoring
        self.performance_metrics = PerformanceMetrics()
        self.metrics_callbacks: List[Callable] = []
        
        # Connection tracking
        self.active_connections: Dict[str, Any] = {}
        self.connection_stats: Dict[str, Any] = {}
        self.ip_connections: Dict[str, int] = {}
        
        # Background tasks
        self._background_tasks: Set[asyncio.Task] = set()
        self._monitoring_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # Setup event handlers
        self._setup_socketio_handlers()
        
        # Mount Socket.IO app
        socketio_app = socketio.ASGIApp(self.sio, app)
        app.mount("/socket.io", socketio_app)
        
    async def start(self):
        """Start the optimized WebSocket server"""
        await self.telemetry_streamer.start()
        
        if self.config.enable_performance_monitoring:
            self._monitoring_task = asyncio.create_task(self._performance_monitor())
            
        self._cleanup_task = asyncio.create_task(self._connection_cleanup())
        
        logger.info(f"OptimizedWebSocketServer started - Target: {self.config.target_frequency_hz}Hz, <{self.config.target_latency_ms}ms latency")
        
    async def stop(self):
        """Stop the WebSocket server"""
        # Cancel background tasks
        if self._monitoring_task:
            self._monitoring_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
            
        for task in self._background_tasks:
            task.cancel()
            
        await self.telemetry_streamer.stop()
        
        # Disconnect all clients
        await self.sio.disconnect()
        
        logger.info("OptimizedWebSocketServer stopped")
        
    def _setup_socketio_handlers(self):
        """Setup optimized Socket.IO event handlers"""
        
        @self.sio.event
        async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]] = None):
            """Handle optimized client connection"""
            try:
                # Get client info
                remote_addr = environ.get('REMOTE_ADDR', 'unknown')
                user_agent = environ.get('HTTP_USER_AGENT', 'unknown')
                
                # Check connection limits
                if len(self.active_connections) >= self.config.max_connections:
                    logger.warning(f"Connection rejected - server limit: {sid}")
                    await self.sio.disconnect(sid)
                    return False
                    
                # Check per-IP limits
                ip_count = self.ip_connections.get(remote_addr, 0)
                if ip_count >= self.config.max_connections_per_ip:
                    logger.warning(f"Connection rejected - IP limit: {sid} from {remote_addr}")
                    await self.sio.disconnect(sid)
                    return False
                
                # Protocol negotiation for optimal performance
                client_protocols = []
                if auth and 'protocols' in auth:
                    client_protocols = auth['protocols']
                    
                # Select best protocol for performance
                selected_protocol = self._select_optimal_protocol(client_protocols, user_agent)
                
                # Store connection info
                connection_info = {
                    'sid': sid,
                    'remote_addr': remote_addr,
                    'user_agent': user_agent,
                    'protocol': selected_protocol,
                    'connect_time': time.time(),
                    'last_seen': time.time(),
                    'message_count': 0,
                    'bytes_sent': 0,
                    'latency_samples': []
                }
                
                self.active_connections[sid] = connection_info
                self.ip_connections[remote_addr] = ip_count + 1
                
                # Add connection to telemetry streamer
                self.telemetry_streamer.add_connection(sid, self.sio)
                
                # Send optimized connection acknowledgment
                await self.sio.emit('connected', {
                    'sid': sid,
                    'protocol': selected_protocol.value,
                    'server_time': time.time(),
                    'batch_size': self.config.max_batch_size,
                    'compression': self.config.enable_compression,
                    'target_frequency': self.config.target_frequency_hz
                }, room=sid)
                
                self.performance_metrics.total_messages += 1
                logger.info(f"Optimized connection established: {sid} ({selected_protocol.value})")
                return True
                
            except Exception as e:
                logger.error(f"Connection error for {sid}: {e}")
                await self.sio.disconnect(sid)
                return False
                
        @self.sio.event
        async def disconnect(sid: str):
            """Handle client disconnection"""
            try:
                if sid in self.active_connections:
                    conn_info = self.active_connections[sid]
                    remote_addr = conn_info['remote_addr']
                    
                    # Update IP connection count
                    if remote_addr in self.ip_connections:
                        self.ip_connections[remote_addr] -= 1
                        if self.ip_connections[remote_addr] <= 0:
                            del self.ip_connections[remote_addr]
                    
                    # Remove from telemetry streamer
                    self.telemetry_streamer.remove_connection(sid)
                    
                    # Clean up connection info
                    del self.active_connections[sid]
                    
                    logger.info(f"Client disconnected: {sid}")
                    
            except Exception as e:
                logger.error(f"Disconnection error for {sid}: {e}")
                
        @self.sio.event
        async def ping(sid: str, data: Optional[Dict[str, Any]] = None):
            """Handle ping with latency measurement"""
            try:
                # Record latency if timestamp provided
                if data and 'timestamp' in data:
                    client_timestamp = data['timestamp']
                    server_time = time.time()
                    latency_ms = (server_time - client_timestamp) * 1000
                    
                    # Update connection latency
                    if sid in self.active_connections:
                        conn_info = self.active_connections[sid]
                        conn_info['latency_samples'].append(latency_ms)
                        # Keep only recent samples
                        if len(conn_info['latency_samples']) > 10:
                            conn_info['latency_samples'] = conn_info['latency_samples'][-10:]
                            
                    # Track in global latency tracker
                    if data.get('message_id'):
                        self.latency_tracker.record_receive(data['message_id'])
                
                # Send pong with server timestamp
                await self.sio.emit('pong', {
                    'timestamp': time.time(),
                    'latency_ms': latency_ms if data and 'timestamp' in data else None
                }, room=sid)
                
                # Update last seen
                if sid in self.active_connections:
                    self.active_connections[sid]['last_seen'] = time.time()
                    
            except Exception as e:
                logger.error(f"Ping error for {sid}: {e}")
                
        @self.sio.event
        async def subscribe_telemetry(sid: str, data: Dict[str, Any]):
            """Handle telemetry subscription with optimization"""
            try:
                if sid not in self.active_connections:
                    return {'error': 'Connection not found'}
                
                # Extract subscription parameters
                channels = data.get('channels', ['telemetry'])
                frequency = min(data.get('frequency', self.config.target_frequency_hz), self.config.target_frequency_hz)
                filters = data.get('filters', {})
                
                # Join telemetry rooms
                for channel in channels:
                    await self.sio.enter_room(sid, f"telemetry:{channel}")
                
                # Update connection info
                conn_info = self.active_connections[sid]
                conn_info['subscriptions'] = {
                    'channels': channels,
                    'frequency': frequency,
                    'filters': filters
                }
                
                return {
                    'subscribed': channels,
                    'frequency': frequency,
                    'batch_enabled': self.config.enable_batching
                }
                
            except Exception as e:
                logger.error(f"Subscription error for {sid}: {e}")
                return {'error': str(e)}
                
        @self.sio.event 
        async def latency_test(sid: str, data: Dict[str, Any]):
            """Handle latency test messages"""
            try:
                message_id = data.get('message_id')
                if message_id:
                    self.latency_tracker.record_send(message_id)
                
                # Echo back immediately for round-trip measurement
                await self.sio.emit('latency_response', {
                    'message_id': message_id,
                    'server_timestamp': time.time(),
                    'client_timestamp': data.get('timestamp')
                }, room=sid)
                
            except Exception as e:
                logger.error(f"Latency test error for {sid}: {e}")
                
    def _select_optimal_protocol(self, client_protocols: List[str], user_agent: str) -> ProtocolType:
        """Select optimal protocol for performance"""
        # Priority order for performance: MSGPACK > BINARY > JSON
        available_protocols = [ProtocolType.MSGPACK, ProtocolType.BINARY, ProtocolType.JSON]
        
        # Check client support
        supported = []
        for protocol_str in client_protocols:
            try:
                protocol = ProtocolType(protocol_str.lower())
                if protocol in available_protocols:
                    supported.append(protocol)
            except ValueError:
                continue
                
        # Return best supported protocol
        for protocol in available_protocols:
            if protocol in supported:
                return protocol
                
        return ProtocolType.JSON  # Fallback
        
    async def broadcast_telemetry(self, telemetry_data: Dict[str, Any], priority: MessagePriority = MessagePriority.NORMAL):
        """Broadcast telemetry data using optimized streaming"""
        await self.telemetry_streamer.stream_telemetry(telemetry_data, priority)
        
    async def send_to_connection(self, sid: str, event: str, data: Any, priority: MessagePriority = MessagePriority.NORMAL):
        """Send data to specific connection with optimization"""
        try:
            if sid not in self.active_connections:
                return False
                
            # Use binary protocol if supported
            conn_info = self.active_connections[sid]
            protocol = conn_info.get('protocol', ProtocolType.JSON)
            
            if protocol in [ProtocolType.MSGPACK, ProtocolType.BINARY]:
                # Encode using optimal protocol
                encoded_data = await self.protocol_manager.encode_message(
                    sid, event, data, protocol
                )
                await self.sio.emit('binary_message', encoded_data, room=sid)
            else:
                # Standard JSON message
                await self.sio.emit(event, data, room=sid)
                
            # Update connection stats
            conn_info['message_count'] += 1
            conn_info['last_seen'] = time.time()
            
            return True
            
        except Exception as e:
            logger.error(f"Send error to {sid}: {e}")
            return False
            
    async def _performance_monitor(self):
        """Monitor and optimize performance in real-time"""
        while True:
            try:
                await asyncio.sleep(self.config.metrics_update_interval)
                
                # Update performance metrics
                telemetry_metrics = self.telemetry_streamer.get_performance_metrics()
                latency_stats = self.latency_tracker.get_statistics()
                
                # Calculate connection stats
                total_connections = len(self.active_connections)
                total_messages = sum(conn['message_count'] for conn in self.active_connections.values())
                
                # Update global metrics
                self.performance_metrics.total_messages = telemetry_metrics.total_messages + total_messages
                self.performance_metrics.total_bytes_sent = telemetry_metrics.total_bytes_sent
                self.performance_metrics.average_latency_ms = latency_stats['average']
                self.performance_metrics.p95_latency_ms = latency_stats['p95']
                self.performance_metrics.p99_latency_ms = latency_stats['p99']
                self.performance_metrics.message_rate_hz = telemetry_metrics.message_rate_hz
                self.performance_metrics.compression_ratio = telemetry_metrics.compression_ratio
                self.performance_metrics.last_update = datetime.utcnow()
                
                # Check performance targets
                if latency_stats['p95'] > self.config.target_latency_ms:
                    logger.warning(f"Performance target missed: P95 latency {latency_stats['p95']:.1f}ms > {self.config.target_latency_ms}ms")
                    
                # Notify callbacks
                for callback in self.metrics_callbacks:
                    try:
                        await callback(self.performance_metrics)
                    except Exception as e:
                        logger.error(f"Metrics callback error: {e}")
                        
                # Log performance summary
                if total_connections > 0:
                    logger.info(f"Performance: {total_connections} connections, "
                              f"{telemetry_metrics.message_rate_hz:.1f} Hz, "
                              f"P95 latency: {latency_stats['p95']:.1f}ms, "
                              f"Compression: {telemetry_metrics.compression_ratio:.2f}x")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Performance monitoring error: {e}")
                
    async def _connection_cleanup(self):
        """Clean up stale connections"""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                current_time = time.time()
                stale_connections = []
                
                for sid, conn_info in self.active_connections.items():
                    # Mark as stale if no activity for 60 seconds
                    if current_time - conn_info['last_seen'] > 60:
                        stale_connections.append(sid)
                        
                # Disconnect stale connections
                for sid in stale_connections:
                    logger.info(f"Disconnecting stale connection: {sid}")
                    await self.sio.disconnect(sid)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Connection cleanup error: {e}")
                
    def register_metrics_callback(self, callback: Callable):
        """Register callback for performance metrics updates"""
        self.metrics_callbacks.append(callback)
        
    def get_performance_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        return self.performance_metrics
        
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get detailed connection statistics"""
        stats = {
            'total_connections': len(self.active_connections),
            'connections_by_protocol': {},
            'ip_distribution': dict(self.ip_connections),
            'latency_distribution': [],
            'message_counts': [],
            'uptime_distribution': []
        }
        
        current_time = time.time()
        
        for conn_info in self.active_connections.values():
            # Protocol distribution
            protocol = conn_info.get('protocol', ProtocolType.JSON).value
            stats['connections_by_protocol'][protocol] = stats['connections_by_protocol'].get(protocol, 0) + 1
            
            # Latency samples
            if conn_info.get('latency_samples'):
                stats['latency_distribution'].extend(conn_info['latency_samples'])
                
            # Message counts
            stats['message_counts'].append(conn_info['message_count'])
            
            # Connection uptime
            uptime = current_time - conn_info['connect_time']
            stats['uptime_distribution'].append(uptime)
            
        return stats
        
    def get_backpressure_status(self) -> Dict[str, Any]:
        """Get backpressure status for all connections"""
        return self.telemetry_streamer.get_backpressure_status()


async def create_optimized_websocket_server(app: FastAPI, config: Optional[OptimizedServerConfig] = None) -> OptimizedWebSocketServer:
    """Factory function to create optimized WebSocket server"""
    server = OptimizedWebSocketServer(app, config)
    
    # Add startup and shutdown handlers
    @app.on_event("startup")
    async def startup_event():
        await server.start()
        
    @app.on_event("shutdown") 
    async def shutdown_event():
        await server.stop()
        
    return server