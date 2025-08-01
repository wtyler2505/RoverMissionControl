"""
Priority-based command queue implementation with support for distributed queuing
"""

import asyncio
import heapq
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from collections import defaultdict
import time

from .command_base import Command, CommandPriority, CommandStatus


logger = logging.getLogger(__name__)


@dataclass
class CommandQueueConfig:
    """Configuration for the command queue"""
    max_queue_size: int = 10000
    max_commands_per_priority: int = 2500
    enable_persistence: bool = True
    enable_distributed: bool = False
    distributed_backend: str = "redis"  # redis, rabbitmq, etc.
    cleanup_interval_seconds: int = 300  # 5 minutes
    stale_command_timeout_seconds: int = 3600  # 1 hour
    enable_metrics: bool = True
    max_retries_global: int = 100  # Global retry limit per time window
    retry_window_seconds: int = 300  # Time window for retry counting


@dataclass
class QueueStatistics:
    """Statistics about the command queue"""
    total_commands: int = 0
    commands_by_priority: Dict[CommandPriority, int] = None
    commands_by_status: Dict[CommandStatus, int] = None
    average_queue_time_ms: float = 0.0
    average_execution_time_ms: float = 0.0
    peak_queue_size: int = 0
    commands_processed_last_minute: int = 0
    commands_failed_last_minute: int = 0
    current_queue_size: int = 0
    
    def __post_init__(self):
        if self.commands_by_priority is None:
            self.commands_by_priority = defaultdict(int)
        if self.commands_by_status is None:
            self.commands_by_status = defaultdict(int)


