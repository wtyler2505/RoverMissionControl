"""
Enhanced schema validation middleware with comprehensive request/response validation
"""
import json
import time
import asyncio
import logging
from typing import Optional, Dict, Any, List, Tuple, Union
from datetime import datetime, timezone
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
from starlette.datastructures import Headers
from starlette.concurrency import iterate_in_threadpool

from .schema_service import SchemaService
from .schema_models import SchemaEndpointMapping, ValidationSeverity
from ..database import get_db
from ..auth.models import User

# Configure logging
logger = logging.getLogger(__name__)

class SchemaValidationMiddleware(BaseHTTPMiddleware):
    """
    Schema validation middleware for request/response validation
    """
    
    def __init__(
        self,
        app: ASGIApp,
        enable_request_validation: bool = True,
        enable_response_validation: bool = True,
        strict_validation: bool = False,
        validation_timeout: float = 5.0,
        cache_ttl: int = 300,
        skip_validation_header: str = "X-Skip-Validation",
        skip_validation_endpoints: Optional[List[str]] = None,
        log_validation_failures: bool = True,
        include_warnings_in_response: bool = True,
        performance_monitoring: bool = True,
        max_body_size: int = 10 * 1024 * 1024  # 10MB
    ):
        super().__init__(app)
        self.enable_request_validation = enable_request_validation
        self.enable_response_validation = enable_response_validation
        self.strict_validation = strict_validation
        self.validation_timeout = validation_timeout
        self.cache_ttl = cache_ttl
        self.skip_validation_header = skip_validation_header
        self.skip_validation_endpoints = skip_validation_endpoints or [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/metrics"
        ]
        self.log_validation_failures = log_validation_failures
        self.include_warnings_in_response = include_warnings_in_response
        self.performance_monitoring = performance_monitoring
        self.max_body_size = max_body_size
        
        # Schema cache
        self._schema_cache: Dict[str, Tuple[Any, float]] = {}
        self._mapping_cache: Dict[str, Tuple[Optional[SchemaEndpointMapping], float]] = {}
        
        # Performance metrics
        self._metrics = {
            "total_requests": 0,
            "validated_requests": 0,
            "validation_failures": 0,
            "validation_skipped": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "total_validation_time": 0.0,
            "validation_timeouts": 0
        }
    
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with schema validation"""
        start_time = time.time()
        
        # Update metrics
        self._metrics["total_requests"] += 1
        
        # Check if validation should be skipped
        if self._should_skip_validation(request):
            self._metrics["validation_skipped"] += 1
            return await call_next(request)
        
        # Get database session
        db = next(get_db())
        try:
            service = SchemaService(db)
            
            # Get user and API key info from request state
            user = getattr(request.state, "user", None)
            api_key = getattr(request.state, "api_key", None)
            
            # Validate request if enabled
            request_validation_result = None
            if self.enable_request_validation and request.method not in ["GET", "DELETE", "HEAD", "OPTIONS"]:
                try:
                    # Read request body
                    body = await self._read_request_body(request)
                    
                    if body:
                        # Perform validation with timeout
                        request_validation_result = await self._validate_with_timeout(
                            service.validate_endpoint_request,
                            endpoint_path=request.url.path,
                            http_method=request.method,
                            request_data=body,
                            api_version=request.headers.get("API-Version")
                        )
                        
                        # Handle validation failure
                        if request_validation_result and not request_validation_result.get("valid"):
                            self._metrics["validation_failures"] += 1
                            
                            if self.strict_validation or self._has_errors(request_validation_result):
                                # Log validation failure
                                if self.log_validation_failures:
                                    self._log_validation_failure(
                                        request,
                                        "request",
                                        request_validation_result,
                                        user,
                                        api_key
                                    )
                                
                                # Return validation error response
                                return self._create_validation_error_response(
                                    request_validation_result,
                                    "Request validation failed"
                                )
                            
                        self._metrics["validated_requests"] += 1
                        
                except asyncio.TimeoutError:
                    self._metrics["validation_timeouts"] += 1
                    logger.warning(f"Request validation timeout for {request.url.path}")
                    
                except Exception as e:
                    logger.error(f"Request validation error: {e}")
                    if self.strict_validation:
                        return JSONResponse(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            content={
                                "error": "Validation service error",
                                "message": "An error occurred during request validation"
                            }
                        )
            
            # Process the request
            response = await call_next(request)
            
            # Validate response if enabled
            if self.enable_response_validation and response.status_code < 400:
                try:
                    # Read response body
                    response_body = await self._read_response_body(response)
                    
                    if response_body:
                        # Perform validation with timeout
                        response_validation_result = await self._validate_with_timeout(
                            service.validate_endpoint_response,
                            endpoint_path=request.url.path,
                            http_method=request.method,
                            response_data=response_body,
                            status_code=response.status_code,
                            api_version=request.headers.get("API-Version")
                        )
                        
                        # Handle validation failure
                        if response_validation_result and not response_validation_result.get("valid"):
                            self._metrics["validation_failures"] += 1
                            
                            # Log validation failure
                            if self.log_validation_failures:
                                self._log_validation_failure(
                                    request,
                                    "response",
                                    response_validation_result,
                                    user,
                                    api_key,
                                    response_status=response.status_code
                                )
                            
                            # In strict mode, return error instead of invalid response
                            if self.strict_validation and self._has_errors(response_validation_result):
                                return self._create_validation_error_response(
                                    response_validation_result,
                                    "Response validation failed"
                                )
                            
                            # Otherwise, add validation warnings to response headers
                            elif self.include_warnings_in_response:
                                response.headers["X-Validation-Warnings"] = json.dumps(
                                    response_validation_result.get("warnings", [])
                                )
                        
                        # Recreate response with original body
                        response = Response(
                            content=json.dumps(response_body),
                            status_code=response.status_code,
                            headers=dict(response.headers),
                            media_type="application/json"
                        )
                        
                except asyncio.TimeoutError:
                    self._metrics["validation_timeouts"] += 1
                    logger.warning(f"Response validation timeout for {request.url.path}")
                    
                except Exception as e:
                    logger.error(f"Response validation error: {e}")
            
            # Add performance metrics to response headers if monitoring enabled
            if self.performance_monitoring:
                validation_time = time.time() - start_time
                self._metrics["total_validation_time"] += validation_time
                response.headers["X-Validation-Time"] = f"{validation_time:.3f}s"
                
                # Add cache performance metrics
                cache_hit_rate = (
                    self._metrics["cache_hits"] / 
                    (self._metrics["cache_hits"] + self._metrics["cache_misses"])
                    if (self._metrics["cache_hits"] + self._metrics["cache_misses"]) > 0
                    else 0
                )
                response.headers["X-Validation-Cache-Hit-Rate"] = f"{cache_hit_rate:.2%}"
            
            return response
            
        except Exception as e:
            logger.error(f"Schema validation middleware error: {e}")
            # In case of middleware error, pass through the request
            return await call_next(request)
            
        finally:
            db.close()
    
    def _should_skip_validation(self, request: Request) -> bool:
        """Check if validation should be skipped for this request"""
        # Check skip header (with authorization)
        if self.skip_validation_header in request.headers:
            # Verify user has permission to skip validation
            user = getattr(request.state, "user", None)
            if user and self._user_can_skip_validation(user):
                logger.info(f"Validation skipped by {user.email} for {request.url.path}")
                return True
        
        # Check if endpoint is in skip list
        for skip_pattern in self.skip_validation_endpoints:
            if request.url.path.startswith(skip_pattern):
                return True
        
        # Skip validation for OPTIONS requests
        if request.method == "OPTIONS":
            return True
        
        return False
    
    def _user_can_skip_validation(self, user: User) -> bool:
        """Check if user has permission to skip validation"""
        # Check for admin role or specific permission
        return any(
            role.name in ["admin", "developer"] 
            for role in user.roles
        )
    
    async def _read_request_body(self, request: Request) -> Optional[Dict[str, Any]]:
        """Read and parse request body"""
        # Check content type
        content_type = request.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return None
        
        # Read body
        body_bytes = await request.body()
        if not body_bytes:
            return None
        
        # Check size limit
        if len(body_bytes) > self.max_body_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Request body exceeds maximum size of {self.max_body_size} bytes"
            )
        
        # Parse JSON
        try:
            # Store body for downstream handlers
            request._body = body_bytes
            return json.loads(body_bytes)
        except json.JSONDecodeError:
            return None
    
    async def _read_response_body(self, response: Response) -> Optional[Dict[str, Any]]:
        """Read and parse response body"""
        # Check if response has body
        if not hasattr(response, "body_iterator"):
            return None
        
        # Read body chunks
        body_parts = []
        async for chunk in response.body_iterator:
            body_parts.append(chunk)
        
        if not body_parts:
            return None
        
        # Combine chunks
        body_bytes = b"".join(body_parts)
        
        # Parse JSON
        try:
            return json.loads(body_bytes)
        except json.JSONDecodeError:
            return None
    
    async def _validate_with_timeout(
        self,
        validation_func,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Execute validation with timeout"""
        try:
            # Create validation task
            validation_task = asyncio.create_task(
                asyncio.to_thread(validation_func, **kwargs)
            )
            
            # Wait with timeout
            result = await asyncio.wait_for(
                validation_task,
                timeout=self.validation_timeout
            )
            
            return result
            
        except asyncio.TimeoutError:
            raise
        except Exception as e:
            logger.error(f"Validation error: {e}")
            return None
    
    def _has_errors(self, validation_result: Dict[str, Any]) -> bool:
        """Check if validation result contains errors (not just warnings)"""
        errors = validation_result.get("errors", [])
        return any(
            error.get("severity", ValidationSeverity.ERROR) == ValidationSeverity.ERROR
            for error in errors
        )
    
    def _create_validation_error_response(
        self,
        validation_result: Dict[str, Any],
        message: str
    ) -> Response:
        """Create standardized validation error response"""
        errors = validation_result.get("errors", [])
        
        # Format errors for response
        formatted_errors = []
        for error in errors:
            formatted_error = {
                "field": error.get("path", []),
                "message": error.get("message", "Validation failed"),
                "rule": error.get("rule"),
                "value": error.get("validator_value")
            }
            
            # Add suggested fix if available
            if "suggested_fix" in error:
                formatted_error["suggested_fix"] = error["suggested_fix"]
            
            formatted_errors.append(formatted_error)
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation Error",
                "message": message,
                "errors": formatted_errors,
                "schema_name": validation_result.get("schema_name"),
                "validation_timestamp": validation_result.get("validation_timestamp")
            }
        )
    
    def _log_validation_failure(
        self,
        request: Request,
        validation_type: str,
        validation_result: Dict[str, Any],
        user: Optional[User],
        api_key: Optional[Any],
        response_status: Optional[int] = None
    ) -> None:
        """Log validation failure with context"""
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "validation_type": validation_type,
            "endpoint": request.url.path,
            "method": request.method,
            "schema_name": validation_result.get("schema_name"),
            "errors": validation_result.get("errors", []),
            "warnings": validation_result.get("warnings", []),
            "user_id": user.id if user else None,
            "user_email": user.email if user else None,
            "api_key_id": api_key.id if api_key else None,
            "client_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "request_id": request.headers.get("X-Request-ID"),
            "response_status": response_status
        }
        
        logger.warning(f"Validation failure: {json.dumps(log_data)}")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get middleware performance metrics"""
        total_validations = self._metrics["validated_requests"]
        avg_validation_time = (
            self._metrics["total_validation_time"] / total_validations
            if total_validations > 0
            else 0
        )
        
        return {
            "total_requests": self._metrics["total_requests"],
            "validated_requests": self._metrics["validated_requests"],
            "validation_failures": self._metrics["validation_failures"],
            "validation_skipped": self._metrics["validation_skipped"],
            "validation_failure_rate": (
                self._metrics["validation_failures"] / total_validations
                if total_validations > 0
                else 0
            ),
            "cache_hits": self._metrics["cache_hits"],
            "cache_misses": self._metrics["cache_misses"],
            "cache_hit_rate": (
                self._metrics["cache_hits"] / 
                (self._metrics["cache_hits"] + self._metrics["cache_misses"])
                if (self._metrics["cache_hits"] + self._metrics["cache_misses"]) > 0
                else 0
            ),
            "average_validation_time": avg_validation_time,
            "validation_timeouts": self._metrics["validation_timeouts"],
            "validation_timeout_rate": (
                self._metrics["validation_timeouts"] / total_validations
                if total_validations > 0
                else 0
            )
        }
    
    def reset_metrics(self) -> None:
        """Reset performance metrics"""
        self._metrics = {
            "total_requests": 0,
            "validated_requests": 0,
            "validation_failures": 0,
            "validation_skipped": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "total_validation_time": 0.0,
            "validation_timeouts": 0
        }
    
    def clear_cache(self) -> None:
        """Clear schema and mapping caches"""
        self._schema_cache.clear()
        self._mapping_cache.clear()