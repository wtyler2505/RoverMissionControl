"""
Command History API with advanced querying, filtering, and export capabilities
Provides enterprise-grade audit trail access with performance optimization
"""

from fastapi import APIRouter, Query, HTTPException, Depends, Response, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text, desc, asc, Integer
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Union
import json
import csv
import io
import pandas as pd
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows
import asyncio
from enum import Enum

from ..database import get_db
from ..auth.dependencies import get_current_user, require_permission
from ..rbac.permissions import Permission
from .audit_models import (
    CommandAuditLog, CommandHistory, CommandMetrics, 
    UserCommandAccess, DataRetentionPolicy
)
from .history_schemas import (
    CommandHistoryResponse, CommandHistoryFilter, CommandHistoryExport,
    AuditLogResponse, MetricsResponse, HistoryStatistics,
    ExportFormat, SortOrder, TimeInterval
)


router = APIRouter(prefix="/api/command-history", tags=["command-history"])


class HistoryService:
    """Service class for command history operations"""
    
    @staticmethod
    async def log_access(
        db: Session,
        user_id: str,
        access_type: str,
        command_ids: List[str] = None,
        query_filters: Dict = None,
        export_format: str = None,
        records_count: int = 0
    ):
        """Log user access for compliance"""
        access_log = UserCommandAccess(
            user_id=user_id,
            access_type=access_type,
            command_ids=command_ids or [],
            query_filters=query_filters or {},
            export_format=export_format,
            records_accessed=records_count,
            purpose="User requested command history"
        )
        db.add(access_log)
        db.commit()
    
    @staticmethod
    def build_history_query(db: Session, filters: CommandHistoryFilter):
        """Build complex query based on filters"""
        query = db.query(CommandHistory)
        
        # Time range filters
        if filters.start_time:
            query = query.filter(CommandHistory.created_at >= filters.start_time)
        if filters.end_time:
            query = query.filter(CommandHistory.created_at <= filters.end_time)
        
        # Command filters
        if filters.command_types:
            query = query.filter(CommandHistory.command_type.in_(filters.command_types))
        if filters.priorities:
            query = query.filter(CommandHistory.priority.in_(filters.priorities))
        if filters.statuses:
            query = query.filter(CommandHistory.final_status.in_(filters.statuses))
        
        # User filters
        if filters.user_ids:
            query = query.filter(CommandHistory.user_id.in_(filters.user_ids))
        if filters.session_ids:
            query = query.filter(CommandHistory.session_id.in_(filters.session_ids))
        
        # Performance filters
        if filters.min_execution_time_ms:
            query = query.filter(CommandHistory.total_execution_time_ms >= filters.min_execution_time_ms)
        if filters.max_execution_time_ms:
            query = query.filter(CommandHistory.total_execution_time_ms <= filters.max_execution_time_ms)
        
        # Error filters
        if filters.only_errors:
            query = query.filter(CommandHistory.success == False)
        if filters.error_codes:
            query = query.filter(CommandHistory.error_code.in_(filters.error_codes))
        
        # Search text
        if filters.search_text:
            query = query.filter(
                CommandHistory.search_text.ilike(f"%{filters.search_text}%")
            )
        
        # Tags filter (JSON search)
        if filters.tags:
            for tag in filters.tags:
                query = query.filter(
                    func.json_contains(CommandHistory.tags, json.dumps(tag))
                )
        
        return query


@router.get("/", response_model=CommandHistoryResponse)
async def get_command_history(
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    
    # Time filters
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    
    # Command filters
    command_types: Optional[List[str]] = Query(None),
    priorities: Optional[List[int]] = Query(None),
    statuses: Optional[List[str]] = Query(None),
    
    # User filters
    user_ids: Optional[List[str]] = Query(None),
    session_ids: Optional[List[str]] = Query(None),
    
    # Performance filters
    min_execution_time_ms: Optional[float] = None,
    max_execution_time_ms: Optional[float] = None,
    
    # Error filters
    only_errors: bool = False,
    error_codes: Optional[List[str]] = Query(None),
    
    # Search
    search_text: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    
    # Sorting
    sort_by: str = "created_at",
    sort_order: SortOrder = SortOrder.DESC,
    
    # Dependencies
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission(Permission.VIEW_COMMAND_HISTORY))
):
    """
    Get command history with advanced filtering and pagination
    
    Requires: VIEW_COMMAND_HISTORY permission
    """
    
    # Build filters
    filters = CommandHistoryFilter(
        start_time=start_time,
        end_time=end_time,
        command_types=command_types,
        priorities=priorities,
        statuses=statuses,
        user_ids=user_ids,
        session_ids=session_ids,
        min_execution_time_ms=min_execution_time_ms,
        max_execution_time_ms=max_execution_time_ms,
        only_errors=only_errors,
        error_codes=error_codes,
        search_text=search_text,
        tags=tags
    )
    
    # Build query
    query = HistoryService.build_history_query(db, filters)
    
    # Apply sorting
    sort_column = getattr(CommandHistory, sort_by, CommandHistory.created_at)
    if sort_order == SortOrder.DESC:
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    # Get total count
    total_count = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    # Log access
    command_ids = [item.command_id for item in items]
    await HistoryService.log_access(
        db, current_user["id"], "view", 
        command_ids=command_ids,
        query_filters=filters.dict(),
        records_count=len(items)
    )
    
    return CommandHistoryResponse(
        items=items,
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=(total_count + page_size - 1) // page_size
    )


