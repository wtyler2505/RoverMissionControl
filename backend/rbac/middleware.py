"""
FastAPI middleware for RBAC enforcement
"""
import uuid
from typing import Optional, List, Dict, Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
import json
import time

from .rbac_service import RBACService
from .audit import AuditLogger
from .permissions import Resource, Action
from ..auth.dependencies import get_current_user
from ..auth.models import User

class RBACMiddleware(BaseHTTPMiddleware):
    """Middleware for enforcing RBAC on API endpoints"""
    
    def __init__(
        self,
        app: ASGIApp,
        rbac_service: RBACService,
        audit_logger: AuditLogger,
        exclude_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.rbac_service = rbac_service
        self.audit_logger = audit_logger
        self.exclude_paths = exclude_paths or [
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/auth/password/reset",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/metrics"
        ]
        
        # Map HTTP methods to actions
        self.method_to_action = {
            "GET": Action.READ,
            "POST": Action.CREATE,
            "PUT": Action.UPDATE,
            "PATCH": Action.UPDATE,
            "DELETE": Action.DELETE
        }
        
        # Map URL patterns to resources
        self.path_to_resource = {
            "/api/rover": Resource.ROVER,
            "/api/rover/control": Resource.ROVER_CONTROL,
            "/api/rover/telemetry": Resource.ROVER_TELEMETRY,
            "/api/rover/camera": Resource.ROVER_CAMERA,
            "/api/rover/emergency": Resource.ROVER_EMERGENCY,
            "/api/arduino": Resource.ARDUINO,
            "/api/arduino/upload": Resource.ARDUINO_UPLOAD,
            "/api/arduino/serial": Resource.ARDUINO_SERIAL,
            "/api/knowledge": Resource.KNOWLEDGE,
            "/api/knowledge/parts": Resource.KNOWLEDGE_PARTS,
            "/api/knowledge/documents": Resource.KNOWLEDGE_DOCUMENTS,
            "/api/ai": Resource.AI,
            "/api/ai/chat": Resource.AI_CHAT,
            "/api/ai/config": Resource.AI_CONFIG,
            "/api/users": Resource.USERS,
            "/api/roles": Resource.ROLES,
            "/api/permissions": Resource.PERMISSIONS,
            "/api/audit": Resource.AUDIT_LOGS,
            "/api/config": Resource.SYSTEM_CONFIG,
            "/api/data/export": Resource.DATA_EXPORT,
            "/api/data/import": Resource.DATA_IMPORT,
            "/api/missions": Resource.MISSIONS,
            "/api/missions/planning": Resource.MISSION_PLANNING,
            "/api/missions/execution": Resource.MISSION_EXECUTION,
            "/api/keys": Resource.API_KEYS,
            "/api/keys/rotate": Resource.API_KEY_ROTATION,
            "/api/keys/scopes": Resource.API_KEY_SCOPES
        }
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request through RBAC checks"""
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Skip OPTIONS requests
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Extract user from request (this assumes authentication middleware has run)
        user = None
        if hasattr(request.state, "user"):
            user = request.state.user
        
        if not user:
            # No user means no permissions
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Authentication required"}
            )
        
        # Set audit context
        self.audit_logger.set_request_context(
            request_id=request_id,
            session_id=getattr(request.state, "session_id", None),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent", "")
        )
        
        try:
            # Determine resource and action
            resource = self._get_resource_from_path(request.url.path)
            action = self._get_action_from_method(request.method)
            
            if not resource or not action:
                # If we can't determine resource/action, allow the request
                # The actual endpoint will handle authorization
                return await call_next(request)
            
            # Extract resource ID from path if present
            resource_id = self._extract_resource_id(request.url.path)
            
            # Check permission
            has_permission, reason = self.rbac_service.check_permission(
                user=user,
                resource=resource,
                action=action,
                resource_id=resource_id,
                request_context={
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": dict(request.query_params)
                }
            )
            
            if not has_permission:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": "Permission denied",
                        "reason": reason,
                        "required_permission": f"{resource.value}:{action.value}"
                    }
                )
            
            # Process request
            start_time = time.time()
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Add RBAC headers to response
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            return response
            
        finally:
            # Clear audit context
            self.audit_logger.clear_request_context()
    
    def _get_resource_from_path(self, path: str) -> Optional[Resource]:
        """Determine resource from request path"""
        # Check exact matches first
        if path in self.path_to_resource:
            return self.path_to_resource[path]
        
        # Check prefix matches
        for pattern, resource in sorted(
            self.path_to_resource.items(),
            key=lambda x: len(x[0]),
            reverse=True
        ):
            if path.startswith(pattern):
                return resource
        
        return None
    
    def _get_action_from_method(self, method: str) -> Optional[Action]:
        """Determine action from HTTP method"""
        return self.method_to_action.get(method)
    
    def _extract_resource_id(self, path: str) -> Optional[str]:
        """Extract resource ID from path if present"""
        # Simple extraction - assumes ID is last path segment if it looks like a UUID
        parts = path.rstrip("/").split("/")
        if parts:
            last_part = parts[-1]
            # Check if it looks like a UUID or numeric ID
            if self._is_valid_id(last_part):
                return last_part
        return None
    
    def _is_valid_id(self, value: str) -> bool:
        """Check if value looks like a valid ID"""
        # UUID pattern
        if len(value) == 36 and value.count("-") == 4:
            return True
        
        # Numeric ID
        try:
            int(value)
            return True
        except ValueError:
            pass
        
        return False


class RBACRoute:
    """Route decorator for fine-grained RBAC control"""
    
    def __init__(
        self,
        resource: Resource,
        action: Action,
        require_approval: bool = False,
        log_access: bool = True
    ):
        self.resource = resource
        self.action = action
        self.require_approval = require_approval
        self.log_access = log_access
    
    def __call__(self, func: Callable) -> Callable:
        """Decorate route function"""
        async def wrapper(request: Request, *args, **kwargs):
            # Get user from request
            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Get RBAC service (should be injected into app state)
            rbac_service = request.app.state.rbac_service
            audit_logger = request.app.state.audit_logger
            
            # Extract resource ID if present in kwargs
            resource_id = kwargs.get("id") or kwargs.get("resource_id")
            
            # Check permission
            has_permission, reason = rbac_service.check_permission(
                user=user,
                resource=self.resource,
                action=self.action,
                resource_id=resource_id
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=reason or "Permission denied"
                )
            
            # Check if approval is required
            if self.require_approval:
                # Create approval workflow
                workflow = rbac_service.create_approval_workflow(
                    action_type=f"{self.resource.value}:{self.action.value}",
                    requested_by=user.id,
                    reason=f"API request to {request.url.path}",
                    action_details={
                        "method": request.method,
                        "path": str(request.url),
                        "resource_id": resource_id
                    },
                    resource_type=self.resource.value,
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
            
            # Log access if requested
            if self.log_access:
                audit_logger.log_action(
                    user_id=user.id,
                    action=AuditAction.RESOURCE_ACCESSED,
                    resource_type=self.resource.value,
                    resource_id=resource_id,
                    required_permission=f"{self.resource.value}:{self.action.value}",
                    had_permission=True
                )
            
            # Execute the route
            return await func(request, *args, **kwargs)
        
        return wrapper