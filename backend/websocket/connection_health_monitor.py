"""Connection Health Monitor - Backend Service

Monitors connection health for WebSocket, REST API, and hardware interfaces.
Provides real-time metrics, automatic failover, and emergency stop integration.
"""

import asyncio
import time
import json
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)


class ConnectionType(str, Enum):
    """Types of connections to monitor"""
    WEBSOCKET = "websocket"
    REST_API = "rest_api"
    HARDWARE_SERIAL = "hardware_serial"
    HARDWARE_USB = "hardware_usb"
    HARDWARE_GPIO = "hardware_gpio"


class ConnectionHealthLevel(str, Enum):
    """Health levels for connections"""
    EXCELLENT = "excellent"  # < 50ms latency, 0% loss
    GOOD = "good"           # < 100ms latency, < 1% loss
    FAIR = "fair"           # < 200ms latency, < 5% loss
    POOR = "poor"           # < 500ms latency, < 10% loss
    CRITICAL = "critical"   # > 500ms latency or > 10% loss
    DISCONNECTED = "disconnected"


@dataclass
class ConnectionMetrics:
    """Metrics for a connection"""
    latency: float = 0.0
    average_latency: float = 0.0
    min_latency: float = float('inf')
    max_latency: float = 0.0
    packet_loss: float = 0.0
    jitter: float = 0.0
    throughput: float = 0.0
    error_rate: float = 0.0
    last_update: float = 0.0


@dataclass
class ConnectionStatus:
    """Status of a monitored connection"""
    connection_id: str
    connection_type: ConnectionType
    health: ConnectionHealthLevel
    connected: bool
    last_seen: float
    metrics: ConnectionMetrics
    errors: List[Dict[str, Any]]
    consecutive_failures: int = 0
    uptime: float = 0.0
    reconnect_attempts: int = 0


@dataclass
class HealthThresholds:
    """Thresholds for health levels"""
    excellent_latency: float = 50.0
    good_latency: float = 100.0
    fair_latency: float = 200.0
    poor_latency: float = 500.0
    critical_timeout: float = 5000.0
    packet_loss_threshold: float = 10.0
    jitter_threshold: float = 50.0
    min_samples: int = 10


