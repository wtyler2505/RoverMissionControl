"""
Batch Command Schemas for validation and serialization

Provides comprehensive validation for batch commands including:
- Batch creation and configuration
- Dependency validation
- Transaction mode validation
- Progress tracking schemas
"""

from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator, root_validator
from enum import Enum

from .command_schemas import CommandSchema, BaseCommandSchema
from .batch_executor import BatchExecutionMode, BatchTransactionMode, BatchStatus
from .command_base import CommandPriority


class BatchDependencyType(str, Enum):
    """Types of dependencies between commands"""
    COMPLETION = "completion"  # Wait for command to complete (any status)
    SUCCESS = "success"        # Wait for command to succeed
    DATA = "data"             # Wait for command to produce specific data
    CONDITIONAL = "conditional" # Execute based on condition


class BatchDependencySchema(BaseModel):
    """Schema for batch command dependencies"""
    from_command_id: str = Field(..., regex=r'^[a-f0-9-]{36}$')
    to_command_id: str = Field(..., regex=r'^[a-f0-9-]{36}$')
    dependency_type: BatchDependencyType = BatchDependencyType.COMPLETION
    condition: Optional[Dict[str, Any]] = None
    
    @root_validator
    def validate_dependency(cls, values):
        # Ensure different command IDs
        if values.get('from_command_id') == values.get('to_command_id'):
            raise ValueError("Command cannot depend on itself")
        
        # Validate condition for conditional dependencies
        if values.get('dependency_type') == BatchDependencyType.CONDITIONAL:
            if not values.get('condition'):
                raise ValueError("Conditional dependency requires a condition")
        
        return values


class BatchMetadataSchema(BaseModel):
    """Extended metadata for batch commands"""
    source: str = Field(..., min_length=1, max_length=100)
    user_id: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9-_]+$')
    session_id: Optional[str] = Field(None, regex=r'^[a-zA-Z0-9-_]+$')
    tags: List[str] = Field(default_factory=list, max_items=50)
    template_id: Optional[str] = None
    template_version: Optional[str] = None
    retry_policy: Optional[Dict[str, Any]] = None
    notification_config: Optional[Dict[str, Any]] = None
    custom_data: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('tags', each_item=True)
    def validate_tag(cls, tag):
        if not isinstance(tag, str) or len(tag) > 50:
            raise ValueError("Tags must be strings with max length 50")
        return tag
    
    @validator('custom_data')
    def validate_custom_data_size(cls, v):
        import json
        if len(json.dumps(v)) > 4096:  # 4KB limit
            raise ValueError("Custom data exceeds size limit")
        return v


