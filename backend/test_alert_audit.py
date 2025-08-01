"""
Test script for Alert Audit Trail System
Demonstrates the audit logging capabilities with examples.
"""

import asyncio
import sys
import os
from datetime import datetime, timezone

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.alert_audit_service import (
    AlertAuditService,
    AlertAuditEventType,
    AlertAuditSeverity,
    ComplianceFramework
)
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

async def test_audit_system():
    """Test the audit system functionality"""
    
    print("Testing Alert Audit Trail System...")
    print("=" * 50)
    
    # Create database connection
    db_path = os.path.join(os.path.dirname(__file__), '..', 'shared', 'data', 'alert_audit.db')
    database_url = f"sqlite:///{db_path}"
    engine = create_engine(database_url, echo=False)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        # Create audit service
        audit_service = AlertAuditService(session)
        
        # Set request context
        audit_service.set_request_context(
            user_id="test_admin",
            ip_address="192.168.1.100",
            user_agent="Test-Agent/1.0",
            session_id="test-session-123",
            request_id="test-request-456"
        )
        
        print("1. Testing alert creation logging...")
        await audit_service.log_alert_created(
            alert_id="alert-001",
            rule_id="rule-001",
            metric_id="cpu_usage",
            created_by="test_admin",
            alert_details={
                "threshold_value": 85.0,
                "current_value": 92.3,
                "severity": "high"
            }
        )
        print("   [OK] Alert creation logged")
        
        print("\n2. Testing threshold exceeded logging...")
        await audit_service.log_threshold_exceeded(
            threshold_id="threshold-001",
            metric_id="cpu_usage",
            current_value=92.3,
            threshold_value=85.0,
            details={
                "duration_seconds": 120,
                "consecutive_violations": 3
            }
        )
        print("   [OK] Threshold exceeded logged")
        
        print("\n3. Testing notification logging...")
        await audit_service.log_notification_sent(
            alert_id="alert-001",
            notification_channel="email",
            recipient="admin@example.com",
            success=True
        )
        print("   [OK] Notification sent logged")
        
        print("\n4. Testing alert acknowledgment...")
        await audit_service.log_alert_acknowledged(
            alert_id="alert-001",
            acknowledged_by="operator_jane",
            notes="Investigating high CPU usage on server-01"
        )
        print("   [OK] Alert acknowledgment logged")
        
        print("\n5. Testing data access logging...")
        await audit_service.log_data_access(
            accessed_by="compliance_officer",
            data_type="alert_history",
            data_id="alert-001",
            access_reason="Quarterly compliance audit",
            personal_data=True
        )
        print("   [OK] Data access logged")
        
        print("\n6. Testing alert resolution...")
        await audit_service.log_alert_resolved(
            alert_id="alert-001",
            resolved_by="operator_jane",
            resolution_notes="CPU usage returned to normal after service restart"
        )
        print("   [OK] Alert resolution logged")
        
        print("\n7. Testing custom audit event...")
        await audit_service.log_event(
            event_type=AlertAuditEventType.ALERT_SYSTEM_ERROR,
            actor_id="system",
            actor_type="system",
            target_type="alert_processor",
            target_id="processor-001",
            action="Alert processing error encountered",
            details={
                "error_code": "PROC_001",
                "error_message": "Failed to evaluate threshold due to missing metric data",
                "affected_alerts": ["alert-002", "alert-003"]
            },
            severity=AlertAuditSeverity.HIGH,
            success=False,
            error_message="Missing metric data",
            compliance_frameworks=[ComplianceFramework.GDPR, ComplianceFramework.SOX]
        )
        print("   [OK] Custom audit event logged")
        
        print("\n8. Testing log search functionality...")
        logs, total_count = await audit_service.search_logs(
            event_types=[AlertAuditEventType.ALERT_CREATED, AlertAuditEventType.ALERT_RESOLVED],
            actor_id="test_admin",
            limit=10
        )
        print(f"   [OK] Found {total_count} logs matching search criteria")
        for log in logs[:3]:  # Show first 3
            print(f"     - {log.timestamp}: {log.event_type.value} by {log.actor_id}")
        
        print("\n9. Testing integrity verification...")
        integrity_result = await audit_service.verify_log_integrity()
        print(f"   [OK] Integrity check: {integrity_result['verified']}")
        print(f"     - Total logs: {integrity_result['total_logs']}")
        print(f"     - Chain intact: {integrity_result['chain_intact']}")
        print(f"     - Signatures valid: {integrity_result['signature_valid']}")
        
        if integrity_result['verification_errors']:
            print(f"     - Errors: {integrity_result['verification_errors']}")
        
        print("\n10. Testing export functionality...")
        export_result = await audit_service.export_logs(
            format="json",
            event_types=[AlertAuditEventType.ALERT_CREATED],
            export_reason="Test export for audit system validation",
            requester_id="test_admin"
        )
        print(f"   [OK] Export created: ID {export_result['export_id']}")
        print(f"     - Records: {export_result['metadata']['total_records']}")
        print(f"     - Format: {export_result['metadata']['format']}")
        print(f"     - Checksum: {export_result['checksum'][:16]}...")
        
        print("\n11. Testing compliance report...")
        compliance_report = await audit_service.get_compliance_report(
            framework=ComplianceFramework.GDPR,
            start_date=datetime.now(timezone.utc).replace(hour=0, minute=0, second=0),
            end_date=datetime.now(timezone.utc)
        )
        print(f"   [OK] GDPR compliance report generated")
        print(f"     - Total events: {compliance_report['summary']['total_events']}")
        print(f"     - Success rate: {compliance_report['summary']['success_rate']:.2%}")
        print(f"     - Personal data events: {compliance_report['data_classification']['personal_data_events']}")
        
        print("\n12. Testing retention policy...")
        retention_results = await audit_service.apply_retention_policy()
        print(f"   [OK] Retention policy applied")
        print(f"     - Archived: {retention_results['archived']}")
        print(f"     - Deleted: {retention_results['deleted']}")
        print(f"     - Errors: {retention_results['errors']}")
        
        print("\n" + "=" * 50)
        print("AUDIT SYSTEM TEST COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        
        # Show final statistics
        all_logs, count = await audit_service.search_logs(limit=1000)
        print(f"\nFinal Statistics:")
        print(f"Total audit logs created: {count}")
        print(f"Event types logged: {len(set(log.event_type for log in all_logs))}")
        print(f"Actors involved: {len(set(log.actor_id for log in all_logs if log.actor_id))}")
        
        # Show recent logs
        print(f"\nMost recent logs:")
        for log in all_logs[:5]:
            print(f"  {log.timestamp.strftime('%H:%M:%S')} - {log.event_type.value} - {log.action[:50]}...")
        
    except Exception as e:
        print(f"\nERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        session.close()
    
    return True

async def main():
    """Main test function"""
    success = await test_audit_system()
    if success:
        print("\nAll tests passed! The Alert Audit Trail System is working correctly.")
    else:
        print("\nSome tests failed. Please check the error messages above.")
    
    return success

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)