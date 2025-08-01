"""
Security and compliance features for command history
Implements GDPR compliance, data encryption, and access control
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session
import logging

from ..rbac.permissions import Permission
from ..auth.dependencies import get_current_user
from .audit_models import CommandHistory, CommandAuditLog, UserCommandAccess

logger = logging.getLogger(__name__)


class CommandHistorySecurityService:
    """
    Manages security and compliance for command history
    """
    
    def __init__(self, encryption_key: Optional[bytes] = None):
        """Initialize with optional encryption key"""
        if encryption_key:
            self.cipher = Fernet(encryption_key)
        else:
            # Generate a key if none provided (should be stored securely)
            self.cipher = Fernet(Fernet.generate_key())
    
    def anonymize_user_data(self, user_id: str) -> str:
        """
        Anonymize user ID using consistent hashing
        Maintains referential integrity while protecting identity
        """
        if not user_id or user_id == "ANONYMIZED":
            return "ANONYMIZED"
        
        # Use SHA-256 for consistent anonymization
        hash_object = hashlib.sha256(user_id.encode())
        return f"ANON_{hash_object.hexdigest()[:16]}"
    
    def encrypt_sensitive_data(self, data: Dict[str, Any]) -> str:
        """Encrypt sensitive command data"""
        json_data = json.dumps(data)
        encrypted = self.cipher.encrypt(json_data.encode())
        return encrypted.decode()
    
    def decrypt_sensitive_data(self, encrypted_data: str) -> Dict[str, Any]:
        """Decrypt sensitive command data"""
        try:
            decrypted = self.cipher.decrypt(encrypted_data.encode())
            return json.loads(decrypted.decode())
        except Exception as e:
            logger.error(f"Failed to decrypt data: {e}")
            return {}
    
    def apply_data_minimization(
        self, 
        command: CommandHistory,
        user_permissions: List[Permission]
    ) -> CommandHistory:
        """
        Apply data minimization based on user permissions
        Remove or redact fields user shouldn't see
        """
        # Check if user has full access
        if Permission.VIEW_SENSITIVE_DATA in user_permissions:
            return command
        
        # Redact sensitive fields
        if command.parameter_summary:
            command.parameter_summary = self._redact_sensitive_fields(
                command.parameter_summary
            )
        
        if command.result_summary:
            command.result_summary = self._redact_sensitive_fields(
                command.result_summary
            )
        
        # Anonymize user data if not authorized
        if Permission.VIEW_USER_DATA not in user_permissions:
            command.userId = self.anonymize_user_data(command.userId) if command.userId else None
            command.sessionId = "REDACTED" if command.sessionId else None
        
        return command
    
    def _redact_sensitive_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Redact sensitive fields from data"""
        sensitive_keys = [
            'password', 'token', 'secret', 'key', 'credential',
            'auth', 'private', 'ssn', 'email', 'phone'
        ]
        
        redacted = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                redacted[key] = "***REDACTED***"
            elif isinstance(value, dict):
                redacted[key] = self._redact_sensitive_fields(value)
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                redacted[key] = [self._redact_sensitive_fields(item) for item in value]
            else:
                redacted[key] = value
        
        return redacted
    
    def check_data_retention(
        self,
        db: Session,
        command: CommandHistory
    ) -> bool:
        """
        Check if command should be retained based on policies
        Returns True if command should be kept, False if it should be deleted
        """
        # Check retention expiry
        if command.retention_expiry and command.retention_expiry < datetime.utcnow():
            return False
        
        # Check data classification policies
        retention_days = {
            'public': 365,      # 1 year
            'internal': 730,    # 2 years
            'confidential': 1095,  # 3 years
            'restricted': 2555    # 7 years
        }
        
        classification = command.data_classification or 'internal'
        max_age = retention_days.get(classification, 730)
        
        if command.created_at:
            age = (datetime.utcnow() - command.created_at).days
            if age > max_age:
                return False
        
        return True
    
    def generate_gdpr_export(
        self,
        db: Session,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Generate GDPR-compliant data export for a user
        Includes all personal data and processing history
        """
        export_data = {
            'export_date': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'data_categories': {}
        }
        
        # Get command history
        commands = db.query(CommandHistory).filter(
            CommandHistory.user_id == user_id
        ).all()
        
        export_data['data_categories']['command_history'] = [
            {
                'command_id': cmd.command_id,
                'command_type': cmd.command_type,
                'created_at': cmd.created_at.isoformat() if cmd.created_at else None,
                'status': cmd.final_status,
                'parameters': cmd.parameter_summary,
                'results': cmd.result_summary
            }
            for cmd in commands
        ]
        
        # Get access logs
        access_logs = db.query(UserCommandAccess).filter(
            UserCommandAccess.user_id == user_id
        ).all()
        
        export_data['data_categories']['access_logs'] = [
            {
                'access_id': log.access_id,
                'accessed_at': log.accessed_at.isoformat() if log.accessed_at else None,
                'access_type': log.access_type,
                'purpose': log.purpose
            }
            for log in access_logs
        ]
        
        # Get audit logs
        audit_logs = db.query(CommandAuditLog).filter(
            CommandAuditLog.user_id == user_id
        ).all()
        
        export_data['data_categories']['audit_logs'] = [
            {
                'event_timestamp': log.event_timestamp.isoformat() if log.event_timestamp else None,
                'event_type': log.event_type,
                'command_id': log.command_id,
                'source_ip': log.source_ip
            }
            for log in audit_logs
        ]
        
        return export_data
    
    def delete_user_data(
        self,
        db: Session,
        user_id: str,
        anonymize: bool = True
    ) -> Dict[str, int]:
        """
        Delete or anonymize all user data (GDPR right to erasure)
        Returns count of affected records
        """
        counts = {
            'commands_affected': 0,
            'audit_logs_affected': 0,
            'access_logs_deleted': 0
        }
        
        if anonymize:
            # Anonymize commands
            anon_id = self.anonymize_user_data(user_id)
            commands = db.query(CommandHistory).filter(
                CommandHistory.user_id == user_id
            ).update({
                CommandHistory.user_id: anon_id,
                CommandHistory.parameter_summary: {},
                CommandHistory.result_summary: {}
            })
            counts['commands_affected'] = commands
            
            # Anonymize audit logs
            audit_logs = db.query(CommandAuditLog).filter(
                CommandAuditLog.user_id == user_id
            ).update({
                CommandAuditLog.user_id: anon_id,
                CommandAuditLog.source_ip: None,
                CommandAuditLog.parameters: {},
                CommandAuditLog.result_data: {}
            })
            counts['audit_logs_affected'] = audit_logs
        else:
            # Hard delete (not recommended)
            commands = db.query(CommandHistory).filter(
                CommandHistory.user_id == user_id
            ).delete()
            counts['commands_affected'] = commands
            
            audit_logs = db.query(CommandAuditLog).filter(
                CommandAuditLog.user_id == user_id
            ).delete()
            counts['audit_logs_affected'] = audit_logs
        
        # Always delete access logs
        access_logs = db.query(UserCommandAccess).filter(
            UserCommandAccess.user_id == user_id
        ).delete()
        counts['access_logs_deleted'] = access_logs
        
        db.commit()
        return counts
    
    def validate_consent(
        self,
        db: Session,
        user_id: str,
        purpose: str
    ) -> bool:
        """
        Validate if user has given consent for specific data processing
        This would integrate with a consent management system
        """
        # Placeholder - would check consent database
        # For now, assume consent is given for system operations
        system_purposes = [
            'command_execution',
            'system_monitoring',
            'security_audit',
            'performance_analysis'
        ]
        
        return purpose in system_purposes
    
    def get_data_processing_purposes(self) -> List[Dict[str, str]]:
        """
        Get list of all data processing purposes for transparency
        """
        return [
            {
                'purpose': 'command_execution',
                'description': 'Processing commands sent to the rover system',
                'legal_basis': 'contract',
                'retention': '7 days for failed commands, 30 days for successful'
            },
            {
                'purpose': 'system_monitoring',
                'description': 'Monitoring system health and performance',
                'legal_basis': 'legitimate_interest',
                'retention': '90 days'
            },
            {
                'purpose': 'security_audit',
                'description': 'Security monitoring and incident investigation',
                'legal_basis': 'legal_obligation',
                'retention': '1 year'
            },
            {
                'purpose': 'performance_analysis',
                'description': 'Analyzing system performance and optimization',
                'legal_basis': 'legitimate_interest',
                'retention': '6 months'
            }
        ]