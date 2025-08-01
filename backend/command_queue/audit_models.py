"""
Enhanced database models for command history and audit logging
Provides comprehensive tracking, compliance, and analytics capabilities
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


class CommandAuditLog(Base):
    """
    Main audit log table for all command operations
    Designed for compliance, security, and analytics
    """
    __tablename__ = 'command_audit_log'
    
    # Primary identification
    id = Column(Integer, primary_key=True, autoincrement=True)
    audit_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    command_id = Column(String(36), nullable=False, index=True)
    
    # Command details
    command_type = Column(String(50), nullable=False, index=True)
    priority = Column(Integer, nullable=False, index=True)
    status = Column(String(20), nullable=False, index=True)
    
    # Temporal data
    event_timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    command_created_at = Column(DateTime, nullable=False)
    command_queued_at = Column(DateTime)
    command_started_at = Column(DateTime)
    command_completed_at = Column(DateTime)
    
    # Execution details
    execution_time_ms = Column(Float)
    queue_time_ms = Column(Float)
    retry_count = Column(Integer, default=0)
    
    # Actor information (for GDPR compliance)
    user_id = Column(String(128), index=True)  # Pseudonymized user ID
    session_id = Column(String(128), index=True)
    source_ip = Column(String(45))  # Supports IPv6
    source_system = Column(String(100))
    
    # Command data (encrypted in production)
    parameters = Column(JSON)
    result_data = Column(JSON)
    error_details = Column(JSON)
    
    # Metadata
    tags = Column(JSON)
    correlation_id = Column(String(36), index=True)
    parent_command_id = Column(String(36), index=True)
    
    # Compliance fields
    data_classification = Column(String(20), default='internal')  # public, internal, confidential, restricted
    retention_expiry = Column(DateTime)
    gdpr_lawful_basis = Column(String(50))  # consent, contract, legal_obligation, etc.
    
    # Audit trail
    event_type = Column(String(50), nullable=False, index=True)  # created, queued, started, completed, failed, etc.
    event_details = Column(Text)
    
    # Performance optimization indexes
    __table_args__ = (
        Index('idx_command_time_range', 'command_id', 'event_timestamp'),
        Index('idx_user_activity', 'user_id', 'event_timestamp'),
        Index('idx_status_time', 'status', 'event_timestamp'),
        Index('idx_type_priority_time', 'command_type', 'priority', 'event_timestamp'),
        Index('idx_retention', 'retention_expiry'),
    )


class CommandHistory(Base):
    """
    Denormalized view of command execution history for fast queries
    Updated by triggers or background jobs
    """
    __tablename__ = 'command_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    command_id = Column(String(36), unique=True, nullable=False, index=True)
    
    # Command identification
    command_type = Column(String(50), nullable=False, index=True)
    priority = Column(Integer, nullable=False, index=True)
    final_status = Column(String(20), nullable=False, index=True)
    
    # Timing summary
    created_at = Column(DateTime, nullable=False, index=True)
    queued_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Performance metrics
    total_execution_time_ms = Column(Float, index=True)
    queue_wait_time_ms = Column(Float, index=True)
    processing_time_ms = Column(Float, index=True)
    
    # Execution summary
    retry_count = Column(Integer, default=0)
    success = Column(Boolean, nullable=False, index=True)
    error_code = Column(String(50), index=True)
    error_category = Column(String(50), index=True)
    
    # Actor summary
    user_id = Column(String(128), index=True)
    session_id = Column(String(128), index=True)
    source_system = Column(String(100), index=True)
    
    # Data summary (aggregated, not detailed)
    parameter_summary = Column(JSON)  # Key metrics only
    result_summary = Column(JSON)  # Key outcomes only
    
    # Search and analytics
    search_text = Column(Text)  # Full-text searchable field
    tags = Column(JSON)
    
    # Data governance
    data_classification = Column(String(20), index=True)
    retention_expiry = Column(DateTime, index=True)
    
    # Relationships
    audit_logs = relationship("CommandAuditLog", 
                            primaryjoin="CommandHistory.command_id==CommandAuditLog.command_id",
                            foreign_keys=[command_id],
                            viewonly=True)
    
    __table_args__ = (
        Index('idx_history_search', 'search_text'),  # For full-text search
        Index('idx_history_time_range', 'created_at', 'completed_at'),
        Index('idx_history_user_time', 'user_id', 'created_at'),
        Index('idx_history_type_status', 'command_type', 'final_status'),
    )


class CommandMetrics(Base):
    """
    Aggregated metrics for analytics and monitoring
    Pre-calculated for dashboard performance
    """
    __tablename__ = 'command_metrics'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Time bucket
    metric_timestamp = Column(DateTime, nullable=False, index=True)
    metric_interval = Column(String(10), nullable=False)  # minute, hour, day, week, month
    
    # Dimensions
    command_type = Column(String(50), index=True)
    priority = Column(Integer, index=True)
    status = Column(String(20), index=True)
    source_system = Column(String(100), index=True)
    
    # Metrics
    command_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    
    # Performance metrics
    avg_execution_time_ms = Column(Float)
    min_execution_time_ms = Column(Float)
    max_execution_time_ms = Column(Float)
    p95_execution_time_ms = Column(Float)
    p99_execution_time_ms = Column(Float)
    
    avg_queue_time_ms = Column(Float)
    max_queue_time_ms = Column(Float)
    
    # Resource metrics
    avg_cpu_usage = Column(Float)
    avg_memory_usage = Column(Float)
    total_data_transferred_bytes = Column(Integer)
    
    __table_args__ = (
        Index('idx_metrics_time_type', 'metric_timestamp', 'command_type'),
        Index('idx_metrics_interval', 'metric_interval', 'metric_timestamp'),
    )


class UserCommandAccess(Base):
    """
    Track user access to command history for compliance
    Required for GDPR access logs
    """
    __tablename__ = 'user_command_access'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    access_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Access details
    user_id = Column(String(128), nullable=False, index=True)
    accessed_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    access_type = Column(String(20), nullable=False)  # view, export, delete, modify
    
    # What was accessed
    command_ids = Column(JSON)  # List of command IDs accessed
    query_filters = Column(JSON)  # What filters were applied
    export_format = Column(String(20))  # csv, json, excel, pdf
    
    # Compliance tracking
    purpose = Column(String(200))  # Why the access was needed
    legal_basis = Column(String(50))
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    
    # Results
    records_accessed = Column(Integer)
    access_granted = Column(Boolean, default=True)
    denial_reason = Column(String(200))
    
    __table_args__ = (
        Index('idx_access_user_time', 'user_id', 'accessed_at'),
        Index('idx_access_type_time', 'access_type', 'accessed_at'),
    )


class DataRetentionPolicy(Base):
    """
    Define retention policies for different types of commands
    Supports automated deletion for compliance
    """
    __tablename__ = 'data_retention_policies'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    policy_name = Column(String(100), unique=True, nullable=False)
    
    # Criteria
    command_type_pattern = Column(String(100))  # Regex pattern
    priority_levels = Column(JSON)  # List of priority levels
    data_classification = Column(String(20))
    
    # Retention rules
    retention_days = Column(Integer, nullable=False)
    delete_parameters = Column(Boolean, default=True)
    delete_results = Column(Boolean, default=True)
    anonymize_user_data = Column(Boolean, default=True)
    
    # Policy metadata
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(128))
    
    # Compliance
    legal_requirement = Column(String(200))
    approval_reference = Column(String(100))