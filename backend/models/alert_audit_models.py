"""
Database models for Alert Audit Trail System
Supports tamper-evident logging with cryptographic integrity.
"""

from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, JSON, LargeBinary, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import json
import uuid

Base = declarative_base()

class AlertAuditLogModel(Base):
    """Database model for alert audit logs with tamper-evident features"""
    
    __tablename__ = "alert_audit_logs"
    
    # Primary identification
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    
    # Event information
    event_type = Column(String(100), nullable=False)
    actor_id = Column(String(100), nullable=True)
    actor_type = Column(String(50), nullable=False, default="system")
    target_id = Column(String(100), nullable=True)
    target_type = Column(String(50), nullable=True)
    action = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    
    # Audit metadata
    severity = Column(String(20), nullable=False, default="medium")
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)
    
    # Request context
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(100), nullable=True)
    request_id = Column(String(100), nullable=True)
    request_method = Column(String(10), nullable=True)
    request_path = Column(String(500), nullable=True)
    request_origin = Column(String(200), nullable=True)
    
    # State tracking
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    
    # Compliance and data classification
    compliance_frameworks = Column(JSON, nullable=True)  # List of framework strings
    personal_data_involved = Column(Boolean, nullable=False, default=False)
    financial_data_involved = Column(Boolean, nullable=False, default=False)
    health_data_involved = Column(Boolean, nullable=False, default=False)
    
    # Cryptographic integrity
    checksum = Column(String(64), nullable=False)  # SHA-256 hash
    signature = Column(LargeBinary, nullable=True)  # Digital signature
    previous_log_id = Column(String(36), nullable=True)  # Chain reference
    chain_index = Column(Integer, nullable=False, default=0)
    
    # Audit trail metadata
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    # Tags for categorization and searching
    tags = Column(JSON, nullable=True)
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_alert_audit_timestamp', 'timestamp'),
        Index('idx_alert_audit_event_type', 'event_type'),
        Index('idx_alert_audit_actor', 'actor_id', 'actor_type'),
        Index('idx_alert_audit_target', 'target_id', 'target_type'),
        Index('idx_alert_audit_severity', 'severity'),
        Index('idx_alert_audit_success', 'success'),
        Index('idx_alert_audit_chain', 'previous_log_id', 'chain_index'),
        Index('idx_alert_audit_personal_data', 'personal_data_involved'),
        Index('idx_alert_audit_compliance', 'compliance_frameworks'),
        Index('idx_alert_audit_session', 'session_id'),
        Index('idx_alert_audit_request', 'request_id'),
    )


class AlertAuditSnapshot(Base):
    """Encrypted snapshots of data states for audit trails"""
    
    __tablename__ = "alert_audit_snapshots"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    audit_log_id = Column(String(36), nullable=False)  # Reference to audit log
    snapshot_type = Column(String(20), nullable=False)  # 'before' or 'after'
    
    # Entity information
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    
    # Encrypted data
    encrypted_data = Column(LargeBinary, nullable=False)
    encryption_algorithm = Column(String(50), nullable=False, default="AES-256")
    
    # Integrity verification
    checksum = Column(String(64), nullable=False)
    seal_timestamp = Column(DateTime(timezone=True), nullable=False)
    seal_signature = Column(LargeBinary, nullable=True)
    
    # Metadata
    data_size_bytes = Column(Integer, nullable=False)
    compression_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        Index('idx_snapshot_audit_log', 'audit_log_id'),
        Index('idx_snapshot_entity', 'entity_type', 'entity_id'),
        Index('idx_snapshot_version', 'entity_type', 'entity_id', 'version'),
        Index('idx_snapshot_timestamp', 'seal_timestamp'),
    )


class AlertAuditRetentionPolicy(Base):
    """Retention policies for audit logs"""
    
    __tablename__ = "alert_audit_retention_policies"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Policy criteria
    event_type_pattern = Column(String(200), nullable=True)  # Regex pattern
    severity_minimum = Column(String(20), nullable=True)
    compliance_framework = Column(String(50), nullable=True)
    
    # Data type filters
    applies_to_personal_data = Column(Boolean, nullable=False, default=True)
    applies_to_financial_data = Column(Boolean, nullable=False, default=True)
    applies_to_health_data = Column(Boolean, nullable=False, default=True)
    
    # Retention settings
    retention_days = Column(Integer, nullable=False)  # Total retention period
    archive_after_days = Column(Integer, nullable=True)  # When to archive
    delete_after_days = Column(Integer, nullable=True)  # When to delete
    
    # Archive settings
    compress_archived = Column(Boolean, nullable=False, default=True)
    encrypt_archived = Column(Boolean, nullable=False, default=True)
    
    # Policy management
    is_active = Column(Boolean, nullable=False, default=True)
    priority = Column(Integer, nullable=False, default=100)  # Higher = more priority
    legal_hold = Column(Boolean, nullable=False, default=False)  # Prevents deletion
    
    # Audit trail
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    __table_args__ = (
        Index('idx_retention_policy_active', 'is_active'),
        Index('idx_retention_policy_priority', 'priority'),
        Index('idx_retention_policy_framework', 'compliance_framework'),
    )


