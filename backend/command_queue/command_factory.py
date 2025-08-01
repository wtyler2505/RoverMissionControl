"""
Command factory for creating and registering command types
"""

import logging
from typing import Dict, Type, Optional, Any, Callable

from .command_base import Command, CommandType, CommandPriority, CommandMetadata


logger = logging.getLogger(__name__)


# Global command registry
_command_registry: Dict[str, Type[Command]] = {}


def register_command(command_type: str):
    """
    Decorator to register a command class with the factory
    
    Usage:
        @register_command("move_forward")
        class MoveForwardCommand(Command):
            ...
    """
    def decorator(command_class: Type[Command]):
        if command_type in _command_registry:
            logger.warning(f"Overwriting existing command registration for {command_type}")
        
        _command_registry[command_type] = command_class
        logger.info(f"Registered command type: {command_type} -> {command_class.__name__}")
        
        return command_class
    
    return decorator


class CommandFactory:
    """
    Factory for creating command instances
    Supports extensible command types through registration
    """
    
    def __init__(self):
        self._custom_validators: Dict[str, Callable] = {}
        self._default_priorities: Dict[str, CommandPriority] = {
            CommandType.EMERGENCY_STOP.value: CommandPriority.EMERGENCY,
            CommandType.STOP.value: CommandPriority.HIGH,
            CommandType.MOVE_FORWARD.value: CommandPriority.NORMAL,
            CommandType.MOVE_BACKWARD.value: CommandPriority.NORMAL,
            CommandType.TURN_LEFT.value: CommandPriority.NORMAL,
            CommandType.TURN_RIGHT.value: CommandPriority.NORMAL,
            CommandType.SET_SPEED.value: CommandPriority.NORMAL,
            CommandType.SET_POWER.value: CommandPriority.NORMAL,
            CommandType.READ_SENSOR.value: CommandPriority.LOW,
            CommandType.CALIBRATE_SENSOR.value: CommandPriority.LOW,
            CommandType.SYSTEM_STATUS.value: CommandPriority.LOW,
            CommandType.DIAGNOSTIC.value: CommandPriority.LOW,
            CommandType.PING.value: CommandPriority.LOW,
            CommandType.HEARTBEAT.value: CommandPriority.LOW
        }
    
    def create_command(
        self,
        command_type: str,
        parameters: Optional[Dict[str, Any]] = None,
        priority: Optional[CommandPriority] = None,
        metadata: Optional[CommandMetadata] = None,
        timeout_ms: Optional[int] = None,
        max_retries: int = 0
    ) -> Command:
        """
        Create a command instance
        
        Args:
            command_type: Type of command to create
            parameters: Command-specific parameters
            priority: Command priority (uses default if not specified)
            metadata: Command metadata
            timeout_ms: Command timeout in milliseconds
            max_retries: Maximum number of retries
            
        Returns:
            Command instance
            
        Raises:
            ValueError: If command type is not registered
        """
        # Check if command type is registered
        if command_type not in _command_registry:
            # Try to find matching CommandType enum
            try:
                cmd_type_enum = CommandType(command_type)
                # Use generic command class if no specific implementation
                return self._create_generic_command(
                    cmd_type_enum,
                    parameters,
                    priority,
                    metadata,
                    timeout_ms,
                    max_retries
                )
            except ValueError:
                raise ValueError(f"Unknown command type: {command_type}")
        
        # Get command class
        command_class = _command_registry[command_type]
        
        # Determine priority
        if priority is None:
            priority = self._default_priorities.get(command_type, CommandPriority.NORMAL)
        
        # Create command instance
        try:
            command = command_class(
                command_type=CommandType(command_type),
                priority=priority,
                parameters=parameters,
                metadata=metadata,
                timeout_ms=timeout_ms,
                max_retries=max_retries
            )
            
            # Run custom validation if registered
            if command_type in self._custom_validators:
                validator = self._custom_validators[command_type]
                validator(command)
            
            return command
            
        except Exception as e:
            logger.error(f"Error creating command {command_type}: {e}")
            raise
    
    def _create_generic_command(
        self,
        command_type: CommandType,
        parameters: Optional[Dict[str, Any]],
        priority: Optional[CommandPriority],
        metadata: Optional[CommandMetadata],
        timeout_ms: Optional[int],
        max_retries: int
    ) -> Command:
        """Create a generic command for types without specific implementations"""
        # This would typically use a GenericCommand class
        # For now, raise NotImplementedError
        raise NotImplementedError(
            f"No specific implementation for command type: {command_type.value}"
        )
    
    def register_validator(self, command_type: str, validator: Callable):
        """Register a custom validator for a command type"""
        self._custom_validators[command_type] = validator
    
    def set_default_priority(self, command_type: str, priority: CommandPriority):
        """Set the default priority for a command type"""
        self._default_priorities[command_type] = priority
    
    def get_registered_types(self) -> Dict[str, Type[Command]]:
        """Get all registered command types"""
        return _command_registry.copy()
    
    def is_registered(self, command_type: str) -> bool:
        """Check if a command type is registered"""
        return command_type in _command_registry