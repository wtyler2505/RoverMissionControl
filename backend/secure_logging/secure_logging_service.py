"""
Main secure logging service that integrates all components
"""
import os
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import json
from dataclasses import asdict

from .hash_chain import HashChainLogger
from .encryption import EncryptedLogStore
from .redundant_storage import RedundantStorageManager, StorageLocation
from .notification_manager import (
    NotificationManager, NotificationEvent, NotificationRule,
    EmailChannel, SMSChannel, WebhookChannel, SlackChannel
)
from .compliance_reporter import ComplianceReporter
from .forensic_analyzer import ForensicAnalyzer
from .siem_integration import (
    SIEMIntegration, SyslogConnector, SplunkConnector,
    ElasticConnector, ArcSightConnector
)


class SecureLoggingService:
    """
    Enterprise-grade secure logging service with:
    - Tamper-proof hash chain logging
    - AES-256 encryption
    - Redundant storage
    - Real-time notifications
    - Compliance reporting
    - Forensic analysis
    - SIEM integration
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize secure logging service
        
        Args:
            config: Service configuration
        """
        self.config = config
        
        # Initialize components
        self._init_hash_chain()
        self._init_encryption()
        self._init_redundant_storage()
        self._init_notifications()
        self._init_compliance()
        self._init_forensics()
        self._init_siem()
        
        # Event processing
        self.event_queue = asyncio.Queue()
        self.running = False
        self.workers = []
        
    def _init_hash_chain(self):
        """Initialize hash chain logger"""
        chain_config = self.config.get('hash_chain', {})
        self.hash_chain = HashChainLogger(
            chain_id=chain_config.get('chain_id', 'rover_security'),
            storage_path=chain_config.get('storage_path', '/var/log/rover/hashchain'),
            private_key_path=chain_config.get('private_key_path'),
            difficulty=chain_config.get('difficulty', 4)
        )
        
    def _init_encryption(self):
        """Initialize encrypted storage"""
        encryption_config = self.config.get('encryption', {})
        self.encrypted_store = EncryptedLogStore(
            store_id=encryption_config.get('store_id', 'rover_encrypted'),
            storage_path=encryption_config.get('storage_path', '/var/log/rover/encrypted'),
            key_store_path=encryption_config.get('key_store_path', '/var/log/rover/keys/master.key'),
            rotation_interval_days=encryption_config.get('rotation_interval_days', 30)
        )
        
    def _init_redundant_storage(self):
        """Initialize redundant storage"""
        storage_config = self.config.get('redundant_storage', {})
        
        # Create storage locations
        locations = []
        for loc_config in storage_config.get('locations', []):
            location = StorageLocation(
                id=loc_config['id'],
                type=loc_config['type'],
                config=loc_config['config'],
                priority=loc_config.get('priority', 10)
            )
            locations.append(location)
            
        # Default local storage if none configured
        if not locations:
            locations.append(StorageLocation(
                id='local_primary',
                type='local',
                config={'path': '/var/log/rover/redundant/primary'},
                priority=1
            ))
            
        self.redundant_storage = RedundantStorageManager(
            manager_id='rover_redundant',
            locations=locations,
            replication_factor=storage_config.get('replication_factor', 3),
            consistency_check_interval=storage_config.get('consistency_check_interval', 3600)
        )
        
    def _init_notifications(self):
        """Initialize notification manager"""
        notification_config = self.config.get('notifications', {})
        
        self.notification_manager = NotificationManager(
            db_path=notification_config.get('db_path', '/var/log/rover/notifications.db'),
            max_workers=notification_config.get('max_workers', 10)
        )
        
        # Add channels
        channels = notification_config.get('channels', {})
        
        # Email channel
        if 'email' in channels:
            email_config = channels['email']
            self.notification_manager.add_channel(
                'email',
                EmailChannel(**email_config)
            )
            
        # SMS channel
        if 'sms' in channels:
            sms_config = channels['sms']
            self.notification_manager.add_channel(
                'sms',
                SMSChannel(**sms_config)
            )
            
        # Webhook channel
        if 'webhook' in channels:
            self.notification_manager.add_channel(
                'webhook',
                WebhookChannel(**channels['webhook'])
            )
            
        # Slack channel
        if 'slack' in channels:
            slack_config = channels['slack']
            self.notification_manager.add_channel(
                'slack',
                SlackChannel(**slack_config)
            )
            
        # Add rules
        for rule_config in notification_config.get('rules', []):
            rule = NotificationRule(**rule_config)
            self.notification_manager.add_rule(rule)
            
    def _init_compliance(self):
        """Initialize compliance reporter"""
        compliance_config = self.config.get('compliance', {})
        self.compliance_reporter = ComplianceReporter(
            db_path=compliance_config.get('db_path', '/var/log/rover/compliance.db'),
            evidence_path=compliance_config.get('evidence_path', '/var/log/rover/compliance/evidence')
        )
        
    def _init_forensics(self):
        """Initialize forensic analyzer"""
        forensics_config = self.config.get('forensics', {})
        self.forensic_analyzer = ForensicAnalyzer(
            db_path=forensics_config.get('db_path', '/var/log/rover/forensics.db'),
            artifacts_path=forensics_config.get('artifacts_path', '/var/log/rover/forensics/artifacts')
        )
        
    def _init_siem(self):
        """Initialize SIEM integration"""
        siem_config = self.config.get('siem', {})
        self.siem_integration = SIEMIntegration()
        
        # Add connectors
        connectors = siem_config.get('connectors', {})
        
        # Syslog
        if 'syslog' in connectors:
            self.siem_integration.add_connector(
                'syslog',
                SyslogConnector(**connectors['syslog'])
            )
            
        # Splunk
        if 'splunk' in connectors:
            self.siem_integration.add_connector(
                'splunk',
                SplunkConnector(**connectors['splunk'])
            )
            
        # Elasticsearch
        if 'elasticsearch' in connectors:
            self.siem_integration.add_connector(
                'elasticsearch',
                ElasticConnector(**connectors['elasticsearch'])
            )
            
        # ArcSight
        if 'arcsight' in connectors:
            self.siem_integration.add_connector(
                'arcsight',
                ArcSightConnector(**connectors['arcsight'])
            )
            
    async def log_event(self,
                       event_type: str,
                       severity: str,
                       data: Dict[str, Any],
                       actor: Optional[str] = None,
                       correlation_id: Optional[str] = None,
                       notify: bool = True,
                       compliance_evidence: bool = False) -> str:
        """
        Log security event through all systems
        
        Args:
            event_type: Type of event
            severity: Severity level
            data: Event data
            actor: User or system that triggered event
            correlation_id: Correlation ID
            notify: Whether to send notifications
            compliance_evidence: Whether to store as compliance evidence
            
        Returns:
            Event ID
        """
        # Generate event ID
        event_id = f"EVT-{datetime.now().timestamp()}"
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Create full event
        full_event = {
            'event_id': event_id,
            'timestamp': timestamp,
            'event_type': event_type,
            'severity': severity,
            'actor': actor,
            'correlation_id': correlation_id,
            'data': data
        }
        
        # Queue for processing
        await self.event_queue.put(full_event)
        
        # Process immediately for critical events
        if severity == 'critical':
            await self._process_event(full_event, notify, compliance_evidence)
            
        return event_id
        
    async def _process_event(self,
                           event: Dict[str, Any],
                           notify: bool = True,
                           compliance_evidence: bool = False):
        """Process single event through all systems"""
        
        # 1. Add to hash chain (tamper-proof)
        hash_entry = self.hash_chain.add_entry(
            event_type=event['event_type'],
            severity=event['severity'],
            data=event['data'],
            actor=event.get('actor'),
            correlation_id=event.get('correlation_id')
        )
        
        # 2. Encrypt and store
        encrypted_id = self.encrypted_store.encrypt_log(
            log_data=event,
            event_type=event['event_type'],
            severity=event['severity'],
            actor=event.get('actor'),
            correlation_id=event.get('correlation_id')
        )
        
        # 3. Redundant storage
        event_json = json.dumps(event).encode()
        storage_path = f"events/{event['event_id']}.json"
        success, locations = self.redundant_storage.write_redundant(
            storage_path, event_json
        )
        
        # 4. SIEM integration
        severity_map = {
            'critical': 2,
            'high': 3,
            'medium': 4,
            'low': 5,
            'info': 6
        }
        
        await self.siem_integration.send_event(
            event_data=event,
            severity=severity_map.get(event['severity'], 6)
        )
        
        # 5. Notifications
        if notify:
            notification_event = NotificationEvent(
                id=event['event_id'],
                timestamp=event['timestamp'],
                event_type=event['event_type'],
                severity=event['severity'],
                title=f"{event['severity'].upper()}: {event['event_type']}",
                description=event['data'].get('message', 'Security event occurred'),
                data=event['data'],
                actor=event.get('actor'),
                correlation_id=event.get('correlation_id'),
                source_system='rover_security'
            )
            
            await self.notification_manager.notify(notification_event)
            
        # 6. Compliance evidence
        if compliance_evidence and event['event_type'] in self.config.get('compliance_events', []):
            # Map event to control
            control_mapping = self.config.get('compliance_control_mapping', {})
            control_id = control_mapping.get(event['event_type'])
            
            if control_id:
                self.compliance_reporter.add_control_evidence(
                    control_id=control_id,
                    evidence_type='automated_log',
                    description=f"Security event: {event['event_type']}",
                    collector='secure_logging_service',
                    metadata={
                        'event_id': event['event_id'],
                        'hash_index': hash_entry.index,
                        'encrypted_id': encrypted_id
                    }
                )
                
    async def start(self):
        """Start secure logging service"""
        self.running = True
        
        # Start components
        await self.siem_integration.start()
        
        # Start workers
        num_workers = self.config.get('num_workers', 5)
        for i in range(num_workers):
            worker = asyncio.create_task(self._event_worker())
            self.workers.append(worker)
            
    async def stop(self):
        """Stop secure logging service"""
        self.running = False
        
        # Stop components
        await self.siem_integration.stop()
        self.notification_manager.shutdown()
        
        # Wait for workers
        await asyncio.gather(*self.workers, return_exceptions=True)
        
    async def _event_worker(self):
        """Worker to process events"""
        while self.running:
            try:
                # Get event with timeout
                event = await asyncio.wait_for(
                    self.event_queue.get(),
                    timeout=1.0
                )
                
                # Process event
                await self._process_event(event)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Event worker error: {e}")
                
    def verify_integrity(self, start_index: int = 0) -> Dict[str, Any]:
        """Verify system integrity"""
        results = {
            'hash_chain': self.hash_chain.verify_chain(start_index),
            'storage_status': self.redundant_storage.get_status(),
            'siem_status': self.siem_integration.get_status()
        }
        
        return results
        
    def generate_compliance_report(self,
                                 framework_id: str,
                                 start_date: datetime,
                                 end_date: datetime) -> bytes:
        """Generate compliance report"""
        return self.compliance_reporter.generate_compliance_report(
            framework_id=framework_id,
            start_date=start_date,
            end_date=end_date,
            output_format='pdf'
        )
        
    def analyze_incident(self,
                        log_sources: List[str],
                        start_time: datetime,
                        end_time: datetime,
                        incident_title: str) -> Dict[str, Any]:
        """Analyze security incident"""
        # Create incident
        incident_id = self.forensic_analyzer.create_incident(
            title=incident_title,
            severity='high',
            reported_by='secure_logging_service'
        )
        
        # Analyze logs
        analysis = self.forensic_analyzer.analyze_logs(
            log_sources=log_sources,
            start_time=start_time,
            end_time=end_time,
            incident_id=incident_id
        )
        
        return {
            'incident_id': incident_id,
            'analysis': analysis
        }
        
    def export_logs(self,
                   start_time: datetime,
                   end_time: datetime,
                   output_path: str,
                   include_encrypted: bool = False):
        """Export logs for specified period"""
        # Get hash chain entries
        entries = self.hash_chain.get_entries(
            start_time=start_time,
            end_time=end_time
        )
        
        # Get encrypted logs if requested
        encrypted_logs = []
        if include_encrypted:
            encrypted_meta = self.encrypted_store.search_logs(
                start_time=start_time,
                end_time=end_time
            )
            
            for meta in encrypted_meta:
                try:
                    decrypted = self.encrypted_store.decrypt_log(meta['id'])
                    encrypted_logs.append({
                        'id': meta['id'],
                        'metadata': meta,
                        'data': decrypted
                    })
                except:
                    encrypted_logs.append({
                        'id': meta['id'],
                        'metadata': meta,
                        'error': 'Decryption failed'
                    })
                    
        # Export data
        export_data = {
            'export_time': datetime.now(timezone.utc).isoformat(),
            'period': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat()
            },
            'hash_chain': {
                'entries': [asdict(e) for e in entries],
                'merkle_root': self.hash_chain.get_merkle_root()
            },
            'encrypted_logs': encrypted_logs
        }
        
        # Save to file
        with open(output_path, 'w') as f:
            json.dump(export_data, f, indent=2)


