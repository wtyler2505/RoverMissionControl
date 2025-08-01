"""
Tests for Compliance Validation and Reporting System
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, AsyncMock, patch
from sqlalchemy.orm import Session

from backend.services.compliance_validation_service import (
    ComplianceValidationService,
    ComplianceCheckType,
    ComplianceRiskLevel,
    ComplianceReport,
    PrivacyRequest,
    ReportFormat
)
from backend.services.alert_audit_service import AlertAuditService, ComplianceFramework
from backend.services.scheduled_compliance_service import (
    ScheduledComplianceService,
    ScheduleType,
    AlertSeverity,
    ComplianceAlert,
    ScheduledAudit
)
from backend.models.privacy_policy import ComplianceStatus


class TestComplianceValidationService:
    """Test suite for ComplianceValidationService"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def mock_audit_service(self):
        """Mock audit service"""
        audit_service = Mock(spec=AlertAuditService)
        audit_service.log_event = AsyncMock()
        audit_service.verify_log_integrity = AsyncMock(return_value={
            "verified": True,
            "total_logs": 100,
            "verification_errors": [],
            "chain_intact": True,
            "signature_valid": True
        })
        return audit_service
    
    @pytest.fixture
    def compliance_service(self, mock_db, mock_audit_service):
        """Create compliance validation service"""
        return ComplianceValidationService(mock_db, mock_audit_service)
    
    @pytest.mark.asyncio
    async def test_comprehensive_compliance_check(self, compliance_service):
        """Test comprehensive compliance check execution"""
        
        # Mock privacy policy service
        with patch.object(compliance_service, 'privacy_policy_service') as mock_policy_service:
            mock_policy = Mock()
            mock_policy.created_date = datetime.now(timezone.utc) - timedelta(days=30)
            mock_policy_service.get_active_policy.return_value = mock_policy
            
            # Run compliance check
            report = await compliance_service.run_comprehensive_compliance_check(
                ComplianceFramework.GDPR
            )
            
            # Verify report structure
            assert isinstance(report, ComplianceReport)
            assert report.framework == ComplianceFramework.GDPR
            assert report.total_checks > 0
            assert 0 <= report.overall_score <= 100
            assert report.overall_status in [
                ComplianceStatus.COMPLIANT,
                ComplianceStatus.PARTIAL,
                ComplianceStatus.NON_COMPLIANT
            ]
            assert len(report.check_results) > 0
            
            # Verify all required checks are included
            check_types = [result.check_type for result in report.check_results]
            expected_checks = [
                ComplianceCheckType.CONSENT_MANAGEMENT,
                ComplianceCheckType.RETENTION_POLICY,
                ComplianceCheckType.DATA_SUBJECT_RIGHTS,
                ComplianceCheckType.AUDIT_TRAIL,
                ComplianceCheckType.DOCUMENTATION,
                ComplianceCheckType.SECURITY_MEASURES
            ]
            
            for expected_check in expected_checks:
                assert expected_check in check_types
    
    @pytest.mark.asyncio
    async def test_consent_management_check(self, compliance_service):
        """Test individual consent management check"""
        
        result = await compliance_service._check_consent_management()
        
        assert result.check_type == ComplianceCheckType.CONSENT_MANAGEMENT
        assert result.check_name == "Consent Management Compliance"
        assert result.status in [
            ComplianceStatus.COMPLIANT,
            ComplianceStatus.PARTIAL,
            ComplianceStatus.NON_COMPLIANT
        ]
        assert result.risk_level in [
            ComplianceRiskLevel.LOW,
            ComplianceRiskLevel.MEDIUM,
            ComplianceRiskLevel.HIGH,
            ComplianceRiskLevel.CRITICAL
        ]
        assert 0 <= result.score <= 100
        assert isinstance(result.recommendations, list)
        assert isinstance(result.evidence, list)
        assert result.last_checked is not None
    
    @pytest.mark.asyncio
    async def test_retention_policy_check(self, compliance_service):
        """Test retention policy compliance check"""
        
        result = await compliance_service._check_retention_policy()
        
        assert result.check_type == ComplianceCheckType.RETENTION_POLICY
        assert result.check_name == "Data Retention Policy Compliance"
        assert isinstance(result.details, dict)
        assert "total_possible_score" in result.details
        assert result.details["total_possible_score"] == 100
    
    @pytest.mark.asyncio
    async def test_data_subject_rights_check(self, compliance_service):
        """Test data subject rights implementation check"""
        
        result = await compliance_service._check_data_subject_rights()
        
        assert result.check_type == ComplianceCheckType.DATA_SUBJECT_RIGHTS
        assert result.check_name == "Data Subject Rights Implementation"
        
        # Verify all major rights are considered
        assert "access_right_score" in result.details
        assert "rectification_right_score" in result.details
        assert "erasure_right_score" in result.details
        assert "portability_right_score" in result.details
        assert "response_time_score" in result.details
    
    @pytest.mark.asyncio
    async def test_audit_trail_check(self, compliance_service, mock_audit_service):
        """Test audit trail integrity check"""
        
        result = await compliance_service._check_audit_trail()
        
        assert result.check_type == ComplianceCheckType.AUDIT_TRAIL
        assert result.check_name == "Audit Trail Completeness"
        
        # Verify audit service was called for integrity check
        mock_audit_service.verify_log_integrity.assert_called_once()
        
        # Verify integrity results are included
        assert "integrity_score" in result.details
        assert "total_logs_verified" in result.details
    
    @pytest.mark.asyncio
    async def test_documentation_check(self, compliance_service):
        """Test privacy documentation compliance check"""
        
        with patch.object(compliance_service, 'privacy_policy_service') as mock_policy_service:
            mock_policy = Mock()
            mock_policy.created_date = datetime.now(timezone.utc) - timedelta(days=30)
            mock_policy_service.get_active_policy.return_value = mock_policy
            
            result = await compliance_service._check_documentation()
            
            assert result.check_type == ComplianceCheckType.DOCUMENTATION
            assert result.check_name == "Privacy Documentation"
            assert "privacy_policy_score" in result.details
            assert "policy_age_days" in result.details
    
    @pytest.mark.asyncio
    async def test_security_measures_check(self, compliance_service):
        """Test security measures compliance check"""
        
        result = await compliance_service._check_security_measures()
        
        assert result.check_type == ComplianceCheckType.SECURITY_MEASURES
        assert result.check_name == "Technical and Organizational Measures"
        
        # Verify security measures are checked
        assert "encryption_at_rest_score" in result.details
        assert "encryption_in_transit_score" in result.details
        assert "access_controls_score" in result.details
        assert "security_monitoring_score" in result.details
    
    @pytest.mark.asyncio
    async def test_privacy_request_tracking(self, compliance_service):
        """Test privacy request tracking functionality"""
        
        # Create a privacy request
        request_id = await compliance_service.track_privacy_request(
            request_type="access",
            user_id="test@example.com",
            complexity_level="simple",
            data_categories=["Personal Identifiers", "Contact Information"],
            third_parties=[],
            notes="Test access request"
        )
        
        assert request_id is not None
        assert len(compliance_service.privacy_requests) == 1
        
        request = compliance_service.privacy_requests[0]
        assert request.request_id == request_id
        assert request.request_type == "access"
        assert request.user_id == "test@example.com"
        assert request.status == "pending"
    
    @pytest.mark.asyncio
    async def test_privacy_request_status_update(self, compliance_service):
        """Test privacy request status updates"""
        
        # Create a request
        request_id = await compliance_service.track_privacy_request(
            request_type="deletion",
            user_id="test@example.com"
        )
        
        # Update status to completed
        await compliance_service.update_privacy_request_status(
            request_id=request_id,
            status="completed",
            notes="Request processed successfully"
        )
        
        # Verify update
        request = compliance_service.privacy_requests[0]
        assert request.status == "completed"
        assert request.completed_at is not None
        assert request.response_time_hours is not None
        assert "Request processed successfully" in request.notes
    
    @pytest.mark.asyncio
    async def test_privacy_request_metrics(self, compliance_service):
        """Test privacy request metrics calculation"""
        
        # Create test requests
        await compliance_service.track_privacy_request("access", "user1@example.com")
        await compliance_service.track_privacy_request("deletion", "user2@example.com")
        await compliance_service.track_privacy_request("portability", "user3@example.com")
        
        # Update one to completed
        await compliance_service.update_privacy_request_status(
            compliance_service.privacy_requests[0].request_id,
            "completed"
        )
        
        # Get metrics
        start_date = datetime.now(timezone.utc) - timedelta(days=1)
        end_date = datetime.now(timezone.utc) + timedelta(days=1)
        
        metrics = await compliance_service.get_privacy_request_metrics(start_date, end_date)
        
        assert metrics["total_requests"] == 3
        assert metrics["completed_requests"] == 1
        assert metrics["pending_requests"] == 2
        assert metrics["completion_rate"] == 1/3
        assert "access" in metrics["requests_by_type"]
        assert "deletion" in metrics["requests_by_type"]
        assert "portability" in metrics["requests_by_type"]
    
    @pytest.mark.asyncio
    async def test_dashboard_data_generation(self, compliance_service):
        """Test compliance dashboard data generation"""
        
        # Generate test data
        await compliance_service.track_privacy_request("access", "user@example.com")
        
        dashboard_data = await compliance_service.get_compliance_dashboard_data()
        
        assert "last_audit_date" in dashboard_data
        assert "overall_compliance_score" in dashboard_data
        assert "overall_status" in dashboard_data
        assert "critical_issues" in dashboard_data
        assert "privacy_requests_last_30_days" in dashboard_data
        assert "average_response_time_hours" in dashboard_data
    
    def test_gdpr_requirements_loading(self, compliance_service):
        """Test GDPR requirements configuration loading"""
        
        requirements = compliance_service._load_gdpr_requirements()
        
        assert "lawfulness_of_processing" in requirements
        assert "consent_management" in requirements
        assert "data_subject_rights" in requirements
        assert "retention_policy" in requirements
        assert "audit_trail" in requirements
        assert "documentation" in requirements
        
        # Verify structure
        for requirement in requirements.values():
            assert "requirements" in requirement
            assert "evidence_required" in requirement
            assert isinstance(requirement["requirements"], list)
            assert isinstance(requirement["evidence_required"], list)


