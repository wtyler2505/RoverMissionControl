"""
Command Serialization Schemas using Pydantic
Provides comprehensive validation for all command types with support for multiple serialization formats
"""

from typing import Any, Dict, Optional, List, Union, Literal
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator
import json
import msgpack
import cbor2
from abc import ABC, abstractmethod

from .command_base import CommandType, CommandPriority, CommandStatus


# Serialization format enum
class SerializationFormat(str, Enum):
    JSON = "json"
    MESSAGEPACK = "messagepack"
    CBOR = "cbor"


# Base validators for common command parameters
class RangeValidator(BaseModel):
    """Validates numeric values are within range"""
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    
    def validate(self, value: float) -> bool:
        if self.min_value is not None and value < self.min_value:
            return False
        if self.max_value is not None and value > self.max_value:
            return False
        return True


class CommandMetadataSchema(BaseModel):
    """Schema for command metadata"""
    source: str = Field(..., min_length=1, max_length=100)
    session_id: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9-_]+$')
    user_id: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9-_]+$')
    correlation_id: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9-_]+$')
    tags: List[str] = Field(default_factory=list, max_items=20)
    custom_data: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('tags', each_item=True)
    def validate_tag(cls, tag):
        if not isinstance(tag, str) or len(tag) > 50:
            raise ValueError("Tags must be strings with max length 50")
        return tag
    
    @validator('custom_data')
    def validate_custom_data(cls, v):
        # Limit custom data size to prevent abuse
        if len(json.dumps(v)) > 1024:  # 1KB limit
            raise ValueError("Custom data exceeds size limit")
        return v


class CommandResultSchema(BaseModel):
    """Schema for command execution results"""
    success: bool
    command_id: str = Field(..., regex=r'^[a-f0-9-]{36}$')  # UUID format
    status: CommandStatus
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = Field(None, max_length=500)
    error_details: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[float] = Field(None, ge=0)
    timestamp: datetime
    
    class Config:
        use_enum_values = True


# Base command schema with common fields
class BaseCommandSchema(BaseModel):
    """Base schema for all commands"""
    id: str = Field(..., regex=r'^[a-f0-9-]{36}$')
    command_type: CommandType
    priority: CommandPriority = CommandPriority.NORMAL
    metadata: CommandMetadataSchema
    timeout_ms: int = Field(30000, gt=0, le=300000)  # Max 5 minutes
    max_retries: int = Field(0, ge=0, le=10)
    
    # Execution state fields (optional for serialization)
    status: Optional[CommandStatus] = CommandStatus.PENDING
    created_at: Optional[datetime] = None
    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: Optional[int] = 0
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Movement command schemas
class MovementParametersSchema(BaseModel):
    """Parameters for movement commands"""
    distance: Optional[float] = Field(None, gt=0, le=1000)  # meters
    angle: Optional[float] = Field(None, ge=-360, le=360)  # degrees
    duration: Optional[float] = Field(None, gt=0, le=60)  # seconds
    speed: Optional[float] = Field(None, gt=0, le=10)  # m/s
    
    @root_validator
    def validate_movement_params(cls, values):
        # At least one parameter must be specified
        if not any(values.values()):
            raise ValueError("At least one movement parameter must be specified")
        return values


class SpeedParametersSchema(BaseModel):
    """Parameters for speed control commands"""
    speed: float = Field(..., ge=0, le=10)  # m/s
    acceleration: Optional[float] = Field(None, ge=0, le=5)  # m/s²
    
    @validator('speed')
    def validate_safe_speed(cls, v):
        # Additional safety validation
        if v > 5:  # High speed threshold
            # Could check system state here for safety
            pass
        return v


class PowerParametersSchema(BaseModel):
    """Parameters for power control commands"""
    power_level: float = Field(..., ge=0, le=100)  # percentage
    ramp_time: Optional[float] = Field(None, ge=0, le=10)  # seconds


# Sensor command schemas
class SensorParametersSchema(BaseModel):
    """Parameters for sensor commands"""
    sensor_id: str = Field(..., regex=r'^[A-Z0-9_]+$')
    sensor_type: Optional[Literal["temperature", "distance", "camera", "imu", "gps"]] = None
    sample_rate: Optional[float] = Field(None, gt=0, le=1000)  # Hz
    
    @validator('sensor_id')
    def validate_sensor_id(cls, v):
        valid_sensors = ["TEMP_01", "DIST_FRONT", "DIST_REAR", "CAM_MAIN", "IMU_01", "GPS_01"]
        if v not in valid_sensors:
            raise ValueError(f"Invalid sensor ID. Must be one of: {valid_sensors}")
        return v


