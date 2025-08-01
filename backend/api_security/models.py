"""
Database models for API security
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base

# Association table for API key scopes
api_key_scope_association = Table(
    'api_key_scope_association',
    Base.metadata,
    Column('api_key_id', String, ForeignKey('api_keys.id')),
    Column('scope_id', String, ForeignKey('api_key_scopes.id'))
)

class APIKeyStatus(str, Enum):
    """API key status values"""
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    ROTATING = "rotating"  # In process of rotation

class APIKey(Base):
    """API key model for service authentication"""
    __tablename__ = 'api_keys'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)  # Human-readable name
    description = Column(Text)
    
    # Key details
    key_prefix = Column(String, nullable=False)  # Visible prefix (e.g., "rmk_live_")
    key_hash = Column(String, nullable=False)  # Hashed key value
    key_hint = Column(String)  # Last 4 characters for identification
    
    # Ownership and permissions
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    service_name = Column(String)  # If for a specific service
    
    # Status and lifecycle
    status = Column(String, default=APIKeyStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))  # Optional expiration
    last_used_at = Column(DateTime(timezone=True))
    revoked_at = Column(DateTime(timezone=True))
    revoked_by = Column(String, ForeignKey('users.id'))
    revocation_reason = Column(Text)
    
    # Security features
    allowed_ips = Column(JSON)  # List of allowed IP addresses/ranges
    allowed_origins = Column(JSON)  # List of allowed origins
    rate_limit_per_minute = Column(Integer)
    rate_limit_per_hour = Column(Integer)
    rate_limit_per_day = Column(Integer)
    
    # Scopes and permissions
    scopes = relationship("APIKeyScope", secondary=api_key_scope_association, back_populates="api_keys")
    is_read_only = Column(Boolean, default=False)
    can_rotate_self = Column(Boolean, default=False)  # Can rotate its own key
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_error_at = Column(DateTime(timezone=True))
    error_count = Column(Integer, default=0)
    
    # Metadata
    metadata_json = Column(JSON)  # Additional custom metadata
    tags = Column(JSON)  # List of tags for categorization
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="api_keys")
    revoker = relationship("User", foreign_keys=[revoked_by])
    usage_logs = relationship("APIKeyUsage", back_populates="api_key", cascade="all, delete-orphan")
    rotations = relationship("APIKeyRotation", back_populates="api_key", cascade="all, delete-orphan")
    
    def is_valid(self) -> bool:
        """Check if the API key is valid"""
        if self.status != APIKeyStatus.ACTIVE:
            return False
        
        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False
            
        return True
    
    def check_ip_allowed(self, ip: str) -> bool:
        """Check if IP is allowed"""
        if not self.allowed_ips:
            return True
            
        # Implement IP range checking logic
        return ip in self.allowed_ips
    
    def check_origin_allowed(self, origin: str) -> bool:
        """Check if origin is allowed"""
        if not self.allowed_origins:
            return True
            
        return origin in self.allowed_origins

class APIKeyScope(Base):
    """Defines scopes/permissions for API keys"""
    __tablename__ = 'api_key_scopes'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)  # e.g., "telemetry:read"
    description = Column(Text)
    resource = Column(String, nullable=False)  # e.g., "telemetry"
    action = Column(String, nullable=False)  # e.g., "read"
    is_critical = Column(Boolean, default=False)  # Requires additional verification
    
    # Relationships
    api_keys = relationship("APIKey", secondary=api_key_scope_association, back_populates="scopes")

class APIKeyUsage(Base):
    """Track API key usage for analytics and security"""
    __tablename__ = 'api_key_usage'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String, ForeignKey('api_keys.id'), nullable=False)
    
    # Request details
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String)
    user_agent = Column(String)
    origin = Column(String)
    method = Column(String)  # HTTP method
    path = Column(String)  # API endpoint path
    
    # Response details
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    error_message = Column(Text)
    
    # Security tracking
    signature_verified = Column(Boolean, default=False)
    rate_limit_hit = Column(Boolean, default=False)
    suspicious_activity = Column(Boolean, default=False)
    
    # Relationships
    api_key = relationship("APIKey", back_populates="usage_logs")

class APIKeyRotation(Base):
    """Track API key rotation history"""
    __tablename__ = 'api_key_rotations'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String, ForeignKey('api_keys.id'), nullable=False)
    
    # Rotation details
    initiated_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    initiated_by = Column(String, ForeignKey('users.id'))
    
    # Old key details (for audit)
    old_key_hint = Column(String)  # Last 4 chars of old key
    old_key_expires_at = Column(DateTime(timezone=True))  # Grace period expiry
    
    # New key details
    new_key_id = Column(String, ForeignKey('api_keys.id'))
    
    # Status
    status = Column(String)  # pending, completed, failed
    failure_reason = Column(Text)
    
    # Notification tracking
    notifications_sent = Column(JSON)  # List of notification details
    
    # Relationships
    api_key = relationship("APIKey", foreign_keys=[api_key_id], back_populates="rotations")
    new_key = relationship("APIKey", foreign_keys=[new_key_id])
    initiator = relationship("User")

class RateLimitConfig(Base):
    """Rate limiting configuration per endpoint or globally"""
    __tablename__ = 'rate_limit_configs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    # Scope
    endpoint_pattern = Column(String)  # Regex pattern for endpoints
    applies_to_authenticated = Column(Boolean, default=True)
    applies_to_anonymous = Column(Boolean, default=True)
    
    # Limits
    requests_per_minute = Column(Integer)
    requests_per_hour = Column(Integer)
    requests_per_day = Column(Integer)
    burst_size = Column(Integer)  # Allow burst of requests
    
    # Response
    custom_message = Column(Text)
    retry_after_header = Column(Boolean, default=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class APIAuditLog(Base):
    """Detailed audit log for API operations"""
    __tablename__ = 'api_audit_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Request identification
    request_id = Column(String, index=True)
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    user_id = Column(String, ForeignKey('users.id'))
    
    # Request details
    method = Column(String)
    path = Column(String)
    query_params = Column(JSON)
    headers = Column(JSON)  # Sanitized headers
    body_hash = Column(String)  # Hash of request body
    
    # Security details
    ip_address = Column(String)
    geo_location = Column(JSON)  # Optional geo data
    authentication_method = Column(String)  # api_key, jwt, etc.
    signature_valid = Column(Boolean)
    
    # Response details
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    error_type = Column(String)
    error_message = Column(Text)
    
    # Security events
    rate_limit_exceeded = Column(Boolean, default=False)
    suspicious_patterns = Column(JSON)  # List of detected patterns
    blocked_reason = Column(String)
    
    # Data access tracking
    resources_accessed = Column(JSON)  # List of resources
    data_volume_bytes = Column(Integer)
    
    # Relationships
    api_key = relationship("APIKey")
    user = relationship("User")