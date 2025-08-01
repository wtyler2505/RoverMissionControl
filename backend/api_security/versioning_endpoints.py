"""
Comprehensive API endpoints for versioning and encryption management
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field, validator
import json

from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User
from ..rbac.decorators import require_permission
from ..rbac.permissions import Resource, Action
from .versioning_service import VersioningService, VersioningError, EncryptionError, ComplianceError
from .versioning_models import (
    VersionStatus, VersioningStrategy, MigrationStatus,
    EncryptionAlgorithm, EncryptionPurpose, KeyType
)
from .audit_service import EnhancedAuditService
from .versioning_models import (
    APIVersion, APIFeature, VersionStrategy, VersionMigration,
    MigrationExecutionLog, EncryptionConfig, EncryptionKey,
    EncryptionKeyUsage, ComplianceRequirement, VersionUsageMetrics
)

# Create routers
version_router = APIRouter(prefix="/api/versions", tags=["API Versions"])
encryption_router = APIRouter(prefix="/api/encryption", tags=["Encryption"])

# ==================== Request/Response Models ====================

# Version Management Models
class VersionCreate(BaseModel):
    version_number: str = Field(..., description="Version number (e.g., '1.0.0', 'v2')")
    description: str = Field(..., min_length=1, max_length=1000)
    breaking_changes: Optional[List[str]] = Field(default=[], description="List of breaking changes")
    features: Optional[List[str]] = Field(default=[], description="Feature names to include")
    strategy_type: VersioningStrategy = Field(default=VersioningStrategy.URI_PATH)
    release_notes: Optional[str] = Field(None, description="Markdown release notes")
    documentation_url: Optional[str] = Field(None, description="Documentation URL")
    backwards_compatible: bool = Field(default=True)
    
    @validator('version_number')
    def validate_version(cls, v):
        if not v or not v.strip():
            raise ValueError("Version number cannot be empty")
        return v.strip()

class VersionUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=1000)
    release_notes: Optional[str] = None
    documentation_url: Optional[str] = None
    migration_guide: Optional[str] = None
    breaking_changes: Optional[List[str]] = None
    new_features: Optional[List[str]] = None
    removed_features: Optional[List[str]] = None

class VersionStatusUpdate(BaseModel):
    new_status: VersionStatus
    preview_start_date: Optional[datetime] = None
    release_date: Optional[datetime] = None
    deprecation_date: Optional[datetime] = None
    sunset_date: Optional[datetime] = None
    end_of_life_date: Optional[datetime] = None
    reason: Optional[str] = Field(None, description="Reason for status change")

class VersionResponse(BaseModel):
    id: str
    version_number: str
    semantic_version: Optional[str]
    status: VersionStatus
    description: str
    release_date: Optional[datetime]
    deprecation_date: Optional[datetime]
    sunset_date: Optional[datetime]
    end_of_life_date: Optional[datetime]
    breaking_changes: List[str]
    new_features: Optional[List[str]]
    removed_features: Optional[List[str]]
    backwards_compatible: bool
    documentation_url: Optional[str]
    total_requests: int
    unique_consumers: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Version Strategy Models
class StrategyConfig(BaseModel):
    strategy_type: VersioningStrategy
    is_primary: bool = False
    path_pattern: Optional[str] = None
    path_prefix: Optional[str] = None
    header_name: Optional[str] = None
    header_format: Optional[str] = None
    query_param_name: Optional[str] = None
    content_type_template: Optional[str] = None
    custom_config: Optional[Dict[str, Any]] = None
    strict_matching: bool = True
    allow_version_negotiation: bool = True
    default_if_missing: bool = False

class StrategyResponse(BaseModel):
    id: str
    version_id: str
    strategy_type: VersioningStrategy
    is_primary: bool
    path_pattern: Optional[str]
    path_prefix: Optional[str]
    header_name: Optional[str]
    query_param_name: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Migration Models
class MigrationCreate(BaseModel):
    source_version_id: str
    target_version_id: str
    migration_type: str = Field(default="automatic", pattern="^(automatic|assisted|manual)$")
    priority: int = Field(default=0, ge=0, le=10)
    steps: Optional[List[Dict[str, Any]]] = None
    manual_guide: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(None, ge=1)
    is_reversible: bool = True
    rollback_steps: Optional[List[Dict[str, Any]]] = None

class MigrationExecute(BaseModel):
    api_key_id: Optional[str] = None
    dry_run: bool = Field(default=False, description="Simulate execution without changes")
    client_identifier: Optional[str] = None

class MigrationResponse(BaseModel):
    id: str
    source_version_id: str
    target_version_id: str
    migration_type: str
    priority: int
    compatibility_level: str
    data_transformation_required: bool
    execution_count: int
    success_count: int
    failure_count: int
    status: MigrationStatus
    created_at: datetime
    last_execution_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Encryption Configuration Models
class EncryptionConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    purpose: EncryptionPurpose
    algorithm: EncryptionAlgorithm
    key_size_bits: int = Field(..., ge=128)
    mode_of_operation: Optional[str] = None
    key_rotation_enabled: bool = True
    key_rotation_days: int = Field(default=90, ge=1, le=365)
    tls_version: Optional[str] = None
    cipher_suites: Optional[List[str]] = None
    hsm_enabled: bool = False
    hsm_provider: Optional[str] = None
    hsm_config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = []

class EncryptionConfigUpdate(BaseModel):
    description: Optional[str] = None
    key_rotation_enabled: Optional[bool] = None
    key_rotation_days: Optional[int] = Field(None, ge=1, le=365)
    tls_version: Optional[str] = None
    cipher_suites: Optional[List[str]] = None
    hsm_enabled: Optional[bool] = None
    hsm_config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None

class EncryptionConfigResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    purpose: EncryptionPurpose
    algorithm: EncryptionAlgorithm
    key_size_bits: int
    key_rotation_enabled: bool
    key_rotation_days: int
    is_active: bool
    created_at: datetime
    last_rotation_at: Optional[datetime]
    next_rotation_at: Optional[datetime]
    
    class Config:
        from_attributes = True

# Key Management Models
class KeyGenerate(BaseModel):
    config_id: str
    key_type: KeyType
    key_alias: Optional[str] = Field(None, max_length=100)

class KeyRotate(BaseModel):
    rotation_reason: str = Field(..., min_length=1, max_length=500)
    grace_period_hours: int = Field(default=24, ge=1, le=168)

class KeyRevoke(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)
    immediate: bool = Field(default=False, description="Revoke immediately vs scheduled")

class EncryptionKeyResponse(BaseModel):
    id: str
    config_id: str
    key_id: str
    key_alias: Optional[str]
    key_version: int
    key_type: KeyType
    algorithm: EncryptionAlgorithm
    key_size_bits: int
    is_active: bool
    is_primary: bool
    creation_date: datetime
    activation_date: Optional[datetime]
    expiration_date: Optional[datetime]
    last_used_date: Optional[datetime]
    encryption_count: int
    decryption_count: int
    
    class Config:
        from_attributes = True

# Metrics and Analytics Models
class UsageMetricsQuery(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    granularity: str = Field(default="daily", pattern="^(hourly|daily|weekly|monthly)$")

class UsageAnalysisResponse(BaseModel):
    version_id: str
    period: Dict[str, Any]
    summary: Dict[str, Any]
    trends: Dict[str, Any]
    performance: Dict[str, Any]
    errors: Dict[str, Any]
    feature_usage: Dict[str, Any]
    geographic_distribution: Dict[str, Any]
    client_distribution: Dict[str, Any]
    recommendations: List[str]

# Compatibility Models
class CompatibilityCheckResponse(BaseModel):
    source_version: Dict[str, Any]
    target_version: Dict[str, Any]
    compatibility_level: str
    is_compatible: bool
    breaking_changes: List[str]
    deprecated_features: List[str]
    new_features: List[str]
    schema_changes: List[Dict[str, Any]]
    requires_transformation: bool
    migration_complexity: str
    recommendations: List[str]

# Compliance Models
class ComplianceReportResponse(BaseModel):
    framework: str
    report_period: Dict[str, Any]
    generated_at: datetime
    summary: Dict[str, Any]
    requirements: Dict[str, Any]
    compliant_configurations: List[Dict[str, Any]]
    non_compliant_configurations: List[Dict[str, Any]]
    key_management: Dict[str, Any]
    audit_trail: Dict[str, Any]
    recommendations: List[str]

# ==================== Version Management Endpoints ====================

@version_router.post("/", response_model=VersionResponse)
@require_permission(Resource.API_VERSION, Action.CREATE)
async def create_version(
    version_data: VersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API version with strategy configuration"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        version = await service.create_version(
            user=current_user,
            version_number=version_data.version_number,
            description=version_data.description,
            breaking_changes=version_data.breaking_changes,
            features=version_data.features,
            strategy_type=version_data.strategy_type,
            release_notes=version_data.release_notes,
            documentation_url=version_data.documentation_url,
            backwards_compatible=version_data.backwards_compatible
        )
        
        return VersionResponse.from_orm(version)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create version: {str(e)}"
        )

@version_router.get("/", response_model=List[VersionResponse])
async def list_versions(
    status_filter: Optional[VersionStatus] = Query(None),
    include_metrics: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API versions with optional filtering"""
    try:
        query = db.query(APIVersion)
        
        if status_filter:
            query = query.filter(APIVersion.status == status_filter)
        
        versions = query.order_by(APIVersion.created_at.desc()).all()
        
        return [VersionResponse.from_orm(v) for v in versions]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list versions: {str(e)}"
        )

