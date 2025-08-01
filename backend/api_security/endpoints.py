"""
API endpoints for API key management
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .service import APIKeyService
from .models import APIKey, APIKeyScope, APIKeyUsage
from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User
from ..rbac.decorators import require_permission, require_role
from ..rbac.permissions import Resource, Action

router = APIRouter(prefix="/api/keys", tags=["API Keys"])

# Pydantic models for API
class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    scopes: Optional[List[str]] = []
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)
    allowed_ips: Optional[List[str]] = []
    allowed_origins: Optional[List[str]] = []
    rate_limit_per_minute: Optional[int] = Field(None, ge=1, le=10000)
    is_read_only: bool = False
    service_name: Optional[str] = Field(None, max_length=50)
    metadata: Optional[dict] = {}
    tags: Optional[List[str]] = []

class APIKeyResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    key_prefix: str
    key_hint: str
    user_id: str
    service_name: Optional[str]
    status: str
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    usage_count: int
    scopes: List[str]
    is_read_only: bool
    allowed_ips: Optional[List[str]]
    allowed_origins: Optional[List[str]]
    rate_limit_per_minute: Optional[int]
    tags: Optional[List[str]]
    
    class Config:
        from_attributes = True

class APIKeyCreateResponse(BaseModel):
    api_key: APIKeyResponse
    key: str  # Full key - only shown once
    message: str = "Store this key securely. It will not be shown again."

class APIKeyScopeResponse(BaseModel):
    name: str
    description: Optional[str]
    resource: str
    action: str
    is_critical: bool
    
    class Config:
        from_attributes = True

class APIKeyUsageResponse(BaseModel):
    timestamp: datetime
    ip_address: Optional[str]
    method: Optional[str]
    path: Optional[str]
    status_code: Optional[int]
    response_time_ms: Optional[int]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True

class APIKeyRotateRequest(BaseModel):
    grace_period_hours: int = Field(24, ge=1, le=168)  # 1 hour to 7 days

class APIKeyRevokeRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

# Endpoints

@router.post("/", response_model=APIKeyCreateResponse)
@require_permission(Resource.API_KEYS, Action.CREATE)
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key"""
    service = APIKeyService(db)
    
    # Validate scopes exist
    if key_data.scopes:
        valid_scopes = db.query(APIKeyScope.name).all()
        valid_scope_names = [s[0] for s in valid_scopes]
        invalid_scopes = [s for s in key_data.scopes if s not in valid_scope_names]
        
        if invalid_scopes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid scopes: {', '.join(invalid_scopes)}"
            )
    
    # Create the key
    api_key, full_key = service.create_api_key(
        user=current_user,
        **key_data.dict()
    )
    
    # Prepare response
    response_data = APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        key_hint=api_key.key_hint,
        user_id=api_key.user_id,
        service_name=api_key.service_name,
        status=api_key.status,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        usage_count=api_key.usage_count,
        scopes=[scope.name for scope in api_key.scopes],
        is_read_only=api_key.is_read_only,
        allowed_ips=api_key.allowed_ips,
        allowed_origins=api_key.allowed_origins,
        rate_limit_per_minute=api_key.rate_limit_per_minute,
        tags=api_key.tags
    )
    
    return APIKeyCreateResponse(api_key=response_data, key=full_key)

