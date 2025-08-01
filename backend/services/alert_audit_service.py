"""
Comprehensive Alert Operations Audit Trail Service
Implements tamper-evident logging with cryptographic integrity for privacy compliance.
"""

import uuid
import hashlib
import json
import hmac
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union
from enum import Enum
import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from sqlalchemy.exc import SQLAlchemyError
import csv
import io
import os

logger = structlog.get_logger()

class AlertAuditEventType(str, Enum):
    """Alert-specific audit event types"""
    # Alert Lifecycle Events
    ALERT_CREATED = "alert_created"
    ALERT_TRIGGERED = "alert_triggered"
    ALERT_ACKNOWLEDGED = "alert_acknowledged"
    ALERT_RESOLVED = "alert_resolved"
    ALERT_SILENCED = "alert_silenced"
    ALERT_ESCALATED = "alert_escalated"
    ALERT_AUTO_RESOLVED = "alert_auto_resolved"
    
    # Alert Configuration Events
    ALERT_RULE_CREATED = "alert_rule_created"
    ALERT_RULE_UPDATED = "alert_rule_updated"
    ALERT_RULE_DELETED = "alert_rule_deleted"
    ALERT_RULE_ENABLED = "alert_rule_enabled"
    ALERT_RULE_DISABLED = "alert_rule_disabled"
    
    # Threshold Management Events
    THRESHOLD_CREATED = "threshold_created"
    THRESHOLD_UPDATED = "threshold_updated"
    THRESHOLD_DELETED = "threshold_deleted"
    THRESHOLD_EXCEEDED = "threshold_exceeded"
    THRESHOLD_CLEARED = "threshold_cleared"
    
    # Privacy-Related Events
    ALERT_DATA_ACCESSED = "alert_data_accessed"
    ALERT_DATA_EXPORTED = "alert_data_exported"
    ALERT_DATA_DELETED = "alert_data_deleted"
    ALERT_CONSENT_WITHDRAWN = "alert_consent_withdrawn"
    ALERT_RETENTION_APPLIED = "alert_retention_applied"
    
    # Notification Events
    NOTIFICATION_SENT = "notification_sent"
    NOTIFICATION_FAILED = "notification_failed"
    NOTIFICATION_CONFIG_CHANGED = "notification_config_changed"
    
    # System Events
    ALERT_SYSTEM_STARTED = "alert_system_started"
    ALERT_SYSTEM_STOPPED = "alert_system_stopped"
    ALERT_SYSTEM_ERROR = "alert_system_error"
    AUDIT_LOG_TAMPERED = "audit_log_tampered"