@version_router.get("/{version_id}", response_model=VersionResponse)
async def get_version(
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific version"""
    version = db.query(APIVersion).filter_by(id=version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version not found: {version_id}"
        )
    
    return VersionResponse.from_orm(version)

@version_router.put("/{version_id}", response_model=VersionResponse)
@require_permission(Resource.API_VERSION, Action.UPDATE)
async def update_version(
    version_id: str,
    updates: VersionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update version information"""
    try:
        version = db.query(APIVersion).filter_by(id=version_id).first()
        if not version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version not found: {version_id}"
            )
        
        # Apply updates
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(version, field, value)
        
        version.updated_at = datetime.now(timezone.utc)
        version.updated_by = current_user.id
        
        db.commit()
        return VersionResponse.from_orm(version)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update version: {str(e)}"
        )

@version_router.post("/{version_id}/status", response_model=VersionResponse)
@require_permission(Resource.API_VERSION, Action.UPDATE)
async def update_version_status(
    version_id: str,
    status_update: VersionStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update version lifecycle status"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        status_dates = status_update.dict(exclude={'new_status', 'reason'}, exclude_unset=True)
        
        version = await service.update_version_status(
            user=current_user,
            version_id=version_id,
            new_status=status_update.new_status,
            **status_dates
        )
        
        return VersionResponse.from_orm(version)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )

