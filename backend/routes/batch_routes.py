"""
Batch Command API Routes

Provides REST API endpoints for batch command operations including:
- Batch creation and execution
- Progress monitoring
- Batch templates
- Statistics and history
"""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import logging

from ..auth.dependencies import get_current_user
from ..rbac.decorators import require_permission
from ..rbac.permissions import Resource, Action
from ..command_queue.batch_executor import BatchExecutor, BatchCommand, BatchStatus
from ..command_queue.batch_schemas import (
    BatchCreateRequestSchema,
    BatchProgressSchema,
    BatchResultSchema,
    BatchTemplateSchema,
    BatchOperationRequestSchema,
    BatchQuerySchema,
    BatchStatisticsSchema,
    BatchValidator
)
from ..command_queue.command_factory import CommandFactory
from ..dependencies import get_batch_executor, get_command_factory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/batch", tags=["batch"])

# Initialize validator
batch_validator = BatchValidator()


@router.post("/create", response_model=Dict[str, Any])
@require_permission(Resource.COMMAND, Action.CREATE)
async def create_batch(
    request: BatchCreateRequestSchema,
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor),
    command_factory: CommandFactory = Depends(get_command_factory)
):
    """Create a new batch of commands"""
    try:
        # Validate request
        validated_request = batch_validator.validate_batch_create(request)
        
        # Add user context to metadata
        validated_request.metadata.user_id = current_user["user_id"]
        
        # Convert command schemas to Command objects
        commands = []
        for cmd_schema in validated_request.commands:
            command = command_factory.create_command(
                command_type=cmd_schema.command_type,
                parameters=cmd_schema.parameters,
                priority=cmd_schema.priority,
                metadata=cmd_schema.metadata.dict()
            )
            commands.append(command)
        
        # Create batch
        batch = await batch_executor.create_batch(
            commands=commands,
            name=validated_request.name,
            description=validated_request.description,
            execution_mode=validated_request.execution_mode,
            transaction_mode=validated_request.transaction_mode,
            dependencies=[dep.dict() for dep in validated_request.dependencies],
            priority=validated_request.priority,
            metadata=validated_request.metadata.dict()
        )
        
        # Execute if not dry run
        if not validated_request.dry_run:
            asyncio.create_task(batch_executor.execute_batch(batch.batch_id))
        
        return {
            "batch_id": batch.batch_id,
            "status": batch.status.value,
            "total_commands": batch.total_commands,
            "message": "Batch created successfully" + (" (dry run)" if validated_request.dry_run else "")
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Batch creation error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{batch_id}", response_model=BatchResultSchema)
@require_permission(Resource.COMMAND, Action.READ)
async def get_batch_status(
    batch_id: str,
    include_results: bool = True,
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor)
):
    """Get batch status and results"""
    batch = await batch_executor.get_batch_status(batch_id)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Check user access
    if batch.metadata.get("user_id") != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Convert to result schema
    result = BatchResultSchema(
        batch_id=batch.batch_id,
        name=batch.name,
        status=batch.status,
        execution_mode=batch.execution_mode,
        transaction_mode=batch.transaction_mode,
        created_at=batch.created_at,
        started_at=batch.started_at,
        completed_at=batch.completed_at,
        execution_time_ms=(
            (batch.completed_at - batch.started_at).total_seconds() * 1000
            if batch.completed_at and batch.started_at else None
        ),
        total_commands=batch.total_commands,
        completed_commands=batch.completed_commands,
        failed_commands=batch.failed_commands,
        command_results=batch.command_results if include_results else {},
        error_summary=batch.error_summary,
        rollback_executed=batch.rollback_status is not None,
        rollback_status=batch.rollback_status
    )
    
    return result


