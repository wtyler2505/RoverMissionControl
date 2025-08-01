"""
Database models for CORS policy management
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, Integer, JSON, ForeignKey, Table, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base

class CORSPolicyType(str, Enum):
    """CORS policy types"""
    GLOBAL = "global"  # Applies to all endpoints
    ENDPOINT = "endpoint"  # Applies to specific endpoint patterns
    API_KEY = "api_key"  # Applies to specific API keys

class CORSPolicy(Base):
    """CORS policy configuration model"""
    __tablename__ = 'cors_policies'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    # Policy type and scope
    policy_type = Column(String, default=CORSPolicyType.GLOBAL)
    endpoint_pattern = Column(String)  # Regex pattern for endpoints
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    priority = Column(Integer, default=0)  # Higher priority overrides lower
    
    # Allowed origins
    allowed_origins = Column(JSON)  # List of allowed origins or patterns
    allow_all_origins = Column(Boolean, default=False)
    
    # Allowed methods
    allowed_methods = Column(JSON)  # List of HTTP methods
    allow_all_methods = Column(Boolean, default=False)
    
    # Allowed headers
    allowed_headers = Column(JSON)  # List of allowed request headers
    allow_all_headers = Column(Boolean, default=False)
    
    # Exposed headers
    expose_headers = Column(JSON)  # List of headers to expose to client
    
    # Credentials
    allow_credentials = Column(Boolean, default=False)
    
    # Preflight cache
    max_age = Column(Integer, default=3600)  # Preflight cache duration in seconds
    
    # Validation
    validate_origin_regex = Column(Boolean, default=False)  # Use regex for origin matching
    case_sensitive_origins = Column(Boolean, default=False)
    
    # Status and metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    updated_by = Column(String, ForeignKey('users.id'))
    
    # Testing
    test_results = Column(JSON)  # Results from last test
    last_tested_at = Column(DateTime(timezone=True))
    
    # Relationships
    api_key = relationship("APIKey", backref="cors_policies")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    violations = relationship("CORSViolation", back_populates="policy", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('policy_type', 'endpoint_pattern', 'api_key_id', 
                        name='_cors_policy_scope_uc'),
    )

class CORSViolation(Base):
    """Track CORS policy violations for security monitoring"""
    __tablename__ = 'cors_violations'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Request details
    origin = Column(String, nullable=False)
    method = Column(String, nullable=False)
    path = Column(String, nullable=False)
    headers = Column(JSON)  # Requested headers
    
    # Violation details
    policy_id = Column(String, ForeignKey('cors_policies.id'))
    violation_type = Column(String)  # origin_not_allowed, method_not_allowed, etc.
    violation_details = Column(JSON)
    
    # Request context
    ip_address = Column(String)
    user_agent = Column(String)
    api_key_id = Column(String, ForeignKey('api_keys.id'))
    user_id = Column(String, ForeignKey('users.id'))
    
    # Response
    was_blocked = Column(Boolean, default=True)
    override_reason = Column(Text)  # If violation was overridden
    
    # Relationships
    policy = relationship("CORSPolicy", back_populates="violations")
    api_key = relationship("APIKey")
    user = relationship("User")

class CORSPreset(Base):
    """Predefined CORS policy templates"""
    __tablename__ = 'cors_presets'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    category = Column(String)  # development, production, api, etc.
    
    # Preset configuration
    configuration = Column(JSON, nullable=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))
    
    # Metadata
    is_system = Column(Boolean, default=False)  # System presets can't be deleted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    @staticmethod
    def get_default_presets():
        """Return default system presets"""
        return [
            {
                "name": "Development - Allow All",
                "description": "Permissive CORS for local development (NOT for production)",
                "category": "development",
                "is_system": True,
                "configuration": {
                    "allowed_origins": ["http://localhost:*", "http://127.0.0.1:*"],
                    "allowed_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                    "allowed_headers": ["*"],
                    "expose_headers": ["*"],
                    "allow_credentials": True,
                    "max_age": 86400
                }
            },
            {
                "name": "Production - Strict",
                "description": "Restrictive CORS for production environments",
                "category": "production",
                "is_system": True,
                "configuration": {
                    "allowed_origins": [],  # Must be explicitly configured
                    "allowed_methods": ["GET", "POST"],
                    "allowed_headers": ["Authorization", "Content-Type"],
                    "expose_headers": ["X-Request-ID"],
                    "allow_credentials": False,
                    "max_age": 3600
                }
            },
            {
                "name": "Public API",
                "description": "Standard CORS for public API endpoints",
                "category": "api",
                "is_system": True,
                "configuration": {
                    "allow_all_origins": True,
                    "allowed_methods": ["GET", "OPTIONS"],
                    "allowed_headers": ["Authorization", "Content-Type", "X-API-Key"],
                    "expose_headers": ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
                    "allow_credentials": False,
                    "max_age": 86400
                }
            },
            {
                "name": "Mobile App",
                "description": "CORS configuration for mobile applications",
                "category": "mobile",
                "is_system": True,
                "configuration": {
                    "allowed_origins": ["capacitor://localhost", "ionic://localhost", "http://localhost"],
                    "allowed_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                    "allowed_headers": ["Authorization", "Content-Type", "X-API-Key"],
                    "expose_headers": ["X-Auth-Token"],
                    "allow_credentials": True,
                    "max_age": 86400
                }
            }
        ]

class CORSAuditLog(Base):
    """Audit log for CORS policy changes"""
    __tablename__ = 'cors_audit_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Action details
    action = Column(String, nullable=False)  # created, updated, deleted, tested
    policy_id = Column(String, ForeignKey('cors_policies.id'))
    policy_name = Column(String)  # Store name in case policy is deleted
    
    # Changes
    old_values = Column(JSON)
    new_values = Column(JSON)
    
    # Actor
    user_id = Column(String, ForeignKey('users.id'))
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Result
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    # Relationships
    user = relationship("User")