class AlertAuditExport(Base):
    """Tracking of audit log exports for compliance"""
    
    __tablename__ = "alert_audit_exports"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Export metadata
    exported_by = Column(String(100), nullable=False)
    export_reason = Column(String(500), nullable=False)
    export_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Export criteria
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    event_types = Column(JSON, nullable=True)  # List of event types
    actors = Column(JSON, nullable=True)  # List of actor IDs
    compliance_frameworks = Column(JSON, nullable=True)
    
    # Export details
    format = Column(String(20), nullable=False)  # json, csv, xml, pdf
    compression = Column(String(20), nullable=True)  # gzip, zip
    encryption = Column(String(20), nullable=True)  # aes256
    total_records = Column(Integer, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    
    # Storage information
    storage_type = Column(String(50), nullable=False)  # local, s3, azure
    storage_path = Column(String(1000), nullable=False)
    storage_checksum = Column(String(64), nullable=False)
    
    # Data classification
    includes_personal_data = Column(Boolean, nullable=False, default=False)
    includes_financial_data = Column(Boolean, nullable=False, default=False)
    includes_health_data = Column(Boolean, nullable=False, default=False)
    
    # Approval workflow
    export_approved_by = Column(String(100), nullable=True)
    approval_timestamp = Column(DateTime(timezone=True), nullable=True)
    approval_notes = Column(Text, nullable=True)
    
    # Status tracking
    status = Column(String(20), nullable=False, default="pending")  # pending, completed, failed, expired
    expiry_date = Column(DateTime(timezone=True), nullable=True)  # When export access expires
    access_count = Column(Integer, nullable=False, default=0)  # How many times accessed
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_export_by_user', 'exported_by'),
        Index('idx_export_timestamp', 'export_timestamp'),
        Index('idx_export_status', 'status'),
        Index('idx_export_approval', 'export_approved_by', 'approval_timestamp'),
        Index('idx_export_personal_data', 'includes_personal_data'),
        Index('idx_export_expiry', 'expiry_date'),
    )


class AlertAuditAlert(Base):
    """Alert rules for audit anomalies and compliance violations"""
    
    __tablename__ = "alert_audit_alerts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # Alert conditions
    condition_type = Column(String(50), nullable=False)  # threshold, pattern, anomaly
    event_types = Column(JSON, nullable=True)  # Monitor specific event types
    severity_minimum = Column(String(20), nullable=True)
    
    # Threshold conditions
    threshold_count = Column(Integer, nullable=True)
    threshold_window_minutes = Column(Integer, nullable=True)
    
    # Pattern conditions
    pattern_regex = Column(String(500), nullable=True)
    
    # Anomaly detection
    anomaly_baseline = Column(JSON, nullable=True)
    
    # Monitoring scope
    monitor_actors = Column(JSON, nullable=True)  # Specific actors to monitor
    monitor_targets = Column(JSON, nullable=True)  # Specific targets to monitor
    
    # Alert actions
    notification_channels = Column(JSON, nullable=False)  # List of channels
    notification_recipients = Column(JSON, nullable=False)  # List of recipients
    
    # Auto-response actions
    auto_block_actor = Column(Boolean, nullable=False, default=False)
    auto_revoke_permissions = Column(Boolean, nullable=False, default=False)
    auto_create_incident = Column(Boolean, nullable=False, default=False)
    custom_webhook_url = Column(String(500), nullable=True)
    
    # Alert state
    is_active = Column(Boolean, nullable=False, default=True)
    priority = Column(String(20), nullable=False, default="medium")
    
    # Trigger tracking
    trigger_count = Column(Integer, nullable=False, default=0)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    suppressed_until = Column(DateTime(timezone=True), nullable=True)
    
    # Management
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    __table_args__ = (
        Index('idx_alert_active', 'is_active'),
        Index('idx_alert_priority', 'priority'),
        Index('idx_alert_condition', 'condition_type'),
        Index('idx_alert_triggered', 'last_triggered_at'),
        Index('idx_alert_suppressed', 'suppressed_until'),
    )


