"""
Enhanced audit logging models for API security with compliance support
"""
import uuid
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Text, LargeBinary, Float, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.hybrid import hybrid_property
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from ..database import Base

class AuditCategory(str, Enum):
    """Categories for security audit events"""
    # Authentication & Authorization
    API_KEY = "api_key"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    ACCESS_CONTROL = "access_control"
    
    # API Security
    RATE_LIMIT = "rate_limit"
    CORS = "cors"
    SCHEMA_VALIDATION = "schema_validation"
    REQUEST_SIGNING = "request_signing"
    
    # Data Operations
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    DATA_EXPORT = "data_export"
    DATA_DELETION = "data_deletion"
    
    # Configuration
    CONFIGURATION = "configuration"
    POLICY_CHANGE = "policy_change"
    SECURITY_SETTING = "security_setting"
    
    # System Events
    SYSTEM = "system"
    ERROR = "error"
    SECURITY_ALERT = "security_alert"
    COMPLIANCE = "compliance"

class AuditSeverity(str, Enum):
    """Severity levels for audit events"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ComplianceFramework(str, Enum):
    """Supported compliance frameworks"""
    SOX = "sox"
    PCI_DSS = "pci_dss"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    ISO_27001 = "iso_27001"
    CCPA = "ccpa"

class SecurityAuditLog(Base):
    """Main audit log for all security events with compliance support"""
    __tablename__ = 'security_audit_logs'
    
    # Primary identification
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Event categorization
    category = Column(String, nullable=False, index=True)  # AuditCategory enum
    event_type = Column(String, nullable=False, index=True)  # Specific event within category
    severity = Column(String, default=AuditSeverity.INFO, nullable=False)
    
    # Actor information
    actor_id = Column(String, ForeignKey('users.id'), index=True)
    actor_type = Column(String, nullable=False)  # user, api_key, system
    actor_details = Column(JSON)  # Additional actor context
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    
    # Target information
    target_type = Column(String)  # What was affected
    target_id = Column(String)  # ID of affected resource
    target_details = Column(JSON)  # Additional target context
    
    # Request context
    request_id = Column(String, index=True)
    session_id = Column(String, index=True)
    ip_address = Column(String)
    user_agent = Column(Text)
    request_method = Column(String)
    request_path = Column(String)
    request_origin = Column(String)
    
    # Action details
    action = Column(String, nullable=False)  # What was done
    action_details = Column(JSON)  # Detailed action information
    success = Column(Boolean, default=True, nullable=False)
    error_code = Column(String)
    error_message = Column(Text)
    
    # Security context
    authentication_method = Column(String)
    permission_required = Column(String)
    permission_granted = Column(Boolean)
    elevation_used = Column(Boolean, default=False)
    mfa_verified = Column(Boolean)
    
    # Data changes (encrypted)
    before_snapshot_id = Column(String, ForeignKey('audit_snapshots.id'))
    after_snapshot_id = Column(String, ForeignKey('audit_snapshots.id'))
    data_classification = Column(String)  # public, internal, confidential, restricted
    
    # Compliance metadata
    compliance_frameworks = Column(JSON)  # List of applicable frameworks
    retention_required = Column(Boolean, default=True)
    personal_data_involved = Column(Boolean, default=False)
    financial_data_involved = Column(Boolean, default=False)
    health_data_involved = Column(Boolean, default=False)
    
    # Immutability and integrity
    checksum = Column(String, nullable=False)  # SHA-256 of critical fields
    previous_log_id = Column(String, ForeignKey('security_audit_logs.id'))  # Chain logs
    signature = Column(LargeBinary)  # Digital signature for non-repudiation
    
    # Performance and metadata
    processing_time_ms = Column(Integer)
    data_size_bytes = Column(Integer)
    tags = Column(JSON)  # Additional searchable tags
    
    # Relationships
    actor = relationship("User", foreign_keys=[actor_id])
    api_key = relationship("APIKey")
    before_snapshot = relationship("AuditSnapshot", foreign_keys=[before_snapshot_id])
    after_snapshot = relationship("AuditSnapshot", foreign_keys=[after_snapshot_id])
    previous_log = relationship("SecurityAuditLog", remote_side=[id])
    alerts = relationship("AuditAlert", back_populates="audit_log")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_audit_timestamp_category', timestamp, category),
        Index('idx_audit_actor_timestamp', actor_id, timestamp),
        Index('idx_audit_target', target_type, target_id),
        Index('idx_audit_compliance', compliance_frameworks),
    )
    
    def calculate_checksum(self) -> str:
        """Calculate SHA-256 checksum of critical fields"""
        data = {
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'category': self.category,
            'event_type': self.event_type,
            'actor_id': self.actor_id,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'action': self.action,
            'success': self.success
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.checksum:
            self.checksum = self.calculate_checksum()

class AuditSnapshot(Base):
    """Immutable snapshots of data states for audit trails"""
    __tablename__ = 'audit_snapshots'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Snapshot metadata
    entity_type = Column(String, nullable=False)  # Type of entity snapshotted
    entity_id = Column(String, nullable=False)  # ID of the entity
    version = Column(Integer, nullable=False)  # Version number
    
    # Encrypted data
    encrypted_data = Column(LargeBinary, nullable=False)  # Encrypted JSON data
    encryption_key_id = Column(String, nullable=False)  # Reference to encryption key
    data_hash = Column(String, nullable=False)  # Hash of unencrypted data
    
    # Metadata
    schema_version = Column(String)  # Schema version of the data
    compression_type = Column(String)  # If data is compressed
    size_bytes = Column(Integer, nullable=False)
    
    # Immutability
    is_sealed = Column(Boolean, default=True, nullable=False)
    seal_timestamp = Column(DateTime(timezone=True))
    seal_signature = Column(LargeBinary)
    
    # Compliance
    contains_pii = Column(Boolean, default=False)
    data_classifications = Column(JSON)  # List of data classifications
    
    # Index for lookups
    __table_args__ = (
        UniqueConstraint('entity_type', 'entity_id', 'version', name='uq_entity_version'),
        Index('idx_snapshot_entity', entity_type, entity_id),
    )
    
    @classmethod
    def create_encrypted_snapshot(cls, data: Dict[str, Any], entity_type: str, 
                                entity_id: str, version: int, encryption_key: bytes) -> 'AuditSnapshot':
        """Create an encrypted snapshot of data"""
        # Serialize data
        json_data = json.dumps(data, sort_keys=True)
        data_bytes = json_data.encode('utf-8')
        
        # Calculate hash before encryption
        data_hash = hashlib.sha256(data_bytes).hexdigest()
        
        # Encrypt data
        f = Fernet(encryption_key)
        encrypted_data = f.encrypt(data_bytes)
        
        return cls(
            entity_type=entity_type,
            entity_id=entity_id,
            version=version,
            encrypted_data=encrypted_data,
            encryption_key_id=hashlib.sha256(encryption_key).hexdigest()[:16],
            data_hash=data_hash,
            size_bytes=len(data_bytes)
        )

class AuditRetentionPolicy(Base):
    """Configurable retention policies for audit logs"""
    __tablename__ = 'audit_retention_policies'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    # Retention rules
    category = Column(String)  # AuditCategory to apply to (null = all)
    event_type_pattern = Column(String)  # Regex pattern for event types
    severity_threshold = Column(String)  # Minimum severity to retain
    
    # Retention periods
    retention_days = Column(Integer, nullable=False)  # How long to keep
    archive_after_days = Column(Integer)  # When to move to cold storage
    delete_after_days = Column(Integer)  # When to permanently delete
    
    # Compliance requirements
    compliance_framework = Column(String)  # ComplianceFramework enum
    legal_hold = Column(Boolean, default=False)  # Prevent deletion
    
    # Special handling
    encrypt_archived = Column(Boolean, default=True)
    compress_archived = Column(Boolean, default=True)
    backup_required = Column(Boolean, default=True)
    
    # Conditions
    applies_to_personal_data = Column(Boolean, default=True)
    applies_to_financial_data = Column(Boolean, default=True)
    applies_to_health_data = Column(Boolean, default=True)
    custom_conditions = Column(JSON)  # Additional conditions
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=0)  # Higher priority policies apply first
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    creator = relationship("User")
    
    @classmethod
    def get_compliance_defaults(cls) -> Dict[str, Dict[str, Any]]:
        """Get default retention periods for compliance frameworks"""
        return {
            ComplianceFramework.SOX: {
                'retention_days': 2555,  # 7 years
                'archive_after_days': 365,
                'financial_data': True
            },
            ComplianceFramework.PCI_DSS: {
                'retention_days': 365,  # 1 year minimum
                'archive_after_days': 90,
                'financial_data': True
            },
            ComplianceFramework.GDPR: {
                'retention_days': 1095,  # 3 years typical
                'personal_data': True,
                'delete_after_days': 2190  # 6 years max
            },
            ComplianceFramework.HIPAA: {
                'retention_days': 2190,  # 6 years
                'archive_after_days': 365,
                'health_data': True
            }
        }

class AuditExport(Base):
    """Track audit log exports for compliance and forensics"""
    __tablename__ = 'audit_exports'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Export metadata
    export_timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    exported_by = Column(String, ForeignKey('users.id'), nullable=False)
    export_reason = Column(Text, nullable=False)
    
    # Export parameters
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    categories = Column(JSON)  # List of AuditCategory
    event_types = Column(JSON)  # List of specific event types
    actors = Column(JSON)  # List of actor IDs
    targets = Column(JSON)  # List of target types/IDs
    
    # Export details
    format = Column(String, nullable=False)  # json, csv, xml, syslog
    compression = Column(String)  # gzip, zip, none
    encryption = Column(String)  # aes256, pgp, none
    total_records = Column(Integer, nullable=False)
    file_size_bytes = Column(Integer)
    
    # Storage location
    storage_type = Column(String, nullable=False)  # local, s3, azure, gcp
    storage_path = Column(String, nullable=False)
    storage_checksum = Column(String, nullable=False)
    
    # Compliance metadata
    compliance_frameworks = Column(JSON)  # Frameworks this export satisfies
    includes_personal_data = Column(Boolean, default=False)
    redaction_applied = Column(Boolean, default=False)
    redaction_rules = Column(JSON)  # What was redacted
    
    # Access control
    access_expires_at = Column(DateTime(timezone=True))
    download_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime(timezone=True))
    authorized_users = Column(JSON)  # List of user IDs allowed to access
    
    # Audit trail
    export_approved_by = Column(String, ForeignKey('users.id'))
    approval_timestamp = Column(DateTime(timezone=True))
    approval_reference = Column(String)  # Ticket/request number
    
    # Status
    status = Column(String, nullable=False)  # pending, completed, failed, expired
    error_message = Column(Text)
    
    # Relationships
    exporter = relationship("User", foreign_keys=[exported_by])
    approver = relationship("User", foreign_keys=[export_approved_by])
    
    # Indexes
    __table_args__ = (
        Index('idx_export_date_range', start_date, end_date),
        Index('idx_export_status_timestamp', status, export_timestamp),
    )

class AuditAlert(Base):
    """Configurable alerts for security-relevant audit events"""
    __tablename__ = 'audit_alerts'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    # Alert conditions
    category = Column(String)  # AuditCategory to monitor
    event_types = Column(JSON)  # List of event types to alert on
    severity_threshold = Column(String)  # Minimum severity
    
    # Advanced conditions
    condition_type = Column(String, nullable=False)  # threshold, pattern, anomaly
    threshold_count = Column(Integer)  # Number of events
    threshold_window_minutes = Column(Integer)  # Time window
    pattern_regex = Column(String)  # Pattern to match
    anomaly_baseline = Column(JSON)  # Baseline for anomaly detection
    
    # Specific monitoring
    monitor_actors = Column(JSON)  # Specific actors to monitor
    monitor_targets = Column(JSON)  # Specific targets to monitor
    monitor_actions = Column(JSON)  # Specific actions to monitor
    monitor_ips = Column(JSON)  # IP addresses/ranges to monitor
    
    # Alert actions
    notification_channels = Column(JSON)  # email, slack, webhook, sms
    notification_recipients = Column(JSON)  # List of recipients
    escalation_policy = Column(JSON)  # Escalation rules
    
    # Response actions
    auto_block_actor = Column(Boolean, default=False)
    auto_revoke_permissions = Column(Boolean, default=False)
    auto_create_incident = Column(Boolean, default=False)
    custom_webhook_url = Column(String)
    
    # Alert metadata
    priority = Column(String, nullable=False)  # low, medium, high, critical
    tags = Column(JSON)  # Additional categorization
    
    # Status and control
    is_active = Column(Boolean, default=True, nullable=False)
    last_triggered_at = Column(DateTime(timezone=True))
    trigger_count = Column(Integer, default=0)
    suppressed_until = Column(DateTime(timezone=True))  # Temporary suppression
    
    # Configuration
    cooldown_minutes = Column(Integer, default=5)  # Prevent alert spam
    max_alerts_per_hour = Column(Integer, default=10)
    
    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String, ForeignKey('users.id'), nullable=False)
    
    # Relationships
    creator = relationship("User")
    triggered_logs = relationship("SecurityAuditLog", back_populates="alerts")
    
    # Indexes
    __table_args__ = (
        Index('idx_alert_active_category', is_active, category),
        Index('idx_alert_last_triggered', last_triggered_at),
    )
    
    def should_trigger(self, audit_log: SecurityAuditLog) -> bool:
        """Check if this alert should trigger for the given audit log"""
        # Check if active
        if not self.is_active:
            return False
            
        # Check suppression
        if self.suppressed_until and datetime.now(timezone.utc) < self.suppressed_until:
            return False
            
        # Check cooldown
        if self.last_triggered_at:
            cooldown_end = self.last_triggered_at + timedelta(minutes=self.cooldown_minutes)
            if datetime.now(timezone.utc) < cooldown_end:
                return False
        
        # Check category
        if self.category and audit_log.category != self.category:
            return False
            
        # Check event types
        if self.event_types and audit_log.event_type not in self.event_types:
            return False
            
        # Check severity
        if self.severity_threshold:
            severity_order = [AuditSeverity.INFO, AuditSeverity.WARNING, 
                            AuditSeverity.ERROR, AuditSeverity.CRITICAL]
            log_severity_idx = severity_order.index(audit_log.severity)
            threshold_idx = severity_order.index(self.severity_threshold)
            if log_severity_idx < threshold_idx:
                return False
        
        # Additional condition checks would go here
        
        return True

class AuditLogView(Base):
    """Materialized view for efficient audit log queries"""
    __tablename__ = 'audit_log_views'
    
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    
    # Denormalized fields for fast queries
    category = Column(String, index=True)
    event_type = Column(String, index=True)
    severity = Column(String, index=True)
    actor_name = Column(String, index=True)
    target_name = Column(String)
    action_summary = Column(String)
    
    # Aggregated fields
    day = Column(DateTime(timezone=True), index=True)  # Truncated to day
    hour = Column(DateTime(timezone=True), index=True)  # Truncated to hour
    
    # Search fields
    search_text = Column(Text)  # Concatenated searchable fields
    
    # Statistics
    is_failure = Column(Boolean, index=True)
    is_security_event = Column(Boolean, index=True)
    has_compliance_impact = Column(Boolean, index=True)