@router.get("/{command_id}", response_model=Dict[str, Any])
async def get_command_details(
    command_id: str,
    include_audit_trail: bool = True,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission(Permission.VIEW_COMMAND_HISTORY))
):
    """Get detailed history for a specific command including full audit trail"""
    
    # Get command history
    history = db.query(CommandHistory).filter(
        CommandHistory.command_id == command_id
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="Command not found")
    
    result = {
        "command": history,
        "audit_trail": []
    }
    
    # Get audit trail if requested
    if include_audit_trail:
        audit_logs = db.query(CommandAuditLog).filter(
            CommandAuditLog.command_id == command_id
        ).order_by(CommandAuditLog.event_timestamp).all()
        
        result["audit_trail"] = audit_logs
    
    # Log access
    await HistoryService.log_access(
        db, current_user["id"], "view_details",
        command_ids=[command_id],
        records_count=1
    )
    
    return result


@router.get("/statistics/summary", response_model=HistoryStatistics)
async def get_history_statistics(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    command_types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission(Permission.VIEW_COMMAND_HISTORY))
):
    """Get aggregated statistics for command history"""
    
    # Base query
    query = db.query(
        func.count(CommandHistory.id).label("total_commands"),
        func.sum(func.cast(CommandHistory.success, Integer)).label("successful_commands"),
        func.avg(CommandHistory.total_execution_time_ms).label("avg_execution_time"),
        func.max(CommandHistory.total_execution_time_ms).label("max_execution_time"),
        func.min(CommandHistory.total_execution_time_ms).label("min_execution_time"),
        func.avg(CommandHistory.queue_wait_time_ms).label("avg_queue_time"),
        func.sum(CommandHistory.retry_count).label("total_retries")
    )
    
    # Apply filters
    if start_time:
        query = query.filter(CommandHistory.created_at >= start_time)
    if end_time:
        query = query.filter(CommandHistory.created_at <= end_time)
    if command_types:
        query = query.filter(CommandHistory.command_type.in_(command_types))
    
    stats = query.first()
    
    # Get command type distribution
    type_dist = db.query(
        CommandHistory.command_type,
        func.count(CommandHistory.id)
    ).group_by(CommandHistory.command_type)
    
    if start_time:
        type_dist = type_dist.filter(CommandHistory.created_at >= start_time)
    if end_time:
        type_dist = type_dist.filter(CommandHistory.created_at <= end_time)
    
    type_distribution = {row[0]: row[1] for row in type_dist.all()}
    
    # Get status distribution
    status_dist = db.query(
        CommandHistory.final_status,
        func.count(CommandHistory.id)
    ).group_by(CommandHistory.final_status)
    
    if start_time:
        status_dist = status_dist.filter(CommandHistory.created_at >= start_time)
    if end_time:
        status_dist = status_dist.filter(CommandHistory.created_at <= end_time)
    
    status_distribution = {row[0]: row[1] for row in status_dist.all()}
    
    return HistoryStatistics(
        total_commands=stats.total_commands or 0,
        successful_commands=stats.successful_commands or 0,
        failed_commands=(stats.total_commands or 0) - (stats.successful_commands or 0),
        avg_execution_time_ms=stats.avg_execution_time or 0,
        max_execution_time_ms=stats.max_execution_time or 0,
        min_execution_time_ms=stats.min_execution_time or 0,
        avg_queue_time_ms=stats.avg_queue_time or 0,
        total_retries=stats.total_retries or 0,
        command_type_distribution=type_distribution,
        status_distribution=status_distribution,
        time_range_start=start_time,
        time_range_end=end_time
    )


@router.post("/export", response_model=Dict[str, str])
async def export_command_history(
    export_request: CommandHistoryExport,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission(Permission.EXPORT_COMMAND_HISTORY))
):
    """
    Export command history in various formats
    
    Requires: EXPORT_COMMAND_HISTORY permission
    """
    
    # Build query
    query = HistoryService.build_history_query(db, export_request.filters)
    
    # Limit export size
    max_export_size = 100000  # Configure based on requirements
    if not export_request.filters.limit:
        export_request.filters.limit = max_export_size
    
    # Get data
    items = query.limit(export_request.filters.limit).all()
    
    # Log export access
    await HistoryService.log_access(
        db, current_user["id"], "export",
        query_filters=export_request.filters.dict(),
        export_format=export_request.format.value,
        records_count=len(items)
    )
    
    # Generate export based on format
    if export_request.format == ExportFormat.CSV:
        return await export_to_csv(items, export_request.columns)
    elif export_request.format == ExportFormat.JSON:
        return await export_to_json(items, export_request.columns)
    elif export_request.format == ExportFormat.EXCEL:
        return await export_to_excel(items, export_request.columns)
    else:
        raise HTTPException(status_code=400, detail="Unsupported export format")


