"""
Comprehensive Audit Service for API Security
Extends RBAC audit logger with enhanced security event logging, compliance reporting,
and integration with all API security services.
"""
import uuid
import hashlib
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from sqlalchemy.exc import SQLAlchemyError
import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend

from ..rbac.audit import AuditLogger
from ..rbac.models import AuditAction
from ..auth.models import User
from .audit_models import (
    SecurityAuditLog, AuditSnapshot, AuditRetentionPolicy,
    AuditExport, AuditAlert, AuditCategory, AuditSeverity,
    ComplianceFramework
)
from .models import APIKey, APIKeyUsage
from .cors_models import CORSPolicy, CORSViolation
from .rate_limit_models import RateLimitViolation
from .schema_models import ValidationLog
from .signing_models import SignatureVerification

logger = structlog.get_logger()

class SecurityEventType(str, Enum):
    """Detailed security event types"""
    # API Key Events
    API_KEY_CREATED = "api_key_created"
    API_KEY_REVOKED = "api_key_revoked"
    API_KEY_ROTATED = "api_key_rotated"
    API_KEY_USED = "api_key_used"
    API_KEY_INVALID = "api_key_invalid"
    API_KEY_EXPIRED = "api_key_expired"
    
    # CORS Events
    CORS_POLICY_CREATED = "cors_policy_created"
    CORS_POLICY_UPDATED = "cors_policy_updated"
    CORS_POLICY_DELETED = "cors_policy_deleted"
    CORS_VIOLATION = "cors_violation"
    CORS_PREFLIGHT_FAILED = "cors_preflight_failed"
    
    # Rate Limit Events
    RATE_LIMIT_CONFIGURED = "rate_limit_configured"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    RATE_LIMIT_RESET = "rate_limit_reset"
    RATE_LIMIT_BYPASSED = "rate_limit_bypassed"
    
    # Schema Validation Events
    SCHEMA_CREATED = "schema_created"
    SCHEMA_UPDATED = "schema_updated"
    SCHEMA_VALIDATION_FAILED = "schema_validation_failed"
    SCHEMA_VALIDATION_BYPASSED = "schema_validation_bypassed"
    
    # Request Signing Events
    SIGNATURE_VERIFIED = "signature_verified"
    SIGNATURE_FAILED = "signature_failed"
    SIGNING_KEY_ROTATED = "signing_key_rotated"
    
    # Configuration Events
    SECURITY_CONFIG_CHANGED = "security_config_changed"
    COMPLIANCE_SETTING_CHANGED = "compliance_setting_changed"
    RETENTION_POLICY_CHANGED = "retention_policy_changed"
    ALERT_RULE_CHANGED = "alert_rule_changed"
    
    # System Events
    AUDIT_EXPORT_CREATED = "audit_export_created"
    AUDIT_PURGE_EXECUTED = "audit_purge_executed"
    SECURITY_SCAN_COMPLETED = "security_scan_completed"
    COMPLIANCE_CHECK_FAILED = "compliance_check_failed"