class AlertAuditConfiguration(Base):
    """System configuration for audit logging"""
    
    __tablename__ = "alert_audit_configuration"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_key = Column(String(100), nullable=False, unique=True)
    config_value = Column(JSON, nullable=False)
    config_type = Column(String(50), nullable=False)  # string, integer, boolean, json
    description = Column(Text, nullable=True)
    
    # Validation
    validation_regex = Column(String(500), nullable=True)
    min_value = Column(Integer, nullable=True)
    max_value = Column(Integer, nullable=True)
    allowed_values = Column(JSON, nullable=True)
    
    # Security
    is_sensitive = Column(Boolean, nullable=False, default=False)
    requires_encryption = Column(Boolean, nullable=False, default=False)
    
    # Management
    is_system_config = Column(Boolean, nullable=False, default=False)  # System vs user config
    is_editable = Column(Boolean, nullable=False, default=True)
    
    # Change tracking
    version = Column(Integer, nullable=False, default=1)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    __table_args__ = (
        Index('idx_config_key', 'config_key'),
        Index('idx_config_type', 'config_type'),
        Index('idx_config_system', 'is_system_config'),
        Index('idx_config_sensitive', 'is_sensitive'),
    )


class AlertAuditIntegrityCheck(Base):
    """Periodic integrity check results"""
    
    __tablename__ = "alert_audit_integrity_checks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    check_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    check_type = Column(String(50), nullable=False)  # full, incremental, spot_check
    
    # Check scope
    start_log_id = Column(String(36), nullable=True)
    end_log_id = Column(String(36), nullable=True)
    logs_checked = Column(Integer, nullable=False)
    
    # Results
    integrity_status = Column(String(20), nullable=False)  # passed, failed, warning
    checksum_errors = Column(Integer, nullable=False, default=0)
    signature_errors = Column(Integer, nullable=False, default=0)
    chain_errors = Column(Integer, nullable=False, default=0)
    
    # Details
    error_details = Column(JSON, nullable=True)
    warning_details = Column(JSON, nullable=True)
    
    # Performance metrics
    check_duration_seconds = Column(Integer, nullable=False)
    
    # Triggering information
    triggered_by = Column(String(100), nullable=False)
    trigger_reason = Column(String(200), nullable=False)
    
    __table_args__ = (
        Index('idx_integrity_timestamp', 'check_timestamp'),
        Index('idx_integrity_status', 'integrity_status'),
        Index('idx_integrity_type', 'check_type'),
        Index('idx_integrity_triggered_by', 'triggered_by'),
    )


def create_default_retention_policies() -> List[Dict[str, Any]]:
    """Create default retention policies for different compliance frameworks"""
    
    return [
        {
            "name": "GDPR Compliance Policy",
            "description": "7-year retention for GDPR compliance with 1-year archive threshold",
            "compliance_framework": "gdpr",
            "retention_days": 2555,  # 7 years
            "archive_after_days": 365,  # 1 year
            "applies_to_personal_data": True,
            "applies_to_financial_data": False,
            "applies_to_health_data": False,
            "compress_archived": True,
            "encrypt_archived": True,
            "priority": 100
        },
        {
            "name": "CCPA Compliance Policy", 
            "description": "3-year retention for CCPA compliance",
            "compliance_framework": "ccpa",
            "retention_days": 1095,  # 3 years
            "archive_after_days": 365,  # 1 year
            "applies_to_personal_data": True,
            "applies_to_financial_data": False,
            "applies_to_health_data": False,
            "compress_archived": True,
            "encrypt_archived": True,
            "priority": 90
        },
        {
            "name": "HIPAA Compliance Policy",
            "description": "6-year retention for HIPAA compliance",
            "compliance_framework": "hipaa",
            "retention_days": 2190,  # 6 years
            "archive_after_days": 365,  # 1 year
            "applies_to_personal_data": False,
            "applies_to_financial_data": False,
            "applies_to_health_data": True,
            "compress_archived": True,
            "encrypt_archived": True,
            "priority": 95
        },
        {
            "name": "SOX Financial Records Policy",
            "description": "7-year retention for SOX compliance",
            "compliance_framework": "sox",
            "retention_days": 2555,  # 7 years
            "archive_after_days": 365,  # 1 year
            "applies_to_personal_data": False,
            "applies_to_financial_data": True,
            "applies_to_health_data": False,
            "compress_archived": True,
            "encrypt_archived": True,
            "priority": 95
        },
        {
            "name": "Critical Events Policy",
            "description": "10-year retention for critical security events",
            "severity_minimum": "critical",
            "retention_days": 3650,  # 10 years
            "archive_after_days": 365,  # 1 year
            "applies_to_personal_data": True,
            "applies_to_financial_data": True,
            "applies_to_health_data": True,
            "compress_archived": True,
            "encrypt_archived": True,
            "priority": 150,
            "legal_hold": True
        }
    ]


