"""
API endpoints for rotation management
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .rotation_service import RotationService
from .rotation_models import RotationPolicy, RotationFrequency
from .service import APIKeyService
from ..database import get_db
from ..auth.dependencies import get_current_user
from ..auth.models import User
from ..rbac.decorators import require_permission, require_role
from ..rbac.permissions import Resource, Action
from ..rbac.audit import AuditLogger

router = APIRouter(prefix="/api/keys/rotation", tags=["API Key Rotation"])

# Pydantic models
class RotationPolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    frequency: RotationFrequency
    custom_interval_days: Optional[int] = Field(None, ge=1, le=365)
    rotation_hour_utc: int = Field(2, ge=0, le=23)
    rotation_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    rotation_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    grace_period_hours: int = Field(24, ge=1, le=168)
    overlap_period_hours: int = Field(48, ge=1, le=336)
    notify_days_before: List[int] = Field([7, 3, 1])
    notification_channels: List[str] = Field(["email", "in_app"])
    notification_recipients: Optional[List[str]] = []
    auto_update_enabled: bool = False
    auto_update_config: Optional[dict] = {}
    require_approval: bool = True
    approver_roles: List[str] = Field(["admin"])
    applies_to_all_keys: bool = False
    api_key_tags: Optional[List[str]] = []
    excluded_api_keys: Optional[List[str]] = []

class RotationPolicyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    frequency: Optional[RotationFrequency] = None
    custom_interval_days: Optional[int] = Field(None, ge=1, le=365)
    rotation_hour_utc: Optional[int] = Field(None, ge=0, le=23)
    rotation_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    rotation_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    grace_period_hours: Optional[int] = Field(None, ge=1, le=168)
    overlap_period_hours: Optional[int] = Field(None, ge=1, le=336)
    notify_days_before: Optional[List[int]] = None
    notification_channels: Optional[List[str]] = None
    notification_recipients: Optional[List[str]] = None
    auto_update_enabled: Optional[bool] = None
    auto_update_config: Optional[dict] = None
    require_approval: Optional[bool] = None
    approver_roles: Optional[List[str]] = None
    applies_to_all_keys: Optional[bool] = None
    api_key_tags: Optional[List[str]] = None
    excluded_api_keys: Optional[List[str]] = None
    is_active: Optional[bool] = None

class RotationScheduleRequest(BaseModel):
    policy_id: str
    scheduled_at: datetime
    api_key_ids: Optional[List[str]] = None

class RotationApprovalRequest(BaseModel):
    notes: str = Field(..., min_length=1, max_length=500)

class ApplyPolicyRequest(BaseModel):
    api_key_ids: List[str]

# Endpoints

@router.get("/policies")
@require_permission(Resource.API_KEY_ROTATION, Action.READ)
async def list_rotation_policies(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all rotation policies"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    # Get policies - implement in service
    policies = db.query(RotationPolicy).all()
    if active_only:
        policies = [p for p in policies if p.is_active]
    
    return policies

@router.post("/policies")
@require_permission(Resource.API_KEY_ROTATION, Action.CREATE)
async def create_rotation_policy(
    policy_data: RotationPolicyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new rotation policy"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    policy = service.create_rotation_policy(
        user=current_user,
        **policy_data.dict()
    )
    
    return policy

@router.get("/policies/{policy_id}")
@require_permission(Resource.API_KEY_ROTATION, Action.READ)
async def get_rotation_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific rotation policy"""
    policy = db.query(RotationPolicy).filter(
        RotationPolicy.id == policy_id
    ).first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation policy not found"
        )
    
    return policy

@router.put("/policies/{policy_id}")
@require_permission(Resource.API_KEY_ROTATION, Action.UPDATE)
async def update_rotation_policy(
    policy_id: str,
    policy_data: RotationPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a rotation policy"""
    policy = db.query(RotationPolicy).filter(
        RotationPolicy.id == policy_id
    ).first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation policy not found"
        )
    
    # Update fields
    update_data = policy_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(policy, field, value)
    
    db.commit()
    db.refresh(policy)
    
    # Reschedule if needed
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    if policy.is_active:
        service._schedule_policy(policy)
    
    return policy

@router.delete("/policies/{policy_id}")
@require_permission(Resource.API_KEY_ROTATION, Action.DELETE)
async def delete_rotation_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a rotation policy"""
    policy = db.query(RotationPolicy).filter(
        RotationPolicy.id == policy_id
    ).first()
    
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation policy not found"
        )
    
    # Check if policy is in use
    if policy.rotation_jobs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete policy with scheduled rotations"
        )
    
    db.delete(policy)
    db.commit()
    
    return {"message": "Rotation policy deleted successfully"}

