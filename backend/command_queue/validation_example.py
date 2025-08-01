"""
Example implementation showing how to use the command validation system
"""

import asyncio
from typing import Dict, Any

from .command_base import Command, CommandType, CommandPriority, CommandResult, CommandStatus
from .command_schemas import CommandValidator, CommandSerializer, SerializationFormat
from .validation_decorators import (
    validate_command,
    require_parameters,
    validate_range,
    safety_check,
    rate_limit,
    command_type,
    standard_validation,
    is_safe_speed,
    has_sufficient_power
)
from .command_factory import register_command


# Example: Movement command with full validation
@register_command("move_forward")
class MoveForwardCommand(Command):
    """
    Move forward command with comprehensive validation
    """
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.MOVE_FORWARD, **kwargs)
    
    def _validate_parameters(self) -> None:
        """Validate movement parameters"""
        # Basic validation is handled by decorators
        # Additional custom validation can go here
        if 'distance' in self.parameters and 'duration' in self.parameters:
            # Check if speed would be too high
            distance = self.parameters['distance']
            duration = self.parameters['duration']
            implied_speed = distance / duration if duration > 0 else float('inf')
            
            if implied_speed > 10:
                raise ValueError(f"Implied speed {implied_speed:.2f} m/s exceeds maximum")
    
    @standard_validation(
        required_params=['distance'],
        range_validations={
            'distance': {'min': 0.1, 'max': 100},
            'speed': {'min': 0.1, 'max': 5.0}
        },
        safety_checks=[is_safe_speed, has_sufficient_power],
        rate_limit_config={'max_calls': 10, 'time_window': 60}
    )
    async def execute(self) -> CommandResult:
        """Execute move forward command"""
        distance = self.parameters['distance']
        speed = self.parameters.get('speed', 1.0)
        
        # Simulate command execution
        await asyncio.sleep(0.1)  # Simulate processing
        
        return CommandResult(
            success=True,
            command_id=self.id,
            status=CommandStatus.COMPLETED,
            result_data={
                'distance_moved': distance,
                'actual_speed': speed,
                'duration': distance / speed
            },
            execution_time_ms=100
        )


# Example: Emergency stop with minimal validation (always allowed)
@register_command("emergency_stop")
class EmergencyStopCommand(Command):
    """
    Emergency stop command - minimal validation for safety
    """
    
    def __init__(self, **kwargs):
        # Force emergency priority
        kwargs['priority'] = CommandPriority.EMERGENCY
        super().__init__(command_type=CommandType.EMERGENCY_STOP, **kwargs)
    
    def _validate_parameters(self) -> None:
        """No parameter validation for emergency stop"""
        pass
    
    @command_type(CommandType.EMERGENCY_STOP)
    async def execute(self) -> CommandResult:
        """Execute emergency stop immediately"""
        # Emergency stop bypasses most validation
        return CommandResult(
            success=True,
            command_id=self.id,
            status=CommandStatus.COMPLETED,
            result_data={'action': 'emergency_stop_activated'},
            execution_time_ms=10
        )


# Example: Sensor reading with custom validation
@register_command("read_sensor")
class ReadSensorCommand(Command):
    """
    Read sensor command with custom validation
    """
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.READ_SENSOR, **kwargs)
    
    def _validate_parameters(self) -> None:
        """Validate sensor parameters"""
        if 'sensor_id' not in self.parameters:
            raise ValueError("sensor_id is required")
    
    @validate_command()
    @require_parameters('sensor_id')
    @rate_limit(max_calls=100, time_window=10)  # Higher rate for sensor reads
    async def execute(self) -> CommandResult:
        """Execute sensor read"""
        sensor_id = self.parameters['sensor_id']
        
        # Simulate sensor reading
        await asyncio.sleep(0.05)
        
        # Mock sensor data
        sensor_data = {
            'TEMP_01': {'temperature': 22.5, 'unit': 'celsius'},
            'DIST_FRONT': {'distance': 2.4, 'unit': 'meters'},
            'IMU_01': {'pitch': 0.2, 'roll': -0.1, 'yaw': 45.3}
        }
        
        if sensor_id not in sensor_data:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=f"Unknown sensor: {sensor_id}"
            )
        
        return CommandResult(
            success=True,
            command_id=self.id,
            status=CommandStatus.COMPLETED,
            result_data={
                'sensor_id': sensor_id,
                'readings': sensor_data[sensor_id],
                'timestamp': '2025-01-27T12:00:00Z'
            },
            execution_time_ms=50
        )


