"""
Pydantic schemas for command history API
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from enum import Enum


class ExportFormat(str, Enum):
    """Supported export formats"""
    CSV = "csv"
    JSON = "json"
    EXCEL = "excel"
    PDF = "pdf"


class SortOrder(str, Enum):
    """Sort order options"""
    ASC = "asc"
    DESC = "desc"


class TimeInterval(str, Enum):
    """Time interval for metrics"""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class CommandHistoryBase(BaseModel):
    """Base schema for command history"""
    command_id: str
    command_type: str
    priority: int
    final_status: str
    created_at: datetime
    queued_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    total_execution_time_ms: Optional[float]
    queue_wait_time_ms: Optional[float]
    processing_time_ms: Optional[float]
    retry_count: int
    success: bool
    error_code: Optional[str]
    error_category: Optional[str]
    user_id: Optional[str]
    session_id: Optional[str]
    source_system: Optional[str]
    parameter_summary: Optional[Dict[str, Any]]
    result_summary: Optional[Dict[str, Any]]
    tags: Optional[List[str]]
    data_classification: Optional[str]
    
    class Config:
        orm_mode = True


class CommandHistoryFilter(BaseModel):
    """Filters for querying command history"""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    command_types: Optional[List[str]] = None
    priorities: Optional[List[int]] = None
    statuses: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None
    session_ids: Optional[List[str]] = None
    min_execution_time_ms: Optional[float] = None
    max_execution_time_ms: Optional[float] = None
    only_errors: bool = False
    error_codes: Optional[List[str]] = None
    search_text: Optional[str] = None
    tags: Optional[List[str]] = None
    limit: Optional[int] = Field(None, le=100000)
    
    @validator('limit')
    def validate_limit(cls, v):
        if v and v > 100000:
            raise ValueError('Export limit cannot exceed 100,000 records')
        return v


class CommandHistoryResponse(BaseModel):
    """Response for command history queries"""
    items: List[CommandHistoryBase]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditLogEntry(BaseModel):
    """Schema for audit log entries"""
    audit_id: str
    command_id: str
    event_type: str
    event_timestamp: datetime
    status: str
    user_id: Optional[str]
    session_id: Optional[str]
    source_ip: Optional[str]
    source_system: Optional[str]
    event_details: Optional[str]
    execution_time_ms: Optional[float]
    retry_count: int
    
    class Config:
        orm_mode = True


class AuditLogResponse(BaseModel):
    """Response for audit log queries"""
    command_id: str
    audit_trail: List[AuditLogEntry]
    total_events: int


class MetricsResponse(BaseModel):
    """Response for metrics queries"""
    metric_timestamp: datetime
    metric_interval: str
    command_type: Optional[str]
    priority: Optional[int]
    status: Optional[str]
    command_count: int
    success_count: int
    failure_count: int
    retry_count: int
    avg_execution_time_ms: Optional[float]
    min_execution_time_ms: Optional[float]
    max_execution_time_ms: Optional[float]
    p95_execution_time_ms: Optional[float]
    p99_execution_time_ms: Optional[float]
    avg_queue_time_ms: Optional[float]
    max_queue_time_ms: Optional[float]
    
    class Config:
        orm_mode = True


class HistoryStatistics(BaseModel):
    """Aggregated statistics for command history"""
    total_commands: int
    successful_commands: int
    failed_commands: int
    avg_execution_time_ms: float
    max_execution_time_ms: float
    min_execution_time_ms: float
    avg_queue_time_ms: float
    total_retries: int
    command_type_distribution: Dict[str, int]
    status_distribution: Dict[str, int]
    time_range_start: Optional[datetime]
    time_range_end: Optional[datetime]


class CommandHistoryExport(BaseModel):
    """Request schema for exporting command history"""
    format: ExportFormat
    filters: CommandHistoryFilter
    columns: List[str] = Field(
        default=[
            "command_id", "command_type", "priority", "final_status",
            "created_at", "completed_at", "total_execution_time_ms",
            "success", "error_code", "user_id", "source_system"
        ]
    )
    include_audit_trail: bool = False
    compress: bool = False
    
    @validator('columns')
    def validate_columns(cls, v):
        allowed_columns = {
            "command_id", "command_type", "priority", "final_status",
            "created_at", "queued_at", "started_at", "completed_at",
            "total_execution_time_ms", "queue_wait_time_ms", "processing_time_ms",
            "retry_count", "success", "error_code", "error_category",
            "user_id", "session_id", "source_system", "parameter_summary",
            "result_summary", "tags", "data_classification"
        }
        invalid_columns = set(v) - allowed_columns
        if invalid_columns:
            raise ValueError(f"Invalid columns: {invalid_columns}")
        return v


class RetentionPolicyCreate(BaseModel):
    """Schema for creating retention policies"""
    policy_name: str
    command_type_pattern: Optional[str] = None
    priority_levels: Optional[List[int]] = None
    data_classification: Optional[str] = None
    retention_days: int = Field(gt=0)
    delete_parameters: bool = True
    delete_results: bool = True
    anonymize_user_data: bool = True
    legal_requirement: Optional[str] = None
    approval_reference: Optional[str] = None


class RetentionPolicyResponse(BaseModel):
    """Response schema for retention policies"""
    id: int
    policy_name: str
    command_type_pattern: Optional[str]
    priority_levels: Optional[List[int]]
    data_classification: Optional[str]
    retention_days: int
    delete_parameters: bool
    delete_results: bool
    anonymize_user_data: bool
    active: bool
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    legal_requirement: Optional[str]
    approval_reference: Optional[str]
    
    class Config:
        orm_mode = True


class UserAccessLog(BaseModel):
    """Schema for user access logs"""
    access_id: str
    user_id: str
    accessed_at: datetime
    access_type: str
    command_ids: List[str]
    query_filters: Dict[str, Any]
    export_format: Optional[str]
    purpose: Optional[str]
    records_accessed: int
    access_granted: bool
    denial_reason: Optional[str]
    
    class Config:
        orm_mode = True


class HistorySearchRequest(BaseModel):
    """Advanced search request for command history"""
    query: str
    search_fields: List[str] = Field(
        default=["command_type", "error_code", "tags", "search_text"]
    )
    use_fuzzy_matching: bool = False
    highlight_results: bool = True
    max_results: int = Field(100, le=1000)