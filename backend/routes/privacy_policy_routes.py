"""
Privacy Policy API Routes
FastAPI routes for privacy policy management and compliance
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..dependencies import get_db
from ..models.privacy_policy import (
    CreatePolicyRequest,
    PolicyResponse,
    ComplianceMetricData,
    ContextualHelpData,
    DPIATemplateData,
    PolicyAcknowledgmentRequest,
    ComplianceDashboardResponse,
    PolicyComparisonResponse,
    PolicyLanguage,
    ComplianceStatus
)
from ..services.privacy_policy_service import PrivacyPolicyService

router = APIRouter(prefix="/api/privacy", tags=["Privacy Policy"])


def get_privacy_service(db: Session = Depends(get_db)) -> PrivacyPolicyService:
    """Dependency to get privacy policy service"""
    return PrivacyPolicyService(db)


# Privacy Policy Management

@router.post("/policies", response_model=PolicyResponse)
async def create_privacy_policy(
    request: CreatePolicyRequest,
    service: PrivacyPolicyService = Depends(get_privacy_service),
    created_by: str = "system"  # In real app, get from auth
):
    """Create a new privacy policy version"""
    try:
        return await service.create_policy(request, created_by)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/policies/active", response_model=Optional[PolicyResponse])
async def get_active_policy(
    language: PolicyLanguage = Query(PolicyLanguage.ENGLISH),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get the current active privacy policy"""
    return await service.get_active_policy(language)


