"""
Command Acknowledgment Manager for tracking command execution status

This module provides comprehensive acknowledgment and result handling for rover commands.
Features:
- Asynchronous acknowledgment flow with unique tracking IDs
- Real-time status updates via WebSocket
- Timeout and retry logic management
- Progress tracking for long-running commands
- Result delivery with success/error details
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List, Callable, Set
from dataclasses import dataclass, field
from enum import Enum
import uuid

from .command_base import Command, CommandStatus, CommandResult, CommandPriority
from .websocket_integration import CommandQueueWebSocketHandler, CommandEventType
from ..websocket.websocket_server import WebSocketServer

logger = logging.getLogger(__name__)


class AcknowledgmentStatus(Enum):
    """Acknowledgment status stages"""
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    RETRYING = "retrying"


@dataclass
class AcknowledgmentConfig:
    """Configuration for acknowledgment manager"""
    # Timeout settings (in seconds)
    acknowledgment_timeout: float = 5.0
    execution_timeout: float = 60.0
    result_delivery_timeout: float = 10.0
    
    # Retry settings
    max_acknowledgment_retries: int = 3
    retry_delay: float = 1.0
    exponential_backoff: bool = True
    max_backoff: float = 30.0
    
    # Progress update settings
    progress_update_interval: float = 2.0
    enable_progress_tracking: bool = True
    
    # Result caching
    cache_results: bool = True
    result_cache_ttl: int = 3600  # 1 hour
    max_cached_results: int = 1000


@dataclass
class CommandAcknowledgment:
    """Tracks acknowledgment and execution status for a command"""
    command_id: str
    tracking_id: str
    status: AcknowledgmentStatus
    command: Command
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    acknowledged_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Execution details
    progress: float = 0.0  # 0.0 to 1.0
    progress_message: Optional[str] = None
    result: Optional[CommandResult] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    
    # Retry tracking
    acknowledgment_retries: int = 0
    execution_retries: int = 0
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert acknowledgment to dictionary format"""
        return {
            "command_id": self.command_id,
            "tracking_id": self.tracking_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "error_message": self.error_message,
            "acknowledgment_retries": self.acknowledgment_retries,
            "execution_retries": self.execution_retries,
            "metadata": self.metadata
        }


