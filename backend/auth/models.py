"""
Database models for authentication system
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Table, Text
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

# Association table for many-to-many relationship between users and roles
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', String, ForeignKey('users.id')),
    Column('role_id', String, ForeignKey('roles.id'))
)

class User(Base):
    """User model with secure authentication fields"""
    __tablename__ = 'users'
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    
    # Profile fields
    full_name = Column(String)
    avatar_url = Column(String)
    
    # Security fields
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    email_verified_at = Column(DateTime)
    
    # 2FA fields
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String)  # Encrypted TOTP secret
    two_factor_backup_codes = Column(Text)  # JSON array of encrypted backup codes
    
    # Password reset fields
    password_reset_token = Column(String)
    password_reset_expires = Column(DateTime)
    
    # Tracking fields
    last_login_at = Column(DateTime)
    last_login_ip = Column(String)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    login_history = relationship("LoginHistory", back_populates="user", cascade="all, delete-orphan")
    
    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role"""
        return any(role.name == role_name for role in self.roles)
    
    def has_any_role(self, role_names: List[str]) -> bool:
        """Check if user has any of the specified roles"""
        return any(self.has_role(role) for role in role_names)

class Role(Base):
    """Role model for RBAC"""
    __tablename__ = 'roles'
    
    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", back_populates="role", cascade="all, delete-orphan")

class Permission(Base):
    """Permission model for fine-grained access control"""
    __tablename__ = 'permissions'
    
    id = Column(String, primary_key=True)
    role_id = Column(String, ForeignKey('roles.id'))
    resource = Column(String, nullable=False)  # e.g., 'rover', 'telemetry', 'users'
    action = Column(String, nullable=False)    # e.g., 'read', 'write', 'delete', 'execute'
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    role = relationship("Role", back_populates="permissions")

class RefreshToken(Base):
    """Refresh token model for secure token rotation"""
    __tablename__ = 'refresh_tokens'
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    token_hash = Column(String, nullable=False, unique=True)  # SHA256 hash of the token
    
    # Token metadata
    device_id = Column(String)  # Optional device fingerprint
    device_name = Column(String)  # e.g., "Chrome on Windows"
    ip_address = Column(String)
    
    # Security fields
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime)
    revoked_reason = Column(String)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
    last_used_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")

class LoginHistory(Base):
    """Login history for audit and security monitoring"""
    __tablename__ = 'login_history'
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    
    # Login details
    login_at = Column(DateTime, server_default=func.now())
    ip_address = Column(String)
    user_agent = Column(String)
    device_fingerprint = Column(String)
    
    # Location data (optional, from IP geolocation)
    country = Column(String)
    city = Column(String)
    
    # Security fields
    login_successful = Column(Boolean, default=True)
    failure_reason = Column(String)  # e.g., 'invalid_password', 'account_locked'
    suspicious_activity_detected = Column(Boolean, default=False)
    suspicious_activity_reason = Column(String)
    
    # Relationships
    user = relationship("User", back_populates="login_history")