class CalibrationParametersSchema(BaseModel):
    """Parameters for sensor calibration"""
    sensor_id: str = Field(..., regex=r'^[A-Z0-9_]+$')
    calibration_type: Literal["zero", "span", "full"] = "zero"
    reference_value: Optional[float] = None
    
    @root_validator
    def validate_calibration(cls, values):
        if values.get('calibration_type') in ['span', 'full'] and values.get('reference_value') is None:
            raise ValueError("Reference value required for span/full calibration")
        return values


# System command schemas
class DiagnosticParametersSchema(BaseModel):
    """Parameters for diagnostic commands"""
    subsystem: Optional[Literal["motors", "sensors", "communication", "power", "all"]] = "all"
    verbose: bool = False
    include_logs: bool = False
    log_duration: Optional[int] = Field(None, gt=0, le=3600)  # seconds


class FirmwareUpdateParametersSchema(BaseModel):
    """Parameters for firmware update commands"""
    version: str = Field(..., regex=r'^\d+\.\d+\.\d+$')
    checksum: str = Field(..., regex=r'^[a-f0-9]{64}$')  # SHA-256
    url: Optional[str] = Field(None, regex=r'^https?://.+')
    force: bool = False
    
    @validator('url')
    def validate_secure_url(cls, v):
        if v and not v.startswith('https://'):
            raise ValueError("Firmware updates must use HTTPS")
        return v


# Custom command schema
class CustomCommandParametersSchema(BaseModel):
    """Parameters for custom commands"""
    command_name: str = Field(..., min_length=1, max_length=100)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('parameters')
    def validate_parameters_size(cls, v):
        if len(json.dumps(v)) > 4096:  # 4KB limit
            raise ValueError("Custom parameters exceed size limit")
        return v


# Command-specific schemas mapping
COMMAND_PARAMETER_SCHEMAS = {
    CommandType.MOVE_FORWARD: MovementParametersSchema,
    CommandType.MOVE_BACKWARD: MovementParametersSchema,
    CommandType.TURN_LEFT: MovementParametersSchema,
    CommandType.TURN_RIGHT: MovementParametersSchema,
    CommandType.SET_SPEED: SpeedParametersSchema,
    CommandType.SET_POWER: PowerParametersSchema,
    CommandType.READ_SENSOR: SensorParametersSchema,
    CommandType.CALIBRATE_SENSOR: CalibrationParametersSchema,
    CommandType.DIAGNOSTIC: DiagnosticParametersSchema,
    CommandType.FIRMWARE_UPDATE: FirmwareUpdateParametersSchema,
    CommandType.CUSTOM: CustomCommandParametersSchema,
}


class CommandSchema(BaseCommandSchema):
    """Complete command schema with parameters"""
    parameters: Dict[str, Any] = Field(default_factory=dict)
    
    @root_validator
    def validate_parameters(cls, values):
        """Validate parameters based on command type"""
        command_type = values.get('command_type')
        parameters = values.get('parameters', {})
        
        if command_type in COMMAND_PARAMETER_SCHEMAS:
            schema_class = COMMAND_PARAMETER_SCHEMAS[command_type]
            try:
                # Validate parameters against specific schema
                validated_params = schema_class(**parameters)
                values['parameters'] = validated_params.dict()
            except Exception as e:
                raise ValueError(f"Invalid parameters for {command_type.value}: {str(e)}")
        
        return values


