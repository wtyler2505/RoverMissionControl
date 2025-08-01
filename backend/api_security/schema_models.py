"""
Database models for API schema validation and enforcement
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Table, Text, Float, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base

# Association tables
schema_endpoint_association = Table(
    'schema_endpoint_association',
    Base.metadata,
    Column('schema_id', String, ForeignKey('schema_definitions.id')),
    Column('endpoint_mapping_id', String, ForeignKey('schema_endpoint_mappings.id'))
)

schema_validation_rule_association = Table(
    'schema_validation_rule_association',
    Base.metadata,
    Column('schema_id', String, ForeignKey('schema_definitions.id')),
    Column('rule_id', String, ForeignKey('validation_rules.id'))
)

class SchemaType(str, Enum):
    """Types of schema definitions"""
    JSON_SCHEMA = "json_schema"
    OPENAPI = "openapi"
    SWAGGER = "swagger"
    GRAPHQL = "graphql"
    PROTOBUF = "protobuf"
    CUSTOM = "custom"

class SchemaStatus(str, Enum):
    """Schema lifecycle status"""
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    RETIRED = "retired"

class ValidationSeverity(str, Enum):
    """Validation rule severity levels"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

class ValidationRuleType(str, Enum):
    """Types of validation rules"""
    REQUIRED_FIELD = "required_field"
    TYPE_CHECK = "type_check"
    RANGE_CHECK = "range_check"
    PATTERN_MATCH = "pattern_match"
    CUSTOM_FUNCTION = "custom_function"
    BUSINESS_LOGIC = "business_logic"
    SECURITY_CHECK = "security_check"

