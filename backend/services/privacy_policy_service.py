"""
Privacy Policy Service
Core service for managing privacy policies, versioning, and compliance
"""

import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_, func
from difflib import unified_diff

from ..models.privacy_policy import (
    PrivacyPolicy,
    PolicySection,
    PolicyChange,
    PolicyAcknowledgment,
    ComplianceMetric,
    ContextualHelp,
    DPIATemplate,
    CreatePolicyRequest,
    PolicyResponse,
    ComplianceMetricData,
    ContextualHelpData,
    DPIATemplateData,
    PolicyAcknowledgmentRequest,
    ComplianceDashboardResponse,
    PolicyComparisonResponse,
    PolicyLanguage,
    ChangeType,
    ComplianceStatus
)


class PrivacyPolicyService:
    """Service for managing privacy policies and compliance"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # Policy Management
    
    async def create_policy(self, request: CreatePolicyRequest, created_by: str) -> PolicyResponse:
        """Create a new privacy policy version"""
        try:
            # Generate unique ID
            policy_id = str(uuid.uuid4())
            
            # Create policy record
            policy = PrivacyPolicy(
                id=policy_id,
                version=request.version,
                language=request.language.value,
                title=request.title,
                content=request.content,
                plain_language_summary=request.plain_language_summary,
                effective_date=request.effective_date,
                created_by=created_by,
                change_type=request.change_type.value,
                parent_version=request.parent_version,
                requires_acknowledgment=request.change_type in [ChangeType.MAJOR, ChangeType.COMPLIANCE]
            )
            
            self.db.add(policy)
            
            # Add sections
            for i, section_data in enumerate(request.sections):
                section = PolicySection(
                    id=str(uuid.uuid4()),
                    policy_id=policy_id,
                    section_key=section_data.section_key,
                    title=section_data.title,
                    content=section_data.content,
                    plain_language_summary=section_data.plain_language_summary,
                    order_index=section_data.order_index or i,
                    gdpr_article=section_data.gdpr_article,
                    legal_basis=section_data.legal_basis
                )
                self.db.add(section)
            
            # Add changes
            for change_data in request.changes:
                change = PolicyChange(
                    id=str(uuid.uuid4()),
                    policy_id=policy_id,
                    section_key=change_data.section_key,
                    change_type=change_data.change_type.value,
                    change_description=change_data.change_description,
                    plain_language_description=change_data.plain_language_description,
                    impact_level=change_data.impact_level,
                    requires_consent=change_data.requires_consent,
                    effective_date=request.effective_date,
                    content_before=change_data.content_before,
                    content_after=change_data.content_after
                )
                self.db.add(change)
            
            # If this is a major change, deactivate previous versions
            if request.change_type in [ChangeType.MAJOR, ChangeType.COMPLIANCE]:
                self.db.query(PrivacyPolicy).filter(
                    and_(
                        PrivacyPolicy.language == request.language.value,
                        PrivacyPolicy.is_active == True,
                        PrivacyPolicy.id != policy_id
                    )
                ).update({"is_active": False})
            
            self.db.commit()
            
            return await self.get_policy_by_id(policy_id)
            
        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to create privacy policy: {str(e)}")
    
    async def get_active_policy(self, language: PolicyLanguage = PolicyLanguage.ENGLISH) -> Optional[PolicyResponse]:
        """Get the current active privacy policy"""
        policy = self.db.query(PrivacyPolicy).filter(
            and_(
                PrivacyPolicy.language == language.value,
                PrivacyPolicy.is_active == True,
                PrivacyPolicy.effective_date <= datetime.now(timezone.utc)
            )
        ).order_by(desc(PrivacyPolicy.effective_date)).first()
        
        if not policy:
            return None
        
        return await self._policy_to_response(policy)
    
    async def get_policy_by_id(self, policy_id: str) -> Optional[PolicyResponse]:
        """Get a specific policy by ID"""
        policy = self.db.query(PrivacyPolicy).filter(PrivacyPolicy.id == policy_id).first()
        
        if not policy:
            return None
        
        return await self._policy_to_response(policy)
    
    async def get_policy_versions(self, language: PolicyLanguage = PolicyLanguage.ENGLISH) -> List[PolicyResponse]:
        """Get all policy versions for a language"""
        policies = self.db.query(PrivacyPolicy).filter(
            PrivacyPolicy.language == language.value
        ).order_by(desc(PrivacyPolicy.created_date)).all()
        
        return [await self._policy_to_response(policy) for policy in policies]
    
    async def compare_policies(self, from_version: str, to_version: str) -> PolicyComparisonResponse:
        """Compare two policy versions"""
        from_policy = self.db.query(PrivacyPolicy).filter(PrivacyPolicy.version == from_version).first()
        to_policy = self.db.query(PrivacyPolicy).filter(PrivacyPolicy.version == to_version).first()
        
        if not from_policy or not to_policy:
            raise ValueError("One or both policy versions not found")
        
        # Get changes between versions
        changes = self.db.query(PolicyChange).filter(
            PolicyChange.policy_id == to_policy.id
        ).all()
        
        # Aggregate change statistics
        changes_by_type = {}
        changes_by_impact = {}
        sections_modified = set()
        
        for change in changes:
            changes_by_type[change.change_type] = changes_by_type.get(change.change_type, 0) + 1
            changes_by_impact[change.impact_level] = changes_by_impact.get(change.impact_level, 0) + 1
            if change.section_key:
                sections_modified.add(change.section_key)
        
        detailed_changes = [
            {
                "section_key": change.section_key,
                "change_type": change.change_type,
                "description": change.change_description,
                "plain_language_description": change.plain_language_description,
                "impact_level": change.impact_level,
                "requires_consent": change.requires_consent,
                "effective_date": change.effective_date.isoformat()
            }
            for change in changes
        ]
        
        return PolicyComparisonResponse(
            from_version=from_version,
            to_version=to_version,
            total_changes=len(changes),
            changes_by_type=changes_by_type,
            changes_by_impact=changes_by_impact,
            requires_acknowledgment=to_policy.requires_acknowledgment,
            detailed_changes=detailed_changes,
            sections_modified=list(sections_modified)
        )
    
    # Policy Acknowledgments
    
    async def acknowledge_policy(self, user_id: str, request: PolicyAcknowledgmentRequest, 
                               ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> bool:
        """Record user acknowledgment of a privacy policy"""
        try:
            # Check if policy exists and is active
            policy = self.db.query(PrivacyPolicy).filter(
                and_(
                    PrivacyPolicy.id == request.policy_id,
                    PrivacyPolicy.is_active == True
                )
            ).first()
            
            if not policy:
                raise ValueError("Policy not found or not active")
            
            # Check if already acknowledged
            existing = self.db.query(PolicyAcknowledgment).filter(
                and_(
                    PolicyAcknowledgment.user_id == user_id,
                    PolicyAcknowledgment.policy_id == request.policy_id
                )
            ).first()
            
            if existing:
                return True  # Already acknowledged
            
            # Create acknowledgment record
            acknowledgment = PolicyAcknowledgment(
                id=str(uuid.uuid4()),
                user_id=user_id,
                policy_id=request.policy_id,
                acknowledgment_method=request.acknowledgment_method,
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            self.db.add(acknowledgment)
            self.db.commit()
            
            return True
            
        except Exception as e:
            self.db.rollback()
            raise Exception(f"Failed to acknowledge policy: {str(e)}")
    
    async def get_user_acknowledgments(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all policy acknowledgments for a user"""
        acknowledgments = self.db.query(PolicyAcknowledgment, PrivacyPolicy).join(
            PrivacyPolicy, PolicyAcknowledgment.policy_id == PrivacyPolicy.id
        ).filter(PolicyAcknowledgment.user_id == user_id).order_by(
            desc(PolicyAcknowledgment.acknowledged_date)
        ).all()
        
        return [
            {
                "policy_version": policy.version,
                "policy_title": policy.title,
                "acknowledged_date": ack.acknowledged_date.isoformat(),
                "acknowledgment_method": ack.acknowledgment_method,
                "effective_date": policy.effective_date.isoformat()
            }
            for ack, policy in acknowledgments
        ]
    
    async def check_acknowledgment_required(self, user_id: str, language: PolicyLanguage = PolicyLanguage.ENGLISH) -> Dict[str, Any]:
        """Check if user needs to acknowledge current policy"""
        active_policy = await self.get_active_policy(language)
        
        if not active_policy or not active_policy.requires_acknowledgment:
            return {
                "required": False,
                "policy": None,
                "days_since_effective": 0
            }
        
        # Check if user has acknowledged this policy
        acknowledgment = self.db.query(PolicyAcknowledgment).filter(
            and_(
                PolicyAcknowledgment.user_id == user_id,
                PolicyAcknowledgment.policy_id == active_policy.id
            )
        ).first()
        
        if acknowledgment:
            return {
                "required": False,
                "policy": active_policy,
                "acknowledged_date": acknowledgment.acknowledged_date.isoformat()
            }
        
        # Calculate days since policy became effective
        days_since_effective = (datetime.now(timezone.utc) - active_policy.effective_date).days
        
        return {
            "required": True,
            "policy": active_policy,
            "days_since_effective": days_since_effective,
            "grace_period_expired": days_since_effective > 30  # 30 day grace period
        }
    
    # Contextual Help
    
    async def create_contextual_help(self, help_data: ContextualHelpData) -> Dict[str, Any]:
        """Create contextual help content"""
        help_item = ContextualHelp(
            id=str(uuid.uuid4()),
            context_key=help_data.context_key,
            title=help_data.title,
            content=help_data.content,
            plain_language_content=help_data.plain_language_content,
            related_policy_sections=help_data.related_policy_sections,
            language=help_data.language.value
        )
        
        self.db.add(help_item)
        self.db.commit()
        
        return {
            "id": help_item.id,
            "context_key": help_item.context_key,
            "title": help_item.title,
            "content": help_item.content,
            "plain_language_content": help_item.plain_language_content,
            "related_policy_sections": help_item.related_policy_sections,
            "language": help_item.language
        }
    
    async def get_contextual_help(self, context_key: str, language: PolicyLanguage = PolicyLanguage.ENGLISH) -> Optional[Dict[str, Any]]:
        """Get contextual help for a specific context"""
        help_item = self.db.query(ContextualHelp).filter(
            and_(
                ContextualHelp.context_key == context_key,
                ContextualHelp.language == language.value,
                ContextualHelp.is_active == True
            )
        ).first()
        
        if not help_item:
            return None
        
        # Get related policy sections
        related_sections = []
        if help_item.related_policy_sections:
            active_policy = await self.get_active_policy(language)
            if active_policy:
                related_sections = [
                    section for section in active_policy.sections
                    if section.get("section_key") in help_item.related_policy_sections
                ]
        
        return {
            "id": help_item.id,
            "context_key": help_item.context_key,
            "title": help_item.title,
            "content": help_item.content,
            "plain_language_content": help_item.plain_language_content,
            "related_sections": related_sections,
            "language": help_item.language
        }
    
    # Compliance Monitoring
    
    async def update_compliance_metric(self, metric_data: ComplianceMetricData) -> Dict[str, Any]:
        """Update or create a compliance metric"""
        existing = self.db.query(ComplianceMetric).filter(
            ComplianceMetric.metric_name == metric_data.metric_name
        ).first()
        
        if existing:
            existing.current_value = metric_data.current_value
            existing.target_value = metric_data.target_value
            existing.status = metric_data.status.value
            existing.last_updated = datetime.now(timezone.utc)
            existing.metadata = metric_data.metadata
            metric = existing
        else:
            metric = ComplianceMetric(
                id=str(uuid.uuid4()),
                metric_name=metric_data.metric_name,
                metric_category=metric_data.metric_category,
                current_value=metric_data.current_value,
                target_value=metric_data.target_value,
                status=metric_data.status.value,
                metadata=metric_data.metadata
            )
            self.db.add(metric)
        
        self.db.commit()
        
        return {
            "id": metric.id,
            "metric_name": metric.metric_name,
            "metric_category": metric.metric_category,
            "current_value": metric.current_value,
            "target_value": metric.target_value,
            "status": metric.status,
            "last_updated": metric.last_updated.isoformat(),
            "metadata": metric.metadata
        }
    
    async def get_compliance_dashboard(self) -> ComplianceDashboardResponse:
        """Get comprehensive compliance dashboard data"""
        # Get all metrics
        metrics = self.db.query(ComplianceMetric).all()
        
        total_metrics = len(metrics)
        compliant_metrics = sum(1 for m in metrics if m.status == ComplianceStatus.COMPLIANT.value)
        non_compliant_metrics = sum(1 for m in metrics if m.status == ComplianceStatus.NON_COMPLIANT.value)
        pending_reviews = sum(1 for m in metrics if m.status == ComplianceStatus.PENDING_REVIEW.value)
        
        # Calculate overall status
        if non_compliant_metrics > 0:
            overall_status = ComplianceStatus.NON_COMPLIANT
        elif pending_reviews > 0 or compliant_metrics < total_metrics:
            overall_status = ComplianceStatus.PARTIAL
        else:
            overall_status = ComplianceStatus.COMPLIANT
        
        # Metrics by category
        metrics_by_category = {}
        for metric in metrics:
            if metric.metric_category not in metrics_by_category:
                metrics_by_category[metric.metric_category] = {}
            
            status = metric.status
            metrics_by_category[metric.metric_category][status] = \
                metrics_by_category[metric.metric_category].get(status, 0) + 1
        
        # Recent policy changes
        recent_changes = self.db.query(PolicyChange).filter(
            PolicyChange.created_date >= datetime.now(timezone.utc) - timedelta(days=30)
        ).order_by(desc(PolicyChange.created_date)).limit(10).all()
        
        recent_policy_changes = [
            {
                "description": change.change_description,
                "impact_level": change.impact_level,
                "requires_consent": change.requires_consent,
                "effective_date": change.effective_date.isoformat(),
                "section_key": change.section_key
            }
            for change in recent_changes
        ]
        
        # Pending acknowledgments
        active_policies = self.db.query(PrivacyPolicy).filter(
            and_(
                PrivacyPolicy.is_active == True,
                PrivacyPolicy.requires_acknowledgment == True
            )
        ).all()
        
        total_acknowledgments = self.db.query(func.count(PolicyAcknowledgment.id)).scalar() or 0
        expected_acknowledgments = len(active_policies) * 100  # Assuming 100 users for calculation
        
        user_acknowledgment_rate = (total_acknowledgments / expected_acknowledgments * 100) if expected_acknowledgments > 0 else 100
        
        return ComplianceDashboardResponse(
            overall_status=overall_status,
            total_metrics=total_metrics,
            compliant_metrics=compliant_metrics,
            non_compliant_metrics=non_compliant_metrics,
            pending_reviews=pending_reviews,
            last_updated=datetime.now(timezone.utc),
            metrics_by_category=metrics_by_category,
            recent_policy_changes=recent_policy_changes,
            pending_acknowledgments=len(active_policies),
            user_acknowledgment_rate=min(user_acknowledgment_rate, 100)
        )
    
    # DPIA Templates
    
    async def create_dpia_template(self, template_data: DPIATemplateData) -> Dict[str, Any]:
        """Create a DPIA template"""
        template = DPIATemplate(
            id=str(uuid.uuid4()),
            name=template_data.name,
            description=template_data.description,
            template_content=template_data.template_content,
            applicable_regulations=template_data.applicable_regulations,
            language=template_data.language.value,
            version=template_data.version
        )
        
        self.db.add(template)
        self.db.commit()
        
        return {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "template_content": template.template_content,
            "applicable_regulations": template.applicable_regulations,
            "language": template.language,
            "version": template.version,
            "created_date": template.created_date.isoformat()
        }
    
    async def get_dpia_templates(self, language: PolicyLanguage = PolicyLanguage.ENGLISH) -> List[Dict[str, Any]]:
        """Get all DPIA templates"""
        templates = self.db.query(DPIATemplate).filter(
            and_(
                DPIATemplate.language == language.value,
                DPIATemplate.is_active == True
            )
        ).order_by(DPIATemplate.name).all()
        
        return [
            {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "applicable_regulations": template.applicable_regulations,
                "version": template.version,
                "created_date": template.created_date.isoformat()
            }
            for template in templates
        ]
    
    # Utility Methods
    
    async def _policy_to_response(self, policy: PrivacyPolicy) -> PolicyResponse:
        """Convert policy database model to response model"""
        # Get sections
        sections = self.db.query(PolicySection).filter(
            PolicySection.policy_id == policy.id
        ).order_by(PolicySection.order_index).all()
        
        # Get changes
        changes = self.db.query(PolicyChange).filter(
            PolicyChange.policy_id == policy.id
        ).order_by(PolicyChange.created_date).all()
        
        return PolicyResponse(
            id=policy.id,
            version=policy.version,
            language=policy.language,
            title=policy.title,
            content=policy.content,
            plain_language_summary=policy.plain_language_summary,
            effective_date=policy.effective_date,
            created_date=policy.created_date,
            is_active=policy.is_active,
            requires_acknowledgment=policy.requires_acknowledgment,
            change_type=policy.change_type,
            sections=[
                {
                    "section_key": section.section_key,
                    "title": section.title,
                    "content": section.content,
                    "plain_language_summary": section.plain_language_summary,
                    "gdpr_article": section.gdpr_article,
                    "legal_basis": section.legal_basis,
                    "order_index": section.order_index
                }
                for section in sections
            ],
            changes=[
                {
                    "section_key": change.section_key,
                    "change_type": change.change_type,
                    "change_description": change.change_description,
                    "plain_language_description": change.plain_language_description,
                    "impact_level": change.impact_level,
                    "requires_consent": change.requires_consent,
                    "effective_date": change.effective_date.isoformat()
                }
                for change in changes
            ]
        )
    
    async def export_user_privacy_data(self, user_id: str) -> Dict[str, Any]:
        """Export all privacy-related data for a user (GDPR Article 20)"""
        acknowledgments = await self.get_user_acknowledgments(user_id)
        
        return {
            "user_id": user_id,
            "export_date": datetime.now(timezone.utc).isoformat(),
            "privacy_policy_acknowledgments": acknowledgments,
            "export_format": "JSON",
            "data_controller": "Rover Mission Control System"
        }
    
    async def generate_privacy_changelog(self, since_version: Optional[str] = None, 
                                       language: PolicyLanguage = PolicyLanguage.ENGLISH) -> Dict[str, Any]:
        """Generate a human-readable privacy policy changelog"""
        query = self.db.query(PrivacyPolicy).filter(PrivacyPolicy.language == language.value)
        
        if since_version:
            since_policy = self.db.query(PrivacyPolicy).filter(PrivacyPolicy.version == since_version).first()
            if since_policy:
                query = query.filter(PrivacyPolicy.created_date > since_policy.created_date)
        
        policies = query.order_by(desc(PrivacyPolicy.created_date)).all()
        
        changelog = {
            "generated_date": datetime.now(timezone.utc).isoformat(),
            "language": language.value,
            "since_version": since_version,
            "total_versions": len(policies),
            "versions": []
        }
        
        for policy in policies:
            changes = self.db.query(PolicyChange).filter(
                PolicyChange.policy_id == policy.id
            ).all()
            
            changelog["versions"].append({
                "version": policy.version,
                "title": policy.title,
                "effective_date": policy.effective_date.isoformat(),
                "change_type": policy.change_type,
                "requires_acknowledgment": policy.requires_acknowledgment,
                "summary": policy.plain_language_summary,
                "changes": [
                    {
                        "section": change.section_key or "General",
                        "description": change.plain_language_description or change.change_description,
                        "impact": change.impact_level,
                        "requires_consent": change.requires_consent
                    }
                    for change in changes
                ]
            })
        
        return changelog