@router.get("/policies/{policy_id}", response_model=Optional[PolicyResponse])
async def get_policy_by_id(
    policy_id: str,
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get a specific privacy policy by ID"""
    policy = await service.get_policy_by_id(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.get("/policies", response_model=List[PolicyResponse])
async def get_policy_versions(
    language: PolicyLanguage = Query(PolicyLanguage.ENGLISH),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get all privacy policy versions"""
    return await service.get_policy_versions(language)


@router.get("/policies/compare", response_model=PolicyComparisonResponse)
async def compare_policies(
    from_version: str = Query(..., description="Source version to compare from"),
    to_version: str = Query(..., description="Target version to compare to"),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Compare two privacy policy versions"""
    try:
        return await service.compare_policies(from_version, to_version)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Policy Acknowledgments

@router.post("/acknowledgments")
async def acknowledge_policy(
    request: PolicyAcknowledgmentRequest,
    req: Request,
    user_id: str = Query(..., description="User ID acknowledging the policy"),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Record user acknowledgment of a privacy policy"""
    try:
        # Extract client information
        ip_address = req.client.host if req.client else None
        user_agent = req.headers.get("user-agent")
        
        success = await service.acknowledge_policy(
            user_id, request, ip_address, user_agent
        )
        
        return {"success": success, "message": "Policy acknowledged successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/acknowledgments/{user_id}")
async def get_user_acknowledgments(
    user_id: str,
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get all policy acknowledgments for a user"""
    return await service.get_user_acknowledgments(user_id)


@router.get("/acknowledgments/{user_id}/status")
async def check_acknowledgment_status(
    user_id: str,
    language: PolicyLanguage = Query(PolicyLanguage.ENGLISH),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Check if user needs to acknowledge current policy"""
    return await service.check_acknowledgment_required(user_id, language)


# Contextual Help

@router.post("/help")
async def create_contextual_help(
    help_data: ContextualHelpData,
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Create contextual help content"""
    try:
        return await service.create_contextual_help(help_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/help/{context_key}")
async def get_contextual_help(
    context_key: str,
    language: PolicyLanguage = Query(PolicyLanguage.ENGLISH),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get contextual help for a specific context"""
    help_content = await service.get_contextual_help(context_key, language)
    if not help_content:
        raise HTTPException(status_code=404, detail="Help content not found")
    return help_content


# Compliance Monitoring

@router.post("/compliance/metrics")
async def update_compliance_metric(
    metric_data: ComplianceMetricData,
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Update or create a compliance metric"""
    try:
        return await service.update_compliance_metric(metric_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/compliance/dashboard", response_model=ComplianceDashboardResponse)
async def get_compliance_dashboard(
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get comprehensive compliance dashboard data"""
    return await service.get_compliance_dashboard()


# DPIA Templates

@router.post("/dpia/templates")
async def create_dpia_template(
    template_data: DPIATemplateData,
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Create a DPIA template"""
    try:
        return await service.create_dpia_template(template_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dpia/templates")
async def get_dpia_templates(
    language: PolicyLanguage = Query(PolicyLanguage.ENGLISH),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Get all DPIA templates"""
    return await service.get_dpia_templates(language)


# Data Export and Utilities

@router.get("/export/{user_id}")
async def export_user_privacy_data(
    user_id: str,
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Export all privacy-related data for a user (GDPR Article 20)"""
    try:
        data = await service.export_user_privacy_data(user_id)
        return JSONResponse(
            content=data,
            headers={
                "Content-Disposition": f"attachment; filename=privacy-export-{user_id}.json"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/changelog")
async def get_privacy_changelog(
    since_version: Optional[str] = Query(None, description="Generate changelog since this version"),
    language: PolicyLanguage = Query(PolicyLanguage.ENGLISH),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Generate a human-readable privacy policy changelog"""
    return await service.generate_privacy_changelog(since_version, language)


# Health Check and Status

@router.get("/health")
async def privacy_system_health():
    """Check privacy system health"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "features": [
            "policy_versioning",
            "contextual_help",
            "compliance_monitoring",
            "dpia_templates",
            "multi_language_support"
        ]
    }


# Administrative Endpoints

@router.post("/admin/initialize-default-content")
async def initialize_default_content(
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Initialize default privacy policy content and templates (Admin only)"""
    try:
        # Create default privacy policy
        default_policy = CreatePolicyRequest(
            version="1.0.0",
            language=PolicyLanguage.ENGLISH,
            title="Privacy Policy",
            content="""# Privacy Policy

## 1. Information We Collect

We collect information you provide directly to us, such as when you create an account, use our rover mission control system, or contact us for support.

## 2. How We Use Your Information

We use the information we collect to:
- Provide, maintain, and improve our services
- Process transactions and manage your account
- Send you technical notices and support messages
- Monitor and analyze usage patterns

## 3. Information Sharing

We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.

## 4. Data Security

We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

## 5. Your Rights

You have the right to:
- Access your personal information
- Correct inaccurate information
- Delete your personal information
- Restrict processing of your information
- Data portability

## 6. Contact Us

If you have questions about this Privacy Policy, please contact us at privacy@rovermissioncontrol.com.
""",
            plain_language_summary="This privacy policy explains how we collect, use, and protect your personal information when you use our rover mission control system.",
            effective_date=datetime.now(),
            sections=[
                {
                    "section_key": "data_collection",
                    "title": "Information We Collect",
                    "content": "We collect information you provide directly to us, such as when you create an account, use our rover mission control system, or contact us for support.",
                    "plain_language_summary": "We collect information when you sign up and use our system.",
                    "gdpr_article": "Article 13",
                    "legal_basis": "legitimate_interest",
                    "order_index": 1
                },
                {
                    "section_key": "data_usage",
                    "title": "How We Use Your Information",
                    "content": "We use the information we collect to provide, maintain, and improve our services, process transactions, and send you important updates.",
                    "plain_language_summary": "We use your information to make our service work for you.",
                    "gdpr_article": "Article 6",
                    "legal_basis": "legitimate_interest",
                    "order_index": 2
                },
                {
                    "section_key": "user_rights",
                    "title": "Your Rights",
                    "content": "You have the right to access, correct, delete, restrict processing of your information, and data portability.",
                    "plain_language_summary": "You control your personal information and can ask us to change or delete it.",
                    "gdpr_article": "Articles 15-20",
                    "legal_basis": "user_rights",
                    "order_index": 5
                }
            ],
            changes=[]
        )
        
        policy = await service.create_policy(default_policy, "system_init")
        
        # Create default contextual help
        help_items = [
            ContextualHelpData(
                context_key="data_collection_banner",
                title="Why do we collect this data?",
                content="We collect this information to provide you with rover control functionality and ensure system security.",
                plain_language_content="We need this information to make the rover system work properly and keep it secure.",
                related_policy_sections=["data_collection", "data_usage"]
            ),
            ContextualHelpData(
                context_key="consent_modal",
                title="Understanding Your Consent",
                content="Your consent allows us to process your personal data for specific purposes. You can withdraw consent at any time.",
                plain_language_content="By agreeing, you let us use your information. You can change your mind later."
            ),
            ContextualHelpData(
                context_key="privacy_settings",
                title="Managing Your Privacy",
                content="Use these settings to control how your data is collected and used. Required permissions ensure basic functionality.",
                plain_language_content="These controls let you decide what information we collect. Some are required for the system to work."
            )
        ]
        
        for help_data in help_items:
            await service.create_contextual_help(help_data)
        
        # Create default compliance metrics
        metrics = [
            ComplianceMetricData(
                metric_name="Data Retention Compliance",
                metric_category="gdpr",
                current_value="30 days",
                target_value="30 days",
                status=ComplianceStatus.COMPLIANT,
                metadata={"description": "User data retained for maximum 30 days after account deletion"}
            ),
            ComplianceMetricData(
                metric_name="Consent Acknowledgment Rate",
                metric_category="gdpr",
                current_value="95%",
                target_value="90%",
                status=ComplianceStatus.COMPLIANT,
                metadata={"description": "Percentage of users who have acknowledged current privacy policy"}
            ),
            ComplianceMetricData(
                metric_name="Data Export Response Time",
                metric_category="gdpr",
                current_value="24 hours",
                target_value="72 hours",
                status=ComplianceStatus.COMPLIANT,
                metadata={"description": "Average time to fulfill data export requests"}
            )
        ]
        
        for metric_data in metrics:
            await service.update_compliance_metric(metric_data)
        
        # Create default DPIA template
        dpia_template = DPIATemplateData(
            name="Rover Mission Control DPIA",
            description="Data Protection Impact Assessment template for rover mission control systems",
            template_content={
                "sections": [
                    {
                        "title": "System Overview",
                        "questions": [
                            "What is the purpose of the data processing?",
                            "What types of personal data are processed?",
                            "Who are the data subjects?",
                            "What is the legal basis for processing?"
                        ]
                    },
                    {
                        "title": "Risk Assessment",
                        "questions": [
                            "What are the potential privacy risks?",
                            "How likely are these risks to occur?",
                            "What would be the impact on individuals?",
                            "What safeguards are in place?"
                        ]
                    },
                    {
                        "title": "Mitigation Measures",
                        "questions": [
                            "How can identified risks be reduced?",
                            "What technical measures are implemented?",
                            "What organizational measures are in place?",
                            "How will effectiveness be monitored?"
                        ]
                    }
                ]
            },
            applicable_regulations=["GDPR", "CCPA"],
            version="1.0.0"
        )
        
        dpia = await service.create_dpia_template(dpia_template)
        
        return {
            "success": True,
            "message": "Default privacy content initialized successfully",
            "created": {
                "policy_id": policy.id,
                "help_items": len(help_items),
                "compliance_metrics": len(metrics),
                "dpia_template_id": dpia["id"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize default content: {str(e)}")


@router.delete("/admin/reset-system")
async def reset_privacy_system(
    confirm: str = Query(..., description="Type 'RESET' to confirm"),
    service: PrivacyPolicyService = Depends(get_privacy_service)
):
    """Reset the entire privacy system (Admin only - DANGEROUS)"""
    if confirm != "RESET":
        raise HTTPException(status_code=400, detail="Confirmation required")
    
    # This would delete all privacy data - implement with extreme caution
    # For now, just return a warning
    return {
        "warning": "This endpoint would reset all privacy data. Implementation requires additional safety measures.",
        "status": "not_implemented"
    }