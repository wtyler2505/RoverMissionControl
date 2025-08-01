"""
Service layer for CORS policy management
"""
import re
import json
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from fastapi import HTTPException, status

from .cors_models import (
    CORSPolicy, CORSPolicyType, CORSViolation, 
    CORSPreset, CORSAuditLog
)
from ..auth.models import User
from ..rbac.rbac_service import RBACService

class CORSService:
    """Service for managing CORS policies"""
    
    def __init__(self, db: Session):
        self.db = db
        self.rbac = RBACService(db)
    
    def create_policy(
        self,
        name: str,
        policy_type: CORSPolicyType,
        configuration: Dict[str, Any],
        current_user: User,
        description: Optional[str] = None,
        endpoint_pattern: Optional[str] = None,
        api_key_id: Optional[str] = None,
        priority: int = 0
    ) -> CORSPolicy:
        """Create a new CORS policy"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "cors:write", "cors_policies"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create CORS policies"
            )
        
        # Validate policy type and scope
        if policy_type == CORSPolicyType.ENDPOINT and not endpoint_pattern:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Endpoint pattern required for endpoint-type policies"
            )
        
        if policy_type == CORSPolicyType.API_KEY and not api_key_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key ID required for API key-type policies"
            )
        
        # Check for duplicate policies
        existing = self.db.query(CORSPolicy).filter(
            CORSPolicy.name == name
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Policy with name '{name}' already exists"
            )
        
        # Create policy
        policy = CORSPolicy(
            name=name,
            description=description,
            policy_type=policy_type,
            endpoint_pattern=endpoint_pattern,
            api_key_id=api_key_id,
            priority=priority,
            created_by=current_user.id,
            **configuration
        )
        
        self.db.add(policy)
        
        # Create audit log
        self._create_audit_log(
            action="created",
            policy=policy,
            user=current_user,
            new_values=configuration
        )
        
        self.db.commit()
        self.db.refresh(policy)
        
        return policy
    
    def get_policy(self, policy_id: str) -> Optional[CORSPolicy]:
        """Get a CORS policy by ID"""
        return self.db.query(CORSPolicy).filter(
            CORSPolicy.id == policy_id
        ).first()
    
    def get_policies(
        self,
        policy_type: Optional[CORSPolicyType] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None
    ) -> List[CORSPolicy]:
        """Get all CORS policies with optional filters"""
        query = self.db.query(CORSPolicy)
        
        if policy_type:
            query = query.filter(CORSPolicy.policy_type == policy_type)
        
        if is_active is not None:
            query = query.filter(CORSPolicy.is_active == is_active)
        
        if search:
            query = query.filter(
                or_(
                    CORSPolicy.name.ilike(f"%{search}%"),
                    CORSPolicy.description.ilike(f"%{search}%"),
                    CORSPolicy.endpoint_pattern.ilike(f"%{search}%")
                )
            )
        
        return query.order_by(CORSPolicy.priority.desc(), CORSPolicy.created_at).all()
    
    def update_policy(
        self,
        policy_id: str,
        updates: Dict[str, Any],
        current_user: User
    ) -> CORSPolicy:
        """Update a CORS policy"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "cors:write", "cors_policies"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to update CORS policies"
            )
        
        policy = self.get_policy(policy_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        # Store old values for audit
        old_values = {
            key: getattr(policy, key) 
            for key in updates.keys() 
            if hasattr(policy, key)
        }
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(policy, key) and key not in ['id', 'created_at', 'created_by']:
                setattr(policy, key, value)
        
        policy.updated_at = datetime.now(timezone.utc)
        policy.updated_by = current_user.id
        
        # Create audit log
        self._create_audit_log(
            action="updated",
            policy=policy,
            user=current_user,
            old_values=old_values,
            new_values=updates
        )
        
        self.db.commit()
        self.db.refresh(policy)
        
        return policy
    
    def delete_policy(self, policy_id: str, current_user: User) -> bool:
        """Delete a CORS policy"""
        # Check permissions
        if not self.rbac.check_permission(current_user.id, "cors:write", "cors_policies"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete CORS policies"
            )
        
        policy = self.get_policy(policy_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        # Store policy data for audit
        policy_data = {
            "name": policy.name,
            "policy_type": policy.policy_type,
            "configuration": {
                "allowed_origins": policy.allowed_origins,
                "allowed_methods": policy.allowed_methods,
                "allowed_headers": policy.allowed_headers,
                "expose_headers": policy.expose_headers,
                "allow_credentials": policy.allow_credentials,
                "max_age": policy.max_age
            }
        }
        
        # Delete policy
        self.db.delete(policy)
        
        # Create audit log
        self._create_audit_log(
            action="deleted",
            policy_name=policy.name,
            user=current_user,
            old_values=policy_data
        )
        
        self.db.commit()
        
        return True
    
    def test_policy(
        self,
        policy_id: str,
        test_origin: str,
        test_method: str,
        test_headers: Optional[List[str]] = None,
        current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        """Test a CORS policy with sample request"""
        policy = self.get_policy(policy_id)
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Policy not found"
            )
        
        results = {
            "policy_id": policy_id,
            "policy_name": policy.name,
            "test_origin": test_origin,
            "test_method": test_method,
            "test_headers": test_headers or [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "results": {}
        }
        
        # Test origin
        origin_allowed = self._check_origin_allowed(policy, test_origin)
        results["results"]["origin_allowed"] = origin_allowed
        
        # Test method
        method_allowed = self._check_method_allowed(policy, test_method)
        results["results"]["method_allowed"] = method_allowed
        
        # Test headers
        if test_headers:
            headers_allowed = all(
                self._check_header_allowed(policy, header) 
                for header in test_headers
            )
            results["results"]["headers_allowed"] = headers_allowed
            results["results"]["rejected_headers"] = [
                header for header in test_headers
                if not self._check_header_allowed(policy, header)
            ]
        
        # Overall result
        results["results"]["would_allow_request"] = all([
            origin_allowed,
            method_allowed,
            test_headers is None or headers_allowed
        ])
        
        # Generate CORS headers that would be sent
        if results["results"]["would_allow_request"]:
            results["results"]["cors_headers"] = self._generate_cors_headers(
                policy, test_origin
            )
        
        # Update test results on policy
        policy.test_results = results
        policy.last_tested_at = datetime.now(timezone.utc)
        
        # Create audit log if user provided
        if current_user:
            self._create_audit_log(
                action="tested",
                policy=policy,
                user=current_user,
                new_values={"test_parameters": results}
            )
        
        self.db.commit()
        
        return results
    
    def get_applicable_policy(
        self,
        origin: str,
        method: str,
        path: str,
        api_key_id: Optional[str] = None
    ) -> Optional[CORSPolicy]:
        """Get the applicable CORS policy for a request"""
        # Get all active policies
        policies = self.db.query(CORSPolicy).filter(
            CORSPolicy.is_active == True
        ).order_by(CORSPolicy.priority.desc()).all()
        
        for policy in policies:
            # Check policy type and scope
            if policy.policy_type == CORSPolicyType.API_KEY:
                if not api_key_id or policy.api_key_id != api_key_id:
                    continue
            
            elif policy.policy_type == CORSPolicyType.ENDPOINT:
                if not policy.endpoint_pattern:
                    continue
                
                # Check if path matches endpoint pattern
                try:
                    if not re.match(policy.endpoint_pattern, path):
                        continue
                except re.error:
                    continue
            
            # If we get here, policy applies
            return policy
        
        return None
    
    def record_violation(
        self,
        origin: str,
        method: str,
        path: str,
        violation_type: str,
        violation_details: Dict[str, Any],
        policy_id: Optional[str] = None,
        api_key_id: Optional[str] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        was_blocked: bool = True,
        override_reason: Optional[str] = None
    ) -> CORSViolation:
        """Record a CORS policy violation"""
        violation = CORSViolation(
            origin=origin,
            method=method,
            path=path,
            headers=headers,
            policy_id=policy_id,
            violation_type=violation_type,
            violation_details=violation_details,
            api_key_id=api_key_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            was_blocked=was_blocked,
            override_reason=override_reason
        )
        
        self.db.add(violation)
        self.db.commit()
        
        return violation
    
    def get_violations(
        self,
        policy_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        was_blocked: Optional[bool] = None
    ) -> List[CORSViolation]:
        """Get CORS violations with optional filters"""
        query = self.db.query(CORSViolation)
        
        if policy_id:
            query = query.filter(CORSViolation.policy_id == policy_id)
        
        if start_date:
            query = query.filter(CORSViolation.timestamp >= start_date)
        
        if end_date:
            query = query.filter(CORSViolation.timestamp <= end_date)
        
        if was_blocked is not None:
            query = query.filter(CORSViolation.was_blocked == was_blocked)
        
        return query.order_by(CORSViolation.timestamp.desc()).all()
    
    # Preset management
    def get_presets(self) -> List[CORSPreset]:
        """Get all CORS presets"""
        return self.db.query(CORSPreset).order_by(
            CORSPreset.is_system.desc(),
            CORSPreset.usage_count.desc()
        ).all()
    
    def create_policy_from_preset(
        self,
        preset_id: str,
        policy_name: str,
        current_user: User,
        customizations: Optional[Dict[str, Any]] = None
    ) -> CORSPolicy:
        """Create a CORS policy from a preset"""
        preset = self.db.query(CORSPreset).filter(
            CORSPreset.id == preset_id
        ).first()
        
        if not preset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preset not found"
            )
        
        # Merge preset configuration with customizations
        configuration = preset.configuration.copy()
        if customizations:
            configuration.update(customizations)
        
        # Update preset usage
        preset.usage_count += 1
        preset.last_used_at = datetime.now(timezone.utc)
        
        # Create policy
        return self.create_policy(
            name=policy_name,
            policy_type=CORSPolicyType.GLOBAL,
            configuration=configuration,
            current_user=current_user,
            description=f"Created from preset: {preset.name}"
        )
    
    # Helper methods
    def _check_origin_allowed(self, policy: CORSPolicy, origin: str) -> bool:
        """Check if origin is allowed by policy"""
        if policy.allow_all_origins:
            return True
        
        if not policy.allowed_origins:
            return False
        
        # Check exact match or pattern match
        for allowed_origin in policy.allowed_origins:
            if policy.validate_origin_regex:
                try:
                    pattern = allowed_origin
                    if not policy.case_sensitive_origins:
                        if re.match(pattern, origin, re.IGNORECASE):
                            return True
                    else:
                        if re.match(pattern, origin):
                            return True
                except re.error:
                    pass
            else:
                # Simple string comparison
                if not policy.case_sensitive_origins:
                    if allowed_origin.lower() == origin.lower():
                        return True
                else:
                    if allowed_origin == origin:
                        return True
        
        return False
    
    def _check_method_allowed(self, policy: CORSPolicy, method: str) -> bool:
        """Check if method is allowed by policy"""
        if policy.allow_all_methods:
            return True
        
        if not policy.allowed_methods:
            return False
        
        return method.upper() in [m.upper() for m in policy.allowed_methods]
    
    def _check_header_allowed(self, policy: CORSPolicy, header: str) -> bool:
        """Check if header is allowed by policy"""
        if policy.allow_all_headers:
            return True
        
        if not policy.allowed_headers:
            return False
        
        # Case-insensitive header comparison
        return header.lower() in [h.lower() for h in policy.allowed_headers]
    
    def _generate_cors_headers(
        self, 
        policy: CORSPolicy, 
        origin: str
    ) -> Dict[str, str]:
        """Generate CORS headers based on policy"""
        headers = {}
        
        # Origin
        if policy.allow_all_origins:
            headers["Access-Control-Allow-Origin"] = "*"
        else:
            headers["Access-Control-Allow-Origin"] = origin
        
        # Methods
        if policy.allowed_methods:
            headers["Access-Control-Allow-Methods"] = ", ".join(policy.allowed_methods)
        
        # Headers
        if policy.allowed_headers:
            if policy.allow_all_headers:
                headers["Access-Control-Allow-Headers"] = "*"
            else:
                headers["Access-Control-Allow-Headers"] = ", ".join(policy.allowed_headers)
        
        # Expose headers
        if policy.expose_headers:
            headers["Access-Control-Expose-Headers"] = ", ".join(policy.expose_headers)
        
        # Credentials
        if policy.allow_credentials:
            headers["Access-Control-Allow-Credentials"] = "true"
        
        # Max age
        headers["Access-Control-Max-Age"] = str(policy.max_age)
        
        return headers
    
    def _create_audit_log(
        self,
        action: str,
        user: User,
        policy: Optional[CORSPolicy] = None,
        policy_name: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ):
        """Create an audit log entry"""
        audit_log = CORSAuditLog(
            action=action,
            policy_id=policy.id if policy else None,
            policy_name=policy_name or (policy.name if policy else None),
            old_values=old_values,
            new_values=new_values,
            user_id=user.id,
            success=error_message is None,
            error_message=error_message
        )
        
        self.db.add(audit_log)