@router.get("/", response_model=List[APIKeyResponse])
@require_permission(Resource.API_KEYS, Action.READ)
async def list_api_keys(
    include_revoked: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List API keys for current user"""
    service = APIKeyService(db)
    
    # Admins can see all keys
    if any(role.name == "admin" for role in current_user.roles):
        if include_revoked:
            keys = db.query(APIKey).all()
        else:
            keys = db.query(APIKey).filter(APIKey.status != "revoked").all()
    else:
        # Regular users see only their keys
        keys = service.get_user_api_keys(current_user.id, include_revoked)
    
    return [
        APIKeyResponse(
            id=key.id,
            name=key.name,
            description=key.description,
            key_prefix=key.key_prefix,
            key_hint=key.key_hint,
            user_id=key.user_id,
            service_name=key.service_name,
            status=key.status,
            created_at=key.created_at,
            expires_at=key.expires_at,
            last_used_at=key.last_used_at,
            usage_count=key.usage_count,
            scopes=[scope.name for scope in key.scopes],
            is_read_only=key.is_read_only,
            allowed_ips=key.allowed_ips,
            allowed_origins=key.allowed_origins,
            rate_limit_per_minute=key.rate_limit_per_minute,
            tags=key.tags
        )
        for key in keys
    ]

@router.get("/scopes", response_model=List[APIKeyScopeResponse])
async def list_available_scopes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all available API key scopes"""
    scopes = db.query(APIKeyScope).all()
    
    return [
        APIKeyScopeResponse(
            name=scope.name,
            description=scope.description,
            resource=scope.resource,
            action=scope.action,
            is_critical=scope.is_critical
        )
        for scope in scopes
    ]

@router.get("/{key_id}", response_model=APIKeyResponse)
@require_permission(Resource.API_KEYS, Action.READ)
async def get_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific API key"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Check permission
    is_admin = any(role.name == "admin" for role in current_user.roles)
    if not is_admin and api_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        description=api_key.description,
        key_prefix=api_key.key_prefix,
        key_hint=api_key.key_hint,
        user_id=api_key.user_id,
        service_name=api_key.service_name,
        status=api_key.status,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        last_used_at=api_key.last_used_at,
        usage_count=api_key.usage_count,
        scopes=[scope.name for scope in api_key.scopes],
        is_read_only=api_key.is_read_only,
        allowed_ips=api_key.allowed_ips,
        allowed_origins=api_key.allowed_origins,
        rate_limit_per_minute=api_key.rate_limit_per_minute,
        tags=api_key.tags
    )

@router.get("/{key_id}/usage", response_model=List[APIKeyUsageResponse])
@require_permission(Resource.API_KEYS, Action.READ)
async def get_api_key_usage(
    key_id: str,
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get usage statistics for an API key"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Check permission
    is_admin = any(role.name == "admin" for role in current_user.roles)
    if not is_admin and api_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    service = APIKeyService(db)
    usage_logs = service.get_api_key_usage(key_id, days)
    
    return [
        APIKeyUsageResponse(
            timestamp=log.timestamp,
            ip_address=log.ip_address,
            method=log.method,
            path=log.path,
            status_code=log.status_code,
            response_time_ms=log.response_time_ms,
            error_message=log.error_message
        )
        for log in usage_logs
    ]

@router.post("/{key_id}/rotate", response_model=APIKeyCreateResponse)
@require_permission(Resource.API_KEYS, Action.UPDATE)
async def rotate_api_key(
    key_id: str,
    rotation_data: APIKeyRotateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rotate an API key with grace period"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Check permission
    is_admin = any(role.name == "admin" for role in current_user.roles)
    if not is_admin and api_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    service = APIKeyService(db)
    
    try:
        new_key, full_key, rotation = service.rotate_api_key(
            api_key_id=key_id,
            initiated_by=current_user,
            grace_period_hours=rotation_data.grace_period_hours
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Prepare response
    response_data = APIKeyResponse(
        id=new_key.id,
        name=new_key.name,
        description=new_key.description,
        key_prefix=new_key.key_prefix,
        key_hint=new_key.key_hint,
        user_id=new_key.user_id,
        service_name=new_key.service_name,
        status=new_key.status,
        created_at=new_key.created_at,
        expires_at=new_key.expires_at,
        last_used_at=new_key.last_used_at,
        usage_count=new_key.usage_count,
        scopes=[scope.name for scope in new_key.scopes],
        is_read_only=new_key.is_read_only,
        allowed_ips=new_key.allowed_ips,
        allowed_origins=new_key.allowed_origins,
        rate_limit_per_minute=new_key.rate_limit_per_minute,
        tags=new_key.tags
    )
    
    return APIKeyCreateResponse(
        api_key=response_data,
        key=full_key,
        message=f"New key created. Old key will remain valid for {rotation_data.grace_period_hours} hours."
    )

@router.delete("/{key_id}")
@require_permission(Resource.API_KEYS, Action.DELETE)
async def revoke_api_key(
    key_id: str,
    revoke_data: APIKeyRevokeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke an API key"""
    api_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    # Check permission
    is_admin = any(role.name == "admin" for role in current_user.roles)
    if not is_admin and api_key.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    service = APIKeyService(db)
    
    try:
        service.revoke_api_key(
            api_key_id=key_id,
            revoked_by=current_user,
            reason=revoke_data.reason
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    return {"message": "API key revoked successfully"}

@router.post("/init-scopes")
@require_role("admin")
async def initialize_scopes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize default API key scopes (admin only)"""
    service = APIKeyService(db)
    service.create_default_scopes()
    
    return {"message": "Default scopes initialized successfully"}