@router.post("/policies/{policy_id}/apply")
@require_permission(Resource.API_KEY_ROTATION, Action.UPDATE)
async def apply_policy_to_keys(
    policy_id: str,
    request: ApplyPolicyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply a rotation policy to API keys"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    applications = service.apply_policy_to_keys(
        policy_id=policy_id,
        api_key_ids=request.api_key_ids,
        user=current_user
    )
    
    return {
        "message": f"Policy applied to {len(applications)} keys",
        "applications": len(applications)
    }

@router.get("/upcoming")
@require_permission(Resource.API_KEY_ROTATION, Action.READ)
async def get_upcoming_rotations(
    days_ahead: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming scheduled rotations"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    # Check if admin to see all rotations
    is_admin = any(role.name == "admin" for role in current_user.roles)
    user_id = None if is_admin else current_user.id
    
    upcoming = service.get_upcoming_rotations(days_ahead, user_id)
    
    return upcoming

@router.post("/schedule")
@require_permission(Resource.API_KEY_ROTATION, Action.CREATE)
async def schedule_rotation(
    request: RotationScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a rotation job"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    job = service.schedule_rotation(
        policy_id=request.policy_id,
        scheduled_at=request.scheduled_at,
        api_key_ids=request.api_key_ids
    )
    
    return job

@router.post("/jobs/{job_id}/execute")
@require_permission(Resource.API_KEY_ROTATION, Action.EXECUTE)
async def execute_rotation_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute a scheduled rotation job"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    job = await service.execute_rotation_job(job_id)
    
    return job

@router.post("/jobs/{job_id}/approve")
@require_permission(Resource.API_KEY_ROTATION, Action.APPROVE)
async def approve_rotation_job(
    job_id: str,
    request: RotationApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a rotation job"""
    from .rotation_models import RotationJob
    
    job = db.query(RotationJob).filter(
        RotationJob.id == job_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation job not found"
        )
    
    if not job.approval_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job does not require approval"
        )
    
    if job.approved_by:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job already approved"
        )
    
    # Approve the job
    job.approved_by = current_user.id
    job.approved_at = datetime.now()
    job.approval_notes = request.notes
    
    db.commit()
    
    # Execute if ready
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    if job.status == "scheduled":
        await service.execute_rotation_job(job_id)
    
    return job

@router.post("/jobs/{job_id}/cancel")
@require_permission(Resource.API_KEY_ROTATION, Action.DELETE)
async def cancel_rotation_job(
    job_id: str,
    reason: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a scheduled rotation job"""
    from .rotation_models import RotationJob, RotationStatus
    
    job = db.query(RotationJob).filter(
        RotationJob.id == job_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rotation job not found"
        )
    
    if job.status != RotationStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in {job.status} status"
        )
    
    job.status = RotationStatus.CANCELLED
    job.error_message = f"Cancelled by {current_user.username}: {reason}"
    
    db.commit()
    
    return {"message": "Rotation job cancelled successfully"}

@router.get("/history")
@require_permission(Resource.API_KEY_ROTATION, Action.READ)
async def get_rotation_history(
    days_back: int = Query(90, ge=1, le=365),
    api_key_id: Optional[str] = None,
    policy_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rotation history"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    history = service.get_rotation_history(
        api_key_id=api_key_id,
        policy_id=policy_id,
        days_back=days_back
    )
    
    # Filter by user's keys if not admin
    if not any(role.name == "admin" for role in current_user.roles):
        user_key_ids = [k.id for k in current_user.api_keys]
        history = [h for h in history if h["api_key"]["id"] in user_key_ids]
    
    return history

@router.get("/metrics")
@require_permission(Resource.API_KEY_ROTATION, Action.READ)
async def get_rotation_metrics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get rotation metrics"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    metrics = service.get_rotation_metrics(start_date, end_date)
    
    return metrics

@router.post("/start-scheduler")
@require_role("admin")
async def start_rotation_scheduler(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start the rotation scheduler (admin only)"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    service.start_scheduler()
    
    return {"message": "Rotation scheduler started"}

@router.post("/stop-scheduler")
@require_role("admin")
async def stop_rotation_scheduler(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stop the rotation scheduler (admin only)"""
    api_key_service = APIKeyService(db)
    audit_logger = AuditLogger(db)
    service = RotationService(db, api_key_service, audit_logger)
    
    service.stop_scheduler()
    
    return {"message": "Rotation scheduler stopped"}