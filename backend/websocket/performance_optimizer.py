"""
WebSocket Performance Optimizer
High-performance telemetry streaming with <50ms latency and 200Hz support
"""

import asyncio
import time
import zlib
import lz4.frame
import struct
import logging
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import deque, defaultdict
from enum import Enum
import json
import weakref

logger = logging.getLogger(__name__)


class CompressionMethod(Enum):
    NONE = "none"
    ZLIB = "zlib"
    LZ4 = "lz4"


class MessagePriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class PerformanceMetrics:
    """Real-time performance metrics for WebSocket optimization"""
    total_messages: int = 0
    total_bytes_sent: int = 0
    total_bytes_received: int = 0
    compression_ratio: float = 0.0
    average_latency_ms: float = 0.0
    message_rate_hz: float = 0.0
    batch_size_avg: float = 0.0
    dropped_messages: int = 0
    backpressure_events: int = 0
    last_update: datetime = field(default_factory=datetime.utcnow)
    
    # Latency distribution
    latency_samples: deque = field(default_factory=lambda: deque(maxlen=100))
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0


@dataclass 
class BatchMessage:
    """Batched message for efficient transmission"""
    id: str
    timestamp: float
    priority: MessagePriority
    data: bytes
    compressed: bool = False
    original_size: int = 0


@dataclass
class TelemetryBatch:
    """Optimized telemetry batch for 200Hz data"""
    batch_id: str
    timestamp: float
    message_count: int
    compressed_data: bytes
    original_size: int
    compression_method: CompressionMethod
    channel: str = "telemetry"


