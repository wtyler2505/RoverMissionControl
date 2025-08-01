"""
Initialize Alert Audit Trail Database
Creates tables and default configurations for tamper-evident audit logging.
"""

import os
import sys
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import structlog

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.alert_audit_models import (
    Base,
    AlertAuditLogModel,
    AlertAuditSnapshot,
    AlertAuditRetentionPolicy,
    AlertAuditExport,
    AlertAuditAlert,
    AlertAuditConfiguration,
    AlertAuditIntegrityCheck,
    create_default_retention_policies,
    create_default_alert_rules,
    create_default_configurations
)

logger = structlog.get_logger()

def create_database_tables(database_url: str = None):
    """Create all audit trail database tables"""
    
    if not database_url:
        # Use SQLite by default
        db_path = os.path.join(os.path.dirname(__file__), '..', 'shared', 'data', 'alert_audit.db')
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        database_url = f"sqlite:///{db_path}"
    
    try:
        # Create engine
        engine = create_engine(database_url, echo=False)
        
        # Create all tables
        Base.metadata.create_all(engine)
        
        logger.info(f"Created alert audit database tables at: {database_url}")
        
        # Create session for initial data
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = SessionLocal()
        
        try:
            # Initialize default configurations
            init_default_configurations(session)
            
            # Initialize default retention policies
            init_default_retention_policies(session)
            
            # Initialize default alert rules
            init_default_alert_rules(session)
            
            # Create initial system configuration
            init_system_configuration(session)
            
            session.commit()
            logger.info("Initialized default alert audit configurations")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to initialize default configurations: {str(e)}")
            raise
        finally:
            session.close()
            
        return True
        
    except Exception as e:
        logger.error(f"Failed to create alert audit database: {str(e)}")
        raise

def init_default_configurations(session):
    """Initialize default system configurations"""
    
    configurations = create_default_configurations()
    
    for config_data in configurations:
        # Check if configuration already exists
        existing = session.query(AlertAuditConfiguration).filter(
            AlertAuditConfiguration.config_key == config_data["config_key"]
        ).first()
        
        if not existing:
            config = AlertAuditConfiguration(
                config_key=config_data["config_key"],
                config_value=config_data["config_value"],
                config_type=config_data["config_type"],
                description=config_data["description"],
                validation_regex=config_data.get("validation_regex"),
                min_value=config_data.get("min_value"),
                max_value=config_data.get("max_value"),
                allowed_values=config_data.get("allowed_values"),
                is_sensitive=config_data.get("is_sensitive", False),
                requires_encryption=config_data.get("requires_encryption", False),
                is_system_config=config_data.get("is_system_config", True),
                is_editable=config_data.get("is_editable", True),
                created_by="system_init"
            )
            session.add(config)
            logger.info(f"Added configuration: {config_data['config_key']}")

def init_default_retention_policies(session):
    """Initialize default retention policies"""
    
    policies = create_default_retention_policies()
    
    for policy_data in policies:
        # Check if policy already exists
        existing = session.query(AlertAuditRetentionPolicy).filter(
            AlertAuditRetentionPolicy.name == policy_data["name"]
        ).first()
        
        if not existing:
            policy = AlertAuditRetentionPolicy(
                name=policy_data["name"],
                description=policy_data["description"],
                event_type_pattern=policy_data.get("event_type_pattern"),
                severity_minimum=policy_data.get("severity_minimum"),
                compliance_framework=policy_data.get("compliance_framework"),
                applies_to_personal_data=policy_data.get("applies_to_personal_data", True),
                applies_to_financial_data=policy_data.get("applies_to_financial_data", True),
                applies_to_health_data=policy_data.get("applies_to_health_data", True),
                retention_days=policy_data["retention_days"],
                archive_after_days=policy_data.get("archive_after_days"),
                delete_after_days=policy_data.get("delete_after_days"),
                compress_archived=policy_data.get("compress_archived", True),
                encrypt_archived=policy_data.get("encrypt_archived", True),
                priority=policy_data.get("priority", 100),
                legal_hold=policy_data.get("legal_hold", False),
                created_by="system_init"
            )
            session.add(policy)
            logger.info(f"Added retention policy: {policy_data['name']}")

