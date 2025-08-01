"""
Alert and threshold management API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from pydantic import BaseModel, Field

from ..models.telemetry_alerts import (
    ThresholdDefinition, AlertRule, AlertInstance, AlertTemplate,
    AlertStatistics, BulkThresholdOperation, ThresholdType,
    AlertSeverity, AlertState, NotificationChannel, TimeWindow
)
from ..dependencies import get_db, get_current_user, check_permissions
from ..services.alert_service import AlertService
from ..services.threshold_service import ThresholdService
from ..services.notification_service import NotificationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# Request/Response models
class ThresholdCreateRequest(BaseModel):
    """Request to create a threshold."""
    threshold: ThresholdDefinition
    create_alert_rule: bool = Field(True, description="Automatically create alert rule")
    alert_config: Optional[Dict[str, Any]] = Field(None, description="Alert rule configuration")

class ThresholdUpdateRequest(BaseModel):
    """Request to update a threshold."""
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    severity: Optional[AlertSeverity] = None
    config_updates: Optional[Dict[str, Any]] = None

class AlertRuleCreateRequest(BaseModel):
    """Request to create an alert rule."""
    rule: AlertRule
    test_immediately: bool = Field(False, description="Test the rule immediately")

class AlertAcknowledgeRequest(BaseModel):
    """Request to acknowledge an alert."""
    notes: Optional[str] = Field(None, description="Acknowledgment notes")
    silence_duration: Optional[TimeWindow] = Field(None, description="Silence duration")

class AlertBulkActionRequest(BaseModel):
    """Request for bulk alert actions."""
    alert_ids: List[str] = Field(..., description="Alert IDs to act on")
    action: Literal["acknowledge", "resolve", "silence"] = Field(..., description="Action to perform")
    notes: Optional[str] = Field(None, description="Action notes")

class NotificationTestRequest(BaseModel):
    """Request to test notification channel."""
    channel: NotificationChannel
    config: Dict[str, Any]
    test_message: Optional[str] = Field("This is a test notification from Rover Mission Control")

# Threshold endpoints
@router.post("/thresholds", response_model=ThresholdDefinition)
async def create_threshold(
    request: ThresholdCreateRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    threshold_service: ThresholdService = Depends()
):
    """Create a new threshold definition."""
    try:
        # Create threshold
        threshold = await threshold_service.create_threshold(
            request.threshold,
            created_by=current_user.id
        )
        
        # Optionally create alert rule
        if request.create_alert_rule:
            alert_config = request.alert_config or {}
            background_tasks.add_task(
                threshold_service.create_default_alert_rule,
                threshold.id,
                alert_config,
                current_user.id
            )
        
        return threshold
    except Exception as e:
        logger.error(f"Failed to create threshold: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/thresholds", response_model=List[ThresholdDefinition])
async def list_thresholds(
    metric_id: Optional[str] = Query(None, description="Filter by metric ID"),
    type: Optional[ThresholdType] = Query(None, description="Filter by threshold type"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    threshold_service: ThresholdService = Depends()
):
    """List threshold definitions with filtering."""
    filters = {
        "metric_id": metric_id,
        "type": type,
        "enabled": enabled,
        "tags": tags
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    
    return await threshold_service.list_thresholds(
        filters=filters,
        skip=skip,
        limit=limit
    )

@router.get("/thresholds/{threshold_id}", response_model=ThresholdDefinition)
async def get_threshold(
    threshold_id: str,
    include_statistics: bool = Query(False, description="Include usage statistics"),
    threshold_service: ThresholdService = Depends()
):
    """Get a specific threshold definition."""
    threshold = await threshold_service.get_threshold(threshold_id)
    if not threshold:
        raise HTTPException(status_code=404, detail="Threshold not found")
    
    if include_statistics:
        threshold.statistics = await threshold_service.get_threshold_statistics(threshold_id)
    
    return threshold

@router.put("/thresholds/{threshold_id}", response_model=ThresholdDefinition)
async def update_threshold(
    threshold_id: str,
    request: ThresholdUpdateRequest,
    current_user=Depends(get_current_user),
    threshold_service: ThresholdService = Depends()
):
    """Update a threshold definition."""
    try:
        return await threshold_service.update_threshold(
            threshold_id,
            request.dict(exclude_unset=True),
            updated_by=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update threshold: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/thresholds/{threshold_id}")
async def delete_threshold(
    threshold_id: str,
    cascade: bool = Query(False, description="Delete associated alert rules"),
    current_user=Depends(get_current_user),
    threshold_service: ThresholdService = Depends()
):
    """Delete a threshold definition."""
    try:
        await threshold_service.delete_threshold(
            threshold_id,
            cascade=cascade,
            deleted_by=current_user.id
        )
        return JSONResponse(status_code=204, content=None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/thresholds/bulk", response_model=Dict[str, Any])
async def bulk_threshold_operation(
    operation: BulkThresholdOperation,
    current_user=Depends(get_current_user),
    threshold_service: ThresholdService = Depends()
):
    """Perform bulk operations on thresholds."""
    try:
        result = await threshold_service.bulk_operation(
            operation,
            user_id=current_user.id
        )
        return result
    except Exception as e:
        logger.error(f"Bulk operation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Alert rule endpoints
@router.post("/rules", response_model=AlertRule)
async def create_alert_rule(
    request: AlertRuleCreateRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Create a new alert rule."""
    try:
        rule = await alert_service.create_rule(
            request.rule,
            created_by=current_user.id
        )
        
        if request.test_immediately:
            background_tasks.add_task(
                alert_service.test_rule,
                rule.id,
                current_user.id
            )
        
        return rule
    except Exception as e:
        logger.error(f"Failed to create alert rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rules", response_model=List[AlertRule])
