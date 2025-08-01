"""
Audit logging service for RBAC actions
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import json

from .models import AuditLog, AuditAction
from ..auth.models import User

class AuditLogger:
    """Service for comprehensive audit logging"""
    
    def __init__(self, db: Session):
        self.db = db
        self._request_context = {}
    
    def set_request_context(
        self,
        request_id: str,
        session_id: str,
        ip_address: str,
        user_agent: str
    ):
        """Set request context for current thread/async context"""
        self._request_context = {
            "request_id": request_id,
            "session_id": session_id,
            "ip_address": ip_address,
            "user_agent": user_agent
        }
    
    def clear_request_context(self):
        """Clear request context"""
        self._request_context = {}
    
    def log_action(
        self,
        user_id: str,
        action: AuditAction,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        required_permission: Optional[str] = None,
        had_permission: Optional[bool] = None,
        elevation_used: bool = False,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> AuditLog:
        """Log an auditable action"""
        # Get user and their current roles
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        
        user_roles = [{"id": role.id, "name": role.name} for role in user.roles]
        
        # Create audit log entry
        audit_log = AuditLog(
            id=str(uuid.uuid4()),
            user_id=user_id,
            user_roles=user_roles,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            required_permission=required_permission,
            had_permission=had_permission,
            elevation_used=elevation_used,
            details=details,
            success=success,
            error_message=error_message,
            **self._request_context  # Add request context
        )
        
        self.db.add(audit_log)
        self.db.commit()
        
        return audit_log
    
    def get_user_audit_trail(
        self,
        user_id: str,
        limit: int = 100,
        offset: int = 0,
        action_filter: Optional[List[AuditAction]] = None,
        resource_type_filter: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> List[AuditLog]:
        """Get audit trail for a specific user"""
        query = self.db.query(AuditLog).filter(AuditLog.user_id == user_id)
        
        if action_filter:
            query = query.filter(AuditLog.action.in_(action_filter))
        
        if resource_type_filter:
            query = query.filter(AuditLog.resource_type == resource_type_filter)
        
        if date_from:
            query = query.filter(AuditLog.timestamp >= date_from)
        
        if date_to:
            query = query.filter(AuditLog.timestamp <= date_to)
        
        return query.order_by(desc(AuditLog.timestamp)).limit(limit).offset(offset).all()
    
    def get_resource_audit_trail(
        self,
        resource_type: str,
        resource_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """Get audit trail for a specific resource"""
        return self.db.query(AuditLog).filter(
            and_(
                AuditLog.resource_type == resource_type,
                AuditLog.resource_id == resource_id
            )
        ).order_by(desc(AuditLog.timestamp)).limit(limit).offset(offset).all()
    
    def get_permission_denials(
        self,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        date_from: Optional[datetime] = None
    ) -> List[AuditLog]:
        """Get recent permission denial events"""
        query = self.db.query(AuditLog).filter(
            AuditLog.action == AuditAction.PERMISSION_DENIED
        )
        
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        
        if date_from:
            query = query.filter(AuditLog.timestamp >= date_from)
        
        return query.order_by(desc(AuditLog.timestamp)).limit(limit).offset(offset).all()
    
    def get_critical_actions(
        self,
        limit: int = 100,
        offset: int = 0,
        date_from: Optional[datetime] = None
    ) -> List[AuditLog]:
        """Get critical actions that required special permissions or approval"""
        critical_actions = [
            AuditAction.ROLE_ASSIGNED,
            AuditAction.ROLE_REMOVED,
            AuditAction.PERMISSION_GRANTED,
            AuditAction.PERMISSION_REVOKED,
            AuditAction.ELEVATION_APPROVED,
            AuditAction.CRITICAL_ACTION
        ]
        
        query = self.db.query(AuditLog).filter(
            AuditLog.action.in_(critical_actions)
        )
        
        if date_from:
            query = query.filter(AuditLog.timestamp >= date_from)
        
        return query.order_by(desc(AuditLog.timestamp)).limit(limit).offset(offset).all()
    
    def export_audit_logs(
        self,
        format: str = "json",
        filters: Optional[Dict[str, Any]] = None
    ) -> str:
        """Export audit logs in specified format"""
        query = self.db.query(AuditLog)
        
        if filters:
            if "user_id" in filters:
                query = query.filter(AuditLog.user_id == filters["user_id"])
            
            if "action" in filters:
                query = query.filter(AuditLog.action == filters["action"])
            
            if "resource_type" in filters:
                query = query.filter(AuditLog.resource_type == filters["resource_type"])
            
            if "date_from" in filters:
                query = query.filter(AuditLog.timestamp >= filters["date_from"])
            
            if "date_to" in filters:
                query = query.filter(AuditLog.timestamp <= filters["date_to"])
        
        logs = query.order_by(desc(AuditLog.timestamp)).all()
        
        if format == "json":
            return self._export_as_json(logs)
        elif format == "csv":
            return self._export_as_csv(logs)
        else:
            raise ValueError(f"Unsupported export format: {format}")
    
    def _export_as_json(self, logs: List[AuditLog]) -> str:
        """Export logs as JSON"""
        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "user_id": log.user_id,
                "user_roles": log.user_roles,
                "action": log.action.value,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "required_permission": log.required_permission,
                "had_permission": log.had_permission,
                "elevation_used": log.elevation_used,
                "success": log.success,
                "error_message": log.error_message,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "request_id": log.request_id,
                "session_id": log.session_id,
                "details": log.details
            })
        
        return json.dumps(data, indent=2)
    
    def _export_as_csv(self, logs: List[AuditLog]) -> str:
        """Export logs as CSV"""
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "ID", "Timestamp", "User ID", "User Roles", "Action",
            "Resource Type", "Resource ID", "Required Permission",
            "Had Permission", "Elevation Used", "Success", "Error Message",
            "IP Address", "User Agent", "Request ID", "Session ID"
        ])
        
        # Data
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.isoformat(),
                log.user_id,
                json.dumps(log.user_roles),
                log.action.value,
                log.resource_type or "",
                log.resource_id or "",
                log.required_permission or "",
                log.had_permission,
                log.elevation_used,
                log.success,
                log.error_message or "",
                log.ip_address or "",
                log.user_agent or "",
                log.request_id or "",
                log.session_id or ""
            ])
        
        return output.getvalue()
    
    def analyze_suspicious_activity(
        self,
        user_id: str,
        window_hours: int = 24
    ) -> Dict[str, Any]:
        """Analyze user activity for suspicious patterns"""
        since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        
        # Get all user actions in window
        logs = self.db.query(AuditLog).filter(
            and_(
                AuditLog.user_id == user_id,
                AuditLog.timestamp >= since
            )
        ).all()
        
        # Analyze patterns
        analysis = {
            "total_actions": len(logs),
            "permission_denials": sum(1 for log in logs if log.action == AuditAction.PERMISSION_DENIED),
            "failed_actions": sum(1 for log in logs if not log.success),
            "elevation_requests": sum(1 for log in logs if log.action == AuditAction.ELEVATION_REQUESTED),
            "critical_actions": sum(1 for log in logs if log.action in [
                AuditAction.ROLE_ASSIGNED, AuditAction.PERMISSION_GRANTED,
                AuditAction.CRITICAL_ACTION
            ]),
            "unique_ips": len(set(log.ip_address for log in logs if log.ip_address)),
            "unique_sessions": len(set(log.session_id for log in logs if log.session_id)),
            "suspicious_indicators": []
        }
        
        # Check for suspicious patterns
        if analysis["permission_denials"] > 10:
            analysis["suspicious_indicators"].append("High number of permission denials")
        
        if analysis["failed_actions"] / max(analysis["total_actions"], 1) > 0.3:
            analysis["suspicious_indicators"].append("High failure rate")
        
        if analysis["unique_ips"] > 5:
            analysis["suspicious_indicators"].append("Multiple IP addresses")
        
        if analysis["elevation_requests"] > 3:
            analysis["suspicious_indicators"].append("Multiple elevation requests")
        
        return analysis