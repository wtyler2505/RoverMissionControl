"""
Database models for API versioning and encryption configuration
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, 
    Table, Text, Float, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


# Association tables
version_feature_association = Table(
    'version_feature_association',
    Base.metadata,
    Column('version_id', String, ForeignKey('api_versions.id')),
    Column('feature_id', String, ForeignKey('api_features.id'))
)

encryption_compliance_association = Table(
    'encryption_compliance_association',
    Base.metadata,
    Column('encryption_config_id', String, ForeignKey('encryption_configs.id')),
    Column('compliance_id', String, ForeignKey('compliance_requirements.id'))
)


class VersionStatus(str, Enum):
    """API version lifecycle status"""
    DEVELOPMENT = "development"  # In development, not released
    PREVIEW = "preview"         # Preview/beta release
    ACTIVE = "active"          # Currently active and supported
    DEPRECATED = "deprecated"   # Deprecated but still functional
    RETIRED = "retired"        # No longer available
    SUNSET = "sunset"          # In sunset period before retirement


class VersioningStrategy(str, Enum):
    """API versioning strategy types"""
    URI_PATH = "uri_path"              # /api/v1/resource
    HEADER = "header"                  # API-Version: 1.0
    QUERY_PARAM = "query_param"        # ?version=1.0
    CONTENT_TYPE = "content_type"      # application/vnd.api+json;version=1.0
    CUSTOM = "custom"                  # Custom implementation


class MigrationStatus(str, Enum):
    """Version migration execution status"""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class EncryptionAlgorithm(str, Enum):
    """Supported encryption algorithms"""
    # Symmetric encryption
    AES_256_GCM = "aes_256_gcm"
    AES_256_CBC = "aes_256_cbc"
    AES_128_GCM = "aes_128_gcm"
    CHACHA20_POLY1305 = "chacha20_poly1305"
    
    # Asymmetric encryption
    RSA_2048 = "rsa_2048"
    RSA_4096 = "rsa_4096"
    ECC_P256 = "ecc_p256"
    ECC_P384 = "ecc_p384"
    
    # Key derivation
    PBKDF2 = "pbkdf2"
    ARGON2 = "argon2"
    SCRYPT = "scrypt"


class EncryptionPurpose(str, Enum):
    """Purpose of encryption configuration"""
    IN_TRANSIT = "in_transit"      # TLS/SSL for data in transit
    AT_REST = "at_rest"            # Database/file encryption
    FIELD_LEVEL = "field_level"    # Specific field encryption
    ENVELOPE = "envelope"          # Envelope encryption
    KEY_WRAP = "key_wrap"          # Key wrapping


class KeyType(str, Enum):
    """Types of encryption keys"""
    MASTER = "master"              # Master encryption key
    DATA = "data"                  # Data encryption key
    KEY_ENCRYPTION = "key_encryption"  # Key encryption key
    SIGNING = "signing"            # Digital signature key
    EPHEMERAL = "ephemeral"        # Temporary/session key


class APIVersion(Base):
    """API version model with comprehensive lifecycle management"""
    __tablename__ = 'api_versions'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    version_number = Column(String, unique=True, nullable=False)  # e.g., "1.0.0", "v2"
    semantic_version = Column(String)  # Strict semver format if applicable
    
    # Status and lifecycle
    status = Column(String, default=VersionStatus.DEVELOPMENT)
    release_date = Column(DateTime(timezone=True))
    preview_start_date = Column(DateTime(timezone=True))
    deprecation_date = Column(DateTime(timezone=True))
    sunset_date = Column(DateTime(timezone=True))
    end_of_life_date = Column(DateTime(timezone=True))
    
    # Version details
    description = Column(Text)
    release_notes = Column(Text)
    breaking_changes = Column(JSON)  # List of breaking changes
    migration_guide = Column(Text)   # Markdown migration guide
    documentation_url = Column(String)
    
    # Features and capabilities
    supported_features = relationship(
        "APIFeature", 
        secondary=version_feature_association, 
        back_populates="versions"
    )
    removed_features = Column(JSON)  # Features removed in this version
    new_features = Column(JSON)      # Features added in this version
    
    # Usage statistics
    total_requests = Column(Integer, default=0)
    unique_consumers = Column(Integer, default=0)
    last_request_at = Column(DateTime(timezone=True))
    average_response_time_ms = Column(Float)
    error_rate_percentage = Column(Float)
    
    # Compatibility
    min_client_version = Column(String)  # Minimum client SDK version
    max_client_version = Column(String)  # Maximum client SDK version
    backwards_compatible = Column(Boolean, default=True)
    forward_compatible = Column(Boolean, default=False)
    
    # Performance metrics
    rate_limit_multiplier = Column(Float, default=1.0)  # Rate limit adjustment
    timeout_seconds = Column(Integer, default=30)
    max_payload_size_mb = Column(Integer, default=10)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    strategies = relationship("VersionStrategy", back_populates="version", cascade="all, delete-orphan")
    migrations_from = relationship("VersionMigration", foreign_keys="VersionMigration.source_version_id", back_populates="source_version")
    migrations_to = relationship("VersionMigration", foreign_keys="VersionMigration.target_version_id", back_populates="target_version")
    usage_metrics = relationship("VersionUsageMetrics", back_populates="version", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_api_version_status', 'status'),
        Index('idx_api_version_dates', 'release_date', 'deprecation_date', 'end_of_life_date'),
    )


class APIFeature(Base):
    """Features available in API versions"""
    __tablename__ = 'api_features'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    category = Column(String)  # e.g., "authentication", "data_access", "analytics"
    
    # Feature details
    requires_authentication = Column(Boolean, default=True)
    requires_special_permission = Column(String)  # Permission name if needed
    is_experimental = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    
    # Relationships
    versions = relationship(
        "APIVersion", 
        secondary=version_feature_association, 
        back_populates="supported_features"
    )


class VersionStrategy(Base):
    """Versioning strategy configuration"""
    __tablename__ = 'version_strategies'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    version_id = Column(String, ForeignKey('api_versions.id'), nullable=False)
    
    # Strategy configuration
    strategy_type = Column(String, nullable=False, default=VersioningStrategy.URI_PATH)
    is_primary = Column(Boolean, default=True)  # Primary strategy for this version
    
    # URI-based configuration
    path_pattern = Column(String)  # e.g., "/api/v{version}/*"
    path_prefix = Column(String)   # e.g., "/api/v1"
    
    # Header-based configuration
    header_name = Column(String, default="API-Version")
    header_format = Column(String)  # e.g., "application/vnd.api+json;version={version}"
    
    # Query parameter configuration
    query_param_name = Column(String, default="version")
    
    # Content-type configuration
    content_type_template = Column(String)
    
    # Custom configuration
    custom_config = Column(JSON)
    
    # Validation
    strict_matching = Column(Boolean, default=True)
    allow_version_negotiation = Column(Boolean, default=True)
    default_if_missing = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    version = relationship("APIVersion", back_populates="strategies")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('version_id', 'strategy_type', name='unique_version_strategy'),
    )


class VersionMigration(Base):
    """Track migrations between API versions"""
    __tablename__ = 'version_migrations'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source_version_id = Column(String, ForeignKey('api_versions.id'), nullable=False)
    target_version_id = Column(String, ForeignKey('api_versions.id'), nullable=False)
    
    # Migration details
    migration_type = Column(String)  # "automatic", "assisted", "manual"
    priority = Column(Integer, default=0)  # Higher priority migrations are preferred
    
    # Migration steps and guides
    migration_steps = Column(JSON)  # Ordered list of migration steps
    automated_script = Column(Text)  # Optional automated migration script
    manual_guide = Column(Text)      # Markdown guide for manual migration
    estimated_duration_minutes = Column(Integer)
    
    # Compatibility notes
    compatibility_level = Column(String)  # "full", "partial", "breaking"
    compatibility_notes = Column(Text)
    data_transformation_required = Column(Boolean, default=False)
    schema_changes = Column(JSON)  # List of schema changes
    
    # Execution tracking
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    last_execution_at = Column(DateTime(timezone=True))
    average_execution_time_ms = Column(Float)
    
    # Status
    status = Column(String, default=MigrationStatus.PLANNED)
    is_reversible = Column(Boolean, default=True)
    rollback_steps = Column(JSON)  # Steps to rollback if needed
    
    # Testing and validation
    test_coverage_percentage = Column(Float)
    validation_rules = Column(JSON)  # Rules to validate migration success
    known_issues = Column(JSON)      # List of known issues
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    approved_at = Column(DateTime(timezone=True))
    approved_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    source_version = relationship("APIVersion", foreign_keys=[source_version_id], back_populates="migrations_from")
    target_version = relationship("APIVersion", foreign_keys=[target_version_id], back_populates="migrations_to")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    execution_logs = relationship("MigrationExecutionLog", back_populates="migration", cascade="all, delete-orphan")
    
    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint('source_version_id', 'target_version_id', name='unique_version_migration'),
        Index('idx_migration_status', 'status'),
        CheckConstraint('source_version_id != target_version_id', name='check_different_versions'),
    )


class MigrationExecutionLog(Base):
    """Log of migration execution attempts"""
    __tablename__ = 'migration_execution_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    migration_id = Column(String, ForeignKey('version_migrations.id'), nullable=False)
    
    # Execution details
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    duration_ms = Column(Integer)
    
    # Execution context
    initiated_by = Column(String, ForeignKey('users.id'))
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    client_identifier = Column(String)  # Client app/service identifier
    
    # Results
    status = Column(String)  # "success", "failed", "partial"
    affected_resources = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    warning_count = Column(Integer, default=0)
    
    # Detailed logs
    execution_logs = Column(JSON)  # Detailed step-by-step logs
    error_details = Column(JSON)   # Detailed error information
    rollback_performed = Column(Boolean, default=False)
    rollback_logs = Column(JSON)
    
    # Relationships
    migration = relationship("VersionMigration", back_populates="execution_logs")
    initiator = relationship("User")
    api_key = relationship("APIKey")


class EncryptionConfig(Base):
    """Encryption configuration for different purposes"""
    __tablename__ = 'encryption_configs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    # Encryption settings
    purpose = Column(String, nullable=False)  # EncryptionPurpose enum
    algorithm = Column(String, nullable=False)  # EncryptionAlgorithm enum
    key_size_bits = Column(Integer, nullable=False)
    mode_of_operation = Column(String)  # e.g., "GCM", "CBC", "CTR"
    
    # Key management
    key_derivation_function = Column(String)  # If applicable
    key_rotation_enabled = Column(Boolean, default=True)
    key_rotation_days = Column(Integer, default=90)
    key_versioning_enabled = Column(Boolean, default=True)
    max_key_versions = Column(Integer, default=5)
    
    # In-transit specific settings
    tls_version = Column(String)  # e.g., "1.2", "1.3"
    cipher_suites = Column(JSON)  # List of allowed cipher suites
    certificate_pinning = Column(Boolean, default=False)
    mutual_tls = Column(Boolean, default=False)
    
    # At-rest specific settings
    transparent_encryption = Column(Boolean, default=False)
    field_level_encryption = Column(Boolean, default=False)
    encrypted_fields = Column(JSON)  # List of fields to encrypt
    searchable_encryption = Column(Boolean, default=False)
    
    # Performance settings
    async_encryption = Column(Boolean, default=False)
    compression_before_encryption = Column(Boolean, default=False)
    caching_enabled = Column(Boolean, default=True)
    cache_ttl_seconds = Column(Integer, default=3600)
    
    # Compliance and audit
    compliance_requirements = relationship(
        "ComplianceRequirement",
        secondary=encryption_compliance_association,
        back_populates="encryption_configs"
    )
    audit_logging_enabled = Column(Boolean, default=True)
    key_usage_tracking = Column(Boolean, default=True)
    
    # Hardware security module (HSM) settings
    hsm_enabled = Column(Boolean, default=False)
    hsm_provider = Column(String)  # e.g., "AWS CloudHSM", "Azure Key Vault"
    hsm_config = Column(JSON)      # Provider-specific configuration
    
    # Status and lifecycle
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_rotation_at = Column(DateTime(timezone=True))
    next_rotation_at = Column(DateTime(timezone=True))
    
    # Metadata
    tags = Column(JSON)  # List of tags for categorization
    custom_metadata = Column(JSON)
    
    # Relationships
    encryption_keys = relationship("EncryptionKey", back_populates="config", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_encryption_config_purpose', 'purpose'),
        Index('idx_encryption_config_active', 'is_active'),
        CheckConstraint('key_size_bits >= 128', name='check_min_key_size'),
    )


class EncryptionKey(Base):
    """Encryption keys with lifecycle management"""
    __tablename__ = 'encryption_keys'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    config_id = Column(String, ForeignKey('encryption_configs.id'), nullable=False)
    
    # Key identification
    key_id = Column(String, unique=True, nullable=False)  # External key ID
    key_alias = Column(String)  # Human-friendly alias
    key_version = Column(Integer, default=1)
    
    # Key details
    key_type = Column(String, nullable=False)  # KeyType enum
    algorithm = Column(String, nullable=False)  # Must match config algorithm
    key_size_bits = Column(Integer, nullable=False)
    
    # Key material (encrypted)
    encrypted_key_material = Column(Text)  # Base64 encoded encrypted key
    key_fingerprint = Column(String)       # SHA256 fingerprint
    public_key = Column(Text)              # For asymmetric keys
    
    # Lifecycle
    creation_date = Column(DateTime(timezone=True), server_default=func.now())
    activation_date = Column(DateTime(timezone=True))
    expiration_date = Column(DateTime(timezone=True))
    deletion_date = Column(DateTime(timezone=True))
    last_used_date = Column(DateTime(timezone=True))
    
    # Status
    is_active = Column(Boolean, default=True)
    is_primary = Column(Boolean, default=False)  # Primary key for the config
    is_compromised = Column(Boolean, default=False)
    compromise_date = Column(DateTime(timezone=True))
    compromise_reason = Column(Text)
    
    # Rotation
    rotation_scheduled_date = Column(DateTime(timezone=True))
    rotated_from_key_id = Column(String, ForeignKey('encryption_keys.id'))
    rotation_reason = Column(String)
    auto_rotate = Column(Boolean, default=True)
    
    # Usage metrics
    encryption_count = Column(Integer, default=0)
    decryption_count = Column(Integer, default=0)
    signature_count = Column(Integer, default=0)
    verification_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    last_error_at = Column(DateTime(timezone=True))
    
    # Access control
    allowed_operations = Column(JSON)  # List of allowed operations
    allowed_services = Column(JSON)    # List of services that can use this key
    ip_whitelist = Column(JSON)        # IP addresses allowed to use this key
    
    # HSM integration
    hsm_backed = Column(Boolean, default=False)
    hsm_key_handle = Column(String)    # HSM-specific key identifier
    
    # Metadata
    tags = Column(JSON)
    custom_attributes = Column(JSON)
    created_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    config = relationship("EncryptionConfig", back_populates="encryption_keys")
    rotated_from_key = relationship("EncryptionKey", remote_side=[id])
    creator = relationship("User")
    usage_logs = relationship("EncryptionKeyUsage", back_populates="encryption_key", cascade="all, delete-orphan")
    
    # Indexes and constraints
    __table_args__ = (
        Index('idx_encryption_key_active', 'is_active', 'is_primary'),
        Index('idx_encryption_key_type', 'key_type'),
        Index('idx_encryption_key_expiration', 'expiration_date'),
        UniqueConstraint('config_id', 'key_version', name='unique_config_key_version'),
    )


class EncryptionKeyUsage(Base):
    """Track encryption key usage for audit and analytics"""
    __tablename__ = 'encryption_key_usage'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    key_id = Column(String, ForeignKey('encryption_keys.id'), nullable=False)
    
    # Usage details
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    operation = Column(String)  # "encrypt", "decrypt", "sign", "verify"
    operation_status = Column(String)  # "success", "failed"
    
    # Context
    service_name = Column(String)
    api_endpoint = Column(String)
    user_id = Column(String, ForeignKey('users.id'))
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    
    # Performance
    operation_duration_ms = Column(Integer)
    data_size_bytes = Column(Integer)
    
    # Error tracking
    error_code = Column(String)
    error_message = Column(Text)
    
    # Audit
    ip_address = Column(String)
    user_agent = Column(String)
    request_id = Column(String)
    
    # Relationships
    encryption_key = relationship("EncryptionKey", back_populates="usage_logs")
    user = relationship("User")
    api_key = relationship("APIKey")
    
    # Indexes
    __table_args__ = (
        Index('idx_key_usage_timestamp', 'timestamp'),
        Index('idx_key_usage_key_operation', 'key_id', 'operation'),
    )


class ComplianceRequirement(Base):
    """Compliance requirements for encryption"""
    __tablename__ = 'compliance_requirements'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)  # e.g., "PCI-DSS", "HIPAA", "GDPR"
    description = Column(Text)
    
    # Requirements
    min_key_size_bits = Column(Integer)
    allowed_algorithms = Column(JSON)  # List of allowed algorithms
    required_key_rotation_days = Column(Integer)
    requires_hsm = Column(Boolean, default=False)
    requires_key_escrow = Column(Boolean, default=False)
    
    # Audit requirements
    audit_retention_days = Column(Integer, default=2555)  # 7 years default
    requires_key_usage_logging = Column(Boolean, default=True)
    requires_access_logging = Column(Boolean, default=True)
    
    # Relationships
    encryption_configs = relationship(
        "EncryptionConfig",
        secondary=encryption_compliance_association,
        back_populates="compliance_requirements"
    )


class VersionUsageMetrics(Base):
    """Detailed usage metrics for API versions"""
    __tablename__ = 'version_usage_metrics'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    version_id = Column(String, ForeignKey('api_versions.id'), nullable=False)
    
    # Time window
    metric_date = Column(DateTime(timezone=True), nullable=False)
    metric_hour = Column(Integer)  # 0-23, null for daily metrics
    
    # Request metrics
    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    
    # Performance metrics
    avg_response_time_ms = Column(Float)
    p50_response_time_ms = Column(Float)
    p95_response_time_ms = Column(Float)
    p99_response_time_ms = Column(Float)
    max_response_time_ms = Column(Float)
    
    # Error metrics
    error_4xx_count = Column(Integer, default=0)
    error_5xx_count = Column(Integer, default=0)
    timeout_count = Column(Integer, default=0)
    
    # Usage patterns
    unique_api_keys = Column(Integer, default=0)
    unique_users = Column(Integer, default=0)
    unique_ip_addresses = Column(Integer, default=0)
    
    # Resource utilization
    total_bandwidth_bytes = Column(Integer, default=0)
    avg_request_size_bytes = Column(Float)
    avg_response_size_bytes = Column(Float)
    
    # Feature usage
    feature_usage = Column(JSON)  # Dict of feature_name: usage_count
    endpoint_usage = Column(JSON)  # Dict of endpoint: usage_count
    
    # Geographic distribution
    country_distribution = Column(JSON)  # Dict of country_code: request_count
    
    # Client information
    client_version_distribution = Column(JSON)  # Dict of client_version: count
    user_agent_distribution = Column(JSON)     # Dict of user_agent: count
    
    # Relationships
    version = relationship("APIVersion", back_populates="usage_metrics")
    
    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint('version_id', 'metric_date', 'metric_hour', name='unique_version_metric_window'),
        Index('idx_version_metrics_date', 'version_id', 'metric_date'),
    )