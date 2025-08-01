"""
Decorators for RBAC enforcement in FastAPI endpoints
"""
from functools import wraps
from typing import List, Optional, Callable, Union
from fastapi import Depends, HTTPException, status

from .permissions import Resource, Action, Permission
from .rbac_service import RBACService
from .models import AuditAction
from ..auth.dependencies import get_current_user
from ..auth.models import User

def require_permission(
    resource: Union[Resource, str],
    action: Union[Action, str],
    require_approval: bool = False,
    audit: bool = True
) -> Callable:
    """
    Decorator to require specific permission for an endpoint
    
    Usage:
        @router.get("/rover/control")
        @require_permission(Resource.ROVER_CONTROL, Action.EXECUTE)
        async def control_rover(user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user from kwargs
            user = None
            for arg in kwargs.values():
                if isinstance(arg, User):
                    user = arg
                    break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Get RBAC service (should be injected)
            rbac_service = kwargs.get("rbac_service")
            if not rbac_service:
                # Try to get from request
                request = kwargs.get("request")
                if request and hasattr(request.app.state, "rbac_service"):
                    rbac_service = request.app.state.rbac_service
            
            if not rbac_service:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="RBAC service not available"
                )
            
            # Convert string to enum if needed
            res = Resource(resource) if isinstance(resource, str) else resource
            act = Action(action) if isinstance(action, str) else action
            
            # Extract resource ID if present
            resource_id = kwargs.get("id") or kwargs.get("resource_id")
            
            # Check permission
            has_permission, reason = rbac_service.check_permission(
                user=user,
                resource=res,
                action=act,
                resource_id=resource_id
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "Permission denied",
                        "reason": reason,
                        "required_permission": f"{res.value}:{act.value}"
                    }
                )
            
            # Handle approval requirement
            if require_approval:
                workflow = rbac_service.create_approval_workflow(
                    action_type=f"{res.value}:{act.value}",
                    requested_by=user.id,
                    reason=f"API request requires approval",
                    action_details={
                        "function": func.__name__,
                        "resource_id": resource_id
                    },
                    resource_type=res.value,
                    resource_id=resource_id
                )
                
                raise HTTPException(
                    status_code=status.HTTP_202_ACCEPTED,
                    detail={
                        "message": "Action requires approval",
                        "workflow_id": workflow.id,
                        "status": "pending_approval"
                    }
                )
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Audit if requested
            if audit and rbac_service.audit_logger:
                rbac_service.audit_logger.log_action(
                    user_id=user.id,
                    action=AuditAction.RESOURCE_ACCESSED,
                    resource_type=res.value,
                    resource_id=resource_id,
                    required_permission=f"{res.value}:{act.value}",
                    had_permission=True,
                    details={"function": func.__name__}
                )
            
            return result
        
        return wrapper
    return decorator


def require_any_permission(
    permissions: List[tuple[Union[Resource, str], Union[Action, str]]],
    audit: bool = True
) -> Callable:
    """
    Decorator to require any of the specified permissions
    
    Usage:
        @router.get("/data")
        @require_any_permission([
            (Resource.DATA_EXPORT, Action.EXECUTE),
            (Resource.DATA_IMPORT, Action.READ)
        ])
        async def get_data(user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user
            user = None
            for arg in kwargs.values():
                if isinstance(arg, User):
                    user = arg
                    break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Get RBAC service
            rbac_service = kwargs.get("rbac_service")
            if not rbac_service:
                request = kwargs.get("request")
                if request and hasattr(request.app.state, "rbac_service"):
                    rbac_service = request.app.state.rbac_service
            
            if not rbac_service:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="RBAC service not available"
                )
            
            # Check permissions
            resource_id = kwargs.get("id") or kwargs.get("resource_id")
            has_any_permission = False
            checked_permissions = []
            
            for resource, action in permissions:
                res = Resource(resource) if isinstance(resource, str) else resource
                act = Action(action) if isinstance(action, str) else action
                
                has_permission, _ = rbac_service.check_permission(
                    user=user,
                    resource=res,
                    action=act,
                    resource_id=resource_id
                )
                
                checked_permissions.append(f"{res.value}:{act.value}")
                
                if has_permission:
                    has_any_permission = True
                    break
            
            if not has_any_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "Permission denied",
                        "reason": "None of the required permissions found",
                        "required_permissions": checked_permissions
                    }
                )
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Audit if requested
            if audit and rbac_service.audit_logger:
                rbac_service.audit_logger.log_action(
                    user_id=user.id,
                    action=AuditAction.RESOURCE_ACCESSED,
                    resource_type="multiple",
                    resource_id=resource_id,
                    required_permission=",".join(checked_permissions),
                    had_permission=True,
                    details={"function": func.__name__}
                )
            
            return result
        
        return wrapper
    return decorator