# Example configuration
EXAMPLE_CONFIG = {
    'hash_chain': {
        'chain_id': 'rover_security',
        'storage_path': '/var/log/rover/hashchain',
        'difficulty': 4
    },
    'encryption': {
        'store_id': 'rover_encrypted',
        'storage_path': '/var/log/rover/encrypted',
        'key_store_path': '/var/log/rover/keys/master.key',
        'rotation_interval_days': 30
    },
    'redundant_storage': {
        'locations': [
            {
                'id': 'local_primary',
                'type': 'local',
                'config': {'path': '/var/log/rover/redundant/primary'},
                'priority': 1
            },
            {
                'id': 's3_backup',
                'type': 's3',
                'config': {
                    'bucket': 'rover-logs-backup',
                    'prefix': 'secure-logs',
                    'region': 'us-east-1'
                },
                'priority': 2
            }
        ],
        'replication_factor': 2,
        'consistency_check_interval': 3600
    },
    'notifications': {
        'channels': {
            'email': {
                'smtp_host': 'smtp.gmail.com',
                'smtp_port': 587,
                'smtp_user': 'alerts@rover.com',
                'smtp_password': 'secure_password',
                'from_address': 'alerts@rover.com',
                'use_tls': True
            },
            'slack': {
                'webhook_url': 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
            }
        },
        'rules': [
            {
                'id': 'critical_events',
                'name': 'Critical Security Events',
                'event_types': ['emergency_stop', 'auth_failure', 'system_breach'],
                'severity_levels': ['critical', 'high'],
                'channels': ['email', 'slack'],
                'recipients': {
                    'email': ['security@rover.com', 'ops@rover.com'],
                    'slack': ['#security-alerts']
                },
                'template_id': 'default',
                'cooldown_minutes': 5,
                'max_notifications_per_hour': 20
            }
        ]
    },
    'compliance': {
        'db_path': '/var/log/rover/compliance.db',
        'evidence_path': '/var/log/rover/compliance/evidence'
    },
    'forensics': {
        'db_path': '/var/log/rover/forensics.db',
        'artifacts_path': '/var/log/rover/forensics/artifacts'
    },
    'siem': {
        'connectors': {
            'syslog': {
                'host': 'siem.rover.com',
                'port': 514,
                'transport': 'tcp',
                'use_tls': True
            },
            'splunk': {
                'hec_url': 'https://splunk.rover.com:8088/services/collector',
                'hec_token': 'your-hec-token',
                'index': 'rover_security'
            }
        }
    },
    'compliance_events': [
        'emergency_stop',
        'auth_failure',
        'permission_change',
        'data_export',
        'system_access'
    ],
    'compliance_control_mapping': {
        'emergency_stop': 'ISO27001-A.16.1',
        'auth_failure': 'ISO27001-A.8.1',
        'permission_change': 'ISO27001-A.8.1',
        'data_export': 'ISO27001-A.12.3'
    },
    'num_workers': 5
}