class ConnectionHealthMonitor:
    """Monitor connection health across all interfaces"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {
            'monitoring_interval': 1.0,
            'metrics_window': 60.0,
            'enable_auto_stop': True,
            'grace_period': 3.0,
            'max_events': 1000,
            **(config or {})
        }
        
        self.thresholds = HealthThresholds()
        self.connections: Dict[str, ConnectionStatus] = {}
        self.metrics_buffer: Dict[str, List[float]] = {}
        self.event_log: List[Dict[str, Any]] = []
        self.monitoring_task: Optional[asyncio.Task] = None
        self._callbacks: Dict[str, List[Callable]] = {
            'health_change': [],
            'connection_lost': [],
            'connection_restored': [],
            'emergency_stop': [],
            'metrics_update': []
        }
        self._stop_event = asyncio.Event()
        
    def register_connection(self, connection_id: str, connection_type: ConnectionType,
                          initial_state: Optional[Dict[str, Any]] = None) -> None:
        """Register a connection for monitoring"""
        status = ConnectionStatus(
            connection_id=connection_id,
            connection_type=connection_type,
            health=ConnectionHealthLevel.DISCONNECTED,
            connected=False,
            last_seen=time.time(),
            metrics=ConnectionMetrics(),
            errors=[],
            **(initial_state or {})
        )
        
        self.connections[connection_id] = status
        self.metrics_buffer[connection_id] = []
        
        self._log_event({
            'type': 'connection_registered',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'connection_id': connection_id,
                'connection_type': connection_type.value
            }
        })
        
        logger.info(f"Registered connection: {connection_id} ({connection_type.value})")
        
    def update_metrics(self, connection_id: str, latency: float, 
                      success: bool = True) -> None:
        """Update metrics for a connection"""
        if connection_id not in self.connections:
            return
            
        connection = self.connections[connection_id]
        now = time.time()
        connection.last_seen = now
        
        if success:
            # Update latency metrics
            metrics = connection.metrics
            metrics.latency = latency
            metrics.min_latency = min(metrics.min_latency, latency)
            metrics.max_latency = max(metrics.max_latency, latency)
            
            # Calculate exponential moving average
            if metrics.average_latency == 0:
                metrics.average_latency = latency
            else:
                metrics.average_latency = metrics.average_latency * 0.9 + latency * 0.1
                
            metrics.last_update = now
            
            # Update buffer for jitter calculation
            buffer = self.metrics_buffer[connection_id]
            buffer.append(latency)
            
            # Keep only recent samples
            window_size = int(self.config['metrics_window'])
            if len(buffer) > window_size:
                buffer.pop(0)
                
            # Calculate jitter
            if len(buffer) >= 2:
                diffs = [abs(buffer[i] - buffer[i-1]) for i in range(1, len(buffer))]
                metrics.jitter = statistics.mean(diffs) if diffs else 0.0
                
            # Reset consecutive failures
            connection.consecutive_failures = 0
            connection.connected = True
            
        else:
            # Increment failure count
            connection.consecutive_failures += 1
            connection.metrics.error_rate += 1
            
        # Update health level
        old_health = connection.health
        connection.health = self._calculate_health_level(connection)
        
        if old_health != connection.health:
            self._trigger_callbacks('health_change', connection_id, connection.health)
            self._handle_health_transition(connection_id, old_health, connection.health)
            
        self._trigger_callbacks('metrics_update', connection_id, connection.metrics)
        
    def report_connection_loss(self, connection_id: str, error: Optional[Exception] = None) -> None:
        """Report that a connection has been lost"""
        if connection_id not in self.connections:
            return
            
        connection = self.connections[connection_id]
        connection.connected = False
        connection.health = ConnectionHealthLevel.DISCONNECTED
        connection.consecutive_failures += 1
        
        if error:
            connection.errors.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': str(error),
                'type': type(error).__name__
            })
            
            # Keep only recent errors
            if len(connection.errors) > 10:
                connection.errors.pop(0)
                
        self._trigger_callbacks('connection_lost', connection_id, connection.connection_type)
        
        self._log_event({
            'type': 'connection_lost',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'connection_id': connection_id,
                'connection_type': connection.connection_type.value,
                'error': str(error) if error else None
            }
        })
        
        # Check if emergency stop is needed
        asyncio.create_task(self._evaluate_emergency_stop())
        
    def report_connection_restored(self, connection_id: str) -> None:
        """Report that a connection has been restored"""
        if connection_id not in self.connections:
            return
            
        connection = self.connections[connection_id]
        connection.connected = True
        connection.consecutive_failures = 0
        connection.reconnect_attempts += 1
        
        self._trigger_callbacks('connection_restored', connection_id, connection.connection_type)
        
        self._log_event({
            'type': 'connection_restored',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'connection_id': connection_id,
                'connection_type': connection.connection_type.value
            }
        })
        
    async def start_monitoring(self) -> None:
        """Start the monitoring loop"""
        if self.monitoring_task and not self.monitoring_task.done():
            return
            
        self._stop_event.clear()
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Connection health monitoring started")
        
    async def stop_monitoring(self) -> None:
        """Stop the monitoring loop"""
        self._stop_event.set()
        if self.monitoring_task:
            await self.monitoring_task
        logger.info("Connection health monitoring stopped")
        
    def get_connection_status(self, connection_id: str) -> Optional[ConnectionStatus]:
        """Get status for a specific connection"""
        return self.connections.get(connection_id)
        
    def get_all_connections_status(self) -> Dict[str, ConnectionStatus]:
        """Get status for all connections"""
        return self.connections.copy()
        
    def get_overall_health(self) -> ConnectionHealthLevel:
        """Get the worst health level across all connections"""
        if not self.connections:
            return ConnectionHealthLevel.EXCELLENT
            
        health_priority = [
            ConnectionHealthLevel.EXCELLENT,
            ConnectionHealthLevel.GOOD,
            ConnectionHealthLevel.FAIR,
            ConnectionHealthLevel.POOR,
            ConnectionHealthLevel.CRITICAL,
            ConnectionHealthLevel.DISCONNECTED
        ]
        
        worst_health = ConnectionHealthLevel.EXCELLENT
        worst_priority = health_priority.index(worst_health)
        
        for connection in self.connections.values():
            current_priority = health_priority.index(connection.health)
            if current_priority > worst_priority:
                worst_health = connection.health
                worst_priority = current_priority
                
        return worst_health
        
    def get_critical_connections(self) -> List[str]:
        """Get list of connections in critical state"""
        critical = []
        for conn_id, connection in self.connections.items():
            if connection.health in [ConnectionHealthLevel.CRITICAL, ConnectionHealthLevel.DISCONNECTED]:
                critical.append(conn_id)
        return critical
        
    def export_metrics_report(self) -> Dict[str, Any]:
        """Export comprehensive metrics report"""
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'overall_health': self.get_overall_health().value,
            'critical_connections': self.get_critical_connections(),
            'connections': {},
            'event_summary': self._get_event_summary()
        }
        
        for conn_id, connection in self.connections.items():
            report['connections'][conn_id] = {
                'type': connection.connection_type.value,
                'health': connection.health.value,
                'connected': connection.connected,
                'metrics': asdict(connection.metrics),
                'uptime': connection.uptime,
                'reconnect_attempts': connection.reconnect_attempts,
                'recent_errors': connection.errors[-5:] if connection.errors else []
            }
            
        return report
        
    def add_callback(self, event_type: str, callback: Callable) -> None:
        """Add a callback for an event type"""
        if event_type in self._callbacks:
            self._callbacks[event_type].append(callback)
            
    def remove_callback(self, event_type: str, callback: Callable) -> None:
        """Remove a callback for an event type"""
        if event_type in self._callbacks and callback in self._callbacks[event_type]:
            self._callbacks[event_type].remove(callback)
            
    async def _monitoring_loop(self) -> None:
        """Main monitoring loop"""
        interval = self.config['monitoring_interval']
        
        while not self._stop_event.is_set():
            try:
                await self._check_all_connections()
                await asyncio.sleep(interval)
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval)
                
    async def _check_all_connections(self) -> None:
        """Check health of all connections"""
        now = time.time()
        
        for conn_id, connection in self.connections.items():
            # Check for timeout
            time_since_last_seen = now - connection.last_seen
            if (time_since_last_seen > self.thresholds.critical_timeout / 1000 and 
                connection.connected):
                self.report_connection_loss(
                    conn_id, 
                    Exception(f"Connection timeout: {time_since_last_seen:.0f}ms")
                )
                
            # Update uptime
            if connection.connected:
                connection.uptime += self.config['monitoring_interval']
                
            # Calculate packet loss
            buffer = self.metrics_buffer.get(conn_id, [])
            expected_samples = int(self.config['metrics_window'] / self.config['monitoring_interval'])
            if expected_samples > 0 and buffer:
                connection.metrics.packet_loss = (
                    (expected_samples - len(buffer)) / expected_samples * 100
                )
                
    def _calculate_health_level(self, connection: ConnectionStatus) -> ConnectionHealthLevel:
        """Calculate health level based on metrics"""
        if not connection.connected:
            return ConnectionHealthLevel.DISCONNECTED
            
        metrics = connection.metrics
        thresholds = self.thresholds
        
        # Check critical conditions
        if (time.time() - connection.last_seen > thresholds.critical_timeout / 1000 or
            connection.consecutive_failures > 5):
            return ConnectionHealthLevel.CRITICAL
            
        # Evaluate based on latency and packet loss
        if (metrics.average_latency <= thresholds.excellent_latency and
            metrics.packet_loss == 0):
            return ConnectionHealthLevel.EXCELLENT
            
        if (metrics.average_latency <= thresholds.good_latency and
            metrics.packet_loss < 1):
            return ConnectionHealthLevel.GOOD
            
        if (metrics.average_latency <= thresholds.fair_latency and
            metrics.packet_loss < 5):
            return ConnectionHealthLevel.FAIR
            
        if (metrics.average_latency <= thresholds.poor_latency and
            metrics.packet_loss < thresholds.packet_loss_threshold):
            return ConnectionHealthLevel.POOR
            
        return ConnectionHealthLevel.CRITICAL
        
    def _handle_health_transition(self, connection_id: str, old_health: ConnectionHealthLevel,
                                new_health: ConnectionHealthLevel) -> None:
        """Handle health level transitions"""
        connection = self.connections.get(connection_id)
        if not connection:
            return
            
        # Log significant transitions
        if (old_health in [ConnectionHealthLevel.EXCELLENT, ConnectionHealthLevel.GOOD] and
            new_health in [ConnectionHealthLevel.CRITICAL, ConnectionHealthLevel.DISCONNECTED]):
            
            self._log_event({
                'type': 'health_degradation',
                'timestamp': datetime.utcnow().isoformat(),
                'data': {
                    'connection_id': connection_id,
                    'connection_type': connection.connection_type.value,
                    'old_health': old_health.value,
                    'new_health': new_health.value,
                    'metrics': asdict(connection.metrics)
                }
            })
            
    async def _evaluate_emergency_stop(self) -> None:
        """Evaluate if emergency stop should be triggered"""
        if not self.config['enable_auto_stop']:
            return
            
        critical_connections = self.get_critical_connections()
        critical_types = set()
        
        for conn_id in critical_connections:
            connection = self.connections.get(conn_id)
            if connection:
                critical_types.add(connection.connection_type)
                
        # Check if critical connection types warrant emergency stop
        hardware_types = {
            ConnectionType.HARDWARE_SERIAL,
            ConnectionType.HARDWARE_USB,
            ConnectionType.HARDWARE_GPIO
        }
        
        should_trigger = (
            critical_types & hardware_types or
            (ConnectionType.WEBSOCKET in critical_types and len(critical_connections) > 1)
        )
        
        if should_trigger:
            # Use grace period before triggering
            await asyncio.sleep(self.config['grace_period'])
            
            # Re-check after grace period
            still_critical = self.get_critical_connections()
            if still_critical:
                reason = f"Critical connection loss detected: {', '.join(still_critical)}"
                self._trigger_callbacks('emergency_stop', reason, still_critical)
                
                self._log_event({
                    'type': 'emergency_stop_triggered',
                    'timestamp': datetime.utcnow().isoformat(),
                    'data': {
                        'reason': reason,
                        'connections': still_critical
                    }
                })
                
    def _trigger_callbacks(self, event_type: str, *args, **kwargs) -> None:
        """Trigger callbacks for an event type"""
        for callback in self._callbacks.get(event_type, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(*args, **kwargs))
                else:
                    callback(*args, **kwargs)
            except Exception as e:
                logger.error(f"Error in callback for {event_type}: {e}")
                
    def _log_event(self, event: Dict[str, Any]) -> None:
        """Log an event"""
        self.event_log.append(event)
        
        # Trim log if needed
        max_events = self.config.get('max_events', 1000)
        if len(self.event_log) > max_events:
            self.event_log = self.event_log[-max_events:]
            
    def _get_event_summary(self) -> Dict[str, Any]:
        """Get summary of recent events"""
        if not self.event_log:
            return {}
            
        # Count events by type in last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_events = [
            e for e in self.event_log
            if datetime.fromisoformat(e['timestamp']) > one_hour_ago
        ]
        
        event_counts = {}
        for event in recent_events:
            event_type = event['type']
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
            
        return {
            'total_events': len(self.event_log),
            'recent_events': len(recent_events),
            'event_counts': event_counts
        }