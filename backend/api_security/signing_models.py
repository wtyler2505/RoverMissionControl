"""
Database models for request signing configuration
"""
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import Column, String, Text, JSON, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer
from sqlalchemy.orm import relationship

from ..database import Base


class SigningAlgorithm(str):
    """Supported signing algorithms"""
    HMAC_SHA256 = "HMAC-SHA256"
    HMAC_SHA512 = "HMAC-SHA512"
    RSA_SHA256 = "RSA-SHA256"
    JWT_HS256 = "JWT-HS256"
    JWT_RS256 = "JWT-RS256"
    ECDSA_SHA256 = "ECDSA-SHA256"


class SigningConfiguration(Base):
    """Configuration for API request signing"""
    __tablename__ = 'signing_configurations'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Algorithm configuration
    algorithm = Column(String(20), nullable=False)
    key_size = Column(Integer, default=2048)  # For RSA
    
    # Key management
    public_key = Column(Text)  # For asymmetric algorithms
    private_key_encrypted = Column(Text)  # Encrypted private key
    key_rotation_enabled = Column(Boolean, default=False)
    key_rotation_days = Column(Integer, default=90)
    
    # Signing options
    include_headers = Column(JSON, default=lambda: ["host", "content-type", "content-length"])
    timestamp_tolerance_seconds = Column(Integer, default=300)
    require_nonce = Column(Boolean, default=True)
    require_body_hash = Column(Boolean, default=True)
    
    # JWT specific options
    jwt_expires_in_seconds = Column(Integer, default=300)
    jwt_custom_claims = Column(JSON, default=dict)
    
    # Usage restrictions
    allowed_endpoints = Column(JSON)  # List of endpoint patterns
    blocked_endpoints = Column(JSON)  # List of blocked patterns
    require_secure_transport = Column(Boolean, default=True)
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(36), ForeignKey('users.id'))
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    verification_logs = relationship("SignatureVerificationLog", back_populates="configuration")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "algorithm": self.algorithm,
            "keySize": self.key_size,
            "publicKey": self.public_key,
            "includeHeaders": self.include_headers,
            "timestampToleranceSeconds": self.timestamp_tolerance_seconds,
            "requireNonce": self.require_nonce,
            "requireBodyHash": self.require_body_hash,
            "jwtExpiresInSeconds": self.jwt_expires_in_seconds,
            "jwtCustomClaims": self.jwt_custom_claims,
            "allowedEndpoints": self.allowed_endpoints,
            "blockedEndpoints": self.blocked_endpoints,
            "requireSecureTransport": self.require_secure_transport,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class SignatureVerificationLog(Base):
    """Log of signature verification attempts"""
    __tablename__ = 'signature_verification_logs'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Request details
    api_key_id = Column(String(36), ForeignKey('api_keys.id'))
    configuration_id = Column(String(36), ForeignKey('signing_configurations.id'))
    method = Column(String(10))
    endpoint = Column(String(500))
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    
    # Verification details
    algorithm_used = Column(String(20))
    timestamp_provided = Column(DateTime)
    nonce = Column(String(100))
    signature_provided = Column(Text)
    
    # Result
    is_valid = Column(Boolean, nullable=False)
    error_code = Column(String(50))
    error_message = Column(Text)
    error_details = Column(JSON)
    
    # Performance
    verification_time_ms = Column(Integer)
    
    # Timestamp
    verified_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    api_key = relationship("APIKey")
    configuration = relationship("SigningConfiguration", back_populates="verification_logs")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "apiKeyId": self.api_key_id,
            "configurationId": self.configuration_id,
            "method": self.method,
            "endpoint": self.endpoint,
            "ipAddress": self.ip_address,
            "userAgent": self.user_agent,
            "algorithmUsed": self.algorithm_used,
            "timestampProvided": self.timestamp_provided.isoformat() if self.timestamp_provided else None,
            "nonce": self.nonce,
            "isValid": self.is_valid,
            "errorCode": self.error_code,
            "errorMessage": self.error_message,
            "errorDetails": self.error_details,
            "verificationTimeMs": self.verification_time_ms,
            "verifiedAt": self.verified_at.isoformat() if self.verified_at else None
        }


class SigningSampleCode(Base):
    """Sample code for different languages and algorithms"""
    __tablename__ = 'signing_sample_codes'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Categorization
    language = Column(String(50), nullable=False)  # python, javascript, java, etc.
    algorithm = Column(String(20), nullable=False)
    framework = Column(String(50))  # requests, axios, okhttp, etc.
    
    # Code content
    title = Column(String(200), nullable=False)
    description = Column(Text)
    code = Column(Text, nullable=False)
    dependencies = Column(JSON)  # List of required packages
    
    # Metadata
    version = Column(String(20))
    tested_with = Column(JSON)  # List of tested environments
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "language": self.language,
            "algorithm": self.algorithm,
            "framework": self.framework,
            "title": self.title,
            "description": self.description,
            "code": self.code,
            "dependencies": self.dependencies,
            "version": self.version,
            "testedWith": self.tested_with,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class NonceCache(Base):
    """Cache for preventing replay attacks"""
    __tablename__ = 'nonce_cache'
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    api_key_id = Column(String(36), ForeignKey('api_keys.id'), nullable=False)
    nonce = Column(String(100), nullable=False, unique=True, index=True)
    timestamp = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Indexes for cleanup
    __table_args__ = (
        {'mysql_engine': 'InnoDB'},
    )