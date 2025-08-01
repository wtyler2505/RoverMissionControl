"""
Example integration of AuditService with existing API security services

This file demonstrates how to update existing services to use the comprehensive
audit service instead of just the RBAC audit logger.
"""

from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from .audit_service import AuditService, SecurityEventType
from .audit_models import AuditCategory, AuditSeverity
from .service import APIKeyService
from .cors_service import CORSService
from .rate_limit_service import RateLimitService
from .schema_service import SchemaService

class EnhancedAPIKeyService(APIKeyService):
    """
    Example of APIKeyService enhanced with comprehensive audit logging
    """
    
    def __init__(self, db: Session, audit_service: AuditService):
        # Initialize with RBAC logger from audit service
        super().__init__(db, audit_service.rbac_logger)
        self.audit_service = audit_service
    
    async def create_api_key(self, user, name: str, **kwargs) -> tuple:
        """Override to add comprehensive audit logging"""
        # Capture before state
        before_state = {
            "user_id": user.id,
            "total_keys": len(user.api_keys) if hasattr(user, 'api_keys') else 0
        }
        
        # Call parent method
        api_key, full_key = super().create_api_key(user, name, **kwargs)
        
        # Capture after state
        after_state = {
            "user_id": user.id,
            "total_keys": len(user.api_keys) if hasattr(user, 'api_keys') else 0,
            "new_key_id": api_key.id,
            "new_key_name": api_key.name
        }
        
        # Log to comprehensive audit service
        await self.audit_service.log_api_key_event(
            api_key=api_key,
            event_type=SecurityEventType.API_KEY_CREATED,
            actor_id=user.id,
            details={
                "name": name,
                "scopes": kwargs.get('scopes', []),
                "expires_in_days": kwargs.get('expires_in_days'),
                "service_name": kwargs.get('service_name'),
                "allowed_ips": kwargs.get('allowed_ips'),
                "rate_limit": kwargs.get('rate_limit_per_minute')
            },
            before_state=before_state,
            after_state=after_state
        )
        
        return api_key, full_key
    
    async def validate_api_key(self, api_key_string: str, **kwargs) -> tuple:
        """Override to log validation attempts"""
        is_valid, api_key, error = super().validate_api_key(api_key_string, **kwargs)
        
        if not is_valid and api_key:
            # Log failed validation
            await self.audit_service.log_security_event(
                event_type=SecurityEventType.API_KEY_INVALID,
                category=AuditCategory.API_KEY,
                actor_id=api_key.id,
                actor_type="api_key",
                target_type="endpoint",
                target_id=kwargs.get('endpoint', 'unknown'),
                action="API key validation failed",
                action_details={
                    "error": error,
                    "ip_address": kwargs.get('ip_address'),
                    "origin": kwargs.get('origin'),
                    "required_scopes": kwargs.get('required_scopes')
                },
                severity=AuditSeverity.WARNING,
                success=False,
                error_message=error
            )
        
        return is_valid, api_key, error


