"""
API endpoints for request signing management
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .signing_service import SigningService
from .signing_models import SigningConfiguration, SignatureVerificationLog, SigningSampleCode
from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User
from ..rbac.decorators import require_permission
from ..rbac.permissions import Resource, Action
from ..rbac.audit import AuditLogger

router = APIRouter(prefix="/api/security/signing", tags=["Request Signing"])

# Pydantic models
class SigningConfigCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    algorithm: str = Field(..., pattern="^(HMAC-SHA256|HMAC-SHA512|RSA-SHA256|JWT-HS256|JWT-RS256|ECDSA-SHA256)$")
    key_size: Optional[int] = Field(2048, ge=1024, le=4096)
    include_headers: List[str] = Field(["host", "content-type", "content-length"])
    timestamp_tolerance_seconds: int = Field(300, ge=60, le=3600)
    require_nonce: bool = True
    require_body_hash: bool = True
    jwt_expires_in_seconds: Optional[int] = Field(300, ge=60, le=3600)
    jwt_custom_claims: Optional[Dict[str, Any]] = {}
    allowed_endpoints: Optional[List[str]] = None
    blocked_endpoints: Optional[List[str]] = None
    require_secure_transport: bool = True

class SigningConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    include_headers: Optional[List[str]] = None
    timestamp_tolerance_seconds: Optional[int] = Field(None, ge=60, le=3600)
    require_nonce: Optional[bool] = None
    require_body_hash: Optional[bool] = None
    jwt_expires_in_seconds: Optional[int] = Field(None, ge=60, le=3600)
    jwt_custom_claims: Optional[Dict[str, Any]] = None
    allowed_endpoints: Optional[List[str]] = None
    blocked_endpoints: Optional[List[str]] = None
    require_secure_transport: Optional[bool] = None
    is_active: Optional[bool] = None

class SignRequestBody(BaseModel):
    api_key_id: str
    config_id: str
    method: str = Field(..., pattern="^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
    url: str
    headers: Dict[str, str] = {}
    body: Optional[str] = None

class VerifyRequestBody(BaseModel):
    method: str = Field(..., pattern="^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
    url: str
    headers: Dict[str, str]
    body: Optional[str] = None

class SampleCodeCreate(BaseModel):
    language: str = Field(..., pattern="^(python|javascript|java|csharp|go|ruby|php|curl)$")
    algorithm: str = Field(..., pattern="^(HMAC-SHA256|HMAC-SHA512|RSA-SHA256|JWT-HS256|JWT-RS256|ECDSA-SHA256)$")
    framework: Optional[str] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    code: str = Field(..., min_length=1)
    dependencies: Optional[List[str]] = []
    version: Optional[str] = None
    tested_with: Optional[List[str]] = []

# Endpoints

@router.get("/configurations")
@require_permission(Resource.API_SECURITY, Action.READ)
async def list_signing_configurations(
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all signing configurations"""
    query = db.query(SigningConfiguration)
    
    if active_only:
        query = query.filter(SigningConfiguration.is_active == True)
    
    configs = query.all()
    
    return [config.to_dict() for config in configs]

@router.post("/configurations")
@require_permission(Resource.API_SECURITY, Action.CREATE)
async def create_signing_configuration(
    config_data: SigningConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new signing configuration"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    config = service.create_configuration(
        user=current_user,
        **config_data.dict()
    )
    
    return config.to_dict()