@router.get("/", response_model=List[BatchResultSchema])
@require_permission(Resource.COMMAND, Action.READ)
async def list_batches(
    query: BatchQuerySchema = Depends(),
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor)
):
    """List batches with filtering and pagination"""
    # Get all batches
    all_batches = await batch_executor.list_batches()
    
    # Filter by user if not admin
    if not current_user.get("is_admin"):
        all_batches = [
            b for b in all_batches 
            if b.metadata.get("user_id") == current_user["user_id"]
        ]
    
    # Apply filters
    filtered_batches = all_batches
    
    if query.status:
        filtered_batches = [b for b in filtered_batches if b.status in query.status]
    
    if query.created_after:
        filtered_batches = [b for b in filtered_batches if b.created_at >= query.created_after]
    
    if query.created_before:
        filtered_batches = [b for b in filtered_batches if b.created_at <= query.created_before]
    
    if query.user_id and current_user.get("is_admin"):
        filtered_batches = [b for b in filtered_batches if b.metadata.get("user_id") == query.user_id]
    
    if query.tags:
        filtered_batches = [
            b for b in filtered_batches 
            if any(tag in b.metadata.get("tags", []) for tag in query.tags)
        ]
    
    if query.name_contains:
        filtered_batches = [
            b for b in filtered_batches 
            if query.name_contains.lower() in b.name.lower()
        ]
    
    # Sort
    sort_key = {
        "created_at": lambda b: b.created_at,
        "completed_at": lambda b: b.completed_at or datetime.min,
        "name": lambda b: b.name,
        "status": lambda b: b.status.value
    }[query.sort_by]
    
    filtered_batches.sort(key=sort_key, reverse=(query.sort_order == "desc"))
    
    # Paginate
    start = query.offset
    end = start + query.limit
    paginated_batches = filtered_batches[start:end]
    
    # Convert to response schema
    results = []
    for batch in paginated_batches:
        result = BatchResultSchema(
            batch_id=batch.batch_id,
            name=batch.name,
            status=batch.status,
            execution_mode=batch.execution_mode,
            transaction_mode=batch.transaction_mode,
            created_at=batch.created_at,
            started_at=batch.started_at,
            completed_at=batch.completed_at,
            execution_time_ms=(
                (batch.completed_at - batch.started_at).total_seconds() * 1000
                if batch.completed_at and batch.started_at else None
            ),
            total_commands=batch.total_commands,
            completed_commands=batch.completed_commands,
            failed_commands=batch.failed_commands,
            command_results=batch.command_results if query.include_command_results else {},
            error_summary=batch.error_summary if query.include_error_details else [],
            rollback_executed=batch.rollback_status is not None,
            rollback_status=batch.rollback_status
        )
        results.append(result)
    
    return results


@router.post("/{batch_id}/operation")
@require_permission(Resource.COMMAND, Action.UPDATE)
async def perform_batch_operation(
    batch_id: str,
    request: BatchOperationRequestSchema,
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor)
):
    """Perform operation on a batch (cancel, retry, rollback, etc.)"""
    batch = await batch_executor.get_batch_status(batch_id)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Check user access
    if batch.metadata.get("user_id") != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        if request.operation == "cancel":
            success = await batch_executor.cancel_batch(batch_id)
            if not success:
                raise HTTPException(status_code=400, detail="Cannot cancel batch in current state")
            
        elif request.operation == "retry":
            # Create a new batch with same configuration
            if request.retry_failed_only:
                # Filter to only failed commands
                commands = [
                    cmd for cmd in batch.commands
                    if batch.command_results.get(cmd.id, {}).get("success") is False
                ]
            else:
                commands = batch.commands
            
            new_batch = await batch_executor.create_batch(
                commands=commands,
                name=f"{batch.name} (Retry)",
                description=f"Retry of batch {batch_id}",
                execution_mode=batch.execution_mode,
                transaction_mode=batch.transaction_mode,
                dependencies=batch.dependencies,
                priority=batch.priority,
                metadata=batch.metadata
            )
            
            asyncio.create_task(batch_executor.execute_batch(new_batch.batch_id))
            
            return {
                "message": "Batch retry initiated",
                "new_batch_id": new_batch.batch_id
            }
            
        elif request.operation == "rollback":
            if batch.status != BatchStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Can only rollback completed batches")
            
            # Trigger rollback
            await batch_executor._rollback_batch(batch)
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown operation: {request.operation}")
        
        return {"message": f"Operation {request.operation} completed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch operation error: {e}")
        raise HTTPException(status_code=500, detail="Operation failed")


@router.get("/statistics/summary", response_model=BatchStatisticsSchema)
@require_permission(Resource.COMMAND, Action.READ)
async def get_batch_statistics(
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor)
):
    """Get batch execution statistics"""
    stats = batch_executor.get_stats()
    
    # Calculate additional metrics
    total_batches = stats["total_batches"]
    completed = stats["completed_batches"]
    failed = stats["failed_batches"]
    
    success_rate = (completed / total_batches * 100) if total_batches > 0 else 0
    
    # Get time-based metrics
    all_batches = await batch_executor.list_batches()
    now = datetime.utcnow()
    
    batches_last_hour = len([
        b for b in all_batches
        if (now - b.created_at).total_seconds() < 3600
    ])
    
    batches_last_day = len([
        b for b in all_batches
        if (now - b.created_at).total_seconds() < 86400
    ])
    
    # Calculate command-level metrics
    total_commands = sum(b.total_commands for b in all_batches)
    successful_commands = sum(b.completed_commands for b in all_batches)
    commands_success_rate = (successful_commands / total_commands * 100) if total_commands > 0 else 0
    
    return BatchStatisticsSchema(
        total_batches=total_batches,
        completed_batches=completed,
        failed_batches=failed,
        active_batches=stats.get("active_batches", 0),
        pending_batches=stats.get("pending_batches", 0),
        average_batch_size=stats["average_batch_size"],
        average_execution_time_ms=stats["average_execution_time_ms"],
        success_rate=success_rate,
        batches_last_hour=batches_last_hour,
        batches_last_day=batches_last_day,
        peak_concurrent_batches=0,  # TODO: Track this metric
        total_commands_executed=total_commands,
        commands_success_rate=commands_success_rate
    )


