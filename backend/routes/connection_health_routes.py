"""Connection Health Monitoring Routes

Provides REST API and WebSocket endpoints for connection health monitoring.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import JSONResponse

from ..websocket.connection_health_monitor import (
    ConnectionHealthMonitor,
    ConnectionType,
    ConnectionHealthLevel
)
from ..websocket.connection_health_websocket import (
    ConnectionHealthWebSocketManager,
    get_connection_health_ws_manager,
    initialize_connection_health_ws_manager
)
from ..rbac.permissions import require_permission
from ..auth.dependencies import get_current_user
from ..models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connection-health", tags=["connection-health"])

# Global health monitor instance
_health_monitor: Optional[ConnectionHealthMonitor] = None


def get_health_monitor() -> ConnectionHealthMonitor:
    """Get the global health monitor instance"""
    global _health_monitor
    if _health_monitor is None:
        _health_monitor = ConnectionHealthMonitor({
            'monitoring_interval': 1.0,
            'enable_auto_stop': True,
            'grace_period': 3.0
        })
        
        # Initialize WebSocket manager
        initialize_connection_health_ws_manager(_health_monitor)
        
        # Register default connections
        _health_monitor.register_connection(
            'rest-api',
            ConnectionType.REST_API,
            {'connected': True}
        )
        
        # Start monitoring
        import asyncio
        asyncio.create_task(_health_monitor.start_monitoring())
        
    return _health_monitor


@router.get("/status")
async def get_connection_status(
    connection_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get connection status
    
    Args:
        connection_id: Optional specific connection ID to query
        
    Returns:
        Connection status information
    """
    monitor = get_health_monitor()
    
    if connection_id:
        status = monitor.get_connection_status(connection_id)
        if not status:
            raise HTTPException(404, f"Connection {connection_id} not found")
            
        return {
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
    else:
        # Return all connections status
        all_status = monitor.get_all_connections_status()
        return {
            'overall_health': monitor.get_overall_health().value,
            'critical_connections': monitor.get_critical_connections(),
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


@router.get("/metrics-report")
async def get_metrics_report(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive metrics report
    
    Returns:
        Detailed metrics report for all connections
    """
    monitor = get_health_monitor()
    return monitor.export_metrics_report()


@router.post("/register")
@require_permission("admin")
async def register_connection(
    connection_id: str,
    connection_type: str,
    initial_state: Optional[Dict[str, Any]] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Register a new connection for monitoring
    
    Args:
        connection_id: Unique identifier for the connection
        connection_type: Type of connection (websocket, rest_api, hardware_serial, etc.)
        initial_state: Optional initial state for the connection
        
    Returns:
        Success message
    """
    monitor = get_health_monitor()
    
    try:
        conn_type = ConnectionType(connection_type)
    except ValueError:
        raise HTTPException(400, f"Invalid connection type: {connection_type}")
        
    monitor.register_connection(connection_id, conn_type, initial_state)
    
    return {"message": f"Connection {connection_id} registered successfully"}


@router.post("/update-metrics")
async def update_connection_metrics(
    connection_id: str,
    latency: float,
    success: bool = True,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Update metrics for a connection
    
    Args:
        connection_id: Connection to update
        latency: Measured latency in milliseconds
        success: Whether the measurement was successful
        
    Returns:
        Success message
    """
    monitor = get_health_monitor()
    
    status = monitor.get_connection_status(connection_id)
    if not status:
        raise HTTPException(404, f"Connection {connection_id} not found")
        
    monitor.update_metrics(connection_id, latency, success)
    
    return {"message": "Metrics updated successfully"}


@router.post("/report-loss")
async def report_connection_loss(
    connection_id: str,
    error: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Report a connection loss
    
    Args:
        connection_id: Connection that was lost
        error: Optional error message
        
    Returns:
        Success message
    """
    monitor = get_health_monitor()
    
    status = monitor.get_connection_status(connection_id)
    if not status:
        raise HTTPException(404, f"Connection {connection_id} not found")
        
    error_obj = Exception(error) if error else None
    monitor.report_connection_loss(connection_id, error_obj)
    
    return {"message": "Connection loss reported"}


@router.post("/report-restored")
async def report_connection_restored(
    connection_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Report a connection restoration
    
    Args:
        connection_id: Connection that was restored
        
    Returns:
        Success message
    """
    monitor = get_health_monitor()
    
    status = monitor.get_connection_status(connection_id)
    if not status:
        raise HTTPException(404, f"Connection {connection_id} not found")
        
    monitor.report_connection_restored(connection_id)
    
    return {"message": "Connection restoration reported"}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time connection health updates"""
    ws_manager = get_connection_health_ws_manager()
    
    await ws_manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Handle the message
            await ws_manager.handle_message(websocket, data)
            
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ws_manager.disconnect(websocket)


# Integration with emergency stop system
def integrate_with_emergency_stop():
    """Set up integration with emergency stop system"""
    monitor = get_health_monitor()
    
    async def on_emergency_stop(reason: str, connections: list):
        """Handle emergency stop triggered by connection loss"""
        logger.critical(f"Emergency stop triggered: {reason}")
        logger.critical(f"Failed connections: {connections}")
        
        # Import here to avoid circular dependency
        from ..hardware.emergency_stop_manager import get_emergency_manager
        
        try:
            manager = get_emergency_manager()
            if manager:
                await manager.activate_emergency_stop(
                    f"Connection health monitor: {reason}"
                )
        except Exception as e:
            logger.error(f"Failed to activate emergency stop: {e}")
            
    # Register callback
    monitor.add_callback('emergency_stop', on_emergency_stop)


# Initialize integration on module load
try:
    integrate_with_emergency_stop()
except Exception as e:
    logger.error(f"Failed to integrate with emergency stop: {e}")