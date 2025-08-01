"""
Command Cancellation Manager - Safety-Critical Component

This module implements fail-safe command cancellation with:
- State machine for cancellation lifecycle
- Resource cleanup coordination
- Compensating action execution
- Safety validation to prevent critical command cancellation
- Comprehensive audit logging
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Set, Callable, Any, Tuple
from collections import defaultdict
import traceback

from .command_base import Command, CommandStatus, CommandType, CommandPriority
from .command_queue import PriorityCommandQueue
from .websocket_integration import CommandQueueWebSocketHandler, CommandEventType
from ..api_security.audit_service import get_audit_service


logger = logging.getLogger(__name__)


class CancellationState(Enum):
    """States for command cancellation lifecycle"""
    REQUESTED = "requested"
    VALIDATING = "validating"
    CANCELLING = "cancelling"
    CLEANING_UP = "cleaning_up"
    ROLLING_BACK = "rolling_back"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class CancellationReason(Enum):
    """Reasons for command cancellation"""
    USER_REQUEST = "user_request"
    TIMEOUT = "timeout"
    EMERGENCY_STOP = "emergency_stop"
    SYSTEM_SHUTDOWN = "system_shutdown"
    DEPENDENCY_FAILED = "dependency_failed"
    RESOURCE_UNAVAILABLE = "resource_unavailable"
    SAFETY_VIOLATION = "safety_violation"


@dataclass
class CancellationRequest:
    """Request to cancel a command"""
    command_id: str
    reason: CancellationReason
    requester_id: str
    force: bool = False  # Override safety checks (requires special permission)
    rollback_requested: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    # Tracking fields
    state: CancellationState = CancellationState.REQUESTED
    validation_errors: List[str] = field(default_factory=list)
    cleanup_actions: List[str] = field(default_factory=list)
    rollback_actions: List[str] = field(default_factory=list)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


@dataclass
class ResourceCleanupHandler:
    """Handler for cleaning up resources during cancellation"""
    resource_type: str
    handler: Callable[[Command], asyncio.Task]
    priority: int = 0  # Higher priority handlers execute first
    timeout_seconds: int = 30
    critical: bool = False  # If True, failure blocks cancellation


@dataclass
class CompensatingAction:
    """Action to compensate for partially executed command"""
    action_type: str
    execute: Callable[[Command, Dict[str, Any]], asyncio.Task]
    validate: Optional[Callable[[Command], bool]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class CancellationManager:
    """
    Manages safe command cancellation with resource cleanup and rollback.
    
    Safety Features:
    - Non-cancellable command protection
    - Resource cleanup coordination
    - Compensating action execution
    - State machine enforcement
    - Comprehensive audit logging
    - Timeout protection
    """
    
    def __init__(
        self,
        command_queue: PriorityCommandQueue,
        ws_handler: CommandQueueWebSocketHandler,
        cancellation_timeout_seconds: int = 60
    ):
        self.command_queue = command_queue
        self.ws_handler = ws_handler
        self.cancellation_timeout_seconds = cancellation_timeout_seconds
        
        # Tracking
        self._active_cancellations: Dict[str, CancellationRequest] = {}
        self._cancellation_history: List[CancellationRequest] = []
        self._cancellation_lock = asyncio.Lock()
        
        # Safety configuration
        self._non_cancellable_types: Set[CommandType] = {
            CommandType.EMERGENCY_STOP,
            CommandType.FIRMWARE_UPDATE,
            CommandType.RESET
        }
        
        self._non_cancellable_states: Set[CommandStatus] = {
            CommandStatus.COMPLETED,
            CommandStatus.FAILED,
            CommandStatus.CANCELLED
        }
        
        # Resource cleanup handlers
        self._cleanup_handlers: List[ResourceCleanupHandler] = []
        self._compensating_actions: Dict[CommandType, List[CompensatingAction]] = defaultdict(list)
        
        # Statistics
        self._stats = {
            "total_requests": 0,
            "successful_cancellations": 0,
            "failed_cancellations": 0,
            "rejected_cancellations": 0,
            "average_cancellation_time_ms": 0.0,
            "resource_cleanup_failures": 0,
            "rollback_failures": 0
        }
        
        # Initialize default handlers
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Register default resource cleanup handlers"""
        # Hardware resource cleanup
        self.register_cleanup_handler(ResourceCleanupHandler(
            resource_type="hardware_lock",
            handler=self._cleanup_hardware_locks,
            priority=100,
            critical=True
        ))
        
        # Communication cleanup
        self.register_cleanup_handler(ResourceCleanupHandler(
            resource_type="network_connection",
            handler=self._cleanup_network_connections,
            priority=90
        ))
        
        # Memory cleanup
        self.register_cleanup_handler(ResourceCleanupHandler(
            resource_type="memory_buffer",
            handler=self._cleanup_memory_buffers,
            priority=80
        ))
    
    async def request_cancellation(
        self,
        request: CancellationRequest
    ) -> Tuple[bool, Optional[str]]:
        """
        Request command cancellation with safety validation.
        
        Returns:
            Tuple of (success, error_message)
        """
        async with self._cancellation_lock:
            # Check if already being cancelled
            if request.command_id in self._active_cancellations:
                return False, "Cancellation already in progress"
            
            # Track request
            self._active_cancellations[request.command_id] = request
            self._stats["total_requests"] += 1
        
        try:
            # Execute cancellation with timeout protection
            result = await asyncio.wait_for(
                self._execute_cancellation(request),
                timeout=self.cancellation_timeout_seconds
            )
            return result
            
        except asyncio.TimeoutError:
            request.state = CancellationState.FAILED
            request.error_message = "Cancellation timeout exceeded"
            self._stats["failed_cancellations"] += 1
            
            await self._emit_cancellation_event(request, "cancellation_timeout")
            return False, "Cancellation timeout"
            
        except Exception as e:
            logger.error(f"Cancellation error: {e}")
            request.state = CancellationState.FAILED
            request.error_message = str(e)
            self._stats["failed_cancellations"] += 1
            
            await self._emit_cancellation_event(request, "cancellation_error")
            return False, str(e)
            
        finally:
            # Cleanup and record
            async with self._cancellation_lock:
                if request.command_id in self._active_cancellations:
                    del self._active_cancellations[request.command_id]
                self._cancellation_history.append(request)
                
                # Maintain history size
                if len(self._cancellation_history) > 1000:
                    self._cancellation_history.pop(0)
    
    async def _execute_cancellation(
        self,
        request: CancellationRequest
    ) -> Tuple[bool, Optional[str]]:
        """Execute the cancellation lifecycle"""
        start_time = datetime.utcnow()
        
        # 1. Validation Phase
        request.state = CancellationState.VALIDATING
        await self._emit_cancellation_event(request, "cancellation_validating")
        
        validation_result = await self._validate_cancellation(request)
        if not validation_result[0]:
            request.state = CancellationState.REJECTED
            self._stats["rejected_cancellations"] += 1
            await self._emit_cancellation_event(request, "cancellation_rejected")
            return validation_result
        
        # 2. Get command and check current state
        command = await self.command_queue.get_command(request.command_id)
        if not command:
            return False, "Command not found"
        
        # 3. Cancellation Phase
        request.state = CancellationState.CANCELLING
        await self._emit_cancellation_event(request, "cancellation_started")
        
        # Attempt to cancel in queue
        if command.status in [CommandStatus.PENDING, CommandStatus.QUEUED]:
            success = await self.command_queue.cancel(request.command_id)
            if success:
                request.state = CancellationState.COMPLETED
                self._stats["successful_cancellations"] += 1
                await self._emit_cancellation_event(request, "cancellation_completed")
                await self._audit_cancellation(request, command, success=True)
                return True, None
        
        # 4. Resource Cleanup Phase (for executing commands)
        if command.status == CommandStatus.EXECUTING:
            request.state = CancellationState.CLEANING_UP
            await self._emit_cancellation_event(request, "cleanup_started")
            
            cleanup_success = await self._execute_cleanup(command, request)
            if not cleanup_success and not request.force:
                request.state = CancellationState.FAILED
                self._stats["failed_cancellations"] += 1
                await self._emit_cancellation_event(request, "cleanup_failed")
                return False, "Resource cleanup failed"
        
        # 5. Rollback Phase (if requested and applicable)
        if request.rollback_requested and command.status == CommandStatus.EXECUTING:
            request.state = CancellationState.ROLLING_BACK
            await self._emit_cancellation_event(request, "rollback_started")
            
            rollback_success = await self._execute_rollback(command, request)
            if not rollback_success:
                self._stats["rollback_failures"] += 1
                # Log but don't fail cancellation
                logger.error(f"Rollback failed for command {command.id}")
        
        # 6. Mark as cancelled
        command.status = CommandStatus.CANCELLED
        command.completed_at = datetime.utcnow()
        
        # 7. Complete
        request.state = CancellationState.COMPLETED
        request.completed_at = datetime.utcnow()
        self._stats["successful_cancellations"] += 1
        
        # Update average cancellation time
        duration_ms = (request.completed_at - start_time).total_seconds() * 1000
        self._update_average_time(duration_ms)
        
        await self._emit_cancellation_event(request, "cancellation_completed")
        await self._audit_cancellation(request, command, success=True)
        
        return True, None
    
    async def _validate_cancellation(
        self,
        request: CancellationRequest
    ) -> Tuple[bool, Optional[str]]:
        """Validate if cancellation is safe and allowed"""
        # Get command
        command = await self.command_queue.get_command(request.command_id)
        if not command:
            return False, "Command not found"
        
        # Check if already in terminal state
        if command.status in self._non_cancellable_states:
            return False, f"Cannot cancel command in {command.status.value} state"
        
        # Check command type restrictions
        if command.command_type in self._non_cancellable_types and not request.force:
            return False, f"Command type {command.command_type.value} is non-cancellable"
        
        # Check safety-critical flag
        if command.metadata.custom_data.get("safety_critical", False) and not request.force:
            return False, "Safety-critical command cannot be cancelled"
        
        # Custom validation hooks
        for validator in self._get_validators(command.command_type):
            result = await validator(command, request)
            if not result[0]:
                request.validation_errors.append(result[1])
                if not request.force:
                    return result
        
        return True, None
    
    async def _execute_cleanup(
        self,
        command: Command,
        request: CancellationRequest
    ) -> bool:
        """Execute resource cleanup handlers"""
        # Sort handlers by priority
        handlers = sorted(self._cleanup_handlers, key=lambda h: h.priority, reverse=True)
        
        all_success = True
        for handler in handlers:
            try:
                # Execute with timeout
                await asyncio.wait_for(
                    handler.handler(command),
                    timeout=handler.timeout_seconds
                )
                request.cleanup_actions.append(f"Cleaned up {handler.resource_type}")
                
            except asyncio.TimeoutError:
                logger.error(f"Cleanup handler {handler.resource_type} timed out")
                if handler.critical:
                    all_success = False
                self._stats["resource_cleanup_failures"] += 1
                
            except Exception as e:
                logger.error(f"Cleanup handler {handler.resource_type} failed: {e}")
                if handler.critical:
                    all_success = False
                self._stats["resource_cleanup_failures"] += 1
        
        return all_success
    
    async def _execute_rollback(
        self,
        command: Command,
        request: CancellationRequest
    ) -> bool:
        """Execute compensating actions for rollback"""
        actions = self._compensating_actions.get(command.command_type, [])
        
        all_success = True
        for action in actions:
            try:
                # Validate if action is applicable
                if action.validate and not await action.validate(command):
                    continue
                
                # Execute compensating action
                await action.execute(command, request.metadata)
                request.rollback_actions.append(f"Executed {action.action_type}")
                
            except Exception as e:
                logger.error(f"Compensating action {action.action_type} failed: {e}")
                all_success = False
        
        return all_success
    
    # Handler registration methods
    
    def register_cleanup_handler(self, handler: ResourceCleanupHandler):
        """Register a resource cleanup handler"""
        self._cleanup_handlers.append(handler)
    
    def register_compensating_action(
        self,
        command_type: CommandType,
        action: CompensatingAction
    ):
        """Register a compensating action for a command type"""
        self._compensating_actions[command_type].append(action)
    
    def add_non_cancellable_type(self, command_type: CommandType):
        """Add a command type that cannot be cancelled"""
        self._non_cancellable_types.add(command_type)
    
    # Default cleanup handlers
    
    async def _cleanup_hardware_locks(self, command: Command):
        """Release hardware locks held by command"""
        # This would integrate with hardware abstraction layer
        logger.info(f"Releasing hardware locks for command {command.id}")
        await asyncio.sleep(0.1)  # Simulate cleanup
    
    async def _cleanup_network_connections(self, command: Command):
        """Close network connections opened by command"""
        logger.info(f"Closing network connections for command {command.id}")
        await asyncio.sleep(0.1)  # Simulate cleanup
    
    async def _cleanup_memory_buffers(self, command: Command):
        """Free memory buffers allocated by command"""
        logger.info(f"Freeing memory buffers for command {command.id}")
        await asyncio.sleep(0.1)  # Simulate cleanup
    
    # Event emission
    
    async def _emit_cancellation_event(
        self,
        request: CancellationRequest,
        event_type: str
    ):
        """Emit cancellation event via WebSocket"""
        await self.ws_handler.emit_command_event(
            CommandEventType.CUSTOM,
            request.command_id,
            {
                "event_type": event_type,
                "cancellation_state": request.state.value,
                "reason": request.reason.value,
                "requester": request.requester_id,
                "validation_errors": request.validation_errors,
                "cleanup_actions": request.cleanup_actions,
                "rollback_actions": request.rollback_actions
            }
        )
    
    # Audit logging
    
    async def _audit_cancellation(
        self,
        request: CancellationRequest,
        command: Command,
        success: bool
    ):
        """Log cancellation to audit service"""
        audit_service = get_audit_service()
        if audit_service:
            await audit_service.log_action(
                action="command_cancellation",
                resource="command",
                resource_id=command.id,
                user_id=request.requester_id,
                details={
                    "command_type": command.command_type.value,
                    "command_status": command.status.value,
                    "cancellation_reason": request.reason.value,
                    "forced": request.force,
                    "rollback_requested": request.rollback_requested,
                    "success": success,
                    "validation_errors": request.validation_errors,
                    "cleanup_actions": request.cleanup_actions,
                    "rollback_actions": request.rollback_actions,
                    "duration_ms": (
                        (request.completed_at - request.timestamp).total_seconds() * 1000
                        if request.completed_at else None
                    )
                },
                ip_address=request.metadata.get("ip_address"),
                user_agent=request.metadata.get("user_agent")
            )
    
    # Utility methods
    
    def _get_validators(self, command_type: CommandType) -> List[Callable]:
        """Get custom validators for command type"""
        # This would be extended with custom validators
        return []
    
    def _update_average_time(self, duration_ms: float):
        """Update average cancellation time"""
        current_avg = self._stats["average_cancellation_time_ms"]
        total = self._stats["successful_cancellations"]
        if total > 0:
            new_avg = (current_avg * (total - 1) + duration_ms) / total
            self._stats["average_cancellation_time_ms"] = new_avg
    
    def get_active_cancellations(self) -> List[CancellationRequest]:
        """Get list of active cancellation requests"""
        return list(self._active_cancellations.values())
    
    def get_cancellation_history(
        self,
        command_id: Optional[str] = None,
        limit: int = 100
    ) -> List[CancellationRequest]:
        """Get cancellation history"""
        history = self._cancellation_history
        if command_id:
            history = [r for r in history if r.command_id == command_id]
        return history[-limit:]
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get cancellation statistics"""
        return self._stats.copy()