class EnhancedCORSService(CORSService):
    """
    Example of CORSService enhanced with comprehensive audit logging
    """
    
    def __init__(self, db: Session, audit_service: AuditService):
        super().__init__(db)
        self.audit_service = audit_service
    
    async def create_policy(self, policy_data: Dict[str, Any], created_by: str) -> Any:
        """Create CORS policy with audit logging"""
        policy = super().create_policy(policy_data)
        
        await self.audit_service.log_security_event(
            event_type=SecurityEventType.CORS_POLICY_CREATED,
            category=AuditCategory.CORS,
            actor_id=created_by,
            actor_type="user",
            target_type="cors_policy",
            target_id=policy.id,
            action="CORS policy created",
            action_details={
                "name": policy.name,
                "allowed_origins": policy.allowed_origins,
                "allowed_methods": policy.allowed_methods,
                "policy_type": policy.policy_type,
                "priority": policy.priority
            },
            after_snapshot=policy_data
        )
        
        return policy
    
    async def log_cors_violation(self, origin: str, endpoint: str, method: str, 
                                violation_type: str, details: str):
        """Log CORS violations to audit service"""
        # Create violation record
        violation = super().create_violation_record(
            origin=origin,
            endpoint=endpoint,
            method=method,
            violation_type=violation_type,
            details=details
        )
        
        # Log to audit service
        await self.audit_service.log_cors_violation(
            violation=violation,
            request_details={
                "origin": origin,
                "endpoint": endpoint,
                "method": method,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )


class EnhancedRateLimitService(RateLimitService):
    """
    Example of RateLimitService enhanced with comprehensive audit logging
    """
    
    def __init__(self, db: Session, audit_service: AuditService):
        super().__init__(db, audit_service.rbac_logger)
        self.audit_service = audit_service
    
    async def check_rate_limit(self, identifier: str, endpoint: str, 
                              limit_type: str = "requests_per_minute") -> tuple:
        """Check rate limit with violation logging"""
        allowed, current_count, limit, reset_time = super().check_rate_limit(
            identifier, endpoint, limit_type
        )
        
        if not allowed:
            # Create violation record
            violation = self.create_violation_record(
                identifier=identifier,
                endpoint=endpoint,
                limit_type=limit_type,
                limit_value=limit,
                current_value=current_count,
                window_seconds=60
            )
            
            # Log to audit service
            await self.audit_service.log_rate_limit_violation(
                violation=violation,
                actor_id=identifier,
                actor_type="api_key" if identifier.startswith("key_") else "user"
            )
        
        return allowed, current_count, limit, reset_time


class EnhancedSchemaService(SchemaService):
    """
    Example of SchemaService enhanced with comprehensive audit logging
    """
    
    def __init__(self, db: Session, audit_service: AuditService):
        super().__init__(db)
        self.audit_service = audit_service
    
    async def validate_request(self, endpoint: str, method: str, 
                             request_data: Dict[str, Any], user_id: Optional[str] = None):
        """Validate request with failure logging"""
        is_valid, errors = super().validate_request(endpoint, method, request_data)
        
        if not is_valid:
            # Create validation log
            validation_log = self.create_validation_log(
                endpoint=endpoint,
                method=method,
                validation_type="request",
                errors=errors,
                request_data=request_data
            )
            
            # Log to audit service
            await self.audit_service.log_schema_validation_failure(
                validation_log=validation_log,
                actor_id=user_id
            )
        
        return is_valid, errors


# Example usage in middleware integration
class AuditingMiddleware:
    """
    Example middleware that uses the audit service for comprehensive logging
    """
    
    def __init__(self, audit_service: AuditService):
        self.audit_service = audit_service
    
    async def __call__(self, request, call_next):
        """Process request with audit logging"""
        # Set request context
        self.audit_service.set_request_context(
            request_id=request.headers.get("X-Request-ID", str(uuid.uuid4())),
            session_id=request.headers.get("X-Session-ID", ""),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent", ""),
            request_method=request.method,
            request_path=str(request.url.path),
            request_origin=request.headers.get("Origin", "")
        )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Log successful requests for sensitive endpoints
            if request.url.path.startswith("/api/security/"):
                await self.audit_service.log_security_event(
                    event_type=SecurityEventType.SECURITY_CONFIG_CHANGED,
                    category=AuditCategory.CONFIGURATION,
                    actor_id=getattr(request.state, "user_id", None),
                    actor_type="user" if hasattr(request.state, "user_id") else "anonymous",
                    target_type="endpoint",
                    target_id=str(request.url.path),
                    action=f"{request.method} {request.url.path}",
                    success=True
                )
            
            return response
            
        except Exception as e:
            # Log errors
            await self.audit_service.log_security_event(
                event_type=SecurityEventType.SECURITY_CONFIG_CHANGED,
                category=AuditCategory.ERROR,
                actor_id=getattr(request.state, "user_id", None),
                actor_type="user" if hasattr(request.state, "user_id") else "anonymous",
                target_type="endpoint",
                target_id=str(request.url.path),
                action=f"{request.method} {request.url.path}",
                success=False,
                error_message=str(e),
                severity=AuditSeverity.ERROR
            )
            raise
        finally:
            # Clear context
            self.audit_service.clear_request_context()


# Example of configuration change tracking
async def track_configuration_change(audit_service: AuditService, config_type: str, 
                                   config_id: str, user_id: str, 
                                   before_config: Dict[str, Any], 
                                   after_config: Dict[str, Any]):
    """
    Example function to track configuration changes with compliance impact
    """
    # Determine compliance impact
    compliance_impact = []
    
    # Check if security settings changed
    if config_type == "security_settings":
        if before_config.get("mfa_required") != after_config.get("mfa_required"):
            compliance_impact.extend([
                ComplianceFramework.SOX,
                ComplianceFramework.PCI_DSS
            ])
        
        if before_config.get("password_policy") != after_config.get("password_policy"):
            compliance_impact.extend([
                ComplianceFramework.ISO_27001,
                ComplianceFramework.HIPAA
            ])
    
    # Check if data retention changed
    if config_type == "retention_policy":
        compliance_impact.extend([
            ComplianceFramework.GDPR,
            ComplianceFramework.CCPA
        ])
    
    # Log the configuration change
    await audit_service.log_configuration_change(
        config_type=config_type,
        config_id=config_id,
        actor_id=user_id,
        before_config=before_config,
        after_config=after_config,
        compliance_impact=compliance_impact if compliance_impact else None
    )


# Example scheduled task for retention enforcement
async def scheduled_retention_enforcement(audit_service: AuditService):
    """
    Example scheduled task to enforce retention policies
    """
    import asyncio
    from datetime import datetime, timezone
    
    while True:
        try:
            # Run retention enforcement
            results = await audit_service.enforce_retention_policies()
            
            # Log the results
            await audit_service.log_security_event(
                event_type=SecurityEventType.AUDIT_PURGE_EXECUTED,
                category=AuditCategory.SYSTEM,
                actor_id="system",
                actor_type="system",
                action="Scheduled retention enforcement completed",
                action_details=results,
                severity=AuditSeverity.INFO
            )
            
            # Wait 24 hours before next run
            await asyncio.sleep(24 * 60 * 60)
            
        except Exception as e:
            # Log error
            await audit_service.log_security_event(
                event_type=SecurityEventType.COMPLIANCE_CHECK_FAILED,
                category=AuditCategory.SYSTEM,
                actor_id="system",
                actor_type="system",
                action="Retention enforcement failed",
                error_message=str(e),
                severity=AuditSeverity.ERROR,
                success=False
            )
            
            # Wait 1 hour before retry
            await asyncio.sleep(60 * 60)


# Example compliance report generation
async def generate_monthly_compliance_reports(audit_service: AuditService):
    """
    Example function to generate monthly compliance reports
    """
    from datetime import datetime, timedelta
    import calendar
    
    # Get last month's date range
    today = datetime.now(timezone.utc)
    first_day_this_month = today.replace(day=1)
    last_day_last_month = first_day_this_month - timedelta(days=1)
    first_day_last_month = last_day_last_month.replace(day=1)
    
    # Generate reports for each framework
    frameworks = [
        ComplianceFramework.SOX,
        ComplianceFramework.PCI_DSS,
        ComplianceFramework.GDPR,
        ComplianceFramework.HIPAA
    ]
    
    for framework in frameworks:
        try:
            report = audit_service.get_compliance_report(
                framework=framework,
                start_date=first_day_last_month,
                end_date=last_day_last_month,
                include_details=True
            )
            
            # Export the report
            export = await audit_service.export_logs(
                start_date=first_day_last_month,
                end_date=last_day_last_month,
                categories=None,  # Include all categories
                event_types=None,  # Include all event types
                format="json",
                compress=True,
                encrypt=True,
                reason=f"Monthly {framework.value} compliance report",
                approved_by="system"
            )
            
            # Log report generation
            await audit_service.log_security_event(
                event_type=SecurityEventType.AUDIT_EXPORT_CREATED,
                category=AuditCategory.COMPLIANCE,
                actor_id="system",
                actor_type="system",
                target_type="compliance_report",
                target_id=export.id,
                action=f"Generated {framework.value} compliance report",
                action_details={
                    "framework": framework.value,
                    "period": f"{first_day_last_month.isoformat()} to {last_day_last_month.isoformat()}",
                    "total_events": report["summary"]["total_events"],
                    "critical_events": report["critical_events"]
                },
                compliance_frameworks=[framework]
            )
            
        except Exception as e:
            # Log error
            await audit_service.log_security_event(
                event_type=SecurityEventType.COMPLIANCE_CHECK_FAILED,
                category=AuditCategory.COMPLIANCE,
                actor_id="system",
                actor_type="system",
                action=f"Failed to generate {framework.value} report",
                error_message=str(e),
                severity=AuditSeverity.ERROR,
                success=False,
                compliance_frameworks=[framework]
            )


# Import required modules
import uuid
from .audit_models import ComplianceFramework