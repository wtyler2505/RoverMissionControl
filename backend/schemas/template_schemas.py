"""
Pydantic schemas for command templates
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

from ..command_queue.command_base import CommandPriority


class ParameterType(str, Enum):
    """Supported parameter types"""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    ENUM = "enum"
    DATE = "date"
    ARRAY = "array"
    OBJECT = "object"


class UIComponent(str, Enum):
    """UI component types for parameters"""
    TEXT = "text"
    NUMBER = "number"
    SELECT = "select"
    SLIDER = "slider"
    DATE_PICKER = "date-picker"
    TIME_PICKER = "time-picker"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    TEXTAREA = "textarea"
    COLOR_PICKER = "color-picker"
    FILE_PICKER = "file-picker"


class TemplateParameterCreate(BaseModel):
    """Schema for creating template parameters"""
    name: str = Field(..., min_length=1, max_length=50)
    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    
    # Type and validation
    parameter_type: ParameterType
    default_value: Optional[Any] = None
    required: bool = True
    
    # Constraints
    min_value: Optional[Union[float, int]] = None
    max_value: Optional[Union[float, int]] = None
    enum_values: Optional[List[Any]] = None
    pattern: Optional[str] = None  # Regex pattern
    
    # UI configuration
    ui_component: Optional[UIComponent] = None
    ui_config: Optional[Dict[str, Any]] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    display_order: Optional[int] = 0
    
    @validator('enum_values')
    def validate_enum_values(cls, v, values):
        if values.get('parameter_type') == ParameterType.ENUM and not v:
            raise ValueError("Enum values required for enum type")
        return v
    
    @validator('pattern')
    def validate_pattern(cls, v):
        if v:
            # Validate regex pattern
            import re
            try:
                re.compile(v)
            except re.error:
                raise ValueError("Invalid regex pattern")
        return v
    
    class Config:
        orm_mode = True


class TemplateCreate(BaseModel):
    """Schema for creating a command template"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    command_type: str = Field(..., min_length=1, max_length=50)
    
    # Template configuration
    parameters: Dict[str, Any] = Field(default_factory=dict)
    parameter_schema: Dict[str, Any] = Field(default_factory=dict)
    validation_rules: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # Categorization
    category: str = Field("general", max_length=50)
    tags: List[str] = Field(default_factory=list, max_items=10)
    icon: Optional[str] = Field(None, max_length=50)
    
    # Access control
    is_public: bool = False
    allowed_roles: List[str] = Field(default_factory=list)
    
    # Parameter definitions
    parameter_definitions: Optional[List[TemplateParameterCreate]] = None
    
    @validator('tags', each_item=True)
    def validate_tag(cls, tag):
        if not isinstance(tag, str) or len(tag) > 30:
            raise ValueError("Tags must be strings with max length 30")
        return tag.lower()
    
    @validator('parameters')
    def validate_parameters_size(cls, v):
        if len(str(v)) > 10000:  # 10KB limit
            raise ValueError("Parameters exceed size limit")
        return v


class TemplateUpdate(BaseModel):
    """Schema for updating a template"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    
    # Template configuration
    parameters: Optional[Dict[str, Any]] = None
    parameter_schema: Optional[Dict[str, Any]] = None
    validation_rules: Optional[Dict[str, Any]] = None
    
    # Categorization
    category: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = Field(None, max_items=10)
    icon: Optional[str] = Field(None, max_length=50)
    
    # Access control
    is_public: Optional[bool] = None
    allowed_roles: Optional[List[str]] = None


class TemplateResponse(BaseModel):
    """Response schema for templates"""
    id: str
    name: str
    description: Optional[str]
    command_type: str
    
    # Template configuration
    parameters: Dict[str, Any]
    parameter_schema: Dict[str, Any]
    validation_rules: Dict[str, Any]
    
    # Categorization
    category: str
    tags: List[str]
    icon: Optional[str]
    
    # Access control
    created_by: str
    organization_id: Optional[str]
    is_public: bool
    is_system: bool
    allowed_roles: List[str]
    
    # Version control
    version: int
    parent_template_id: Optional[str]
    is_active: bool
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Usage tracking
    usage_count: int
    last_used_at: Optional[datetime]
    
    # Computed fields
    can_edit: Optional[bool] = False
    can_delete: Optional[bool] = False
    can_share: Optional[bool] = False
    
    class Config:
        orm_mode = True


class TemplateListResponse(BaseModel):
    """Response for template list with pagination"""
    templates: List[TemplateResponse]
    total: int
    page: int
    page_size: int
    pages: int


class TemplateExecuteRequest(BaseModel):
    """Request to execute a template"""
    parameter_values: Dict[str, Any] = Field(default_factory=dict)
    priority: CommandPriority = CommandPriority.NORMAL
    timeout_ms: int = Field(30000, gt=0, le=300000)
    max_retries: int = Field(0, ge=0, le=10)
    tags: List[str] = Field(default_factory=list)
    
    @validator('parameter_values')
    def validate_parameter_values(cls, v):
        if len(str(v)) > 10000:
            raise ValueError("Parameter values exceed size limit")
        return v


class TemplateCategoryCreate(BaseModel):
    """Schema for template categories"""
    name: str = Field(..., min_length=1, max_length=50)
    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, regex=r'^#[0-9A-Fa-f]{6}$')
    parent_category_id: Optional[str] = None
    display_order: int = 0
    allowed_roles: List[str] = Field(default_factory=list)
    
    class Config:
        orm_mode = True


class TemplateShareRequest(BaseModel):
    """Request to share a template"""
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    can_edit: bool = False
    can_share: bool = False
    can_delete: bool = False
    expires_at: Optional[datetime] = None
    
    @validator('expires_at')
    def validate_expiry(cls, v):
        if v and v <= datetime.utcnow():
            raise ValueError("Expiry date must be in the future")
        return v
    
    @root_validator
    def validate_target(cls, values):
        user_id = values.get('user_id')
        org_id = values.get('organization_id')
        if not user_id and not org_id:
            raise ValueError("Either user_id or organization_id must be provided")
        if user_id and org_id:
            raise ValueError("Cannot share with both user and organization")
        return values


class TemplateExportData(BaseModel):
    """Template export format"""
    template: TemplateResponse
    parameter_definitions: List[TemplateParameterCreate]
    export_version: str = "1.0"
    exported_at: datetime
    exported_by: str


class ExecutionHistoryResponse(BaseModel):
    """Template execution history"""
    id: str
    template_id: str
    executed_by: str
    executed_at: datetime
    command_id: str
    final_parameters: Dict[str, Any]
    execution_status: str
    error_message: Optional[str]
    
    class Config:
        orm_mode = True


class TemplateStatistics(BaseModel):
    """Template usage statistics"""
    template_id: str
    total_executions: int
    successful_executions: int
    failed_executions: int
    average_execution_time: Optional[float]
    last_execution: Optional[datetime]
    unique_users: int
    most_common_parameters: Dict[str, Any]