async def export_to_csv(items: List[CommandHistory], columns: List[str]) -> Dict[str, str]:
    """Export command history to CSV format"""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    
    for item in items:
        row = {}
        for col in columns:
            value = getattr(item, col, None)
            if isinstance(value, datetime):
                value = value.isoformat()
            elif isinstance(value, (dict, list)):
                value = json.dumps(value)
            row[col] = value
        writer.writerow(row)
    
    return {
        "content": output.getvalue(),
        "content_type": "text/csv",
        "filename": f"command_history_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    }


async def export_to_json(items: List[CommandHistory], columns: List[str]) -> Dict[str, str]:
    """Export command history to JSON format"""
    data = []
    for item in items:
        row = {}
        for col in columns:
            value = getattr(item, col, None)
            if isinstance(value, datetime):
                value = value.isoformat()
            row[col] = value
        data.append(row)
    
    return {
        "content": json.dumps(data, indent=2),
        "content_type": "application/json",
        "filename": f"command_history_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    }


async def export_to_excel(items: List[CommandHistory], columns: List[str]) -> Dict[str, str]:
    """Export command history to Excel format"""
    # Convert to DataFrame
    data = []
    for item in items:
        row = {}
        for col in columns:
            value = getattr(item, col, None)
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            row[col] = value
        data.append(row)
    
    df = pd.DataFrame(data)
    
    # Create Excel file
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Command History', index=False)
        
        # Auto-adjust column widths
        worksheet = writer.sheets['Command History']
        for column in df:
            column_width = max(df[column].astype(str).map(len).max(), len(column))
            col_idx = df.columns.get_loc(column)
            worksheet.column_dimensions[chr(65 + col_idx)].width = min(column_width + 2, 50)
    
    output.seek(0)
    
    return {
        "content": output.getvalue(),
        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "filename": f"command_history_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    }


@router.get("/metrics/time-series", response_model=List[MetricsResponse])
async def get_metrics_time_series(
    interval: TimeInterval = TimeInterval.HOUR,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    command_types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission(Permission.VIEW_COMMAND_HISTORY))
):
    """Get time-series metrics for command execution"""
    
    # Default time range
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(days=7)
    
    # Query metrics
    query = db.query(CommandMetrics).filter(
        CommandMetrics.metric_interval == interval.value,
        CommandMetrics.metric_timestamp >= start_time,
        CommandMetrics.metric_timestamp <= end_time
    )
    
    if command_types:
        query = query.filter(CommandMetrics.command_type.in_(command_types))
    
    metrics = query.order_by(CommandMetrics.metric_timestamp).all()
    
    return metrics


@router.delete("/retention/apply", response_model=Dict[str, Any])
async def apply_retention_policies(
    dry_run: bool = True,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    _: None = Depends(require_permission(Permission.DELETE_COMMAND_HISTORY))
):
    """
    Apply data retention policies to remove old command history
    
    Requires: DELETE_COMMAND_HISTORY permission
    """
    
    # Get active retention policies
    policies = db.query(DataRetentionPolicy).filter(
        DataRetentionPolicy.active == True
    ).all()
    
    total_deleted = 0
    policy_results = []
    
    for policy in policies:
        cutoff_date = datetime.utcnow() - timedelta(days=policy.retention_days)
        
        # Build query for commands to delete
        query = db.query(CommandHistory).filter(
            CommandHistory.created_at < cutoff_date
        )
        
        # Apply policy filters
        if policy.command_type_pattern:
            query = query.filter(
                CommandHistory.command_type.op('REGEXP')(policy.command_type_pattern)
            )
        if policy.priority_levels:
            query = query.filter(
                CommandHistory.priority.in_(policy.priority_levels)
            )
        if policy.data_classification:
            query = query.filter(
                CommandHistory.data_classification == policy.data_classification
            )
        
        # Count matches
        match_count = query.count()
        
        if not dry_run and match_count > 0:
            # Apply anonymization if needed
            if policy.anonymize_user_data:
                query.update({
                    CommandHistory.user_id: "ANONYMIZED",
                    CommandHistory.session_id: "ANONYMIZED",
                    CommandHistory.parameter_summary: {},
                    CommandHistory.result_summary: {}
                })
            else:
                # Delete records
                query.delete()
            
            db.commit()
        
        policy_results.append({
            "policy_name": policy.policy_name,
            "matches": match_count,
            "action": "anonymized" if policy.anonymize_user_data else "deleted"
        })
        
        total_deleted += match_count
    
    return {
        "dry_run": dry_run,
        "total_affected": total_deleted,
        "policy_results": policy_results,
        "executed_at": datetime.utcnow().isoformat()
    }