@router.post("/templates", response_model=Dict[str, Any])
@require_permission(Resource.COMMAND, Action.CREATE)
async def create_batch_template(
    template: BatchTemplateSchema,
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor)
):
    """Create a reusable batch template"""
    try:
        # Create a dummy batch for the template
        template_batch = BatchCommand(
            name=template.name,
            description=template.description,
            commands=[],  # Empty for template
            dependencies=[dep.dict() for dep in template.dependencies],
            execution_mode=template.execution_mode,
            transaction_mode=template.transaction_mode,
            priority=template.default_priority,
            metadata={
                "author": template.author or current_user["user_id"],
                "tags": template.tags,
                "category": template.category,
                "parameters": template.parameters,
                "required_parameters": template.required_parameters
            }
        )
        
        success = await batch_executor.create_batch_template(
            template.template_id,
            template_batch
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="Failed to create template")
        
        return {
            "template_id": template.template_id,
            "message": "Template created successfully"
        }
        
    except Exception as e:
        logger.error(f"Template creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create template")


@router.post("/templates/{template_id}/instantiate", response_model=Dict[str, Any])
@require_permission(Resource.COMMAND, Action.CREATE)
async def create_batch_from_template(
    template_id: str,
    parameters: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    batch_executor: BatchExecutor = Depends(get_batch_executor),
    command_factory: CommandFactory = Depends(get_command_factory)
):
    """Create a batch from a template"""
    try:
        # Get template (this is simplified - in production, templates would be stored)
        # For now, we'll create commands based on parameters
        
        # Example: Create commands from parameters
        commands = []
        # This would be replaced with actual template instantiation logic
        
        batch = await batch_executor.create_batch_from_template(
            template_id,
            commands,
            name=parameters.get("name", f"Batch from {template_id}")
        )
        
        # Execute the batch
        asyncio.create_task(batch_executor.execute_batch(batch.batch_id))
        
        return {
            "batch_id": batch.batch_id,
            "message": "Batch created from template successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Template instantiation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create batch from template")


@router.websocket("/ws/{batch_id}")
async def batch_progress_websocket(
    websocket: WebSocket,
    batch_id: str,
    batch_executor: BatchExecutor = Depends(get_batch_executor)
):
    """WebSocket endpoint for real-time batch progress updates"""
    await websocket.accept()
    
    try:
        batch = await batch_executor.get_batch_status(batch_id)
        if not batch:
            await websocket.send_json({"error": "Batch not found"})
            await websocket.close()
            return
        
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "data": batch.to_dict()
        })
        
        # Monitor batch progress
        while batch.status in [BatchStatus.PENDING, BatchStatus.EXECUTING]:
            await asyncio.sleep(1)  # Update interval
            
            batch = await batch_executor.get_batch_status(batch_id)
            if not batch:
                break
            
            # Send progress update
            progress_data = BatchProgressSchema(
                batch_id=batch.batch_id,
                status=batch.status,
                total_commands=batch.total_commands,
                completed_commands=batch.completed_commands,
                failed_commands=batch.failed_commands,
                progress_percentage=(
                    (batch.completed_commands + batch.failed_commands) / batch.total_commands * 100
                    if batch.total_commands > 0 else 0
                ),
                elapsed_time_ms=(
                    (datetime.utcnow() - batch.started_at).total_seconds() * 1000
                    if batch.started_at else None
                )
            )
            
            await websocket.send_json({
                "type": "progress",
                "data": progress_data.dict()
            })
        
        # Send final status
        await websocket.send_json({
            "type": "completed",
            "data": batch.to_dict()
        })
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for batch {batch_id}")
    except Exception as e:
        logger.error(f"WebSocket error for batch {batch_id}: {e}")
        await websocket.send_json({"error": str(e)})
    finally:
        await websocket.close()