@version_router.post("/{version_id}/deprecate", response_model=VersionResponse)
@require_permission(Resource.API_VERSION, Action.UPDATE)
async def deprecate_version(
    version_id: str,
    reason: str = Body(..., embed=True),
    sunset_date: Optional[datetime] = Body(None, embed=True),
    migration_guide: Optional[str] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deprecate an API version with migration guidance"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        version = await service.deprecate_version(
            user=current_user,
            version_id=version_id,
            deprecation_reason=reason,
            sunset_date=sunset_date,
            migration_guide=migration_guide
        )
        
        return VersionResponse.from_orm(version)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deprecate version: {str(e)}"
        )

@version_router.post("/{version_id}/retire", response_model=VersionResponse)
@require_permission(Resource.API_VERSION, Action.DELETE)
async def retire_version(
    version_id: str,
    force: bool = Query(False, description="Force retirement even if still in use"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retire an API version, making it unavailable"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        version = await service.retire_version(
            user=current_user,
            version_id=version_id,
            force=force
        )
        
        return VersionResponse.from_orm(version)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retire version: {str(e)}"
        )

# ==================== Version Strategy Endpoints ====================

@version_router.post("/{version_id}/strategies", response_model=StrategyResponse)
@require_permission(Resource.API_VERSION, Action.UPDATE)
async def configure_version_strategy(
    version_id: str,
    strategy_config: StrategyConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Configure versioning strategy for a version"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        config_dict = strategy_config.dict(exclude={'strategy_type', 'is_primary'}, exclude_unset=True)
        
        strategy = await service.configure_version_strategy(
            user=current_user,
            version_id=version_id,
            strategy_type=strategy_config.strategy_type,
            config=config_dict,
            is_primary=strategy_config.is_primary
        )
        
        return StrategyResponse.from_orm(strategy)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure strategy: {str(e)}"
        )