class MessageBatcher:
    """High-performance message batching for reducing network overhead"""
    
    def __init__(
        self,
        max_batch_size: int = 50,
        max_batch_delay_ms: int = 5,  # Very low latency
        compression_threshold: int = 512,
        compression_method: CompressionMethod = CompressionMethod.LZ4
    ):
        self.max_batch_size = max_batch_size
        self.max_batch_delay_ms = max_batch_delay_ms
        self.compression_threshold = compression_threshold
        self.compression_method = compression_method
        
        # Batching state
        self.pending_messages: Dict[str, List[BatchMessage]] = defaultdict(list)
        self.batch_timers: Dict[str, asyncio.Task] = {}
        self.send_callbacks: Dict[str, Callable] = {}
        
        # Performance tracking
        self.metrics = PerformanceMetrics()
        self._running = False
        
    async def start(self):
        """Start the message batcher"""
        self._running = True
        logger.info("MessageBatcher started")
        
    async def stop(self):
        """Stop the message batcher and flush pending messages"""
        self._running = False
        
        # Cancel all timers and flush remaining messages
        for channel, timer in self.batch_timers.items():
            if not timer.done():
                timer.cancel()
            await self.flush_batch(channel)
            
        logger.info("MessageBatcher stopped")
        
    def register_send_callback(self, channel: str, callback: Callable):
        """Register callback for sending batched messages"""
        self.send_callbacks[channel] = callback
        
    async def add_message(
        self, 
        channel: str, 
        message_id: str, 
        data: Union[dict, bytes], 
        priority: MessagePriority = MessagePriority.NORMAL
    ):
        """Add message to batch queue"""
        if not self._running:
            return
            
        # Convert data to bytes if needed
        if isinstance(data, dict):
            data_bytes = json.dumps(data, separators=(',', ':')).encode('utf-8')
        elif isinstance(data, str):
            data_bytes = data.encode('utf-8')
        else:
            data_bytes = data
            
        message = BatchMessage(
            id=message_id,
            timestamp=time.time(),
            priority=priority,
            data=data_bytes,
            original_size=len(data_bytes)
        )
        
        self.pending_messages[channel].append(message)
        
        # Start batch timer if not already running
        if channel not in self.batch_timers or self.batch_timers[channel].done():
            self.batch_timers[channel] = asyncio.create_task(
                self._batch_timer(channel)
            )
        
        # Send immediately if batch is full or high priority
        if (len(self.pending_messages[channel]) >= self.max_batch_size or 
            priority == MessagePriority.CRITICAL):
            if channel in self.batch_timers and not self.batch_timers[channel].done():
                self.batch_timers[channel].cancel()
            await self.flush_batch(channel)
            
    async def _batch_timer(self, channel: str):
        """Timer for automatic batch flushing"""
        try:
            await asyncio.sleep(self.max_batch_delay_ms / 1000.0)
            await self.flush_batch(channel)
        except asyncio.CancelledError:
            pass
            
    async def flush_batch(self, channel: str):
        """Flush pending messages for a channel"""
        if not self.pending_messages[channel]:
            return
            
        messages = self.pending_messages[channel].copy()
        self.pending_messages[channel].clear()
        
        # Create batch
        batch_data = self._create_batch(messages, channel)
        
        # Send via callback
        if channel in self.send_callbacks:
            try:
                await self.send_callbacks[channel](batch_data)
                self._update_metrics(batch_data, len(messages))
            except Exception as e:
                logger.error(f"Failed to send batch for channel {channel}: {e}")
                # Could implement retry logic here
                
    def _create_batch(self, messages: List[BatchMessage], channel: str) -> TelemetryBatch:
        """Create optimized batch from messages"""
        # Sort by priority (critical first)
        messages.sort(key=lambda m: m.priority.value, reverse=True)
        
        # Pack messages into binary format
        packed_data = self._pack_messages(messages)
        
        # Compress if beneficial
        compressed_data = packed_data
        compression_method = CompressionMethod.NONE
        original_size = len(packed_data)
        
        if len(packed_data) > self.compression_threshold:
            if self.compression_method == CompressionMethod.LZ4:
                try:
                    compressed = lz4.frame.compress(packed_data, compression_level=1)  # Fast compression
                    if len(compressed) < len(packed_data) * 0.9:  # Only if >10% reduction
                        compressed_data = compressed
                        compression_method = CompressionMethod.LZ4
                except Exception:
                    pass  # Fallback to no compression
            elif self.compression_method == CompressionMethod.ZLIB:
                try:
                    compressed = zlib.compress(packed_data, level=1)  # Fast compression
                    if len(compressed) < len(packed_data) * 0.9:
                        compressed_data = compressed
                        compression_method = CompressionMethod.ZLIB
                except Exception:
                    pass
        
        return TelemetryBatch(
            batch_id=f"batch_{int(time.time() * 1000000)}",
            timestamp=time.time(),
            message_count=len(messages),
            compressed_data=compressed_data,
            original_size=original_size,
            compression_method=compression_method,
            channel=channel
        )
        
    def _pack_messages(self, messages: List[BatchMessage]) -> bytes:
        """Pack messages into efficient binary format"""
        # Binary format: header + message_data
        # Header: message_count(4) + total_size(4)
        # Each message: timestamp(8) + priority(1) + data_size(4) + data
        
        packed = bytearray()
        
        # Reserve space for header
        header_size = 8  # message_count(4) + total_size(4)
        packed.extend(b'\x00' * header_size)
        
        message_count = len(messages)
        
        for message in messages:
            # Pack message: timestamp(8) + priority(1) + data_size(4) + data
            packed.extend(struct.pack('d', message.timestamp))  # 8 bytes
            packed.extend(struct.pack('B', message.priority.value))  # 1 byte
            packed.extend(struct.pack('I', len(message.data)))  # 4 bytes
            packed.extend(message.data)
            
        total_size = len(packed)
        
        # Write header
        struct.pack_into('II', packed, 0, message_count, total_size - header_size)
        
        return bytes(packed)
        
    def _update_metrics(self, batch: TelemetryBatch, message_count: int):
        """Update performance metrics"""
        self.metrics.total_messages += message_count
        self.metrics.total_bytes_sent += len(batch.compressed_data)
        
        if batch.compression_method != CompressionMethod.NONE:
            compression_ratio = len(batch.compressed_data) / batch.original_size
            self.metrics.compression_ratio = (
                (self.metrics.compression_ratio * 0.9) + (compression_ratio * 0.1)
            )
            
        # Update batch size average
        self.metrics.batch_size_avg = (
            (self.metrics.batch_size_avg * 0.9) + (message_count * 0.1)
        )
        
        self.metrics.last_update = datetime.utcnow()


