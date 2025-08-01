"""
Integration example showing how to use the command queue system
"""

import asyncio
import logging
from typing import Optional

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.responses import JSONResponse

from .command_base import CommandPriority, CommandStatus, CommandMetadata
from .command_queue import PriorityCommandQueue, CommandQueueConfig
from .command_processor import CommandProcessor, CommandHandler, ProcessorConfig
from .command_persistence import CommandPersistence, PersistenceConfig
from .command_factory import CommandFactory
from .websocket_integration import CommandQueueWebSocketHandler, CommandEventType
from .rover_commands import *  # Import all registered commands

from ..websocket.websocket_server import WebSocketServer


logger = logging.getLogger(__name__)


class CommandQueueSystem:
    """
    Main integration class for the command queue system
    """
    
    def __init__(
        self,
        app: FastAPI,
        ws_server: WebSocketServer,
        enable_persistence: bool = True
    ):
        self.app = app
        self.ws_server = ws_server
        
        # Initialize components
        self.queue_config = CommandQueueConfig(
            max_queue_size=10000,
            enable_persistence=enable_persistence,
            enable_metrics=True
        )
        
        self.queue = PriorityCommandQueue(self.queue_config)
        
        self.processor_config = ProcessorConfig(
            max_concurrent_commands=5,
            processing_timeout_ms=60000
        )
        
        self.processor = CommandProcessor(self.queue, self.processor_config)
        
        self.factory = CommandFactory()
        
        if enable_persistence:
            self.persistence = CommandPersistence(PersistenceConfig())
        else:
            self.persistence = None
        
        # WebSocket integration
        self.ws_handler = CommandQueueWebSocketHandler(
            ws_server,
            self.queue
        )
        
        # Register default handlers
        self._register_default_handlers()
        
        # Setup API routes
        self._setup_routes()
    
    async def initialize(self):
        """Initialize the command queue system"""
        logger.info("Initializing command queue system...")
        
        # Initialize queue
        await self.queue.initialize()
        
        # Initialize persistence
        if self.persistence:
            await self.persistence.initialize()
            
            # Load any pending commands
            pending_commands = await self.persistence.load_pending_commands()
            logger.info(f"Loaded {len(pending_commands)} pending commands from persistence")
            
            # Re-queue pending commands
            # (Would need to reconstruct Command objects from dict data)
        
        # Initialize WebSocket handler
        await self.ws_handler.initialize()
        
        # Start processor
        await self.processor.start()
        
        logger.info("Command queue system initialized")
    
    async def shutdown(self):
        """Shutdown the command queue system"""
        logger.info("Shutting down command queue system...")
        
        # Stop processor
        await self.processor.stop()
        
        # Shutdown WebSocket handler
        await self.ws_handler.shutdown()
        
        # Shutdown queue
        await self.queue.shutdown()
        
        logger.info("Command queue system shut down")
    
    def _register_default_handlers(self):
        """Register default command handlers"""
        # Create a generic handler that executes registered commands
        class GenericCommandHandler(CommandHandler):
            async def can_handle(self, command: Command) -> bool:
                return True  # Handle all commands
            
            async def handle(self, command: Command) -> CommandResult:
                # Execute the command's own execute method
                return await command.execute()
        
        # Set as default handler
        self.processor.set_default_handler(GenericCommandHandler())
    
    def _setup_routes(self):
        """Setup FastAPI routes for command queue"""
        
        @self.app.post("/api/commands/create")
        async def create_command(request: dict):
            """Create and queue a new command"""
            try:
                # Extract parameters
                command_type = request.get('commandType')
                parameters = request.get('parameters', {})
                priority = request.get('priority')
                metadata_dict = request.get('metadata', {})
                timeout_ms = request.get('timeoutMs')
                max_retries = request.get('maxRetries', 0)
                
                # Create metadata
                metadata = CommandMetadata(
                    source=metadata_dict.get('source', 'api'),
                    session_id=metadata_dict.get('sessionId'),
                    user_id=metadata_dict.get('userId'),
                    correlation_id=metadata_dict.get('correlationId'),
                    tags=metadata_dict.get('tags', []),
                    custom_data=metadata_dict.get('customData', {})
                )
                
                # Parse priority if provided
                if priority is not None:
                    priority = CommandPriority(priority)
                
                # Create command
                command = self.factory.create_command(
                    command_type=command_type,
                    parameters=parameters,
                    priority=priority,
                    metadata=metadata,
                    timeout_ms=timeout_ms,
                    max_retries=max_retries
                )
                
                # Queue command
                success = await self.queue.enqueue(command)
                
                if success:
                    # Persist if enabled
                    if self.persistence:
                        await self.persistence.save_command(command)
                    
                    # Emit WebSocket event
                    await self.ws_handler.emit_command_event(
                        CommandEventType.COMMAND_QUEUED,
                        command
                    )
                    
                    return JSONResponse({
                        "success": True,
                        "commandId": command.id,
                        "status": command.status.value
                    })
                else:
                    raise HTTPException(status_code=503, detail="Queue is full")
                
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logger.error(f"Error creating command: {e}")
                raise HTTPException(status_code=500, detail="Internal server error")
        
        @self.app.get("/api/commands/{command_id}")
        async def get_command(command_id: str):
            """Get command details"""
            command = await self.queue.get_command(command_id)
            
            if command:
                return command.to_dict()
            else:
                # Try persistence
                if self.persistence:
                    command_dict = await self.persistence.get_command(command_id)
                    if command_dict:
                        return command_dict
                
                raise HTTPException(status_code=404, detail="Command not found")
        
        @self.app.post("/api/commands/{command_id}/cancel")
        async def cancel_command(command_id: str):
            """Cancel a queued command"""
            success = await self.queue.cancel(command_id)
            
            if success:
                # Update persistence
                if self.persistence:
                    await self.persistence.update_command_status(
                        command_id,
                        CommandStatus.CANCELLED
                    )
                
                return {"success": True, "message": "Command cancelled"}
            else:
                raise HTTPException(status_code=400, detail="Cannot cancel command")
        
        @self.app.get("/api/commands/queue/status")
        async def get_queue_status():
            """Get queue status and statistics"""
            stats = await self.queue.get_statistics()
            queue_sizes = await self.queue.get_queue_size()
            processor_status = self.processor.get_status()
            
            return {
                "queue": {
                    "sizes": {
                        priority.name: size
                        for priority, size in queue_sizes.items()
                    },
                    "statistics": {
                        "totalCommands": stats.total_commands,
                        "currentQueueSize": stats.current_queue_size,
                        "averageQueueTimeMs": stats.average_queue_time_ms,
                        "averageExecutionTimeMs": stats.average_execution_time_ms,
                        "commandsProcessedLastMinute": stats.commands_processed_last_minute,
                        "commandsFailedLastMinute": stats.commands_failed_last_minute,
                        "peakQueueSize": stats.peak_queue_size
                    }
                },
                "processor": processor_status
            }
        
        @self.app.post("/api/commands/processor/pause")
        async def pause_processor():
            """Pause command processing"""
            await self.processor.pause()
            return {"success": True, "status": "paused"}
        
        @self.app.post("/api/commands/processor/resume")
        async def resume_processor():
            """Resume command processing"""
            await self.processor.resume()
            return {"success": True, "status": "processing"}
        
        @self.app.get("/api/commands/types")
        async def get_command_types():
            """Get available command types"""
            registered_types = self.factory.get_registered_types()
            
            return {
                "commandTypes": [
                    {
                        "type": cmd_type,
                        "className": cmd_class.__name__,
                        "priority": self.factory._default_priorities.get(
                            cmd_type,
                            CommandPriority.NORMAL
                        ).name
                    }
                    for cmd_type, cmd_class in registered_types.items()
                ]
            }


