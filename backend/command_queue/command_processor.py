"""
Command processor for executing commands from the queue
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional, Any, Callable, Set
from enum import Enum

from .command_base import Command, CommandResult, CommandStatus, CommandPriority
from .command_queue import PriorityCommandQueue
from .acknowledgment_manager import AcknowledgmentManager


logger = logging.getLogger(__name__)


class ProcessorStatus(Enum):
    """Processor status states"""
    IDLE = "idle"
    PROCESSING = "processing"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class ProcessorConfig:
    """Configuration for command processor"""
    max_concurrent_commands: int = 5
    max_concurrent_per_priority: Dict[CommandPriority, int] = None
    processing_timeout_ms: int = 60000  # 1 minute default timeout
    retry_delay_ms: int = 1000
    exponential_backoff: bool = True
    max_backoff_ms: int = 30000
    health_check_interval_seconds: int = 30
    
    def __post_init__(self):
        if self.max_concurrent_per_priority is None:
            self.max_concurrent_per_priority = {
                CommandPriority.EMERGENCY: 3,
                CommandPriority.HIGH: 2,
                CommandPriority.NORMAL: 1,
                CommandPriority.LOW: 1
            }


class CommandHandler(ABC):
    """Abstract base class for command handlers"""
    
    @abstractmethod
    async def can_handle(self, command: Command) -> bool:
        """Check if this handler can process the given command"""
        pass
    
    @abstractmethod
    async def handle(self, command: Command) -> CommandResult:
        """Handle the command and return result"""
        pass
    
    async def on_before_execute(self, command: Command):
        """Called before command execution (optional override)"""
        pass
    
    async def on_after_execute(self, command: Command, result: CommandResult):
        """Called after command execution (optional override)"""
        pass
    
    async def on_error(self, command: Command, error: Exception):
        """Called on execution error (optional override)"""
        pass


class CommandProcessor:
    """
    Processes commands from the queue with concurrent execution support
    """
    
    def __init__(
        self,
        queue: PriorityCommandQueue,
        config: Optional[ProcessorConfig] = None,
        acknowledgment_manager: Optional[AcknowledgmentManager] = None
    ):
        self.queue = queue
        self.config = config or ProcessorConfig()
        self.acknowledgment_manager = acknowledgment_manager
        
        # Handler registry
        self._handlers: Dict[str, CommandHandler] = {}
        self._default_handler: Optional[CommandHandler] = None
        
        # Processing state
        self._status = ProcessorStatus.IDLE
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._active_commands: Dict[str, Command] = {}
        self._processing_counts: Dict[CommandPriority, int] = {
            priority: 0 for priority in CommandPriority
        }
        
        # Control
        self._stop_event = asyncio.Event()
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Start unpaused
        
        # Health monitoring
        self._health_task: Optional[asyncio.Task] = None
        self._total_processed = 0
        self._total_failed = 0
        self._last_health_check = datetime.utcnow()
    
    def register_handler(self, command_type: str, handler: CommandHandler):
        """Register a handler for a specific command type"""
        self._handlers[command_type] = handler
        logger.info(f"Registered handler for command type: {command_type}")
    
    def set_default_handler(self, handler: CommandHandler):
        """Set the default handler for unregistered command types"""
        self._default_handler = handler
    
    async def start(self):
        """Start the command processor"""
        if self._status != ProcessorStatus.IDLE:
            logger.warning(f"Cannot start processor in {self._status} state")
            return
        
        self._status = ProcessorStatus.PROCESSING
        self._stop_event.clear()
        
        # Start health monitoring
        if not self._health_task:
            self._health_task = asyncio.create_task(self._health_monitor())
        
        # Start processing loop
        asyncio.create_task(self._processing_loop())
        
        logger.info("Command processor started")
    
    async def stop(self):
        """Stop the command processor gracefully"""
        logger.info("Stopping command processor...")
        self._status = ProcessorStatus.STOPPED
        self._stop_event.set()
        
        # Cancel health task
        if self._health_task:
            self._health_task.cancel()
            try:
                await self._health_task
            except asyncio.CancelledError:
                pass
        
        # Wait for active tasks to complete
        if self._active_tasks:
            logger.info(f"Waiting for {len(self._active_tasks)} active tasks to complete...")
            await asyncio.gather(*self._active_tasks.values(), return_exceptions=True)
        
        logger.info("Command processor stopped")
    
    async def pause(self):
        """Pause command processing"""
        self._pause_event.clear()
        self._status = ProcessorStatus.PAUSED
        logger.info("Command processor paused")
    
    async def resume(self):
        """Resume command processing"""
        self._pause_event.set()
        self._status = ProcessorStatus.PROCESSING
        logger.info("Command processor resumed")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current processor status"""
        return {
            "status": self._status.value,
            "active_commands": len(self._active_commands),
            "active_by_priority": {
                priority.name: count
                for priority, count in self._processing_counts.items()
            },
            "total_processed": self._total_processed,
            "total_failed": self._total_failed,
            "uptime_seconds": (datetime.utcnow() - self._last_health_check).total_seconds()
        }
    
    async def _processing_loop(self):
        """Main processing loop"""
        while not self._stop_event.is_set():
            try:
                # Wait if paused
                await self._pause_event.wait()
                
                # Check if we can process more commands
                if len(self._active_tasks) >= self.config.max_concurrent_commands:
                    await asyncio.sleep(0.1)
                    continue
                
                # Find a priority level we can process
                available_priorities = self._get_available_priorities()
                if not available_priorities:
                    await asyncio.sleep(0.1)
                    continue
                
                # Dequeue next command
                command = await self.queue.dequeue(priority_filter=available_priorities)
                if not command:
                    await asyncio.sleep(0.1)
                    continue
                
                # Create acknowledgment if manager is available
                if self.acknowledgment_manager:
                    await self.acknowledgment_manager.create_acknowledgment(command)
                
                # Start processing
                task = asyncio.create_task(self._process_command(command))
                self._active_tasks[command.id] = task
                self._active_commands[command.id] = command
                self._processing_counts[command.priority] += 1
                
                # Clean up completed tasks
                completed_ids = [
                    cmd_id for cmd_id, task in self._active_tasks.items()
                    if task.done()
                ]
                for cmd_id in completed_ids:
                    del self._active_tasks[cmd_id]
                    if cmd_id in self._active_commands:
                        priority = self._active_commands[cmd_id].priority
                        self._processing_counts[priority] -= 1
                        del self._active_commands[cmd_id]
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in processing loop: {e}")
                self._status = ProcessorStatus.ERROR
                await asyncio.sleep(1)
    
    def _get_available_priorities(self) -> Set[CommandPriority]:
        """Get priorities that haven't reached their concurrent limit"""
        available = set()
        
        for priority in CommandPriority:
            current_count = self._processing_counts[priority]
            max_count = self.config.max_concurrent_per_priority.get(priority, 1)
            
            if current_count < max_count:
                available.add(priority)
        
        return available
    
    async def _process_command(self, command: Command):
        """Process a single command"""
        start_time = datetime.utcnow()
        
        try:
            # Acknowledge command receipt
            if self.acknowledgment_manager:
                await self.acknowledgment_manager.acknowledge_command(command.id)
                await self.acknowledgment_manager.start_progress_tracking(command.id)
            
            # Find appropriate handler
            handler = self._get_handler(command)
            if not handler:
                raise ValueError(f"No handler found for command type: {command.command_type.value}")
            
            # Check if command can be executed
            if not await command.can_execute():
                raise RuntimeError("Command preconditions not met")
            
            # Pre-execution hook
            await handler.on_before_execute(command)
            
            # Progress callback for long-running commands
            async def progress_callback(progress: float, message: Optional[str] = None):
                if self.acknowledgment_manager:
                    await self.acknowledgment_manager.update_progress(command.id, progress, message)
            
            # Inject progress callback if handler supports it
            if hasattr(handler, 'set_progress_callback'):
                handler.set_progress_callback(progress_callback)
            
            # Execute with timeout
            result = await asyncio.wait_for(
                handler.handle(command),
                timeout=command.timeout_ms / 1000.0
            )
            
            # Post-execution hook
            await handler.on_after_execute(command, result)
            
            # Update command and queue
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            result.execution_time_ms = execution_time
            
            await self.queue.complete_command(command.id, result)
            self._total_processed += 1
            
            # Complete acknowledgment
            if self.acknowledgment_manager:
                await self.acknowledgment_manager.complete_command(command.id, result)
            
            logger.info(
                f"Command {command.id} completed successfully in {execution_time:.2f}ms"
            )
            
        except asyncio.TimeoutError:
            logger.error(f"Command {command.id} timed out after {command.timeout_ms}ms")
            
            # Handle timeout in acknowledgment manager
            if self.acknowledgment_manager:
                await self.acknowledgment_manager.handle_timeout(command.id)
            
            await self._handle_command_failure(
                command,
                "Command execution timed out",
                {"timeout_ms": command.timeout_ms}
            )
            
        except Exception as e:
            logger.error(f"Command {command.id} failed: {e}")
            
            # Error hook
            if handler:
                await handler.on_error(command, e)
            
            # Update acknowledgment with failure
            if self.acknowledgment_manager:
                result = CommandResult(
                    success=False,
                    command_id=command.id,
                    status=CommandStatus.FAILED,
                    error_message=str(e),
                    error_details={"exception_type": type(e).__name__}
                )
                await self.acknowledgment_manager.complete_command(command.id, result)
            
            await self._handle_command_failure(
                command,
                str(e),
                {"exception_type": type(e).__name__}
            )
    
    def _get_handler(self, command: Command) -> Optional[CommandHandler]:
        """Get the appropriate handler for a command"""
        # Try specific handler first
        handler = self._handlers.get(command.command_type.value)
        
        # Fall back to default handler
        if not handler:
            handler = self._default_handler
        
        return handler
    
    async def _handle_command_failure(
        self,
        command: Command,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None
    ):
        """Handle command failure with retry logic"""
        self._total_failed += 1
        
        # Check if we should retry
        if command.retry_count < command.max_retries:
            # Calculate retry delay with exponential backoff
            if self.config.exponential_backoff:
                delay_ms = min(
                    self.config.retry_delay_ms * (2 ** command.retry_count),
                    self.config.max_backoff_ms
                )
            else:
                delay_ms = self.config.retry_delay_ms
            
            logger.info(
                f"Retrying command {command.id} after {delay_ms}ms "
                f"(attempt {command.retry_count + 1}/{command.max_retries})"
            )
            
            # Schedule retry
            await asyncio.sleep(delay_ms / 1000.0)
            
            # Notify acknowledgment manager of retry
            if self.acknowledgment_manager:
                await self.acknowledgment_manager.handle_retry(command.id)
            
            # Requeue with potentially lower priority
            new_priority = command.priority
            if command.priority != CommandPriority.EMERGENCY:
                # Optionally lower priority on retry
                # new_priority = CommandPriority(max(0, command.priority.value - 1))
                pass
            
            await self.queue.requeue(command, new_priority)
            
        else:
            # Max retries exceeded, mark as failed
            result = CommandResult(
                success=False,
                command_id=command.id,
                status=CommandStatus.FAILED,
                error_message=error_message,
                error_details=error_details
            )
            
            await self.queue.complete_command(command.id, result)
            
            logger.error(
                f"Command {command.id} failed after {command.retry_count} retries: {error_message}"
            )
    
    async def _health_monitor(self):
        """Monitor processor health and log statistics"""
        while not self._stop_event.is_set():
            try:
                await asyncio.sleep(self.config.health_check_interval_seconds)
                
                status = self.get_status()
                queue_stats = await self.queue.get_statistics()
                
                logger.info(
                    f"Processor health - Status: {status['status']}, "
                    f"Active: {status['active_commands']}, "
                    f"Processed: {status['total_processed']}, "
                    f"Failed: {status['total_failed']}, "
                    f"Queue size: {queue_stats.current_queue_size}"
                )
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health monitor: {e}")