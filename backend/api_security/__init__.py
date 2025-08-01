"""
API Security Module for Rover Mission Control

Provides comprehensive API security features including:
- API key management
- Request signing and verification
- Rate limiting
- Input validation
- Audit logging for API operations
"""

from .models import APIKey, APIKeyScope, APIKeyUsage, APIKeyRotation
from .service import APIKeyService
from .middleware import APIKeyAuthMiddleware, RateLimitMiddleware
from .enhanced_middleware import EnhancedRateLimitMiddleware, RateLimitMetricsCollector
from .validators import RequestValidator
from .signing import RequestSigner, SignatureVerifier
from .rotation_models import RotationPolicy, RotationJob, RotationFrequency
from .rotation_service import RotationService
from .signing_models import SigningConfiguration, SignatureVerificationLog, SigningSampleCode
from .signing_service import SigningService
from .rate_limit_models import (
    RateLimitPolicy, RateLimitViolation, RateLimitAlert,
    RateLimitMetrics, RateLimitCache, RateLimitWindow,
    RateLimitTarget, ViolationAction
)
from .rate_limit_service import RateLimitService
from .audit_models import (
    AuditCategory, AuditSeverity, ComplianceFramework,
    SecurityAuditLog, AuditSnapshot, AuditRetentionPolicy,
    AuditExport, AuditAlert, AuditLogView
)
from .audit_service import AuditService, SecurityEventType
from .versioning_models import (
    APIVersion, APIFeature, VersionStrategy, VersionMigration,
    MigrationExecutionLog, EncryptionConfig, EncryptionKey,
    EncryptionKeyUsage, ComplianceRequirement, VersionUsageMetrics,
    VersionStatus, VersioningStrategy, MigrationStatus,
    EncryptionAlgorithm, EncryptionPurpose, KeyType
)
from .versioning_service import VersioningService

__all__ = [
    "APIKey",
    "APIKeyScope", 
    "APIKeyUsage",
    "APIKeyRotation",
    "APIKeyService",
    "APIKeyAuthMiddleware",
    "RateLimitMiddleware",
    "EnhancedRateLimitMiddleware",
    "RateLimitMetricsCollector",
    "RequestValidator",
    "RequestSigner",
    "SignatureVerifier",
    "RotationPolicy",
    "RotationJob",
    "RotationFrequency",
    "RotationService",
    "SigningConfiguration",
    "SignatureVerificationLog",
    "SigningSampleCode",
    "SigningService",
    "RateLimitPolicy",
    "RateLimitViolation",
    "RateLimitAlert",
    "RateLimitMetrics",
    "RateLimitCache",
    "RateLimitWindow",
    "RateLimitTarget",
    "ViolationAction",
    "RateLimitService",
    "AuditCategory",
    "AuditSeverity",
    "ComplianceFramework",
    "SecurityAuditLog",
    "AuditSnapshot",
    "AuditRetentionPolicy",
    "AuditExport",
    "AuditAlert",
    "AuditLogView",
    "AuditService",
    "SecurityEventType",
    # Versioning and Encryption
    "APIVersion",
    "APIFeature",
    "VersionStrategy", 
    "VersionMigration",
    "MigrationExecutionLog",
    "EncryptionConfig",
    "EncryptionKey",
    "EncryptionKeyUsage",
    "ComplianceRequirement",
    "VersionUsageMetrics",
    "VersionStatus",
    "VersioningStrategy",
    "MigrationStatus",
    "EncryptionAlgorithm",
    "EncryptionPurpose",
    "KeyType",
    "VersioningService"
]