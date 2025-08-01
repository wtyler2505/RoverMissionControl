"""
Compliance Validation and Reporting Routes
API endpoints for compliance validation, reporting, and privacy request tracking.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..services.compliance_validation_service import (
    ComplianceValidationService,
    ComplianceReport,
    ComplianceCheckResult,
    ComplianceRiskLevel,
    ReportFormat,
    PrivacyRequest
)
from ..services.alert_audit_service import AlertAuditService, ComplianceFramework
from ..models.privacy_policy import ComplianceStatus

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


# Pydantic models for API

class ComplianceCheckResponse(BaseModel):
    """Response model for compliance check results"""
    check_type: str
    check_name: str
    status: str
    risk_level: str
    score: float
    details: Dict[str, Any]
    recommendations: List[str]
    evidence: List[str]
    last_checked: datetime
    next_check_due: Optional[datetime]
    remediation_required: bool
    remediation_deadline: Optional[datetime]


class ComplianceReportResponse(BaseModel):
    """Response model for compliance reports"""
    report_id: str
    generated_at: datetime
    report_period_start: datetime
    report_period_end: datetime
    framework: str
    overall_score: float
    overall_status: str
    total_checks: int
    passed_checks: int
    failed_checks: int
    warning_checks: int
    critical_issues: int
    high_risk_issues: int
    medium_risk_issues: int
    low_risk_issues: int
    check_results: List[ComplianceCheckResponse]
    recommendations: List[str]
    remediation_timeline: Dict[str, datetime]
    next_audit_due: datetime


class PrivacyRequestCreate(BaseModel):
    """Request to create a new privacy request"""
    request_type: str = Field(..., regex="^(access|deletion|portability|rectification|restriction|objection)$")
    user_id: str
    complexity_level: str = Field(default="simple", regex="^(simple|moderate|complex)$")
    data_categories: Optional[List[str]] = None
    third_parties: Optional[List[str]] = None
    notes: Optional[str] = None


class PrivacyRequestUpdate(BaseModel):
    """Request to update privacy request status"""
    status: str = Field(..., regex="^(pending|in_progress|completed|rejected)$")
    notes: Optional[str] = None


class ScheduleAuditRequest(BaseModel):
    """Request to schedule a compliance audit"""
    audit_date: datetime
    audit_type: str = Field(default="comprehensive", regex="^(comprehensive|focused|follow_up)$")
    notify_administrators: bool = True


class ComplianceReportRequest(BaseModel):
    """Request to generate a compliance report"""
    framework: str = Field(default="gdpr", regex="^(gdpr|ccpa|hipaa)$")
    format: str = Field(default="json", regex="^(json|html|csv|pdf|excel)$")
    include_evidence: bool = True
    include_recommendations: bool = True


class ComplianceDashboardResponse(BaseModel):
    """Response model for compliance dashboard"""
    last_audit_date: Optional[datetime]
    overall_compliance_score: float
    overall_status: str
    critical_issues: int
    high_risk_issues: int
    medium_risk_issues: int
    low_risk_issues: int
    next_audit_due: Optional[datetime]
    privacy_requests_last_30_days: int
    average_response_time_hours: float
    compliance_trends: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]


class PrivacyRequestMetricsResponse(BaseModel):
    """Response model for privacy request metrics"""
    total_requests: int
    completed_requests: int
    pending_requests: int
    in_progress_requests: int
    rejected_requests: int
    completion_rate: float
    average_response_time_hours: float
    response_times_within_30_days: float
    requests_by_type: Dict[str, int]
    requests_by_complexity: Dict[str, int]


# Dependency to get compliance service
def get_compliance_service(db: Session = Depends(get_db)) -> ComplianceValidationService:
    """Get compliance validation service instance"""
    audit_service = AlertAuditService(db)
    return ComplianceValidationService(db, audit_service)


@router.post("/audit/run", response_model=ComplianceReportResponse)
async def run_compliance_audit(
    background_tasks: BackgroundTasks,
    framework: str = Query(default="gdpr", regex="^(gdpr|ccpa|hipaa)$"),
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Run a comprehensive compliance audit and generate a report.
    This endpoint performs a full compliance validation across all areas.
    """
    try:
        # Convert string to enum
        framework_enum = ComplianceFramework(framework.upper())
        
        # Run compliance check
        report = await compliance_service.run_comprehensive_compliance_check(framework_enum)
        
        # Convert to response model
        check_results = []
        for check in report.check_results:
            check_results.append(ComplianceCheckResponse(
                check_type=check.check_type.value,
                check_name=check.check_name,
                status=check.status.value,
                risk_level=check.risk_level.value,
                score=check.score,
                details=check.details,
                recommendations=check.recommendations,
                evidence=check.evidence,
                last_checked=check.last_checked,
                next_check_due=check.next_check_due,
                remediation_required=check.remediation_required,
                remediation_deadline=check.remediation_deadline
            ))
        
        response = ComplianceReportResponse(
            report_id=report.report_id,
            generated_at=report.generated_at,
            report_period_start=report.report_period_start,
            report_period_end=report.report_period_end,
            framework=report.framework.value,
            overall_score=report.overall_score,
            overall_status=report.overall_status.value,
            total_checks=report.total_checks,
            passed_checks=report.passed_checks,
            failed_checks=report.failed_checks,
            warning_checks=report.warning_checks,
            critical_issues=report.critical_issues,
            high_risk_issues=report.high_risk_issues,
            medium_risk_issues=report.medium_risk_issues,
            low_risk_issues=report.low_risk_issues,
            check_results=check_results,
            recommendations=report.recommendations,
            remediation_timeline=report.remediation_timeline,
            next_audit_due=report.next_audit_due
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compliance audit failed: {str(e)}")


@router.post("/reports/generate")
async def generate_compliance_report(
    request: ComplianceReportRequest,
    report_id: str = Query(..., description="Report ID from compliance audit"),
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Generate a compliance report in the specified format.
    The report must have been created by running a compliance audit first.
    """
    try:
        # This would need to load the report from storage
        # For now, we'll return an error indicating the report needs to be generated first
        raise HTTPException(
            status_code=404, 
            detail="Report not found. Please run a compliance audit first to generate the report data."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/reports/download/{report_id}")
async def download_compliance_report(
    report_id: str,
    format: str = Query(default="json", regex="^(json|html|csv)$"),
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Download a generated compliance report file.
    """
    try:
        report_file = compliance_service.reports_directory / f"compliance_report_{report_id}.{format}"
        
        if not report_file.exists():
            raise HTTPException(status_code=404, detail="Report file not found")
        
        return FileResponse(
            path=str(report_file),
            filename=f"compliance_report_{report_id}.{format}",
            media_type="application/octet-stream"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report download failed: {str(e)}")


@router.get("/dashboard", response_model=ComplianceDashboardResponse)
async def get_compliance_dashboard(
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Get compliance dashboard data for privacy officers.
    Provides an overview of current compliance status and metrics.
    """
    try:
        dashboard_data = await compliance_service.get_compliance_dashboard_data()
        
        return ComplianceDashboardResponse(**dashboard_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard data retrieval failed: {str(e)}")


@router.post("/privacy-requests", response_model=Dict[str, str])
async def create_privacy_request(
    request: PrivacyRequestCreate,
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Create a new privacy request for tracking compliance with data subject rights.
    """
    try:
        request_id = await compliance_service.track_privacy_request(
            request_type=request.request_type,
            user_id=request.user_id,
            complexity_level=request.complexity_level,
            data_categories=request.data_categories,
            third_parties=request.third_parties,
            notes=request.notes
        )
        
        return {"request_id": request_id, "status": "created"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Privacy request creation failed: {str(e)}")


@router.put("/privacy-requests/{request_id}")
async def update_privacy_request(
    request_id: str,
    update: PrivacyRequestUpdate,
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Update the status of a privacy request.
    """
    try:
        await compliance_service.update_privacy_request_status(
            request_id=request_id,
            status=update.status,
            notes=update.notes
        )
        
        return {"request_id": request_id, "status": "updated"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Privacy request update failed: {str(e)}")


@router.get("/privacy-requests/metrics", response_model=PrivacyRequestMetricsResponse)
async def get_privacy_request_metrics(
    start_date: Optional[datetime] = Query(None, description="Start date (defaults to 30 days ago)"),
    end_date: Optional[datetime] = Query(None, description="End date (defaults to now)"),
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Get privacy request handling metrics for compliance reporting.
    """
    try:
        if not start_date:
            start_date = datetime.now(timezone.utc) - timedelta(days=30)
        if not end_date:
            end_date = datetime.now(timezone.utc)
        
        metrics = await compliance_service.get_privacy_request_metrics(start_date, end_date)
        
        return PrivacyRequestMetricsResponse(**metrics)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metrics retrieval failed: {str(e)}")


@router.post("/audits/schedule", response_model=Dict[str, str])
async def schedule_compliance_audit(
    request: ScheduleAuditRequest,
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Schedule a future compliance audit.
    """
    try:
        audit_id = await compliance_service.schedule_compliance_audit(
            audit_date=request.audit_date,
            audit_type=request.audit_type,
            notify_administrators=request.notify_administrators
        )
        
        return {"audit_id": audit_id, "status": "scheduled"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit scheduling failed: {str(e)}")


@router.get("/checks/individual/{check_type}")
async def run_individual_compliance_check(
    check_type: str,
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Run an individual compliance check for a specific area.
    Useful for focused validation of specific compliance aspects.
    """
    try:
        # This would run a specific check based on the check_type
        # For now, return a placeholder response
        return {
            "message": f"Individual check for {check_type} not yet implemented",
            "status": "pending_implementation"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Individual check failed: {str(e)}")


@router.get("/requirements/gdpr")
async def get_gdpr_requirements(
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Get detailed GDPR requirements and compliance criteria.
    Useful for understanding what each compliance check validates.
    """
    try:
        requirements = compliance_service._load_gdpr_requirements()
        return {"requirements": requirements}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Requirements retrieval failed: {str(e)}")


@router.get("/status/quick")
async def get_quick_compliance_status(
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Get a quick compliance status overview without running a full audit.
    Useful for health checks and monitoring.
    """
    try:
        # Get basic status information
        dashboard_data = await compliance_service.get_compliance_dashboard_data()
        
        return {
            "overall_status": dashboard_data["overall_status"],
            "overall_score": dashboard_data["overall_compliance_score"],
            "critical_issues": dashboard_data["critical_issues"],
            "last_audit": dashboard_data["last_audit_date"],
            "next_audit_due": dashboard_data["next_audit_due"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.get("/alerts/compliance")
async def get_compliance_alerts(
    severity: Optional[str] = Query(None, regex="^(low|medium|high|critical)$"),
    limit: int = Query(default=50, ge=1, le=1000),
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Get compliance-related alerts and violations.
    Useful for monitoring ongoing compliance issues.
    """
    try:
        # This would integrate with the alert system to get compliance-related alerts
        # For now, return a placeholder response
        return {
            "alerts": [],
            "total": 0,
            "message": "Compliance alerts integration pending"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compliance alerts retrieval failed: {str(e)}")


@router.post("/validate/consent-mechanism")
async def validate_consent_mechanism(
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Validate the consent collection and management mechanism.
    Checks if consent collection meets GDPR requirements.
    """
    try:
        # Run specific consent validation
        result = await compliance_service._check_consent_management()
        
        return ComplianceCheckResponse(
            check_type=result.check_type.value,
            check_name=result.check_name,
            status=result.status.value,
            risk_level=result.risk_level.value,
            score=result.score,
            details=result.details,
            recommendations=result.recommendations,
            evidence=result.evidence,
            last_checked=result.last_checked,
            next_check_due=result.next_check_due,
            remediation_required=result.remediation_required,
            remediation_deadline=result.remediation_deadline
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Consent mechanism validation failed: {str(e)}")


@router.post("/validate/retention-policy")
async def validate_retention_policy(
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Validate the data retention policy implementation.
    Checks if retention periods and deletion processes meet GDPR requirements.
    """
    try:
        # Run specific retention validation
        result = await compliance_service._check_retention_policy()
        
        return ComplianceCheckResponse(
            check_type=result.check_type.value,
            check_name=result.check_name,
            status=result.status.value,
            risk_level=result.risk_level.value,
            score=result.score,
            details=result.details,
            recommendations=result.recommendations,
            evidence=result.evidence,
            last_checked=result.last_checked,
            next_check_due=result.next_check_due,
            remediation_required=result.remediation_required,
            remediation_deadline=result.remediation_deadline
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retention policy validation failed: {str(e)}")


@router.get("/templates/regulator-submission")
async def get_regulator_submission_templates(
    framework: str = Query(default="gdpr", regex="^(gdpr|ccpa|hipaa)$"),
    compliance_service: ComplianceValidationService = Depends(get_compliance_service)
):
    """
    Get templates for regulatory submissions and compliance demonstrations.
    """
    try:
        # This would provide templates for regulatory submissions
        templates = {
            "gdpr": {
                "data_protection_officer_contact": {
                    "template": "Data Protection Officer contact information template",
                    "required_fields": ["name", "email", "phone", "address"]
                },
                "records_of_processing": {
                    "template": "Records of processing activities template (Article 30)",
                    "required_fields": ["purpose", "categories_of_data", "retention_period", "security_measures"]
                },
                "privacy_impact_assessment": {
                    "template": "Data Protection Impact Assessment template (Article 35)",
                    "required_fields": ["risk_assessment", "mitigation_measures", "stakeholder_consultation"]
                }
            }
        }
        
        return {"templates": templates.get(framework, {})}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template retrieval failed: {str(e)}")