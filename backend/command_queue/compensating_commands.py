"""
Compensating Command Framework

Implements the Compensating Transaction pattern for safe command rollback.
Each command can have an associated compensating command that undoes its effects.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any, Type
from enum import Enum

from .command_base import Command, CommandType, CommandPriority, CommandStatus, CommandResult
from .command_factory import CommandFactory


logger = logging.getLogger(__name__)


class CompensationStrategy(Enum):
    """Strategy for generating compensating commands"""
    INVERSE = "inverse"  # Direct inverse operation
    RESTORE = "restore"  # Restore to previous state
    CLEANUP = "cleanup"  # Clean up resources only
    CUSTOM = "custom"    # Custom compensation logic
    NONE = "none"        # No compensation possible


@dataclass
class CompensationContext:
    """Context for compensating command generation"""
    original_command: Command
    original_result: Optional[CommandResult] = None
    system_state_before: Dict[str, Any] = field(default_factory=dict)
    system_state_after: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def get_state_diff(self) -> Dict[str, Any]:
        """Get the difference between before and after states"""
        diff = {}
        for key in set(self.system_state_before.keys()) | set(self.system_state_after.keys()):
            before = self.system_state_before.get(key)
            after = self.system_state_after.get(key)
            if before != after:
                diff[key] = {"before": before, "after": after}
        return diff


class CompensatingCommand(Command):
    """
    Base class for compensating commands that undo the effects of another command.
    
    Safety features:
    - Validates system state before compensation
    - Tracks compensation success/failure
    - Provides partial compensation capability
    """
    
    def __init__(
        self,
        original_command: Command,
        compensation_strategy: CompensationStrategy,
        *args,
        **kwargs
    ):
        # Set high priority for compensating commands
        kwargs['priority'] = kwargs.get('priority', CommandPriority.HIGH)
        
        # Add compensation metadata
        if 'metadata' not in kwargs:
            kwargs['metadata'] = original_command.metadata
        
        kwargs['metadata'].custom_data.update({
            "is_compensating": True,
            "compensates_command_id": original_command.id,
            "compensation_strategy": compensation_strategy.value,
            "original_command_type": original_command.command_type.value
        })
        
        super().__init__(
            command_type=self._get_compensation_type(original_command.command_type),
            *args,
            **kwargs
        )
        
        self.original_command = original_command
        self.compensation_strategy = compensation_strategy
    
    def _get_compensation_type(self, original_type: CommandType) -> CommandType:
        """Get the compensating command type"""
        # Override in subclasses for specific compensation types
        return CommandType.CUSTOM
    
    async def validate_compensation_possible(self) -> Tuple[bool, Optional[str]]:
        """
        Validate if compensation is possible in current state.
        Override in subclasses for specific validation.
        """
        return True, None
    
    async def execute(self) -> CommandResult:
        """Execute compensation with validation"""
        # Validate compensation is possible
        can_compensate, reason = await self.validate_compensation_possible()
        if not can_compensate:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=f"Compensation not possible: {reason}"
            )
        
        # Execute compensation
        try:
            result = await self._execute_compensation()
            
            # Log compensation result
            logger.info(
                f"Compensation {'successful' if result.success else 'failed'} "
                f"for command {self.original_command.id}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Compensation error: {e}")
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={"exception": str(type(e).__name__)}
            )
    
    @abstractmethod
    async def _execute_compensation(self) -> CommandResult:
        """
        Execute the actual compensation logic.
        Must be implemented by concrete compensating commands.
        """
        pass


class CompensatingCommandRegistry:
    """
    Registry for compensating command generators.
    Maps command types to their compensation strategies and generators.
    """
    
    def __init__(self):
        self._generators: Dict[CommandType, Callable] = {}
        self._strategies: Dict[CommandType, CompensationStrategy] = {}
        self._state_capturers: Dict[CommandType, Callable] = {}
        
        # Register default compensations
        self._register_defaults()
    
    def _register_defaults(self):
        """Register default compensating commands"""
        # Movement compensations
        self.register(
            CommandType.MOVE_FORWARD,
            self._compensate_move_forward,
            CompensationStrategy.INVERSE
        )
        self.register(
            CommandType.MOVE_BACKWARD,
            self._compensate_move_backward,
            CompensationStrategy.INVERSE
        )
        self.register(
            CommandType.TURN_LEFT,
            self._compensate_turn_left,
            CompensationStrategy.INVERSE
        )
        self.register(
            CommandType.TURN_RIGHT,
            self._compensate_turn_right,
            CompensationStrategy.INVERSE
        )
        
        # State-based compensations
        self.register(
            CommandType.SET_SPEED,
            self._compensate_set_speed,
            CompensationStrategy.RESTORE,
            state_capturer=self._capture_speed_state
        )
        self.register(
            CommandType.SET_POWER,
            self._compensate_set_power,
            CompensationStrategy.RESTORE,
            state_capturer=self._capture_power_state
        )
        
        # Cleanup-only compensations
        self.register(
            CommandType.READ_SENSOR,
            None,  # No compensation needed
            CompensationStrategy.NONE
        )
    
    def register(
        self,
        command_type: CommandType,
        generator: Optional[Callable],
        strategy: CompensationStrategy,
        state_capturer: Optional[Callable] = None
    ):
        """Register a compensating command generator"""
        self._strategies[command_type] = strategy
        if generator:
            self._generators[command_type] = generator
        if state_capturer:
            self._state_capturers[command_type] = state_capturer
    
    async def generate_compensating_command(
        self,
        context: CompensationContext
    ) -> Optional[CompensatingCommand]:
        """Generate a compensating command for the given context"""
        command_type = context.original_command.command_type
        strategy = self._strategies.get(command_type, CompensationStrategy.NONE)
        
        if strategy == CompensationStrategy.NONE:
            return None
        
        generator = self._generators.get(command_type)
        if not generator:
            logger.warning(f"No compensation generator for {command_type.value}")
            return None
        
        try:
            return await generator(context)
        except Exception as e:
            logger.error(f"Failed to generate compensating command: {e}")
            return None
    
    async def capture_state_before(
        self,
        command: Command
    ) -> Dict[str, Any]:
        """Capture system state before command execution"""
        capturer = self._state_capturers.get(command.command_type)
        if capturer:
            try:
                return await capturer(command, before=True)
            except Exception as e:
                logger.error(f"State capture failed: {e}")
        return {}
    
    async def capture_state_after(
        self,
        command: Command
    ) -> Dict[str, Any]:
        """Capture system state after command execution"""
        capturer = self._state_capturers.get(command.command_type)
        if capturer:
            try:
                return await capturer(command, before=False)
            except Exception as e:
                logger.error(f"State capture failed: {e}")
        return {}
    
    # Default compensation generators
    
    async def _compensate_move_forward(
        self,
        context: CompensationContext
    ) -> CompensatingCommand:
        """Generate compensation for forward movement"""
        class MoveBackwardCompensation(CompensatingCommand):
            def _get_compensation_type(self, original_type: CommandType) -> CommandType:
                return CommandType.MOVE_BACKWARD
            
            async def _execute_compensation(self) -> CommandResult:
                # Execute backward movement with same distance
                # This would integrate with actual hardware control
                return CommandResult(
                    success=True,
                    command_id=self.id,
                    status=CommandStatus.COMPLETED,
                    result_data={
                        "compensated_distance": self.parameters.get("distance", 0)
                    }
                )
        
        return MoveBackwardCompensation(
            original_command=context.original_command,
            compensation_strategy=CompensationStrategy.INVERSE,
            parameters=context.original_command.parameters
        )
    
    async def _compensate_move_backward(
        self,
        context: CompensationContext
    ) -> CompensatingCommand:
        """Generate compensation for backward movement"""
        class MoveForwardCompensation(CompensatingCommand):
            def _get_compensation_type(self, original_type: CommandType) -> CommandType:
                return CommandType.MOVE_FORWARD
            
            async def _execute_compensation(self) -> CommandResult:
                return CommandResult(
                    success=True,
                    command_id=self.id,
                    status=CommandStatus.COMPLETED,
                    result_data={
                        "compensated_distance": self.parameters.get("distance", 0)
                    }
                )
        
        return MoveForwardCompensation(
            original_command=context.original_command,
            compensation_strategy=CompensationStrategy.INVERSE,
            parameters=context.original_command.parameters
        )
    
    async def _compensate_turn_left(
        self,
        context: CompensationContext
    ) -> CompensatingCommand:
        """Generate compensation for left turn"""
        class TurnRightCompensation(CompensatingCommand):
            def _get_compensation_type(self, original_type: CommandType) -> CommandType:
                return CommandType.TURN_RIGHT
            
            async def _execute_compensation(self) -> CommandResult:
                return CommandResult(
                    success=True,
                    command_id=self.id,
                    status=CommandStatus.COMPLETED,
                    result_data={
                        "compensated_angle": self.parameters.get("angle", 0)
                    }
                )
        
        return TurnRightCompensation(
            original_command=context.original_command,
            compensation_strategy=CompensationStrategy.INVERSE,
            parameters=context.original_command.parameters
        )
    
    async def _compensate_turn_right(
        self,
        context: CompensationContext
    ) -> CompensatingCommand:
        """Generate compensation for right turn"""
        class TurnLeftCompensation(CompensatingCommand):
            def _get_compensation_type(self, original_type: CommandType) -> CommandType:
                return CommandType.TURN_LEFT
            
            async def _execute_compensation(self) -> CommandResult:
                return CommandResult(
                    success=True,
                    command_id=self.id,
                    status=CommandStatus.COMPLETED,
                    result_data={
                        "compensated_angle": self.parameters.get("angle", 0)
                    }
                )
        
        return TurnLeftCompensation(
            original_command=context.original_command,
            compensation_strategy=CompensationStrategy.INVERSE,
            parameters=context.original_command.parameters
        )
    
    async def _compensate_set_speed(
        self,
        context: CompensationContext
    ) -> CompensatingCommand:
        """Generate compensation for speed change"""
        class RestoreSpeedCompensation(CompensatingCommand):
            def _get_compensation_type(self, original_type: CommandType) -> CommandType:
                return CommandType.SET_SPEED
            
            async def _execute_compensation(self) -> CommandResult:
                # Restore to previous speed
                previous_speed = context.system_state_before.get("speed", 0)
                return CommandResult(
                    success=True,
                    command_id=self.id,
                    status=CommandStatus.COMPLETED,
                    result_data={
                        "restored_speed": previous_speed
                    }
                )
        
        # Use previous speed from state
        restore_params = {
            "speed": context.system_state_before.get("speed", 0)
        }
        
        return RestoreSpeedCompensation(
            original_command=context.original_command,
            compensation_strategy=CompensationStrategy.RESTORE,
            parameters=restore_params
        )
    
    async def _compensate_set_power(
        self,
        context: CompensationContext
    ) -> CompensatingCommand:
        """Generate compensation for power change"""
        class RestorePowerCompensation(CompensatingCommand):
            def _get_compensation_type(self, original_type: CommandType) -> CommandType:
                return CommandType.SET_POWER
            
            async def _execute_compensation(self) -> CommandResult:
                # Restore to previous power
                previous_power = context.system_state_before.get("power", 0)
                return CommandResult(
                    success=True,
                    command_id=self.id,
                    status=CommandStatus.COMPLETED,
                    result_data={
                        "restored_power": previous_power
                    }
                )
        
        restore_params = {
            "power": context.system_state_before.get("power", 0)
        }
        
        return RestorePowerCompensation(
            original_command=context.original_command,
            compensation_strategy=CompensationStrategy.RESTORE,
            parameters=restore_params
        )
    
    # State capture methods
    
    async def _capture_speed_state(
        self,
        command: Command,
        before: bool
    ) -> Dict[str, Any]:
        """Capture speed state"""
        # This would integrate with actual rover state
        # For now, return mock state
        return {"speed": 50 if before else command.parameters.get("speed", 0)}
    
    async def _capture_power_state(
        self,
        command: Command,
        before: bool
    ) -> Dict[str, Any]:
        """Capture power state"""
        # This would integrate with actual rover state
        return {"power": 100 if before else command.parameters.get("power", 0)}


# Global registry instance
compensating_registry = CompensatingCommandRegistry()