async def list_alert_rules(
    threshold_id: Optional[str] = Query(None, description="Filter by threshold ID"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    alert_service: AlertService = Depends()
):
    """List alert rules with filtering."""
    filters = {
        "threshold_id": threshold_id,
        "enabled": enabled,
        "severity": severity
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    
    return await alert_service.list_rules(
        filters=filters,
        skip=skip,
        limit=limit
    )

@router.get("/rules/{rule_id}", response_model=AlertRule)
async def get_alert_rule(
    rule_id: str,
    alert_service: AlertService = Depends()
):
    """Get a specific alert rule."""
    rule = await alert_service.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return rule

@router.put("/rules/{rule_id}", response_model=AlertRule)
async def update_alert_rule(
    rule_id: str,
    updates: Dict[str, Any],
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Update an alert rule."""
    try:
        return await alert_service.update_rule(
            rule_id,
            updates,
            updated_by=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: str,
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Delete an alert rule."""
    try:
        await alert_service.delete_rule(
            rule_id,
            deleted_by=current_user.id
        )
        return JSONResponse(status_code=204, content=None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/rules/{rule_id}/test")
async def test_alert_rule(
    rule_id: str,
    test_value: Optional[float] = Body(None, description="Value to test with"),
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Test an alert rule with a simulated value."""
    try:
        result = await alert_service.test_rule(
            rule_id,
            test_value=test_value,
            user_id=current_user.id
        )
        return result
    except Exception as e:
        logger.error(f"Failed to test rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Alert instance endpoints
@router.get("/active", response_model=List[AlertInstance])
async def list_active_alerts(
    metric_id: Optional[str] = Query(None, description="Filter by metric ID"),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    state: Optional[AlertState] = Query(None, description="Filter by state"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    alert_service: AlertService = Depends()
):
    """List active alert instances."""
    filters = {
        "metric_id": metric_id,
        "severity": severity,
        "state": state,
        "active": True
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    
    return await alert_service.list_alerts(
        filters=filters,
        skip=skip,
        limit=limit
    )

@router.get("/history", response_model=List[AlertInstance])
async def list_alert_history(
    start_time: Optional[datetime] = Query(None, description="Start time"),
    end_time: Optional[datetime] = Query(None, description="End time"),
    metric_id: Optional[str] = Query(None, description="Filter by metric ID"),
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    alert_service: AlertService = Depends()
):
    """List historical alerts."""
    filters = {
        "start_time": start_time,
        "end_time": end_time,
        "metric_id": metric_id,
        "severity": severity
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    
    return await alert_service.list_alert_history(
        filters=filters,
        skip=skip,
        limit=limit
    )

@router.get("/alerts/{alert_id}", response_model=AlertInstance)
async def get_alert(
    alert_id: str,
    alert_service: AlertService = Depends()
):
    """Get a specific alert instance."""
    alert = await alert_service.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    request: AlertAcknowledgeRequest,
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Acknowledge an alert."""
    try:
        alert = await alert_service.acknowledge_alert(
            alert_id,
            user_id=current_user.id,
            notes=request.notes,
            silence_duration=request.silence_duration
        )
        return alert
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    notes: Optional[str] = Body(None),
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Resolve an alert."""
    try:
        alert = await alert_service.resolve_alert(
            alert_id,
            user_id=current_user.id,
            notes=notes
        )
        return alert
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alerts/{alert_id}/notes")
async def add_alert_note(
    alert_id: str,
    note: str = Body(..., description="Note to add"),
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Add a note to an alert."""
    try:
        alert = await alert_service.add_note(
            alert_id,
            note=note,
            user_id=current_user.id
        )
        return alert
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/alerts/bulk")
async def bulk_alert_action(
    request: AlertBulkActionRequest,
    current_user=Depends(get_current_user),
    alert_service: AlertService = Depends()
):
    """Perform bulk actions on alerts."""
    try:
        result = await alert_service.bulk_action(
            alert_ids=request.alert_ids,
            action=request.action,
            user_id=current_user.id,
            notes=request.notes
        )
        return result
    except Exception as e:
        logger.error(f"Bulk alert action failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Statistics endpoints
@router.get("/statistics/summary")
async def get_alert_summary(
    time_range: TimeWindow = Query(..., description="Time range for statistics"),
    metric_ids: Optional[List[str]] = Query(None, description="Specific metrics"),
    alert_service: AlertService = Depends()
):
    """Get alert summary statistics."""
    return await alert_service.get_summary_statistics(
        time_range=time_range,
        metric_ids=metric_ids
    )

@router.get("/statistics/trends")
async def get_alert_trends(
    time_range: TimeWindow = Query(..., description="Time range for trends"),
    granularity: Literal["hour", "day", "week"] = Query("day", description="Trend granularity"),
    metric_ids: Optional[List[str]] = Query(None, description="Specific metrics"),
    alert_service: AlertService = Depends()
):
    """Get alert trend analysis."""
    return await alert_service.get_alert_trends(
        time_range=time_range,
        granularity=granularity,
        metric_ids=metric_ids
    )

# Template endpoints
@router.get("/templates", response_model=List[AlertTemplate])
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    system_only: bool = Query(False, description="Only system templates"),
    threshold_service: ThresholdService = Depends()
):
    """List available alert templates."""
    return await threshold_service.list_templates(
        category=category,
        system_only=system_only
    )

@router.post("/templates/{template_id}/apply")
async def apply_template(
    template_id: str,
    variables: Dict[str, Any] = Body(..., description="Template variables"),
    current_user=Depends(get_current_user),
    threshold_service: ThresholdService = Depends()
):
    """Apply a template to create threshold and alert rule."""
    try:
        result = await threshold_service.apply_template(
            template_id=template_id,
            variables=variables,
            user_id=current_user.id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Notification endpoints
@router.post("/notifications/test")
async def test_notification(
    request: NotificationTestRequest,
    current_user=Depends(get_current_user),
    notification_service: NotificationService = Depends()
):
    """Test a notification channel configuration."""
    try:
        result = await notification_service.test_channel(
            channel=request.channel,
            config=request.config,
            test_message=request.test_message,
            user_id=current_user.id
        )
        return result
    except Exception as e:
        logger.error(f"Notification test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notifications/config")
async def get_notification_config(
    notification_service: NotificationService = Depends()
):
    """Get global notification configuration."""
    return await notification_service.get_global_config()

@router.put("/notifications/config")
async def update_notification_config(
    config: Dict[str, Any],
    current_user=Depends(get_current_user),
    notification_service: NotificationService = Depends()
):
    """Update global notification configuration."""
    await check_permissions(current_user, ["alerts:admin"])
    
    try:
        return await notification_service.update_global_config(
            config,
            updated_by=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Export/Import endpoints
@router.get("/export")
async def export_configuration(
    include_thresholds: bool = Query(True),
    include_rules: bool = Query(True),
    include_templates: bool = Query(False),
    format: Literal["json", "yaml"] = Query("json"),
    current_user=Depends(get_current_user)
):
    """Export alert configuration."""
    await check_permissions(current_user, ["alerts:read"])
    
    # Implementation would export configuration
    # This is a placeholder
    return StreamingResponse(
        content=b"{}",
        media_type="application/json" if format == "json" else "application/yaml",
        headers={
            "Content-Disposition": f"attachment; filename=alert-config.{format}"
        }
    )

@router.post("/import")
async def import_configuration(
    file: bytes = Body(...),
    format: Literal["json", "yaml"] = Query("json"),
    merge: bool = Query(False, description="Merge with existing config"),
    current_user=Depends(get_current_user)
):
    """Import alert configuration."""
    await check_permissions(current_user, ["alerts:admin"])
    
    # Implementation would import configuration
    # This is a placeholder
    return {"imported": 0, "skipped": 0, "errors": []}