"""
Models for API key rotation policies and scheduling
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base

class RotationFrequency(str, Enum):
    """Rotation frequency options"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUALLY = "semi_annually"
    ANNUALLY = "annually"
    CUSTOM = "custom"

class RotationStatus(str, Enum):
    """Rotation job status"""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class NotificationChannel(str, Enum):
    """Notification channels"""
    EMAIL = "email"
    WEBHOOK = "webhook"
    SLACK = "slack"
    SMS = "sms"
    IN_APP = "in_app"

class RotationPolicy(Base):
    """API key rotation policy configuration"""
    __tablename__ = 'rotation_policies'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String)
    
    # Policy configuration
    frequency = Column(SQLEnum(RotationFrequency), default=RotationFrequency.QUARTERLY)
    custom_interval_days = Column(Integer)  # For custom frequency
    
    # Rotation window
    rotation_hour_utc = Column(Integer, default=2)  # 2 AM UTC
    rotation_day_of_week = Column(Integer)  # 0-6 for weekly
    rotation_day_of_month = Column(Integer)  # 1-31 for monthly
    
    # Grace period settings
    grace_period_hours = Column(Integer, default=24)
    overlap_period_hours = Column(Integer, default=48)  # How long both keys are valid
    
    # Notification settings
    notify_days_before = Column(JSON, default=[7, 3, 1])  # Days before rotation to notify
    notification_channels = Column(JSON, default=["email", "in_app"])
    notification_recipients = Column(JSON)  # List of emails/webhooks/etc
    
    # Automation settings
    auto_update_enabled = Column(Boolean, default=False)
    auto_update_config = Column(JSON)  # Config for automated updates
    require_approval = Column(Boolean, default=True)
    approver_roles = Column(JSON, default=["admin"])
    
    # Scope settings
    applies_to_all_keys = Column(Boolean, default=False)
    api_key_tags = Column(JSON)  # Apply to keys with these tags
    excluded_api_keys = Column(JSON)  # List of key IDs to exclude
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    rotation_jobs = relationship("RotationJob", back_populates="policy")
    applied_to_keys = relationship("APIKeyRotationPolicy", back_populates="policy")

class APIKeyRotationPolicy(Base):
    """Link between API keys and rotation policies"""
    __tablename__ = 'api_key_rotation_policies'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    policy_id = Column(String, ForeignKey('rotation_policies.id'))
    
    # Override policy settings for this key
    custom_grace_period = Column(Integer)
    custom_notification_recipients = Column(JSON)
    
    # Status
    is_active = Column(Boolean, default=True)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    api_key = relationship("APIKey")
    policy = relationship("RotationPolicy", back_populates="applied_to_keys")

class RotationJob(Base):
    """Scheduled or executed rotation job"""
    __tablename__ = 'rotation_jobs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    policy_id = Column(String, ForeignKey('rotation_policies.id'))
    
    # Scheduling
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Status
    status = Column(SQLEnum(RotationStatus), default=RotationStatus.SCHEDULED)
    error_message = Column(String)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Affected keys
    target_api_keys = Column(JSON)  # List of API key IDs to rotate
    rotated_keys = Column(JSON)  # Successfully rotated keys
    failed_keys = Column(JSON)  # Failed rotations with reasons
    
    # Execution details
    execution_log = Column(JSON)  # Detailed execution steps
    notifications_sent = Column(JSON)  # Track sent notifications
    
    # Approval if required
    approval_required = Column(Boolean, default=False)
    approved_by = Column(String, ForeignKey('users.id'))
    approved_at = Column(DateTime(timezone=True))
    approval_notes = Column(String)
    
    # Relationships
    policy = relationship("RotationPolicy", back_populates="rotation_jobs")
    notifications = relationship("RotationNotification", back_populates="job")

class RotationNotification(Base):
    """Rotation notification history"""
    __tablename__ = 'rotation_notifications'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String, ForeignKey('rotation_jobs.id'))
    
    # Notification details
    channel = Column(SQLEnum(NotificationChannel))
    recipient = Column(String)  # Email, webhook URL, etc
    
    # Content
    subject = Column(String)
    message = Column(String)
    metadata = Column(JSON)  # Additional data (affected keys, etc)
    
    # Status
    sent_at = Column(DateTime(timezone=True))
    delivered = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))
    error_message = Column(String)
    
    # Response tracking
    response_code = Column(Integer)
    response_body = Column(String)
    
    # Relationships
    job = relationship("RotationJob", back_populates="notifications")

class RotationTemplate(Base):
    """Templates for rotation workflows"""
    __tablename__ = 'rotation_templates'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    
    # Template configuration
    template_type = Column(String)  # email, webhook_payload, etc
    content_template = Column(String)  # Jinja2 or similar template
    
    # Variables available in template
    available_variables = Column(JSON)
    
    # Example usage
    example_output = Column(String)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AutoUpdateConnector(Base):
    """Connectors for automated key updates in external systems"""
    __tablename__ = 'auto_update_connectors'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    
    # Connector type
    connector_type = Column(String)  # kubernetes, vault, aws_secrets, azure_keyvault, etc
    
    # Connection configuration (encrypted)
    connection_config = Column(JSON)  # Encrypted config
    
    # Update configuration
    update_strategy = Column(String)  # replace, blue_green, canary
    rollback_enabled = Column(Boolean, default=True)
    
    # Test configuration
    test_endpoint = Column(String)
    last_test_at = Column(DateTime(timezone=True))
    last_test_success = Column(Boolean)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class RotationMetrics(Base):
    """Metrics for rotation performance and compliance"""
    __tablename__ = 'rotation_metrics'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Time period
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    
    # Rotation metrics
    total_rotations_scheduled = Column(Integer, default=0)
    total_rotations_completed = Column(Integer, default=0)
    total_rotations_failed = Column(Integer, default=0)
    
    # Timing metrics
    average_rotation_time_seconds = Column(Integer)
    max_rotation_time_seconds = Column(Integer)
    min_rotation_time_seconds = Column(Integer)
    
    # Compliance metrics
    rotations_within_policy = Column(Integer, default=0)
    rotations_overdue = Column(Integer, default=0)
    average_days_between_rotations = Column(Integer)
    
    # Notification metrics
    notifications_sent = Column(Integer, default=0)
    notifications_delivered = Column(Integer, default=0)
    notifications_failed = Column(Integer, default=0)
    
    # Auto-update metrics
    auto_updates_attempted = Column(Integer, default=0)
    auto_updates_successful = Column(Integer, default=0)
    auto_updates_failed = Column(Integer, default=0)
    
    # Calculated at
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())