"""
Enhanced CORS middleware with dynamic policy management
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from .cors_service import CORSService
from .cors_models import CORSPolicyType
from ..database import get_db

class EnhancedCORSMiddleware(BaseHTTPMiddleware):
    """
    Enhanced CORS middleware with database-driven policy management
    """
    
    def __init__(
        self,
        app: ASGIApp,
        default_allowed_origins: Optional[List[str]] = None,
        default_allowed_methods: Optional[List[str]] = None,
        default_allowed_headers: Optional[List[str]] = None,
        default_expose_headers: Optional[List[str]] = None,
        default_allow_credentials: bool = True,
        default_max_age: int = 3600,
        enable_violation_tracking: bool = True,
        enforce_policies: bool = True
    ):
        super().__init__(app)
        self.default_allowed_origins = default_allowed_origins or []
        self.default_allowed_methods = default_allowed_methods or [
            "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"
        ]
        self.default_allowed_headers = default_allowed_headers or ["*"]
        self.default_expose_headers = default_expose_headers or []
        self.default_allow_credentials = default_allow_credentials
        self.default_max_age = default_max_age
        self.enable_violation_tracking = enable_violation_tracking
        self.enforce_policies = enforce_policies
        
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with enhanced CORS handling"""
        origin = request.headers.get("origin")
        
        # Skip CORS for same-origin requests
        if not origin:
            return await call_next(request)
        
        # Get applicable CORS policy
        db = next(get_db())
        try:
            service = CORSService(db)
            
            # Get API key ID if available
            api_key_id = None
            if hasattr(request.state, "api_key") and request.state.api_key:
                api_key_id = request.state.api_key.id
            
            # Get user ID if available
            user_id = None
            if hasattr(request.state, "user") and request.state.user:
                user_id = request.state.user.id
            
            # Find applicable policy
            policy = service.get_applicable_policy(
                origin=origin,
                method=request.method,
                path=request.url.path,
                api_key_id=api_key_id
            )
            
            # Determine CORS configuration
            if policy and policy.is_active:
                # Use database policy
                cors_config = self._get_policy_config(policy)
            else:
                # Use default configuration
                cors_config = self._get_default_config()
            
            # Check if request is allowed
            violations = []
            
            # Check origin
            origin_allowed = self._check_origin(origin, cors_config)
            if not origin_allowed:
                violations.append({
                    "type": "origin_not_allowed",
                    "details": {"origin": origin, "allowed": cors_config["allowed_origins"]}
                })
            
            # Check method
            method_allowed = self._check_method(request.method, cors_config)
            if not method_allowed:
                violations.append({
                    "type": "method_not_allowed",
                    "details": {"method": request.method, "allowed": cors_config["allowed_methods"]}
                })
            
            # Check headers for preflight
            if request.method == "OPTIONS":
                requested_headers = request.headers.get(
                    "access-control-request-headers", ""
                ).split(",")
                requested_headers = [h.strip() for h in requested_headers if h.strip()]
                
                headers_allowed = self._check_headers(requested_headers, cors_config)
                if not headers_allowed:
                    rejected_headers = [
                        h for h in requested_headers 
                        if not self._is_header_allowed(h, cors_config)
                    ]
                    violations.append({
                        "type": "headers_not_allowed",
                        "details": {
                            "requested": requested_headers,
                            "rejected": rejected_headers,
                            "allowed": cors_config["allowed_headers"]
                        }
                    })
            
            # Handle violations
            if violations and self.enforce_policies:
                # Track violations
                if self.enable_violation_tracking:
                    for violation in violations:
                        service.record_violation(
                            origin=origin,
                            method=request.method,
                            path=request.url.path,
                            violation_type=violation["type"],
                            violation_details=violation["details"],
                            policy_id=policy.id if policy else None,
                            api_key_id=api_key_id,
                            user_id=user_id,
                            ip_address=request.client.host if request.client else None,
                            user_agent=request.headers.get("user-agent"),
                            headers=dict(request.headers),
                            was_blocked=True
                        )
                
                # Return CORS error
                if request.method == "OPTIONS":
                    return Response(
                        status_code=200,
                        headers=self._get_error_headers()
                    )
                else:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "CORS policy violation",
                            "violations": violations
                        },
                        headers=self._get_error_headers()
                    )
            
            # Handle preflight requests
            if request.method == "OPTIONS":
                return Response(
                    status_code=200,
                    headers=self._get_cors_headers(origin, cors_config)
                )
            
            # Process actual request
            response = await call_next(request)
            
            # Add CORS headers to response
            cors_headers = self._get_cors_headers(origin, cors_config)
            for header, value in cors_headers.items():
                response.headers[header] = value
            
            # Track successful request if violation tracking enabled
            if self.enable_violation_tracking and violations:
                # Record that violations were overridden (not enforced)
                for violation in violations:
                    service.record_violation(
                        origin=origin,
                        method=request.method,
                        path=request.url.path,
                        violation_type=violation["type"],
                        violation_details=violation["details"],
                        policy_id=policy.id if policy else None,
                        api_key_id=api_key_id,
                        user_id=user_id,
                        ip_address=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent"),
                        headers=dict(request.headers),
                        was_blocked=False,
                        override_reason="CORS enforcement disabled"
                    )
            
            db.commit()
            return response
            
        except Exception as e:
            # Log error and fall back to default CORS
            import logging
            logging.error(f"CORS middleware error: {e}")
            
            # Use permissive CORS on error to avoid blocking requests
            response = await call_next(request) if request.method != "OPTIONS" else Response(status_code=200)
            
            if origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = ", ".join(self.default_allowed_methods)
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Allow-Credentials"] = "true"
            
            return response
        finally:
            db.close()
    
    def _get_policy_config(self, policy) -> Dict[str, Any]:
        """Convert policy to configuration dict"""
        return {
            "allowed_origins": policy.allowed_origins or [],
            "allow_all_origins": policy.allow_all_origins,
            "allowed_methods": policy.allowed_methods or [],
            "allow_all_methods": policy.allow_all_methods,
            "allowed_headers": policy.allowed_headers or [],
            "allow_all_headers": policy.allow_all_headers,
            "expose_headers": policy.expose_headers or [],
            "allow_credentials": policy.allow_credentials,
            "max_age": policy.max_age,
            "validate_origin_regex": policy.validate_origin_regex,
            "case_sensitive_origins": policy.case_sensitive_origins
        }
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            "allowed_origins": self.default_allowed_origins,
            "allow_all_origins": False,
            "allowed_methods": self.default_allowed_methods,
            "allow_all_methods": False,
            "allowed_headers": self.default_allowed_headers,
            "allow_all_headers": "*" in self.default_allowed_headers,
            "expose_headers": self.default_expose_headers,
            "allow_credentials": self.default_allow_credentials,
            "max_age": self.default_max_age,
            "validate_origin_regex": False,
            "case_sensitive_origins": False
        }
    
    def _check_origin(self, origin: str, config: Dict[str, Any]) -> bool:
        """Check if origin is allowed"""
        if config["allow_all_origins"]:
            return True
        
        if not config["allowed_origins"]:
            return False
        
        for allowed_origin in config["allowed_origins"]:
            if config["validate_origin_regex"]:
                import re
                try:
                    pattern = allowed_origin
                    flags = 0 if config["case_sensitive_origins"] else re.IGNORECASE
                    if re.match(pattern, origin, flags):
                        return True
                except re.error:
                    pass
            else:
                if config["case_sensitive_origins"]:
                    if allowed_origin == origin:
                        return True
                else:
                    if allowed_origin.lower() == origin.lower():
                        return True
        
        return False
    
    def _check_method(self, method: str, config: Dict[str, Any]) -> bool:
        """Check if method is allowed"""
        if config["allow_all_methods"]:
            return True
        
        if not config["allowed_methods"]:
            return False
        
        return method.upper() in [m.upper() for m in config["allowed_methods"]]
    
    def _check_headers(self, headers: List[str], config: Dict[str, Any]) -> bool:
        """Check if all headers are allowed"""
        if not headers:
            return True
        
        return all(self._is_header_allowed(h, config) for h in headers)
    
    def _is_header_allowed(self, header: str, config: Dict[str, Any]) -> bool:
        """Check if a single header is allowed"""
        if config["allow_all_headers"]:
            return True
        
        if not config["allowed_headers"]:
            return False
        
        # Simple headers are always allowed
        simple_headers = [
            "accept", "accept-language", "content-language", 
            "content-type", "range"
        ]
        
        if header.lower() in simple_headers:
            return True
        
        # Check configured headers (case-insensitive)
        return header.lower() in [h.lower() for h in config["allowed_headers"]]
    
    def _get_cors_headers(self, origin: str, config: Dict[str, Any]) -> Dict[str, str]:
        """Generate CORS response headers"""
        headers = {}
        
        # Origin
        if config["allow_all_origins"]:
            headers["Access-Control-Allow-Origin"] = "*"
        else:
            headers["Access-Control-Allow-Origin"] = origin
        
        # Methods
        if config["allowed_methods"]:
            headers["Access-Control-Allow-Methods"] = ", ".join(config["allowed_methods"])
        
        # Headers
        if config["allow_all_headers"]:
            headers["Access-Control-Allow-Headers"] = "*"
        elif config["allowed_headers"]:
            headers["Access-Control-Allow-Headers"] = ", ".join(config["allowed_headers"])
        
        # Expose headers
        if config["expose_headers"]:
            headers["Access-Control-Expose-Headers"] = ", ".join(config["expose_headers"])
        
        # Credentials
        if config["allow_credentials"] and not config["allow_all_origins"]:
            headers["Access-Control-Allow-Credentials"] = "true"
        
        # Max age
        headers["Access-Control-Max-Age"] = str(config["max_age"])
        
        # Vary header for caching
        headers["Vary"] = "Origin"
        
        return headers
    
    def _get_error_headers(self) -> Dict[str, str]:
        """Get minimal headers for CORS errors"""
        return {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS",
            "Vary": "Origin"
        }