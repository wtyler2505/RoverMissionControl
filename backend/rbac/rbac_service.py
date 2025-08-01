"""
RBAC Service for managing roles, permissions, and access control
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..auth.models import User, Role, Permission as DBPermission
from .models import (
    RoleHierarchy, PermissionGroup, RolePermissionGroup,
    AuditLog, RoleElevation, ApprovalWorkflow, ApprovalDecision,
    ResourceAccessPolicy, ApprovalStatus, AuditAction
)
from .permissions import Permission, Resource, Action, PermissionSet
from .audit import AuditLogger

class RBACService:
    """Service for managing role-based access control"""
    
    def __init__(self, db: Session, audit_logger: Optional[AuditLogger] = None):
        self.db = db
        self.audit_logger = audit_logger or AuditLogger(db)
        self._permission_cache = {}  # Cache for user permissions
    
    # Role Hierarchy Management
    
    def create_role_hierarchy(
        self,
        parent_role_id: str,
        child_role_id: str,
        created_by: str,
        inherit_permissions: bool = True
    ) -> RoleHierarchy:
        """Create a role hierarchy relationship"""
        # Check for circular dependencies
        if self._would_create_circular_hierarchy(parent_role_id, child_role_id):
            raise ValueError("This would create a circular role hierarchy")
        
        hierarchy = RoleHierarchy(
            id=str(uuid.uuid4()),
            parent_role_id=parent_role_id,
            child_role_id=child_role_id,
            created_by=created_by,
            inherit_permissions=inherit_permissions
        )
        
        self.db.add(hierarchy)
        self.db.commit()
        
        # Clear permission cache
        self._clear_permission_cache()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=created_by,
            action=AuditAction.ROLE_ASSIGNED,
            resource_type="role_hierarchy",
            resource_id=hierarchy.id,
            details={
                "parent_role": parent_role_id,
                "child_role": child_role_id,
                "inherit_permissions": inherit_permissions
            }
        )
        
        return hierarchy
    
    def get_role_ancestors(self, role_id: str) -> List[Role]:
        """Get all ancestor roles in the hierarchy"""
        ancestors = []
        visited = set()
        
        def traverse_ancestors(current_role_id: str):
            if current_role_id in visited:
                return
            visited.add(current_role_id)
            
            hierarchies = self.db.query(RoleHierarchy).filter(
                RoleHierarchy.child_role_id == current_role_id
            ).all()
            
            for hierarchy in hierarchies:
                if hierarchy.inherit_permissions:
                    parent_role = self.db.query(Role).filter(
                        Role.id == hierarchy.parent_role_id
                    ).first()
                    if parent_role:
                        ancestors.append(parent_role)
                        traverse_ancestors(parent_role.id)
        
        traverse_ancestors(role_id)
        return ancestors
    
    def _would_create_circular_hierarchy(self, parent_id: str, child_id: str) -> bool:
        """Check if adding this hierarchy would create a circular dependency"""
        ancestors = self.get_role_ancestors(parent_id)
        return any(role.id == child_id for role in ancestors)
    
    # Permission Management
    
    def get_user_permissions(self, user: User, include_elevated: bool = True) -> PermissionSet:
        """Get all permissions for a user including inherited and elevated"""
        cache_key = f"{user.id}:{include_elevated}"
        
        # Check cache
        if cache_key in self._permission_cache:
            return self._permission_cache[cache_key]
        
        permissions = PermissionSet()
        
        # Get direct role permissions
        for role in user.roles:
            role_permissions = self._get_role_permissions(role)
            permissions = permissions.merge(role_permissions)
        
        # Get elevated permissions if active
        if include_elevated:
            elevated_permissions = self._get_active_elevated_permissions(user.id)
            permissions = permissions.merge(elevated_permissions)
        
        # Cache the result
        self._permission_cache[cache_key] = permissions
        
        return permissions
    
    def _get_role_permissions(self, role: Role) -> PermissionSet:
        """Get all permissions for a role including inherited"""
        permissions = PermissionSet()
        
        # Direct permissions
        for db_perm in role.permissions:
            try:
                perm = Permission.from_string(f"{db_perm.resource}:{db_perm.action}")
                permissions.add(perm)
            except:
                pass  # Skip invalid permissions
        
        # Permission groups
        groups = self.db.query(PermissionGroup).join(
            RolePermissionGroup
        ).filter(
            RolePermissionGroup.role_id == role.id
        ).all()
        
        for group in groups:
            if group.permissions:
                group_perms = PermissionSet.from_list(group.permissions)
                permissions = permissions.merge(group_perms)
        
        # Inherited permissions
        ancestors = self.get_role_ancestors(role.id)
        for ancestor in ancestors:
            ancestor_perms = self._get_direct_role_permissions(ancestor)
            permissions = permissions.merge(ancestor_perms)
        
        return permissions
    
    def _get_direct_role_permissions(self, role: Role) -> PermissionSet:
        """Get only direct permissions for a role (no inheritance)"""
        permissions = PermissionSet()
        
        for db_perm in role.permissions:
            try:
                perm = Permission.from_string(f"{db_perm.resource}:{db_perm.action}")
                permissions.add(perm)
            except:
                pass
        
        return permissions
    
    def check_permission(
        self,
        user: User,
        resource: Resource,
        action: Action,
        resource_id: Optional[str] = None,
        request_context: Optional[Dict] = None
    ) -> Tuple[bool, Optional[str]]:
        """Check if user has permission to perform action on resource"""
        required_permission = Permission(resource, action)
        user_permissions = self.get_user_permissions(user)
        
        # Check basic permission
        has_permission = user_permissions.has_permission(resource, action)
        
        # Check resource-specific policies
        if resource_id and not has_permission:
            has_permission = self._check_resource_policy(
                user, resource, action, resource_id, request_context
            )
        
        # Audit the check
        self.audit_logger.log_action(
            user_id=user.id,
            action=AuditAction.PERMISSION_CHECK if has_permission else AuditAction.PERMISSION_DENIED,
            resource_type=resource.value,
            resource_id=resource_id,
            details={
                "required_permission": str(required_permission),
                "had_permission": has_permission,
                "user_roles": [role.name for role in user.roles]
            },
            success=has_permission
        )
        
        reason = None if has_permission else "Insufficient permissions"
        return has_permission, reason
    
    def _check_resource_policy(
        self,
        user: User,
        resource: Resource,
        action: Action,
        resource_id: str,
        request_context: Optional[Dict]
    ) -> bool:
        """Check resource-specific access policies"""
        policies = self.db.query(ResourceAccessPolicy).filter(
            and_(
                ResourceAccessPolicy.resource_type == resource.value,
                ResourceAccessPolicy.resource_id == resource_id,
                ResourceAccessPolicy.is_active == True
            )
        ).all()
        
        for policy in policies:
            # Check if policy applies to user
            if policy.applies_to_users and user.id not in policy.applies_to_users:
                continue
            
            if policy.applies_to_roles:
                user_role_ids = [role.id for role in user.roles]
                if not any(role_id in policy.applies_to_roles for role_id in user_role_ids):
                    continue
            
            # Check policy rules
            if self._evaluate_policy_rules(policy, user, request_context):
                return True
        
        return False
    
    def _evaluate_policy_rules(
        self,
        policy: ResourceAccessPolicy,
        user: User,
        request_context: Optional[Dict]
    ) -> bool:
        """Evaluate policy rules"""
        if not policy.policy_rules:
            return True
        
        rules = policy.policy_rules
        
        # Time-based rules
        if policy.policy_type == "time_based":
            current_time = datetime.now(timezone.utc)
            if policy.effective_from and current_time < policy.effective_from:
                return False
            if policy.effective_until and current_time > policy.effective_until:
                return False
        
        # Add more policy types as needed
        
        return True
    
    # Role Elevation
    
    def request_role_elevation(
        self,
        user_id: str,
        role_id: str,
        reason: str,
        duration_minutes: int,
        requires_approval: bool = True,
        max_uses: Optional[int] = None,
        restricted_resources: Optional[List[str]] = None
    ) -> RoleElevation:
        """Request temporary role elevation"""
        elevation = RoleElevation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            requested_role_id=role_id,
            reason=reason,
            duration_minutes=duration_minutes,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=duration_minutes),
            requires_approval=requires_approval,
            max_uses=max_uses,
            restricted_to_resources=restricted_resources
        )
        
        if not requires_approval:
            elevation.status = ApprovalStatus.APPROVED
            elevation.activated_at = datetime.now(timezone.utc)
        
        self.db.add(elevation)
        self.db.commit()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=user_id,
            action=AuditAction.ELEVATION_REQUESTED,
            resource_type="role_elevation",
            resource_id=elevation.id,
            details={
                "requested_role": role_id,
                "duration_minutes": duration_minutes,
                "reason": reason
            }
        )
        
        return elevation
    
    def approve_elevation(
        self,
        elevation_id: str,
        approver_id: str,
        notes: Optional[str] = None
    ) -> RoleElevation:
        """Approve a role elevation request"""
        elevation = self.db.query(RoleElevation).filter(
            RoleElevation.id == elevation_id
        ).first()
        
        if not elevation:
            raise ValueError("Elevation request not found")
        
        if elevation.status != ApprovalStatus.PENDING:
            raise ValueError("Elevation request is not pending")
        
        # Check if approver has permission
        approver = self.db.query(User).filter(User.id == approver_id).first()
        if not self.check_permission(approver, Resource.ROLES, Action.APPROVE)[0]:
            raise PermissionError("Approver lacks permission to approve role elevations")
        
        elevation.status = ApprovalStatus.APPROVED
        elevation.approved_by = approver_id
        elevation.approval_notes = notes
        elevation.activated_at = datetime.now(timezone.utc)
        
        self.db.commit()
        
        # Clear permission cache for the user
        self._clear_user_permission_cache(elevation.user_id)
        
        # Audit log
        self.audit_logger.log_action(
            user_id=approver_id,
            action=AuditAction.ELEVATION_APPROVED,
            resource_type="role_elevation",
            resource_id=elevation.id,
            details={
                "user_id": elevation.user_id,
                "role_id": elevation.requested_role_id,
                "notes": notes
            }
        )
        
        return elevation
    
    def _get_active_elevated_permissions(self, user_id: str) -> PermissionSet:
        """Get permissions from active role elevations"""
        permissions = PermissionSet()
        
        active_elevations = self.db.query(RoleElevation).filter(
            and_(
                RoleElevation.user_id == user_id,
                RoleElevation.status == ApprovalStatus.APPROVED,
                RoleElevation.activated_at <= datetime.now(timezone.utc),
                RoleElevation.expires_at > datetime.now(timezone.utc),
                or_(
                    RoleElevation.revoked_at.is_(None),
                    RoleElevation.revoked_at > datetime.now(timezone.utc)
                )
            )
        ).all()
        
        for elevation in active_elevations:
            # Check use count
            if elevation.max_uses and elevation.use_count >= elevation.max_uses:
                continue
            
            # Get role permissions
            role = self.db.query(Role).filter(Role.id == elevation.requested_role_id).first()
            if role:
                role_perms = self._get_role_permissions(role)
                permissions = permissions.merge(role_perms)
        
        return permissions
    
    # Approval Workflows
    
    def create_approval_workflow(
        self,
        action_type: str,
        requested_by: str,
        reason: str,
        action_details: Dict,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        required_approvals: int = 1,
        approver_roles: Optional[List[str]] = None,
        expires_in_hours: int = 24
    ) -> ApprovalWorkflow:
        """Create an approval workflow for a sensitive action"""
        workflow = ApprovalWorkflow(
            id=str(uuid.uuid4()),
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
            action_details=action_details,
            requested_by=requested_by,
            request_reason=reason,
            required_approvals=required_approvals,
            approver_roles=approver_roles or ["admin"],
            expires_at=datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
        )
        
        self.db.add(workflow)
        self.db.commit()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=requested_by,
            action=AuditAction.APPROVAL_REQUESTED,
            resource_type=resource_type or "workflow",
            resource_id=workflow.id,
            details={
                "action_type": action_type,
                "reason": reason,
                "required_approvals": required_approvals
            }
        )
        
        return workflow
    
    def approve_workflow(
        self,
        workflow_id: str,
        approver_id: str,
        decision: ApprovalStatus,
        notes: Optional[str] = None
    ) -> ApprovalDecision:
        """Add an approval decision to a workflow"""
        workflow = self.db.query(ApprovalWorkflow).filter(
            ApprovalWorkflow.id == workflow_id
        ).first()
        
        if not workflow:
            raise ValueError("Workflow not found")
        
        if workflow.status != ApprovalStatus.PENDING:
            raise ValueError("Workflow is not pending")
        
        # Check if approver has permission
        approver = self.db.query(User).filter(User.id == approver_id).first()
        approver_roles = [role.name for role in approver.roles]
        
        if not any(role in workflow.approver_roles for role in approver_roles):
            raise PermissionError("User is not authorized to approve this workflow")
        
        # Create decision
        approval = ApprovalDecision(
            id=str(uuid.uuid4()),
            workflow_id=workflow_id,
            approver_id=approver_id,
            decision=decision,
            notes=notes
        )
        
        self.db.add(approval)
        
        # Check if workflow is complete
        if decision == ApprovalStatus.APPROVED:
            approved_count = self.db.query(ApprovalDecision).filter(
                and_(
                    ApprovalDecision.workflow_id == workflow_id,
                    ApprovalDecision.decision == ApprovalStatus.APPROVED
                )
            ).count() + 1  # +1 for current approval
            
            if approved_count >= workflow.required_approvals:
                workflow.status = ApprovalStatus.APPROVED
        elif decision == ApprovalStatus.REJECTED:
            workflow.status = ApprovalStatus.REJECTED
        
        self.db.commit()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=approver_id,
            action=AuditAction.APPROVAL_GRANTED if decision == ApprovalStatus.APPROVED else AuditAction.APPROVAL_DENIED,
            resource_type="approval_workflow",
            resource_id=workflow_id,
            details={
                "decision": decision.value,
                "notes": notes
            }
        )
        
        return approval
    
    # Utility methods
    
    def _clear_permission_cache(self):
        """Clear the entire permission cache"""
        self._permission_cache.clear()
    
    def _clear_user_permission_cache(self, user_id: str):
        """Clear permission cache for a specific user"""
        keys_to_remove = [k for k in self._permission_cache.keys() if k.startswith(f"{user_id}:")]
        for key in keys_to_remove:
            del self._permission_cache[key]
    
    def get_user_effective_roles(self, user: User) -> List[Role]:
        """Get all effective roles for a user including elevated"""
        roles = list(user.roles)
        
        # Add elevated roles
        active_elevations = self.db.query(RoleElevation).filter(
            and_(
                RoleElevation.user_id == user.id,
                RoleElevation.status == ApprovalStatus.APPROVED,
                RoleElevation.activated_at <= datetime.now(timezone.utc),
                RoleElevation.expires_at > datetime.now(timezone.utc),
                RoleElevation.revoked_at.is_(None)
            )
        ).all()
        
        for elevation in active_elevations:
            role = self.db.query(Role).filter(Role.id == elevation.requested_role_id).first()
            if role and role not in roles:
                roles.append(role)
        
        return roles