@version_router.get("/{version_id}/strategies", response_model=List[StrategyResponse])
async def list_version_strategies(
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all strategies for a version"""
    strategies = db.query(VersionStrategy).filter_by(
        version_id=version_id,
        is_active=True
    ).all()
    
    return [StrategyResponse.from_orm(s) for s in strategies]

# ==================== Migration Management Endpoints ====================

@version_router.post("/migrations", response_model=MigrationResponse)
@require_permission(Resource.API_VERSION, Action.CREATE)
async def create_migration_plan(
    migration_data: MigrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a migration plan between versions"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        migration = await service.create_migration_plan(
            user=current_user,
            source_version_id=migration_data.source_version_id,
            target_version_id=migration_data.target_version_id,
            migration_type=migration_data.migration_type,
            steps=migration_data.steps
        )
        
        return MigrationResponse.from_orm(migration)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create migration: {str(e)}"
        )

@version_router.post("/migrations/{migration_id}/execute")
@require_permission(Resource.API_VERSION, Action.EXECUTE)
async def execute_migration(
    migration_id: str,
    execution_data: MigrationExecute,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute a version migration"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        execution_log = await service.execute_migration(
            user=current_user,
            migration_id=migration_id,
            api_key_id=execution_data.api_key_id,
            dry_run=execution_data.dry_run
        )
        
        return {
            "execution_id": execution_log.id if not execution_data.dry_run else None,
            "status": execution_log.status,
            "affected_resources": execution_log.affected_resources,
            "errors": execution_log.error_count,
            "warnings": execution_log.warning_count,
            "duration_ms": execution_log.duration_ms,
            "dry_run": execution_data.dry_run
        }
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute migration: {str(e)}"
        )

@version_router.get("/migrations/{migration_id}/guide")
async def get_migration_guide(
    migration_id: str,
    format: str = Query("markdown", pattern="^(markdown|html|json)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate migration guide for a specific migration"""
    try:
        migration = db.query(VersionMigration).filter_by(id=migration_id).first()
        if not migration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Migration not found: {migration_id}"
            )
        
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        guide = await service.generate_migration_guide(
            source_version_id=migration.source_version_id,
            target_version_id=migration.target_version_id,
            format=format
        )
        
        return {"format": format, "guide": guide}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate guide: {str(e)}"
        )

# ==================== Encryption Configuration Endpoints ====================

@encryption_router.post("/configs", response_model=EncryptionConfigResponse)
@require_permission(Resource.ENCRYPTION, Action.CREATE)
async def create_encryption_config(
    config_data: EncryptionConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new encryption configuration"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        config_params = config_data.dict(
            exclude={'name', 'description', 'purpose', 'algorithm', 'key_size_bits'},
            exclude_unset=True
        )
        
        config = await service.create_encryption_config(
            user=current_user,
            name=config_data.name,
            purpose=config_data.purpose,
            algorithm=config_data.algorithm,
            key_size_bits=config_data.key_size_bits,
            description=config_data.description,
            **config_params
        )
        
        return EncryptionConfigResponse.from_orm(config)
        
    except ComplianceError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EncryptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create config: {str(e)}"
        )

@encryption_router.get("/configs", response_model=List[EncryptionConfigResponse])
async def list_encryption_configs(
    purpose: Optional[EncryptionPurpose] = Query(None),
    algorithm: Optional[EncryptionAlgorithm] = Query(None),
    is_active: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List encryption configurations with optional filtering"""
    query = db.query(EncryptionConfig).filter_by(is_active=is_active)
    
    if purpose:
        query = query.filter(EncryptionConfig.purpose == purpose)
    if algorithm:
        query = query.filter(EncryptionConfig.algorithm == algorithm)
    
    configs = query.order_by(EncryptionConfig.created_at.desc()).all()
    
    return [EncryptionConfigResponse.from_orm(c) for c in configs]

@encryption_router.get("/configs/{config_id}", response_model=EncryptionConfigResponse)
async def get_encryption_config(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about an encryption configuration"""
    config = db.query(EncryptionConfig).filter_by(id=config_id).first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Encryption config not found: {config_id}"
        )
    
    return EncryptionConfigResponse.from_orm(config)

@encryption_router.put("/configs/{config_id}", response_model=EncryptionConfigResponse)
@require_permission(Resource.ENCRYPTION, Action.UPDATE)
async def update_encryption_config(
    config_id: str,
    updates: EncryptionConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update encryption configuration"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        update_dict = updates.dict(exclude_unset=True)
        
        config = await service.update_encryption_config(
            user=current_user,
            config_id=config_id,
            updates=update_dict
        )
        
        return EncryptionConfigResponse.from_orm(config)
        
    except ComplianceError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except EncryptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update config: {str(e)}"
        )

# ==================== Key Management Endpoints ====================