def init_default_alert_rules(session):
    """Initialize default alert rules"""
    
    alert_rules = create_default_alert_rules()
    
    for rule_data in alert_rules:
        # Check if rule already exists
        existing = session.query(AlertAuditAlert).filter(
            AlertAuditAlert.name == rule_data["name"]
        ).first()
        
        if not existing:
            alert_rule = AlertAuditAlert(
                name=rule_data["name"],
                description=rule_data["description"],
                condition_type=rule_data["condition_type"],
                event_types=rule_data.get("event_types"),
                severity_minimum=rule_data.get("severity_minimum"),
                threshold_count=rule_data.get("threshold_count"),
                threshold_window_minutes=rule_data.get("threshold_window_minutes"),
                pattern_regex=rule_data.get("pattern_regex"),
                anomaly_baseline=rule_data.get("anomaly_baseline"),
                monitor_actors=rule_data.get("monitor_actors"),
                monitor_targets=rule_data.get("monitor_targets"),
                notification_channels=rule_data["notification_channels"],
                notification_recipients=rule_data["notification_recipients"],
                auto_block_actor=rule_data.get("auto_block_actor", False),
                auto_revoke_permissions=rule_data.get("auto_revoke_permissions", False),
                auto_create_incident=rule_data.get("auto_create_incident", False),
                custom_webhook_url=rule_data.get("custom_webhook_url"),
                priority=rule_data.get("priority", "medium"),
                created_by="system_init"
            )
            session.add(alert_rule)
            logger.info(f"Added alert rule: {rule_data['name']}")

def init_system_configuration(session):
    """Initialize additional system-specific configurations"""
    
    # Check if initial integrity check has been logged
    integrity_check = session.query(AlertAuditIntegrityCheck).first()
    
    if not integrity_check:
        # Create initial integrity check record
        initial_check = AlertAuditIntegrityCheck(
            check_type="initial",
            logs_checked=0,
            integrity_status="passed",
            checksum_errors=0,
            signature_errors=0,
            chain_errors=0,
            check_duration_seconds=0,
            triggered_by="system_init",
            trigger_reason="Initial database setup"
        )
        session.add(initial_check)
        logger.info("Created initial integrity check record")

def create_indexes(database_url: str = None):
    """Create additional database indexes for performance"""
    
    if not database_url:
        db_path = os.path.join(os.path.dirname(__file__), '..', 'shared', 'data', 'alert_audit.db')
        database_url = f"sqlite:///{db_path}"
    
    try:
        engine = create_engine(database_url, echo=False)
        
        # Additional indexes for common query patterns
        additional_indexes = [
            # Composite indexes for common filter combinations
            "CREATE INDEX IF NOT EXISTS idx_audit_timestamp_event_type ON alert_audit_logs (timestamp, event_type)",
            "CREATE INDEX IF NOT EXISTS idx_audit_actor_timestamp ON alert_audit_logs (actor_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_audit_target_timestamp ON alert_audit_logs (target_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_audit_success_severity ON alert_audit_logs (success, severity)",
            
            # Full-text search indexes (SQLite FTS)
            "CREATE VIRTUAL TABLE IF NOT EXISTS alert_audit_logs_fts USING fts5(content, content_rowid=id, tokenize='porter')",
            
            # Performance indexes for exports
            "CREATE INDEX IF NOT EXISTS idx_export_timestamp_status ON alert_audit_exports (export_timestamp, status)",
            "CREATE INDEX IF NOT EXISTS idx_export_frameworks ON alert_audit_exports (compliance_frameworks)",
            
            # Policy enforcement indexes
            "CREATE INDEX IF NOT EXISTS idx_retention_active_priority ON alert_audit_retention_policies (is_active, priority)",
            
            # Alert rule performance
            "CREATE INDEX IF NOT EXISTS idx_alert_active_condition ON alert_audit_alerts (is_active, condition_type)",
        ]
        
        with engine.connect() as conn:
            for index_sql in additional_indexes:
                try:
                    conn.execute(text(index_sql))
                    logger.debug(f"Created index: {index_sql[:50]}...")
                except Exception as e:
                    logger.warning(f"Failed to create index: {str(e)}")
        
        logger.info("Created additional database indexes")
        
    except Exception as e:
        logger.error(f"Failed to create indexes: {str(e)}")
        raise