class BackpressureController:
    """Backpressure management for high-frequency telemetry streams"""
    
    def __init__(
        self,
        max_queue_size: int = 1000,
        warning_threshold: float = 0.7,
        drop_threshold: float = 0.9,
        measurement_window: int = 100
    ):
        self.max_queue_size = max_queue_size
        self.warning_threshold = warning_threshold
        self.drop_threshold = drop_threshold
        self.measurement_window = measurement_window
        
        # State tracking
        self.queue_sizes: Dict[str, int] = defaultdict(int)
        self.processing_rates: Dict[str, deque] = defaultdict(lambda: deque(maxlen=measurement_window))
        self.drop_counts: Dict[str, int] = defaultdict(int)
        self.warning_callbacks: List[Callable] = []
        
    def register_warning_callback(self, callback: Callable):
        """Register callback for backpressure warnings"""
        self.warning_callbacks.append(callback)
        
    def update_queue_size(self, connection_id: str, size: int):
        """Update queue size for connection"""
        self.queue_sizes[connection_id] = size
        
        # Check thresholds
        utilization = size / self.max_queue_size
        
        if utilization >= self.warning_threshold:
            self._trigger_warning(connection_id, utilization, size)
            
    def should_drop_message(self, connection_id: str, priority: MessagePriority) -> bool:
        """Determine if message should be dropped due to backpressure"""
        queue_size = self.queue_sizes.get(connection_id, 0)
        utilization = queue_size / self.max_queue_size
        
        # Never drop critical messages
        if priority == MessagePriority.CRITICAL:
            return False
            
        # Drop based on utilization and priority
        if utilization >= self.drop_threshold:
            if priority == MessagePriority.LOW:
                return True
            elif utilization >= 0.95 and priority == MessagePriority.NORMAL:
                self.drop_counts[connection_id] += 1
                return True
                
        return False
        
    def record_processing_time(self, connection_id: str, processing_time_ms: float):
        """Record message processing time for rate calculation"""
        self.processing_rates[connection_id].append(processing_time_ms)
        
    def get_processing_rate(self, connection_id: str) -> float:
        """Get average processing rate in messages/second"""
        rates = self.processing_rates.get(connection_id)
        if not rates:
            return 0.0
            
        avg_time_ms = sum(rates) / len(rates)
        return 1000.0 / avg_time_ms if avg_time_ms > 0 else 0.0
        
    def _trigger_warning(self, connection_id: str, utilization: float, queue_size: int):
        """Trigger backpressure warning"""
        for callback in self.warning_callbacks:
            try:
                callback(connection_id, utilization, queue_size)
            except Exception as e:
                logger.error(f"Backpressure warning callback failed: {e}")
                
    def get_status(self) -> Dict[str, Any]:
        """Get backpressure status for all connections"""
        return {
            "queue_sizes": dict(self.queue_sizes),
            "drop_counts": dict(self.drop_counts),
            "max_queue_size": self.max_queue_size,
            "warning_threshold": self.warning_threshold,
            "drop_threshold": self.drop_threshold
        }


