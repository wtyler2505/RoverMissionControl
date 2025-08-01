# Command Serialization and Validation System

## Overview

The Rover Mission Control system implements a comprehensive command serialization and validation framework that ensures commands are properly formatted, validated, and efficiently transmitted between the frontend and backend systems.

## Architecture

### Backend Components

1. **Command Schemas (`backend/command_queue/command_schemas.py`)**
   - Pydantic-based validation schemas for all command types
   - Support for multiple serialization formats (JSON, MessagePack, CBOR)
   - Business rule validation and safety checks
   - Batch validation support

2. **Validation Decorators (`backend/command_queue/validation_decorators.py`)**
   - Reusable decorators for command validation
   - Parameter validation (required fields, ranges)
   - Safety checks and rate limiting
   - Composite decorators for common patterns

### Frontend Components

1. **Command Validator (`frontend/src/services/command/CommandValidator.ts`)**
   - Zod-based schemas mirroring backend validation
   - Real-time validation with TypeScript support
   - Custom validators and safety rules
   - Client-side parameter validation

2. **Command Serializer (`frontend/src/services/command/CommandSerializer.ts`)**
   - Integration with WebSocket binary protocols
   - Support for multiple serialization formats
   - Compression support
   - Protocol optimization based on payload

3. **React Hooks (`frontend/src/hooks/useCommandValidation.ts`)**
   - Real-time validation with debouncing
   - Field-level and command-level validation
   - Touch tracking for form fields
   - Batch validation support

4. **UI Components (`frontend/src/components/command/`)**
   - `CommandValidationFeedback.tsx`: User-friendly error display
   - `CommandForm.tsx`: Example form with real-time validation

## Usage Examples

### Backend Validation

```python
from backend.command_queue.validation_decorators import (
    standard_validation,
    is_safe_speed,
    has_sufficient_power
)

@register_command("move_forward")
class MoveForwardCommand(Command):
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
        # Command execution logic
        pass
```

### Frontend Validation

```typescript
import { useCommandValidation } from '@/hooks/useCommandValidation';
import { CommandType } from '@/services/command/types';

function CommandForm() {
  const {
    validationState,
    validateCommand,
    validateField,
    getFieldError,
    hasFieldError
  } = useCommandValidation();

  const handleSubmit = async (command: Partial<Command>) => {
    const result = await validateCommand(command);
    if (result.valid) {
      // Send command
    }
  };

  // Real-time field validation
  const handleFieldChange = async (field: string, value: any) => {
    await validateField(field, value, CommandType.MOVE_FORWARD);
  };
}
```

### Serialization

```typescript
import { CommandSerializer } from '@/services/command/CommandSerializer';
import { Protocol } from '@/services/websocket/types';

const serializer = new CommandSerializer();

// Serialize command
const serialized = await serializer.serialize(command, {
  protocol: Protocol.MESSAGEPACK,
  compress: true,
  validate: true
});

// Compare protocols
const sizes = serializer.compareProtocols(command);
// Output: { json: 256, messagepack: 180, cbor: 175 }
```

## Validation Rules

### Parameter Validation

Each command type has specific parameter requirements:

- **Movement Commands**: distance (0.1-100m), speed (0.1-5m/s)
- **Power Commands**: powerLevel (0-100%), rampTime (0-10s)
- **Sensor Commands**: sensorId (from approved list), sampleRate (0-1000Hz)

### Safety Rules

1. **Speed Limits**: Movement speed cannot exceed 5.0 m/s
2. **Power Limits**: Power level cannot exceed 80% for safety
3. **Emergency Priority**: Emergency stop commands bypass validation
4. **Rate Limiting**: Commands are rate-limited to prevent system overload

### Business Rules

1. **Command Sequencing**: Certain commands must be executed in order
2. **System State**: Commands may be rejected based on current system state
3. **Permission Levels**: Commands require appropriate user permissions

## Serialization Formats

### JSON
- Human-readable
- Largest size
- Best for debugging

### MessagePack
- Binary format
- 30-50% smaller than JSON
- Recommended for most commands

### CBOR
- Binary format
- Similar to MessagePack
- Better for numeric data

## Best Practices

1. **Always validate on both client and server**
   - Client validation for immediate feedback
   - Server validation for security

2. **Use appropriate serialization format**
   - MessagePack for general commands
   - CBOR for sensor data
   - JSON for debugging

3. **Implement custom validators for complex rules**
   ```typescript
   validator.registerCustomValidator(
     CommandType.CUSTOM,
     (command) => {
       // Custom validation logic
       return { valid: true };
     }
   );
   ```

4. **Handle validation errors gracefully**
   - Display user-friendly error messages
   - Log detailed errors for debugging
   - Provide suggestions for fixing errors

## Error Handling

### Validation Errors

```typescript
{
  valid: false,
  errors: [
    {
      path: 'parameters.speed',
      message: 'Speed must be between 0.1 and 5.0 m/s'
    }
  ],
  warnings: [
    'Power level above 50% may drain battery quickly'
  ]
}
```

### Serialization Errors

- Invalid data structure
- Unsupported data types
- Compression failures

## Performance Considerations

1. **Validation Caching**: Schemas are cached for performance
2. **Debouncing**: Real-time validation is debounced (300ms default)
3. **Batch Processing**: Validate multiple commands efficiently
4. **Protocol Selection**: Automatic selection based on payload

## Testing

### Unit Tests

```python
# Backend
def test_movement_validation():
    validator = CommandValidator()
    command = {
        'command_type': CommandType.MOVE_FORWARD,
        'parameters': {'distance': 150}  # Exceeds max
    }
    with pytest.raises(ValueError):
        validator.validate_command(command)
```

```typescript
// Frontend
describe('CommandValidator', () => {
  it('should validate movement parameters', () => {
    const result = validator.validateCommand({
      commandType: CommandType.MOVE_FORWARD,
      parameters: { distance: 150 } // Exceeds max
    });
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests

Test the full flow from UI input to backend execution, including:
- Form validation
- Serialization
- Network transmission
- Backend validation
- Command execution

## Security Considerations

1. **Input Sanitization**: All inputs are sanitized before validation
2. **Size Limits**: Payload size limits prevent DoS attacks
3. **Rate Limiting**: Prevents command flooding
4. **Authentication**: Commands require valid authentication tokens
5. **Audit Trail**: All commands are logged for security auditing