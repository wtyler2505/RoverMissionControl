"""
FastAPI dependency injection providers
"""
from typing import Optional
from fastapi import Depends

from .command_queue.command_queue import PriorityCommandQueue, CommandQueueConfig
from .command_queue.command_processor import CommandProcessor
from .command_queue.acknowledgment_manager import AcknowledgmentManager, AcknowledgmentConfig
from .command_queue.command_factory import CommandFactory
from .command_queue.batch_executor import BatchExecutor, BatchExecutionConfig
from .command_queue.websocket_integration import CommandQueueWebSocketHandler
from .command_queue.cancellation_manager import CancellationManager
from .websocket.websocket_server import WebSocketServer
from .database import get_db_connection

# Singleton instances
_command_queue: Optional[PriorityCommandQueue] = None
_command_processor: Optional[CommandProcessor] = None
_acknowledgment_manager: Optional[AcknowledgmentManager] = None
_command_factory: Optional[CommandFactory] = None
_batch_executor: Optional[BatchExecutor] = None
_ws_handler: Optional[CommandQueueWebSocketHandler] = None
_ws_server: Optional[WebSocketServer] = None
_cancellation_manager: Optional[CancellationManager] = None


def get_websocket_server() -> WebSocketServer:
    """Get WebSocket server instance"""
    global _ws_server
    if _ws_server is None:
        _ws_server = WebSocketServer()
    return _ws_server


def get_ws_handler() -> CommandQueueWebSocketHandler:
    """Get WebSocket handler instance"""
    global _ws_handler
    if _ws_handler is None:
        ws_server = get_websocket_server()
        _ws_handler = CommandQueueWebSocketHandler(ws_server)
    return _ws_handler


def get_command_queue() -> PriorityCommandQueue:
    """Get command queue instance"""
    global _command_queue
    if _command_queue is None:
        config = CommandQueueConfig()
        _command_queue = PriorityCommandQueue(config)
    return _command_queue


def get_acknowledgment_manager() -> AcknowledgmentManager:
    """Get acknowledgment manager instance"""
    global _acknowledgment_manager
    if _acknowledgment_manager is None:
        ws_handler = get_ws_handler()
        ws_server = get_websocket_server()
        config = AcknowledgmentConfig()
        _acknowledgment_manager = AcknowledgmentManager(ws_handler, ws_server, config)
    return _acknowledgment_manager


def get_command_processor() -> CommandProcessor:
    """Get command processor instance"""
    global _command_processor
    if _command_processor is None:
        queue = get_command_queue()
        ack_manager = get_acknowledgment_manager()
        _command_processor = CommandProcessor(queue, ack_manager)
    return _command_processor


def get_command_factory() -> CommandFactory:
    """Get command factory instance"""
    global _command_factory
    if _command_factory is None:
        _command_factory = CommandFactory()
    return _command_factory


def get_batch_executor() -> BatchExecutor:
    """Get batch executor instance"""
    global _batch_executor
    if _batch_executor is None:
        queue = get_command_queue()
        processor = get_command_processor()
        ack_manager = get_acknowledgment_manager()
        ws_handler = get_ws_handler()
        config = BatchExecutionConfig()
        _batch_executor = BatchExecutor(queue, processor, ack_manager, ws_handler, config)
    return _batch_executor


def get_cancellation_manager() -> CancellationManager:
    """Get cancellation manager instance"""
    global _cancellation_manager
    if _cancellation_manager is None:
        queue = get_command_queue()
        ws_handler = get_ws_handler()
        _cancellation_manager = CancellationManager(queue, ws_handler)
    return _cancellation_manager


# Dependency injection providers
async def get_command_queue_dep() -> PriorityCommandQueue:
    """Dependency provider for command queue"""
    return get_command_queue()


async def get_command_processor_dep() -> CommandProcessor:
    """Dependency provider for command processor"""
    return get_command_processor()


async def get_acknowledgment_manager_dep() -> AcknowledgmentManager:
    """Dependency provider for acknowledgment manager"""
    return get_acknowledgment_manager()


async def get_command_factory_dep() -> CommandFactory:
    """Dependency provider for command factory"""
    return get_command_factory()


async def get_batch_executor_dep() -> BatchExecutor:
    """Dependency provider for batch executor"""
    return get_batch_executor()


async def get_ws_handler_dep() -> CommandQueueWebSocketHandler:
    """Dependency provider for WebSocket handler"""
    return get_ws_handler()


async def get_ws_server_dep() -> WebSocketServer:
    """Dependency provider for WebSocket server"""
    return get_websocket_server()


async def get_cancellation_manager_dep() -> CancellationManager:
    """Dependency provider for cancellation manager"""
    return get_cancellation_manager()


# Initialize all services on startup
async def initialize_services():
    """Initialize all singleton services"""
    queue = get_command_queue()
    await queue.initialize()
    
    ack_manager = get_acknowledgment_manager()
    await ack_manager.initialize()
    
    processor = get_command_processor()
    await processor.start()
    
    # Batch executor doesn't need initialization
    get_batch_executor()
    
    print("All services initialized successfully")


# Shutdown all services
async def shutdown_services():
    """Shutdown all singleton services"""
    if _command_processor:
        await _command_processor.stop()
    
    if _acknowledgment_manager:
        await _acknowledgment_manager.shutdown()
    
    if _command_queue:
        await _command_queue.shutdown()
    
    print("All services shut down successfully")