class PriorityCommandQueue:
    """
    Thread-safe priority command queue with support for multiple priority levels
    Uses a heap-based priority queue for efficient operations
    """
    
    def __init__(self, config: Optional[CommandQueueConfig] = None):
        self.config = config or CommandQueueConfig()
        
        # Priority queues for each priority level
        self._queues: Dict[CommandPriority, List[Tuple[float, str, Command]]] = {
            priority: [] for priority in CommandPriority
        }
        
        # Command storage
        self._commands: Dict[str, Command] = {}
        self._command_locks: Dict[str, asyncio.Lock] = {}
        
        # Queue state
        self._queue_lock = asyncio.Lock()
        self._shutdown = False
        self._total_enqueued = 0
        self._total_dequeued = 0
        
        # Statistics
        self._stats = QueueStatistics()
        self._queue_times: List[float] = []
        self._execution_times: List[float] = []
        self._commands_last_minute: List[Tuple[datetime, bool]] = []
        
        # Retry tracking
        self._retry_counts: Dict[str, int] = defaultdict(int)
        self._retry_timestamps: List[datetime] = []
        
        # Background tasks
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # Distributed queue support (if enabled)
        self._distributed_backend = None
        if self.config.enable_distributed:
            self._initialize_distributed_backend()
    
    async def initialize(self):
        """Initialize the queue and start background tasks"""
        if not self._cleanup_task:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Command queue initialized")
    
    async def shutdown(self):
        """Shutdown the queue gracefully"""
        self._shutdown = True
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Persist remaining commands if persistence is enabled
        if self.config.enable_persistence:
            await self._persist_pending_commands()
        
        logger.info("Command queue shut down")
    
    async def enqueue(self, command: Command) -> bool:
        """
        Add a command to the queue
        Returns True if successfully added, False if queue is full or shutdown
        """
        if self._shutdown:
            logger.warning("Cannot enqueue command - queue is shutdown")
            return False
        
        async with self._queue_lock:
            # Check queue size limits
            current_size = sum(len(q) for q in self._queues.values())
            if current_size >= self.config.max_queue_size:
                logger.error("Queue is full - rejecting command")
                return False
            
            # Check per-priority limits
            priority_queue_size = len(self._queues[command.priority])
            if priority_queue_size >= self.config.max_commands_per_priority:
                logger.error(f"Priority queue {command.priority.name} is full")
                return False
            
            # Check global retry limit
            if command.retry_count > 0:
                if not await self._check_retry_limit():
                    logger.error("Global retry limit exceeded")
                    return False
                self._retry_counts[command.id] = command.retry_count
                self._retry_timestamps.append(datetime.utcnow())
            
            # Add to queue
            command.queued_at = datetime.utcnow()
            command.status = CommandStatus.QUEUED
            
            # Use negative priority for max heap behavior (higher priority = earlier execution)
            # Add timestamp to ensure FIFO within same priority
            heap_priority = (-command.priority.value, time.time())
            
            heapq.heappush(
                self._queues[command.priority],
                (heap_priority[0], heap_priority[1], command.id, command)
            )
            
            self._commands[command.id] = command
            self._command_locks[command.id] = asyncio.Lock()
            
            # Update statistics
            self._total_enqueued += 1
            self._stats.total_commands += 1
            self._stats.commands_by_priority[command.priority] += 1
            self._stats.commands_by_status[CommandStatus.QUEUED] += 1
            
            current_size += 1
            if current_size > self._stats.peak_queue_size:
                self._stats.peak_queue_size = current_size
            
            logger.debug(f"Enqueued command {command.id} with priority {command.priority.name}")
            return True
    
    async def dequeue(self, priority_filter: Optional[Set[CommandPriority]] = None) -> Optional[Command]:
        """
        Remove and return the highest priority command from the queue
        Optionally filter by specific priority levels
        """
        if self._shutdown:
            return None
        
        async with self._queue_lock:
            # Try priorities in order (highest to lowest)
            for priority in sorted(CommandPriority, reverse=True):
                if priority_filter and priority not in priority_filter:
                    continue
                
                queue = self._queues[priority]
                while queue:
                    # Peek at the command
                    _, timestamp, command_id, command = queue[0]
                    
                    # Check if command still exists (might have been cancelled)
                    if command_id not in self._commands:
                        heapq.heappop(queue)
                        continue
                    
                    # Check if command has timed out while in queue
                    if command.timeout_ms:
                        queue_time_ms = (datetime.utcnow() - command.queued_at).total_seconds() * 1000
                        if queue_time_ms > command.timeout_ms:
                            heapq.heappop(queue)
                            command.status = CommandStatus.TIMEOUT
                            command.completed_at = datetime.utcnow()
                            self._stats.commands_by_status[CommandStatus.TIMEOUT] += 1
                            logger.warning(f"Command {command_id} timed out in queue")
                            continue
                    
                    # Valid command found
                    heapq.heappop(queue)
                    command.status = CommandStatus.EXECUTING
                    command.started_at = datetime.utcnow()
                    
                    # Update statistics
                    self._total_dequeued += 1
                    self._stats.commands_by_status[CommandStatus.QUEUED] -= 1
                    self._stats.commands_by_status[CommandStatus.EXECUTING] += 1
                    
                    # Track queue time
                    queue_time = (command.started_at - command.queued_at).total_seconds() * 1000
                    self._queue_times.append(queue_time)
                    if len(self._queue_times) > 1000:
                        self._queue_times.pop(0)
                    
                    logger.debug(f"Dequeued command {command_id} after {queue_time:.2f}ms in queue")
                    return command
            
            return None
    
    async def requeue(self, command: Command, new_priority: Optional[CommandPriority] = None) -> bool:
        """
        Requeue a command (e.g., after failure with retry)
        Optionally change its priority
        """
        # Remove from current tracking
        async with self._queue_lock:
            if command.id in self._commands:
                del self._commands[command.id]
                if command.id in self._command_locks:
                    del self._command_locks[command.id]
        
        # Update priority if specified
        if new_priority:
            command.priority = new_priority
        
        # Reset status and increment retry count
        command.status = CommandStatus.RETRYING
        command.retry_count += 1
        
        # Re-enqueue
        return await self.enqueue(command)
    
    async def cancel(self, command_id: str) -> bool:
        """Cancel a queued command"""
        async with self._queue_lock:
            if command_id in self._commands:
                command = self._commands[command_id]
                
                # Only cancel if not already executing
                if command.status in [CommandStatus.PENDING, CommandStatus.QUEUED, CommandStatus.RETRYING]:
                    command.status = CommandStatus.CANCELLED
                    command.completed_at = datetime.utcnow()
                    
                    # Remove from queue
                    del self._commands[command_id]
                    if command_id in self._command_locks:
                        del self._command_locks[command_id]
                    
                    self._stats.commands_by_status[command.status] -= 1
                    self._stats.commands_by_status[CommandStatus.CANCELLED] += 1
                    
                    logger.info(f"Cancelled command {command_id}")
                    return True
                else:
                    logger.warning(f"Cannot cancel command {command_id} - status is {command.status}")
                    return False
        
        return False
    
    async def get_command(self, command_id: str) -> Optional[Command]:
        """Get a command by ID"""
        return self._commands.get(command_id)
    
    async def get_queue_size(self) -> Dict[CommandPriority, int]:
        """Get current queue sizes by priority"""
        async with self._queue_lock:
            return {
                priority: len(queue)
                for priority, queue in self._queues.items()
            }
    
    async def get_statistics(self) -> QueueStatistics:
        """Get current queue statistics"""
        async with self._queue_lock:
            self._stats.current_queue_size = sum(len(q) for q in self._queues.values())
            
            # Calculate averages
            if self._queue_times:
                self._stats.average_queue_time_ms = sum(self._queue_times) / len(self._queue_times)
            
            if self._execution_times:
                self._stats.average_execution_time_ms = sum(self._execution_times) / len(self._execution_times)
            
            # Calculate last minute stats
            now = datetime.utcnow()
            one_minute_ago = now - timedelta(minutes=1)
            
            recent_commands = [
                (ts, success) for ts, success in self._commands_last_minute
                if ts > one_minute_ago
            ]
            
            self._stats.commands_processed_last_minute = len(recent_commands)
            self._stats.commands_failed_last_minute = sum(
                1 for _, success in recent_commands if not success
            )
            
            # Clean up old entries
            self._commands_last_minute = recent_commands
            
            return self._stats
    
    async def complete_command(self, command_id: str, result: 'CommandResult'):
        """Mark a command as completed and update statistics"""
        async with self._queue_lock:
            if command_id in self._commands:
                command = self._commands[command_id]
                command.result = result
                command.status = result.status
                command.completed_at = datetime.utcnow()
                
                # Update statistics
                if command.started_at:
                    execution_time = (command.completed_at - command.started_at).total_seconds() * 1000
                    self._execution_times.append(execution_time)
                    if len(self._execution_times) > 1000:
                        self._execution_times.pop(0)
                
                self._stats.commands_by_status[CommandStatus.EXECUTING] -= 1
                self._stats.commands_by_status[result.status] += 1
                
                # Track for last minute stats
                self._commands_last_minute.append((datetime.utcnow(), result.success))
                
                # Clean up if not needed for persistence
                if not self.config.enable_persistence or result.status in [CommandStatus.COMPLETED, CommandStatus.CANCELLED]:
                    del self._commands[command_id]
                    if command_id in self._command_locks:
                        del self._command_locks[command_id]
    
    async def _check_retry_limit(self) -> bool:
        """Check if global retry limit has been exceeded"""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.config.retry_window_seconds)
        
        # Clean up old retry timestamps
        self._retry_timestamps = [
            ts for ts in self._retry_timestamps
            if ts > window_start
        ]
        
        return len(self._retry_timestamps) < self.config.max_retries_global
    
    async def _cleanup_loop(self):
        """Background task to clean up stale commands and maintain queue health"""
        while not self._shutdown:
            try:
                await asyncio.sleep(self.config.cleanup_interval_seconds)
                await self._cleanup_stale_commands()
                
                # Log queue health
                stats = await self.get_statistics()
                logger.info(
                    f"Queue health - Size: {stats.current_queue_size}, "
                    f"Processed/min: {stats.commands_processed_last_minute}, "
                    f"Failed/min: {stats.commands_failed_last_minute}"
                )
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
    
    async def _cleanup_stale_commands(self):
        """Remove stale commands that have been in queue too long"""
        async with self._queue_lock:
            now = datetime.utcnow()
            stale_threshold = now - timedelta(seconds=self.config.stale_command_timeout_seconds)
            
            stale_command_ids = []
            for command_id, command in self._commands.items():
                if (command.status == CommandStatus.QUEUED and 
                    command.queued_at < stale_threshold):
                    stale_command_ids.append(command_id)
            
            for command_id in stale_command_ids:
                logger.warning(f"Removing stale command {command_id}")
                await self.cancel(command_id)
    
    async def _persist_pending_commands(self):
        """Persist pending commands to storage (implementation depends on backend)"""
        # This would be implemented based on the persistence backend
        # For now, just log
        pending_commands = [
            cmd for cmd in self._commands.values()
            if cmd.status in [CommandStatus.PENDING, CommandStatus.QUEUED, CommandStatus.RETRYING]
        ]
        
        if pending_commands:
            logger.info(f"Would persist {len(pending_commands)} pending commands")
    
    def _initialize_distributed_backend(self):
        """Initialize distributed queue backend"""
        # This would initialize Redis, RabbitMQ, or other distributed queue
        # For now, just log
        logger.info(f"Would initialize distributed backend: {self.config.distributed_backend}")