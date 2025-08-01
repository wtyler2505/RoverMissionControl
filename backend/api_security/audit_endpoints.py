"""
API endpoints for audit logging and compliance management
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User
from ..rbac.decorators import require_permission
from .audit_service import AuditService, SecurityEventType
from .audit_models import (
    AuditCategory, AuditSeverity, ComplianceFramework,
    SecurityAuditLog, AuditAlert, AuditExport
)

router = APIRouter(prefix="/api/security/audit", tags=["audit"])

# Pydantic models for API

class AuditLogQuery(BaseModel):
    query: Optional[str] = Field(None, description="Search query")
    categories: Optional[List[AuditCategory]] = Field(None, description="Filter by categories")
    event_types: Optional[List[SecurityEventType]] = Field(None, description="Filter by event types")
    actors: Optional[List[str]] = Field(None, description="Filter by actor IDs")
    start_date: Optional[datetime] = Field(None, description="Start date filter")
    end_date: Optional[datetime] = Field(None, description="End date filter")
    severity: Optional[AuditSeverity] = Field(None, description="Minimum severity filter")
    limit: int = Field(100, ge=1, le=1000, description="Number of results to return")
    offset: int = Field(0, ge=0, description="Offset for pagination")

class AuditLogResponse(BaseModel):
    logs: List[Dict[str, Any]]
    total_count: int
    page: int
    page_size: int

class ComplianceReportRequest(BaseModel):
    framework: ComplianceFramework
    start_date: datetime
    end_date: datetime
    include_details: bool = False

class ExportRequest(BaseModel):
    start_date: datetime
    end_date: datetime
    categories: Optional[List[AuditCategory]] = None
    event_types: Optional[List[SecurityEventType]] = None
    actors: Optional[List[str]] = None
    format: str = Field("json", regex="^(json|csv|xml)$")
    compress: bool = False
    encrypt: bool = False
    reason: str = Field(..., min_length=10, description="Reason for export")

class AlertRuleRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., max_length=500)
    category: Optional[AuditCategory] = None
    condition_type: str = Field(..., regex="^(threshold|pattern|anomaly)$")
    condition_config: Dict[str, Any]
    notification_config: Dict[str, Any]
    auto_response_config: Optional[Dict[str, Any]] = None

class RetentionEnforcementResponse(BaseModel):
    archived: int
    deleted: int
    errors: int
    timestamp: datetime

# Helper functions

def get_audit_service(db: Session = Depends(get_db)) -> AuditService:
    """Get audit service instance"""
    from ..rbac.audit import AuditLogger
    rbac_logger = AuditLogger(db)
    return AuditService(db, rbac_logger)

# Endpoints

@router.get("/logs", response_model=AuditLogResponse)
@require_permission("audit:read")
async def search_audit_logs(
    query_params: AuditLogQuery = Depends(),
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Search and retrieve audit logs with filtering and pagination
    """
    # Set request context
    service.set_request_context(
        user_id=current_user.id,
        request_id=str(uuid.uuid4()),
        ip_address="127.0.0.1"  # Would come from request in production
    )
    
    # Perform search
    logs, total_count = service.search_logs(
        query=query_params.query,
        categories=query_params.categories,
        start_date=query_params.start_date,
        end_date=query_params.end_date,
        limit=query_params.limit,
        offset=query_params.offset
    )
    
    # Format response
    log_data = []
    for log in logs:
        log_data.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "category": log.category,
            "event_type": log.event_type,
            "severity": log.severity,
            "actor": {
                "id": log.actor_id,
                "type": log.actor_type
            },
            "target": {
                "type": log.target_type,
                "id": log.target_id
            },
            "action": log.action,
            "success": log.success,
            "error_message": log.error_message,
            "ip_address": log.ip_address,
            "compliance_frameworks": log.compliance_frameworks
        })
    
    return AuditLogResponse(
        logs=log_data,
        total_count=total_count,
        page=query_params.offset // query_params.limit + 1,
        page_size=query_params.limit
    )

