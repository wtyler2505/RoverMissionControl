"""
Middleware for API security including API key authentication and rate limiting
"""
import time
import json
from typing import Optional, Dict, List, Callable
from datetime import datetime, timezone
from collections import defaultdict
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from .service import APIKeyService
from .models import APIKey, RateLimitConfig
from ..database import get_db

class APIKeyAuthMiddleware(BaseHTTPMiddleware):
    """Middleware for API key authentication"""
    
    def __init__(
        self,
        app: ASGIApp,
        api_key_header: str = "X-API-Key",
        exclude_paths: Optional[List[str]] = None,
        optional_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.api_key_header = api_key_header
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc", 
            "/openapi.json",
            "/api/health",
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh"
        ]
        self.optional_paths = optional_paths or []  # Paths where API key is optional
        
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with API key authentication"""
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Get API key from header
        api_key_string = request.headers.get(self.api_key_header)
        
        # Check if API key is required
        is_optional = any(request.url.path.startswith(path) for path in self.optional_paths)
        
        if not api_key_string and not is_optional:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "API key required", "header": self.api_key_header}
            )
        
        if api_key_string:
            # Validate API key
            db = next(get_db())
            try:
                service = APIKeyService(db)
                
                # Extract required scopes based on path and method
                required_scopes = self._get_required_scopes(request.method, request.url.path)
                
                # Validate key
                is_valid, api_key, error_message = service.validate_api_key(
                    api_key_string=api_key_string,
                    required_scopes=required_scopes,
                    ip_address=request.client.host if request.client else None,
                    origin=request.headers.get("origin")
                )
                
                if not is_valid:
                    # Log failed attempt
                    if api_key:
                        api_key.last_error_at = datetime.now(timezone.utc)
                        api_key.error_count += 1
                        db.commit()
                    
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"error": error_message}
                    )
                
                # Attach API key to request state
                request.state.api_key = api_key
                request.state.api_key_scopes = [scope.name for scope in api_key.scopes]
                
                # Track request start time
                request.state.start_time = time.time()
                
            finally:
                db.close()
        
        # Process request
        response = await call_next(request)
        
        # Log API key usage if used
        if hasattr(request.state, "api_key"):
            db = next(get_db())
            try:
                service = APIKeyService(db)
                response_time = int((time.time() - request.state.start_time) * 1000)
                
                service.log_api_key_usage(
                    api_key=request.state.api_key,
                    request_details={
                        "ip_address": request.client.host if request.client else None,
                        "user_agent": request.headers.get("user-agent"),
                        "origin": request.headers.get("origin"),
                        "method": request.method,
                        "path": request.url.path
                    },
                    response_details={
                        "status_code": response.status_code,
                        "response_time_ms": response_time,
                        "rate_limit_hit": getattr(request.state, "rate_limit_hit", False)
                    }
                )
            finally:
                db.close()
        
        return response
    
    def _get_required_scopes(self, method: str, path: str) -> List[str]:
        """Determine required scopes based on method and path"""
        scopes = []
        
        # Telemetry endpoints
        if path.startswith("/api/rover/telemetry"):
            if method == "GET":
                scopes.append("telemetry:read")
        
        # Rover control endpoints
        elif path.startswith("/api/rover/control"):
            scopes.append("rover:control")
        
        # Arduino endpoints
        elif path.startswith("/api/arduino/upload"):
            scopes.append("arduino:upload")
        elif path.startswith("/api/arduino"):
            if method == "GET":
                scopes.append("telemetry:read")
        
        # Knowledge base
        elif path.startswith("/api/knowledge"):
            if method in ["POST", "PUT", "DELETE"]:
                scopes.append("knowledge:write")
            else:
                scopes.append("knowledge:read")
        
        # Configuration
        elif path.startswith("/api/config"):
            if method in ["POST", "PUT", "DELETE"]:
                scopes.append("config:write")
            else:
                scopes.append("config:read")
        
        # API key management
        elif path.startswith("/api/keys"):
            scopes.append("keys:manage")
        
        # User management
        elif path.startswith("/api/users"):
            if method != "GET" or path.endswith("/me"):
                scopes.append("users:manage")
        
        return scopes


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for rate limiting"""
    
    def __init__(
        self,
        app: ASGIApp,
        default_limit: int = 60,  # Requests per minute
        window_seconds: int = 60,
        exclude_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        self.exclude_paths = exclude_paths or ["/api/health", "/docs", "/redoc"]
        
        # In-memory storage (use Redis in production)
        self.request_counts = defaultdict(lambda: {"count": 0, "window_start": 0})
        
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with rate limiting"""
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Get identifier (API key or IP)
        identifier = None
        if hasattr(request.state, "api_key"):
            identifier = f"key:{request.state.api_key.id}"
            # Use API key's custom rate limit if set
            rate_limit = request.state.api_key.rate_limit_per_minute or self.default_limit
        else:
            # Use IP address for non-authenticated requests
            identifier = f"ip:{request.client.host if request.client else 'unknown'}"
            rate_limit = self.default_limit
        
        # Check rate limit
        current_time = int(time.time())
        window_start = current_time - (current_time % self.window_seconds)
        
        # Get or initialize counter
        counter = self.request_counts[identifier]
        
        # Reset counter if new window
        if counter["window_start"] < window_start:
            counter["count"] = 0
            counter["window_start"] = window_start
        
        # Check limit
        if counter["count"] >= rate_limit:
            # Mark as rate limited
            request.state.rate_limit_hit = True
            
            # Calculate retry after
            retry_after = self.window_seconds - (current_time - window_start)
            
            # Get custom config for this endpoint
            custom_message = await self._get_custom_rate_limit_message(request.url.path)
            
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": custom_message or "Rate limit exceeded",
                    "retry_after_seconds": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(rate_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(window_start + self.window_seconds)
                }
            )
        
        # Increment counter
        counter["count"] += 1
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(rate_limit - counter["count"])
        response.headers["X-RateLimit-Reset"] = str(window_start + self.window_seconds)
        
        return response
    
    async def _get_custom_rate_limit_message(self, path: str) -> Optional[str]:
        """Get custom rate limit message for endpoint"""
        # In production, this would query the database
        # For now, return None to use default
        return None


class InputValidationMiddleware(BaseHTTPMiddleware):
    """Middleware for input validation and sanitization"""
    
    def __init__(
        self,
        app: ASGIApp,
        max_body_size: int = 10 * 1024 * 1024,  # 10MB
        allowed_content_types: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.max_body_size = max_body_size
        self.allowed_content_types = allowed_content_types or [
            "application/json",
            "application/x-www-form-urlencoded",
            "multipart/form-data"
        ]
        
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with input validation"""
        # Check content type for POST/PUT/PATCH
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "").split(";")[0]
            
            if content_type and not any(
                content_type.startswith(allowed) for allowed in self.allowed_content_types
            ):
                return JSONResponse(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    content={"error": f"Unsupported content type: {content_type}"}
                )
        
        # Check content length
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_body_size:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={
                    "error": "Request body too large",
                    "max_size_bytes": self.max_body_size
                }
            )
        
        # Process request
        return await call_next(request)