def require_role(
    role_names: Union[str, List[str]],
    audit: bool = True
) -> Callable:
    """
    Decorator to require specific role(s)
    
    Usage:
        @router.post("/admin/users")
        @require_role("admin")
        async def create_user(user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user
            user = None
            for arg in kwargs.values():
                if isinstance(arg, User):
                    user = arg
                    break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Normalize role names
            required_roles = [role_names] if isinstance(role_names, str) else role_names
            
            # Check roles
            user_roles = [role.name for role in user.roles]
            has_required_role = any(role in user_roles for role in required_roles)
            
            if not has_required_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "Insufficient role",
                        "required_roles": required_roles,
                        "user_roles": user_roles
                    }
                )
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Audit if requested
            if audit:
                # Get audit logger
                request = kwargs.get("request")
                if request and hasattr(request.app.state, "audit_logger"):
                    audit_logger = request.app.state.audit_logger
                    audit_logger.log_action(
                        user_id=user.id,
                        action=AuditAction.RESOURCE_ACCESSED,
                        resource_type="role_protected",
                        required_permission=f"role:{','.join(required_roles)}",
                        had_permission=True,
                        details={"function": func.__name__}
                    )
            
            return result
        
        return wrapper
    return decorator


def require_approval(
    approval_type: str,
    approver_roles: Optional[List[str]] = None,
    required_approvals: int = 1,
    expires_in_hours: int = 24
) -> Callable:
    """
    Decorator to require approval workflow for an action
    
    Usage:
        @router.delete("/critical-data/{id}")
        @require_approval("critical_data_deletion", approver_roles=["admin", "data_manager"])
        async def delete_critical_data(id: str, user: User = Depends(get_current_user)):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract user
            user = None
            for arg in kwargs.values():
                if isinstance(arg, User):
                    user = arg
                    break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Get RBAC service
            rbac_service = kwargs.get("rbac_service")
            if not rbac_service:
                request = kwargs.get("request")
                if request and hasattr(request.app.state, "rbac_service"):
                    rbac_service = request.app.state.rbac_service
            
            if not rbac_service:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="RBAC service not available"
                )
            
            # Extract resource ID
            resource_id = kwargs.get("id") or kwargs.get("resource_id")
            
            # Create approval workflow
            workflow = rbac_service.create_approval_workflow(
                action_type=approval_type,
                requested_by=user.id,
                reason=f"API request to {func.__name__}",
                action_details={
                    "function": func.__name__,
                    "args": str(args),
                    "kwargs": {k: str(v) for k, v in kwargs.items() if k != "user"}
                },
                resource_id=resource_id,
                required_approvals=required_approvals,
                approver_roles=approver_roles or ["admin"],
                expires_in_hours=expires_in_hours
            )
            
            # Return approval required response
            return {
                "status": "approval_required",
                "message": f"This action requires {required_approvals} approval(s)",
                "workflow_id": workflow.id,
                "expires_at": workflow.expires_at.isoformat(),
                "approver_roles": workflow.approver_roles
            }
        
        return wrapper
    return decorator


# Convenience decorators for common permissions
require_admin = require_role("admin")
require_operator = require_role(["admin", "operator"])
require_viewer = require_role(["admin", "operator", "viewer"])

# Resource-specific decorators
require_rover_control = require_permission(Resource.ROVER_CONTROL, Action.EXECUTE)
require_arduino_access = require_permission(Resource.ARDUINO, Action.EXECUTE)
require_user_management = require_permission(Resource.USERS, Action.UPDATE)
require_audit_access = require_permission(Resource.AUDIT_LOGS, Action.READ)