"""
Enhanced Rate Limiting Middleware with Database Integration

Provides advanced rate limiting with policy management and monitoring
"""
from typing import Optional, List, Dict, Any
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp
import time
from datetime import datetime
import logging

from sqlalchemy.orm import Session
from ..database import get_db
from .rate_limit_service import RateLimitService
from ..rbac.audit import AuditLogger

logger = logging.getLogger(__name__)


class EnhancedRateLimitMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for rate limiting with database integration"""
    
    def __init__(
        self,
        app: ASGIApp,
        exclude_paths: Optional[List[str]] = None
    ):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/api/health", "/docs", "/redoc", "/api/security/rate-limits/metrics"]
        
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """Process request with enhanced rate limiting"""
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
            
        # Get database session
        db = next(get_db())
        try:
            # Get services from app state
            audit_logger = request.app.state.audit_logger
            rate_limit_service = RateLimitService(db, audit_logger)
            
            # Build identifier and metadata
            api_key_id = None
            user_id = None
            identifier = None
            
            if hasattr(request.state, "api_key"):
                api_key_id = request.state.api_key.id
                identifier = f"api_key:{api_key_id}"
            elif hasattr(request.state, "user"):
                user_id = request.state.user.id
                identifier = f"user:{user_id}"
            else:
                # Use IP address
                ip_address = request.client.host if request.client else "unknown"
                identifier = f"ip:{ip_address}"
                
            # Get request details
            endpoint = request.url.path
            method = request.method
            ip_address = request.client.host if request.client else None
            
            # Check rate limit
            allowed, policy, info = rate_limit_service.check_rate_limit(
                identifier=identifier,
                endpoint=endpoint,
                method=method,
                api_key_id=api_key_id,
                user_id=user_id,
                ip_address=ip_address
            )
            
            if not allowed:
                # Build error response
                error_message = policy.custom_error_message or info.get("reason", "Rate limit exceeded")
                
                response_data = {
                    "error": error_message,
                    "retry_after_seconds": info.get("retry_after_seconds"),
                    "limit": info.get("limit"),
                    "window": info.get("window"),
                    "policy": policy.name if policy else None
                }
                
                # Add burst info if applicable
                if "burst_info" in info:
                    response_data["burst_info"] = info["burst_info"]
                    
                headers = {
                    "Retry-After": str(info.get("retry_after_seconds", 60)),
                    "X-RateLimit-Limit": str(info.get("limit", 0)),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": info.get("reset_at", "")
                }
                
                # Add custom headers from policy
                if policy and policy.custom_headers:
                    headers.update(policy.custom_headers)
                    
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content=response_data,
                    headers=headers
                )
                
            # Process request
            start_time = time.time()
            response = await call_next(request)
            response_time = (time.time() - start_time) * 1000  # Convert to ms
            
            # Add rate limit headers
            if info:
                response.headers["X-RateLimit-Limit"] = str(info.get("limit", ""))
                response.headers["X-RateLimit-Remaining"] = str(info.get("remaining", ""))
                response.headers["X-RateLimit-Window"] = info.get("window", "")
                
            # Log metrics (async task to avoid blocking)
            if hasattr(request.state, "request_id"):
                request.state.rate_limit_info = {
                    "identifier": identifier,
                    "policy": policy.name if policy else None,
                    "response_time_ms": response_time
                }
                
            return response
            
        except Exception as e:
            logger.error(f"Rate limit middleware error: {str(e)}", exc_info=True)
            # On error, allow request to proceed
            return await call_next(request)
        finally:
            db.close()
            

class RateLimitMetricsCollector:
    """Background task to collect rate limit metrics"""
    
    def __init__(self, db_session_factory, interval_seconds: int = 300):
        self.db_session_factory = db_session_factory
        self.interval_seconds = interval_seconds
        self.running = False
        
    async def start(self):
        """Start metrics collection"""
        import asyncio
        self.running = True
        
        while self.running:
            try:
                db = self.db_session_factory()
                audit_logger = AuditLogger(db)
                service = RateLimitService(db, audit_logger)
                
                # Collect metrics
                service.collect_metrics(bucket_minutes=5)
                
                # Clean up old cache entries
                self._cleanup_expired_cache(db)
                
                db.close()
                
            except Exception as e:
                logger.error(f"Metrics collection error: {str(e)}", exc_info=True)
                
            await asyncio.sleep(self.interval_seconds)
            
    def stop(self):
        """Stop metrics collection"""
        self.running = False
        
    def _cleanup_expired_cache(self, db: Session):
        """Clean up expired cache entries"""
        from .rate_limit_models import RateLimitCache
        
        now = datetime.utcnow()
        expired = db.query(RateLimitCache).filter(
            RateLimitCache.expires_at < now
        ).delete()
        
        if expired > 0:
            db.commit()
            logger.info(f"Cleaned up {expired} expired rate limit cache entries")