@encryption_router.post("/keys/generate", response_model=EncryptionKeyResponse)
@require_permission(Resource.ENCRYPTION, Action.CREATE)
async def generate_encryption_key(
    key_data: KeyGenerate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new encryption key"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        key = await service.generate_encryption_key(
            user=current_user,
            config_id=key_data.config_id,
            key_type=key_data.key_type,
            key_alias=key_data.key_alias
        )
        
        return EncryptionKeyResponse.from_orm(key)
        
    except EncryptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate key: {str(e)}"
        )

@encryption_router.post("/keys/{key_id}/rotate", response_model=EncryptionKeyResponse)
@require_permission(Resource.ENCRYPTION, Action.UPDATE)
async def rotate_encryption_key(
    key_id: str,
    rotation_data: KeyRotate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rotate an encryption key"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        new_key = await service.rotate_encryption_key(
            user=current_user,
            key_id=key_id,
            rotation_reason=rotation_data.rotation_reason,
            grace_period_hours=rotation_data.grace_period_hours
        )
        
        return EncryptionKeyResponse.from_orm(new_key)
        
    except EncryptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rotate key: {str(e)}"
        )

@encryption_router.post("/keys/{key_id}/revoke", response_model=EncryptionKeyResponse)
@require_permission(Resource.ENCRYPTION, Action.DELETE)
async def revoke_encryption_key(
    key_id: str,
    revoke_data: KeyRevoke,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke an encryption key"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        key = await service.revoke_encryption_key(
            user=current_user,
            key_id=key_id,
            reason=revoke_data.reason,
            immediate=revoke_data.immediate
        )
        
        return EncryptionKeyResponse.from_orm(key)
        
    except EncryptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to revoke key: {str(e)}"
        )

@encryption_router.get("/keys", response_model=List[EncryptionKeyResponse])
async def list_encryption_keys(
    config_id: Optional[str] = Query(None),
    key_type: Optional[KeyType] = Query(None),
    is_active: bool = Query(True),
    include_expired: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List encryption keys with filtering"""
    query = db.query(EncryptionKey)
    
    if config_id:
        query = query.filter(EncryptionKey.config_id == config_id)
    if key_type:
        query = query.filter(EncryptionKey.key_type == key_type)
    if not include_expired:
        query = query.filter(EncryptionKey.is_active == is_active)
    
    keys = query.order_by(EncryptionKey.creation_date.desc()).all()
    
    return [EncryptionKeyResponse.from_orm(k) for k in keys]

# ==================== Usage Metrics Endpoints ====================

@version_router.post("/{version_id}/metrics/collect")
@require_permission(Resource.API_VERSION, Action.UPDATE)
async def collect_version_metrics(
    version_id: str,
    window_start: datetime = Body(..., embed=True),
    window_end: datetime = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Collect and aggregate version usage metrics"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        metrics = await service.collect_version_metrics(
            version_id=version_id,
            window_start=window_start,
            window_end=window_end
        )
        
        return {
            "version_id": version_id,
            "window_start": window_start,
            "window_end": window_end,
            "metrics_collected": True,
            "metric_id": metrics.id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to collect metrics: {str(e)}"
        )

@version_router.post("/{version_id}/analyze", response_model=UsageAnalysisResponse)
async def analyze_version_usage(
    version_id: str,
    query: UsageMetricsQuery,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze version usage patterns and trends"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        analysis = await service.analyze_version_usage(
            version_id=version_id,
            start_date=query.start_date,
            end_date=query.end_date,
            granularity=query.granularity
        )
        
        return UsageAnalysisResponse(**analysis)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze usage: {str(e)}"
        )

# ==================== Compatibility Checking Endpoints ====================

@version_router.get("/compatibility/check", response_model=CompatibilityCheckResponse)
async def check_version_compatibility(
    source_version_id: str = Query(...),
    target_version_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check compatibility between two API versions"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        report = await service.check_version_compatibility(
            source_version_id=source_version_id,
            target_version_id=target_version_id
        )
        
        return CompatibilityCheckResponse(**report)
        
    except VersioningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check compatibility: {str(e)}"
        )

# ==================== Compliance Reporting Endpoints ====================

@encryption_router.get("/compliance/report", response_model=ComplianceReportResponse)
@require_permission(Resource.ENCRYPTION, Action.READ)
async def generate_compliance_report(
    framework: str = Query(..., description="Compliance framework (e.g., PCI-DSS, HIPAA, GDPR)"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate compliance report for encryption standards"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        report = await service.generate_compliance_report(
            framework=framework,
            start_date=start_date,
            end_date=end_date
        )
        
        return ComplianceReportResponse(**report)
        
    except ComplianceError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )

@encryption_router.get("/compliance/frameworks")
async def list_compliance_frameworks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List available compliance frameworks"""
    frameworks = db.query(ComplianceRequirement).all()
    
    return [
        {
            "name": f.name,
            "description": f.description,
            "min_key_size_bits": f.min_key_size_bits,
            "requires_hsm": f.requires_hsm,
            "requires_key_escrow": f.requires_key_escrow,
            "audit_retention_days": f.audit_retention_days
        }
        for f in frameworks
    ]

# ==================== Monitoring Endpoints ====================

@encryption_router.get("/status/monitor")
async def monitor_encryption_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Monitor overall encryption status and health"""
    try:
        audit_service = EnhancedAuditService(db)
        service = VersioningService(db, current_user.rbac_service, audit_service)
        
        status = await service.monitor_encryption_status()
        
        return status
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to monitor status: {str(e)}"
        )

# ==================== Import/Export Endpoints ====================

@version_router.post("/import/openapi")
@require_permission(Resource.API_VERSION, Action.CREATE)
async def import_openapi_spec(
    file: UploadFile = File(...),
    create_version: bool = Query(True, description="Create new version from spec"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import OpenAPI specification and optionally create version"""
    try:
        content = await file.read()
        spec = json.loads(content)
        
        # Extract version info from spec
        version_info = spec.get('info', {})
        version_number = version_info.get('version', '1.0.0')
        
        if create_version:
            audit_service = EnhancedAuditService(db)
            service = VersioningService(db, current_user.rbac_service, audit_service)
            
            # Extract features from paths
            features = list(spec.get('paths', {}).keys())
            
            version = await service.create_version(
                user=current_user,
                version_number=version_number,
                description=version_info.get('description', 'Imported from OpenAPI'),
                features=features[:20],  # Limit to first 20 paths
                documentation_url=version_info.get('termsOfService')
            )
            
            return {
                "message": "OpenAPI spec imported successfully",
                "version_id": version.id,
                "version_number": version.version_number,
                "features_imported": len(features)
            }
        
        return {
            "message": "OpenAPI spec analyzed",
            "version_number": version_number,
            "paths": len(spec.get('paths', {}))
        }
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON in OpenAPI specification"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import spec: {str(e)}"
        )