class AuditService:
    """
    Comprehensive audit service that extends RBAC audit logger
    with API security event logging and compliance features
    """
    
    def __init__(self, db: Session, rbac_audit_logger: Optional[AuditLogger] = None):
        self.db = db
        self.rbac_logger = rbac_audit_logger or AuditLogger(db)
        self._encryption_key = self._get_or_create_encryption_key()
        self._signing_key = self._get_or_create_signing_key()
        self._request_context = {}
        
    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for sensitive data"""
        # In production, this should be loaded from secure key management
        # For now, generate a key if not exists
        import os
        key_file = os.environ.get('AUDIT_ENCRYPTION_KEY_FILE', '.audit_key')
        
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(key)
            return key
    
    def _get_or_create_signing_key(self) -> rsa.RSAPrivateKey:
        """Get or create RSA key for signing audit logs"""
        import os
        key_file = os.environ.get('AUDIT_SIGNING_KEY_FILE', '.audit_signing_key')
        
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )
        else:
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )
            pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            with open(key_file, 'wb') as f:
                f.write(pem)
            return private_key
    
    def set_request_context(self, **kwargs):
        """Set request context for audit logging"""
        self._request_context = kwargs
        # Also set context in RBAC logger
        if 'request_id' in kwargs:
            self.rbac_logger.set_request_context(
                request_id=kwargs.get('request_id'),
                session_id=kwargs.get('session_id', ''),
                ip_address=kwargs.get('ip_address', ''),
                user_agent=kwargs.get('user_agent', '')
            )
    
    def clear_request_context(self):
        """Clear request context"""
        self._request_context = {}
        self.rbac_logger.clear_request_context()
    
    async def log_security_event(
        self,
        event_type: SecurityEventType,
        category: AuditCategory,
        actor_id: Optional[str] = None,
        actor_type: str = "system",
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        action: str = "",
        action_details: Optional[Dict[str, Any]] = None,
        severity: AuditSeverity = AuditSeverity.INFO,
        success: bool = True,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        before_snapshot: Optional[Dict[str, Any]] = None,
        after_snapshot: Optional[Dict[str, Any]] = None,
        compliance_frameworks: Optional[List[ComplianceFramework]] = None,
        personal_data_involved: bool = False,
        financial_data_involved: bool = False,
        health_data_involved: bool = False
    ) -> SecurityAuditLog:
        """
        Log a comprehensive security event with all metadata
        """
        try:
            # Create before/after snapshots if provided
            before_snapshot_id = None
            after_snapshot_id = None
            
            if before_snapshot:
                before_snap = await self._create_snapshot(
                    data=before_snapshot,
                    entity_type=target_type or "unknown",
                    entity_id=target_id or str(uuid.uuid4())
                )
                before_snapshot_id = before_snap.id
            
            if after_snapshot:
                after_snap = await self._create_snapshot(
                    data=after_snapshot,
                    entity_type=target_type or "unknown",
                    entity_id=target_id or str(uuid.uuid4())
                )
                after_snapshot_id = after_snap.id
            
            # Get previous log for chaining
            previous_log = self.db.query(SecurityAuditLog)\
                .order_by(desc(SecurityAuditLog.timestamp))\
                .first()
            
            # Create audit log entry
            audit_log = SecurityAuditLog(
                category=category.value,
                event_type=event_type.value,
                severity=severity.value,
                actor_id=actor_id,
                actor_type=actor_type,
                actor_details={"api_key_id": self._request_context.get('api_key_id')} if actor_type == "api_key" else None,
                target_type=target_type,
                target_id=target_id,
                target_details=action_details,
                action=action,
                action_details=action_details,
                success=success,
                error_code=error_code,
                error_message=error_message,
                before_snapshot_id=before_snapshot_id,
                after_snapshot_id=after_snapshot_id,
                compliance_frameworks=[f.value for f in (compliance_frameworks or [])],
                personal_data_involved=personal_data_involved,
                financial_data_involved=financial_data_involved,
                health_data_involved=health_data_involved,
                previous_log_id=previous_log.id if previous_log else None,
                **self._request_context
            )
            
            # Calculate checksum
            audit_log.checksum = audit_log.calculate_checksum()
            
            # Sign the log entry
            audit_log.signature = self._sign_log_entry(audit_log)
            
            self.db.add(audit_log)
            self.db.commit()
            
            # Check alerts
            await self._check_alerts(audit_log)
            
            # Also log to RBAC logger if it's a permission-related event
            if category in [AuditCategory.AUTHORIZATION, AuditCategory.ACCESS_CONTROL]:
                self._log_to_rbac(audit_log)
            
            return audit_log
            
        except Exception as e:
            logger.error(f"Failed to log security event: {str(e)}")
            self.db.rollback()
            raise
    
    def _sign_log_entry(self, audit_log: SecurityAuditLog) -> bytes:
        """Digitally sign an audit log entry"""
        message = f"{audit_log.checksum}:{audit_log.timestamp.isoformat()}"
        signature = self._signing_key.sign(
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature
    
    async def _create_snapshot(
        self,
        data: Dict[str, Any],
        entity_type: str,
        entity_id: str
    ) -> AuditSnapshot:
        """Create an encrypted snapshot of data"""
        # Get version number
        last_snapshot = self.db.query(AuditSnapshot)\
            .filter(and_(
                AuditSnapshot.entity_type == entity_type,
                AuditSnapshot.entity_id == entity_id
            ))\
            .order_by(desc(AuditSnapshot.version))\
            .first()
        
        version = (last_snapshot.version + 1) if last_snapshot else 1
        
        # Create snapshot
        snapshot = AuditSnapshot.create_encrypted_snapshot(
            data=data,
            entity_type=entity_type,
            entity_id=entity_id,
            version=version,
            encryption_key=self._encryption_key
        )
        
        # Seal the snapshot
        snapshot.seal_timestamp = datetime.now(timezone.utc)
        snapshot.seal_signature = self._sign_log_entry(snapshot)
        
        self.db.add(snapshot)
        return snapshot
    
    async def _check_alerts(self, audit_log: SecurityAuditLog):
        """Check if any alerts should be triggered"""
        active_alerts = self.db.query(AuditAlert)\
            .filter(AuditAlert.is_active == True)\
            .all()
        
        for alert in active_alerts:
            if alert.should_trigger(audit_log):
                await self._trigger_alert(alert, audit_log)
    
    async def _trigger_alert(self, alert: AuditAlert, audit_log: SecurityAuditLog):
        """Trigger an alert"""
        try:
            # Update alert metadata
            alert.last_triggered_at = datetime.now(timezone.utc)
            alert.trigger_count += 1
            
            # Log the alert trigger
            await self.log_security_event(
                event_type=SecurityEventType.SECURITY_CONFIG_CHANGED,
                category=AuditCategory.SECURITY_ALERT,
                action=f"Alert triggered: {alert.name}",
                action_details={
                    "alert_id": alert.id,
                    "alert_name": alert.name,
                    "triggered_by_log_id": audit_log.id,
                    "trigger_count": alert.trigger_count
                },
                severity=AuditSeverity.WARNING
            )
            
            # Execute auto-response actions
            if alert.auto_block_actor and audit_log.actor_id:
                await self._block_actor(audit_log.actor_id, f"Auto-blocked by alert: {alert.name}")
            
            if alert.auto_revoke_permissions and audit_log.actor_id:
                await self._revoke_permissions(audit_log.actor_id, f"Auto-revoked by alert: {alert.name}")
            
            # Send notifications (implement notification service integration)
            # await self._send_alert_notifications(alert, audit_log)
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to trigger alert {alert.id}: {str(e)}")
    
    async def _block_actor(self, actor_id: str, reason: str):
        """Block an actor (user or API key)"""
        # Check if it's a user
        user = self.db.query(User).filter(User.id == actor_id).first()
        if user:
            user.is_active = False
            await self.log_security_event(
                event_type=SecurityEventType.SECURITY_CONFIG_CHANGED,
                category=AuditCategory.ACCESS_CONTROL,
                target_type="user",
                target_id=actor_id,
                action="User blocked",
                action_details={"reason": reason},
                severity=AuditSeverity.CRITICAL
            )
        
        # Check if it's an API key
        api_key = self.db.query(APIKey).filter(APIKey.id == actor_id).first()
        if api_key:
            api_key.is_active = False
            api_key.revoked_at = datetime.now(timezone.utc)
            api_key.revocation_reason = reason
            await self.log_security_event(
                event_type=SecurityEventType.API_KEY_REVOKED,
                category=AuditCategory.API_KEY,
                target_type="api_key",
                target_id=actor_id,
                action="API key revoked",
                action_details={"reason": reason},
                severity=AuditSeverity.CRITICAL
            )
    
    async def _revoke_permissions(self, actor_id: str, reason: str):
        """Revoke permissions for an actor"""
        # This would integrate with RBAC service
        # For now, just log the intent
        await self.log_security_event(
            event_type=SecurityEventType.SECURITY_CONFIG_CHANGED,
            category=AuditCategory.AUTHORIZATION,
            target_type="user",
            target_id=actor_id,
            action="Permissions revoked",
            action_details={"reason": reason},
            severity=AuditSeverity.CRITICAL
        )
    
    def _log_to_rbac(self, audit_log: SecurityAuditLog):
        """Mirror important events to RBAC audit logger"""
        action_map = {
            SecurityEventType.API_KEY_CREATED: AuditAction.RESOURCE_CREATED,
            SecurityEventType.API_KEY_REVOKED: AuditAction.RESOURCE_DELETED,
            SecurityEventType.API_KEY_INVALID: AuditAction.PERMISSION_DENIED,
            SecurityEventType.RATE_LIMIT_EXCEEDED: AuditAction.PERMISSION_DENIED,
            SecurityEventType.SIGNATURE_FAILED: AuditAction.PERMISSION_DENIED,
        }
        
        rbac_action = action_map.get(
            SecurityEventType(audit_log.event_type),
            AuditAction.RESOURCE_ACCESSED
        )
        
        if audit_log.actor_id and audit_log.actor_type == "user":
            self.rbac_logger.log_action(
                user_id=audit_log.actor_id,
                action=rbac_action,
                resource_type=audit_log.target_type,
                resource_id=audit_log.target_id,
                details=audit_log.action_details,
                success=audit_log.success,
                error_message=audit_log.error_message
            )
    
    # Integration methods for API security services
    
    async def log_api_key_event(
        self,
        api_key: APIKey,
        event_type: SecurityEventType,
        actor_id: str,
        details: Optional[Dict[str, Any]] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None
    ):
        """Log API key related events"""
        await self.log_security_event(
            event_type=event_type,
            category=AuditCategory.API_KEY,
            actor_id=actor_id,
            actor_type="user",
            target_type="api_key",
            target_id=api_key.id,
            action=f"API Key {event_type.value.replace('_', ' ')}",
            action_details=details,
            before_snapshot=before_state,
            after_snapshot=after_state,
            financial_data_involved=True  # API keys often access financial data
        )
    
    async def log_cors_violation(
        self,
        violation: CORSViolation,
        request_details: Dict[str, Any]
    ):
        """Log CORS policy violations"""
        await self.log_security_event(
            event_type=SecurityEventType.CORS_VIOLATION,
            category=AuditCategory.CORS,
            actor_id=request_details.get('ip_address'),
            actor_type="external",
            target_type="endpoint",
            target_id=violation.endpoint,
            action="CORS policy violation",
            action_details={
                "origin": violation.origin,
                "method": violation.method,
                "headers": violation.headers,
                "policy_id": violation.policy_id,
                "violation_type": violation.violation_type
            },
            severity=AuditSeverity.WARNING,
            success=False,
            error_message=violation.violation_details
        )
    
    async def log_rate_limit_violation(
        self,
        violation: RateLimitViolation,
        actor_id: str,
        actor_type: str = "user"
    ):
        """Log rate limit violations"""
        await self.log_security_event(
            event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
            category=AuditCategory.RATE_LIMIT,
            actor_id=actor_id,
            actor_type=actor_type,
            target_type="endpoint",
            target_id=violation.endpoint,
            action="Rate limit exceeded",
            action_details={
                "limit_type": violation.limit_type,
                "limit_value": violation.limit_value,
                "current_value": violation.current_value,
                "window_seconds": violation.window_seconds
            },
            severity=AuditSeverity.WARNING,
            success=False
        )
    
    async def log_schema_validation_failure(
        self,
        validation_log: ValidationLog,
        actor_id: Optional[str] = None
    ):
        """Log schema validation failures"""
        await self.log_security_event(
            event_type=SecurityEventType.SCHEMA_VALIDATION_FAILED,
            category=AuditCategory.SCHEMA_VALIDATION,
            actor_id=actor_id,
            actor_type="user" if actor_id else "system",
            target_type="endpoint",
            target_id=validation_log.endpoint,
            action="Schema validation failed",
            action_details={
                "schema_id": validation_log.schema_id,
                "validation_type": validation_log.validation_type,
                "error_count": validation_log.error_count,
                "errors": validation_log.error_details
            },
            severity=AuditSeverity.ERROR,
            success=False,
            error_message=f"Schema validation failed with {validation_log.error_count} errors"
        )
    
    async def log_configuration_change(
        self,
        config_type: str,
        config_id: str,
        actor_id: str,
        before_config: Dict[str, Any],
        after_config: Dict[str, Any],
        compliance_impact: Optional[List[ComplianceFramework]] = None
    ):
        """Log configuration changes with before/after snapshots"""
        await self.log_security_event(
            event_type=SecurityEventType.SECURITY_CONFIG_CHANGED,
            category=AuditCategory.CONFIGURATION,
            actor_id=actor_id,
            actor_type="user",
            target_type=config_type,
            target_id=config_id,
            action=f"{config_type} configuration updated",
            before_snapshot=before_config,
            after_snapshot=after_config,
            compliance_frameworks=compliance_impact,
            severity=AuditSeverity.WARNING
        )
    
    # Compliance and reporting methods
    
    def get_compliance_report(
        self,
        framework: ComplianceFramework,
        start_date: datetime,
        end_date: datetime,
        include_details: bool = False
    ) -> Dict[str, Any]:
        """Generate compliance report for specific framework"""
        # Get relevant logs
        logs = self.db.query(SecurityAuditLog).filter(
            and_(
                SecurityAuditLog.timestamp >= start_date,
                SecurityAuditLog.timestamp <= end_date,
                SecurityAuditLog.compliance_frameworks.contains([framework.value])
            )
        ).all()
        
        # Get retention policy
        policy = self.db.query(AuditRetentionPolicy).filter(
            AuditRetentionPolicy.compliance_framework == framework.value
        ).first()
        
        report = {
            "framework": framework.value,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "summary": {
                "total_events": len(logs),
                "categories": {},
                "severity_breakdown": {},
                "data_classification": {
                    "personal_data_events": sum(1 for log in logs if log.personal_data_involved),
                    "financial_data_events": sum(1 for log in logs if log.financial_data_involved),
                    "health_data_events": sum(1 for log in logs if log.health_data_involved)
                }
            },
            "retention_compliance": {
                "policy_exists": policy is not None,
                "retention_days": policy.retention_days if policy else None,
                "archive_configured": policy.archive_after_days if policy else None
            }
        }
        
        # Category breakdown
        for log in logs:
            cat = log.category
            report["summary"]["categories"][cat] = report["summary"]["categories"].get(cat, 0) + 1
            
            sev = log.severity
            report["summary"]["severity_breakdown"][sev] = report["summary"]["severity_breakdown"].get(sev, 0) + 1
        
        # Add critical events
        critical_events = [log for log in logs if log.severity == AuditSeverity.CRITICAL.value]
        report["critical_events"] = len(critical_events)
        
        if include_details:
            report["critical_event_details"] = [
                {
                    "timestamp": log.timestamp.isoformat(),
                    "event_type": log.event_type,
                    "actor": log.actor_id,
                    "target": f"{log.target_type}:{log.target_id}",
                    "action": log.action
                }
                for log in critical_events
            ]
        
        return report
    
    async def enforce_retention_policies(self) -> Dict[str, int]:
        """Enforce retention policies and return counts of processed logs"""
        results = {
            "archived": 0,
            "deleted": 0,
            "errors": 0
        }
        
        policies = self.db.query(AuditRetentionPolicy).filter(
            AuditRetentionPolicy.is_active == True
        ).order_by(desc(AuditRetentionPolicy.priority)).all()
        
        for policy in policies:
            try:
                # Archive logs
                if policy.archive_after_days:
                    archive_before = datetime.now(timezone.utc) - timedelta(days=policy.archive_after_days)
                    logs_to_archive = self._get_logs_for_policy(policy, archive_before)
                    
                    for log in logs_to_archive:
                        if await self._archive_log(log, policy):
                            results["archived"] += 1
                
                # Delete logs
                if policy.delete_after_days and not policy.legal_hold:
                    delete_before = datetime.now(timezone.utc) - timedelta(days=policy.delete_after_days)
                    logs_to_delete = self._get_logs_for_policy(policy, delete_before)
                    
                    for log in logs_to_delete:
                        if await self._delete_log(log):
                            results["deleted"] += 1
                            
            except Exception as e:
                logger.error(f"Error enforcing retention policy {policy.id}: {str(e)}")
                results["errors"] += 1
        
        # Log retention enforcement
        await self.log_security_event(
            event_type=SecurityEventType.AUDIT_PURGE_EXECUTED,
            category=AuditCategory.SYSTEM,
            action="Retention policies enforced",
            action_details=results,
            severity=AuditSeverity.INFO
        )
        
        return results
    
    def _get_logs_for_policy(
        self,
        policy: AuditRetentionPolicy,
        before_date: datetime
    ) -> List[SecurityAuditLog]:
        """Get logs matching retention policy criteria"""
        query = self.db.query(SecurityAuditLog).filter(
            SecurityAuditLog.timestamp < before_date
        )
        
        if policy.category:
            query = query.filter(SecurityAuditLog.category == policy.category)
        
        if policy.event_type_pattern:
            query = query.filter(
                SecurityAuditLog.event_type.op('~')(policy.event_type_pattern)
            )
        
        if policy.severity_threshold:
            # Filter by minimum severity
            severity_order = {
                AuditSeverity.INFO.value: 0,
                AuditSeverity.WARNING.value: 1,
                AuditSeverity.ERROR.value: 2,
                AuditSeverity.CRITICAL.value: 3
            }
            threshold_level = severity_order.get(policy.severity_threshold, 0)
            
            valid_severities = [
                sev for sev, level in severity_order.items()
                if level >= threshold_level
            ]
            query = query.filter(SecurityAuditLog.severity.in_(valid_severities))
        
        # Apply data type filters
        if not policy.applies_to_personal_data:
            query = query.filter(SecurityAuditLog.personal_data_involved == False)
        
        if not policy.applies_to_financial_data:
            query = query.filter(SecurityAuditLog.financial_data_involved == False)
        
        if not policy.applies_to_health_data:
            query = query.filter(SecurityAuditLog.health_data_involved == False)
        
        return query.all()
    
    async def _archive_log(self, log: SecurityAuditLog, policy: AuditRetentionPolicy) -> bool:
        """Archive a log entry"""
        try:
            # Create archive export
            export = await self.export_logs(
                start_date=log.timestamp,
                end_date=log.timestamp,
                log_ids=[log.id],
                format="json",
                compress=policy.compress_archived,
                encrypt=policy.encrypt_archived,
                reason=f"Automated archive per policy {policy.name}"
            )
            
            # Mark log as archived (add archived flag to model if needed)
            log.tags = log.tags or {}
            log.tags["archived"] = True
            log.tags["archive_export_id"] = export.id
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to archive log {log.id}: {str(e)}")
            return False
    
    async def _delete_log(self, log: SecurityAuditLog) -> bool:
        """Delete a log entry (with safety checks)"""
        try:
            # Verify log is archived
            if not (log.tags and log.tags.get("archived")):
                logger.warning(f"Refusing to delete non-archived log {log.id}")
                return False
            
            # Delete associated snapshots
            if log.before_snapshot_id:
                snapshot = self.db.query(AuditSnapshot).filter(
                    AuditSnapshot.id == log.before_snapshot_id
                ).first()
                if snapshot:
                    self.db.delete(snapshot)
            
            if log.after_snapshot_id:
                snapshot = self.db.query(AuditSnapshot).filter(
                    AuditSnapshot.id == log.after_snapshot_id
                ).first()
                if snapshot:
                    self.db.delete(snapshot)
            
            # Delete the log
            self.db.delete(log)
            self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete log {log.id}: {str(e)}")
            self.db.rollback()
            return False
    
    async def export_logs(
        self,
        start_date: datetime,
        end_date: datetime,
        categories: Optional[List[AuditCategory]] = None,
        event_types: Optional[List[SecurityEventType]] = None,
        actors: Optional[List[str]] = None,
        log_ids: Optional[List[str]] = None,
        format: str = "json",
        compress: bool = False,
        encrypt: bool = False,
        reason: str = "",
        approved_by: Optional[str] = None
    ) -> AuditExport:
        """Export audit logs with tracking"""
        try:
            # Build query
            query = self.db.query(SecurityAuditLog).filter(
                and_(
                    SecurityAuditLog.timestamp >= start_date,
                    SecurityAuditLog.timestamp <= end_date
                )
            )
            
            if log_ids:
                query = query.filter(SecurityAuditLog.id.in_(log_ids))
            
            if categories:
                query = query.filter(
                    SecurityAuditLog.category.in_([c.value for c in categories])
                )
            
            if event_types:
                query = query.filter(
                    SecurityAuditLog.event_type.in_([e.value for e in event_types])
                )
            
            if actors:
                query = query.filter(SecurityAuditLog.actor_id.in_(actors))
            
            logs = query.all()
            
            # Export data
            if format == "json":
                export_data = self._export_as_json(logs)
            elif format == "csv":
                export_data = self._export_as_csv(logs)
            elif format == "xml":
                export_data = self._export_as_xml(logs)
            else:
                raise ValueError(f"Unsupported export format: {format}")
            
            # Compress if requested
            if compress:
                import gzip
                export_data = gzip.compress(export_data.encode())
                compression = "gzip"
            else:
                export_data = export_data.encode()
                compression = None
            
            # Encrypt if requested
            if encrypt:
                f = Fernet(self._encryption_key)
                export_data = f.encrypt(export_data)
                encryption = "aes256"
            else:
                encryption = None
            
            # Calculate checksum
            checksum = hashlib.sha256(export_data).hexdigest()
            
            # Store export (in production, would store to S3/blob storage)
            import os
            export_id = str(uuid.uuid4())
            export_path = f"/tmp/audit_export_{export_id}.{format}"
            if compress:
                export_path += ".gz"
            if encrypt:
                export_path += ".enc"
            
            with open(export_path, 'wb') as f:
                f.write(export_data)
            
            # Check for sensitive data
            has_personal_data = any(log.personal_data_involved for log in logs)
            has_financial_data = any(log.financial_data_involved for log in logs)
            has_health_data = any(log.health_data_involved for log in logs)
            
            # Determine applicable compliance frameworks
            frameworks = set()
            for log in logs:
                if log.compliance_frameworks:
                    frameworks.update(log.compliance_frameworks)
            
            # Create export record
            export = AuditExport(
                id=export_id,
                exported_by=self._request_context.get('user_id', 'system'),
                export_reason=reason,
                start_date=start_date,
                end_date=end_date,
                categories=[c.value for c in (categories or [])],
                event_types=[e.value for e in (event_types or [])],
                actors=actors,
                format=format,
                compression=compression,
                encryption=encryption,
                total_records=len(logs),
                file_size_bytes=len(export_data),
                storage_type="local",
                storage_path=export_path,
                storage_checksum=checksum,
                compliance_frameworks=list(frameworks),
                includes_personal_data=has_personal_data,
                includes_financial_data=has_financial_data,
                includes_health_data=has_health_data,
                export_approved_by=approved_by,
                approval_timestamp=datetime.now(timezone.utc) if approved_by else None,
                status="completed"
            )
            
            self.db.add(export)
            self.db.commit()
            
            # Log the export
            await self.log_security_event(
                event_type=SecurityEventType.AUDIT_EXPORT_CREATED,
                category=AuditCategory.COMPLIANCE,
                actor_id=export.exported_by,
                actor_type="user",
                target_type="audit_export",
                target_id=export.id,
                action="Audit logs exported",
                action_details={
                    "record_count": export.total_records,
                    "format": format,
                    "date_range": f"{start_date.isoformat()} to {end_date.isoformat()}",
                    "frameworks": list(frameworks)
                },
                compliance_frameworks=[ComplianceFramework(f) for f in frameworks]
            )
            
            return export
            
        except Exception as e:
            logger.error(f"Failed to export audit logs: {str(e)}")
            raise
    
    def _export_as_json(self, logs: List[SecurityAuditLog]) -> str:
        """Export logs as JSON"""
        data = []
        for log in logs:
            entry = {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "category": log.category,
                "event_type": log.event_type,
                "severity": log.severity,
                "actor": {
                    "id": log.actor_id,
                    "type": log.actor_type,
                    "details": log.actor_details
                },
                "target": {
                    "type": log.target_type,
                    "id": log.target_id,
                    "details": log.target_details
                },
                "action": log.action,
                "action_details": log.action_details,
                "success": log.success,
                "error": {
                    "code": log.error_code,
                    "message": log.error_message
                } if log.error_code else None,
                "request_context": {
                    "id": log.request_id,
                    "session_id": log.session_id,
                    "ip_address": log.ip_address,
                    "user_agent": log.user_agent,
                    "method": log.request_method,
                    "path": log.request_path,
                    "origin": log.request_origin
                },
                "compliance": {
                    "frameworks": log.compliance_frameworks,
                    "personal_data": log.personal_data_involved,
                    "financial_data": log.financial_data_involved,
                    "health_data": log.health_data_involved
                },
                "integrity": {
                    "checksum": log.checksum,
                    "previous_log_id": log.previous_log_id,
                    "signature": log.signature.hex() if log.signature else None
                }
            }
            data.append(entry)
        
        return json.dumps(data, indent=2)
    
    def _export_as_csv(self, logs: List[SecurityAuditLog]) -> str:
        """Export logs as CSV"""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID", "Timestamp", "Category", "Event Type", "Severity",
            "Actor ID", "Actor Type", "Target Type", "Target ID",
            "Action", "Success", "Error Code", "Error Message",
            "IP Address", "User Agent", "Request Method", "Request Path",
            "Compliance Frameworks", "Personal Data", "Financial Data", "Health Data",
            "Checksum"
        ])
        
        # Data
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.isoformat(),
                log.category,
                log.event_type,
                log.severity,
                log.actor_id or "",
                log.actor_type,
                log.target_type or "",
                log.target_id or "",
                log.action,
                log.success,
                log.error_code or "",
                log.error_message or "",
                log.ip_address or "",
                log.user_agent or "",
                log.request_method or "",
                log.request_path or "",
                ";".join(log.compliance_frameworks or []),
                log.personal_data_involved,
                log.financial_data_involved,
                log.health_data_involved,
                log.checksum
            ])
        
        return output.getvalue()
    
    def _export_as_xml(self, logs: List[SecurityAuditLog]) -> str:
        """Export logs as XML"""
        import xml.etree.ElementTree as ET
        
        root = ET.Element("AuditLogs")
        root.set("exportDate", datetime.now(timezone.utc).isoformat())
        root.set("count", str(len(logs)))
        
        for log in logs:
            entry = ET.SubElement(root, "AuditLog")
            entry.set("id", log.id)
            
            # Basic fields
            ET.SubElement(entry, "Timestamp").text = log.timestamp.isoformat()
            ET.SubElement(entry, "Category").text = log.category
            ET.SubElement(entry, "EventType").text = log.event_type
            ET.SubElement(entry, "Severity").text = log.severity
            
            # Actor
            actor = ET.SubElement(entry, "Actor")
            if log.actor_id:
                actor.set("id", log.actor_id)
            actor.set("type", log.actor_type)
            
            # Target
            if log.target_type:
                target = ET.SubElement(entry, "Target")
                target.set("type", log.target_type)
                if log.target_id:
                    target.set("id", log.target_id)
            
            # Action
            action = ET.SubElement(entry, "Action")
            action.text = log.action
            action.set("success", str(log.success))
            
            # Error
            if log.error_code:
                error = ET.SubElement(entry, "Error")
                error.set("code", log.error_code)
                if log.error_message:
                    error.text = log.error_message
            
            # Compliance
            compliance = ET.SubElement(entry, "Compliance")
            if log.compliance_frameworks:
                for framework in log.compliance_frameworks:
                    ET.SubElement(compliance, "Framework").text = framework
            compliance.set("personalData", str(log.personal_data_involved))
            compliance.set("financialData", str(log.financial_data_involved))
            compliance.set("healthData", str(log.health_data_involved))
            
            # Integrity
            integrity = ET.SubElement(entry, "Integrity")
            ET.SubElement(integrity, "Checksum").text = log.checksum
            if log.previous_log_id:
                ET.SubElement(integrity, "PreviousLogId").text = log.previous_log_id
        
        return ET.tostring(root, encoding='unicode', method='xml')
    
    # Search and analytics methods
    
    def search_logs(
        self,
        query: str,
        categories: Optional[List[AuditCategory]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[SecurityAuditLog], int]:
        """Search audit logs with full-text search"""
        # Build base query
        base_query = self.db.query(SecurityAuditLog)
        
        # Apply date filters
        if start_date:
            base_query = base_query.filter(SecurityAuditLog.timestamp >= start_date)
        if end_date:
            base_query = base_query.filter(SecurityAuditLog.timestamp <= end_date)
        
        # Apply category filter
        if categories:
            base_query = base_query.filter(
                SecurityAuditLog.category.in_([c.value for c in categories])
            )
        
        # Apply search query
        if query:
            search_conditions = or_(
                SecurityAuditLog.event_type.ilike(f"%{query}%"),
                SecurityAuditLog.action.ilike(f"%{query}%"),
                SecurityAuditLog.actor_id.ilike(f"%{query}%"),
                SecurityAuditLog.target_id.ilike(f"%{query}%"),
                SecurityAuditLog.error_message.ilike(f"%{query}%"),
                SecurityAuditLog.ip_address.ilike(f"%{query}%"),
                SecurityAuditLog.request_path.ilike(f"%{query}%")
            )
            base_query = base_query.filter(search_conditions)
        
        # Get total count
        total_count = base_query.count()
        
        # Apply pagination and get results
        results = base_query.order_by(desc(SecurityAuditLog.timestamp))\
            .limit(limit).offset(offset).all()
        
        return results, total_count
    
    def get_analytics(
        self,
        start_date: datetime,
        end_date: datetime,
        group_by: str = "category"  # category, event_type, actor, hour, day
    ) -> Dict[str, Any]:
        """Get audit log analytics"""
        # Base aggregation query
        base_query = self.db.query(SecurityAuditLog).filter(
            and_(
                SecurityAuditLog.timestamp >= start_date,
                SecurityAuditLog.timestamp <= end_date
            )
        )
        
        analytics = {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "summary": {
                "total_events": base_query.count(),
                "success_rate": 0,
                "categories": {},
                "severities": {},
                "top_actors": [],
                "top_targets": []
            },
            "grouped_data": {}
        }
        
        # Calculate success rate
        success_count = base_query.filter(SecurityAuditLog.success == True).count()
        if analytics["summary"]["total_events"] > 0:
            analytics["summary"]["success_rate"] = success_count / analytics["summary"]["total_events"]
        
        # Get category breakdown
        category_counts = self.db.query(
            SecurityAuditLog.category,
            func.count(SecurityAuditLog.id).label('count')
        ).filter(
            and_(
                SecurityAuditLog.timestamp >= start_date,
                SecurityAuditLog.timestamp <= end_date
            )
        ).group_by(SecurityAuditLog.category).all()
        
        analytics["summary"]["categories"] = {
            cat: count for cat, count in category_counts
        }
        
        # Get severity breakdown
        severity_counts = self.db.query(
            SecurityAuditLog.severity,
            func.count(SecurityAuditLog.id).label('count')
        ).filter(
            and_(
                SecurityAuditLog.timestamp >= start_date,
                SecurityAuditLog.timestamp <= end_date
            )
        ).group_by(SecurityAuditLog.severity).all()
        
        analytics["summary"]["severities"] = {
            sev: count for sev, count in severity_counts
        }
        
        # Get top actors
        top_actors = self.db.query(
            SecurityAuditLog.actor_id,
            SecurityAuditLog.actor_type,
            func.count(SecurityAuditLog.id).label('count')
        ).filter(
            and_(
                SecurityAuditLog.timestamp >= start_date,
                SecurityAuditLog.timestamp <= end_date,
                SecurityAuditLog.actor_id.isnot(None)
            )
        ).group_by(
            SecurityAuditLog.actor_id,
            SecurityAuditLog.actor_type
        ).order_by(desc('count')).limit(10).all()
        
        analytics["summary"]["top_actors"] = [
            {"id": actor_id, "type": actor_type, "count": count}
            for actor_id, actor_type, count in top_actors
        ]
        
        # Get grouped data based on group_by parameter
        if group_by == "hour":
            # Group by hour
            grouped_data = self.db.query(
                func.date_trunc('hour', SecurityAuditLog.timestamp).label('hour'),
                func.count(SecurityAuditLog.id).label('count')
            ).filter(
                and_(
                    SecurityAuditLog.timestamp >= start_date,
                    SecurityAuditLog.timestamp <= end_date
                )
            ).group_by('hour').order_by('hour').all()
            
            analytics["grouped_data"] = {
                hour.isoformat(): count for hour, count in grouped_data
            }
            
        elif group_by == "day":
            # Group by day
            grouped_data = self.db.query(
                func.date_trunc('day', SecurityAuditLog.timestamp).label('day'),
                func.count(SecurityAuditLog.id).label('count')
            ).filter(
                and_(
                    SecurityAuditLog.timestamp >= start_date,
                    SecurityAuditLog.timestamp <= end_date
                )
            ).group_by('day').order_by('day').all()
            
            analytics["grouped_data"] = {
                day.isoformat(): count for day, count in grouped_data
            }
            
        elif group_by == "event_type":
            # Group by event type
            grouped_data = self.db.query(
                SecurityAuditLog.event_type,
                func.count(SecurityAuditLog.id).label('count')
            ).filter(
                and_(
                    SecurityAuditLog.timestamp >= start_date,
                    SecurityAuditLog.timestamp <= end_date
                )
            ).group_by(SecurityAuditLog.event_type).order_by(desc('count')).all()
            
            analytics["grouped_data"] = {
                event_type: count for event_type, count in grouped_data
            }
        
        return analytics
    
    # Alert management
    
    async def create_alert_rule(
        self,
        name: str,
        description: str,
        category: Optional[AuditCategory],
        condition_type: str,
        condition_config: Dict[str, Any],
        notification_config: Dict[str, Any],
        auto_response_config: Optional[Dict[str, Any]] = None,
        created_by: str = "system"
    ) -> AuditAlert:
        """Create a new alert rule"""
        alert = AuditAlert(
            name=name,
            description=description,
            category=category.value if category else None,
            condition_type=condition_type,
            priority=condition_config.get("priority", "medium"),
            notification_channels=notification_config.get("channels", ["email"]),
            notification_recipients=notification_config.get("recipients", []),
            created_by=created_by
        )
        
        # Set condition-specific fields
        if condition_type == "threshold":
            alert.threshold_count = condition_config.get("count", 10)
            alert.threshold_window_minutes = condition_config.get("window_minutes", 60)
        elif condition_type == "pattern":
            alert.pattern_regex = condition_config.get("pattern")
        elif condition_type == "anomaly":
            alert.anomaly_baseline = condition_config.get("baseline", {})
        
        # Set monitoring filters
        if condition_config.get("event_types"):
            alert.event_types = condition_config["event_types"]
        if condition_config.get("monitor_actors"):
            alert.monitor_actors = condition_config["monitor_actors"]
        if condition_config.get("monitor_targets"):
            alert.monitor_targets = condition_config["monitor_targets"]
        
        # Set auto-response actions
        if auto_response_config:
            alert.auto_block_actor = auto_response_config.get("block_actor", False)
            alert.auto_revoke_permissions = auto_response_config.get("revoke_permissions", False)
            alert.auto_create_incident = auto_response_config.get("create_incident", False)
            alert.custom_webhook_url = auto_response_config.get("webhook_url")
        
        self.db.add(alert)
        self.db.commit()
        
        # Log alert creation
        await self.log_security_event(
            event_type=SecurityEventType.ALERT_RULE_CHANGED,
            category=AuditCategory.CONFIGURATION,
            actor_id=created_by,
            actor_type="user",
            target_type="alert_rule",
            target_id=alert.id,
            action="Alert rule created",
            action_details={
                "name": name,
                "condition_type": condition_type,
                "priority": alert.priority
            }
        )
        
        return alert
    
    def get_triggered_alerts(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get recently triggered alerts"""
        query = self.db.query(AuditAlert).filter(
            AuditAlert.last_triggered_at.isnot(None)
        )
        
        if start_date:
            query = query.filter(AuditAlert.last_triggered_at >= start_date)
        if end_date:
            query = query.filter(AuditAlert.last_triggered_at <= end_date)
        
        alerts = query.order_by(desc(AuditAlert.last_triggered_at)).limit(limit).all()
        
        return [
            {
                "id": alert.id,
                "name": alert.name,
                "priority": alert.priority,
                "last_triggered": alert.last_triggered_at.isoformat(),
                "trigger_count": alert.trigger_count,
                "is_active": alert.is_active,
                "suppressed_until": alert.suppressed_until.isoformat() if alert.suppressed_until else None
            }
            for alert in alerts
        ]