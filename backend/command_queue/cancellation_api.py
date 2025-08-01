"""
Command Cancellation API Endpoints

Provides REST API for safe command cancellation with:
- Permission-based access control
- Safety validation
- Real-time status updates
- Comprehensive audit logging
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..auth.dependencies import get_current_user
from ..rbac.decorators import require_permission
from ..rbac.permissions import Resource, Action
from ..dependencies import (
    get_command_queue_dep as get_command_queue,
    get_cancellation_manager_dep as get_cancellation_manager,
    get_ws_handler_dep as get_ws_handler
)
from .cancellation_manager import (
    CancellationManager,
    CancellationRequest,
    CancellationReason,
    CancellationState
)
from .command_queue import PriorityCommandQueue
from .websocket_integration import CommandQueueWebSocketHandler


router = APIRouter(prefix="/api/commands/cancel", tags=["Command Cancellation"])


# Request/Response Models

class CancellationRequestModel(BaseModel):
    """Request to cancel a command"""
    command_id: str = Field(..., description="ID of command to cancel")
    reason: str = Field(
        default="user_request",
        description="Reason for cancellation",
        regex="^(user_request|timeout|emergency_stop|system_shutdown|dependency_failed|resource_unavailable|safety_violation)$"
    )
    force: bool = Field(
        default=False,
        description="Force cancellation even for safety-critical commands (requires admin)"
    )
    rollback: bool = Field(
        default=True,
        description="Attempt to rollback command effects"
    )
    confirmation_token: Optional[str] = Field(
        None,
        description="Confirmation token for critical command cancellation"
    )
    notes: Optional[str] = Field(None, description="Additional notes about cancellation")


class CancellationConfirmationRequest(BaseModel):
    """Request confirmation for critical command cancellation"""
    command_id: str
    confirmation_text: str = Field(
        ...,
        description="User must type this text to confirm"
    )
    expires_at: datetime


class CancellationResponse(BaseModel):
    """Response from cancellation request"""
    success: bool
    command_id: str
    state: str
    message: Optional[str] = None
    requires_confirmation: bool = False
    confirmation_request: Optional[CancellationConfirmationRequest] = None
    validation_errors: List[str] = Field(default_factory=list)
    cleanup_actions: List[str] = Field(default_factory=list)
    rollback_actions: List[str] = Field(default_factory=list)


class CancellationStatusResponse(BaseModel):
    """Status of a cancellation request"""
    command_id: str
    state: str
    reason: str
    requester_id: str
    timestamp: datetime
    completed_at: Optional[datetime] = None
    validation_errors: List[str]
    cleanup_actions: List[str]
    rollback_actions: List[str]
    error_message: Optional[str] = None


class CancellationHistoryResponse(BaseModel):
    """Cancellation history entry"""
    command_id: str
    command_type: str
    cancellation_state: str
    cancellation_reason: str
    requester_id: str
    timestamp: datetime
    completed_at: Optional[datetime] = None
    success: bool
    duration_ms: Optional[float] = None


class CancellationStatsResponse(BaseModel):
    """Cancellation statistics"""
    total_requests: int
    successful_cancellations: int
    failed_cancellations: int
    rejected_cancellations: int
    average_cancellation_time_ms: float
    resource_cleanup_failures: int
    rollback_failures: int
    active_cancellations: int


# Endpoints

@router.post("/", response_model=CancellationResponse)
@require_permission(Resource.COMMANDS, Action.UPDATE)
async def cancel_command(
    request: CancellationRequestModel,
    current_user: dict = Depends(get_current_user),
    cancellation_manager: CancellationManager = Depends(get_cancellation_manager),
    command_queue: PriorityCommandQueue = Depends(get_command_queue)
):
    """
    Cancel a command with safety validation.
    
    Requires UPDATE permission on commands.
    Force cancellation requires ADMIN permission.
    """
    # Check force permission
    if request.force:
        # This would check for admin permission
        if not current_user.get("is_admin", False):
            raise HTTPException(
                status_code=403,
                detail="Force cancellation requires admin privileges"
            )
    
    # Get command to check if confirmation is needed
    command = await command_queue.get_command(request.command_id)
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")
    
    # Check if confirmation is required
    requires_confirmation = (
        command.metadata.custom_data.get("requires_cancellation_confirmation", False) or
        command.command_type.value in ["firmware_update", "reset", "emergency_stop"]
    )
    
    if requires_confirmation and not request.confirmation_token:
        # Generate confirmation request
        confirmation = CancellationConfirmationRequest(
            command_id=request.command_id,
            confirmation_text=f"CANCEL-{command.command_type.value.upper()}",
            expires_at=datetime.utcnow().timestamp() + 300  # 5 minutes
        )
        
        return CancellationResponse(
            success=False,
            command_id=request.command_id,
            state="confirmation_required",
            message="This command requires confirmation to cancel",
            requires_confirmation=True,
            confirmation_request=confirmation
        )
    
    # Create cancellation request
    cancellation_request = CancellationRequest(
        command_id=request.command_id,
        reason=CancellationReason(request.reason),
        requester_id=current_user["user_id"],
        force=request.force,
        rollback_requested=request.rollback,
        metadata={
            "ip_address": current_user.get("ip_address"),
            "user_agent": current_user.get("user_agent"),
            "notes": request.notes,
            "confirmation_token": request.confirmation_token
        }
    )
    
    # Execute cancellation
    success, error_message = await cancellation_manager.request_cancellation(
        cancellation_request
    )
    
    return CancellationResponse(
        success=success,
        command_id=request.command_id,
        state=cancellation_request.state.value,
        message=error_message,
        validation_errors=cancellation_request.validation_errors,
        cleanup_actions=cancellation_request.cleanup_actions,
        rollback_actions=cancellation_request.rollback_actions
    )


@router.get("/active", response_model=List[CancellationStatusResponse])
@require_permission(Resource.COMMANDS, Action.READ)
async def get_active_cancellations(
    cancellation_manager: CancellationManager = Depends(get_cancellation_manager)
):
    """Get list of active cancellation requests."""
    active = cancellation_manager.get_active_cancellations()
    
    return [
        CancellationStatusResponse(
            command_id=req.command_id,
            state=req.state.value,
            reason=req.reason.value,
            requester_id=req.requester_id,
            timestamp=req.timestamp,
            completed_at=req.completed_at,
            validation_errors=req.validation_errors,
            cleanup_actions=req.cleanup_actions,
            rollback_actions=req.rollback_actions,
            error_message=req.error_message
        )
        for req in active
    ]


@router.get("/history", response_model=List[CancellationHistoryResponse])
@require_permission(Resource.COMMANDS, Action.READ)
async def get_cancellation_history(
    command_id: Optional[str] = Query(None, description="Filter by command ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum results to return"),
    cancellation_manager: CancellationManager = Depends(get_cancellation_manager),
    command_queue: PriorityCommandQueue = Depends(get_command_queue)
):
    """Get cancellation history with optional filtering."""
    history = cancellation_manager.get_cancellation_history(
        command_id=command_id,
        limit=limit
    )
    
    responses = []
    for req in history:
        # Get command info if available
        command = await command_queue.get_command(req.command_id)
        command_type = command.command_type.value if command else "unknown"
        
        responses.append(CancellationHistoryResponse(
            command_id=req.command_id,
            command_type=command_type,
            cancellation_state=req.state.value,
            cancellation_reason=req.reason.value,
            requester_id=req.requester_id,
            timestamp=req.timestamp,
            completed_at=req.completed_at,
            success=req.state == CancellationState.COMPLETED,
            duration_ms=(
                (req.completed_at - req.timestamp).total_seconds() * 1000
                if req.completed_at else None
            )
        ))
    
    return responses


@router.get("/stats", response_model=CancellationStatsResponse)
@require_permission(Resource.COMMANDS, Action.READ)
async def get_cancellation_stats(
    cancellation_manager: CancellationManager = Depends(get_cancellation_manager)
):
    """Get cancellation statistics."""
    stats = cancellation_manager.get_statistics()
    active_count = len(cancellation_manager.get_active_cancellations())
    
    return CancellationStatsResponse(
        **stats,
        active_cancellations=active_count
    )


@router.get("/{command_id}/status", response_model=Optional[CancellationStatusResponse])
@require_permission(Resource.COMMANDS, Action.READ)
async def get_cancellation_status(
    command_id: str,
    cancellation_manager: CancellationManager = Depends(get_cancellation_manager)
):
    """Get cancellation status for a specific command."""
    # Check active cancellations
    active = cancellation_manager.get_active_cancellations()
    for req in active:
        if req.command_id == command_id:
            return CancellationStatusResponse(
                command_id=req.command_id,
                state=req.state.value,
                reason=req.reason.value,
                requester_id=req.requester_id,
                timestamp=req.timestamp,
                completed_at=req.completed_at,
                validation_errors=req.validation_errors,
                cleanup_actions=req.cleanup_actions,
                rollback_actions=req.rollback_actions,
                error_message=req.error_message
            )
    
    # Check history
    history = cancellation_manager.get_cancellation_history(command_id=command_id, limit=1)
    if history:
        req = history[0]
        return CancellationStatusResponse(
            command_id=req.command_id,
            state=req.state.value,
            reason=req.reason.value,
            requester_id=req.requester_id,
            timestamp=req.timestamp,
            completed_at=req.completed_at,
            validation_errors=req.validation_errors,
            cleanup_actions=req.cleanup_actions,
            rollback_actions=req.rollback_actions,
            error_message=req.error_message
        )
    
    return None


@router.post("/batch", response_model=List[CancellationResponse])
@require_permission(Resource.COMMANDS, Action.UPDATE)
async def cancel_multiple_commands(
    command_ids: List[str],
    reason: str = "user_request",
    rollback: bool = True,
    current_user: dict = Depends(get_current_user),
    cancellation_manager: CancellationManager = Depends(get_cancellation_manager)
):
    """
    Cancel multiple commands at once.
    
    Returns status for each cancellation attempt.
    """
    results = []
    
    for command_id in command_ids:
        try:
            cancellation_request = CancellationRequest(
                command_id=command_id,
                reason=CancellationReason(reason),
                requester_id=current_user["user_id"],
                rollback_requested=rollback,
                metadata={
                    "batch_cancellation": True,
                    "ip_address": current_user.get("ip_address"),
                    "user_agent": current_user.get("user_agent")
                }
            )
            
            success, error_message = await cancellation_manager.request_cancellation(
                cancellation_request
            )
            
            results.append(CancellationResponse(
                success=success,
                command_id=command_id,
                state=cancellation_request.state.value,
                message=error_message,
                validation_errors=cancellation_request.validation_errors,
                cleanup_actions=cancellation_request.cleanup_actions,
                rollback_actions=cancellation_request.rollback_actions
            ))
            
        except Exception as e:
            results.append(CancellationResponse(
                success=False,
                command_id=command_id,
                state="error",
                message=str(e)
            ))
    
    return results