class BatchCreateRequestSchema(BaseModel):
    """Schema for batch creation requests"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    commands: List[CommandSchema] = Field(..., min_items=1)
    dependencies: List[BatchDependencySchema] = Field(default_factory=list)
    execution_mode: BatchExecutionMode = BatchExecutionMode.SEQUENTIAL
    transaction_mode: BatchTransactionMode = BatchTransactionMode.BEST_EFFORT
    priority: CommandPriority = CommandPriority.NORMAL
    metadata: BatchMetadataSchema
    
    # Execution options
    parallel_limit: Optional[int] = Field(None, gt=0, le=100)
    timeout_seconds: Optional[int] = Field(None, gt=0, le=3600)
    retry_failed_commands: bool = False
    enable_rollback: bool = True
    
    # Validation options
    validate_before_execution: bool = True
    dry_run: bool = False
    
    @validator('commands')
    def validate_command_count(cls, v):
        if len(v) > 100:  # Max batch size
            raise ValueError("Batch size cannot exceed 100 commands")
        return v
    
    @root_validator
    def validate_batch_config(cls, values):
        commands = values.get('commands', [])
        dependencies = values.get('dependencies', [])
        
        # Validate all dependency references exist
        command_ids = {cmd.id for cmd in commands}
        for dep in dependencies:
            if dep.from_command_id not in command_ids:
                raise ValueError(f"Dependency references non-existent command: {dep.from_command_id}")
            if dep.to_command_id not in command_ids:
                raise ValueError(f"Dependency references non-existent command: {dep.to_command_id}")
        
        # Validate execution mode compatibility
        execution_mode = values.get('execution_mode')
        if execution_mode == BatchExecutionMode.SEQUENTIAL and values.get('parallel_limit'):
            raise ValueError("Parallel limit not applicable for sequential execution")
        
        return values


class BatchProgressSchema(BaseModel):
    """Schema for batch execution progress updates"""
    batch_id: str = Field(..., regex=r'^[a-f0-9-]{36}$')
    status: BatchStatus
    total_commands: int = Field(..., ge=0)
    completed_commands: int = Field(..., ge=0)
    failed_commands: int = Field(..., ge=0)
    current_command_id: Optional[str] = None
    current_command_index: Optional[int] = None
    progress_percentage: float = Field(..., ge=0, le=100)
    estimated_completion_time: Optional[datetime] = None
    elapsed_time_ms: Optional[float] = Field(None, ge=0)
    
    @root_validator
    def validate_progress(cls, values):
        total = values.get('total_commands', 0)
        completed = values.get('completed_commands', 0)
        failed = values.get('failed_commands', 0)
        
        if completed + failed > total:
            raise ValueError("Completed + failed commands cannot exceed total")
        
        # Validate progress percentage
        if total > 0:
            actual_progress = ((completed + failed) / total) * 100
            provided_progress = values.get('progress_percentage', 0)
            if abs(actual_progress - provided_progress) > 0.1:  # Allow small rounding differences
                values['progress_percentage'] = actual_progress
        
        return values


class BatchResultSchema(BaseModel):
    """Schema for batch execution results"""
    batch_id: str = Field(..., regex=r'^[a-f0-9-]{36}$')
    name: str
    status: BatchStatus
    execution_mode: BatchExecutionMode
    transaction_mode: BatchTransactionMode
    
    # Timing
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    execution_time_ms: Optional[float] = Field(None, ge=0)
    
    # Results
    total_commands: int = Field(..., ge=0)
    completed_commands: int = Field(..., ge=0)
    failed_commands: int = Field(..., ge=0)
    command_results: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    
    # Errors and rollback
    error_summary: List[Dict[str, Any]] = Field(default_factory=list)
    rollback_executed: bool = False
    rollback_status: Optional[str] = None
    rollback_results: Optional[List[Dict[str, Any]]] = None
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class BatchTemplateSchema(BaseModel):
    """Schema for batch templates"""
    template_id: str = Field(..., min_length=1, max_length=100, regex=r'^[a-zA-Z0-9-_]+$')
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    version: str = Field("1.0.0", regex=r'^\d+\.\d+\.\d+$')
    
    # Template configuration
    command_templates: List[Dict[str, Any]] = Field(..., min_items=1)
    dependencies: List[BatchDependencySchema] = Field(default_factory=list)
    execution_mode: BatchExecutionMode = BatchExecutionMode.SEQUENTIAL
    transaction_mode: BatchTransactionMode = BatchTransactionMode.BEST_EFFORT
    default_priority: CommandPriority = CommandPriority.NORMAL
    
    # Parameters that can be overridden
    parameters: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    required_parameters: List[str] = Field(default_factory=list)
    
    # Metadata
    author: Optional[str] = None
    tags: List[str] = Field(default_factory=list, max_items=20)
    category: Optional[str] = None
    is_public: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @validator('command_templates')
    def validate_command_templates(cls, v):
        # Ensure each template has required fields
        for template in v:
            if 'command_type' not in template:
                raise ValueError("Command template must have command_type")
            if 'parameters' not in template:
                template['parameters'] = {}
        return v


class BatchOperationRequestSchema(BaseModel):
    """Schema for batch operations (cancel, retry, etc.)"""
    batch_id: str = Field(..., regex=r'^[a-f0-9-]{36}$')
    operation: str = Field(..., regex=r'^(cancel|retry|rollback|pause|resume)$')
    force: bool = False
    reason: Optional[str] = Field(None, max_length=500)
    
    # Operation-specific options
    retry_failed_only: Optional[bool] = None
    rollback_timeout_seconds: Optional[int] = Field(None, gt=0, le=300)


class BatchQuerySchema(BaseModel):
    """Schema for querying batch history"""
    status: Optional[List[BatchStatus]] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    user_id: Optional[str] = None
    tags: Optional[List[str]] = None
    name_contains: Optional[str] = None
    
    # Pagination
    limit: int = Field(100, gt=0, le=1000)
    offset: int = Field(0, ge=0)
    
    # Sorting
    sort_by: str = Field("created_at", regex=r'^(created_at|completed_at|name|status)$')
    sort_order: str = Field("desc", regex=r'^(asc|desc)$')
    
    # Include options
    include_command_results: bool = False
    include_error_details: bool = True


class BatchStatisticsSchema(BaseModel):
    """Schema for batch execution statistics"""
    total_batches: int = Field(..., ge=0)
    completed_batches: int = Field(..., ge=0)
    failed_batches: int = Field(..., ge=0)
    active_batches: int = Field(..., ge=0)
    pending_batches: int = Field(..., ge=0)
    
    # Performance metrics
    average_batch_size: float = Field(..., ge=0)
    average_execution_time_ms: float = Field(..., ge=0)
    success_rate: float = Field(..., ge=0, le=100)
    
    # Time-based metrics
    batches_last_hour: int = Field(..., ge=0)
    batches_last_day: int = Field(..., ge=0)
    peak_concurrent_batches: int = Field(..., ge=0)
    
    # Command-level metrics
    total_commands_executed: int = Field(..., ge=0)
    commands_success_rate: float = Field(..., ge=0, le=100)


class BatchValidator:
    """
    Validator for batch operations with business rules
    """
    
    def __init__(self):
        self.max_batch_size = 100
        self.max_dependency_depth = 10
        self.max_parallel_commands = 50
    
    def validate_batch_create(self, request: BatchCreateRequestSchema) -> BatchCreateRequestSchema:
        """Validate batch creation request"""
        # Additional business rule validation
        self._validate_dependency_graph(request.commands, request.dependencies)
        self._validate_execution_feasibility(request)
        return request
    
    def _validate_dependency_graph(
        self,
        commands: List[CommandSchema],
        dependencies: List[BatchDependencySchema]
    ):
        """Validate dependency graph for cycles and depth"""
        if not dependencies:
            return
        
        # Build adjacency list
        graph = {cmd.id: [] for cmd in commands}
        for dep in dependencies:
            graph[dep.from_command_id].append(dep.to_command_id)
        
        # Check for cycles using DFS
        visited = set()
        rec_stack = set()
        
        def has_cycle(node):
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    if has_cycle(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
            
            rec_stack.remove(node)
            return False
        
        for node in graph:
            if node not in visited:
                if has_cycle(node):
                    raise ValueError("Circular dependencies detected in batch")
        
        # Check dependency depth
        def get_depth(node, memo=None):
            if memo is None:
                memo = {}
            if node in memo:
                return memo[node]
            
            if not graph[node]:
                depth = 0
            else:
                depth = 1 + max(get_depth(child, memo) for child in graph[node])
            
            memo[node] = depth
            return depth
        
        max_depth = max(get_depth(node) for node in graph)
        if max_depth > self.max_dependency_depth:
            raise ValueError(f"Dependency depth {max_depth} exceeds maximum {self.max_dependency_depth}")
    
    def _validate_execution_feasibility(self, request: BatchCreateRequestSchema):
        """Validate if batch execution is feasible"""
        # Check parallel execution limits
        if request.execution_mode == BatchExecutionMode.PARALLEL:
            if len(request.commands) > self.max_parallel_commands:
                raise ValueError(
                    f"Parallel batch size {len(request.commands)} exceeds "
                    f"maximum {self.max_parallel_commands}"
                )
        
        # Validate transaction mode compatibility
        if request.transaction_mode == BatchTransactionMode.ALL_OR_NOTHING:
            # Check if all commands support rollback
            non_reversible = [
                cmd for cmd in request.commands
                if cmd.command_type.value in ['diagnostic', 'read_sensor', 'system_status']
            ]
            if non_reversible and request.enable_rollback:
                raise ValueError(
                    "All-or-nothing transaction mode with rollback enabled "
                    "requires all commands to be reversible"
                )


# Export main classes
__all__ = [
    'BatchDependencyType',
    'BatchDependencySchema',
    'BatchMetadataSchema',
    'BatchCreateRequestSchema',
    'BatchProgressSchema',
    'BatchResultSchema',
    'BatchTemplateSchema',
    'BatchOperationRequestSchema',
    'BatchQuerySchema',
    'BatchStatisticsSchema',
    'BatchValidator'
]