@router.get("/logs/{log_id}")
@require_permission("audit:read")
async def get_audit_log(
    log_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific audit log entry
    """
    log = db.query(SecurityAuditLog).filter(
        SecurityAuditLog.id == log_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    # Include snapshot data if requested
    response = {
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
        "security_context": {
            "authentication_method": log.authentication_method,
            "permission_required": log.permission_required,
            "permission_granted": log.permission_granted,
            "elevation_used": log.elevation_used,
            "mfa_verified": log.mfa_verified
        },
        "compliance": {
            "frameworks": log.compliance_frameworks,
            "personal_data": log.personal_data_involved,
            "financial_data": log.financial_data_involved,
            "health_data": log.health_data_involved,
            "data_classification": log.data_classification
        },
        "integrity": {
            "checksum": log.checksum,
            "previous_log_id": log.previous_log_id,
            "has_signature": bool(log.signature)
        },
        "performance": {
            "processing_time_ms": log.processing_time_ms,
            "data_size_bytes": log.data_size_bytes
        },
        "tags": log.tags
    }
    
    return response

@router.get("/analytics")
@require_permission("audit:read")
async def get_audit_analytics(
    start_date: datetime = Query(..., description="Start date for analytics"),
    end_date: datetime = Query(..., description="End date for analytics"),
    group_by: str = Query("category", regex="^(category|event_type|actor|hour|day)$"),
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Get analytics and aggregated data for audit logs
    """
    analytics = service.get_analytics(
        start_date=start_date,
        end_date=end_date,
        group_by=group_by
    )
    
    return analytics

@router.post("/export")
@require_permission("audit:export")
async def export_audit_logs(
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Export audit logs with compliance tracking
    """
    # Set request context
    service.set_request_context(
        user_id=current_user.id,
        request_id=str(uuid.uuid4())
    )
    
    # Create export (async to not block)
    export = await service.export_logs(
        start_date=export_request.start_date,
        end_date=export_request.end_date,
        categories=export_request.categories,
        event_types=export_request.event_types,
        actors=export_request.actors,
        format=export_request.format,
        compress=export_request.compress,
        encrypt=export_request.encrypt,
        reason=export_request.reason,
        approved_by=current_user.id
    )
    
    return {
        "export_id": export.id,
        "status": export.status,
        "total_records": export.total_records,
        "file_size_bytes": export.file_size_bytes,
        "storage_path": export.storage_path,
        "expires_at": export.access_expires_at.isoformat() if export.access_expires_at else None
    }

@router.get("/exports/{export_id}")
@require_permission("audit:export")
async def get_export_status(
    export_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get status and details of an audit log export
    """
    export = db.query(AuditExport).filter(
        AuditExport.id == export_id
    ).first()
    
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    
    # Check if user has access
    if export.exported_by != current_user.id and current_user.id not in (export.authorized_users or []):
        raise HTTPException(status_code=403, detail="Access denied to this export")
    
    return {
        "id": export.id,
        "status": export.status,
        "exported_by": export.exported_by,
        "export_timestamp": export.export_timestamp.isoformat(),
        "reason": export.export_reason,
        "date_range": {
            "start": export.start_date.isoformat(),
            "end": export.end_date.isoformat()
        },
        "filters": {
            "categories": export.categories,
            "event_types": export.event_types,
            "actors": export.actors
        },
        "format": export.format,
        "compression": export.compression,
        "encryption": export.encryption,
        "total_records": export.total_records,
        "file_size_bytes": export.file_size_bytes,
        "download_count": export.download_count,
        "expires_at": export.access_expires_at.isoformat() if export.access_expires_at else None,
        "compliance_frameworks": export.compliance_frameworks,
        "data_classification": {
            "personal_data": export.includes_personal_data,
            "financial_data": export.includes_financial_data,
            "health_data": export.includes_health_data
        }
    }

@router.post("/compliance/report")
@require_permission("audit:compliance")
async def generate_compliance_report(
    report_request: ComplianceReportRequest,
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Generate compliance report for specific framework
    """
    report = service.get_compliance_report(
        framework=report_request.framework,
        start_date=report_request.start_date,
        end_date=report_request.end_date,
        include_details=report_request.include_details
    )
    
    return report

@router.post("/retention/enforce")
@require_permission("audit:admin")
async def enforce_retention_policies(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Manually trigger retention policy enforcement
    """
    # Set request context
    service.set_request_context(
        user_id=current_user.id,
        request_id=str(uuid.uuid4())
    )
    
    # Run enforcement async
    async def run_enforcement():
        await service.enforce_retention_policies()
    
    background_tasks.add_task(run_enforcement)
    
    return {
        "status": "started",
        "message": "Retention policy enforcement started in background"
    }

@router.get("/alerts")
@require_permission("audit:alerts")
async def list_alert_rules(
    active_only: bool = Query(True, description="Only show active alerts"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List configured alert rules
    """
    query = db.query(AuditAlert)
    
    if active_only:
        query = query.filter(AuditAlert.is_active == True)
    
    alerts = query.all()
    
    return [
        {
            "id": alert.id,
            "name": alert.name,
            "description": alert.description,
            "category": alert.category,
            "condition_type": alert.condition_type,
            "priority": alert.priority,
            "is_active": alert.is_active,
            "last_triggered": alert.last_triggered_at.isoformat() if alert.last_triggered_at else None,
            "trigger_count": alert.trigger_count,
            "created_at": alert.created_at.isoformat(),
            "created_by": alert.created_by
        }
        for alert in alerts
    ]

@router.post("/alerts")
@require_permission("audit:alerts")
async def create_alert_rule(
    alert_request: AlertRuleRequest,
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Create a new alert rule
    """
    alert = await service.create_alert_rule(
        name=alert_request.name,
        description=alert_request.description,
        category=alert_request.category,
        condition_type=alert_request.condition_type,
        condition_config=alert_request.condition_config,
        notification_config=alert_request.notification_config,
        auto_response_config=alert_request.auto_response_config,
        created_by=current_user.id
    )
    
    return {
        "id": alert.id,
        "name": alert.name,
        "status": "created"
    }

@router.put("/alerts/{alert_id}/toggle")
@require_permission("audit:alerts")
async def toggle_alert_rule(
    alert_id: str,
    active: bool = Query(..., description="New active state"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: AuditService = Depends(get_audit_service)
):
    """
    Enable or disable an alert rule
    """
    alert = db.query(AuditAlert).filter(
        AuditAlert.id == alert_id
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Update state
    alert.is_active = active
    db.commit()
    
    # Log the change
    await service.log_security_event(
        event_type=SecurityEventType.ALERT_RULE_CHANGED,
        category=AuditCategory.CONFIGURATION,
        actor_id=current_user.id,
        actor_type="user",
        target_type="alert_rule",
        target_id=alert_id,
        action=f"Alert {'enabled' if active else 'disabled'}",
        action_details={
            "alert_name": alert.name,
            "new_state": active
        }
    )
    
    return {
        "id": alert.id,
        "name": alert.name,
        "is_active": alert.is_active
    }

@router.get("/alerts/triggered")
@require_permission("audit:alerts")
async def get_triggered_alerts(
    hours: int = Query(24, ge=1, le=168, description="Look back hours"),
    current_user: User = Depends(get_current_user),
    service: AuditService = Depends(get_audit_service)
):
    """
    Get recently triggered alerts
    """
    start_date = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    triggered = service.get_triggered_alerts(
        start_date=start_date,
        limit=100
    )
    
    return triggered

# Import required modules at the top
import uuid