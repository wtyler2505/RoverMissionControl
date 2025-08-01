"""
Base command classes and interfaces for the Command Pattern implementation
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional, List
from enum import Enum, IntEnum
import uuid
import json


class CommandPriority(IntEnum):
    """Command priority levels (higher value = higher priority)"""
    EMERGENCY = 3  # Immediate execution required (e.g., emergency stop)
    HIGH = 2       # High priority operations (e.g., collision avoidance)
    NORMAL = 1     # Standard operations (e.g., movement commands)
    LOW = 0        # Low priority operations (e.g., telemetry requests)


class CommandStatus(Enum):
    """Command execution status"""
    PENDING = "pending"
    QUEUED = "queued"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"
    TIMEOUT = "timeout"
    CANCELLING = "cancelling"  # Command is being cancelled
    ROLLING_BACK = "rolling_back"  # Command effects are being rolled back


class CommandType(Enum):
    """Types of rover commands"""
    # Movement commands
    MOVE_FORWARD = "move_forward"
    MOVE_BACKWARD = "move_backward"
    TURN_LEFT = "turn_left"
    TURN_RIGHT = "turn_right"
    STOP = "stop"
    EMERGENCY_STOP = "emergency_stop"
    
    # Control commands
    SET_SPEED = "set_speed"
    SET_POWER = "set_power"
    RESET = "reset"
    
    # Sensor commands
    READ_SENSOR = "read_sensor"
    CALIBRATE_SENSOR = "calibrate_sensor"
    
    # System commands
    SYSTEM_STATUS = "system_status"
    DIAGNOSTIC = "diagnostic"
    FIRMWARE_UPDATE = "firmware_update"
    
    # Communication commands
    PING = "ping"
    HEARTBEAT = "heartbeat"
    
    # Custom commands
    CUSTOM = "custom"


@dataclass
class CommandMetadata:
    """Metadata associated with a command"""
    source: str  # Who/what issued the command
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    correlation_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    custom_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CommandResult:
    """Result of command execution"""
    success: bool
    command_id: str
    status: CommandStatus
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    execution_time_ms: Optional[float] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "success": self.success,
            "command_id": self.command_id,
            "status": self.status.value,
            "result_data": self.result_data,
            "error_message": self.error_message,
            "error_details": self.error_details,
            "execution_time_ms": self.execution_time_ms,
            "timestamp": self.timestamp.isoformat()
        }


class Command(ABC):
    """
    Abstract base class for all commands following the Command Pattern
    """
    
    def __init__(
        self,
        command_type: CommandType,
        priority: CommandPriority = CommandPriority.NORMAL,
        parameters: Optional[Dict[str, Any]] = None,
        metadata: Optional[CommandMetadata] = None,
        timeout_ms: Optional[int] = None,
        max_retries: int = 0
    ):
        self.id = str(uuid.uuid4())
        self.command_type = command_type
        self.priority = priority
        self.parameters = parameters or {}
        self.metadata = metadata or CommandMetadata(source="unknown")
        self.timeout_ms = timeout_ms or 30000  # Default 30 second timeout
        self.max_retries = max_retries
        
        # Execution state
        self.status = CommandStatus.PENDING
        self.created_at = datetime.utcnow()
        self.queued_at: Optional[datetime] = None
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.retry_count = 0
        self.result: Optional[CommandResult] = None
        
        # Validation
        self._validate_parameters()
    
    @abstractmethod
    async def execute(self) -> CommandResult:
        """
        Execute the command
        Must be implemented by concrete command classes
        """
        pass
    
    @abstractmethod
    def _validate_parameters(self) -> None:
        """
        Validate command parameters
        Should raise ValueError if parameters are invalid
        """
        pass
    
    async def can_execute(self) -> bool:
        """
        Check if command can be executed in current system state
        Override in subclasses for specific preconditions
        """
        return True
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize command to dictionary"""
        return {
            "id": self.id,
            "command_type": self.command_type.value,
            "priority": self.priority.value,
            "parameters": self.parameters,
            "metadata": {
                "source": self.metadata.source,
                "session_id": self.metadata.session_id,
                "user_id": self.metadata.user_id,
                "correlation_id": self.metadata.correlation_id,
                "tags": self.metadata.tags,
                "custom_data": self.metadata.custom_data
            },
            "timeout_ms": self.timeout_ms,
            "max_retries": self.max_retries,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "queued_at": self.queued_at.isoformat() if self.queued_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "retry_count": self.retry_count,
            "result": self.result.to_dict() if self.result else None
        }
    
    def to_json(self) -> str:
        """Serialize command to JSON"""
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Command':
        """Deserialize command from dictionary (must be implemented by subclasses)"""
        raise NotImplementedError("Subclasses must implement from_dict method")
    
    def __str__(self) -> str:
        return f"{self.__class__.__name__}(id={self.id}, type={self.command_type.value}, priority={self.priority.name})"
    
    def __repr__(self) -> str:
        return self.__str__()