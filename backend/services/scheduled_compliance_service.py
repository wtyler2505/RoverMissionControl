"""
Scheduled Compliance Audit Service
Handles automated compliance checks, scheduled audits, and compliance alerts.
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import json
from dataclasses import dataclass, asdict
import logging

import structlog
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from .compliance_validation_service import (
    ComplianceValidationService,
    ComplianceReport,
    ComplianceCheckType,
    ComplianceRiskLevel
)
from .alert_audit_service import AlertAuditService, ComplianceFramework, AlertAuditEventType
from ..models.privacy_policy import ComplianceStatus

logger = structlog.get_logger()


class ScheduleType(str, Enum):
    """Types of scheduled compliance checks"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ON_DEMAND = "on_demand"


class AlertSeverity(str, Enum):
    """Compliance alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    URGENT = "urgent"


@dataclass
class ComplianceAlert:
    """Compliance alert data structure"""
    alert_id: str
    alert_type: str
    severity: AlertSeverity
    title: str
    message: str
    compliance_check: Optional[str]
    risk_level: Optional[ComplianceRiskLevel]
    compliance_score: Optional[float]
    created_at: datetime
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    metadata: Dict[str, Any] = None


@dataclass
class ScheduledAudit:
    """Scheduled audit configuration"""
    audit_id: str
    name: str
    description: str
    schedule_type: ScheduleType
    framework: ComplianceFramework
    checks_to_run: List[ComplianceCheckType]
    cron_expression: Optional[str]
    interval_minutes: Optional[int]
    enabled: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    failure_count: int = 0
    max_failures: int = 3
    alert_on_failure: bool = True
    alert_recipients: List[str] = None
    created_at: datetime = None
    updated_at: datetime = None


class ScheduledComplianceService:
    """Service for managing scheduled compliance audits and alerts"""
    
    def __init__(self, db: Session, audit_service: AlertAuditService):
        self.db = db
        self.audit_service = audit_service
        self.compliance_service = ComplianceValidationService(db, audit_service)
        
        # Initialize scheduler
        self.scheduler = AsyncIOScheduler()
        self.scheduler.start()
        
        # Storage for scheduled audits and alerts
        self.scheduled_audits: Dict[str, ScheduledAudit] = {}
        self.compliance_alerts: List[ComplianceAlert] = []
        
        # Alert handlers
        self.alert_handlers: List[Callable[[ComplianceAlert], None]] = []
        
        # Configuration
        self.max_alerts_stored = 1000
        self.alert_retention_days = 90
        
        # Initialize default schedules
        self._initialize_default_schedules()
    
    def _initialize_default_schedules(self):
        """Initialize default compliance audit schedules"""
        
        # Daily security and audit trail checks
        daily_security = ScheduledAudit(
            audit_id=str(uuid.uuid4()),
            name="Daily Security Check",
            description="Daily validation of security measures and audit trail integrity",
            schedule_type=ScheduleType.DAILY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[
                ComplianceCheckType.AUDIT_TRAIL,
                ComplianceCheckType.SECURITY_MEASURES
            ],
            cron_expression="0 2 * * *",  # 2 AM daily
            interval_minutes=None,
            enabled=True,
            last_run=None,
            next_run=None,
            alert_recipients=["admin@example.com", "dpo@example.com"],
            created_at=datetime.now(timezone.utc)
        )
        
        # Weekly retention policy check
        weekly_retention = ScheduledAudit(
            audit_id=str(uuid.uuid4()),
            name="Weekly Retention Check",
            description="Weekly validation of data retention policy compliance",
            schedule_type=ScheduleType.WEEKLY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[ComplianceCheckType.RETENTION_POLICY],
            cron_expression="0 3 * * 1",  # 3 AM Monday
            interval_minutes=None,
            enabled=True,
            last_run=None,
            next_run=None,
            alert_recipients=["admin@example.com", "dpo@example.com"],
            created_at=datetime.now(timezone.utc)
        )
        
        # Monthly consent management check
        monthly_consent = ScheduledAudit(
            audit_id=str(uuid.uuid4()),
            name="Monthly Consent Check",
            description="Monthly validation of consent management and data subject rights",
            schedule_type=ScheduleType.MONTHLY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[
                ComplianceCheckType.CONSENT_MANAGEMENT,
                ComplianceCheckType.DATA_SUBJECT_RIGHTS
            ],
            cron_expression="0 4 1 * *",  # 4 AM on 1st of month
            interval_minutes=None,
            enabled=True,
            last_run=None,
            next_run=None,
            alert_recipients=["admin@example.com", "dpo@example.com"],
            created_at=datetime.now(timezone.utc)
        )
        
        # Quarterly comprehensive audit
        quarterly_comprehensive = ScheduledAudit(
            audit_id=str(uuid.uuid4()),
            name="Quarterly Comprehensive Audit",
            description="Comprehensive compliance audit across all areas",
            schedule_type=ScheduleType.QUARTERLY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[
                ComplianceCheckType.CONSENT_MANAGEMENT,
                ComplianceCheckType.RETENTION_POLICY,
                ComplianceCheckType.DATA_SUBJECT_RIGHTS,
                ComplianceCheckType.AUDIT_TRAIL,
                ComplianceCheckType.DOCUMENTATION,
                ComplianceCheckType.SECURITY_MEASURES
            ],
            cron_expression="0 5 1 1,4,7,10 *",  # 5 AM on 1st of Jan, Apr, Jul, Oct
            interval_minutes=None,
            enabled=True,
            last_run=None,
            next_run=None,
            alert_recipients=["admin@example.com", "dpo@example.com", "ceo@example.com"],
            created_at=datetime.now(timezone.utc)
        )
        
        # Add to scheduled audits
        for audit in [daily_security, weekly_retention, monthly_consent, quarterly_comprehensive]:
            self.scheduled_audits[audit.audit_id] = audit
            self._schedule_audit(audit)
    
    def _schedule_audit(self, audit: ScheduledAudit):
        """Schedule an audit with the job scheduler"""
        
        try:
            if audit.cron_expression:
                trigger = CronTrigger.from_crontab(audit.cron_expression)
            elif audit.interval_minutes:
                trigger = IntervalTrigger(minutes=audit.interval_minutes)
            else:
                logger.error(f"No valid trigger for audit {audit.audit_id}")
                return
            
            # Remove existing job if it exists
            try:
                self.scheduler.remove_job(audit.audit_id)
            except:
                pass
            
            # Add new job
            self.scheduler.add_job(
                func=self._run_scheduled_audit,
                trigger=trigger,
                id=audit.audit_id,
                args=[audit.audit_id],
                max_instances=1,
                coalesce=True,
                replace_existing=True
            )
            
            # Update next run time
            job = self.scheduler.get_job(audit.audit_id)
            if job:
                audit.next_run = job.next_run_time
            
            logger.info(f"Scheduled audit {audit.name}", audit_id=audit.audit_id, next_run=audit.next_run)
            
        except Exception as e:
            logger.error(f"Failed to schedule audit {audit.audit_id}: {str(e)}")
    
    async def _run_scheduled_audit(self, audit_id: str):
        """Execute a scheduled compliance audit"""
        
        audit = self.scheduled_audits.get(audit_id)
        if not audit or not audit.enabled:
            return
        
        logger.info(f"Running scheduled audit: {audit.name}", audit_id=audit_id)
        
        try:
            audit.last_run = datetime.now(timezone.utc)
            
            # Run compliance checks based on audit configuration
            if len(audit.checks_to_run) == len(list(ComplianceCheckType)):
                # Run comprehensive audit
                report = await self.compliance_service.run_comprehensive_compliance_check(audit.framework)
            else:
                # Run specific checks (would need to implement individual check runner)
                # For now, run comprehensive audit
                report = await self.compliance_service.run_comprehensive_compliance_check(audit.framework)
            
            # Process results and generate alerts if needed
            await self._process_audit_results(audit, report)
            
            # Reset failure count on success
            audit.failure_count = 0
            
            # Log successful audit
            await self.audit_service.log_event(
                event_type=AlertAuditEventType.ALERT_SYSTEM_STARTED,
                actor_id="system",
                actor_type="scheduled_compliance",
                target_id=audit_id,
                target_type="scheduled_audit",
                action=f"Scheduled audit completed: {audit.name}",
                details={
                    "audit_name": audit.name,
                    "overall_score": report.overall_score,
                    "overall_status": report.overall_status.value,
                    "critical_issues": report.critical_issues,
                    "framework": report.framework.value
                },
                compliance_frameworks=[audit.framework],
                success=True
            )
            
        except Exception as e:
            audit.failure_count += 1
            
            logger.error(f"Scheduled audit failed: {audit.name}", audit_id=audit_id, error=str(e))
            
            # Log audit failure
            await self.audit_service.log_event(
                event_type=AlertAuditEventType.ALERT_SYSTEM_ERROR,
                actor_id="system",
                actor_type="scheduled_compliance",
                target_id=audit_id,
                target_type="scheduled_audit",
                action=f"Scheduled audit failed: {audit.name}",
                details={
                    "audit_name": audit.name,
                    "failure_count": audit.failure_count,
                    "error": str(e)
                },
                success=False,
                error_message=str(e)
            )
            
            # Generate failure alert
            if audit.alert_on_failure:
                await self._create_audit_failure_alert(audit, str(e))
            
            # Disable audit if max failures reached
            if audit.failure_count >= audit.max_failures:
                audit.enabled = False
                await self._create_audit_disabled_alert(audit)
    
    async def _process_audit_results(self, audit: ScheduledAudit, report: ComplianceReport):
        """Process audit results and generate alerts for issues"""
        
        # Generate alerts for critical issues
        if report.critical_issues > 0:
            await self._create_compliance_alert(
                alert_type="critical_compliance_issues",
                severity=AlertSeverity.CRITICAL,
                title=f"Critical Compliance Issues Detected - {audit.name}",
                message=f"Found {report.critical_issues} critical compliance issues requiring immediate attention.",
                compliance_check=audit.name,
                risk_level=ComplianceRiskLevel.CRITICAL,
                compliance_score=report.overall_score,
                metadata={
                    "audit_id": audit.audit_id,
                    "report_id": report.report_id,
                    "framework": report.framework.value,
                    "critical_issues": report.critical_issues,
                    "failed_checks": report.failed_checks
                }
            )
        
        # Generate alerts for low compliance scores
        if report.overall_score < 60:
            await self._create_compliance_alert(
                alert_type="low_compliance_score",
                severity=AlertSeverity.URGENT,
                title=f"Low Compliance Score - {audit.name}",
                message=f"Compliance score of {report.overall_score:.1f}% is below acceptable threshold (60%).",
                compliance_check=audit.name,
                risk_level=ComplianceRiskLevel.HIGH,
                compliance_score=report.overall_score,
                metadata={
                    "audit_id": audit.audit_id,
                    "report_id": report.report_id,
                    "framework": report.framework.value,
                    "threshold": 60
                }
            )
        elif report.overall_score < 80:
            await self._create_compliance_alert(
                alert_type="moderate_compliance_score",
                severity=AlertSeverity.WARNING,
                title=f"Moderate Compliance Score - {audit.name}",
                message=f"Compliance score of {report.overall_score:.1f}% could be improved (target: 80%+).",
                compliance_check=audit.name,
                risk_level=ComplianceRiskLevel.MEDIUM,
                compliance_score=report.overall_score,
                metadata={
                    "audit_id": audit.audit_id,
                    "report_id": report.report_id,
                    "framework": report.framework.value,
                    "target": 80
                }
            )
        
        # Generate alerts for failed checks
        for check_result in report.check_results:
            if check_result.status == ComplianceStatus.NON_COMPLIANT:
                await self._create_compliance_alert(
                    alert_type="compliance_check_failed",
                    severity=AlertSeverity.CRITICAL if check_result.risk_level == ComplianceRiskLevel.CRITICAL else AlertSeverity.WARNING,
                    title=f"Compliance Check Failed: {check_result.check_name}",
                    message=f"The {check_result.check_name} check failed with a score of {check_result.score:.1f}%.",
                    compliance_check=check_result.check_name,
                    risk_level=check_result.risk_level,
                    compliance_score=check_result.score,
                    metadata={
                        "audit_id": audit.audit_id,
                        "report_id": report.report_id,
                        "check_type": check_result.check_type.value,
                        "recommendations": check_result.recommendations,
                        "remediation_required": check_result.remediation_required,
                        "remediation_deadline": check_result.remediation_deadline.isoformat() if check_result.remediation_deadline else None
                    }
                )
    
    async def _create_compliance_alert(
        self,
        alert_type: str,
        severity: AlertSeverity,
        title: str,
        message: str,
        compliance_check: Optional[str] = None,
        risk_level: Optional[ComplianceRiskLevel] = None,
        compliance_score: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new compliance alert"""
        
        alert = ComplianceAlert(
            alert_id=str(uuid.uuid4()),
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            compliance_check=compliance_check,
            risk_level=risk_level,
            compliance_score=compliance_score,
            created_at=datetime.now(timezone.utc),
            metadata=metadata or {}
        )
        
        # Add to alerts list
        self.compliance_alerts.append(alert)
        
        # Trim old alerts if needed
        if len(self.compliance_alerts) > self.max_alerts_stored:
            # Remove oldest alerts
            self.compliance_alerts = sorted(self.compliance_alerts, key=lambda x: x.created_at, reverse=True)
            self.compliance_alerts = self.compliance_alerts[:self.max_alerts_stored]
        
        # Log the alert
        await self.audit_service.log_event(
            event_type=AlertAuditEventType.ALERT_CREATED,
            actor_id="system",
            actor_type="compliance_monitor",
            target_id=alert.alert_id,
            target_type="compliance_alert",
            action=f"Compliance alert created: {alert_type}",
            details={
                "alert_type": alert_type,
                "severity": severity.value,
                "title": title,
                "compliance_check": compliance_check,
                "risk_level": risk_level.value if risk_level else None,
                "compliance_score": compliance_score
            },
            severity=alert.severity.value,
            compliance_frameworks=[ComplianceFramework.GDPR]
        )
        
        # Notify alert handlers
        for handler in self.alert_handlers:
            try:
                await handler(alert)
            except Exception as e:
                logger.error(f"Alert handler failed: {str(e)}")
        
        logger.info(f"Compliance alert created", alert_id=alert.alert_id, alert_type=alert_type, severity=severity.value)
        
        return alert.alert_id
    
    async def _create_audit_failure_alert(self, audit: ScheduledAudit, error_message: str):
        """Create alert for audit failure"""
        
        await self._create_compliance_alert(
            alert_type="audit_failure",
            severity=AlertSeverity.CRITICAL,
            title=f"Scheduled Audit Failed: {audit.name}",
            message=f"The scheduled audit '{audit.name}' failed to complete. Error: {error_message}",
            compliance_check=audit.name,
            risk_level=ComplianceRiskLevel.HIGH,
            metadata={
                "audit_id": audit.audit_id,
                "failure_count": audit.failure_count,
                "max_failures": audit.max_failures,
                "error": error_message
            }
        )
    
    async def _create_audit_disabled_alert(self, audit: ScheduledAudit):
        """Create alert when audit is disabled due to failures"""
        
        await self._create_compliance_alert(
            alert_type="audit_disabled",
            severity=AlertSeverity.URGENT,
            title=f"Scheduled Audit Disabled: {audit.name}",
            message=f"The scheduled audit '{audit.name}' has been disabled due to repeated failures ({audit.failure_count}/{audit.max_failures}).",
            compliance_check=audit.name,
            risk_level=ComplianceRiskLevel.CRITICAL,
            metadata={
                "audit_id": audit.audit_id,
                "failure_count": audit.failure_count,
                "disabled_at": datetime.now(timezone.utc).isoformat()
            }
        )
    
    async def create_audit_schedule(
        self,
        name: str,
        description: str,
        schedule_type: ScheduleType,
        framework: ComplianceFramework,
        checks_to_run: List[ComplianceCheckType],
        cron_expression: Optional[str] = None,
        interval_minutes: Optional[int] = None,
        alert_recipients: Optional[List[str]] = None
    ) -> str:
        """Create a new scheduled audit"""
        
        audit_id = str(uuid.uuid4())
        
        audit = ScheduledAudit(
            audit_id=audit_id,
            name=name,
            description=description,
            schedule_type=schedule_type,
            framework=framework,
            checks_to_run=checks_to_run,
            cron_expression=cron_expression,
            interval_minutes=interval_minutes,
            enabled=True,
            last_run=None,
            next_run=None,
            alert_recipients=alert_recipients or [],
            created_at=datetime.now(timezone.utc)
        )
        
        self.scheduled_audits[audit_id] = audit
        self._schedule_audit(audit)
        
        # Log audit creation
        await self.audit_service.log_event(
            event_type=AlertAuditEventType.ALERT_RULE_CREATED,
            actor_id="system",
            actor_type="compliance_scheduler",
            target_id=audit_id,
            target_type="scheduled_audit",
            action=f"Scheduled audit created: {name}",
            details={
                "name": name,
                "schedule_type": schedule_type.value,
                "framework": framework.value,
                "checks_count": len(checks_to_run),
                "cron_expression": cron_expression,
                "interval_minutes": interval_minutes
            },
            compliance_frameworks=[framework]
        )
        
        logger.info(f"Scheduled audit created", audit_id=audit_id, name=name)
        
        return audit_id
    
    async def update_audit_schedule(
        self,
        audit_id: str,
        enabled: Optional[bool] = None,
        cron_expression: Optional[str] = None,
        interval_minutes: Optional[int] = None,
        alert_recipients: Optional[List[str]] = None
    ):
        """Update an existing scheduled audit"""
        
        audit = self.scheduled_audits.get(audit_id)
        if not audit:
            raise ValueError(f"Audit {audit_id} not found")
        
        old_enabled = audit.enabled
        
        # Update fields
        if enabled is not None:
            audit.enabled = enabled
        if cron_expression is not None:
            audit.cron_expression = cron_expression
        if interval_minutes is not None:
            audit.interval_minutes = interval_minutes
        if alert_recipients is not None:
            audit.alert_recipients = alert_recipients
        
        audit.updated_at = datetime.now(timezone.utc)
        
        # Reschedule if needed
        if audit.enabled:
            self._schedule_audit(audit)
        elif old_enabled and not audit.enabled:
            # Remove from scheduler if disabled
            try:
                self.scheduler.remove_job(audit_id)
            except:
                pass
        
        # Log update
        await self.audit_service.log_event(
            event_type=AlertAuditEventType.ALERT_RULE_UPDATED,
            actor_id="system",
            actor_type="compliance_scheduler",
            target_id=audit_id,
            target_type="scheduled_audit",
            action=f"Scheduled audit updated: {audit.name}",
            details={
                "enabled": audit.enabled,
                "cron_expression": audit.cron_expression,
                "interval_minutes": audit.interval_minutes,
                "alert_recipients_count": len(audit.alert_recipients)
            },
            compliance_frameworks=[audit.framework]
        )
        
        logger.info(f"Scheduled audit updated", audit_id=audit_id, enabled=audit.enabled)
    
    async def delete_audit_schedule(self, audit_id: str):
        """Delete a scheduled audit"""
        
        audit = self.scheduled_audits.get(audit_id)
        if not audit:
            raise ValueError(f"Audit {audit_id} not found")
        
        # Remove from scheduler
        try:
            self.scheduler.remove_job(audit_id)
        except:
            pass
        
        # Remove from storage
        del self.scheduled_audits[audit_id]
        
        # Log deletion
        await self.audit_service.log_event(
            event_type=AlertAuditEventType.ALERT_RULE_DELETED,
            actor_id="system",
            actor_type="compliance_scheduler",
            target_id=audit_id,
            target_type="scheduled_audit",
            action=f"Scheduled audit deleted: {audit.name}",
            details={"name": audit.name},
            compliance_frameworks=[audit.framework]
        )
        
        logger.info(f"Scheduled audit deleted", audit_id=audit_id, name=audit.name)
    
    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge a compliance alert"""
        
        for alert in self.compliance_alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                alert.acknowledged_by = acknowledged_by
                alert.acknowledged_at = datetime.now(timezone.utc)
                
                # Log acknowledgment
                await self.audit_service.log_event(
                    event_type=AlertAuditEventType.ALERT_ACKNOWLEDGED,
                    actor_id=acknowledged_by,
                    actor_type="user",
                    target_id=alert_id,
                    target_type="compliance_alert",
                    action=f"Compliance alert acknowledged: {alert.title}",
                    details={
                        "alert_type": alert.alert_type,
                        "severity": alert.severity.value
                    }
                )
                
                logger.info(f"Compliance alert acknowledged", alert_id=alert_id, acknowledged_by=acknowledged_by)
                return True
        
        return False
    
    async def resolve_alert(self, alert_id: str, resolved_by: str) -> bool:
        """Resolve a compliance alert"""
        
        for alert in self.compliance_alerts:
            if alert.alert_id == alert_id:
                alert.resolved = True
                alert.resolved_by = resolved_by
                alert.resolved_at = datetime.now(timezone.utc)
                
                # Log resolution
                await self.audit_service.log_event(
                    event_type=AlertAuditEventType.ALERT_RESOLVED,
                    actor_id=resolved_by,
                    actor_type="user",
                    target_id=alert_id,
                    target_type="compliance_alert",
                    action=f"Compliance alert resolved: {alert.title}",
                    details={
                        "alert_type": alert.alert_type,
                        "severity": alert.severity.value
                    }
                )
                
                logger.info(f"Compliance alert resolved", alert_id=alert_id, resolved_by=resolved_by)
                return True
        
        return False
    
    def get_scheduled_audits(self) -> Dict[str, Dict[str, Any]]:
        """Get all scheduled audits"""
        
        result = {}
        for audit_id, audit in self.scheduled_audits.items():
            result[audit_id] = asdict(audit)
            
            # Convert datetime objects to ISO strings
            for field in ['created_at', 'updated_at', 'last_run', 'next_run']:
                if hasattr(audit, field) and getattr(audit, field):
                    result[audit_id][field] = getattr(audit, field).isoformat()
        
        return result
    
    def get_compliance_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        acknowledged: Optional[bool] = None,
        resolved: Optional[bool] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get compliance alerts with filtering"""
        
        filtered_alerts = self.compliance_alerts.copy()
        
        # Apply filters
        if severity:
            filtered_alerts = [a for a in filtered_alerts if a.severity == severity]
        if acknowledged is not None:
            filtered_alerts = [a for a in filtered_alerts if a.acknowledged == acknowledged]
        if resolved is not None:
            filtered_alerts = [a for a in filtered_alerts if a.resolved == resolved]
        
        # Sort by creation time (newest first)
        filtered_alerts.sort(key=lambda x: x.created_at, reverse=True)
        
        # Apply limit
        filtered_alerts = filtered_alerts[:limit]
        
        # Convert to dict format
        result = []
        for alert in filtered_alerts:
            alert_dict = asdict(alert)
            
            # Convert datetime objects to ISO strings
            for field in ['created_at', 'acknowledged_at', 'resolved_at']:
                if getattr(alert, field):
                    alert_dict[field] = getattr(alert, field).isoformat()
            
            result.append(alert_dict)
        
        return result
    
    def add_alert_handler(self, handler: Callable[[ComplianceAlert], None]):
        """Add a handler for compliance alerts"""
        self.alert_handlers.append(handler)
    
    def remove_alert_handler(self, handler: Callable[[ComplianceAlert], None]):
        """Remove an alert handler"""
        if handler in self.alert_handlers:
            self.alert_handlers.remove(handler)
    
    async def cleanup_old_alerts(self):
        """Clean up old alerts based on retention policy"""
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=self.alert_retention_days)
        
        old_count = len(self.compliance_alerts)
        self.compliance_alerts = [
            alert for alert in self.compliance_alerts
            if alert.created_at > cutoff_date or not alert.resolved
        ]
        
        cleaned_count = old_count - len(self.compliance_alerts)
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} old compliance alerts")
    
    async def get_compliance_summary(self) -> Dict[str, Any]:
        """Get summary of compliance status and alerts"""
        
        # Count alerts by severity
        alert_counts = {
            "total": len(self.compliance_alerts),
            "unacknowledged": len([a for a in self.compliance_alerts if not a.acknowledged]),
            "unresolved": len([a for a in self.compliance_alerts if not a.resolved]),
            "critical": len([a for a in self.compliance_alerts if a.severity == AlertSeverity.CRITICAL]),
            "urgent": len([a for a in self.compliance_alerts if a.severity == AlertSeverity.URGENT]),
            "warning": len([a for a in self.compliance_alerts if a.severity == AlertSeverity.WARNING]),
            "info": len([a for a in self.compliance_alerts if a.severity == AlertSeverity.INFO])
        }
        
        # Count audits by status
        audit_counts = {
            "total": len(self.scheduled_audits),
            "enabled": len([a for a in self.scheduled_audits.values() if a.enabled]),
            "disabled": len([a for a in self.scheduled_audits.values() if not a.enabled]),
            "failing": len([a for a in self.scheduled_audits.values() if a.failure_count > 0])
        }
        
        # Get next scheduled audit
        next_audit = None
        earliest_next_run = None
        
        for audit in self.scheduled_audits.values():
            if audit.enabled and audit.next_run:
                if not earliest_next_run or audit.next_run < earliest_next_run:
                    earliest_next_run = audit.next_run
                    next_audit = {
                        "audit_id": audit.audit_id,
                        "name": audit.name,
                        "next_run": audit.next_run.isoformat()
                    }
        
        return {
            "alerts": alert_counts,
            "audits": audit_counts,
            "next_audit": next_audit,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    
    def shutdown(self):
        """Shutdown the scheduled compliance service"""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
        logger.info("Scheduled compliance service shutdown")