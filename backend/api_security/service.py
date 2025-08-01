"""
API Key Service for managing API keys, rotation, and validation
"""
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import APIKey, APIKeyScope, APIKeyUsage, APIKeyRotation, APIKeyStatus
from ..auth.models import User
from ..rbac.audit import AuditLogger
from ..rbac.models import AuditAction

class APIKeyService:
    """Service for managing API keys"""
    
    def __init__(self, db: Session, audit_logger: Optional[AuditLogger] = None):
        self.db = db
        self.audit_logger = audit_logger or AuditLogger(db)
        self.key_prefix = "rmk_"  # Rover Mission Key
        self.key_length = 32
        
    def generate_api_key(self) -> Tuple[str, str]:
        """Generate a new API key and its hash"""
        # Generate random key
        raw_key = secrets.token_urlsafe(self.key_length)
        
        # Create full key with prefix
        environment = "live"  # Could be test/live based on config
        full_key = f"{self.key_prefix}{environment}_{raw_key}"
        
        # Hash the key
        key_hash = hashlib.sha256(full_key.encode()).hexdigest()
        
        return full_key, key_hash
    
    def create_api_key(
        self,
        user: User,
        name: str,
        description: Optional[str] = None,
        scopes: Optional[List[str]] = None,
        expires_in_days: Optional[int] = None,
        allowed_ips: Optional[List[str]] = None,
        allowed_origins: Optional[List[str]] = None,
        rate_limit_per_minute: Optional[int] = None,
        is_read_only: bool = False,
        service_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None
    ) -> Tuple[APIKey, str]:
        """Create a new API key"""
        # Generate key
        full_key, key_hash = self.generate_api_key()
        
        # Extract hint (last 4 characters)
        key_hint = full_key[-4:]
        
        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        
        # Create API key record
        api_key = APIKey(
            name=name,
            description=description,
            key_prefix=self.key_prefix,
            key_hash=key_hash,
            key_hint=key_hint,
            user_id=user.id,
            service_name=service_name,
            expires_at=expires_at,
            allowed_ips=allowed_ips,
            allowed_origins=allowed_origins,
            rate_limit_per_minute=rate_limit_per_minute,
            is_read_only=is_read_only,
            metadata_json=metadata,
            tags=tags
        )
        
        # Add scopes if provided
        if scopes:
            scope_objects = self.db.query(APIKeyScope).filter(
                APIKeyScope.name.in_(scopes)
            ).all()
            api_key.scopes = scope_objects
        
        self.db.add(api_key)
        self.db.commit()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=user.id,
            action=AuditAction.RESOURCE_CREATED,
            resource_type="api_key",
            resource_id=api_key.id,
            details={
                "name": name,
                "scopes": scopes,
                "expires_in_days": expires_in_days,
                "service_name": service_name
            }
        )
        
        return api_key, full_key
    
    def validate_api_key(
        self,
        api_key_string: str,
        required_scopes: Optional[List[str]] = None,
        ip_address: Optional[str] = None,
        origin: Optional[str] = None
    ) -> Tuple[bool, Optional[APIKey], Optional[str]]:
        """Validate an API key and check permissions"""
        # Hash the provided key
        key_hash = hashlib.sha256(api_key_string.encode()).hexdigest()
        
        # Find the API key
        api_key = self.db.query(APIKey).filter(
            APIKey.key_hash == key_hash
        ).first()
        
        if not api_key:
            return False, None, "Invalid API key"
        
        # Check if key is valid
        if not api_key.is_valid():
            if api_key.status == APIKeyStatus.REVOKED:
                return False, api_key, "API key has been revoked"
            elif api_key.status == APIKeyStatus.EXPIRED:
                return False, api_key, "API key has expired"
            else:
                return False, api_key, "API key is not active"
        
        # Check IP restrictions
        if ip_address and not api_key.check_ip_allowed(ip_address):
            return False, api_key, f"Access denied from IP: {ip_address}"
        
        # Check origin restrictions
        if origin and not api_key.check_origin_allowed(origin):
            return False, api_key, f"Access denied from origin: {origin}"
        
        # Check required scopes
        if required_scopes:
            key_scope_names = [scope.name for scope in api_key.scopes]
            missing_scopes = [s for s in required_scopes if s not in key_scope_names]
            if missing_scopes:
                return False, api_key, f"Missing required scopes: {', '.join(missing_scopes)}"
        
        # Update last used timestamp
        api_key.last_used_at = datetime.now(timezone.utc)
        api_key.usage_count += 1
        self.db.commit()
        
        return True, api_key, None
    
    def revoke_api_key(
        self,
        api_key_id: str,
        revoked_by: User,
        reason: str
    ) -> APIKey:
        """Revoke an API key"""
        api_key = self.db.query(APIKey).filter(
            APIKey.id == api_key_id
        ).first()
        
        if not api_key:
            raise ValueError("API key not found")
        
        if api_key.status == APIKeyStatus.REVOKED:
            raise ValueError("API key is already revoked")
        
        # Revoke the key
        api_key.status = APIKeyStatus.REVOKED
        api_key.revoked_at = datetime.now(timezone.utc)
        api_key.revoked_by = revoked_by.id
        api_key.revocation_reason = reason
        
        self.db.commit()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=revoked_by.id,
            action=AuditAction.RESOURCE_DELETED,
            resource_type="api_key",
            resource_id=api_key.id,
            details={
                "name": api_key.name,
                "reason": reason
            }
        )
        
        return api_key
    
    def rotate_api_key(
        self,
        api_key_id: str,
        initiated_by: User,
        grace_period_hours: int = 24
    ) -> Tuple[APIKey, str, APIKeyRotation]:
        """Rotate an API key with grace period"""
        old_key = self.db.query(APIKey).filter(
            APIKey.id == api_key_id
        ).first()
        
        if not old_key:
            raise ValueError("API key not found")
        
        if old_key.status == APIKeyStatus.REVOKED:
            raise ValueError("Cannot rotate a revoked key")
        
        # Create new key with same settings
        new_key, new_key_string = self.create_api_key(
            user=old_key.user,
            name=f"{old_key.name} (rotated)",
            description=old_key.description,
            scopes=[scope.name for scope in old_key.scopes],
            allowed_ips=old_key.allowed_ips,
            allowed_origins=old_key.allowed_origins,
            rate_limit_per_minute=old_key.rate_limit_per_minute,
            is_read_only=old_key.is_read_only,
            service_name=old_key.service_name,
            metadata=old_key.metadata_json,
            tags=old_key.tags
        )
        
        # Set old key to rotating status with grace period
        old_key.status = APIKeyStatus.ROTATING
        grace_period_end = datetime.now(timezone.utc) + timedelta(hours=grace_period_hours)
        
        # Create rotation record
        rotation = APIKeyRotation(
            api_key_id=old_key.id,
            initiated_by=initiated_by.id,
            old_key_hint=old_key.key_hint,
            old_key_expires_at=grace_period_end,
            new_key_id=new_key.id,
            status="in_progress"
        )
        
        self.db.add(rotation)
        self.db.commit()
        
        # Audit log
        self.audit_logger.log_action(
            user_id=initiated_by.id,
            action=AuditAction.RESOURCE_UPDATED,
            resource_type="api_key",
            resource_id=old_key.id,
            details={
                "action": "rotation_initiated",
                "new_key_id": new_key.id,
                "grace_period_hours": grace_period_hours
            }
        )
        
        return new_key, new_key_string, rotation
    
    def complete_rotation(
        self,
        rotation_id: str
    ) -> APIKeyRotation:
        """Complete a key rotation"""
        rotation = self.db.query(APIKeyRotation).filter(
            APIKeyRotation.id == rotation_id
        ).first()
        
        if not rotation:
            raise ValueError("Rotation not found")
        
        if rotation.status != "in_progress":
            raise ValueError("Rotation is not in progress")
        
        # Revoke old key
        old_key = rotation.api_key
        old_key.status = APIKeyStatus.REVOKED
        old_key.revoked_at = datetime.now(timezone.utc)
        old_key.revocation_reason = "Rotated to new key"
        
        # Complete rotation
        rotation.status = "completed"
        rotation.completed_at = datetime.now(timezone.utc)
        
        self.db.commit()
        
        return rotation
    
    def get_user_api_keys(
        self,
        user_id: str,
        include_revoked: bool = False
    ) -> List[APIKey]:
        """Get all API keys for a user"""
        query = self.db.query(APIKey).filter(
            APIKey.user_id == user_id
        )
        
        if not include_revoked:
            query = query.filter(
                APIKey.status.in_([APIKeyStatus.ACTIVE, APIKeyStatus.ROTATING])
            )
        
        return query.order_by(APIKey.created_at.desc()).all()
    
    def get_api_key_usage(
        self,
        api_key_id: str,
        days: int = 7
    ) -> List[APIKeyUsage]:
        """Get usage statistics for an API key"""
        since = datetime.now(timezone.utc) - timedelta(days=days)
        
        return self.db.query(APIKeyUsage).filter(
            and_(
                APIKeyUsage.api_key_id == api_key_id,
                APIKeyUsage.timestamp >= since
            )
        ).order_by(APIKeyUsage.timestamp.desc()).all()
    
    def log_api_key_usage(
        self,
        api_key: APIKey,
        request_details: Dict[str, Any],
        response_details: Dict[str, Any]
    ) -> APIKeyUsage:
        """Log API key usage"""
        usage = APIKeyUsage(
            api_key_id=api_key.id,
            ip_address=request_details.get("ip_address"),
            user_agent=request_details.get("user_agent"),
            origin=request_details.get("origin"),
            method=request_details.get("method"),
            path=request_details.get("path"),
            status_code=response_details.get("status_code"),
            response_time_ms=response_details.get("response_time_ms"),
            error_message=response_details.get("error_message"),
            signature_verified=request_details.get("signature_verified", False),
            rate_limit_hit=response_details.get("rate_limit_hit", False)
        )
        
        self.db.add(usage)
        self.db.commit()
        
        return usage
    
    def cleanup_expired_keys(self) -> int:
        """Clean up expired keys and rotations"""
        count = 0
        
        # Find expired active keys
        expired_keys = self.db.query(APIKey).filter(
            and_(
                APIKey.status == APIKeyStatus.ACTIVE,
                APIKey.expires_at.isnot(None),
                APIKey.expires_at < datetime.now(timezone.utc)
            )
        ).all()
        
        for key in expired_keys:
            key.status = APIKeyStatus.EXPIRED
            count += 1
        
        # Find completed rotations past grace period
        expired_rotations = self.db.query(APIKey).join(
            APIKeyRotation, APIKey.id == APIKeyRotation.api_key_id
        ).filter(
            and_(
                APIKey.status == APIKeyStatus.ROTATING,
                APIKeyRotation.old_key_expires_at < datetime.now(timezone.utc)
            )
        ).all()
        
        for key in expired_rotations:
            key.status = APIKeyStatus.REVOKED
            key.revoked_at = datetime.now(timezone.utc)
            key.revocation_reason = "Rotation grace period expired"
            count += 1
        
        self.db.commit()
        
        return count
    
    def create_default_scopes(self):
        """Create default API key scopes"""
        default_scopes = [
            # Read scopes
            ("telemetry:read", "Read rover telemetry data", "telemetry", "read", False),
            ("knowledge:read", "Read knowledge base", "knowledge", "read", False),
            ("config:read", "Read configuration", "config", "read", False),
            ("audit:read", "Read audit logs", "audit", "read", False),
            
            # Write scopes
            ("rover:control", "Control rover movement", "rover", "control", True),
            ("arduino:upload", "Upload Arduino sketches", "arduino", "upload", True),
            ("knowledge:write", "Write to knowledge base", "knowledge", "write", False),
            ("config:write", "Modify configuration", "config", "write", True),
            
            # Admin scopes
            ("users:manage", "Manage users", "users", "manage", True),
            ("keys:manage", "Manage API keys", "keys", "manage", True),
            ("system:admin", "Full system administration", "system", "admin", True)
        ]
        
        for name, description, resource, action, is_critical in default_scopes:
            existing = self.db.query(APIKeyScope).filter(
                APIKeyScope.name == name
            ).first()
            
            if not existing:
                scope = APIKeyScope(
                    name=name,
                    description=description,
                    resource=resource,
                    action=action,
                    is_critical=is_critical
                )
                self.db.add(scope)
        
        self.db.commit()