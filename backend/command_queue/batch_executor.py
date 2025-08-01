"""
Batch Execution Engine for Command Queue System

This module provides comprehensive batch execution capabilities including:
- Batch command creation and management
- Transactional execution with atomicity options
- Partial failure handling and recovery
- Batch progress tracking
- Rollback capabilities where feasible
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Set, Tuple, Callable
from dataclasses import dataclass, field
from enum import Enum
import uuid
from collections import defaultdict

from .command_base import Command, CommandStatus, CommandResult, CommandPriority, CommandType
from .command_queue import PriorityCommandQueue
from .acknowledgment_manager import AcknowledgmentManager, AcknowledgmentStatus
from .command_processor import CommandProcessor
from .websocket_integration import CommandQueueWebSocketHandler, CommandEventType

logger = logging.getLogger(__name__)


class BatchExecutionMode(Enum):
    """Batch execution modes"""
    SEQUENTIAL = "sequential"  # Execute commands one after another
    PARALLEL = "parallel"      # Execute commands concurrently
    MIXED = "mixed"           # Mix of sequential and parallel based on dependencies


class BatchTransactionMode(Enum):
    """Transaction modes for batch execution"""
    ALL_OR_NOTHING = "all_or_nothing"  # All commands must succeed
    BEST_EFFORT = "best_effort"        # Execute as many as possible
    STOP_ON_ERROR = "stop_on_error"    # Stop at first error but keep completed
    ISOLATED = "isolated"              # Each command is independent


class BatchStatus(Enum):
    """Batch execution status"""
    PENDING = "pending"
    VALIDATING = "validating"
    QUEUED = "queued"
    EXECUTING = "executing"
    PARTIALLY_COMPLETED = "partially_completed"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"


@dataclass
class BatchDependency:
    """Dependency between commands in a batch"""
    from_command_id: str
    to_command_id: str
    dependency_type: str = "completion"  # completion, success, data
    condition: Optional[Dict[str, Any]] = None


@dataclass
class BatchExecutionConfig:
    """Configuration for batch execution"""
    max_batch_size: int = 100
    default_execution_mode: BatchExecutionMode = BatchExecutionMode.SEQUENTIAL
    default_transaction_mode: BatchTransactionMode = BatchTransactionMode.BEST_EFFORT
    parallel_execution_limit: int = 10
    enable_rollback: bool = True
    rollback_timeout_seconds: int = 300
    progress_update_interval: float = 1.0
    enable_partial_results: bool = True
    validate_dependencies: bool = True
    enable_batch_templates: bool = True


@dataclass
class BatchCommand:
    """Container for a batch of commands with execution metadata"""
    batch_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Unnamed Batch"
    description: Optional[str] = None
    commands: List[Command] = field(default_factory=list)
    dependencies: List[BatchDependency] = field(default_factory=list)
    execution_mode: BatchExecutionMode = BatchExecutionMode.SEQUENTIAL
    transaction_mode: BatchTransactionMode = BatchTransactionMode.BEST_EFFORT
    priority: CommandPriority = CommandPriority.NORMAL
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Execution state
    status: BatchStatus = BatchStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Progress tracking
    total_commands: int = 0
    completed_commands: int = 0
    failed_commands: int = 0
    
    # Results
    command_results: Dict[str, CommandResult] = field(default_factory=dict)
    batch_result: Optional[Dict[str, Any]] = None
    error_summary: List[Dict[str, Any]] = field(default_factory=list)
    
    # Rollback state
    rollback_plan: Optional[List[Command]] = None
    rollback_status: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert batch to dictionary for serialization"""
        return {
            "batch_id": self.batch_id,
            "name": self.name,
            "description": self.description,
            "execution_mode": self.execution_mode.value,
            "transaction_mode": self.transaction_mode.value,
            "priority": self.priority.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "total_commands": self.total_commands,
            "completed_commands": self.completed_commands,
            "failed_commands": self.failed_commands,
            "metadata": self.metadata,
            "error_summary": self.error_summary,
            "rollback_status": self.rollback_status
        }


