"""
Enhanced RBAC database models with hierarchy and audit support
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
import enum

Base = declarative_base()

class ApprovalStatus(enum.Enum):
    """Status of approval requests"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class AuditAction(enum.Enum):
    """Types of auditable actions"""
    LOGIN = "login"
    LOGOUT = "logout"
    PERMISSION_CHECK = "permission_check"
    PERMISSION_DENIED = "permission_denied"
    ROLE_ASSIGNED = "role_assigned"
    ROLE_REMOVED = "role_removed"
    PERMISSION_GRANTED = "permission_granted"
    PERMISSION_REVOKED = "permission_revoked"
    ELEVATION_REQUESTED = "elevation_requested"
    ELEVATION_APPROVED = "elevation_approved"
    ELEVATION_REJECTED = "elevation_rejected"
    ELEVATION_EXPIRED = "elevation_expired"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_DENIED = "approval_denied"
    RESOURCE_ACCESSED = "resource_accessed"
    RESOURCE_MODIFIED = "resource_modified"
    CRITICAL_ACTION = "critical_action"

class RoleHierarchy(Base):
    """Role hierarchy for permission inheritance"""
    __tablename__ = 'role_hierarchy'
    
    id = Column(String, primary_key=True)
    parent_role_id = Column(String, ForeignKey('roles.id'), nullable=False)
    child_role_id = Column(String, ForeignKey('roles.id'), nullable=False)
    
    # Metadata
    inherit_permissions = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    parent_role = relationship("Role", foreign_keys=[parent_role_id])
    child_role = relationship("Role", foreign_keys=[child_role_id])

class PermissionGroup(Base):
    """Groups of related permissions for easier management"""
    __tablename__ = 'permission_groups'
    
    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    permissions = Column(JSON)  # List of permission strings
    
    # Metadata
    is_system = Column(Boolean, default=False)  # System groups can't be modified
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    roles = relationship("RolePermissionGroup", back_populates="permission_group")

class RolePermissionGroup(Base):
    """Association between roles and permission groups"""
    __tablename__ = 'role_permission_groups'
    
    role_id = Column(String, ForeignKey('roles.id'), primary_key=True)
    permission_group_id = Column(String, ForeignKey('permission_groups.id'), primary_key=True)
    
    # Metadata
    assigned_at = Column(DateTime, server_default=func.now())
    assigned_by = Column(String, ForeignKey('users.id'))
    
    # Relationships
    role = relationship("Role")
    permission_group = relationship("PermissionGroup", back_populates="roles")

class AuditLog(Base):
    """Comprehensive audit logging for all RBAC actions"""
    __tablename__ = 'audit_logs'
    
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    
    # Actor information
    user_id = Column(String, ForeignKey('users.id'), nullable=False, index=True)
    user_roles = Column(JSON)  # Snapshot of user's roles at time of action
    ip_address = Column(String)
    user_agent = Column(String)
    
    # Action details
    action = Column(SQLEnum(AuditAction), nullable=False, index=True)
    resource_type = Column(String)  # e.g., 'rover', 'user', 'mission'
    resource_id = Column(String)
    
    # Permission context
    required_permission = Column(String)  # e.g., 'rover.control:execute'
    had_permission = Column(Boolean)
    elevation_used = Column(Boolean, default=False)
    
    # Additional context
    details = Column(JSON)  # Flexible field for action-specific data
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    # Request tracking
    request_id = Column(String)  # For correlating related actions
    session_id = Column(String)
    
    # Relationships
    user = relationship("User")

class RoleElevation(Base):
    """Temporary role elevation requests and tracking"""
    __tablename__ = 'role_elevations'
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    
    # Elevation details
    requested_role_id = Column(String, ForeignKey('roles.id'), nullable=False)
    reason = Column(Text, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # Requested duration
    
    # Timing
    requested_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
    activated_at = Column(DateTime)
    revoked_at = Column(DateTime)
    
    # Approval
    requires_approval = Column(Boolean, default=True)
    approved_by = Column(String, ForeignKey('users.id'))
    approval_notes = Column(Text)
    
    # Status
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING)
    
    # Security
    max_uses = Column(Integer)  # Limit number of times elevation can be used
    use_count = Column(Integer, default=0)
    restricted_to_resources = Column(JSON)  # List of specific resource IDs
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    requested_role = relationship("Role")
    approver = relationship("User", foreign_keys=[approved_by])

class ApprovalWorkflow(Base):
    """Approval workflows for sensitive actions"""
    __tablename__ = 'approval_workflows'
    
    id = Column(String, primary_key=True)
    
    # Action details
    action_type = Column(String, nullable=False)  # e.g., 'role_assignment', 'critical_operation'
    resource_type = Column(String)
    resource_id = Column(String)
    action_details = Column(JSON)
    
    # Requester
    requested_by = Column(String, ForeignKey('users.id'), nullable=False)
    requested_at = Column(DateTime, server_default=func.now())
    request_reason = Column(Text)
    
    # Approval requirements
    required_approvals = Column(Integer, default=1)
    approver_roles = Column(JSON)  # List of role names that can approve
    
    # Current status
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.PENDING)
    expires_at = Column(DateTime)
    
    # Execution
    executed_at = Column(DateTime)
    executed_by = Column(String, ForeignKey('users.id'))
    execution_result = Column(JSON)
    
    # Relationships
    requester = relationship("User", foreign_keys=[requested_by])
    executor = relationship("User", foreign_keys=[executed_by])
    approvals = relationship("ApprovalDecision", back_populates="workflow")

class ApprovalDecision(Base):
    """Individual approval decisions for workflows"""
    __tablename__ = 'approval_decisions'
    
    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey('approval_workflows.id'), nullable=False)
    
    # Decision details
    approver_id = Column(String, ForeignKey('users.id'), nullable=False)
    decision = Column(SQLEnum(ApprovalStatus), nullable=False)
    decision_at = Column(DateTime, server_default=func.now())
    notes = Column(Text)
    
    # Relationships
    workflow = relationship("ApprovalWorkflow", back_populates="approvals")
    approver = relationship("User")

class ResourceAccessPolicy(Base):
    """Fine-grained access policies for specific resources"""
    __tablename__ = 'resource_access_policies'
    
    id = Column(String, primary_key=True)
    
    # Resource identification
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    
    # Policy details
    policy_type = Column(String)  # e.g., 'time_based', 'location_based', 'approval_required'
    policy_rules = Column(JSON)
    
    # Applicability
    applies_to_roles = Column(JSON)  # List of role IDs
    applies_to_users = Column(JSON)  # List of user IDs
    
    # Validity
    effective_from = Column(DateTime)
    effective_until = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Metadata
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String, ForeignKey('users.id'))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String, ForeignKey('users.id'))