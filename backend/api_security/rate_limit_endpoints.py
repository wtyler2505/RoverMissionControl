"""
Rate Limiting API Endpoints

Provides endpoints for managing rate limit policies, monitoring, and analytics
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json

from ..database import get_db
from ..auth.dependencies import get_current_user, require_permission
from ..auth.models import User
from ..rbac.models import Resource, Action
from .rate_limit_service import RateLimitService
from .rate_limit_models import (
    RateLimitPolicy, RateLimitViolation, RateLimitAlert,
    RateLimitMetrics, RateLimitWindow, RateLimitTarget,
    ViolationAction
)
from ..rbac.audit import AuditLogger

router = APIRouter()


# Request/Response Models

class RateLimitPolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    target_type: RateLimitTarget
    target_value: Optional[str] = Field(None, max_length=255)
    window: RateLimitWindow
    limit: int = Field(..., gt=0)
    burst_enabled: bool = False
    burst_limit: Optional[int] = Field(None, gt=0)
    burst_window_seconds: Optional[int] = Field(None, gt=0)
    custom_error_message: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    exclude_patterns: Optional[List[str]] = None
    include_patterns: Optional[List[str]] = None
    method_specific: Optional[Dict[str, int]] = None
    priority: int = Field(0, ge=0, le=1000)
    is_active: bool = True


class RateLimitPolicyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    target_value: Optional[str] = Field(None, max_length=255)
    limit: Optional[int] = Field(None, gt=0)
    burst_enabled: Optional[bool] = None
    burst_limit: Optional[int] = Field(None, gt=0)
    burst_window_seconds: Optional[int] = Field(None, gt=0)
    custom_error_message: Optional[str] = None
    custom_headers: Optional[Dict[str, str]] = None
    exclude_patterns: Optional[List[str]] = None
    include_patterns: Optional[List[str]] = None
    method_specific: Optional[Dict[str, int]] = None
    priority: Optional[int] = Field(None, ge=0, le=1000)
    is_active: Optional[bool] = None


class RateLimitAlertCreate(BaseModel):
    policy_id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    violation_threshold: int = Field(1, gt=0)
    time_window_minutes: int = Field(5, gt=0)
    notify_emails: Optional[List[str]] = None
    notify_webhooks: Optional[List[str]] = None
    notify_slack: Optional[Dict[str, Any]] = None
    cooldown_minutes: int = Field(60, gt=0)
    is_active: bool = True


class RateLimitAlertUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    violation_threshold: Optional[int] = Field(None, gt=0)
    time_window_minutes: Optional[int] = Field(None, gt=0)
    notify_emails: Optional[List[str]] = None
    notify_webhooks: Optional[List[str]] = None
    notify_slack: Optional[Dict[str, Any]] = None
    cooldown_minutes: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None


class RateLimitTestRequest(BaseModel):
    identifier: str
    endpoint: str
    method: str = "GET"
    api_key_id: Optional[str] = None
    user_id: Optional[str] = None
    ip_address: Optional[str] = None


# Policy Management Endpoints

@router.post("/policies")
@require_permission(Resource.API_SECURITY, Action.CREATE)
async def create_policy(
    policy_data: RateLimitPolicyCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new rate limit policy"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    try:
        policy = service.create_policy(
            user=current_user,
            name=policy_data.name,
            target_type=policy_data.target_type,
            window=policy_data.window,
            limit=policy_data.limit,
            description=policy_data.description,
            target_value=policy_data.target_value,
            burst_enabled=policy_data.burst_enabled,
            burst_limit=policy_data.burst_limit,
            burst_window_seconds=policy_data.burst_window_seconds,
            custom_error_message=policy_data.custom_error_message,
            custom_headers=policy_data.custom_headers,
            exclude_patterns=policy_data.exclude_patterns,
            include_patterns=policy_data.include_patterns,
            method_specific=policy_data.method_specific,
            priority=policy_data.priority,
            is_active=policy_data.is_active
        )
        
        # Schedule metrics collection
        background_tasks.add_task(service.collect_metrics, 5)
        
        return {
            "id": policy.id,
            "name": policy.name,
            "target_type": policy.target_type.value,
            "window": policy.window.value,
            "limit": policy.limit,
            "is_active": policy.is_active,
            "created_at": policy.created_at.isoformat(),
            "message": "Rate limit policy created successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/policies")
@require_permission(Resource.API_SECURITY, Action.READ)
async def list_policies(
    target_type: Optional[RateLimitTarget] = None,
    active_only: bool = Query(True, description="Only return active policies"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List rate limit policies"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    policies = service.get_policies(target_type=target_type, active_only=active_only)
    
    return [{
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "target_type": p.target_type.value,
        "target_value": p.target_value,
        "window": p.window.value,
        "limit": p.limit,
        "burst_enabled": p.burst_enabled,
        "burst_limit": p.burst_limit,
        "priority": p.priority,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None
    } for p in policies]
@router.get("/policies/{policy_id}")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific rate limit policy"""
    policy = db.query(RateLimitPolicy).filter_by(id=policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    return {
        "id": policy.id,
        "name": policy.name,
        "description": policy.description,
        "target_type": policy.target_type.value,
        "target_value": policy.target_value,
        "window": policy.window.value,
        "limit": policy.limit,
        "burst_enabled": policy.burst_enabled,
        "burst_limit": policy.burst_limit,
        "burst_window_seconds": policy.burst_window_seconds,
        "custom_error_message": policy.custom_error_message,
        "custom_headers": policy.custom_headers,
        "exclude_patterns": policy.exclude_patterns,
        "include_patterns": policy.include_patterns,
        "method_specific": policy.method_specific,
        "priority": policy.priority,
        "is_active": policy.is_active,
        "created_at": policy.created_at.isoformat(),
        "updated_at": policy.updated_at.isoformat() if policy.updated_at else None,
        "created_by": {
            "id": policy.created_by.id,
            "username": policy.created_by.username
        } if policy.created_by else None
    }


@router.put("/policies/{policy_id}")
@require_permission(Resource.API_SECURITY, Action.UPDATE)
async def update_policy(
    policy_id: str,
    updates: RateLimitPolicyUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a rate limit policy"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    try:
        # Convert Pydantic model to dict, excluding None values
        update_data = updates.dict(exclude_none=True)
        
        policy = service.update_policy(
            user=current_user,
            policy_id=policy_id,
            updates=update_data
        )
        
        # Schedule metrics collection
        background_tasks.add_task(service.collect_metrics, 5)
        
        return {
            "id": policy.id,
            "name": policy.name,
            "message": "Rate limit policy updated successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/policies/{policy_id}")
@require_permission(Resource.API_SECURITY, Action.DELETE)
async def delete_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a rate limit policy"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    try:
        service.delete_policy(current_user, policy_id)
        return {"message": "Rate limit policy deleted successfully"}
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# Alert Management Endpoints

@router.post("/alerts")
@require_permission(Resource.API_SECURITY, Action.CREATE)
async def create_alert(
    alert_data: RateLimitAlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a rate limit alert"""
    # Verify policy exists
    policy = db.query(RateLimitPolicy).filter_by(id=alert_data.policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    alert = RateLimitAlert(
        policy_id=alert_data.policy_id,
        name=alert_data.name,
        description=alert_data.description,
        violation_threshold=alert_data.violation_threshold,
        time_window_minutes=alert_data.time_window_minutes,
        notify_emails=alert_data.notify_emails,
        notify_webhooks=alert_data.notify_webhooks,
        notify_slack=alert_data.notify_slack,
        cooldown_minutes=alert_data.cooldown_minutes,
        is_active=alert_data.is_active
    )
    
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    # Audit log
    audit_logger = AuditLogger(db)
    audit_logger.log_action(
        user_id=current_user.id,
        action="RATE_LIMIT_ALERT_CREATE",
        resource_type="rate_limit_alert",
        resource_id=alert.id,
        details={"name": alert.name, "policy_id": alert.policy_id}
    )
    
    return {
        "id": alert.id,
        "name": alert.name,
        "policy_id": alert.policy_id,
        "message": "Rate limit alert created successfully"
    }


@router.get("/alerts")
@require_permission(Resource.API_SECURITY, Action.READ)
async def list_alerts(
    policy_id: Optional[str] = None,
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List rate limit alerts"""
    query = db.query(RateLimitAlert)
    
    if policy_id:
        query = query.filter_by(policy_id=policy_id)
        
    if active_only:
        query = query.filter_by(is_active=True)
        
    alerts = query.all()
    
    return [{
        "id": a.id,
        "policy_id": a.policy_id,
        "policy_name": a.policy.name,
        "name": a.name,
        "description": a.description,
        "violation_threshold": a.violation_threshold,
        "time_window_minutes": a.time_window_minutes,
        "is_active": a.is_active,
        "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
        "trigger_count": a.trigger_count
    } for a in alerts]# Monitoring and Analytics Endpoints

@router.get("/violations")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_violations(
    policy_id: Optional[str] = None,
    identifier: Optional[str] = None,
    hours_back: int = Query(24, ge=1, le=720),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rate limit violation history"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    violations = service.get_violation_history(
        policy_id=policy_id,
        identifier=identifier,
        hours_back=hours_back,
        limit=limit
    )
    
    return [{
        "id": v.id,
        "policy_id": v.policy_id,
        "policy_name": v.policy.name,
        "identifier": v.identifier,
        "endpoint": v.endpoint,
        "method": v.method,
        "ip_address": v.ip_address,
        "window_start": v.window_start.isoformat(),
        "request_count": v.request_count,
        "limit_exceeded_by": v.limit_exceeded_by,
        "action_taken": v.action_taken.value,
        "violated_at": v.violated_at.isoformat()
    } for v in violations]


@router.get("/metrics")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_metrics(
    policy_id: Optional[str] = None,
    hours_back: int = Query(24, ge=1, le=720),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rate limit metrics and statistics"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    metrics = service.get_metrics(
        policy_id=policy_id,
        hours_back=hours_back
    )
    
    return [{
        "policy_id": m.policy_id,
        "policy_name": db.query(RateLimitPolicy).filter_by(id=m.policy_id).first().name if m.policy_id else "Global",
        "bucket_start": m.bucket_start.isoformat(),
        "bucket_minutes": m.bucket_minutes,
        "total_requests": m.total_requests,
        "blocked_requests": m.blocked_requests,
        "violation_rate": m.violation_rate,
        "avg_response_time_ms": m.avg_response_time_ms,
        "p95_response_time_ms": m.p95_response_time_ms,
        "p99_response_time_ms": m.p99_response_time_ms,
        "top_violators": m.top_violators,
        "top_endpoints": m.top_endpoints
    } for m in metrics]


@router.get("/metrics/realtime")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_realtime_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get real-time rate limit metrics (last 5 minutes)"""
    # Get metrics for the last 5 minutes
    since = datetime.utcnow() - timedelta(minutes=5)
    
    # Count active policies
    active_policies = db.query(RateLimitPolicy).filter_by(is_active=True).count()
    
    # Count recent violations
    recent_violations = db.query(RateLimitViolation).filter(
        RateLimitViolation.violated_at >= since
    ).count()
    
    # Get top violators
    from sqlalchemy import func
    top_violators = db.query(
        RateLimitViolation.identifier,
        func.count(RateLimitViolation.id).label('count')
    ).filter(
        RateLimitViolation.violated_at >= since
    ).group_by(
        RateLimitViolation.identifier
    ).order_by(
        func.count(RateLimitViolation.id).desc()
    ).limit(5).all()
    
    # Get violation trend (per minute for last 5 minutes)
    trend = []
    for i in range(5):
        minute_start = since + timedelta(minutes=i)
        minute_end = minute_start + timedelta(minutes=1)
        
        count = db.query(RateLimitViolation).filter(
            RateLimitViolation.violated_at.between(minute_start, minute_end)
        ).count()
        
        trend.append({
            "minute": minute_start.isoformat(),
            "violations": count
        })
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "active_policies": active_policies,
        "recent_violations": recent_violations,
        "top_violators": [
            {"identifier": v[0], "count": v[1]} for v in top_violators
        ],
        "violation_trend": trend
    }


@router.post("/metrics/collect")
@require_permission(Resource.API_SECURITY, Action.EXECUTE)
async def trigger_metrics_collection(
    bucket_minutes: int = Query(5, ge=1, le=60),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger metrics collection"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    # Schedule collection in background
    background_tasks.add_task(service.collect_metrics, bucket_minutes)
    
    return {
        "message": "Metrics collection scheduled",
        "bucket_minutes": bucket_minutes
    }


# Testing Endpoints

@router.post("/test")
@require_permission(Resource.API_SECURITY, Action.EXECUTE)
async def test_rate_limit(
    test_request: RateLimitTestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test rate limits for a specific request"""
    audit_logger = AuditLogger(db)
    service = RateLimitService(db, audit_logger)
    
    allowed, policy, info = service.check_rate_limit(
        identifier=test_request.identifier,
        endpoint=test_request.endpoint,
        method=test_request.method,
        api_key_id=test_request.api_key_id,
        user_id=test_request.user_id,
        ip_address=test_request.ip_address
    )
    
    return {
        "allowed": allowed,
        "policy": {
            "id": policy.id,
            "name": policy.name,
            "window": policy.window.value,
            "limit": policy.limit
        } if policy else None,
        "info": info,
        "test_details": {
            "identifier": test_request.identifier,
            "endpoint": test_request.endpoint,
            "method": test_request.method
        }
    }


# Export endpoints

@router.get("/export")
@require_permission(Resource.API_SECURITY, Action.READ)
async def export_policies(
    format: str = Query("json", regex="^(json|csv)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export rate limit policies"""
    policies = db.query(RateLimitPolicy).all()
    
    if format == "json":
        data = [{
            "name": p.name,
            "description": p.description,
            "target_type": p.target_type.value,
            "target_value": p.target_value,
            "window": p.window.value,
            "limit": p.limit,
            "burst_enabled": p.burst_enabled,
            "burst_limit": p.burst_limit,
            "priority": p.priority,
            "is_active": p.is_active
        } for p in policies]
        
        return StreamingResponse(
            iter([json.dumps(data, indent=2)]),
            media_type="application/json",
            headers={
                "Content-Disposition": "attachment; filename=rate_limit_policies.json"
            }
        )
    else:
        # CSV format
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "name", "target_type", "target_value", "window", 
            "limit", "burst_enabled", "priority", "is_active"
        ])
        
        writer.writeheader()
        for p in policies:
            writer.writerow({
                "name": p.name,
                "target_type": p.target_type.value,
                "target_value": p.target_value or "",
                "window": p.window.value,
                "limit": p.limit,
                "burst_enabled": p.burst_enabled,
                "priority": p.priority,
                "is_active": p.is_active
            })
            
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=rate_limit_policies.csv"
            }
        )