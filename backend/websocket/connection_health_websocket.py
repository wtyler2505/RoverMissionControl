"""WebSocket Integration for Connection Health Monitoring

Provides real-time connection health updates to frontend clients.
"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect

from .connection_health_monitor import (
    ConnectionHealthMonitor,
    ConnectionType,
    ConnectionHealthLevel
)

logger = logging.getLogger(__name__)


class ConnectionHealthWebSocketManager:
    """Manages WebSocket connections for health monitoring"""
    
    def __init__(self, health_monitor: ConnectionHealthMonitor):
        self.health_monitor = health_monitor
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        
        # Register callbacks with health monitor
        self._register_callbacks()
        
    def _register_callbacks(self):
        """Register callbacks with the health monitor"""
        self.health_monitor.add_callback('health_change', self._on_health_change)
        self.health_monitor.add_callback('connection_lost', self._on_connection_lost)
        self.health_monitor.add_callback('connection_restored', self._on_connection_restored)
        self.health_monitor.add_callback('metrics_update', self._on_metrics_update)
        self.health_monitor.add_callback('emergency_stop', self._on_emergency_stop)
        
    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = set()
        
        # Send initial status
        await self._send_initial_status(websocket)
        
        logger.info(f"WebSocket client connected for health monitoring")
        
    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection"""
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        
        logger.info(f"WebSocket client disconnected from health monitoring")
        
    async def handle_message(self, websocket: WebSocket, message: Dict) -> None:
        """Handle incoming WebSocket message"""
        try:
            msg_type = message.get('type')
            data = message.get('data', {})
            
            if msg_type == 'subscribe':
                await self._handle_subscribe(websocket, data)
            elif msg_type == 'unsubscribe':
                await self._handle_unsubscribe(websocket, data)
            elif msg_type == 'get_status':
                await self._send_connection_status(websocket, data.get('connection_id'))
            elif msg_type == 'get_all_status':
                await self._send_all_status(websocket)
            elif msg_type == 'get_metrics_report':
                await self._send_metrics_report(websocket)
            elif msg_type == 'ping':
                await self._send_message(websocket, {
                    'type': 'pong',
                    'data': {'timestamp': data.get('timestamp')}
                })
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            await self._send_error(websocket, str(e))
            
    async def _send_initial_status(self, websocket: WebSocket) -> None:
        """Send initial status to newly connected client"""
        all_status = self.health_monitor.get_all_connections_status()
        
        await self._send_message(websocket, {
            'type': 'initial_status',
            'data': {
                'overall_health': self.health_monitor.get_overall_health().value,
                'connections': {
                    conn_id: {
                        'type': status.connection_type.value,
                        'health': status.health.value,
                        'connected': status.connected,
                        'metrics': {
                            'latency': status.metrics.latency,
                            'average_latency': status.metrics.average_latency,
                            'packet_loss': status.metrics.packet_loss,
                            'jitter': status.metrics.jitter,
                            'last_update': status.metrics.last_update
                        }
                    }
                    for conn_id, status in all_status.items()
                }
            }
        })
        
    async def _handle_subscribe(self, websocket: WebSocket, data: Dict) -> None:
        """Handle subscription request"""
        topics = data.get('topics', [])
        if 'all' in topics:
            # Subscribe to all connections
            all_connections = self.health_monitor.get_all_connections_status()
            self.subscriptions[websocket] = set(all_connections.keys())
        else:
            # Subscribe to specific connections
            self.subscriptions[websocket].update(topics)
            
        await self._send_message(websocket, {
            'type': 'subscribed',
            'data': {'topics': list(self.subscriptions[websocket])}
        })
        
    async def _handle_unsubscribe(self, websocket: WebSocket, data: Dict) -> None:
        """Handle unsubscription request"""
        topics = data.get('topics', [])
        if 'all' in topics:
            self.subscriptions[websocket].clear()
        else:
            self.subscriptions[websocket].difference_update(topics)
            
        await self._send_message(websocket, {
            'type': 'unsubscribed',
            'data': {'topics': topics}
        })
        
    async def _send_connection_status(self, websocket: WebSocket, 
                                    connection_id: Optional[str]) -> None:
        """Send status for a specific connection"""
        if not connection_id:
            await self._send_error(websocket, "Connection ID required")
            return
            
        status = self.health_monitor.get_connection_status(connection_id)
        if not status:
            await self._send_error(websocket, f"Connection {connection_id} not found")
            return
            
        await self._send_message(websocket, {
            'type': 'connection_status',
            'data': {
                'connection_id': connection_id,
                'type': status.connection_type.value,
                'health': status.health.value,
                'connected': status.connected,
                'metrics': {
                    'latency': status.metrics.latency,
                    'average_latency': status.metrics.average_latency,
                    'packet_loss': status.metrics.packet_loss,
                    'jitter': status.metrics.jitter,
                    'throughput': status.metrics.throughput,
                    'error_rate': status.metrics.error_rate,
                    'last_update': status.metrics.last_update
                },
                'uptime': status.uptime,
                'reconnect_attempts': status.reconnect_attempts,
                'errors': status.errors[-5:]  # Last 5 errors
            }
        })
        
    async def _send_all_status(self, websocket: WebSocket) -> None:
        """Send status for all connections"""
        all_status = self.health_monitor.get_all_connections_status()
        
        await self._send_message(websocket, {
            'type': 'all_status',
            'data': {
                'overall_health': self.health_monitor.get_overall_health().value,
                'critical_connections': self.health_monitor.get_critical_connections(),
                'connections': {
                    conn_id: {
                        'type': status.connection_type.value,
                        'health': status.health.value,
                        'connected': status.connected,
                        'metrics': {
                            'latency': status.metrics.latency,
                            'average_latency': status.metrics.average_latency,
                            'packet_loss': status.metrics.packet_loss,
                            'jitter': status.metrics.jitter
                        }
                    }
                    for conn_id, status in all_status.items()
                }
            }
        })
        
    async def _send_metrics_report(self, websocket: WebSocket) -> None:
        """Send comprehensive metrics report"""
        report = self.health_monitor.export_metrics_report()
        
        await self._send_message(websocket, {
            'type': 'metrics_report',
            'data': report
        })
        
    # Callback handlers
    
    async def _on_health_change(self, connection_id: str, 
                               new_health: ConnectionHealthLevel) -> None:
        """Handle health change event"""
        status = self.health_monitor.get_connection_status(connection_id)
        if not status:
            return
            
        message = {
            'type': 'health_change',
            'data': {
                'connection_id': connection_id,
                'connection_type': status.connection_type.value,
                'health': new_health.value,
                'connected': status.connected,
                'metrics': {
                    'latency': status.metrics.latency,
                    'average_latency': status.metrics.average_latency,
                    'packet_loss': status.metrics.packet_loss,
                    'jitter': status.metrics.jitter
                }
            }
        }
        
        await self._broadcast_to_subscribers(connection_id, message)
        
    async def _on_connection_lost(self, connection_id: str, 
                                 connection_type: ConnectionType) -> None:
        """Handle connection lost event"""
        message = {
            'type': 'connection_lost',
            'data': {
                'connection_id': connection_id,
                'connection_type': connection_type.value,
                'timestamp': asyncio.get_event_loop().time()
            }
        }
        
        await self._broadcast_to_subscribers(connection_id, message)
        
    async def _on_connection_restored(self, connection_id: str,
                                    connection_type: ConnectionType) -> None:
        """Handle connection restored event"""
        message = {
            'type': 'connection_restored',
            'data': {
                'connection_id': connection_id,
                'connection_type': connection_type.value,
                'timestamp': asyncio.get_event_loop().time()
            }
        }
        
        await self._broadcast_to_subscribers(connection_id, message)
        
    async def _on_metrics_update(self, connection_id: str, metrics: Dict) -> None:
        """Handle metrics update event"""
        message = {
            'type': 'metrics_update',
            'data': {
                'connection_id': connection_id,
                'metrics': {
                    'latency': metrics.latency,
                    'average_latency': metrics.average_latency,
                    'packet_loss': metrics.packet_loss,
                    'jitter': metrics.jitter,
                    'throughput': metrics.throughput,
                    'error_rate': metrics.error_rate
                }
            }
        }
        
        await self._broadcast_to_subscribers(connection_id, message)
        
    async def _on_emergency_stop(self, reason: str, connections: List[str]) -> None:
        """Handle emergency stop event"""
        message = {
            'type': 'emergency_stop',
            'data': {
                'reason': reason,
                'connections': connections,
                'timestamp': asyncio.get_event_loop().time()
            }
        }
        
        # Broadcast to all clients
        await self._broadcast_to_all(message)
        
    # Helper methods
    
    async def _broadcast_to_subscribers(self, connection_id: str, message: Dict) -> None:
        """Broadcast message to subscribers of a specific connection"""
        disconnected = set()
        
        for websocket in self.active_connections:
            if connection_id in self.subscriptions.get(websocket, set()):
                try:
                    await self._send_message(websocket, message)
                except WebSocketDisconnect:
                    disconnected.add(websocket)
                except Exception as e:
                    logger.error(f"Error broadcasting to subscriber: {e}")
                    disconnected.add(websocket)
                    
        # Clean up disconnected clients
        for websocket in disconnected:
            self.disconnect(websocket)
            
    async def _broadcast_to_all(self, message: Dict) -> None:
        """Broadcast message to all connected clients"""
        disconnected = set()
        
        for websocket in self.active_connections:
            try:
                await self._send_message(websocket, message)
            except WebSocketDisconnect:
                disconnected.add(websocket)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.add(websocket)
                
        # Clean up disconnected clients
        for websocket in disconnected:
            self.disconnect(websocket)
            
    async def _send_message(self, websocket: WebSocket, message: Dict) -> None:
        """Send a message to a specific WebSocket client"""
        await websocket.send_json(message)
        
    async def _send_error(self, websocket: WebSocket, error: str) -> None:
        """Send an error message to a WebSocket client"""
        await self._send_message(websocket, {
            'type': 'error',
            'data': {'message': error}
        })


# Global instance
_ws_manager: Optional[ConnectionHealthWebSocketManager] = None


def get_connection_health_ws_manager() -> ConnectionHealthWebSocketManager:
    """Get the global WebSocket manager instance"""
    global _ws_manager
    if _ws_manager is None:
        raise RuntimeError("WebSocket manager not initialized")
    return _ws_manager


def initialize_connection_health_ws_manager(health_monitor: ConnectionHealthMonitor) -> None:
    """Initialize the global WebSocket manager"""
    global _ws_manager
    _ws_manager = ConnectionHealthWebSocketManager(health_monitor)