def create_default_alert_rules() -> List[Dict[str, Any]]:
    """Create default alert rules for audit anomalies"""
    
    return [
        {
            "name": "High Volume Failed Access Attempts",
            "description": "Alert when there are many failed access attempts in a short period",
            "condition_type": "threshold",
            "event_types": ["alert_data_accessed"],
            "threshold_count": 10,
            "threshold_window_minutes": 5,
            "notification_channels": ["email", "webhook"],
            "notification_recipients": ["security@company.com"],
            "priority": "high",
            "auto_block_actor": True
        },
        {
            "name": "Integrity Violation Detection",
            "description": "Alert when audit log integrity checks fail",
            "condition_type": "pattern",
            "event_types": ["audit_log_tampered"],
            "pattern_regex": "tamper|integrity|violation",
            "notification_channels": ["email", "sms", "webhook"],
            "notification_recipients": ["security@company.com", "compliance@company.com"],
            "priority": "critical",
            "auto_create_incident": True
        },
        {
            "name": "Unusual Data Export Activity",
            "description": "Alert on large or frequent data exports",
            "condition_type": "threshold",
            "event_types": ["alert_data_exported"],
            "threshold_count": 5,
            "threshold_window_minutes": 60,
            "notification_channels": ["email"],
            "notification_recipients": ["privacy-officer@company.com"],
            "priority": "medium"
        },
        {
            "name": "After-Hours Administrative Activity",
            "description": "Alert on administrative actions outside business hours",
            "condition_type": "pattern",
            "event_types": ["alert_rule_created", "alert_rule_updated", "alert_rule_deleted"],
            "pattern_regex": "admin|configure|delete",
            "notification_channels": ["email"],
            "notification_recipients": ["security@company.com"],
            "priority": "medium"
        },
        {
            "name": "Personal Data Access Monitoring",
            "description": "Monitor all access to personal data for compliance",
            "condition_type": "threshold",
            "event_types": ["alert_data_accessed"],
            "threshold_count": 1,
            "threshold_window_minutes": 1,
            "notification_channels": ["log"],  # Log only, don't spam
            "notification_recipients": ["audit-log@company.com"],
            "priority": "low"
        }
    ]


def create_default_configurations() -> List[Dict[str, Any]]:
    """Create default system configurations"""
    
    return [
        {
            "config_key": "audit_log_retention_days",
            "config_value": 2555,  # 7 years
            "config_type": "integer",
            "description": "Default retention period for audit logs (days)",
            "min_value": 90,  # Minimum 3 months
            "max_value": 3650,  # Maximum 10 years
            "is_system_config": True
        },
        {
            "config_key": "audit_log_archive_threshold_days",
            "config_value": 365,  # 1 year
            "config_type": "integer", 
            "description": "Archive audit logs older than this many days",
            "min_value": 30,
            "max_value": 1825,  # 5 years
            "is_system_config": True
        },
        {
            "config_key": "enable_real_time_integrity_checks",
            "config_value": True,
            "config_type": "boolean",
            "description": "Enable continuous integrity verification of audit logs",
            "is_system_config": True
        },
        {
            "config_key": "max_export_records",
            "config_value": 100000,
            "config_type": "integer",
            "description": "Maximum number of records allowed in a single export",
            "min_value": 1000,
            "max_value": 1000000,
            "is_system_config": True
        },
        {
            "config_key": "export_approval_required",
            "config_value": True,
            "config_type": "boolean",
            "description": "Require approval for audit log exports",
            "is_system_config": True
        },
        {
            "config_key": "encryption_key_rotation_days",
            "config_value": 90,
            "config_type": "integer",
            "description": "Rotate encryption keys every N days",
            "min_value": 30,
            "max_value": 365,
            "is_system_config": True,
            "is_sensitive": True
        },
        {
            "config_key": "audit_notification_emails",
            "config_value": ["security@company.com", "compliance@company.com"],
            "config_type": "json",
            "description": "Default email addresses for audit notifications",
            "is_system_config": False,
            "is_editable": True
        }
    ]