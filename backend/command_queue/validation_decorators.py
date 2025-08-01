"""
Validation Decorators for Command Processing
Provides reusable decorators for command validation and safety checks
"""

import functools
import logging
from typing import Callable, Any, Dict, List, Optional, TypeVar, Union
from datetime import datetime
import asyncio
import inspect

from .command_base import Command, CommandType, CommandStatus, CommandResult
from .command_schemas import CommandValidator, CommandSchema

logger = logging.getLogger(__name__)

# Type variable for command functions
F = TypeVar('F', bound=Callable[..., Any])


class ValidationError(Exception):
    """Custom exception for validation failures"""
    def __init__(self, message: str, errors: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message)
        self.errors = errors or []


def validate_command(schema_validation: bool = True, custom_rules: Optional[List[Callable]] = None):
    """
    Decorator to validate commands before execution
    
    Args:
        schema_validation: Whether to perform schema validation
        custom_rules: List of custom validation functions
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            # Schema validation
            if schema_validation:
                validator = CommandValidator()
                try:
                    command_data = command.to_dict()
                    validated = validator.validate_command(command_data)
                except ValueError as e:
                    logger.error(f"Command validation failed: {e}")
                    return CommandResult(
                        success=False,
                        command_id=command.id,
                        status=CommandStatus.FAILED,
                        error_message=str(e),
                        error_details={"validation_error": str(e)},
                        timestamp=datetime.utcnow()
                    )
            
            # Custom rules validation
            if custom_rules:
                for rule in custom_rules:
                    try:
                        if not rule(command):
                            error_msg = f"Custom validation rule '{rule.__name__}' failed"
                            logger.error(error_msg)
                            return CommandResult(
                                success=False,
                                command_id=command.id,
                                status=CommandStatus.FAILED,
                                error_message=error_msg,
                                timestamp=datetime.utcnow()
                            )
                    except Exception as e:
                        logger.error(f"Error in custom validation rule: {e}")
                        return CommandResult(
                            success=False,
                            command_id=command.id,
                            status=CommandStatus.FAILED,
                            error_message=f"Validation error: {str(e)}",
                            timestamp=datetime.utcnow()
                        )
            
            # Execute the original function
            return await func(self, command, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            # Schema validation
            if schema_validation:
                validator = CommandValidator()
                try:
                    command_data = command.to_dict()
                    validated = validator.validate_command(command_data)
                except ValueError as e:
                    logger.error(f"Command validation failed: {e}")
                    raise ValidationError(str(e))
            
            # Custom rules validation
            if custom_rules:
                for rule in custom_rules:
                    try:
                        if not rule(command):
                            error_msg = f"Custom validation rule '{rule.__name__}' failed"
                            logger.error(error_msg)
                            raise ValidationError(error_msg)
                    except ValidationError:
                        raise
                    except Exception as e:
                        logger.error(f"Error in custom validation rule: {e}")
                        raise ValidationError(f"Validation error: {str(e)}")
            
            # Execute the original function
            return func(self, command, *args, **kwargs)
        
        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def require_parameters(*required_params: str):
    """
    Decorator to ensure required parameters are present in command
    
    Args:
        *required_params: Names of required parameters
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            missing_params = []
            for param in required_params:
                if param not in command.parameters or command.parameters[param] is None:
                    missing_params.append(param)
            
            if missing_params:
                error_msg = f"Missing required parameters: {', '.join(missing_params)}"
                logger.error(error_msg)
                return CommandResult(
                    success=False,
                    command_id=command.id,
                    status=CommandStatus.FAILED,
                    error_message=error_msg,
                    error_details={"missing_parameters": missing_params},
                    timestamp=datetime.utcnow()
                )
            
            return await func(self, command, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            missing_params = []
            for param in required_params:
                if param not in command.parameters or command.parameters[param] is None:
                    missing_params.append(param)
            
            if missing_params:
                error_msg = f"Missing required parameters: {', '.join(missing_params)}"
                logger.error(error_msg)
                raise ValidationError(error_msg, [{"missing_parameters": missing_params}])
            
            return func(self, command, *args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def validate_range(parameter: str, min_value: Optional[float] = None, max_value: Optional[float] = None):
    """
    Decorator to validate numeric parameter is within range
    
    Args:
        parameter: Name of the parameter to validate
        min_value: Minimum allowed value (inclusive)
        max_value: Maximum allowed value (inclusive)
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            if parameter in command.parameters:
                value = command.parameters[parameter]
                
                if value is not None:
                    try:
                        numeric_value = float(value)
                        
                        if min_value is not None and numeric_value < min_value:
                            error_msg = f"{parameter} value {numeric_value} is below minimum {min_value}"
                            logger.error(error_msg)
                            return CommandResult(
                                success=False,
                                command_id=command.id,
                                status=CommandStatus.FAILED,
                                error_message=error_msg,
                                timestamp=datetime.utcnow()
                            )
                        
                        if max_value is not None and numeric_value > max_value:
                            error_msg = f"{parameter} value {numeric_value} exceeds maximum {max_value}"
                            logger.error(error_msg)
                            return CommandResult(
                                success=False,
                                command_id=command.id,
                                status=CommandStatus.FAILED,
                                error_message=error_msg,
                                timestamp=datetime.utcnow()
                            )
                    
                    except (TypeError, ValueError):
                        error_msg = f"{parameter} must be a numeric value"
                        logger.error(error_msg)
                        return CommandResult(
                            success=False,
                            command_id=command.id,
                            status=CommandStatus.FAILED,
                            error_message=error_msg,
                            timestamp=datetime.utcnow()
                        )
            
            return await func(self, command, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            if parameter in command.parameters:
                value = command.parameters[parameter]
                
                if value is not None:
                    try:
                        numeric_value = float(value)
                        
                        if min_value is not None and numeric_value < min_value:
                            error_msg = f"{parameter} value {numeric_value} is below minimum {min_value}"
                            logger.error(error_msg)
                            raise ValidationError(error_msg)
                        
                        if max_value is not None and numeric_value > max_value:
                            error_msg = f"{parameter} value {numeric_value} exceeds maximum {max_value}"
                            logger.error(error_msg)
                            raise ValidationError(error_msg)
                    
                    except (TypeError, ValueError):
                        error_msg = f"{parameter} must be a numeric value"
                        logger.error(error_msg)
                        raise ValidationError(error_msg)
            
            return func(self, command, *args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def safety_check(check_func: Callable[[Command], bool], error_message: str = "Safety check failed"):
    """
    Decorator to apply safety checks before command execution
    
    Args:
        check_func: Function that returns True if safe to proceed
        error_message: Error message if check fails
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            try:
                if not check_func(command):
                    logger.error(f"Safety check failed for command {command.id}: {error_message}")
                    return CommandResult(
                        success=False,
                        command_id=command.id,
                        status=CommandStatus.FAILED,
                        error_message=error_message,
                        error_details={"safety_check": "failed"},
                        timestamp=datetime.utcnow()
                    )
            except Exception as e:
                logger.error(f"Error in safety check: {e}")
                return CommandResult(
                    success=False,
                    command_id=command.id,
                    status=CommandStatus.FAILED,
                    error_message=f"Safety check error: {str(e)}",
                    timestamp=datetime.utcnow()
                )
            
            return await func(self, command, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            try:
                if not check_func(command):
                    logger.error(f"Safety check failed for command {command.id}: {error_message}")
                    raise ValidationError(error_message, [{"safety_check": "failed"}])
            except ValidationError:
                raise
            except Exception as e:
                logger.error(f"Error in safety check: {e}")
                raise ValidationError(f"Safety check error: {str(e)}")
            
            return func(self, command, *args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def rate_limit(max_calls: int, time_window: float):
    """
    Decorator to rate limit command execution
    
    Args:
        max_calls: Maximum number of calls allowed
        time_window: Time window in seconds
    """
    call_times: List[float] = []
    
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            current_time = datetime.utcnow().timestamp()
            
            # Remove old calls outside the time window
            nonlocal call_times
            call_times = [t for t in call_times if current_time - t < time_window]
            
            # Check rate limit
            if len(call_times) >= max_calls:
                error_msg = f"Rate limit exceeded: {max_calls} calls per {time_window} seconds"
                logger.warning(error_msg)
                return CommandResult(
                    success=False,
                    command_id=command.id,
                    status=CommandStatus.FAILED,
                    error_message=error_msg,
                    error_details={"rate_limit": "exceeded"},
                    timestamp=datetime.utcnow()
                )
            
            # Record this call
            call_times.append(current_time)
            
            return await func(self, command, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            current_time = datetime.utcnow().timestamp()
            
            # Remove old calls outside the time window
            nonlocal call_times
            call_times = [t for t in call_times if current_time - t < time_window]
            
            # Check rate limit
            if len(call_times) >= max_calls:
                error_msg = f"Rate limit exceeded: {max_calls} calls per {time_window} seconds"
                logger.warning(error_msg)
                raise ValidationError(error_msg, [{"rate_limit": "exceeded"}])
            
            # Record this call
            call_times.append(current_time)
            
            return func(self, command, *args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def command_type(*allowed_types: CommandType):
    """
    Decorator to restrict function to specific command types
    
    Args:
        *allowed_types: Allowed command types
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            if command.command_type not in allowed_types:
                error_msg = f"Command type {command.command_type.value} not allowed. Expected one of: {[t.value for t in allowed_types]}"
                logger.error(error_msg)
                return CommandResult(
                    success=False,
                    command_id=command.id,
                    status=CommandStatus.FAILED,
                    error_message=error_msg,
                    timestamp=datetime.utcnow()
                )
            
            return await func(self, command, *args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            if command.command_type not in allowed_types:
                error_msg = f"Command type {command.command_type.value} not allowed. Expected one of: {[t.value for t in allowed_types]}"
                logger.error(error_msg)
                raise ValidationError(error_msg)
            
            return func(self, command, *args, **kwargs)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def log_validation(level: str = "INFO"):
    """
    Decorator to log validation steps
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
    """
    def decorator(func: F) -> F:
        log_func = getattr(logger, level.lower(), logger.info)
        
        @functools.wraps(func)
        async def async_wrapper(self, command: Command, *args, **kwargs):
            log_func(f"Validating command {command.id} of type {command.command_type.value}")
            start_time = datetime.utcnow()
            
            try:
                result = await func(self, command, *args, **kwargs)
                duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                if hasattr(result, 'success'):
                    if result.success:
                        log_func(f"Command {command.id} validated successfully in {duration:.2f}ms")
                    else:
                        logger.error(f"Command {command.id} validation failed: {result.error_message}")
                
                return result
            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                logger.error(f"Command {command.id} validation error after {duration:.2f}ms: {e}")
                raise
        
        @functools.wraps(func)
        def sync_wrapper(self, command: Command, *args, **kwargs):
            log_func(f"Validating command {command.id} of type {command.command_type.value}")
            start_time = datetime.utcnow()
            
            try:
                result = func(self, command, *args, **kwargs)
                duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                log_func(f"Command {command.id} validated successfully in {duration:.2f}ms")
                return result
            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds() * 1000
                logger.error(f"Command {command.id} validation error after {duration:.2f}ms: {e}")
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Composite decorator for common validation patterns
def standard_validation(
    required_params: Optional[List[str]] = None,
    range_validations: Optional[Dict[str, Dict[str, float]]] = None,
    safety_checks: Optional[List[Callable]] = None,
    rate_limit_config: Optional[Dict[str, Any]] = None
):
    """
    Composite decorator applying multiple validation patterns
    
    Args:
        required_params: List of required parameter names
        range_validations: Dict of parameter names to min/max values
        safety_checks: List of safety check functions
        rate_limit_config: Rate limiting configuration
    """
    def decorator(func: F) -> F:
        # Apply decorators in reverse order (innermost first)
        decorated = func
        
        # Apply rate limiting if configured
        if rate_limit_config:
            decorated = rate_limit(
                rate_limit_config.get('max_calls', 10),
                rate_limit_config.get('time_window', 60)
            )(decorated)
        
        # Apply safety checks
        if safety_checks:
            for check in reversed(safety_checks):
                decorated = safety_check(check)(decorated)
        
        # Apply range validations
        if range_validations:
            for param, limits in range_validations.items():
                decorated = validate_range(
                    param,
                    limits.get('min'),
                    limits.get('max')
                )(decorated)
        
        # Apply required parameters check
        if required_params:
            decorated = require_parameters(*required_params)(decorated)
        
        # Apply general validation and logging
        decorated = log_validation()(decorated)
        decorated = validate_command()(decorated)
        
        return decorated
    
    return decorator


# Example usage functions for safety checks
def is_system_ready(command: Command) -> bool:
    """Example safety check: verify system is ready"""
    # This would check actual system state
    return True


def is_safe_speed(command: Command) -> bool:
    """Example safety check: verify speed is safe"""
    speed = command.parameters.get('speed', 0)
    return speed <= 5.0  # Max safe speed


def has_sufficient_power(command: Command) -> bool:
    """Example safety check: verify sufficient power"""
    # This would check actual battery level
    return True