@version_router.get("/{version_id}/export")
async def export_version_config(
    version_id: str,
    include_strategies: bool = Query(True),
    include_migrations: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export version configuration"""
    version = db.query(APIVersion).filter_by(id=version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version not found: {version_id}"
        )
    
    export_data = {
        "version": {
            "version_number": version.version_number,
            "status": version.status,
            "description": version.description,
            "breaking_changes": version.breaking_changes,
            "new_features": version.new_features,
            "removed_features": version.removed_features,
            "documentation_url": version.documentation_url
        }
    }
    
    if include_strategies:
        strategies = db.query(VersionStrategy).filter_by(version_id=version_id).all()
        export_data["strategies"] = [
            {
                "strategy_type": s.strategy_type,
                "is_primary": s.is_primary,
                "path_prefix": s.path_prefix,
                "header_name": s.header_name,
                "query_param_name": s.query_param_name
            }
            for s in strategies
        ]
    
    if include_migrations:
        migrations = db.query(VersionMigration).filter(
            or_(
                VersionMigration.source_version_id == version_id,
                VersionMigration.target_version_id == version_id
            )
        ).all()
        export_data["migrations"] = [
            {
                "source_version": m.source_version.version_number,
                "target_version": m.target_version.version_number,
                "migration_type": m.migration_type,
                "compatibility_level": m.compatibility_level
            }
            for m in migrations
        ]
    
    return export_data

# ==================== Testing Endpoints ====================

@version_router.post("/test/strategy")
async def test_version_strategy(
    strategy_type: VersioningStrategy = Body(..., embed=True),
    test_url: str = Body(..., embed=True),
    test_headers: Optional[Dict[str, str]] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test version strategy parsing"""
    # This would be implemented to test strategy parsing
    return {
        "strategy_type": strategy_type,
        "test_url": test_url,
        "test_headers": test_headers,
        "detected_version": "1.0.0",  # Placeholder
        "matched": True
    }