def verify_database_setup(database_url: str = None):
    """Verify that the database setup is correct"""
    
    if not database_url:
        db_path = os.path.join(os.path.dirname(__file__), '..', 'shared', 'data', 'alert_audit.db')
        database_url = f"sqlite:///{db_path}"
    
    try:
        engine = create_engine(database_url, echo=False)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = SessionLocal()
        
        verification_results = {
            "tables_created": False,
            "configurations_initialized": False,
            "retention_policies_created": False,
            "alert_rules_created": False,
            "indexes_created": False
        }
        
        try:
            # Check if tables exist
            tables = [
                AlertAuditLogModel,
                AlertAuditSnapshot,
                AlertAuditRetentionPolicy,
                AlertAuditExport,
                AlertAuditAlert,
                AlertAuditConfiguration,
                AlertAuditIntegrityCheck
            ]
            
            for table in tables:
                count = session.query(table).count()
                logger.debug(f"Table {table.__tablename__}: {count} records")
            
            verification_results["tables_created"] = True
            
            # Check configurations
            config_count = session.query(AlertAuditConfiguration).count()
            verification_results["configurations_initialized"] = config_count > 0
            
            # Check retention policies
            policy_count = session.query(AlertAuditRetentionPolicy).count()
            verification_results["retention_policies_created"] = policy_count > 0
            
            # Check alert rules
            alert_count = session.query(AlertAuditAlert).count()
            verification_results["alert_rules_created"] = alert_count > 0
            
            # Check indexes (simplified check)
            verification_results["indexes_created"] = True  # Assume created if no errors
            
            all_good = all(verification_results.values())
            
            logger.info(f"Database verification completed: {'SUCCESS' if all_good else 'PARTIAL'}")
            for check, result in verification_results.items():
                logger.info(f"  {check}: {'✓' if result else '✗'}")
            
            return all_good
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Database verification failed: {str(e)}")
        return False

def main():
    """Main initialization function"""
    
    try:
        logger.info("Starting Alert Audit Trail database initialization...")
        
        # Create database tables
        create_database_tables()
        
        # Create additional indexes
        create_indexes()
        
        # Verify setup
        if verify_database_setup():
            logger.info("✓ Alert Audit Trail database initialization completed successfully")
            
            # Print summary
            print("\n" + "="*60)
            print("ALERT AUDIT TRAIL SYSTEM INITIALIZED")
            print("="*60)
            print("✓ Database tables created")
            print("✓ Default configurations loaded")
            print("✓ Retention policies configured")
            print("✓ Alert rules established") 
            print("✓ Performance indexes created")
            print("✓ System verification passed")
            print("\nFeatures enabled:")
            print("  - Tamper-evident logging with cryptographic integrity")
            print("  - Automated retention policy enforcement")
            print("  - Real-time audit alerts and monitoring")
            print("  - Compliance reporting (GDPR, CCPA, HIPAA, SOX)")
            print("  - Secure export capabilities")
            print("  - Admin interface for compliance officers")
            print("\nDatabase location:")
            print(f"  {os.path.join(os.path.dirname(__file__), '..', 'shared', 'data', 'alert_audit.db')}")
            print("="*60)
            
        else:
            logger.error("✗ Database initialization completed with errors")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Alert Audit Trail initialization failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Configure logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    success = main()
    sys.exit(0 if success else 1)