class AlertAuditSeverity(str, Enum):
    """Audit severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ComplianceFramework(str, Enum):
    """Supported compliance frameworks"""
    GDPR = "gdpr"
    CCPA = "ccpa"
    HIPAA = "hipaa"
    SOX = "sox"
    PCI_DSS = "pci_dss"
    ISO_27001 = "iso_27001"

class AlertAuditLog:
    """Alert audit log entry with cryptographic integrity"""
    
    def __init__(
        self,
        event_type: AlertAuditEventType,
        actor_id: Optional[str] = None,
        actor_type: str = "system",
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        action: str = "",
        details: Optional[Dict[str, Any]] = None,
        severity: AlertAuditSeverity = AlertAuditSeverity.MEDIUM,
        success: bool = True,
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        compliance_frameworks: Optional[List[ComplianceFramework]] = None,
        personal_data_involved: bool = False,
        financial_data_involved: bool = False,
        health_data_involved: bool = False,
        timestamp: Optional[datetime] = None
    ):
        self.id = str(uuid.uuid4())
        self.timestamp = timestamp or datetime.now(timezone.utc)
        self.event_type = event_type
        self.actor_id = actor_id
        self.actor_type = actor_type
        self.target_id = target_id
        self.target_type = target_type
        self.action = action
        self.details = details or {}
        self.severity = severity
        self.success = success
        self.error_message = error_message
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.session_id = session_id
        self.request_id = request_id
        self.before_state = before_state
        self.after_state = after_state
        self.compliance_frameworks = compliance_frameworks or []
        self.personal_data_involved = personal_data_involved
        self.financial_data_involved = financial_data_involved
        self.health_data_involved = health_data_involved
        
        # Integrity fields
        self.checksum = None
        self.signature = None
        self.previous_log_id = None
        self.chain_index = 0
        
    def calculate_checksum(self) -> str:
        """Calculate SHA-256 checksum of log entry"""
        data = {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "actor_id": self.actor_id,
            "actor_type": self.actor_type,
            "target_id": self.target_id,
            "target_type": self.target_type,
            "action": self.action,
            "details": self.details,
            "severity": self.severity.value,
            "success": self.success,
            "error_message": self.error_message,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "previous_log_id": self.previous_log_id,
            "chain_index": self.chain_index
        }
        
        json_data = json.dumps(data, sort_keys=True, separators=(',', ':'))
        return hashlib.sha256(json_data.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "actor_id": self.actor_id,
            "actor_type": self.actor_type,
            "target_id": self.target_id,
            "target_type": self.target_type,
            "action": self.action,
            "details": self.details,
            "severity": self.severity.value,
            "success": self.success,
            "error_message": self.error_message,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "session_id": self.session_id,
            "request_id": self.request_id,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "compliance_frameworks": [f.value for f in self.compliance_frameworks],
            "personal_data_involved": self.personal_data_involved,
            "financial_data_involved": self.financial_data_involved,
            "health_data_involved": self.health_data_involved,
            "checksum": self.checksum,
            "signature": self.signature.hex() if self.signature else None,
            "previous_log_id": self.previous_log_id,
            "chain_index": self.chain_index
        }

class AlertAuditService:
    """Comprehensive audit service for alert operations with tamper-evident logging"""
    
    def __init__(self, db: Session):
        self.db = db
        self.audit_logs: List[AlertAuditLog] = []
        self.log_chain: Dict[str, str] = {}  # log_id -> previous_log_id
        self.encryption_key = self._get_or_create_encryption_key()
        self.signing_key = self._get_or_create_signing_key()
        self.request_context = {}
        
        # Compliance settings
        self.retention_days = 2555  # 7 years for GDPR compliance
        self.archive_threshold_days = 365  # Archive after 1 year
        
        # Log rotation
        self.max_logs_in_memory = 10000
        self.log_file_path = os.environ.get('ALERT_AUDIT_LOG_PATH', './logs/alert_audit.log')
        
    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for sensitive data"""
        key_file = os.environ.get('ALERT_AUDIT_ENCRYPTION_KEY_FILE', '.alert_audit_key')
        
        # Use absolute path
        if not os.path.isabs(key_file):
            key_file = os.path.join(os.path.dirname(__file__), '..', key_file)
        
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            key_dir = os.path.dirname(key_file)
            if key_dir:
                os.makedirs(key_dir, exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(key)
            return key
    
    def _get_or_create_signing_key(self) -> rsa.RSAPrivateKey:
        """Get or create RSA key for signing audit logs"""
        key_file = os.environ.get('ALERT_AUDIT_SIGNING_KEY_FILE', '.alert_audit_signing_key')
        
        # Use absolute path
        if not os.path.isabs(key_file):
            key_file = os.path.join(os.path.dirname(__file__), '..', key_file)
        
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )
        else:
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )
            pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )
            key_dir = os.path.dirname(key_file)
            if key_dir:
                os.makedirs(key_dir, exist_ok=True)
            with open(key_file, 'wb') as f:
                f.write(pem)
            return private_key
    
    def set_request_context(
        self,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None
    ):
        """Set request context for audit logging"""
        self.request_context = {
            'user_id': user_id,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'session_id': session_id,
            'request_id': request_id
        }
    
    def clear_request_context(self):
        """Clear request context"""
        self.request_context = {}
    
    async def log_event(
        self,
        event_type: AlertAuditEventType,
        actor_id: Optional[str] = None,
        actor_type: str = "system",
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        action: str = "",
        details: Optional[Dict[str, Any]] = None,
        severity: AlertAuditSeverity = AlertAuditSeverity.MEDIUM,
        success: bool = True,
        error_message: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        compliance_frameworks: Optional[List[ComplianceFramework]] = None,
        personal_data_involved: bool = False,
        financial_data_involved: bool = False,
        health_data_involved: bool = False
    ) -> AlertAuditLog:
        """Log an alert audit event with cryptographic integrity"""
        
        try:
            # Create audit log entry
            audit_log = AlertAuditLog(
                event_type=event_type,
                actor_id=actor_id or self.request_context.get('user_id'),
                actor_type=actor_type,
                target_id=target_id,
                target_type=target_type,
                action=action,
                details=details,
                severity=severity,
                success=success,
                error_message=error_message,
                ip_address=self.request_context.get('ip_address'),
                user_agent=self.request_context.get('user_agent'),
                session_id=self.request_context.get('session_id'),
                request_id=self.request_context.get('request_id'),
                before_state=before_state,
                after_state=after_state,
                compliance_frameworks=compliance_frameworks,
                personal_data_involved=personal_data_involved,
                financial_data_involved=financial_data_involved,
                health_data_involved=health_data_involved
            )
            
            # Chain with previous log
            if self.audit_logs:
                last_log = self.audit_logs[-1]
                audit_log.previous_log_id = last_log.id
                audit_log.chain_index = last_log.chain_index + 1
            
            # Calculate checksum
            audit_log.checksum = audit_log.calculate_checksum()
            
            # Digital signature
            audit_log.signature = self._sign_log_entry(audit_log)
            
            # Add to chain
            self.audit_logs.append(audit_log)
            self.log_chain[audit_log.id] = audit_log.previous_log_id
            
            # Persist to file immediately for tamper resistance
            await self._persist_log_entry(audit_log)
            
            # Check if we need to rotate logs
            if len(self.audit_logs) > self.max_logs_in_memory:
                await self._rotate_logs()
            
            logger.info(
                f"Alert audit event logged",
                event_type=event_type.value,
                actor_id=actor_id,
                target_id=target_id,
                checksum=audit_log.checksum[:16]  # First 16 chars for logging
            )
            
            return audit_log
            
        except Exception as e:
            logger.error(f"Failed to log alert audit event: {str(e)}")
            # Create a tamper alert
            await self._log_tamper_alert(str(e))
            raise
    
    def _sign_log_entry(self, audit_log: AlertAuditLog) -> bytes:
        """Digitally sign an audit log entry"""
        message = f"{audit_log.checksum}:{audit_log.timestamp.isoformat()}"
        signature = self.signing_key.sign(
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature
    
    async def _persist_log_entry(self, audit_log: AlertAuditLog):
        """Persist log entry to file immediately"""
        try:
            os.makedirs(os.path.dirname(self.log_file_path), exist_ok=True)
            
            # Append to audit log file
            with open(self.log_file_path, 'a', encoding='utf-8') as f:
                log_line = json.dumps(audit_log.to_dict()) + '\n'
                f.write(log_line)
                f.flush()  # Ensure immediate write
                
        except Exception as e:
            logger.error(f"Failed to persist audit log: {str(e)}")
            raise
    
    async def _log_tamper_alert(self, error_message: str):
        """Log a critical tamper detection alert"""
        try:
            tamper_log = AlertAuditLog(
                event_type=AlertAuditEventType.AUDIT_LOG_TAMPERED,
                actor_id="system",
                actor_type="system",
                action="Audit log tamper detected",
                details={"error": error_message},
                severity=AlertAuditSeverity.CRITICAL,
                success=False,
                error_message=error_message
            )
            
            # Sign and persist immediately
            tamper_log.checksum = tamper_log.calculate_checksum()
            tamper_log.signature = self._sign_log_entry(tamper_log)
            
            # Write to separate tamper log
            tamper_file = self.log_file_path.replace('.log', '_tamper.log')
            with open(tamper_file, 'a', encoding='utf-8') as f:
                log_line = json.dumps(tamper_log.to_dict()) + '\n'
                f.write(log_line)
                f.flush()
                
        except Exception as e:
            # Last resort - write to system log
            logger.critical(f"CRITICAL: Failed to log tamper alert: {str(e)}")
    
    async def _rotate_logs(self):
        """Rotate logs to prevent memory exhaustion"""
        try:
            # Keep only the most recent logs in memory
            keep_count = self.max_logs_in_memory // 2
            archived_logs = self.audit_logs[:-keep_count]
            self.audit_logs = self.audit_logs[-keep_count:]
            
            # Archive older logs
            archive_file = self.log_file_path.replace('.log', f'_archive_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
            
            with open(archive_file, 'w', encoding='utf-8') as f:
                for log in archived_logs:
                    log_line = json.dumps(log.to_dict()) + '\n'
                    f.write(log_line)
            
            logger.info(f"Rotated {len(archived_logs)} audit logs to {archive_file}")
            
        except Exception as e:
            logger.error(f"Failed to rotate audit logs: {str(e)}")
    
    async def verify_log_integrity(self, log_id: Optional[str] = None) -> Dict[str, Any]:
        """Verify the integrity of audit logs"""
        results = {
            "verified": True,
            "total_logs": len(self.audit_logs),
            "verification_errors": [],
            "chain_intact": True,
            "signature_valid": True
        }
        
        logs_to_verify = self.audit_logs
        if log_id:
            logs_to_verify = [log for log in self.audit_logs if log.id == log_id]
            if not logs_to_verify:
                results["verified"] = False
                results["verification_errors"].append(f"Log {log_id} not found")
                return results
        
        try:
            for i, log in enumerate(logs_to_verify):
                # Verify checksum
                expected_checksum = log.calculate_checksum()
                if log.checksum != expected_checksum:
                    results["verified"] = False
                    results["verification_errors"].append(f"Checksum mismatch for log {log.id}")
                
                # Verify signature
                if not self._verify_signature(log):
                    results["verified"] = False
                    results["signature_valid"] = False
                    results["verification_errors"].append(f"Invalid signature for log {log.id}")
                
                # Verify chain integrity
                if i > 0:
                    expected_previous = logs_to_verify[i-1].id
                    if log.previous_log_id != expected_previous:
                        results["verified"] = False
                        results["chain_intact"] = False
                        results["verification_errors"].append(f"Chain break at log {log.id}")
            
        except Exception as e:
            results["verified"] = False
            results["verification_errors"].append(f"Verification error: {str(e)}")
        
        return results
    
    def _verify_signature(self, audit_log: AlertAuditLog) -> bool:
        """Verify digital signature of a log entry"""
        try:
            if not audit_log.signature:
                return False
            
            message = f"{audit_log.checksum}:{audit_log.timestamp.isoformat()}"
            public_key = self.signing_key.public_key()
            
            public_key.verify(
                audit_log.signature,
                message.encode(),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
            
        except Exception:
            return False
    
    async def search_logs(
        self,
        event_types: Optional[List[AlertAuditEventType]] = None,
        actor_id: Optional[str] = None,
        target_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        severity: Optional[AlertAuditSeverity] = None,
        success: Optional[bool] = None,
        compliance_framework: Optional[ComplianceFramework] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Tuple[List[AlertAuditLog], int]:
        """Search audit logs with filters"""
        
        filtered_logs = self.audit_logs.copy()
        
        # Apply filters
        if event_types:
            event_type_values = [et.value for et in event_types]
            filtered_logs = [log for log in filtered_logs if log.event_type.value in event_type_values]
        
        if actor_id:
            filtered_logs = [log for log in filtered_logs if log.actor_id == actor_id]
        
        if target_id:
            filtered_logs = [log for log in filtered_logs if log.target_id == target_id]
        
        if start_date:
            filtered_logs = [log for log in filtered_logs if log.timestamp >= start_date]
        
        if end_date:
            filtered_logs = [log for log in filtered_logs if log.timestamp <= end_date]
        
        if severity:
            filtered_logs = [log for log in filtered_logs if log.severity == severity]
        
        if success is not None:
            filtered_logs = [log for log in filtered_logs if log.success == success]
        
        if compliance_framework:
            filtered_logs = [
                log for log in filtered_logs 
                if compliance_framework in log.compliance_frameworks
            ]
        
        # Sort by timestamp (newest first)
        filtered_logs.sort(key=lambda x: x.timestamp, reverse=True)
        
        total_count = len(filtered_logs)
        
        # Apply pagination
        paginated_logs = filtered_logs[offset:offset + limit]
        
        return paginated_logs, total_count
    
    async def export_logs(
        self,
        format: str = "json",
        event_types: Optional[List[AlertAuditEventType]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_signatures: bool = True,
        encrypt_export: bool = False,
        requester_id: str = "system",
        export_reason: str = "compliance_audit"
    ) -> Dict[str, Any]:
        """Export audit logs for compliance reporting"""
        
        try:
            # Search logs based on criteria
            logs, total_count = await self.search_logs(
                event_types=event_types,
                start_date=start_date,
                end_date=end_date,
                limit=10000  # High limit for export
            )
            
            # Create export metadata
            export_id = str(uuid.uuid4())
            export_timestamp = datetime.now(timezone.utc)
            
            export_metadata = {
                "export_id": export_id,
                "export_timestamp": export_timestamp.isoformat(),
                "requester_id": requester_id,
                "export_reason": export_reason,
                "format": format,
                "total_records": total_count,
                "date_range": {
                    "start": start_date.isoformat() if start_date else None,
                    "end": end_date.isoformat() if end_date else None
                },
                "filters": {
                    "event_types": [et.value for et in event_types] if event_types else None
                },
                "include_signatures": include_signatures,
                "encrypted": encrypt_export
            }
            
            # Generate export data
            if format.lower() == "json":
                export_data = await self._export_as_json(logs, export_metadata, include_signatures)
            elif format.lower() == "csv":
                export_data = await self._export_as_csv(logs, export_metadata)
            elif format.lower() == "xml":
                export_data = await self._export_as_xml(logs, export_metadata)
            else:
                raise ValueError(f"Unsupported export format: {format}")
            
            # Encrypt if requested
            if encrypt_export:
                f = Fernet(self.encryption_key)
                export_data = f.encrypt(export_data.encode()).decode()
            
            # Calculate checksum
            checksum = hashlib.sha256(export_data.encode()).hexdigest()
            
            # Log the export operation
            await self.log_event(
                event_type=AlertAuditEventType.ALERT_DATA_EXPORTED,
                actor_id=requester_id,
                actor_type="user",
                target_type="audit_export",
                target_id=export_id,
                action=f"Audit logs exported in {format} format",
                details={
                    "export_id": export_id,
                    "record_count": total_count,
                    "format": format,
                    "encrypted": encrypt_export,
                    "checksum": checksum
                },
                compliance_frameworks=[ComplianceFramework.GDPR],
                personal_data_involved=any(log.personal_data_involved for log in logs),
                financial_data_involved=any(log.financial_data_involved for log in logs),
                health_data_involved=any(log.health_data_involved for log in logs)
            )
            
            return {
                "export_id": export_id,
                "data": export_data,
                "metadata": export_metadata,
                "checksum": checksum,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Failed to export audit logs: {str(e)}")
            raise
    
    async def _export_as_json(
        self, 
        logs: List[AlertAuditLog], 
        metadata: Dict[str, Any],
        include_signatures: bool = True
    ) -> str:
        """Export logs as JSON format"""
        
        export_data = {
            "metadata": metadata,
            "logs": []
        }
        
        for log in logs:
            log_dict = log.to_dict()
            if not include_signatures:
                log_dict.pop("signature", None)
            export_data["logs"].append(log_dict)
        
        return json.dumps(export_data, indent=2, sort_keys=True)
    
    async def _export_as_csv(
        self, 
        logs: List[AlertAuditLog], 
        metadata: Dict[str, Any]
    ) -> str:
        """Export logs as CSV format"""
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write metadata as comments
        writer.writerow([f"# Export ID: {metadata['export_id']}"])
        writer.writerow([f"# Export Timestamp: {metadata['export_timestamp']}"])
        writer.writerow([f"# Total Records: {metadata['total_records']}"])
        writer.writerow([])  # Empty row
        
        # Header
        writer.writerow([
            "ID", "Timestamp", "Event Type", "Actor ID", "Actor Type",
            "Target ID", "Target Type", "Action", "Severity", "Success",
            "Error Message", "IP Address", "Session ID", "Request ID",
            "Personal Data", "Financial Data", "Health Data", "Compliance Frameworks",
            "Checksum"
        ])
        
        # Data rows
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.isoformat(),
                log.event_type.value,
                log.actor_id or "",
                log.actor_type,
                log.target_id or "",
                log.target_type or "",
                log.action,
                log.severity.value,
                log.success,
                log.error_message or "",
                log.ip_address or "",
                log.session_id or "",
                log.request_id or "",
                log.personal_data_involved,
                log.financial_data_involved,
                log.health_data_involved,
                ";".join([f.value for f in log.compliance_frameworks]),
                log.checksum
            ])
        
        return output.getvalue()
    
    async def _export_as_xml(
        self, 
        logs: List[AlertAuditLog], 
        metadata: Dict[str, Any]
    ) -> str:
        """Export logs as XML format"""
        
        import xml.etree.ElementTree as ET
        
        root = ET.Element("AlertAuditExport")
        
        # Metadata
        meta_elem = ET.SubElement(root, "Metadata")
        for key, value in metadata.items():
            if isinstance(value, dict):
                sub_elem = ET.SubElement(meta_elem, key)
                for sub_key, sub_value in value.items():
                    ET.SubElement(sub_elem, sub_key).text = str(sub_value) if sub_value else ""
            else:
                ET.SubElement(meta_elem, key).text = str(value) if value else ""
        
        # Logs
        logs_elem = ET.SubElement(root, "Logs")
        
        for log in logs:
            log_elem = ET.SubElement(logs_elem, "AuditLog")
            log_elem.set("id", log.id)
            
            # Basic fields
            ET.SubElement(log_elem, "Timestamp").text = log.timestamp.isoformat()
            ET.SubElement(log_elem, "EventType").text = log.event_type.value
            ET.SubElement(log_elem, "ActorId").text = log.actor_id or ""
            ET.SubElement(log_elem, "ActorType").text = log.actor_type
            ET.SubElement(log_elem, "TargetId").text = log.target_id or ""
            ET.SubElement(log_elem, "TargetType").text = log.target_type or ""
            ET.SubElement(log_elem, "Action").text = log.action
            ET.SubElement(log_elem, "Severity").text = log.severity.value
            ET.SubElement(log_elem, "Success").text = str(log.success)
            
            if log.error_message:
                ET.SubElement(log_elem, "ErrorMessage").text = log.error_message
            
            # Request context
            context_elem = ET.SubElement(log_elem, "RequestContext")
            ET.SubElement(context_elem, "IpAddress").text = log.ip_address or ""
            ET.SubElement(context_elem, "SessionId").text = log.session_id or ""
            ET.SubElement(context_elem, "RequestId").text = log.request_id or ""
            
            # Data classification
            classification_elem = ET.SubElement(log_elem, "DataClassification")
            classification_elem.set("personalData", str(log.personal_data_involved))
            classification_elem.set("financialData", str(log.financial_data_involved))
            classification_elem.set("healthData", str(log.health_data_involved))
            
            # Compliance frameworks
            if log.compliance_frameworks:
                compliance_elem = ET.SubElement(log_elem, "ComplianceFrameworks")
                for framework in log.compliance_frameworks:
                    ET.SubElement(compliance_elem, "Framework").text = framework.value
            
            # Integrity
            integrity_elem = ET.SubElement(log_elem, "Integrity")
            ET.SubElement(integrity_elem, "Checksum").text = log.checksum
            if log.previous_log_id:
                ET.SubElement(integrity_elem, "PreviousLogId").text = log.previous_log_id
            ET.SubElement(integrity_elem, "ChainIndex").text = str(log.chain_index)
        
        return ET.tostring(root, encoding='unicode', method='xml')
    
    async def apply_retention_policy(self) -> Dict[str, int]:
        """Apply retention policy to audit logs"""
        
        results = {
            "archived": 0,
            "deleted": 0,
            "errors": 0
        }
        
        try:
            current_time = datetime.now(timezone.utc)
            archive_cutoff = current_time - timedelta(days=self.archive_threshold_days)
            delete_cutoff = current_time - timedelta(days=self.retention_days)
            
            # Archive old logs
            logs_to_archive = [
                log for log in self.audit_logs 
                if log.timestamp < archive_cutoff
            ]
            
            for log in logs_to_archive:
                try:
                    await self._archive_log(log)
                    results["archived"] += 1
                except Exception as e:
                    logger.error(f"Failed to archive log {log.id}: {str(e)}")
                    results["errors"] += 1
            
            # Delete very old logs (beyond retention period)
            logs_to_delete = [
                log for log in self.audit_logs 
                if log.timestamp < delete_cutoff
            ]
            
            for log in logs_to_delete:
                try:
                    await self._delete_log(log)
                    results["deleted"] += 1
                except Exception as e:
                    logger.error(f"Failed to delete log {log.id}: {str(e)}")
                    results["errors"] += 1
            
            # Log retention policy execution
            await self.log_event(
                event_type=AlertAuditEventType.ALERT_RETENTION_APPLIED,
                actor_id="system",
                actor_type="system",
                action="Alert audit retention policy applied",
                details=results,
                compliance_frameworks=[ComplianceFramework.GDPR]
            )
            
        except Exception as e:
            logger.error(f"Failed to apply retention policy: {str(e)}")
            results["errors"] += 1
        
        return results
    
    async def _archive_log(self, log: AlertAuditLog):
        """Archive a log entry"""
        archive_dir = os.path.join(os.path.dirname(self.log_file_path), "archive")
        os.makedirs(archive_dir, exist_ok=True)
        
        archive_file = os.path.join(
            archive_dir, 
            f"alert_audit_archive_{log.timestamp.strftime('%Y_%m')}.log"
        )
        
        with open(archive_file, 'a', encoding='utf-8') as f:
            log_line = json.dumps(log.to_dict()) + '\n'
            f.write(log_line)
    
    async def _delete_log(self, log: AlertAuditLog):
        """Securely delete a log entry"""
        # Remove from memory
        self.audit_logs = [l for l in self.audit_logs if l.id != log.id]
        
        # Remove from chain tracking
        self.log_chain.pop(log.id, None)
        
        # Note: In production, you might want to overwrite the file location
        # with random data multiple times for secure deletion
    
    async def get_compliance_report(
        self,
        framework: ComplianceFramework,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Generate compliance report for specific framework"""
        
        # Filter logs by framework and date range
        relevant_logs = [
            log for log in self.audit_logs
            if framework in log.compliance_frameworks
            and start_date <= log.timestamp <= end_date
        ]
        
        # Calculate statistics
        total_events = len(relevant_logs)
        success_events = sum(1 for log in relevant_logs if log.success)
        failure_events = total_events - success_events
        
        # Group by event type
        events_by_type = {}
        for log in relevant_logs:
            event_type = log.event_type.value
            if event_type not in events_by_type:
                events_by_type[event_type] = 0
            events_by_type[event_type] += 1
        
        # Group by severity
        events_by_severity = {}
        for log in relevant_logs:
            severity = log.severity.value
            if severity not in events_by_severity:
                events_by_severity[severity] = 0
            events_by_severity[severity] += 1
        
        # Data classification breakdown
        personal_data_events = sum(1 for log in relevant_logs if log.personal_data_involved)
        financial_data_events = sum(1 for log in relevant_logs if log.financial_data_involved)
        health_data_events = sum(1 for log in relevant_logs if log.health_data_involved)
        
        # Critical events requiring attention
        critical_events = [
            log for log in relevant_logs 
            if log.severity == AlertAuditSeverity.CRITICAL
        ]
        
        report = {
            "framework": framework.value,
            "report_period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "summary": {
                "total_events": total_events,
                "success_events": success_events,
                "failure_events": failure_events,
                "success_rate": success_events / total_events if total_events > 0 else 0
            },
            "event_breakdown": {
                "by_type": events_by_type,
                "by_severity": events_by_severity
            },
            "data_classification": {
                "personal_data_events": personal_data_events,
                "financial_data_events": financial_data_events,
                "health_data_events": health_data_events
            },
            "critical_events": [
                {
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat(),
                    "event_type": log.event_type.value,
                    "action": log.action,
                    "actor_id": log.actor_id,
                    "error_message": log.error_message
                }
                for log in critical_events
            ],
            "integrity_status": await self.verify_log_integrity(),
            "retention_compliance": {
                "retention_policy_days": self.retention_days,
                "archive_threshold_days": self.archive_threshold_days,
                "oldest_log_age_days": (
                    (datetime.now(timezone.utc) - min(log.timestamp for log in self.audit_logs)).days
                    if self.audit_logs else 0
                )
            }
        }
        
        return report
    
    # Convenience methods for common alert operations
    
    async def log_alert_created(
        self,
        alert_id: str,
        rule_id: str,
        metric_id: str,
        created_by: str,
        alert_details: Dict[str, Any]
    ):
        """Log alert creation event"""
        await self.log_event(
            event_type=AlertAuditEventType.ALERT_CREATED,
            actor_id=created_by,
            actor_type="user",
            target_id=alert_id,
            target_type="alert",
            action=f"Alert created for metric {metric_id}",
            details={
                "rule_id": rule_id,
                "metric_id": metric_id,
                "alert_details": alert_details
            },
            compliance_frameworks=[ComplianceFramework.GDPR]
        )
    
    async def log_alert_acknowledged(
        self,
        alert_id: str,
        acknowledged_by: str,
        notes: Optional[str] = None
    ):
        """Log alert acknowledgment event"""
        await self.log_event(
            event_type=AlertAuditEventType.ALERT_ACKNOWLEDGED,
            actor_id=acknowledged_by,
            actor_type="user",
            target_id=alert_id,
            target_type="alert",
            action="Alert acknowledged",
            details={"notes": notes} if notes else None,
            compliance_frameworks=[ComplianceFramework.GDPR]
        )
    
    async def log_alert_resolved(
        self,
        alert_id: str,
        resolved_by: str,
        resolution_notes: Optional[str] = None
    ):
        """Log alert resolution event"""
        await self.log_event(
            event_type=AlertAuditEventType.ALERT_RESOLVED,
            actor_id=resolved_by,
            actor_type="user",
            target_id=alert_id,
            target_type="alert",
            action="Alert resolved",
            details={"resolution_notes": resolution_notes} if resolution_notes else None,
            compliance_frameworks=[ComplianceFramework.GDPR]
        )
    
    async def log_threshold_exceeded(
        self,
        threshold_id: str,
        metric_id: str,
        current_value: float,
        threshold_value: float,
        details: Dict[str, Any]
    ):
        """Log threshold exceeded event"""
        await self.log_event(
            event_type=AlertAuditEventType.THRESHOLD_EXCEEDED,
            actor_id="system",
            actor_type="system",
            target_id=threshold_id,
            target_type="threshold",
            action=f"Threshold exceeded for metric {metric_id}",
            details={
                "metric_id": metric_id,
                "current_value": current_value,
                "threshold_value": threshold_value,
                **details
            },
            severity=AlertAuditSeverity.HIGH
        )
    
    async def log_notification_sent(
        self,
        alert_id: str,
        notification_channel: str,
        recipient: str,
        success: bool,
        error_message: Optional[str] = None
    ):
        """Log notification sent event"""
        await self.log_event(
            event_type=AlertAuditEventType.NOTIFICATION_SENT,
            actor_id="system",
            actor_type="system",
            target_id=alert_id,
            target_type="alert",
            action=f"Notification sent via {notification_channel}",
            details={
                "channel": notification_channel,
                "recipient": recipient
            },
            success=success,
            error_message=error_message
        )
    
    async def log_data_access(
        self,
        accessed_by: str,
        data_type: str,
        data_id: str,
        access_reason: str,
        personal_data: bool = False,
        financial_data: bool = False,
        health_data: bool = False
    ):
        """Log data access event for privacy compliance"""
        await self.log_event(
            event_type=AlertAuditEventType.ALERT_DATA_ACCESSED,
            actor_id=accessed_by,
            actor_type="user",
            target_id=data_id,
            target_type=data_type,
            action=f"Data accessed: {access_reason}",
            details={"access_reason": access_reason},
            compliance_frameworks=[ComplianceFramework.GDPR, ComplianceFramework.CCPA],
            personal_data_involved=personal_data,
            financial_data_involved=financial_data,
            health_data_involved=health_data
        )