class SchemaDefinition(Base):
    """Store JSON schemas, OpenAPI specs, and other API schemas"""
    __tablename__ = 'schema_definitions'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # Schema details
    schema_type = Column(String, default=SchemaType.JSON_SCHEMA, nullable=False)
    schema_content = Column(JSON, nullable=False)  # The actual schema definition
    schema_version = Column(String, nullable=False)  # Semantic version (e.g., "1.0.0")
    
    # Metadata
    status = Column(String, default=SchemaStatus.DRAFT, nullable=False)
    created_by = Column(String, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # OpenAPI/Swagger specific
    openapi_version = Column(String)  # e.g., "3.0.0", "2.0"
    base_path = Column(String)  # API base path
    servers = Column(JSON)  # List of server configurations
    
    # Schema registry
    namespace = Column(String)  # For organizing schemas (e.g., "rover", "auth", "telemetry")
    tags = Column(JSON)  # List of tags for categorization
    
    # Import/Export tracking
    imported_from = Column(String)  # File path or URL if imported
    import_timestamp = Column(DateTime(timezone=True))
    export_format = Column(String)  # Preferred export format
    
    # Relationships
    versions = relationship("SchemaVersion", back_populates="schema", cascade="all, delete-orphan")
    validation_rules = relationship(
        "ValidationRule",
        secondary=schema_validation_rule_association,
        back_populates="schemas"
    )
    endpoint_mappings = relationship(
        "SchemaEndpointMapping",
        secondary=schema_endpoint_association,
        back_populates="schemas"
    )
    validation_logs = relationship("ValidationLog", back_populates="schema", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_schema_namespace_name', 'namespace', 'name'),
        Index('idx_schema_status', 'status'),
        UniqueConstraint('namespace', 'name', 'schema_version', name='uq_schema_namespace_name_version')
    )

class ValidationRule(Base):
    """Custom validation rules beyond JSON schema"""
    __tablename__ = 'validation_rules'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # Rule configuration
    rule_type = Column(String, default=ValidationRuleType.CUSTOM_FUNCTION, nullable=False)
    severity = Column(String, default=ValidationSeverity.ERROR, nullable=False)
    
    # Rule definition
    field_path = Column(String)  # JSONPath or dot notation to field
    condition = Column(JSON)  # Rule conditions (e.g., {"min": 0, "max": 100})
    error_message = Column(String, nullable=False)
    error_code = Column(String)  # Standardized error code
    
    # Custom validator
    validator_function = Column(Text)  # Python code for custom validation
    validator_imports = Column(JSON)  # Required imports for custom function
    
    # Rule applicability
    applies_to = Column(String)  # "request", "response", "both"
    http_methods = Column(JSON)  # List of HTTP methods this rule applies to
    
    # Business logic
    business_context = Column(Text)  # Explanation of business rule
    compliance_requirement = Column(String)  # Related compliance (e.g., "PCI DSS 3.2.1")
    
    # Status and lifecycle
    enabled = Column(Boolean, default=True)
    created_by = Column(String, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Performance optimization
    cached = Column(Boolean, default=False)  # Whether to cache validation results
    cache_ttl = Column(Integer)  # Cache time-to-live in seconds
    
    # Relationships
    schemas = relationship(
        "SchemaDefinition",
        secondary=schema_validation_rule_association,
        back_populates="validation_rules"
    )
    
    # Indexes
    __table_args__ = (
        Index('idx_validation_rule_type', 'rule_type'),
        Index('idx_validation_rule_enabled', 'enabled'),
    )

class SchemaVersion(Base):
    """Version control for schemas"""
    __tablename__ = 'schema_versions'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    schema_id = Column(String, ForeignKey('schema_definitions.id'), nullable=False)
    version_number = Column(String, nullable=False)  # Semantic version
    
    # Version details
    change_description = Column(Text, nullable=False)
    breaking_changes = Column(Boolean, default=False)
    migration_guide = Column(Text)  # Instructions for migrating from previous version
    
    # Schema snapshot
    schema_content = Column(JSON, nullable=False)  # Full schema at this version
    
    # Metadata
    created_by = Column(String, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published_at = Column(DateTime(timezone=True))
    deprecated_at = Column(DateTime(timezone=True))
    retired_at = Column(DateTime(timezone=True))
    
    # Compatibility
    compatible_with = Column(JSON)  # List of compatible version ranges
    requires_migration_from = Column(JSON)  # Versions that need migration
    
    # Usage tracking
    active_endpoints = Column(Integer, default=0)  # Number of endpoints using this version
    last_used = Column(DateTime(timezone=True))
    
    # Relationships
    schema = relationship("SchemaDefinition", back_populates="versions")
    
    # Indexes
    __table_args__ = (
        UniqueConstraint('schema_id', 'version_number', name='uq_schema_version'),
        Index('idx_version_created_at', 'created_at'),
    )

class ValidationLog(Base):
    """Track validation failures and patterns"""
    __tablename__ = 'validation_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Request context
    request_id = Column(String, nullable=False)
    endpoint = Column(String, nullable=False)
    http_method = Column(String, nullable=False)
    
    # Validation details
    schema_id = Column(String, ForeignKey('schema_definitions.id'))
    validation_type = Column(String)  # "request", "response"
    validation_result = Column(String)  # "passed", "failed", "warning"
    
    # Error details
    errors = Column(JSON)  # List of validation errors
    error_count = Column(Integer, default=0)
    warning_count = Column(Integer, default=0)
    
    # Request/Response data (for debugging)
    request_headers = Column(JSON)
    request_body = Column(JSON)  # Sanitized to remove sensitive data
    response_status = Column(Integer)
    response_body = Column(JSON)  # Sanitized
    
    # Performance metrics
    validation_duration_ms = Column(Float)  # Time taken to validate
    
    # User and session
    user_id = Column(String, ForeignKey('users.id'))
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Timestamps
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Analytics
    error_pattern = Column(String)  # Categorized error pattern for analytics
    
    # Relationships
    schema = relationship("SchemaDefinition", back_populates="validation_logs")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_validation_log_timestamp', 'timestamp'),
        Index('idx_validation_log_endpoint', 'endpoint'),
        Index('idx_validation_log_result', 'validation_result'),
        Index('idx_validation_log_schema', 'schema_id'),
        Index('idx_validation_log_request_id', 'request_id'),
    )

class SchemaEndpointMapping(Base):
    """Map schemas to API endpoints"""
    __tablename__ = 'schema_endpoint_mappings'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Endpoint details
    endpoint_path = Column(String, nullable=False)  # e.g., "/api/v1/rovers/{id}"
    http_method = Column(String, nullable=False)  # GET, POST, PUT, DELETE, etc.
    
    # Schema assignments
    request_schema_id = Column(String, ForeignKey('schema_definitions.id'))
    response_schema_id = Column(String, ForeignKey('schema_definitions.id'))
    
    # Response variants
    response_schemas_by_status = Column(JSON)  # {"200": "schema_id_1", "400": "schema_id_2"}
    
    # Validation configuration
    validate_request = Column(Boolean, default=True)
    validate_response = Column(Boolean, default=True)
    strict_validation = Column(Boolean, default=False)  # Fail on extra fields
    
    # Version handling
    api_version = Column(String)  # API version this mapping applies to
    schema_version_strategy = Column(String)  # "latest", "specific", "range"
    min_schema_version = Column(String)  # Minimum compatible schema version
    max_schema_version = Column(String)  # Maximum compatible schema version
    
    # Override rules
    validation_overrides = Column(JSON)  # Custom validation rules for this endpoint
    skip_fields = Column(JSON)  # Fields to skip validation
    
    # Status
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String, ForeignKey('users.id'), nullable=False)
    
    # Performance
    cache_validation = Column(Boolean, default=False)
    cache_ttl = Column(Integer, default=300)  # 5 minutes default
    
    # Documentation
    description = Column(Text)
    example_request = Column(JSON)
    example_response = Column(JSON)
    
    # Relationships
    schemas = relationship(
        "SchemaDefinition",
        secondary=schema_endpoint_association,
        back_populates="endpoint_mappings"
    )
    
    # Indexes
    __table_args__ = (
        UniqueConstraint('endpoint_path', 'http_method', 'api_version', name='uq_endpoint_method_version'),
        Index('idx_endpoint_mapping_enabled', 'enabled'),
        Index('idx_endpoint_mapping_path', 'endpoint_path'),
    )

# Additional models for advanced features

class SchemaRegistry(Base):
    """Central registry for schema discovery and management"""
    __tablename__ = 'schema_registry'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    registry_name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    # Registry configuration
    base_url = Column(String)  # For external schema registries
    auth_type = Column(String)  # "none", "basic", "oauth2", "api_key"
    auth_config = Column(JSON)  # Encrypted auth configuration
    
    # Sync settings
    sync_enabled = Column(Boolean, default=False)
    sync_interval_minutes = Column(Integer, default=60)
    last_sync = Column(DateTime(timezone=True))
    sync_status = Column(String)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ValidationMetrics(Base):
    """Aggregated validation metrics for monitoring"""
    __tablename__ = 'validation_metrics'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Time window
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Aggregation level
    endpoint = Column(String)
    schema_id = Column(String, ForeignKey('schema_definitions.id'))
    
    # Metrics
    total_validations = Column(Integer, default=0)
    passed_validations = Column(Integer, default=0)
    failed_validations = Column(Integer, default=0)
    warning_validations = Column(Integer, default=0)
    
    # Performance
    avg_validation_time_ms = Column(Float)
    max_validation_time_ms = Column(Float)
    min_validation_time_ms = Column(Float)
    
    # Common errors
    top_errors = Column(JSON)  # List of most common error patterns
    error_distribution = Column(JSON)  # Error counts by type
    
    # Indexes
    __table_args__ = (
        Index('idx_metrics_period', 'period_start', 'period_end'),
        Index('idx_metrics_endpoint', 'endpoint'),
    )