class LatencyTracker:
    """High-precision latency tracking for WebSocket performance"""
    
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.latency_samples = deque(maxlen=window_size)
        self.message_timestamps: Dict[str, float] = {}
        
    def record_send(self, message_id: str):
        """Record message send timestamp"""
        self.message_timestamps[message_id] = time.perf_counter()
        
    def record_receive(self, message_id: str) -> Optional[float]:
        """Record message receive and calculate latency"""
        if message_id not in self.message_timestamps:
            return None
            
        send_time = self.message_timestamps.pop(message_id)
        latency_ms = (time.perf_counter() - send_time) * 1000
        
        self.latency_samples.append(latency_ms)
        return latency_ms
        
    def get_statistics(self) -> Dict[str, float]:
        """Get latency statistics"""
        if not self.latency_samples:
            return {
                "average": 0.0,
                "median": 0.0,
                "p95": 0.0,
                "p99": 0.0,
                "min": 0.0,
                "max": 0.0
            }
            
        samples = sorted(self.latency_samples)
        n = len(samples)
        
        return {
            "average": sum(samples) / n,
            "median": samples[n // 2],
            "p95": samples[int(n * 0.95)] if n > 20 else samples[-1],
            "p99": samples[int(n * 0.99)] if n > 100 else samples[-1],
            "min": samples[0],
            "max": samples[-1]
        }


class OptimizedTelemetryStreamer:
    """High-performance telemetry streaming optimized for 200Hz data"""
    
    def __init__(
        self,
        target_frequency: int = 200,  # Hz
        max_latency_ms: float = 50.0,
        enable_compression: bool = True
    ):
        self.target_frequency = target_frequency
        self.max_latency_ms = max_latency_ms
        self.enable_compression = enable_compression
        
        # Calculate optimal batch parameters for target frequency
        self.batch_interval_ms = min(5, 1000 / target_frequency)  # At least every 5ms
        self.max_batch_size = max(1, target_frequency // 40)  # ~40 batches per second
        
        # Initialize components
        self.batcher = MessageBatcher(
            max_batch_size=self.max_batch_size,
            max_batch_delay_ms=int(self.batch_interval_ms),
            compression_method=CompressionMethod.LZ4 if enable_compression else CompressionMethod.NONE
        )
        
        self.backpressure = BackpressureController(
            max_queue_size=target_frequency * 2,  # 2 seconds buffer
            warning_threshold=0.6,
            drop_threshold=0.8
        )
        
        self.latency_tracker = LatencyTracker(window_size=target_frequency * 5)  # 5 seconds of samples
        
        # Connection management
        self.connections: Dict[str, Any] = {}
        self.connection_refs: weakref.WeakSet = weakref.WeakSet()
        
        # Performance monitoring
        self.performance_metrics = PerformanceMetrics()
        self._monitoring_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the optimized telemetry streamer"""
        await self.batcher.start()
        
        # Register batcher callback
        self.batcher.register_send_callback("telemetry", self._send_batch_to_connections)
        self.batcher.register_send_callback("critical", self._send_batch_to_connections)
        
        # Start performance monitoring
        self._monitoring_task = asyncio.create_task(self._performance_monitor())
        
        logger.info(f"OptimizedTelemetryStreamer started: {self.target_frequency}Hz target")
        
    async def stop(self):
        """Stop the telemetry streamer"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            
        await self.batcher.stop()
        logger.info("OptimizedTelemetryStreamer stopped")
        
    def add_connection(self, connection_id: str, websocket: Any):
        """Add WebSocket connection for telemetry streaming"""
        self.connections[connection_id] = websocket
        self.connection_refs.add(websocket)
        logger.info(f"Added telemetry connection: {connection_id}")
        
    def remove_connection(self, connection_id: str):
        """Remove WebSocket connection"""
        if connection_id in self.connections:
            del self.connections[connection_id]
            logger.info(f"Removed telemetry connection: {connection_id}")
            
    async def stream_telemetry(self, telemetry_data: Dict[str, Any], priority: MessagePriority = MessagePriority.NORMAL):
        """Stream telemetry data with optimization"""
        if not self.connections:
            return
            
        message_id = f"telem_{int(time.time() * 1000000)}"
        
        # Record send time for latency tracking
        self.latency_tracker.record_send(message_id)
        
        # Choose channel based on priority
        channel = "critical" if priority == MessagePriority.CRITICAL else "telemetry"
        
        # Add to batch
        await self.batcher.add_message(channel, message_id, telemetry_data, priority)
        
    async def _send_batch_to_connections(self, batch: TelemetryBatch):
        """Send batched telemetry to all connections"""
        if not self.connections:
            return
            
        # Create optimized message format
        message = {
            "type": "telemetry_batch",
            "batch_id": batch.batch_id,
            "timestamp": batch.timestamp,
            "message_count": batch.message_count,
            "compression": batch.compression_method.value,
            "data": batch.compressed_data.hex() if isinstance(batch.compressed_data, bytes) else batch.compressed_data
        }
        
        message_json = json.dumps(message, separators=(',', ':'))
        
        # Send to all connections with backpressure control
        failed_connections = []
        
        for connection_id, websocket in self.connections.items():
            try:
                # Check backpressure
                if self.backpressure.should_drop_message(connection_id, MessagePriority.NORMAL):
                    self.performance_metrics.dropped_messages += 1
                    continue
                    
                # Send message
                start_time = time.perf_counter()
                await websocket.send_text(message_json)
                
                # Record processing time
                processing_time = (time.perf_counter() - start_time) * 1000
                self.backpressure.record_processing_time(connection_id, processing_time)
                
                # Update queue size (approximation)
                queue_size = getattr(websocket, '_queue_size', 0)
                self.backpressure.update_queue_size(connection_id, queue_size)
                
            except Exception as e:
                logger.error(f"Failed to send telemetry batch to {connection_id}: {e}")
                failed_connections.append(connection_id)
                
        # Remove failed connections
        for connection_id in failed_connections:
            self.remove_connection(connection_id)
            
    async def _performance_monitor(self):
        """Monitor and log performance metrics"""
        while True:
            try:
                await asyncio.sleep(5.0)  # Update every 5 seconds
                
                # Update latency metrics
                latency_stats = self.latency_tracker.get_statistics()
                self.performance_metrics.average_latency_ms = latency_stats['average']
                self.performance_metrics.p95_latency_ms = latency_stats['p95']
                self.performance_metrics.p99_latency_ms = latency_stats['p99']
                
                # Calculate message rate
                now = datetime.utcnow()
                time_diff = (now - self.performance_metrics.last_update).total_seconds()
                if time_diff > 0:
                    messages_in_period = self.batcher.metrics.total_messages - self.performance_metrics.total_messages
                    self.performance_metrics.message_rate_hz = messages_in_period / time_diff
                    
                # Update from batcher metrics
                self.performance_metrics.total_messages = self.batcher.metrics.total_messages
                self.performance_metrics.total_bytes_sent = self.batcher.metrics.total_bytes_sent
                self.performance_metrics.compression_ratio = self.batcher.metrics.compression_ratio
                self.performance_metrics.batch_size_avg = self.batcher.metrics.batch_size_avg
                self.performance_metrics.last_update = now
                
                # Log performance if latency is high
                if latency_stats['p95'] > self.max_latency_ms:
                    logger.warning(f"High latency detected: P95={latency_stats['p95']:.1f}ms (target: {self.max_latency_ms}ms)")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Performance monitoring error: {e}")
                
    def get_performance_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        return self.performance_metrics
        
    def get_backpressure_status(self) -> Dict[str, Any]:
        """Get backpressure status"""
        return self.backpressure.get_status()