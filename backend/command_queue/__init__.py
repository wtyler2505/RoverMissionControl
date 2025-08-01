"""
Rover Mission Control Command Queue System

A robust command queue architecture for managing rover commands with:
- Four priority levels (Emergency, High, Normal, Low)
- Command Pattern implementation
- Queue persistence with SQLite
- Memory-efficient distributed queuing support
- WebSocket integration for real-time updates
"""

from .command_base import (
    CommandPriority,
    CommandStatus,
    CommandType,
    Command,
    CommandResult,
    CommandMetadata
)

from .command_queue import (
    PriorityCommandQueue,
    CommandQueueConfig,
    QueueStatistics
)

from .command_processor import (
    CommandProcessor,
    CommandHandler,
    ProcessorStatus
)

from .command_persistence import (
    CommandPersistence,
    PersistenceConfig
)

from .command_factory import (
    CommandFactory,
    register_command
)

from .websocket_integration import (
    CommandQueueWebSocketHandler,
    CommandEventType
)

from .batch_executor import (
    BatchExecutor,
    BatchExecutionConfig,
    BatchCommand,
    BatchDependency,
    BatchExecutionMode,
    BatchTransactionMode,
    BatchExecutionStatus
)

from .batch_schemas import (
    BatchCreateRequestSchema,
    BatchCommandSchema,
    BatchDependencySchema,
    BatchResponseSchema,
    BatchProgressUpdateSchema,
    BatchErrorSchema
)

__all__ = [
    # Base classes
    'CommandPriority',
    'CommandStatus',
    'CommandType',
    'Command',
    'CommandResult',
    'CommandMetadata',
    
    # Queue system
    'PriorityCommandQueue',
    'CommandQueueConfig',
    'QueueStatistics',
    
    # Processing
    'CommandProcessor',
    'CommandHandler',
    'ProcessorStatus',
    
    # Persistence
    'CommandPersistence',
    'PersistenceConfig',
    
    # Factory
    'CommandFactory',
    'register_command',
    
    # WebSocket integration
    'CommandQueueWebSocketHandler',
    'CommandEventType',
    
    # Batch execution
    'BatchExecutor',
    'BatchExecutionConfig',
    'BatchCommand',
    'BatchDependency',
    'BatchExecutionMode',
    'BatchTransactionMode',
    'BatchExecutionStatus',
    
    # Batch schemas
    'BatchCreateRequestSchema',
    'BatchCommandSchema',
    'BatchDependencySchema',
    'BatchResponseSchema',
    'BatchProgressUpdateSchema',
    'BatchErrorSchema'
]