class AcknowledgmentManager:
    """
    Manages command acknowledgments and result tracking with real-time updates
    """
    
    def __init__(
        self,
        ws_handler: CommandQueueWebSocketHandler,
        ws_server: WebSocketServer,
        config: Optional[AcknowledgmentConfig] = None
    ):
        self.ws_handler = ws_handler
        self.ws_server = ws_server
        self.config = config or AcknowledgmentConfig()
        
        # Tracking storage
        self._acknowledgments: Dict[str, CommandAcknowledgment] = {}
        self._tracking_by_command: Dict[str, str] = {}  # command_id -> tracking_id
        
        # Progress tracking
        self._progress_tasks: Dict[str, asyncio.Task] = {}
        
        # Result cache
        self._result_cache: Dict[str, tuple[CommandResult, datetime]] = {}
        
        # Callbacks
        self._status_callbacks: Dict[AcknowledgmentStatus, List[Callable]] = {
            status: [] for status in AcknowledgmentStatus
        }
        
        # Cleanup task
        self._cleanup_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        
        # Statistics
        self.stats = {
            "total_acknowledged": 0,
            "total_completed": 0,
            "total_failed": 0,
            "total_timeouts": 0,
            "average_acknowledgment_time_ms": 0.0,
            "average_execution_time_ms": 0.0
        }
    
    async def initialize(self):
        """Initialize the acknowledgment manager"""
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Acknowledgment manager initialized")
    
    async def shutdown(self):
        """Shutdown the acknowledgment manager"""
        self._shutdown_event.set()
        
        # Cancel all progress tasks
        for task in self._progress_tasks.values():
            task.cancel()
        
        # Wait for cleanup task
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Acknowledgment manager shutdown complete")
    
    async def create_acknowledgment(self, command: Command) -> CommandAcknowledgment:
        """Create a new acknowledgment for a command"""
        tracking_id = str(uuid.uuid4())
        
        acknowledgment = CommandAcknowledgment(
            command_id=command.id,
            tracking_id=tracking_id,
            status=AcknowledgmentStatus.PENDING,
            command=command
        )
        
        # Store acknowledgment
        self._acknowledgments[tracking_id] = acknowledgment
        self._tracking_by_command[command.id] = tracking_id
        
        # Emit creation event
        await self._emit_acknowledgment_event(acknowledgment, CommandEventType.COMMAND_QUEUED)
        
        # Schedule acknowledgment timeout
        asyncio.create_task(self._handle_acknowledgment_timeout(tracking_id))
        
        logger.info(f"Created acknowledgment {tracking_id} for command {command.id}")
        return acknowledgment
    
    async def acknowledge_command(self, command_id: str) -> Optional[CommandAcknowledgment]:
        """Acknowledge command receipt"""
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id:
            logger.warning(f"No tracking found for command {command_id}")
            return None
        
        acknowledgment = self._acknowledgments.get(tracking_id)
        if not acknowledgment:
            logger.warning(f"No acknowledgment found for tracking {tracking_id}")
            return None
        
        if acknowledgment.status != AcknowledgmentStatus.PENDING:
            logger.warning(f"Command {command_id} already acknowledged with status {acknowledgment.status}")
            return acknowledgment
        
        # Update acknowledgment
        acknowledgment.status = AcknowledgmentStatus.ACKNOWLEDGED
        acknowledgment.acknowledged_at = datetime.utcnow()
        
        # Calculate acknowledgment time
        ack_time_ms = (acknowledgment.acknowledged_at - acknowledgment.created_at).total_seconds() * 1000
        self._update_stats("acknowledgment", ack_time_ms)
        
        # Emit acknowledgment event
        await self._emit_acknowledgment_event(acknowledgment, CommandEventType.COMMAND_STARTED)
        
        # Trigger callbacks
        await self._trigger_callbacks(AcknowledgmentStatus.ACKNOWLEDGED, acknowledgment)
        
        logger.info(f"Acknowledged command {command_id} in {ack_time_ms:.2f}ms")
        return acknowledgment
    
    async def update_progress(
        self,
        command_id: str,
        progress: float,
        message: Optional[str] = None
    ) -> Optional[CommandAcknowledgment]:
        """Update command execution progress"""
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id:
            return None
        
        acknowledgment = self._acknowledgments.get(tracking_id)
        if not acknowledgment:
            return None
        
        # Update progress
        acknowledgment.progress = max(0.0, min(1.0, progress))
        acknowledgment.progress_message = message
        
        if acknowledgment.status == AcknowledgmentStatus.ACKNOWLEDGED:
            acknowledgment.status = AcknowledgmentStatus.IN_PROGRESS
            acknowledgment.started_at = datetime.utcnow()
        
        # Emit progress update
        await self._emit_progress_update(acknowledgment)
        
        logger.debug(f"Updated progress for command {command_id}: {progress:.2%} - {message}")
        return acknowledgment
    
    async def complete_command(
        self,
        command_id: str,
        result: CommandResult
    ) -> Optional[CommandAcknowledgment]:
        """Mark command as completed with result"""
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id:
            return None
        
        acknowledgment = self._acknowledgments.get(tracking_id)
        if not acknowledgment:
            return None
        
        # Update acknowledgment
        acknowledgment.status = AcknowledgmentStatus.COMPLETED if result.success else AcknowledgmentStatus.FAILED
        acknowledgment.completed_at = datetime.utcnow()
        acknowledgment.result = result
        acknowledgment.progress = 1.0 if result.success else acknowledgment.progress
        
        if not result.success:
            acknowledgment.error_message = result.error_message
            acknowledgment.error_details = result.error_details
            self.stats["total_failed"] += 1
        else:
            self.stats["total_completed"] += 1
        
        # Calculate execution time
        if acknowledgment.started_at:
            exec_time_ms = (acknowledgment.completed_at - acknowledgment.started_at).total_seconds() * 1000
            self._update_stats("execution", exec_time_ms)
            result.execution_time_ms = exec_time_ms
        
        # Cache result if enabled
        if self.config.cache_results:
            self._result_cache[command_id] = (result, datetime.utcnow())
            self._cleanup_cache()
        
        # Stop progress tracking
        if tracking_id in self._progress_tasks:
            self._progress_tasks[tracking_id].cancel()
            del self._progress_tasks[tracking_id]
        
        # Emit completion event
        event_type = CommandEventType.COMMAND_COMPLETED if result.success else CommandEventType.COMMAND_FAILED
        await self._emit_acknowledgment_event(acknowledgment, event_type)
        
        # Trigger callbacks
        await self._trigger_callbacks(acknowledgment.status, acknowledgment)
        
        logger.info(
            f"Command {command_id} completed with status {acknowledgment.status} "
            f"in {exec_time_ms:.2f}ms"
        )
        return acknowledgment
    
    async def handle_timeout(self, command_id: str) -> Optional[CommandAcknowledgment]:
        """Handle command timeout"""
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id:
            return None
        
        acknowledgment = self._acknowledgments.get(tracking_id)
        if not acknowledgment:
            return None
        
        if acknowledgment.status in [AcknowledgmentStatus.COMPLETED, AcknowledgmentStatus.FAILED]:
            return acknowledgment
        
        # Update status
        acknowledgment.status = AcknowledgmentStatus.TIMEOUT
        acknowledgment.completed_at = datetime.utcnow()
        acknowledgment.error_message = "Command execution timed out"
        
        self.stats["total_timeouts"] += 1
        
        # Stop progress tracking
        if tracking_id in self._progress_tasks:
            self._progress_tasks[tracking_id].cancel()
            del self._progress_tasks[tracking_id]
        
        # Emit timeout event
        await self._emit_acknowledgment_event(acknowledgment, CommandEventType.COMMAND_FAILED)
        
        # Trigger callbacks
        await self._trigger_callbacks(AcknowledgmentStatus.TIMEOUT, acknowledgment)
        
        logger.warning(f"Command {command_id} timed out")
        return acknowledgment
    
    async def handle_retry(self, command_id: str) -> Optional[CommandAcknowledgment]:
        """Handle command retry"""
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id:
            return None
        
        acknowledgment = self._acknowledgments.get(tracking_id)
        if not acknowledgment:
            return None
        
        # Update retry count
        acknowledgment.execution_retries += 1
        acknowledgment.status = AcknowledgmentStatus.RETRYING
        acknowledgment.progress = 0.0
        
        # Emit retry event
        await self._emit_acknowledgment_event(acknowledgment, CommandEventType.COMMAND_RETRYING)
        
        logger.info(f"Command {command_id} retrying (attempt {acknowledgment.execution_retries})")
        return acknowledgment
    
    async def get_acknowledgment(self, command_id: str) -> Optional[CommandAcknowledgment]:
        """Get acknowledgment for a command"""
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id:
            return None
        
        return self._acknowledgments.get(tracking_id)
    
    async def get_cached_result(self, command_id: str) -> Optional[CommandResult]:
        """Get cached result for a command"""
        if not self.config.cache_results:
            return None
        
        cache_entry = self._result_cache.get(command_id)
        if not cache_entry:
            return None
        
        result, timestamp = cache_entry
        
        # Check if result is still valid
        if (datetime.utcnow() - timestamp).total_seconds() > self.config.result_cache_ttl:
            del self._result_cache[command_id]
            return None
        
        return result
    
    def register_status_callback(
        self,
        status: AcknowledgmentStatus,
        callback: Callable[[CommandAcknowledgment], Any]
    ):
        """Register a callback for status changes"""
        self._status_callbacks[status].append(callback)
    
    async def start_progress_tracking(self, command_id: str):
        """Start automatic progress tracking for a command"""
        if not self.config.enable_progress_tracking:
            return
        
        tracking_id = self._tracking_by_command.get(command_id)
        if not tracking_id or tracking_id in self._progress_tasks:
            return
        
        task = asyncio.create_task(self._progress_tracking_loop(tracking_id))
        self._progress_tasks[tracking_id] = task
    
    async def _progress_tracking_loop(self, tracking_id: str):
        """Progress tracking loop for long-running commands"""
        try:
            while True:
                await asyncio.sleep(self.config.progress_update_interval)
                
                acknowledgment = self._acknowledgments.get(tracking_id)
                if not acknowledgment:
                    break
                
                if acknowledgment.status in [
                    AcknowledgmentStatus.COMPLETED,
                    AcknowledgmentStatus.FAILED,
                    AcknowledgmentStatus.TIMEOUT
                ]:
                    break
                
                # Emit current progress
                await self._emit_progress_update(acknowledgment)
                
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Progress tracking error for {tracking_id}: {e}")
    
    async def _handle_acknowledgment_timeout(self, tracking_id: str):
        """Handle acknowledgment timeout"""
        try:
            await asyncio.sleep(self.config.acknowledgment_timeout)
            
            acknowledgment = self._acknowledgments.get(tracking_id)
            if not acknowledgment or acknowledgment.status != AcknowledgmentStatus.PENDING:
                return
            
            # Check if we should retry
            if acknowledgment.acknowledgment_retries < self.config.max_acknowledgment_retries:
                acknowledgment.acknowledgment_retries += 1
                
                # Calculate retry delay
                if self.config.exponential_backoff:
                    delay = min(
                        self.config.retry_delay * (2 ** acknowledgment.acknowledgment_retries),
                        self.config.max_backoff
                    )
                else:
                    delay = self.config.retry_delay
                
                logger.warning(
                    f"Acknowledgment timeout for {acknowledgment.command_id}, "
                    f"retrying in {delay}s (attempt {acknowledgment.acknowledgment_retries})"
                )
                
                # Reschedule timeout
                await asyncio.sleep(delay)
                asyncio.create_task(self._handle_acknowledgment_timeout(tracking_id))
                
            else:
                # Max retries exceeded
                await self.handle_timeout(acknowledgment.command_id)
                
        except Exception as e:
            logger.error(f"Acknowledgment timeout handler error: {e}")
    
    async def _emit_acknowledgment_event(
        self,
        acknowledgment: CommandAcknowledgment,
        event_type: CommandEventType
    ):
        """Emit acknowledgment event via WebSocket"""
        try:
            event_data = {
                "acknowledgment": acknowledgment.to_dict(),
                "command_type": acknowledgment.command.command_type.value,
                "priority": acknowledgment.command.priority.name
            }
            
            await self.ws_handler.emit_command_event(
                event_type,
                acknowledgment.command,
                event_data
            )
            
            # Also emit to specific acknowledgment namespace
            await self.ws_server.sio.emit(
                "acknowledgment_update",
                {
                    "tracking_id": acknowledgment.tracking_id,
                    "command_id": acknowledgment.command_id,
                    "status": acknowledgment.status.value,
                    "progress": acknowledgment.progress,
                    "message": acknowledgment.progress_message,
                    "timestamp": datetime.utcnow().isoformat()
                },
                namespace="/command"
            )
            
        except Exception as e:
            logger.error(f"Error emitting acknowledgment event: {e}")
    
    async def _emit_progress_update(self, acknowledgment: CommandAcknowledgment):
        """Emit progress update via WebSocket"""
        try:
            await self.ws_server.sio.emit(
                "command_progress",
                {
                    "tracking_id": acknowledgment.tracking_id,
                    "command_id": acknowledgment.command_id,
                    "progress": acknowledgment.progress,
                    "message": acknowledgment.progress_message,
                    "status": acknowledgment.status.value,
                    "timestamp": datetime.utcnow().isoformat()
                },
                namespace="/command"
            )
            
        except Exception as e:
            logger.error(f"Error emitting progress update: {e}")
    
    async def _trigger_callbacks(
        self,
        status: AcknowledgmentStatus,
        acknowledgment: CommandAcknowledgment
    ):
        """Trigger registered callbacks for status change"""
        callbacks = self._status_callbacks.get(status, [])
        
        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(acknowledgment)
                else:
                    callback(acknowledgment)
            except Exception as e:
                logger.error(f"Callback error for status {status}: {e}")
    
    def _update_stats(self, stat_type: str, value: float):
        """Update rolling statistics"""
        if stat_type == "acknowledgment":
            current_avg = self.stats["average_acknowledgment_time_ms"]
            total = self.stats["total_acknowledged"]
            new_avg = (current_avg * total + value) / (total + 1)
            self.stats["average_acknowledgment_time_ms"] = new_avg
            self.stats["total_acknowledged"] += 1
            
        elif stat_type == "execution":
            current_avg = self.stats["average_execution_time_ms"]
            total = self.stats["total_completed"] + self.stats["total_failed"]
            new_avg = (current_avg * (total - 1) + value) / total if total > 0 else value
            self.stats["average_execution_time_ms"] = new_avg
    
    def _cleanup_cache(self):
        """Clean up expired cache entries"""
        if len(self._result_cache) <= self.config.max_cached_results:
            return
        
        # Remove oldest entries
        sorted_entries = sorted(
            self._result_cache.items(),
            key=lambda x: x[1][1]
        )
        
        to_remove = len(self._result_cache) - self.config.max_cached_results
        for command_id, _ in sorted_entries[:to_remove]:
            del self._result_cache[command_id]
    
    async def _cleanup_loop(self):
        """Periodic cleanup of old acknowledgments and cache"""
        while not self._shutdown_event.is_set():
            try:
                await asyncio.sleep(300)  # Run every 5 minutes
                
                now = datetime.utcnow()
                expired_tracking_ids = []
                
                # Find expired acknowledgments
                for tracking_id, ack in self._acknowledgments.items():
                    if ack.status in [
                        AcknowledgmentStatus.COMPLETED,
                        AcknowledgmentStatus.FAILED,
                        AcknowledgmentStatus.TIMEOUT
                    ]:
                        if (now - ack.completed_at).total_seconds() > self.config.result_cache_ttl:
                            expired_tracking_ids.append(tracking_id)
                
                # Remove expired acknowledgments
                for tracking_id in expired_tracking_ids:
                    ack = self._acknowledgments[tracking_id]
                    del self._acknowledgments[tracking_id]
                    del self._tracking_by_command[ack.command_id]
                
                # Clean up cache
                expired_cache_ids = []
                for command_id, (_, timestamp) in self._result_cache.items():
                    if (now - timestamp).total_seconds() > self.config.result_cache_ttl:
                        expired_cache_ids.append(command_id)
                
                for command_id in expired_cache_ids:
                    del self._result_cache[command_id]
                
                if expired_tracking_ids or expired_cache_ids:
                    logger.info(
                        f"Cleaned up {len(expired_tracking_ids)} acknowledgments "
                        f"and {len(expired_cache_ids)} cached results"
                    )
                
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get acknowledgment manager statistics"""
        stats = self.stats.copy()
        stats["active_acknowledgments"] = len(self._acknowledgments)
        stats["cached_results"] = len(self._result_cache)
        stats["active_progress_tracking"] = len(self._progress_tasks)
        return stats