# Example usage function
async def setup_command_queue(app: FastAPI, ws_server: WebSocketServer) -> CommandQueueSystem:
    """
    Setup function to integrate command queue with existing FastAPI app
    
    Usage in main.py:
        from command_queue.integration_example import setup_command_queue
        
        # In your startup event
        command_system = await setup_command_queue(app, ws_server)
    """
    # Create command queue system
    command_system = CommandQueueSystem(app, ws_server)
    
    # Initialize
    await command_system.initialize()
    
    # Register shutdown handler
    @app.on_event("shutdown")
    async def shutdown_command_queue():
        await command_system.shutdown()
    
    return command_system


# Example of creating a custom command handler
class RoverMovementHandler(CommandHandler):
    """
    Example custom handler for rover movement commands
    Could interface with actual hardware
    """
    
    def __init__(self, rover_controller):
        self.rover_controller = rover_controller
    
    async def can_handle(self, command: Command) -> bool:
        return command.command_type in [
            CommandType.MOVE_FORWARD,
            CommandType.MOVE_BACKWARD,
            CommandType.TURN_LEFT,
            CommandType.TURN_RIGHT,
            CommandType.STOP
        ]
    
    async def handle(self, command: Command) -> CommandResult:
        """Handle movement commands by interfacing with rover hardware"""
        try:
            if command.command_type == CommandType.MOVE_FORWARD:
                distance = command.parameters['distance']
                speed = command.parameters['speed']
                
                # Interface with actual rover
                await self.rover_controller.move_forward(distance, speed)
                
                return CommandResult(
                    success=True,
                    command_id=command.id,
                    status=CommandStatus.COMPLETED,
                    result_data={"distance_traveled": distance}
                )
            
            # Handle other movement commands...
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=command.id,
                status=CommandStatus.FAILED,
                error_message=str(e)
            )