class CommandValidator:
    """
    Main validator class for commands
    Supports business rule validation and safety checks
    """
    
    def __init__(self):
        self.custom_validators = {}
        self.safety_rules = {}
    
    def register_custom_validator(self, command_type: CommandType, validator_func):
        """Register a custom validation function for a command type"""
        self.custom_validators[command_type] = validator_func
    
    def register_safety_rule(self, command_type: CommandType, rule_func):
        """Register a safety rule for a command type"""
        if command_type not in self.safety_rules:
            self.safety_rules[command_type] = []
        self.safety_rules[command_type].append(rule_func)
    
    def validate_command(self, command_data: Dict[str, Any]) -> CommandSchema:
        """
        Validate a command with all registered validators
        
        Returns:
            Validated CommandSchema instance
            
        Raises:
            ValueError: If validation fails
        """
        # Basic schema validation
        command = CommandSchema(**command_data)
        
        # Custom validation
        if command.command_type in self.custom_validators:
            validator = self.custom_validators[command.command_type]
            validator(command)
        
        # Safety rules
        if command.command_type in self.safety_rules:
            for rule in self.safety_rules[command.command_type]:
                if not rule(command):
                    raise ValueError(f"Safety rule violation for {command.command_type.value}")
        
        return command
    
    def validate_batch(self, commands: List[Dict[str, Any]]) -> List[CommandSchema]:
        """Validate multiple commands"""
        validated = []
        errors = []
        
        for idx, cmd in enumerate(commands):
            try:
                validated.append(self.validate_command(cmd))
            except Exception as e:
                errors.append((idx, str(e)))
        
        if errors:
            error_msg = "\n".join([f"Command {idx}: {err}" for idx, err in errors])
            raise ValueError(f"Batch validation failed:\n{error_msg}")
        
        return validated


class CommandSerializer:
    """
    Serializer for commands supporting multiple formats
    """
    
    @staticmethod
    def serialize(command: Union[CommandSchema, Dict[str, Any]], 
                  format: SerializationFormat = SerializationFormat.JSON) -> bytes:
        """
        Serialize a command to bytes
        
        Args:
            command: Command to serialize (schema or dict)
            format: Serialization format
            
        Returns:
            Serialized bytes
        """
        # Convert to dict if needed
        if isinstance(command, BaseModel):
            data = command.dict()
        else:
            data = command
        
        if format == SerializationFormat.JSON:
            return json.dumps(data, default=str).encode('utf-8')
        elif format == SerializationFormat.MESSAGEPACK:
            return msgpack.packb(data, use_bin_type=True)
        elif format == SerializationFormat.CBOR:
            return cbor2.dumps(data)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    @staticmethod
    def deserialize(data: bytes, format: SerializationFormat = SerializationFormat.JSON) -> Dict[str, Any]:
        """
        Deserialize bytes to command dict
        
        Args:
            data: Serialized command bytes
            format: Serialization format
            
        Returns:
            Command dictionary
        """
        if format == SerializationFormat.JSON:
            return json.loads(data.decode('utf-8'))
        elif format == SerializationFormat.MESSAGEPACK:
            return msgpack.unpackb(data, raw=False)
        elif format == SerializationFormat.CBOR:
            return cbor2.loads(data)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    @staticmethod
    def estimate_size(command: Union[CommandSchema, Dict[str, Any]], 
                      format: SerializationFormat = SerializationFormat.JSON) -> int:
        """Estimate serialized size in bytes"""
        try:
            serialized = CommandSerializer.serialize(command, format)
            return len(serialized)
        except:
            # Fallback estimation
            if isinstance(command, BaseModel):
                data = command.dict()
            else:
                data = command
            return len(json.dumps(data, default=str))


# Example safety rules
def emergency_stop_safety_rule(command: CommandSchema) -> bool:
    """Emergency stop should always be allowed"""
    return True


def movement_speed_safety_rule(command: CommandSchema) -> bool:
    """Check movement commands for safe speeds"""
    if command.command_type in [CommandType.MOVE_FORWARD, CommandType.MOVE_BACKWARD]:
        speed = command.parameters.get('speed', 0)
        # Implement actual safety logic here
        return speed <= 5.0  # Max safe speed
    return True


def power_level_safety_rule(command: CommandSchema) -> bool:
    """Check power commands for safe levels"""
    if command.command_type == CommandType.SET_POWER:
        power = command.parameters.get('power_level', 0)
        # Could check system temperature, battery level, etc.
        return power <= 80.0  # Max safe power level
    return True


# Export main classes
__all__ = [
    'SerializationFormat',
    'CommandMetadataSchema',
    'CommandResultSchema',
    'BaseCommandSchema',
    'CommandSchema',
    'CommandValidator',
    'CommandSerializer',
    'MovementParametersSchema',
    'SpeedParametersSchema',
    'PowerParametersSchema',
    'SensorParametersSchema',
    'CalibrationParametersSchema',
    'DiagnosticParametersSchema',
    'FirmwareUpdateParametersSchema',
    'CustomCommandParametersSchema',
]