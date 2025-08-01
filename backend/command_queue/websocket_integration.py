"""
WebSocket integration for real-time command queue updates
"""

import asyncio
import json
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Set

from ..websocket.websocket_server import WebSocketServer
from ..websocket.message_protocols import MessageProtocolManager

from .command_base import Command, CommandStatus, CommandPriority
from .command_queue import PriorityCommandQueue, QueueStatistics


logger = logging.getLogger(__name__)


class CommandEventType(Enum):
    """Types of command queue events"""
    COMMAND_QUEUED = "command_queued"
    COMMAND_STARTED = "command_started"
    COMMAND_COMPLETED = "command_completed"
    COMMAND_FAILED = "command_failed"
    COMMAND_CANCELLED = "command_cancelled"
    COMMAND_RETRYING = "command_retrying"
    QUEUE_STATUS_UPDATE = "queue_status_update"
    PROCESSOR_STATUS_UPDATE = "processor_status_update"


class CommandQueueWebSocketHandler:
    """
    Handles WebSocket communication for command queue events
    Integrates with existing WebSocket infrastructure
    """
    
    def __init__(
        self,
        ws_server: WebSocketServer,
        command_queue: PriorityCommandQueue,
        protocol_manager: Optional[MessageProtocolManager] = None
    ):
        self.ws_server = ws_server
        self.command_queue = command_queue
        self.protocol_manager = protocol_manager or MessageProtocolManager()
        
        # Event subscriptions
        self._event_subscriptions: Dict[str, Set[CommandEventType]] = {}
        self._subscriber_filters: Dict[str, Dict[str, Any]] = {}
        
        # Update intervals
        self._status_update_interval = 5.0  # seconds
        self._status_update_task: Optional[asyncio.Task] = None
        
        # Statistics
        self._events_sent = 0
        self._last_queue_stats: Optional[QueueStatistics] = None
    
    async def initialize(self):
        """Initialize the WebSocket handler"""
        # Register event handlers with WebSocket server
        await self._register_handlers()
        
        # Start status update loop
        self._status_update_task = asyncio.create_task(self._status_update_loop())
        
        logger.info("Command queue WebSocket handler initialized")
    
    async def shutdown(self):
        """Shutdown the WebSocket handler"""
        if self._status_update_task:
            self._status_update_task.cancel()
            try:
                await self._status_update_task
            except asyncio.CancelledError:
                pass
    
    async def _register_handlers(self):
        """Register WebSocket event handlers"""
        # Register handlers for command queue events
        self.ws_server.sio.on('subscribe_command_events', namespace='/command')(
            self._handle_subscribe_events
        )
        self.ws_server.sio.on('unsubscribe_command_events', namespace='/command')(
            self._handle_unsubscribe_events
        )
        self.ws_server.sio.on('get_queue_status', namespace='/command')(
            self._handle_get_queue_status
        )
        self.ws_server.sio.on('get_command_details', namespace='/command')(
            self._handle_get_command_details
        )
        
        # Register acknowledgment-specific handlers
        self.ws_server.sio.on('get_acknowledgment_status', namespace='/command')(
            self._handle_get_acknowledgment_status
        )
        self.ws_server.sio.on('subscribe_acknowledgment_updates', namespace='/command')(
            self._handle_subscribe_acknowledgment_updates
        )
        self.ws_server.sio.on('get_command_progress', namespace='/command')(
            self._handle_get_command_progress
        )
    
    async def emit_command_event(
        self,
        event_type: CommandEventType,
        command: Command,
        additional_data: Optional[Dict[str, Any]] = None
    ):
        """Emit a command event to subscribed clients"""
        event_data = {
            "event_type": event_type.value,
            "timestamp": datetime.utcnow().isoformat(),
            "command": {
                "id": command.id,
                "type": command.command_type.value,
                "priority": command.priority.name,
                "status": command.status.value,
                "created_at": command.created_at.isoformat(),
                "retry_count": command.retry_count
            }
        }
        
        if additional_data:
            event_data.update(additional_data)
        
        # Send to subscribed clients
        subscribers = await self._get_event_subscribers(event_type, command)
        
        for sid in subscribers:
            try:
                # Encode message based on client protocol
                encoded_message = await self.protocol_manager.encode_message(
                    sid,
                    "command_event",
                    event_data
                )
                
                await self.ws_server.sio.emit(
                    'command_event',
                    encoded_message,
                    room=sid,
                    namespace='/command'
                )
                
                self._events_sent += 1
                
            except Exception as e:
                logger.error(f"Error sending command event to {sid}: {e}")
    
    async def _get_event_subscribers(
        self,
        event_type: CommandEventType,
        command: Command
    ) -> List[str]:
        """Get list of subscribers for a specific event"""
        subscribers = []
        
        for sid, subscribed_events in self._event_subscriptions.items():
            if event_type not in subscribed_events:
                continue
            
            # Check filters
            filters = self._subscriber_filters.get(sid, {})
            
            # Priority filter
            if 'priorities' in filters:
                if command.priority.name not in filters['priorities']:
                    continue
            
            # Command type filter
            if 'command_types' in filters:
                if command.command_type.value not in filters['command_types']:
                    continue
            
            # Status filter
            if 'statuses' in filters:
                if command.status.value not in filters['statuses']:
                    continue
            
            subscribers.append(sid)
        
        return subscribers
    
    async def _handle_subscribe_events(self, sid: str, data: Dict[str, Any]):
        """Handle event subscription request"""
        try:
            # Parse requested events
            event_types = data.get('event_types', [])
            filters = data.get('filters', {})
            
            # Validate event types
            valid_events = set()
            for event_str in event_types:
                try:
                    event = CommandEventType(event_str)
                    valid_events.add(event)
                except ValueError:
                    logger.warning(f"Invalid event type requested: {event_str}")
            
            # Store subscription
            self._event_subscriptions[sid] = valid_events
            self._subscriber_filters[sid] = filters
            
            # Send confirmation
            await self.ws_server.sio.emit(
                'subscription_confirmed',
                {
                    "subscribed_events": [e.value for e in valid_events],
                    "filters": filters
                },
                room=sid,
                namespace='/command'
            )
            
            logger.info(f"Client {sid} subscribed to command events: {valid_events}")
            
        except Exception as e:
            logger.error(f"Error handling event subscription: {e}")
            await self.ws_server.sio.emit(
                'subscription_error',
                {"error": str(e)},
                room=sid,
                namespace='/command'
            )
    
    async def _handle_unsubscribe_events(self, sid: str, data: Dict[str, Any]):
        """Handle event unsubscription request"""
        if sid in self._event_subscriptions:
            del self._event_subscriptions[sid]
        if sid in self._subscriber_filters:
            del self._subscriber_filters[sid]
        
        await self.ws_server.sio.emit(
            'unsubscription_confirmed',
            {},
            room=sid,
            namespace='/command'
        )
    
    async def _handle_get_queue_status(self, sid: str, data: Dict[str, Any]):
        """Handle queue status request"""
        try:
            # Get current statistics
            stats = await self.command_queue.get_statistics()
            queue_sizes = await self.command_queue.get_queue_size()
            
            status_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "queue_sizes": {
                    priority.name: size
                    for priority, size in queue_sizes.items()
                },
                "statistics": {
                    "total_commands": stats.total_commands,
                    "current_queue_size": stats.current_queue_size,
                    "average_queue_time_ms": stats.average_queue_time_ms,
                    "average_execution_time_ms": stats.average_execution_time_ms,
                    "commands_processed_last_minute": stats.commands_processed_last_minute,
                    "commands_failed_last_minute": stats.commands_failed_last_minute,
                    "peak_queue_size": stats.peak_queue_size
                }
            }
            
            # Encode and send
            encoded_message = await self.protocol_manager.encode_message(
                sid,
                "queue_status",
                status_data
            )
            
            await self.ws_server.sio.emit(
                'queue_status',
                encoded_message,
                room=sid,
                namespace='/command'
            )
            
        except Exception as e:
            logger.error(f"Error getting queue status: {e}")
            await self.ws_server.sio.emit(
                'queue_status_error',
                {"error": str(e)},
                room=sid,
                namespace='/command'
            )
    
    async def _handle_get_command_details(self, sid: str, data: Dict[str, Any]):
        """Handle command details request"""
        try:
            command_id = data.get('command_id')
            if not command_id:
                raise ValueError("command_id is required")
            
            command = await self.command_queue.get_command(command_id)
            if not command:
                raise ValueError(f"Command {command_id} not found")
            
            # Send command details
            await self.ws_server.sio.emit(
                'command_details',
                command.to_dict(),
                room=sid,
                namespace='/command'
            )
            
        except Exception as e:
            logger.error(f"Error getting command details: {e}")
            await self.ws_server.sio.emit(
                'command_details_error',
                {"error": str(e)},
                room=sid,
                namespace='/command'
            )
    
    async def _status_update_loop(self):
        """Periodically broadcast queue status updates"""
        while True:
            try:
                await asyncio.sleep(self._status_update_interval)
                
                # Get current stats
                stats = await self.command_queue.get_statistics()
                
                # Check if stats have changed significantly
                if self._should_broadcast_stats(stats):
                    # Broadcast to all subscribers of queue status updates
                    subscribers = [
                        sid for sid, events in self._event_subscriptions.items()
                        if CommandEventType.QUEUE_STATUS_UPDATE in events
                    ]
                    
                    if subscribers:
                        queue_sizes = await self.command_queue.get_queue_size()
                        
                        update_data = {
                            "event_type": CommandEventType.QUEUE_STATUS_UPDATE.value,
                            "timestamp": datetime.utcnow().isoformat(),
                            "queue_sizes": {
                                priority.name: size
                                for priority, size in queue_sizes.items()
                            },
                            "current_size": stats.current_queue_size,
                            "processing_rate": stats.commands_processed_last_minute
                        }
                        
                        for sid in subscribers:
                            try:
                                encoded_message = await self.protocol_manager.encode_message(
                                    sid,
                                    "queue_update",
                                    update_data
                                )
                                
                                await self.ws_server.sio.emit(
                                    'queue_update',
                                    encoded_message,
                                    room=sid,
                                    namespace='/command'
                                )
                                
                            except Exception as e:
                                logger.error(f"Error broadcasting status update: {e}")
                    
                    self._last_queue_stats = stats
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in status update loop: {e}")
    
    def _should_broadcast_stats(self, stats: QueueStatistics) -> bool:
        """Determine if stats have changed enough to warrant a broadcast"""
        if not self._last_queue_stats:
            return True
        
        # Check for significant changes
        if abs(stats.current_queue_size - self._last_queue_stats.current_queue_size) >= 5:
            return True
        
        if abs(stats.commands_processed_last_minute - 
               self._last_queue_stats.commands_processed_last_minute) >= 10:
            return True
        
        return False
    
    def cleanup_client(self, sid: str):
        """Clean up client subscriptions on disconnect"""
        self._event_subscriptions.pop(sid, None)
        self._subscriber_filters.pop(sid, None)
        self._acknowledgment_subscribers.pop(sid, None)
        self.protocol_manager.cleanup_client(sid)
    
    async def _handle_get_acknowledgment_status(self, sid: str, data: Dict[str, Any]):
        """Handle acknowledgment status request"""
        try:
            command_id = data.get('command_id')
            if not command_id:
                raise ValueError("command_id is required")
            
            # Get acknowledgment from manager (will be injected)
            if hasattr(self, 'acknowledgment_manager'):
                acknowledgment = await self.acknowledgment_manager.get_acknowledgment(command_id)
                if acknowledgment:
                    await self.ws_server.sio.emit(
                        'acknowledgment_status',
                        acknowledgment.to_dict(),
                        room=sid,
                        namespace='/command'
                    )
                else:
                    await self.ws_server.sio.emit(
                        'acknowledgment_status_error',
                        {"error": f"No acknowledgment found for command {command_id}"},
                        room=sid,
                        namespace='/command'
                    )
            else:
                await self.ws_server.sio.emit(
                    'acknowledgment_status_error',
                    {"error": "Acknowledgment manager not available"},
                    room=sid,
                    namespace='/command'
                )
                
        except Exception as e:
            logger.error(f"Error getting acknowledgment status: {e}")
            await self.ws_server.sio.emit(
                'acknowledgment_status_error',
                {"error": str(e)},
                room=sid,
                namespace='/command'
            )
    
    async def _handle_subscribe_acknowledgment_updates(self, sid: str, data: Dict[str, Any]):
        """Handle acknowledgment update subscription"""
        try:
            command_ids = data.get('command_ids', [])
            
            # Store subscription
            if not hasattr(self, '_acknowledgment_subscribers'):
                self._acknowledgment_subscribers = {}
            
            self._acknowledgment_subscribers[sid] = set(command_ids)
            
            # Send confirmation
            await self.ws_server.sio.emit(
                'acknowledgment_subscription_confirmed',
                {
                    "subscribed_commands": command_ids,
                    "timestamp": datetime.utcnow().isoformat()
                },
                room=sid,
                namespace='/command'
            )
            
            logger.info(f"Client {sid} subscribed to acknowledgment updates for {len(command_ids)} commands")
            
        except Exception as e:
            logger.error(f"Error handling acknowledgment subscription: {e}")
            await self.ws_server.sio.emit(
                'acknowledgment_subscription_error',
                {"error": str(e)},
                room=sid,
                namespace='/command'
            )
    
    async def _handle_get_command_progress(self, sid: str, data: Dict[str, Any]):
        """Handle command progress request"""
        try:
            command_id = data.get('command_id')
            if not command_id:
                raise ValueError("command_id is required")
            
            # Get acknowledgment for progress info
            if hasattr(self, 'acknowledgment_manager'):
                acknowledgment = await self.acknowledgment_manager.get_acknowledgment(command_id)
                if acknowledgment:
                    progress_data = {
                        "command_id": command_id,
                        "tracking_id": acknowledgment.tracking_id,
                        "progress": acknowledgment.progress,
                        "message": acknowledgment.progress_message,
                        "status": acknowledgment.status.value,
                        "started_at": acknowledgment.started_at.isoformat() if acknowledgment.started_at else None,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    await self.ws_server.sio.emit(
                        'command_progress',
                        progress_data,
                        room=sid,
                        namespace='/command'
                    )
                else:
                    await self.ws_server.sio.emit(
                        'command_progress_error',
                        {"error": f"No progress data found for command {command_id}"},
                        room=sid,
                        namespace='/command'
                    )
            else:
                await self.ws_server.sio.emit(
                    'command_progress_error',
                    {"error": "Acknowledgment manager not available"},
                    room=sid,
                    namespace='/command'
                )
                
        except Exception as e:
            logger.error(f"Error getting command progress: {e}")
            await self.ws_server.sio.emit(
                'command_progress_error',
                {"error": str(e)},
                room=sid,
                namespace='/command'
            )
    
    def set_acknowledgment_manager(self, acknowledgment_manager):
        """Set the acknowledgment manager instance"""
        self.acknowledgment_manager = acknowledgment_manager