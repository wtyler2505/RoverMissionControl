"""
FastAPI routes for secure logging system
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
import json
from pydantic import BaseModel, Field

from ..dependencies import get_current_user
from ..rbac.decorators import require_permission
from .secure_logging_service import SecureLoggingService, EXAMPLE_CONFIG


# Initialize service
# In production, load from environment or config file
secure_logging_service = SecureLoggingService(EXAMPLE_CONFIG)


# Pydantic models
class LogEventRequest(BaseModel):
    """Request model for logging events"""
    event_type: str = Field(..., description="Type of event")
    severity: str = Field(..., regex="^(critical|high|medium|low|info)$")
    data: Dict[str, Any] = Field(..., description="Event data")
    actor: Optional[str] = Field(None, description="Actor who triggered event")
    correlation_id: Optional[str] = Field(None, description="Correlation ID")
    notify: bool = Field(True, description="Send notifications")
    compliance_evidence: bool = Field(False, description="Store as compliance evidence")


class VerifyIntegrityResponse(BaseModel):
    """Response model for integrity verification"""
    hash_chain_valid: bool
    hash_chain_errors: List[str]
    storage_status: Dict[str, Any]
    siem_status: Dict[str, Any]


class ComplianceReportRequest(BaseModel):
    """Request model for compliance reports"""
    framework_id: str = Field(..., description="Compliance framework ID")
    start_date: datetime = Field(..., description="Report start date")
    end_date: datetime = Field(..., description="Report end date")


class IncidentAnalysisRequest(BaseModel):
    """Request model for incident analysis"""
    log_sources: List[str] = Field(..., description="Log sources to analyze")
    start_time: datetime = Field(..., description="Analysis start time")
    end_time: datetime = Field(..., description="Analysis end time")
    incident_title: str = Field(..., description="Incident title")


class ExportLogsRequest(BaseModel):
    """Request model for log export"""
    start_time: datetime = Field(..., description="Export start time")
    end_time: datetime = Field(..., description="Export end time")
    include_encrypted: bool = Field(False, description="Include decrypted logs")


# Create router
router = APIRouter(
    prefix="/api/v1/secure-logging",
    tags=["secure-logging"],
    responses={404: {"description": "Not found"}}
)


@router.on_event("startup")
async def startup_event():
    """Start secure logging service"""
    await secure_logging_service.start()


@router.on_event("shutdown")
async def shutdown_event():
    """Stop secure logging service"""
    await secure_logging_service.stop()


@router.post("/log-event", response_model=Dict[str, str])
@require_permission("system.logging.write")
async def log_security_event(
    request: LogEventRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a security event through the secure logging system
    
    This endpoint:
    - Creates tamper-proof hash chain entry
    - Encrypts and stores the event
    - Replicates to redundant storage
    - Sends to SIEM systems
    - Triggers notifications if configured
    - Creates compliance evidence if requested
    """
    try:
        # Add user info if not provided
        if not request.actor:
            request.actor = current_user.get("username", "system")
            
        # Log event
        event_id = await secure_logging_service.log_event(
            event_type=request.event_type,
            severity=request.severity,
            data=request.data,
            actor=request.actor,
            correlation_id=request.correlation_id,
            notify=request.notify,
            compliance_evidence=request.compliance_evidence
        )
        
        return {"event_id": event_id, "status": "logged"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/emergency-stop-event")
@require_permission("emergency.stop.execute")
async def log_emergency_stop_event(
    data: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Log emergency stop event with critical severity
    
    This is specifically for emergency stop events and ensures:
    - Immediate processing (no queuing)
    - Maximum redundancy
    - All stakeholders notified
    - Full audit trail
    """
    try:
        # Enhance data with emergency context
        enhanced_data = {
            **data,
            "emergency_stop": True,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user": current_user
        }
        
        # Log with critical severity
        event_id = await secure_logging_service.log_event(
            event_type="emergency_stop",
            severity="critical",
            data=enhanced_data,
            actor=current_user.get("username"),
            correlation_id=data.get("correlation_id"),
            notify=True,
            compliance_evidence=True
        )
        
        return {
            "event_id": event_id,
            "status": "logged",
            "severity": "critical",
            "notifications_sent": True
        }
        
    except Exception as e:
        # Emergency events must not fail silently
        # Log to fallback mechanism
        import logging
        logging.critical(f"Failed to log emergency stop: {e}", extra={"data": data})
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-integrity", response_model=VerifyIntegrityResponse)
@require_permission("system.logging.admin")
async def verify_system_integrity(
    start_index: int = Query(0, description="Hash chain start index"),
    current_user: dict = Depends(get_current_user)
):
    """
    Verify integrity of the logging system
    
    Checks:
    - Hash chain integrity
    - Storage redundancy
    - SIEM connectivity
    """
    try:
        results = secure_logging_service.verify_integrity(start_index)
        
        return VerifyIntegrityResponse(
            hash_chain_valid=results['hash_chain'][0],
            hash_chain_errors=results['hash_chain'][1],
            storage_status=results['storage_status'],
            siem_status=results['siem_status']
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-compliance-report")
@require_permission("compliance.reports.generate")
async def generate_compliance_report(
    request: ComplianceReportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate compliance report for specified framework
    
    Supported frameworks:
    - ISO27001: ISO/IEC 27001:2022
    - SOC2: SOC 2 Type II
    """
    try:
        # Generate report in background
        def generate_report():
            report_data = secure_logging_service.generate_compliance_report(
                framework_id=request.framework_id,
                start_date=request.start_date,
                end_date=request.end_date
            )
            
            # Save report
            filename = f"compliance_{request.framework_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            filepath = f"/var/log/rover/reports/{filename}"
            
            with open(filepath, 'wb') as f:
                f.write(report_data)
                
            # Log report generation
            secure_logging_service.log_event(
                event_type="compliance_report_generated",
                severity="info",
                data={
                    "framework": request.framework_id,
                    "period_start": request.start_date.isoformat(),
                    "period_end": request.end_date.isoformat(),
                    "report_path": filepath
                },
                actor=current_user.get("username")
            )
            
        background_tasks.add_task(generate_report)
        
        return {
            "status": "generating",
            "message": "Compliance report generation started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-incident")
@require_permission("forensics.analyze")
async def analyze_security_incident(
    request: IncidentAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze security incident using forensic tools
    
    Performs:
    - Timeline reconstruction
    - Anomaly detection
    - Pattern analysis
    - User behavior analytics
    """
    try:
        # Perform analysis
        results = secure_logging_service.analyze_incident(
            log_sources=request.log_sources,
            start_time=request.start_time,
            end_time=request.end_time,
            incident_title=request.incident_title
        )
        
        # Log analysis
        await secure_logging_service.log_event(
            event_type="forensic_analysis",
            severity="high",
            data={
                "incident_id": results['incident_id'],
                "title": request.incident_title,
                "analyzed_by": current_user.get("username"),
                "timeline_entries": results['analysis']['timeline_entries'],
                "anomalies_found": len(results['analysis']['anomalies'])
            },
            actor=current_user.get("username")
        )
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export-logs")
@require_permission("system.logging.export")
async def export_secure_logs(
    request: ExportLogsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Export logs for specified time period
    
    Includes:
    - Hash chain entries
    - Encrypted logs (optionally decrypted)
    - Merkle root for verification
    """
    try:
        # Generate export filename
        filename = f"secure_logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = f"/var/log/rover/exports/{filename}"
        
        # Export in background
        def export_logs():
            secure_logging_service.export_logs(
                start_time=request.start_time,
                end_time=request.end_time,
                output_path=filepath,
                include_encrypted=request.include_encrypted
            )
            
            # Log export
            secure_logging_service.log_event(
                event_type="logs_exported",
                severity="medium",
                data={
                    "export_path": filepath,
                    "period_start": request.start_time.isoformat(),
                    "period_end": request.end_time.isoformat(),
                    "included_encrypted": request.include_encrypted,
                    "exported_by": current_user.get("username")
                },
                actor=current_user.get("username")
            )
            
        background_tasks.add_task(export_logs)
        
        return {
            "status": "exporting",
            "message": "Log export started",
            "filename": filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search-logs")
@require_permission("system.logging.read")
async def search_secure_logs(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """
    Search encrypted logs by metadata
    
    Note: Returns metadata only, not decrypted content
    """
    try:
        # Search logs
        results = secure_logging_service.encrypted_store.search_logs(
            start_time=start_time,
            end_time=end_time,
            event_type=event_type,
            severity=severity,
            actor=actor
        )
        
        # Limit results
        results = results[:limit]
        
        # Log search
        await secure_logging_service.log_event(
            event_type="log_search",
            severity="info",
            data={
                "search_criteria": {
                    "start_time": start_time.isoformat() if start_time else None,
                    "end_time": end_time.isoformat() if end_time else None,
                    "event_type": event_type,
                    "severity": severity,
                    "actor": actor
                },
                "results_count": len(results),
                "searched_by": current_user.get("username")
            },
            actor=current_user.get("username")
        )
        
        return {
            "count": len(results),
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notification-history")
@require_permission("notifications.history.read")
async def get_notification_history(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    event_id: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: dict = Depends(get_current_user)
):
    """
    Get notification history
    """
    try:
        history = secure_logging_service.notification_manager.get_notification_history(
            start_time=start_time,
            end_time=end_time,
            event_id=event_id,
            channel=channel
        )
        
        # Limit results
        history = history[:limit]
        
        return {
            "count": len(history),
            "notifications": history
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
@require_permission("system.logging.admin")
async def get_system_status(current_user: dict = Depends(get_current_user)):
    """
    Get overall system status
    """
    try:
        return {
            "service": "operational",
            "components": {
                "hash_chain": {
                    "entries": len(secure_logging_service.hash_chain.chain),
                    "merkle_root": secure_logging_service.hash_chain.get_merkle_root()
                },
                "storage": secure_logging_service.redundant_storage.get_status(),
                "siem": secure_logging_service.siem_integration.get_status(),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))