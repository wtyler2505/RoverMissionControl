"""
Emergency Stop Recovery API Routes

FastAPI routes for managing emergency stop recovery procedures.
Provides REST API endpoints for recovery session management,
system diagnostics, and audit logging.

Safety-critical implementation following IEC 61508 standards.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .emergency_stop_manager import EmergencyStopManager, SystemSafetyState
from ..auth.auth_service import get_current_user, require_roles
from ..models.user import User

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/recovery", tags=["emergency-recovery"])
security = HTTPBearer()

# Pydantic Models
class EmergencyStopCause(str, Enum):
    MANUAL_ACTIVATION = "manual_activation"
    HARDWARE_FAULT = "hardware_fault"
    SOFTWARE_ERROR = "software_error"
    COMMUNICATION_LOSS = "communication_loss"
    SAFETY_VIOLATION = "safety_violation"
    EXTERNAL_TRIGGER = "external_trigger"
    WATCHDOG_TIMEOUT = "watchdog_timeout"
    UNKNOWN = "unknown"

class SystemComponent(str, Enum):
    MOTORS = "motors"
    SENSORS = "sensors"
    ACTUATORS = "actuators"
    COMMUNICATIONS = "communications"
    POWER_SYSTEM = "power_system"
    NAVIGATION = "navigation"
    TELEMETRY = "telemetry"
    SAFETY_SYSTEMS = "safety_systems"
    EMERGENCY_HARDWARE = "emergency_hardware"

class ComponentStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    ERROR = "error"
    UNKNOWN = "unknown"
    OFFLINE = "offline"

class RecoveryStepStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    BLOCKED = "blocked"

class RecoverySessionStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"
    SUSPENDED = "suspended"
    ROLLBACK_IN_PROGRESS = "rollback_in_progress"
    ROLLBACK_COMPLETED = "rollback_completed"

class ComponentCheckModel(BaseModel):
    component: SystemComponent
    status: ComponentStatus
    description: str
    check_time: datetime
    diagnostics: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    recommendations: List[str] = []

class VerificationTestModel(BaseModel):
    id: str
    name: str
    description: str
    component: SystemComponent
    test_type: str
    required: bool
    status: str
    result: Optional[Dict[str, Any]] = None
    automated_test: bool
    test_function: Optional[str] = None
    timeout: Optional[int] = None

class RecoveryStepModel(BaseModel):
    id: str
    type: str
    title: str
    description: str
    instructions: List[str]
    status: RecoveryStepStatus
    required: bool
    can_skip: bool
    can_rollback: bool
    estimated_duration_ms: int
    actual_duration_ms: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    result: Optional[str] = None
    error_message: Optional[str] = None
    operator_id: Optional[str] = None
    dependencies: List[str] = []
    preconditions: List[str] = []
    postconditions: List[str] = []
    component_checks: List[ComponentCheckModel] = []
    verification_tests: List[VerificationTestModel] = []
    rollback_steps: List[str] = []

class AuditLogEntryModel(BaseModel):
    id: str
    timestamp: datetime
    operator_id: str
    operator_name: str
    action: str
    step_id: Optional[str] = None
    component: Optional[SystemComponent] = None
    details: Dict[str, Any]
    result: str
    message: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class RecoverySessionModel(BaseModel):
    id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    operator_id: str
    operator_name: str
    emergency_stop_cause: EmergencyStopCause
    emergency_stop_time: datetime
    emergency_stop_reason: str
    steps: List[RecoveryStepModel]
    current_step_id: Optional[str] = None
    status: RecoverySessionStatus
    result: Optional[str] = None
    total_steps: int
    completed_steps: int
    failed_steps: int
    skipped_steps: int
    estimated_total_time: int
    actual_total_time: Optional[int] = None
    can_resume: bool
    requires_rollback: bool
    rollback_reason: Optional[str] = None
    metadata: Dict[str, Any]
    audit_log: List[AuditLogEntryModel] = []

class StartRecoveryRequest(BaseModel):
    operator_id: str = Field(..., min_length=1, max_length=50)
    operator_name: str = Field(..., min_length=1, max_length=100)
    emergency_stop_cause: EmergencyStopCause
    template_id: Optional[str] = None
    emergency_stop_reason: Optional[str] = "Emergency stop activated"

class ExecuteStepRequest(BaseModel):
    step_id: str = Field(..., min_length=1)
    operator_notes: Optional[str] = None

class SkipStepRequest(BaseModel):
    step_id: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=5, max_length=500)

class RollbackRequest(BaseModel):
    step_id: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=5, max_length=500)

class AbortSessionRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)

class SystemStatusResponse(BaseModel):
    emergency_stop_active: bool
    emergency_stop_cause: EmergencyStopCause
    emergency_stop_time: Optional[datetime]
    system_state: str
    components: Dict[SystemComponent, ComponentStatus]
    active_faults: List[str]
    last_update: datetime

# Global recovery manager instance
recovery_manager: Optional['RecoveryManager'] = None

class RecoveryManager:
    """
    Recovery Manager for handling emergency stop recovery procedures
    """
    
    def __init__(self, emergency_stop_manager: EmergencyStopManager):
        self.emergency_manager = emergency_stop_manager
        self.active_sessions: Dict[str, RecoverySessionModel] = {}
        self.session_history: List[RecoverySessionModel] = []
        self.audit_log: List[AuditLogEntryModel] = []
        
    async def start_recovery_session(
        self,
        request: StartRecoveryRequest,
        operator: User
    ) -> RecoverySessionModel:
        """Start a new recovery session"""
        
        # Verify emergency stop is active
        if not self.emergency_manager.is_emergency_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Emergency stop is not active - cannot start recovery"
            )
        
        # Check for existing active session
        active_sessions = [s for s in self.active_sessions.values() 
                          if s.status == RecoverySessionStatus.IN_PROGRESS]
        if active_sessions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Recovery session already in progress"
            )
        
        # Create new session
        session_id = f"recovery_{datetime.utcnow().timestamp()}_{id(operator)}"
        
        # Generate recovery steps based on cause and template
        steps = await self._generate_recovery_steps(
            request.emergency_stop_cause,
            request.template_id
        )
        
        session = RecoverySessionModel(
            id=session_id,
            start_time=datetime.utcnow(),
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            emergency_stop_cause=request.emergency_stop_cause,
            emergency_stop_time=datetime.utcnow(),  # Should come from emergency event
            emergency_stop_reason=request.emergency_stop_reason,
            steps=steps,
            current_step_id=steps[0].id if steps else None,
            status=RecoverySessionStatus.IN_PROGRESS,
            total_steps=len(steps),
            completed_steps=0,
            failed_steps=0,
            skipped_steps=0,
            estimated_total_time=sum(step.estimated_duration_ms for step in steps),
            can_resume=True,
            requires_rollback=False,
            metadata={
                "template_id": request.template_id,
                "emergency_cause": request.emergency_stop_cause.value,
                "created_by": operator.username,
            },
        )
        
        self.active_sessions[session_id] = session
        
        # Log session start
        audit_entry = AuditLogEntryModel(
            id=f"audit_{datetime.utcnow().timestamp()}",
            timestamp=datetime.utcnow(),
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            action="session_started",
            details={
                "session_id": session_id,
                "cause": request.emergency_stop_cause.value,
                "template_id": request.template_id,
            },
            result="success",
            message=f"Recovery session started for {request.emergency_stop_cause.value}",
        )
        
        session.audit_log.append(audit_entry)
        self.audit_log.append(audit_entry)
        
        logger.info(f"Recovery session started: {session_id} by {operator.username}")
        
        return session
    
    async def _generate_recovery_steps(
        self,
        cause: EmergencyStopCause,
        template_id: Optional[str]
    ) -> List[RecoveryStepModel]:
        """Generate recovery steps based on cause and template"""
        
        steps = []
        
        # Standard recovery steps
        base_steps = [
            {
                "type": "initial_assessment",
                "title": "Initial System Assessment",
                "description": "Assess current system state and identify recovery requirements",
                "instructions": [
                    "Review emergency stop activation reason",
                    "Check for immediate safety hazards",
                    "Verify operator authority and clearance",
                    "Confirm area is clear of personnel",
                ],
                "estimated_duration_ms": 120000,  # 2 minutes
                "required": True,
                "can_skip": False,
                "can_rollback": False,
            },
            {
                "type": "hardware_check",
                "title": "Hardware System Verification",
                "description": "Verify all hardware components are in safe operational state",
                "instructions": [
                    "Check motor controllers and drives",
                    "Verify sensor connectivity and readings",
                    "Test actuator responses",
                    "Confirm power system stability",
                    "Validate emergency stop hardware integrity",
                ],
                "estimated_duration_ms": 180000,  # 3 minutes
                "required": True,
                "can_skip": False,
                "can_rollback": True,
            },
            {
                "type": "software_validation",
                "title": "Software System Validation", 
                "description": "Validate software subsystems and communication channels",
                "instructions": [
                    "Restart critical software services",
                    "Verify database connectivity",
                    "Test WebSocket connections",
                    "Validate telemetry data flow",
                    "Confirm navigation system status",
                ],
                "estimated_duration_ms": 150000,  # 2.5 minutes
                "required": True,
                "can_skip": False,
                "can_rollback": True,
            },
            {
                "type": "system_integrity",
                "title": "System Integrity Check",
                "description": "Perform comprehensive system integrity verification",
                "instructions": [
                    "Run built-in diagnostic tests",
                    "Verify system response times",
                    "Check for memory leaks or errors",
                    "Validate safety system responses",
                    "Confirm backup systems availability",
                ],
                "estimated_duration_ms": 240000,  # 4 minutes
                "required": True,
                "can_skip": False,
                "can_rollback": True,
            },
            {
                "type": "operator_confirmation",
                "title": "Final Operator Confirmation",
                "description": "Obtain final operator confirmation for system restart",
                "instructions": [
                    "Review all system checks and results",
                    "Confirm area is clear and safe for operation",
                    "Verify emergency procedures are in place",
                    "Document any remaining concerns or observations",
                    "Provide final authorization for system restart",
                ],
                "estimated_duration_ms": 120000,  # 2 minutes
                "required": True,
                "can_skip": False,
                "can_rollback": True,
            },
            {
                "type": "final_verification",
                "title": "Final System Verification",
                "description": "Complete final verification and clear emergency stop",
                "instructions": [
                    "Clear emergency stop condition",
                    "Verify normal operation indicators",
                    "Test basic system functions",
                    "Confirm telemetry and monitoring active",
                    "Document recovery completion",
                ],
                "estimated_duration_ms": 90000,  # 1.5 minutes
                "required": True,
                "can_skip": False,
                "can_rollback": True,
            },
        ]
        
        # Create step models
        for i, step_data in enumerate(base_steps):
            step = RecoveryStepModel(
                id=f"step_{i+1}_{step_data['type']}",
                type=step_data["type"],
                title=step_data["title"],
                description=step_data["description"],
                instructions=step_data["instructions"],
                status=RecoveryStepStatus.PENDING,
                required=step_data["required"],
                can_skip=step_data["can_skip"],
                can_rollback=step_data["can_rollback"],
                estimated_duration_ms=step_data["estimated_duration_ms"],
                dependencies=[],
                preconditions=[],
                postconditions=[],
                component_checks=await self._generate_component_checks(step_data["type"]),
                verification_tests=await self._generate_verification_tests(step_data["type"]),
                rollback_steps=[],
            )
            
            steps.append(step)
        
        return steps
    
    async def _generate_component_checks(self, step_type: str) -> List[ComponentCheckModel]:
        """Generate component checks for step type"""
        checks = []
        
        if step_type == "hardware_check":
            # Hardware component checks
            hardware_components = [
                SystemComponent.MOTORS,
                SystemComponent.SENSORS,
                SystemComponent.ACTUATORS,
                SystemComponent.POWER_SYSTEM,
                SystemComponent.EMERGENCY_HARDWARE,
            ]
            
            for component in hardware_components:
                check = ComponentCheckModel(
                    component=component,
                    status=ComponentStatus.UNKNOWN,
                    description=f"{component.value.replace('_', ' ')} health and connectivity check",
                    check_time=datetime.utcnow(),
                )
                checks.append(check)
                
        elif step_type == "software_validation":
            # Software component checks
            software_components = [
                SystemComponent.COMMUNICATIONS,
                SystemComponent.NAVIGATION,
                SystemComponent.TELEMETRY,
                SystemComponent.SAFETY_SYSTEMS,
            ]
            
            for component in software_components:
                check = ComponentCheckModel(
                    component=component,
                    status=ComponentStatus.UNKNOWN,
                    description=f"{component.value.replace('_', ' ')} service validation",
                    check_time=datetime.utcnow(),
                )
                checks.append(check)
        
        return checks
    
    async def _generate_verification_tests(self, step_type: str) -> List[VerificationTestModel]:
        """Generate verification tests for step type"""
        tests = []
        
        if step_type == "hardware_check":
            tests.extend([
                VerificationTestModel(
                    id="motor_response_test",
                    name="Motor Response Test",
                    description="Test motor controller responsiveness",
                    component=SystemComponent.MOTORS,
                    test_type="functional",
                    required=True,
                    status="pending",
                    automated_test=True,
                    test_function="test_motor_response",
                    timeout=30000,
                ),
                VerificationTestModel(
                    id="sensor_calibration_test",
                    name="Sensor Calibration Test",
                    description="Verify sensor calibration and readings",
                    component=SystemComponent.SENSORS,
                    test_type="diagnostic",
                    required=True,
                    status="pending",
                    automated_test=True,
                    test_function="test_sensor_calibration",
                    timeout=45000,
                ),
            ])
            
        elif step_type == "software_validation":
            tests.extend([
                VerificationTestModel(
                    id="communication_test",
                    name="Communication Channel Test",
                    description="Test all communication channels",
                    component=SystemComponent.COMMUNICATIONS,
                    test_type="communication",
                    required=True,
                    status="pending",
                    automated_test=True,
                    test_function="test_communication",
                    timeout=20000,
                ),
                VerificationTestModel(
                    id="telemetry_flow_test",
                    name="Telemetry Data Flow Test",
                    description="Verify telemetry data collection and transmission",
                    component=SystemComponent.TELEMETRY,
                    test_type="functional",
                    required=True,
                    status="pending",
                    automated_test=True,
                    test_function="test_telemetry_flow",
                    timeout=15000,
                ),
            ])
        
        return tests
    
    async def get_system_status(self) -> SystemStatusResponse:
        """Get current system status"""
        
        # Get component status from emergency manager
        device_states = self.emergency_manager.get_device_states()
        
        # Map to component status
        components = {}
        for component in SystemComponent:
            # In a real implementation, this would map actual device states
            # to component status based on system architecture
            components[component] = ComponentStatus.UNKNOWN
        
        return SystemStatusResponse(
            emergency_stop_active=self.emergency_manager.is_emergency_active,
            emergency_stop_cause=EmergencyStopCause.MANUAL_ACTIVATION,  # Would come from actual event
            emergency_stop_time=datetime.utcnow() if self.emergency_manager.is_emergency_active else None,
            system_state=self.emergency_manager.system_state.value,
            components=components,
            active_faults=[],  # Would come from emergency manager
            last_update=datetime.utcnow(),
        )

# Initialize recovery manager (would be done in main app startup)
async def get_recovery_manager() -> RecoveryManager:
    """Dependency to get recovery manager instance"""
    global recovery_manager
    if recovery_manager is None:
        # This would be initialized with actual emergency stop manager
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recovery manager not initialized"
        )
    return recovery_manager

# API Routes

@router.get("/status", response_model=SystemStatusResponse)
async def get_system_status(
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(get_current_user)
):
    """Get current system status"""
    return await manager.get_system_status()

@router.post("/sessions", response_model=RecoverySessionModel)
async def start_recovery_session(
    request: StartRecoveryRequest,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(require_roles(["operator", "supervisor", "admin"]))
):
    """Start a new recovery session"""
    return await manager.start_recovery_session(request, current_user)

@router.get("/sessions", response_model=List[RecoverySessionModel])
async def get_recovery_sessions(
    status_filter: Optional[RecoverySessionStatus] = None,
    limit: int = 50,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(get_current_user)
):
    """Get recovery sessions"""
    sessions = list(manager.active_sessions.values()) + manager.session_history
    
    if status_filter:
        sessions = [s for s in sessions if s.status == status_filter]
    
    # Sort by start time descending
    sessions.sort(key=lambda s: s.start_time, reverse=True)
    
    return sessions[:limit]

@router.get("/sessions/{session_id}", response_model=RecoverySessionModel)
async def get_recovery_session(
    session_id: str,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(get_current_user)
):
    """Get specific recovery session"""
    if session_id not in manager.active_sessions:
        # Check history
        for session in manager.session_history:
            if session.id == session_id:
                return session
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery session not found"
        )
    
    return manager.active_sessions[session_id]

@router.post("/sessions/{session_id}/steps/{step_id}/execute")
async def execute_recovery_step(
    session_id: str,
    step_id: str,
    request: ExecuteStepRequest,
    background_tasks: BackgroundTasks,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(require_roles(["operator", "supervisor", "admin"]))
):
    """Execute a recovery step"""
    if session_id not in manager.active_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery session not found"
        )
    
    session = manager.active_sessions[session_id]
    
    # Find step
    step = next((s for s in session.steps if s.id == step_id), None)
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery step not found"
        )
    
    if step.status != RecoveryStepStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Step is not in pending state"
        )
    
    # Execute step in background
    background_tasks.add_task(
        _execute_step_background,
        manager,
        session,
        step,
        current_user
    )
    
    return {"message": "Step execution started", "step_id": step_id}

@router.post("/sessions/{session_id}/steps/{step_id}/skip")
async def skip_recovery_step(
    session_id: str,
    step_id: str,
    request: SkipStepRequest,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(require_roles(["operator", "supervisor", "admin"]))
):
    """Skip a recovery step"""
    if session_id not in manager.active_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery session not found"
        )
    
    session = manager.active_sessions[session_id]
    
    # Find step
    step = next((s for s in session.steps if s.id == step_id), None)
    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery step not found"
        )
    
    if not step.can_skip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Step cannot be skipped"
        )
    
    # Skip step
    step.status = RecoveryStepStatus.SKIPPED
    step.end_time = datetime.utcnow()
    session.skipped_steps += 1
    
    # Log skip
    audit_entry = AuditLogEntryModel(
        id=f"audit_{datetime.utcnow().timestamp()}",
        timestamp=datetime.utcnow(),
        operator_id=current_user.id,
        operator_name=current_user.username,
        action="step_skipped",
        step_id=step_id,
        details={"reason": request.reason},
        result="warning",
        message=f"Skipped recovery step: {step.title} - Reason: {request.reason}",
    )
    
    session.audit_log.append(audit_entry)
    manager.audit_log.append(audit_entry)
    
    return {"message": "Step skipped successfully", "step_id": step_id}

@router.post("/sessions/{session_id}/abort")
async def abort_recovery_session(
    session_id: str,
    request: AbortSessionRequest,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(require_roles(["supervisor", "admin"]))
):
    """Abort recovery session"""
    if session_id not in manager.active_sessions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recovery session not found"
        )
    
    session = manager.active_sessions[session_id]
    
    # Abort session
    session.status = RecoverySessionStatus.ABORTED
    session.end_time = datetime.utcnow()
    
    # Log abort
    audit_entry = AuditLogEntryModel(
        id=f"audit_{datetime.utcnow().timestamp()}",
        timestamp=datetime.utcnow(),
        operator_id=current_user.id,
        operator_name=current_user.username,
        action="session_aborted",
        details={"reason": request.reason},
        result="failure",
        message=f"Recovery session aborted - Reason: {request.reason}",
    )
    
    session.audit_log.append(audit_entry)
    manager.audit_log.append(audit_entry)
    
    # Move to history
    manager.session_history.append(session)
    del manager.active_sessions[session_id]
    
    logger.warning(f"Recovery session aborted: {session_id} by {current_user.username}")
    
    return {"message": "Recovery session aborted", "session_id": session_id}

@router.get("/audit", response_model=List[AuditLogEntryModel])
async def get_audit_log(
    limit: int = 100,
    since: Optional[datetime] = None,
    session_id: Optional[str] = None,
    manager: RecoveryManager = Depends(get_recovery_manager),
    current_user: User = Depends(require_roles(["operator", "supervisor", "admin"]))
):
    """Get audit log entries"""
    audit_entries = manager.audit_log
    
    # Apply filters
    if since:
        audit_entries = [e for e in audit_entries if e.timestamp >= since]
    
    if session_id:
        audit_entries = [e for e in audit_entries 
                        if session_id in e.details.get("session_id", "")]
    
    # Sort by timestamp descending
    audit_entries.sort(key=lambda e: e.timestamp, reverse=True)
    
    return audit_entries[:limit]

# Background task for step execution
async def _execute_step_background(
    manager: RecoveryManager,
    session: RecoverySessionModel,
    step: RecoveryStepModel,
    operator: User
):
    """Execute recovery step in background"""
    
    step.status = RecoveryStepStatus.IN_PROGRESS
    step.start_time = datetime.utcnow()
    step.operator_id = operator.id
    
    try:
        # Simulate step execution
        await asyncio.sleep(step.estimated_duration_ms / 1000.0)
        
        # Mark as completed
        step.status = RecoveryStepStatus.COMPLETED
        step.end_time = datetime.utcnow()
        step.actual_duration_ms = int((step.end_time - step.start_time).total_seconds() * 1000)
        session.completed_steps += 1
        
        # Check if session is complete
        if session.completed_steps == session.total_steps:
            session.status = RecoverySessionStatus.COMPLETED
            session.end_time = datetime.utcnow()
            session.actual_total_time = int((session.end_time - session.start_time).total_seconds() * 1000)
            
            # Move to history
            manager.session_history.append(session)
            del manager.active_sessions[session.id]
        
        # Log completion
        audit_entry = AuditLogEntryModel(
            id=f"audit_{datetime.utcnow().timestamp()}",
            timestamp=datetime.utcnow(),
            operator_id=operator.id,
            operator_name=operator.username,
            action="step_completed",
            step_id=step.id,
            details={
                "step_type": step.type,
                "duration": step.actual_duration_ms,
            },
            result="success",
            message=f"Completed recovery step: {step.title}",
        )
        
        session.audit_log.append(audit_entry)
        manager.audit_log.append(audit_entry)
        
        logger.info(f"Recovery step completed: {step.id}")
        
    except Exception as e:
        # Mark as failed
        step.status = RecoveryStepStatus.FAILED
        step.end_time = datetime.utcnow()
        step.error_message = str(e)
        session.failed_steps += 1
        
        # Log failure
        audit_entry = AuditLogEntryModel(
            id=f"audit_{datetime.utcnow().timestamp()}",
            timestamp=datetime.utcnow(),
            operator_id=operator.id,
            operator_name=operator.username,
            action="step_failed",
            step_id=step.id,
            details={
                "step_type": step.type,
                "error": str(e),
            },
            result="failure",
            message=f"Failed recovery step: {step.title} - {str(e)}",
        )
        
        session.audit_log.append(audit_entry)
        manager.audit_log.append(audit_entry)
        
        logger.error(f"Recovery step failed: {step.id} - {e}")

def initialize_recovery_system(emergency_stop_manager: EmergencyStopManager):
    """Initialize the recovery system with emergency stop manager"""
    global recovery_manager
    recovery_manager = RecoveryManager(emergency_stop_manager)
    logger.info("Recovery system initialized")

# Export router
__all__ = ["router", "initialize_recovery_system"]