"""
Privacy Policy Models
Database models for privacy policy management, versioning, and compliance tracking
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from enum import Enum

Base = declarative_base()


class PolicyLanguage(str, Enum):
    """Supported policy languages"""
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    PORTUGUESE = "pt"
    ITALIAN = "it"
    DUTCH = "nl"
    RUSSIAN = "ru"
    CHINESE = "zh"
    JAPANESE = "ja"


class ChangeType(str, Enum):
    """Types of policy changes"""
    MAJOR = "major"  # Requires user consent
    MINOR = "minor"  # Notification only
    TECHNICAL = "technical"  # No notification required
    COMPLIANCE = "compliance"  # Legal requirement changes


class ComplianceStatus(str, Enum):
    """System compliance status"""
    COMPLIANT = "compliant"
    PARTIAL = "partial"
    NON_COMPLIANT = "non_compliant"
    PENDING_REVIEW = "pending_review"
    MAINTENANCE = "maintenance"


class PrivacyPolicy(Base):
    """Privacy policy versions with content and metadata"""
    __tablename__ = "privacy_policies"
    
    id = Column(String, primary_key=True)
    version = Column(String, nullable=False, index=True)
    language = Column(String, nullable=False, default=PolicyLanguage.ENGLISH)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    plain_language_summary = Column(Text, nullable=True)
    effective_date = Column(DateTime(timezone=True), nullable=False)
    created_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    created_by = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    requires_acknowledgment = Column(Boolean, default=False)
    change_type = Column(String, nullable=False, default=ChangeType.MINOR)
    parent_version = Column(String, ForeignKey("privacy_policies.id"), nullable=True)
    
    # Relationships
    changes = relationship("PolicyChange", back_populates="policy")
    acknowledgments = relationship("PolicyAcknowledgment", back_populates="policy")
    sections = relationship("PolicySection", back_populates="policy")


class PolicySection(Base):
    """Individual sections of a privacy policy"""
    __tablename__ = "policy_sections"
    
    id = Column(String, primary_key=True)
    policy_id = Column(String, ForeignKey("privacy_policies.id"), nullable=False)
    section_key = Column(String, nullable=False)  # e.g., "data_collection", "third_parties"
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    plain_language_summary = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    
    # GDPR Article references
    gdpr_article = Column(String, nullable=True)  # e.g., "Article 6", "Article 13"
    legal_basis = Column(String, nullable=True)  # e.g., "legitimate_interest", "consent"
    
    # Relationships
    policy = relationship("PrivacyPolicy", back_populates="sections")


class PolicyChange(Base):
    """Detailed change tracking for policy versions"""
    __tablename__ = "policy_changes"
    
    id = Column(String, primary_key=True)
    policy_id = Column(String, ForeignKey("privacy_policies.id"), nullable=False)
    section_key = Column(String, nullable=True)  # Null for policy-wide changes
    change_type = Column(String, nullable=False)
    change_description = Column(Text, nullable=False)
    plain_language_description = Column(Text, nullable=True)
    impact_level = Column(String, nullable=False)  # "low", "medium", "high"
    requires_consent = Column(Boolean, default=False)
    effective_date = Column(DateTime(timezone=True), nullable=False)
    created_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    
    # Before/after content for detailed comparison
    content_before = Column(Text, nullable=True)
    content_after = Column(Text, nullable=True)
    
    # Relationships
    policy = relationship("PrivacyPolicy", back_populates="changes")


class PolicyAcknowledgment(Base):
    """User acknowledgments of privacy policy versions"""
    __tablename__ = "policy_acknowledgments"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    policy_id = Column(String, ForeignKey("privacy_policies.id"), nullable=False)
    acknowledged_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    acknowledgment_method = Column(String, nullable=False)  # "modal", "banner", "settings_page", "email"
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    
    # Relationships
    policy = relationship("PrivacyPolicy", back_populates="acknowledgments")


class ComplianceMetric(Base):
    """System compliance metrics and monitoring"""
    __tablename__ = "compliance_metrics"
    
    id = Column(String, primary_key=True)
    metric_name = Column(String, nullable=False, index=True)
    metric_category = Column(String, nullable=False)  # "gdpr", "ccpa", "hipaa", etc.
    current_value = Column(String, nullable=False)
    target_value = Column(String, nullable=True)
    status = Column(String, nullable=False, default=ComplianceStatus.COMPLIANT)
    last_checked = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    last_updated = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    metadata = Column(JSON, nullable=True)  # Additional metric-specific data


class ContextualHelp(Base):
    """Contextual privacy help content linked to application areas"""
    __tablename__ = "contextual_help"
    
    id = Column(String, primary_key=True)
    context_key = Column(String, nullable=False, index=True)  # e.g., "data_collection_banner", "consent_modal"
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    plain_language_content = Column(Text, nullable=True)
    related_policy_sections = Column(JSON, nullable=True)  # List of section keys
    language = Column(String, nullable=False, default=PolicyLanguage.ENGLISH)
    is_active = Column(Boolean, default=True)
    created_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))


class DPIATemplate(Base):
    """Data Protection Impact Assessment templates"""
    __tablename__ = "dpia_templates"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    template_content = Column(JSON, nullable=False)  # Structured template data
    applicable_regulations = Column(JSON, nullable=True)  # List of regulations
    language = Column(String, nullable=False, default=PolicyLanguage.ENGLISH)
    version = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_date = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))


# Pydantic Models for API

class PolicySectionData(BaseModel):
    """Privacy policy section data"""
    section_key: str
    title: str
    content: str
    plain_language_summary: Optional[str] = None
    gdpr_article: Optional[str] = None
    legal_basis: Optional[str] = None
    order_index: int = 0


class PolicyChangeData(BaseModel):
    """Policy change information"""
    section_key: Optional[str] = None
    change_type: ChangeType
    change_description: str
    plain_language_description: Optional[str] = None
    impact_level: str = Field(..., regex="^(low|medium|high)$")
    requires_consent: bool = False
    content_before: Optional[str] = None
    content_after: Optional[str] = None


class CreatePolicyRequest(BaseModel):
    """Request to create a new privacy policy version"""
    version: str
    language: PolicyLanguage = PolicyLanguage.ENGLISH
    title: str
    content: str
    plain_language_summary: Optional[str] = None
    effective_date: datetime
    change_type: ChangeType = ChangeType.MINOR
    parent_version: Optional[str] = None
    sections: List[PolicySectionData] = []
    changes: List[PolicyChangeData] = []


class PolicyResponse(BaseModel):
    """Privacy policy response"""
    id: str
    version: str
    language: str
    title: str
    content: str
    plain_language_summary: Optional[str]
    effective_date: datetime
    created_date: datetime
    is_active: bool
    requires_acknowledgment: bool
    change_type: str
    sections: List[Dict[str, Any]] = []
    changes: List[Dict[str, Any]] = []
    
    class Config:
        from_attributes = True


class ComplianceMetricData(BaseModel):
    """Compliance metric data"""
    metric_name: str
    metric_category: str
    current_value: str
    target_value: Optional[str] = None
    status: ComplianceStatus
    metadata: Optional[Dict[str, Any]] = None


class ContextualHelpData(BaseModel):
    """Contextual help content"""
    context_key: str
    title: str
    content: str
    plain_language_content: Optional[str] = None
    related_policy_sections: Optional[List[str]] = None
    language: PolicyLanguage = PolicyLanguage.ENGLISH


class DPIATemplateData(BaseModel):
    """DPIA template data"""
    name: str
    description: Optional[str] = None
    template_content: Dict[str, Any]
    applicable_regulations: Optional[List[str]] = None
    language: PolicyLanguage = PolicyLanguage.ENGLISH
    version: str


class PolicyAcknowledgmentRequest(BaseModel):
    """Request to acknowledge a privacy policy"""
    policy_id: str
    acknowledgment_method: str = Field(..., regex="^(modal|banner|settings_page|email)$")


class ComplianceDashboardResponse(BaseModel):
    """Compliance dashboard data"""
    overall_status: ComplianceStatus
    total_metrics: int
    compliant_metrics: int
    non_compliant_metrics: int
    pending_reviews: int
    last_updated: datetime
    metrics_by_category: Dict[str, Dict[str, int]]
    recent_policy_changes: List[Dict[str, Any]]
    pending_acknowledgments: int
    user_acknowledgment_rate: float


class PolicyComparisonResponse(BaseModel):
    """Policy version comparison response"""
    from_version: str
    to_version: str
    total_changes: int
    changes_by_type: Dict[str, int]
    changes_by_impact: Dict[str, int]
    requires_acknowledgment: bool
    detailed_changes: List[Dict[str, Any]]
    sections_modified: List[str]