@router.get("/configurations/{config_id}")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_signing_configuration(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific signing configuration"""
    config = db.query(SigningConfiguration).filter(
        SigningConfiguration.id == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    return config.to_dict()

@router.put("/configurations/{config_id}")
@require_permission(Resource.API_SECURITY, Action.UPDATE)
async def update_signing_configuration(
    config_id: str,
    updates: SigningConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a signing configuration"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    config = service.update_configuration(
        user=current_user,
        config_id=config_id,
        **updates.dict(exclude_unset=True)
    )
    
    return config.to_dict()

@router.delete("/configurations/{config_id}")
@require_permission(Resource.API_SECURITY, Action.DELETE)
async def delete_signing_configuration(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate a signing configuration"""
    config = db.query(SigningConfiguration).filter(
        SigningConfiguration.id == config_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )
    
    # Soft delete
    config.is_active = False
    config.updated_at = datetime.utcnow()
    db.commit()
    
    # Audit log
    audit_logger = AuditLogger(db)
    audit_logger.log(
        user=current_user,
        action="delete_signing_configuration",
        resource="signing_configuration",
        resource_id=config.id
    )
    
    return {"message": "Configuration deactivated successfully"}

@router.post("/sign")
@require_permission(Resource.API_SECURITY, Action.EXECUTE)
async def sign_request(
    request_data: SignRequestBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sign a request and return signature headers"""
    # Get API key
    from .models import APIKey
    api_key = db.query(APIKey).filter(
        APIKey.id == request_data.api_key_id,
        APIKey.created_by == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or not owned by user"
        )
    
    # Get configuration
    config = db.query(SigningConfiguration).filter(
        SigningConfiguration.id == request_data.config_id,
        SigningConfiguration.is_active == True
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found or inactive"
        )
    
    # Sign request
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    try:
        signature_headers = service.sign_request(
            api_key=api_key,
            config=config,
            method=request_data.method,
            url=request_data.url,
            headers=request_data.headers,
            body=request_data.body.encode() if request_data.body else None
        )
        
        return {
            "headers": signature_headers,
            "algorithm": config.algorithm,
            "timestamp": signature_headers.get("X-Timestamp"),
            "message": "Request signed successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to sign request: {str(e)}"
        )

@router.post("/verify")
async def verify_request_signature(
    request_data: VerifyRequestBody,
    db: Session = Depends(get_db)
):
    """Verify a request signature"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    is_valid, error_message, api_key = service.verify_request(
        method=request_data.method,
        url=request_data.url,
        headers=request_data.headers,
        body=request_data.body.encode() if request_data.body else None
    )
    
    return {
        "is_valid": is_valid,
        "error": error_message,
        "api_key_id": api_key.id if api_key else None,
        "api_key_name": api_key.name if api_key else None,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/verification-errors")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_verification_errors(
    api_key_id: Optional[str] = None,
    days_back: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get signature verification errors for troubleshooting"""
    # Check if user owns the API key
    if api_key_id:
        from .models import APIKey
        api_key = db.query(APIKey).filter(
            APIKey.id == api_key_id
        ).first()
        
        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )
        
        # Allow admin or owner
        is_admin = any(role.name == "admin" for role in current_user.roles)
        if not is_admin and api_key.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view errors for this API key"
            )
    
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    start_date = datetime.utcnow() - timedelta(days=days_back)
    
    errors = service.get_verification_errors(
        api_key_id=api_key_id,
        start_date=start_date,
        limit=limit
    )
    
    return [error.to_dict() for error in errors]

@router.get("/verification-stats")
@require_permission(Resource.API_SECURITY, Action.READ)
async def get_verification_stats(
    api_key_id: Optional[str] = None,
    config_id: Optional[str] = None,
    days_back: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get signature verification statistics"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    stats = service.get_verification_stats(
        api_key_id=api_key_id,
        config_id=config_id,
        days_back=days_back
    )
    
    return stats

@router.get("/sample-code/{language}/{algorithm}")
async def get_sample_code(
    language: str,
    algorithm: str,
    framework: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get sample code for request signing"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    sample = service.get_sample_code(language, algorithm, framework)
    
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sample code found for {language}/{algorithm}"
        )
    
    return sample.to_dict()

@router.post("/sample-code")
@require_permission(Resource.API_SECURITY, Action.CREATE)
async def create_sample_code(
    sample_data: SampleCodeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new sample code entry"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    sample = service.create_sample_code(**sample_data.dict())
    
    # Audit log
    audit_logger.log(
        user=current_user,
        action="create_sample_code",
        resource="signing_sample_code",
        resource_id=sample.id,
        details={
            "language": sample.language,
            "algorithm": sample.algorithm,
            "title": sample.title
        }
    )
    
    return sample.to_dict()

@router.get("/algorithms")
async def get_supported_algorithms():
    """Get list of supported signing algorithms"""
    return {
        "algorithms": [
            {
                "id": "HMAC-SHA256",
                "name": "HMAC with SHA-256",
                "type": "symmetric",
                "description": "Fast and secure, recommended for most use cases",
                "key_requirements": "Shared secret key"
            },
            {
                "id": "HMAC-SHA512",
                "name": "HMAC with SHA-512",
                "type": "symmetric",
                "description": "Higher security than SHA-256, slightly slower",
                "key_requirements": "Shared secret key"
            },
            {
                "id": "RSA-SHA256",
                "name": "RSA with SHA-256",
                "type": "asymmetric",
                "description": "Public key signature, good for public APIs",
                "key_requirements": "RSA key pair (2048-4096 bits)"
            },
            {
                "id": "JWT-HS256",
                "name": "JWT with HMAC SHA-256",
                "type": "symmetric",
                "description": "Standard JWT signing, includes expiration",
                "key_requirements": "Shared secret key"
            },
            {
                "id": "JWT-RS256",
                "name": "JWT with RSA SHA-256",
                "type": "asymmetric",
                "description": "JWT with public key verification",
                "key_requirements": "RSA key pair"
            },
            {
                "id": "ECDSA-SHA256",
                "name": "ECDSA with SHA-256",
                "type": "asymmetric",
                "description": "Elliptic curve signatures, smaller keys",
                "key_requirements": "EC key pair (P-256 curve)"
            }
        ]
    }

@router.post("/test-signature")
async def test_signature_generation(
    algorithm: str = Query(...),
    db: Session = Depends(get_db)
):
    """Test signature generation with sample data"""
    # Create test data
    test_url = "https://api.example.com/v1/rovers/status"
    test_method = "GET"
    test_headers = {
        "Host": "api.example.com",
        "Content-Type": "application/json",
        "User-Agent": "RoverMissionControl/1.0"
    }
    test_body = '{"rover_id": "rover-001", "command": "status"}'
    
    # Create temporary signer
    from .signing import RequestSigner
    signer = RequestSigner(algorithm)
    
    # Generate test signature
    test_secret = "test-secret-key-12345"
    
    try:
        signature_headers = signer.sign_request(
            method=test_method,
            url=test_url,
            headers=test_headers,
            body=test_body.encode(),
            api_key="test-api-key",
            secret_key=test_secret
        )
        
        # Generate canonical request for display
        canonical_request = signer._create_canonical_request(
            test_method,
            test_url,
            test_headers,
            test_body.encode(),
            signature_headers["X-Timestamp"],
            signature_headers["X-Nonce"]
        )
        
        return {
            "test_data": {
                "method": test_method,
                "url": test_url,
                "headers": test_headers,
                "body": test_body
            },
            "signature_headers": signature_headers,
            "canonical_request": canonical_request,
            "test_secret": test_secret,
            "message": "Test signature generated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate test signature: {str(e)}"
        )

@router.post("/cleanup-nonces")
@require_permission(Resource.API_SECURITY, Action.DELETE)
async def cleanup_nonce_cache(
    older_than_hours: int = Query(24, ge=1, le=168),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clean up expired nonces from cache"""
    audit_logger = AuditLogger(db)
    service = SigningService(db, audit_logger)
    
    cutoff = datetime.utcnow() - timedelta(hours=older_than_hours)
    deleted = service.cleanup_nonce_cache(cutoff)
    
    # Audit log
    audit_logger.log(
        user=current_user,
        action="cleanup_nonce_cache",
        resource="nonce_cache",
        details={
            "older_than_hours": older_than_hours,
            "deleted_count": deleted
        }
    )
    
    return {
        "deleted": deleted,
        "cutoff": cutoff.isoformat(),
        "message": f"Cleaned up {deleted} expired nonces"
    }