class BatchExecutor:
    """
    Batch execution engine for managing and executing command batches
    """
    
    def __init__(
        self,
        command_queue: PriorityCommandQueue,
        command_processor: CommandProcessor,
        acknowledgment_manager: AcknowledgmentManager,
        ws_handler: CommandQueueWebSocketHandler,
        config: Optional[BatchExecutionConfig] = None
    ):
        self.command_queue = command_queue
        self.command_processor = command_processor
        self.acknowledgment_manager = acknowledgment_manager
        self.ws_handler = ws_handler
        self.config = config or BatchExecutionConfig()
        
        # Batch storage
        self._batches: Dict[str, BatchCommand] = {}
        self._batch_locks: Dict[str, asyncio.Lock] = {}
        
        # Execution tracking
        self._executing_batches: Set[str] = set()
        self._execution_tasks: Dict[str, asyncio.Task] = {}
        
        # Dependency graph management
        self._dependency_graphs: Dict[str, Dict[str, Set[str]]] = {}
        
        # Templates
        self._batch_templates: Dict[str, BatchCommand] = {}
        
        # Callbacks
        self._batch_callbacks: Dict[str, List[Callable]] = defaultdict(list)
        
        # Statistics
        self.stats = {
            "total_batches": 0,
            "completed_batches": 0,
            "failed_batches": 0,
            "average_batch_size": 0.0,
            "average_execution_time_ms": 0.0
        }
    
    async def create_batch(
        self,
        commands: List[Command],
        name: str,
        description: Optional[str] = None,
        execution_mode: Optional[BatchExecutionMode] = None,
        transaction_mode: Optional[BatchTransactionMode] = None,
        dependencies: Optional[List[BatchDependency]] = None,
        priority: Optional[CommandPriority] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> BatchCommand:
        """Create a new batch command"""
        if len(commands) > self.config.max_batch_size:
            raise ValueError(f"Batch size {len(commands)} exceeds maximum {self.config.max_batch_size}")
        
        batch = BatchCommand(
            name=name,
            description=description,
            commands=commands,
            dependencies=dependencies or [],
            execution_mode=execution_mode or self.config.default_execution_mode,
            transaction_mode=transaction_mode or self.config.default_transaction_mode,
            priority=priority or CommandPriority.NORMAL,
            metadata=metadata or {},
            total_commands=len(commands)
        )
        
        # Validate batch
        await self._validate_batch(batch)
        
        # Store batch
        self._batches[batch.batch_id] = batch
        self._batch_locks[batch.batch_id] = asyncio.Lock()
        
        # Build dependency graph if needed
        if batch.dependencies and self.config.validate_dependencies:
            self._build_dependency_graph(batch)
        
        # Update statistics
        self.stats["total_batches"] += 1
        self._update_average_batch_size(len(commands))
        
        # Emit creation event
        await self._emit_batch_event(batch, "batch_created")
        
        logger.info(f"Created batch {batch.batch_id} with {len(commands)} commands")
        return batch
    
    async def execute_batch(self, batch_id: str) -> Dict[str, Any]:
        """Execute a batch of commands"""
        batch = self._batches.get(batch_id)
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")
        
        if batch.status != BatchStatus.PENDING:
            raise ValueError(f"Batch {batch_id} is not in pending state")
        
        if batch_id in self._executing_batches:
            raise ValueError(f"Batch {batch_id} is already executing")
        
        # Mark as executing
        self._executing_batches.add(batch_id)
        batch.status = BatchStatus.EXECUTING
        batch.started_at = datetime.utcnow()
        
        # Create execution task
        task = asyncio.create_task(self._execute_batch_internal(batch))
        self._execution_tasks[batch_id] = task
        
        # Emit start event
        await self._emit_batch_event(batch, "batch_started")
        
        try:
            # Wait for completion
            result = await task
            return result
        finally:
            # Cleanup
            self._executing_batches.discard(batch_id)
            if batch_id in self._execution_tasks:
                del self._execution_tasks[batch_id]
    
    async def _execute_batch_internal(self, batch: BatchCommand) -> Dict[str, Any]:
        """Internal batch execution logic"""
        try:
            # Generate rollback plan if enabled
            if self.config.enable_rollback:
                batch.rollback_plan = await self._generate_rollback_plan(batch)
            
            # Execute based on mode
            if batch.execution_mode == BatchExecutionMode.SEQUENTIAL:
                result = await self._execute_sequential(batch)
            elif batch.execution_mode == BatchExecutionMode.PARALLEL:
                result = await self._execute_parallel(batch)
            else:  # MIXED
                result = await self._execute_mixed(batch)
            
            # Handle transaction mode
            if batch.transaction_mode == BatchTransactionMode.ALL_OR_NOTHING:
                if batch.failed_commands > 0:
                    # Rollback if any failed
                    await self._rollback_batch(batch)
                    batch.status = BatchStatus.ROLLED_BACK
                else:
                    batch.status = BatchStatus.COMPLETED
            else:
                if batch.failed_commands == 0:
                    batch.status = BatchStatus.COMPLETED
                elif batch.completed_commands > 0:
                    batch.status = BatchStatus.PARTIALLY_COMPLETED
                else:
                    batch.status = BatchStatus.FAILED
            
            batch.completed_at = datetime.utcnow()
            batch.batch_result = result
            
            # Update statistics
            if batch.status == BatchStatus.COMPLETED:
                self.stats["completed_batches"] += 1
            else:
                self.stats["failed_batches"] += 1
            
            execution_time = (batch.completed_at - batch.started_at).total_seconds() * 1000
            self._update_average_execution_time(execution_time)
            
            # Emit completion event
            await self._emit_batch_event(batch, "batch_completed")
            
            # Trigger callbacks
            await self._trigger_callbacks(batch)
            
            return result
            
        except Exception as e:
            logger.error(f"Batch execution error for {batch.batch_id}: {e}")
            batch.status = BatchStatus.FAILED
            batch.completed_at = datetime.utcnow()
            batch.error_summary.append({
                "error": "batch_execution_failure",
                "message": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            await self._emit_batch_event(batch, "batch_failed")
            raise
    
    async def _execute_sequential(self, batch: BatchCommand) -> Dict[str, Any]:
        """Execute commands sequentially"""
        results = []
        
        for idx, command in enumerate(batch.commands):
            # Check transaction mode
            if (batch.transaction_mode == BatchTransactionMode.STOP_ON_ERROR and 
                batch.failed_commands > 0):
                logger.info(f"Stopping batch {batch.batch_id} due to previous error")
                break
            
            try:
                # Update progress
                await self._update_batch_progress(batch, idx, len(batch.commands))
                
                # Execute command
                result = await self._execute_single_command(command, batch)
                results.append(result)
                
                if result.success:
                    batch.completed_commands += 1
                else:
                    batch.failed_commands += 1
                    batch.error_summary.append({
                        "command_id": command.id,
                        "error": result.error_message,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                batch.command_results[command.id] = result
                
            except Exception as e:
                logger.error(f"Command execution error in batch: {e}")
                batch.failed_commands += 1
                batch.error_summary.append({
                    "command_id": command.id,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        return {
            "results": results,
            "completed": batch.completed_commands,
            "failed": batch.failed_commands,
            "total": batch.total_commands
        }
    
    async def _execute_parallel(self, batch: BatchCommand) -> Dict[str, Any]:
        """Execute commands in parallel with concurrency limit"""
        semaphore = asyncio.Semaphore(self.config.parallel_execution_limit)
        tasks = []
        
        async def execute_with_semaphore(command: Command, index: int):
            async with semaphore:
                await self._update_batch_progress(batch, index, len(batch.commands))
                return await self._execute_single_command(command, batch)
        
        # Create tasks for all commands
        for idx, command in enumerate(batch.commands):
            task = asyncio.create_task(execute_with_semaphore(command, idx))
            tasks.append((command.id, task))
        
        # Wait for all tasks
        results = []
        for command_id, task in tasks:
            try:
                result = await task
                results.append(result)
                
                if result.success:
                    batch.completed_commands += 1
                else:
                    batch.failed_commands += 1
                    batch.error_summary.append({
                        "command_id": command_id,
                        "error": result.error_message,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                
                batch.command_results[command_id] = result
                
            except Exception as e:
                logger.error(f"Parallel execution error for command {command_id}: {e}")
                batch.failed_commands += 1
                batch.error_summary.append({
                    "command_id": command_id,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        return {
            "results": results,
            "completed": batch.completed_commands,
            "failed": batch.failed_commands,
            "total": batch.total_commands
        }
    
    async def _execute_mixed(self, batch: BatchCommand) -> Dict[str, Any]:
        """Execute commands with mixed mode based on dependencies"""
        if not batch.dependencies:
            # No dependencies, fall back to parallel
            return await self._execute_parallel(batch)
        
        # Use dependency graph to determine execution order
        graph = self._dependency_graphs.get(batch.batch_id, {})
        if not graph:
            # No valid graph, fall back to sequential
            return await self._execute_sequential(batch)
        
        # Topological sort for execution order
        execution_groups = self._topological_sort(graph)
        results = []
        
        for group in execution_groups:
            # Execute each group in parallel
            group_commands = [cmd for cmd in batch.commands if cmd.id in group]
            
            if not group_commands:
                continue
            
            # Create a temporary batch for the group
            temp_batch = BatchCommand(
                commands=group_commands,
                execution_mode=BatchExecutionMode.PARALLEL,
                transaction_mode=batch.transaction_mode
            )
            
            group_result = await self._execute_parallel(temp_batch)
            results.extend(group_result["results"])
            
            # Update main batch stats
            batch.completed_commands += temp_batch.completed_commands
            batch.failed_commands += temp_batch.failed_commands
            batch.command_results.update(temp_batch.command_results)
            
            # Check if we should stop
            if (batch.transaction_mode == BatchTransactionMode.STOP_ON_ERROR and 
                batch.failed_commands > 0):
                break
        
        return {
            "results": results,
            "completed": batch.completed_commands,
            "failed": batch.failed_commands,
            "total": batch.total_commands
        }
    
    async def _execute_single_command(
        self, 
        command: Command, 
        batch: BatchCommand
    ) -> CommandResult:
        """Execute a single command within a batch context"""
        # Add batch context to command metadata
        command.metadata.custom_data["batch_id"] = batch.batch_id
        command.metadata.custom_data["batch_name"] = batch.name
        
        # Create acknowledgment
        acknowledgment = await self.acknowledgment_manager.create_acknowledgment(command)
        
        # Queue and execute
        await self.command_queue.enqueue(command)
        
        # Process through command processor
        result = await self.command_processor.process_command(command)
        
        # Update acknowledgment
        await self.acknowledgment_manager.complete_command(command.id, result)
        
        return result
    
    async def cancel_batch(self, batch_id: str) -> bool:
        """Cancel a batch execution"""
        batch = self._batches.get(batch_id)
        if not batch:
            return False
        
        if batch.status in [BatchStatus.COMPLETED, BatchStatus.FAILED, BatchStatus.CANCELLED]:
            return False
        
        # Cancel execution task if running
        if batch_id in self._execution_tasks:
            task = self._execution_tasks[batch_id]
            task.cancel()
        
        # Cancel individual commands
        for command in batch.commands:
            if command.id in batch.command_results:
                continue  # Already executed
            await self.command_queue.cancel(command.id)
        
        batch.status = BatchStatus.CANCELLED
        batch.completed_at = datetime.utcnow()
        
        await self._emit_batch_event(batch, "batch_cancelled")
        
        logger.info(f"Cancelled batch {batch_id}")
        return True
    
    async def get_batch_status(self, batch_id: str) -> Optional[BatchCommand]:
        """Get current batch status"""
        return self._batches.get(batch_id)
    
    async def list_batches(
        self, 
        status: Optional[BatchStatus] = None,
        limit: int = 100
    ) -> List[BatchCommand]:
        """List batches with optional filtering"""
        batches = list(self._batches.values())
        
        if status:
            batches = [b for b in batches if b.status == status]
        
        # Sort by creation time (newest first)
        batches.sort(key=lambda b: b.created_at, reverse=True)
        
        return batches[:limit]
    
    async def create_batch_template(
        self,
        template_id: str,
        batch: BatchCommand
    ) -> bool:
        """Create a reusable batch template"""
        if not self.config.enable_batch_templates:
            return False
        
        # Clear execution-specific data
        template = BatchCommand(
            name=batch.name,
            description=batch.description,
            commands=[],  # Commands will be cloned when using template
            dependencies=batch.dependencies.copy(),
            execution_mode=batch.execution_mode,
            transaction_mode=batch.transaction_mode,
            priority=batch.priority,
            metadata=batch.metadata.copy()
        )
        
        self._batch_templates[template_id] = template
        logger.info(f"Created batch template {template_id}")
        return True
    
    async def create_batch_from_template(
        self,
        template_id: str,
        commands: List[Command],
        name: Optional[str] = None
    ) -> BatchCommand:
        """Create a new batch from a template"""
        template = self._batch_templates.get(template_id)
        if not template:
            raise ValueError(f"Template {template_id} not found")
        
        return await self.create_batch(
            commands=commands,
            name=name or f"{template.name} (from template)",
            description=template.description,
            execution_mode=template.execution_mode,
            transaction_mode=template.transaction_mode,
            dependencies=template.dependencies.copy(),
            priority=template.priority,
            metadata=template.metadata.copy()
        )
    
    def register_batch_callback(
        self,
        batch_id: str,
        callback: Callable[[BatchCommand], Any]
    ):
        """Register a callback for batch completion"""
        self._batch_callbacks[batch_id].append(callback)
    
    async def _validate_batch(self, batch: BatchCommand):
        """Validate batch configuration and commands"""
        # Check for duplicate command IDs
        command_ids = [cmd.id for cmd in batch.commands]
        if len(command_ids) != len(set(command_ids)):
            raise ValueError("Duplicate command IDs in batch")
        
        # Validate dependencies
        if batch.dependencies and self.config.validate_dependencies:
            valid_ids = set(command_ids)
            for dep in batch.dependencies:
                if dep.from_command_id not in valid_ids:
                    raise ValueError(f"Invalid dependency source: {dep.from_command_id}")
                if dep.to_command_id not in valid_ids:
                    raise ValueError(f"Invalid dependency target: {dep.to_command_id}")
        
        # Validate execution mode constraints
        if (batch.execution_mode == BatchExecutionMode.PARALLEL and 
            batch.transaction_mode == BatchTransactionMode.ALL_OR_NOTHING):
            logger.warning(
                "Parallel execution with all-or-nothing transaction mode "
                "may have limited rollback capabilities"
            )
    
    def _build_dependency_graph(self, batch: BatchCommand):
        """Build dependency graph for the batch"""
        graph = defaultdict(set)
        
        # Initialize all nodes
        for command in batch.commands:
            graph[command.id] = set()
        
        # Add edges based on dependencies
        for dep in batch.dependencies:
            graph[dep.from_command_id].add(dep.to_command_id)
        
        # Check for cycles
        if self._has_cycle(graph):
            raise ValueError("Circular dependencies detected in batch")
        
        self._dependency_graphs[batch.batch_id] = graph
    
    def _has_cycle(self, graph: Dict[str, Set[str]]) -> bool:
        """Check if the dependency graph has cycles"""
        visited = set()
        rec_stack = set()
        
        def visit(node):
            if node in rec_stack:
                return True
            if node in visited:
                return False
            
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph.get(node, []):
                if visit(neighbor):
                    return True
            
            rec_stack.remove(node)
            return False
        
        for node in graph:
            if node not in visited:
                if visit(node):
                    return True
        
        return False
    
    def _topological_sort(self, graph: Dict[str, Set[str]]) -> List[Set[str]]:
        """Perform topological sort to get execution groups"""
        in_degree = defaultdict(int)
        
        # Calculate in-degrees
        for node in graph:
            for neighbor in graph[node]:
                in_degree[neighbor] += 1
        
        # Find nodes with no dependencies
        queue = [node for node in graph if in_degree[node] == 0]
        groups = []
        
        while queue:
            # Current group can be executed in parallel
            current_group = set(queue)
            groups.append(current_group)
            
            next_queue = []
            for node in queue:
                for neighbor in graph[node]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_queue.append(neighbor)
            
            queue = next_queue
        
        return groups
    
    async def _generate_rollback_plan(self, batch: BatchCommand) -> List[Command]:
        """Generate rollback commands for the batch"""
        rollback_commands = []
        
        for command in batch.commands:
            # Generate inverse command if possible
            inverse = self._generate_inverse_command(command)
            if inverse:
                rollback_commands.append(inverse)
        
        # Reverse order for rollback
        rollback_commands.reverse()
        
        return rollback_commands
    
    def _generate_inverse_command(self, command: Command) -> Optional[Command]:
        """Generate inverse command for rollback"""
        # This is a simplified implementation
        # In practice, this would be more sophisticated
        
        inverse_map = {
            CommandType.MOVE_FORWARD: CommandType.MOVE_BACKWARD,
            CommandType.MOVE_BACKWARD: CommandType.MOVE_FORWARD,
            CommandType.TURN_LEFT: CommandType.TURN_RIGHT,
            CommandType.TURN_RIGHT: CommandType.TURN_LEFT,
        }
        
        if command.command_type in inverse_map:
            inverse_type = inverse_map[command.command_type]
            # Create inverse command with same parameters
            # This would need proper command factory integration
            return None  # Placeholder
        
        return None
    
    async def _rollback_batch(self, batch: BatchCommand):
        """Execute rollback plan for the batch"""
        if not batch.rollback_plan:
            logger.warning(f"No rollback plan available for batch {batch.batch_id}")
            return
        
        batch.status = BatchStatus.ROLLING_BACK
        batch.rollback_status = "in_progress"
        
        await self._emit_batch_event(batch, "batch_rollback_started")
        
        try:
            # Execute rollback commands
            for command in batch.rollback_plan:
                # Only rollback successfully executed commands
                original_id = command.metadata.custom_data.get("rollback_for")
                if original_id and original_id in batch.command_results:
                    result = batch.command_results[original_id]
                    if result.success:
                        await self._execute_single_command(command, batch)
            
            batch.rollback_status = "completed"
            await self._emit_batch_event(batch, "batch_rollback_completed")
            
        except Exception as e:
            logger.error(f"Rollback failed for batch {batch.batch_id}: {e}")
            batch.rollback_status = "failed"
            await self._emit_batch_event(batch, "batch_rollback_failed")
    
    async def _update_batch_progress(
        self,
        batch: BatchCommand,
        current: int,
        total: int
    ):
        """Update and emit batch progress"""
        progress = current / total if total > 0 else 0
        
        await self.ws_handler.emit_command_event(
            CommandEventType.COMMAND_PROGRESS,
            None,
            {
                "batch_id": batch.batch_id,
                "progress": progress,
                "current": current,
                "total": total,
                "completed": batch.completed_commands,
                "failed": batch.failed_commands
            }
        )
    
    async def _emit_batch_event(self, batch: BatchCommand, event_type: str):
        """Emit batch-related event via WebSocket"""
        await self.ws_handler.emit_command_event(
            CommandEventType.CUSTOM,
            None,
            {
                "event_type": event_type,
                "batch": batch.to_dict()
            }
        )
    
    async def _trigger_callbacks(self, batch: BatchCommand):
        """Trigger registered callbacks for the batch"""
        callbacks = self._batch_callbacks.get(batch.batch_id, [])
        
        for callback in callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(batch)
                else:
                    callback(batch)
            except Exception as e:
                logger.error(f"Batch callback error: {e}")
    
    def _update_average_batch_size(self, size: int):
        """Update rolling average batch size"""
        current_avg = self.stats["average_batch_size"]
        total = self.stats["total_batches"]
        new_avg = (current_avg * (total - 1) + size) / total if total > 0 else size
        self.stats["average_batch_size"] = new_avg
    
    def _update_average_execution_time(self, time_ms: float):
        """Update rolling average execution time"""
        completed = self.stats["completed_batches"] + self.stats["failed_batches"]
        if completed > 0:
            current_avg = self.stats["average_execution_time_ms"]
            new_avg = (current_avg * (completed - 1) + time_ms) / completed
            self.stats["average_execution_time_ms"] = new_avg
    
    def get_stats(self) -> Dict[str, Any]:
        """Get batch executor statistics"""
        stats = self.stats.copy()
        stats["active_batches"] = len(self._executing_batches)
        stats["pending_batches"] = len([
            b for b in self._batches.values() 
            if b.status == BatchStatus.PENDING
        ])
        return stats