class CORSMiddleware(BaseHTTPMiddleware):
    """Enhanced CORS middleware with per-route configuration"""
    
    def __init__(
        self,
        app: ASGIApp,
        allowed_origins: List[str],
        allowed_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowed_headers: List[str] = ["*"],
        expose_headers: List[str] = [],
        allow_credentials: bool = True,
        max_age: int = 3600
    ):
        super().__init__(app)
        self.allowed_origins = allowed_origins
        self.allowed_methods = allowed_methods
        self.allowed_headers = allowed_headers
        self.expose_headers = expose_headers
        self.allow_credentials = allow_credentials
        self.max_age = max_age
        
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with CORS headers"""
        origin = request.headers.get("origin")
        
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response(status_code=200)
        else:
            response = await call_next(request)
        
        # Add CORS headers if origin is allowed
        if origin and self._is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allowed_methods)
            response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allowed_headers)
            
            if self.expose_headers:
                response.headers["Access-Control-Expose-Headers"] = ", ".join(self.expose_headers)
            
            if self.allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"
            
            response.headers["Access-Control-Max-Age"] = str(self.max_age)
        
        return response
    
    def _is_origin_allowed(self, origin: str) -> bool:
        """Check if origin is allowed"""
        if "*" in self.allowed_origins:
            return True
        
        return origin in self.allowed_origins