# Example: Using the validation system
async def example_usage():
    """Demonstrate command validation and serialization"""
    
    # Create a validator
    validator = CommandValidator()
    
    # Register custom safety rules
    validator.register_safety_rule(
        CommandType.SET_POWER,
        lambda cmd: cmd.parameters.get('power_level', 0) <= 80
    )
    
    # Create and validate commands
    commands = [
        {
            'id': '123e4567-e89b-12d3-a456-426614174000',
            'command_type': CommandType.MOVE_FORWARD,
            'priority': CommandPriority.NORMAL,
            'parameters': {
                'distance': 5.0,
                'speed': 2.0
            },
            'metadata': {
                'source': 'example_script',
                'tags': ['test', 'demo'],
                'custom_data': {}
            },
            'timeout_ms': 30000,
            'max_retries': 2
        },
        {
            'id': '223e4567-e89b-12d3-a456-426614174000',
            'command_type': CommandType.SET_SPEED,
            'priority': CommandPriority.HIGH,
            'parameters': {
                'speed': 3.5,
                'acceleration': 1.0
            },
            'metadata': {
                'source': 'example_script',
                'tags': ['speed_control'],
                'custom_data': {}
            }
        }
    ]
    
    # Validate commands
    print("Validating commands...")
    for cmd_data in commands:
        try:
            validated = validator.validate_command(cmd_data)
            print(f"✓ Command {validated.id} validated successfully")
        except ValueError as e:
            print(f"✗ Validation failed: {e}")
    
    # Serialize commands
    serializer = CommandSerializer()
    print("\nSerializing commands...")
    
    for cmd_data in commands:
        # Try different formats
        for format in [SerializationFormat.JSON, SerializationFormat.MESSAGEPACK, SerializationFormat.CBOR]:
            serialized = serializer.serialize(cmd_data, format)
            size = len(serialized)
            print(f"  {format.value}: {size} bytes")
        
        # Estimate sizes
        print(f"  Size comparison: {serializer.estimate_size(cmd_data, SerializationFormat.JSON)} (JSON) vs "
              f"{serializer.estimate_size(cmd_data, SerializationFormat.MESSAGEPACK)} (MessagePack)")
    
    # Execute a command with validation
    print("\nExecuting commands with validation...")
    move_cmd = MoveForwardCommand(
        parameters={'distance': 10.0, 'speed': 2.0},
        metadata={'source': 'example'}
    )
    
    result = await move_cmd.execute()
    if result.success:
        print(f"✓ Command executed: {result.result_data}")
    else:
        print(f"✗ Command failed: {result.error_message}")


# Example: Batch validation
def example_batch_validation():
    """Demonstrate batch command validation"""
    
    validator = CommandValidator()
    
    # Create a batch of commands
    batch = [
        {
            'id': f'{i}23e4567-e89b-12d3-a456-426614174000',
            'command_type': CommandType.MOVE_FORWARD,
            'parameters': {
                'distance': i * 2,
                'speed': min(i, 5)  # Some will exceed safe speed
            },
            'metadata': {'source': 'batch_test', 'tags': [], 'custom_data': {}}
        }
        for i in range(1, 6)
    ]
    
    # Validate batch
    try:
        validated_batch = validator.validate_batch(batch)
        print(f"Batch validation successful: {len(validated_batch)} commands")
    except ValueError as e:
        print(f"Batch validation failed: {e}")


if __name__ == "__main__":
    # Run examples
    asyncio.run(example_usage())
    print("\n" + "="*50 + "\n")
    example_batch_validation()