class TestScheduledComplianceService:
    """Test suite for ScheduledComplianceService"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)
    
    @pytest.fixture
    def mock_audit_service(self):
        """Mock audit service"""
        audit_service = Mock(spec=AlertAuditService)
        audit_service.log_event = AsyncMock()
        return audit_service
    
    @pytest.fixture
    def scheduled_service(self, mock_db, mock_audit_service):
        """Create scheduled compliance service"""
        service = ScheduledComplianceService(mock_db, mock_audit_service)
        # Stop scheduler to avoid background tasks in tests
        service.scheduler.shutdown(wait=False)
        return service
    
    def test_default_schedules_initialization(self, scheduled_service):
        """Test that default audit schedules are created"""
        
        assert len(scheduled_service.scheduled_audits) > 0
        
        # Check for expected default schedules
        schedule_names = [audit.name for audit in scheduled_service.scheduled_audits.values()]
        
        assert "Daily Security Check" in schedule_names
        assert "Weekly Retention Check" in schedule_names
        assert "Monthly Consent Check" in schedule_names
        assert "Quarterly Comprehensive Audit" in schedule_names
    
    @pytest.mark.asyncio
    async def test_create_audit_schedule(self, scheduled_service):
        """Test creating custom audit schedule"""
        
        audit_id = await scheduled_service.create_audit_schedule(
            name="Custom Test Audit",
            description="Test audit schedule",
            schedule_type=ScheduleType.DAILY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[ComplianceCheckType.CONSENT_MANAGEMENT],
            cron_expression="0 1 * * *",
            alert_recipients=["test@example.com"]
        )
        
        assert audit_id in scheduled_service.scheduled_audits
        
        audit = scheduled_service.scheduled_audits[audit_id]
        assert audit.name == "Custom Test Audit"
        assert audit.schedule_type == ScheduleType.DAILY
        assert audit.framework == ComplianceFramework.GDPR
        assert audit.enabled == True
        assert "test@example.com" in audit.alert_recipients
    
    @pytest.mark.asyncio
    async def test_update_audit_schedule(self, scheduled_service):
        """Test updating audit schedule"""
        
        # Create an audit first
        audit_id = await scheduled_service.create_audit_schedule(
            name="Test Audit",
            description="Test",
            schedule_type=ScheduleType.DAILY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[ComplianceCheckType.CONSENT_MANAGEMENT]
        )
        
        # Update it
        await scheduled_service.update_audit_schedule(
            audit_id=audit_id,
            enabled=False,
            alert_recipients=["updated@example.com"]
        )
        
        audit = scheduled_service.scheduled_audits[audit_id]
        assert audit.enabled == False
        assert "updated@example.com" in audit.alert_recipients
        assert audit.updated_at is not None
    
    @pytest.mark.asyncio
    async def test_delete_audit_schedule(self, scheduled_service):
        """Test deleting audit schedule"""
        
        # Create an audit
        audit_id = await scheduled_service.create_audit_schedule(
            name="Test Audit",
            description="Test",
            schedule_type=ScheduleType.DAILY,
            framework=ComplianceFramework.GDPR,
            checks_to_run=[ComplianceCheckType.CONSENT_MANAGEMENT]
        )
        
        # Verify it exists
        assert audit_id in scheduled_service.scheduled_audits
        
        # Delete it
        await scheduled_service.delete_audit_schedule(audit_id)
        
        # Verify it's gone
        assert audit_id not in scheduled_service.scheduled_audits
    
    @pytest.mark.asyncio
    async def test_compliance_alert_creation(self, scheduled_service):
        """Test compliance alert creation"""
        
        alert_id = await scheduled_service._create_compliance_alert(
            alert_type="test_alert",
            severity=AlertSeverity.WARNING,
            title="Test Alert",
            message="This is a test alert",
            compliance_check="Test Check",
            risk_level=ComplianceRiskLevel.MEDIUM,
            compliance_score=75.0
        )
        
        assert alert_id is not None
        assert len(scheduled_service.compliance_alerts) == 1
        
        alert = scheduled_service.compliance_alerts[0]
        assert alert.alert_id == alert_id
        assert alert.alert_type == "test_alert"
        assert alert.severity == AlertSeverity.WARNING
        assert alert.title == "Test Alert"
        assert alert.acknowledged == False
        assert alert.resolved == False
    
    @pytest.mark.asyncio
    async def test_alert_acknowledgment(self, scheduled_service):
        """Test alert acknowledgment"""
        
        # Create an alert
        alert_id = await scheduled_service._create_compliance_alert(
            alert_type="test_alert",
            severity=AlertSeverity.INFO,
            title="Test Alert",
            message="Test message"
        )
        
        # Acknowledge it
        result = await scheduled_service.acknowledge_alert(alert_id, "test_user")
        
        assert result == True
        
        alert = scheduled_service.compliance_alerts[0]
        assert alert.acknowledged == True
        assert alert.acknowledged_by == "test_user"
        assert alert.acknowledged_at is not None
    
    @pytest.mark.asyncio
    async def test_alert_resolution(self, scheduled_service):
        """Test alert resolution"""
        
        # Create an alert
        alert_id = await scheduled_service._create_compliance_alert(
            alert_type="test_alert",
            severity=AlertSeverity.CRITICAL,
            title="Critical Alert",
            message="Critical issue"
        )
        
        # Resolve it
        result = await scheduled_service.resolve_alert(alert_id, "admin_user")
        
        assert result == True
        
        alert = scheduled_service.compliance_alerts[0]
        assert alert.resolved == True
        assert alert.resolved_by == "admin_user"
        assert alert.resolved_at is not None
    
    def test_get_scheduled_audits(self, scheduled_service):
        """Test retrieving scheduled audits"""
        
        audits = scheduled_service.get_scheduled_audits()
        
        assert isinstance(audits, dict)
        assert len(audits) > 0
        
        # Verify structure
        for audit_id, audit_data in audits.items():
            assert "name" in audit_data
            assert "description" in audit_data
            assert "schedule_type" in audit_data
            assert "framework" in audit_data
            assert "enabled" in audit_data
    
    def test_get_compliance_alerts(self, scheduled_service):
        """Test retrieving compliance alerts with filtering"""
        
        # Create test alerts with different severities
        asyncio.run(scheduled_service._create_compliance_alert(
            "test1", AlertSeverity.CRITICAL, "Critical Alert", "Critical message"
        ))
        asyncio.run(scheduled_service._create_compliance_alert(
            "test2", AlertSeverity.WARNING, "Warning Alert", "Warning message"
        ))
        asyncio.run(scheduled_service._create_compliance_alert(
            "test3", AlertSeverity.INFO, "Info Alert", "Info message"
        ))
        
        # Get all alerts
        all_alerts = scheduled_service.get_compliance_alerts()
        assert len(all_alerts) == 3
        
        # Filter by severity
        critical_alerts = scheduled_service.get_compliance_alerts(severity=AlertSeverity.CRITICAL)
        assert len(critical_alerts) == 1
        assert critical_alerts[0]["severity"] == "critical"
        
        # Filter by acknowledged status
        unacknowledged_alerts = scheduled_service.get_compliance_alerts(acknowledged=False)
        assert len(unacknowledged_alerts) == 3
    
    @pytest.mark.asyncio
    async def test_compliance_summary(self, scheduled_service):
        """Test compliance summary generation"""
        
        # Create test data
        await scheduled_service._create_compliance_alert(
            "test1", AlertSeverity.CRITICAL, "Critical", "Critical issue"
        )
        await scheduled_service._create_compliance_alert(
            "test2", AlertSeverity.WARNING, "Warning", "Warning issue"
        )
        
        summary = await scheduled_service.get_compliance_summary()
        
        assert "alerts" in summary
        assert "audits" in summary
        assert "last_updated" in summary
        
        assert summary["alerts"]["total"] == 2
        assert summary["alerts"]["critical"] == 1
        assert summary["alerts"]["warning"] == 1
        assert summary["alerts"]["unacknowledged"] == 2
        assert summary["alerts"]["unresolved"] == 2
        
        assert summary["audits"]["total"] > 0
        assert "enabled" in summary["audits"]
        assert "disabled" in summary["audits"]
    
    def test_alert_cleanup(self, scheduled_service):
        """Test old alert cleanup"""
        
        # Create old alert
        old_alert = ComplianceAlert(
            alert_id="old_alert",
            alert_type="test",
            severity=AlertSeverity.INFO,
            title="Old Alert",
            message="Old message",
            created_at=datetime.now(timezone.utc) - timedelta(days=100),
            resolved=True
        )
        
        # Create recent alert
        recent_alert = ComplianceAlert(
            alert_id="recent_alert",
            alert_type="test",
            severity=AlertSeverity.INFO,
            title="Recent Alert",
            message="Recent message",
            created_at=datetime.now(timezone.utc) - timedelta(days=1)
        )
        
        scheduled_service.compliance_alerts = [old_alert, recent_alert]
        
        # Run cleanup
        asyncio.run(scheduled_service.cleanup_old_alerts())
        
        # Old resolved alert should be removed, recent unresolved should remain
        assert len(scheduled_service.compliance_alerts) == 1
        assert scheduled_service.compliance_alerts[0].alert_id == "recent_alert"


if __name__ == "__main__":
    pytest.main([__file__])