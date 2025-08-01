"""
Emergency Stop Levels Backend Service

Implements multiple emergency stop levels with different severity and actions.
Provides comprehensive testing mode capabilities and integration with existing
emergency stop infrastructure.

Features:
- 5 configurable emergency stop levels
- Testing mode with simulation capabilities
- Real-time execution monitoring
- Performance metrics collection
- Configuration management
- Audit logging and reporting
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta
from enum import Enum, IntEnum
from typing import Dict, List, Optional, Callable, Any, Union
from dataclasses import dataclass, field, asdict
from contextlib import asynccontextmanager
import uuid
import time

from .emergency_stop_manager import EmergencyStopManager, EmergencyStopState
from .emergency_stop import EmergencyStopDevice

logger = logging.getLogger(__name__)


class EmergencyStopLevel(IntEnum):
    """Emergency stop levels with increasing severity"""
    SOFT_STOP = 1      # Graceful shutdown with warnings
    HARD_STOP = 2      # Immediate halt, maintain power
    EMERGENCY_STOP = 3 # All systems halt
    CRITICAL_STOP = 4  # Power shutdown, lockout
    FAILSAFE_MODE = 5  # Minimal systems only


class StopExecutionStatus(Enum):
    """Status of stop level execution"""
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TestExecutionStatus(Enum):
    """Status of test execution"""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class SystemState:
    """Current system state for stop level decisions"""
    is_moving: bool = False
    power_level: float = 100.0
    sensors_active: int = 0
    communication_health: str = "good"  # good, degraded, poor, lost
    battery_level: float = 100.0
    emergency_battery: bool = True
    hardware_status: str = "normal"  # normal, warning, error, critical
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class StopAction:
    """Individual action in a stop level"""
    id: str
    name: str
    description: str
    order: int
    timeout: float
    critical: bool
    retry_count: int = 0
    rollback_action: Optional[str] = None
    
    async def execute(self, test_mode: bool = False) -> bool:
        """Execute the action"""
        start_time = time.time()
        
        try:
            if test_mode:
                # Simulate action execution
                await asyncio.sleep(min(self.timeout * 0.1, 1.0))  # Quick simulation
                logger.info(f"[TEST] Executed action {self.name}")
                return True
            else:
                # Real action execution would go here
                await asyncio.sleep(self.timeout)
                logger.info(f"Executed action {self.name}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to execute action {self.name}: {e}")
            return False
        finally:
            execution_time = time.time() - start_time
            logger.debug(f"Action {self.name} took {execution_time:.2f}s")


@dataclass
class AutomaticTrigger:
    """Automatic trigger for stop levels"""
    id: str
    name: str
    description: str
    enabled: bool
    condition: str
    threshold: float
    comparison_operator: str
    data_source: str
    debounce_time: float
    priority: int
    last_triggered: Optional[datetime] = None
    
    def should_trigger(self, system_state: SystemState) -> bool:
        """Check if trigger should activate"""
        if not self.enabled:
            return False
            
        # Check debounce
        if self.last_triggered:
            elapsed = datetime.now() - self.last_triggered
            if elapsed.total_seconds() < self.debounce_time:
                return False
        
        # Get value from system state
        value = self._get_value_from_state(system_state)
        if value is None:
            return False
            
        # Apply comparison operator
        if self.comparison_operator == '>':
            return value > self.threshold
        elif self.comparison_operator == '<':
            return value < self.threshold
        elif self.comparison_operator == '>=':
            return value >= self.threshold
        elif self.comparison_operator == '<=':
            return value <= self.threshold
        elif self.comparison_operator == '==':
            return value == self.threshold
        elif self.comparison_operator == '!=':
            return value != self.threshold
            
        return False
    
    def _get_value_from_state(self, system_state: SystemState) -> Optional[float]:
        """Extract value from system state based on data source"""
        try:
            if self.data_source == "battery_level":
                return system_state.battery_level
            elif self.data_source == "power_level":
                return system_state.power_level
            elif self.data_source == "sensors_active":
                return float(system_state.sensors_active)
            # Add more data sources as needed
            return None
        except Exception:
            return None


@dataclass
class StopLevelConfiguration:
    """Configuration for an emergency stop level"""
    level: EmergencyStopLevel
    name: str
    description: str
    enabled: bool
    estimated_duration: float
    confirmation_required: bool
    confirmation_timeout: float
    actions: List[StopAction]
    automatic_triggers: List[AutomaticTrigger]
    custom_parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StopExecution:
    """Active stop level execution"""
    id: str
    level: EmergencyStopLevel
    start_time: datetime
    estimated_completion: datetime
    current_step: str
    progress: float
    errors: List[str]
    warnings: List[str]
    status: StopExecutionStatus
    test_mode: bool = False
    actions_completed: int = 0
    actions_total: int = 0


@dataclass
class TestScenario:
    """Test scenario definition"""
    id: str
    name: str
    type: str
    description: str
    duration: float
    stop_levels: List[EmergencyStopLevel]
    parameters: Dict[str, Any]
    expected_results: List[str]
    validation_criteria: List[str]
    automated_validation: bool


@dataclass
class TestMetrics:
    """Test execution metrics"""
    total_execution_time: float
    average_response_time: float
    success_rate: float
    error_count: int
    warning_count: int
    performance_score: float
    memory_usage: float
    cpu_usage: float
    network_latency: float


@dataclass
class TestExecutionResult:
    """Test execution result"""
    scenario_id: str
    start_time: datetime
    end_time: datetime
    status: TestExecutionStatus
    metrics: TestMetrics
    errors: List[str]
    warnings: List[str]
    passed: bool
    score: float
    stop_level_results: Dict[EmergencyStopLevel, Dict[str, Any]] = field(default_factory=dict)


class EmergencyStopLevelsService:
    """Main service for emergency stop levels"""
    
    def __init__(self, emergency_stop_manager: EmergencyStopManager):
        self.emergency_stop_manager = emergency_stop_manager
        self.test_mode = False
        self.current_execution: Optional[StopExecution] = None
        self.current_test: Optional[dict] = None
        self.system_state = SystemState()
        
        # Default configurations
        self.configurations = self._create_default_configurations()
        
        # Test results storage
        self.test_results: List[TestExecutionResult] = []
        
        # Event callbacks
        self.event_callbacks: List[Callable] = []
        
        # Monitoring task
        self._monitoring_task: Optional[asyncio.Task] = None
        
    def _create_default_configurations(self) -> Dict[EmergencyStopLevel, StopLevelConfiguration]:
        """Create default stop level configurations"""
        return {
            EmergencyStopLevel.SOFT_STOP: StopLevelConfiguration(
                level=EmergencyStopLevel.SOFT_STOP,
                name="Soft Stop",
                description="Graceful shutdown with operator warnings",
                enabled=True,
                estimated_duration=15.0,
                confirmation_required=False,
                confirmation_timeout=10.0,
                actions=[
                    StopAction(
                        id="warning",
                        name="Send Warning",
                        description="Send warning to operator",
                        order=1,
                        timeout=2.0,
                        critical=False,
                    ),
                    StopAction(
                        id="decelerate",
                        name="Begin Deceleration",
                        description="Begin controlled deceleration",
                        order=2,
                        timeout=10.0,
                        critical=True,
                        retry_count=2,
                    ),
                ],
                automatic_triggers=[
                    AutomaticTrigger(
                        id="low_battery",
                        name="Low Battery Warning",
                        description="Battery level below warning threshold",
                        enabled=True,
                        condition="battery_level",
                        threshold=20.0,
                        comparison_operator="<",
                        data_source="battery_level",
                        debounce_time=5.0,
                        priority=2,
                    ),
                ],
            ),
            EmergencyStopLevel.HARD_STOP: StopLevelConfiguration(
                level=EmergencyStopLevel.HARD_STOP,
                name="Hard Stop",
                description="Immediate halt with power maintained",
                enabled=True,
                estimated_duration=5.0,
                confirmation_required=True,
                confirmation_timeout=15.0,
                actions=[
                    StopAction(
                        id="motor_shutdown",
                        name="Motor Shutdown",
                        description="Immediate motor shutdown",
                        order=1,
                        timeout=2.0,
                        critical=True,
                    ),
                    StopAction(
                        id="engage_brakes",
                        name="Engage Brakes",
                        description="Engage mechanical brakes",
                        order=2,
                        timeout=3.0,
                        critical=True,
                    ),
                ],
                automatic_triggers=[
                    AutomaticTrigger(
                        id="obstacle_detected",
                        name="Obstacle Detected",
                        description="Obstacle detected within critical distance",
                        enabled=True,
                        condition="obstacle_distance",
                        threshold=1.0,
                        comparison_operator="<",
                        data_source="obstacle_distance",
                        debounce_time=0.5,
                        priority=1,
                    ),
                ],
            ),
            EmergencyStopLevel.EMERGENCY_STOP: StopLevelConfiguration(
                level=EmergencyStopLevel.EMERGENCY_STOP,
                name="Emergency Stop",
                description="All systems halt immediately",
                enabled=True,
                estimated_duration=2.0,
                confirmation_required=True,
                confirmation_timeout=10.0,
                actions=[
                    StopAction(
                        id="immediate_shutdown",
                        name="Immediate Shutdown",
                        description="Immediate shutdown all motors",
                        order=1,
                        timeout=1.0,
                        critical=True,
                    ),
                    StopAction(
                        id="emergency_brakes",
                        name="Emergency Brakes",
                        description="Deploy emergency brakes",
                        order=2,
                        timeout=1.0,
                        critical=True,
                    ),
                ],
                automatic_triggers=[
                    AutomaticTrigger(
                        id="imminent_collision",
                        name="Imminent Collision",
                        description="Imminent collision detected",
                        enabled=True,
                        condition="collision_risk",
                        threshold=0.9,
                        comparison_operator=">",
                        data_source="collision_risk",
                        debounce_time=0.1,
                        priority=1,
                    ),
                ],
            ),
            EmergencyStopLevel.CRITICAL_STOP: StopLevelConfiguration(
                level=EmergencyStopLevel.CRITICAL_STOP,
                name="Critical Stop",
                description="Power shutdown with lockout",
                enabled=True,
                estimated_duration=1.0,
                confirmation_required=True,
                confirmation_timeout=5.0,
                actions=[
                    StopAction(
                        id="power_shutdown",
                        name="Power Shutdown",
                        description="Complete power shutdown",
                        order=1,
                        timeout=0.5,
                        critical=True,
                    ),
                    StopAction(
                        id="engage_lockouts",
                        name="Engage Lockouts",
                        description="Engage physical lockouts",
                        order=2,
                        timeout=0.5,
                        critical=True,
                    ),
                ],
                automatic_triggers=[
                    AutomaticTrigger(
                        id="fire_detected",
                        name="Fire Detected",
                        description="Fire or smoke detected",
                        enabled=True,
                        condition="fire_detected",
                        threshold=1.0,
                        comparison_operator=">=",
                        data_source="fire_detected",
                        debounce_time=0.0,
                        priority=1,
                    ),
                ],
            ),
            EmergencyStopLevel.FAILSAFE_MODE: StopLevelConfiguration(
                level=EmergencyStopLevel.FAILSAFE_MODE,
                name="Failsafe Mode",
                description="Minimal systems operation",
                enabled=True,
                estimated_duration=30.0,
                confirmation_required=False,
                confirmation_timeout=0.0,
                actions=[
                    StopAction(
                        id="emergency_battery",
                        name="Switch to Emergency Battery",
                        description="Switch to emergency battery",
                        order=1,
                        timeout=5.0,
                        critical=True,
                    ),
                    StopAction(
                        id="minimal_systems",
                        name="Activate Minimal Systems",
                        description="Activate minimal sensor operation",
                        order=2,
                        timeout=10.0,
                        critical=True,
                    ),
                ],
                automatic_triggers=[
                    AutomaticTrigger(
                        id="power_failure",
                        name="Primary Power Failure",
                        description="Primary power failure detected",
                        enabled=True,
                        condition="power_level",
                        threshold=5.0,
                        comparison_operator="<",
                        data_source="power_level",
                        debounce_time=1.0,
                        priority=1,
                    ),
                ],
            ),
        }
    
    async def start(self):
        """Start the service"""
        logger.info("Starting Emergency Stop Levels Service")
        
        # Start monitoring task
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        
    async def stop(self):
        """Stop the service"""
        logger.info("Stopping Emergency Stop Levels Service")
        
        # Cancel monitoring task
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
                
        # Cancel any active execution
        if self.current_execution:
            await self.cancel_execution()
    
    async def _monitoring_loop(self):
        """Monitor system state and automatic triggers"""
        try:
            while True:
                await asyncio.sleep(0.1)  # 10Hz monitoring
                
                # Update system state (would get from real telemetry)
                await self._update_system_state()
                
                # Check automatic triggers
                await self._check_automatic_triggers()
                
        except asyncio.CancelledError:
            logger.info("Monitoring loop cancelled")
        except Exception as e:
            logger.error(f"Error in monitoring loop: {e}")
    
    async def _update_system_state(self):
        """Update system state from telemetry"""
        # In real implementation, this would get data from telemetry system
        # For now, simulate some dynamic values
        import random
        
        # Simulate battery drain
        if self.system_state.is_moving:
            self.system_state.battery_level = max(0, self.system_state.battery_level - 0.01)
        
        # Simulate sensor fluctuation
        self.system_state.sensors_active = max(0, 
            self.system_state.sensors_active + random.randint(-1, 1))
        
        self.system_state.timestamp = datetime.now()
        
        # Notify callbacks of state change
        await self._notify_callbacks("system_state_update", asdict(self.system_state))
    
    async def _check_automatic_triggers(self):
        """Check all automatic triggers"""
        if self.test_mode or self.current_execution:
            return
            
        for config in self.configurations.values():
            if not config.enabled:
                continue
                
            for trigger in config.automatic_triggers:
                if trigger.should_trigger(self.system_state):
                    logger.warning(f"Automatic trigger activated: {trigger.name}")
                    trigger.last_triggered = datetime.now()
                    
                    # Execute the stop level
                    await self.execute_stop_level(config.level, test_mode=False, 
                                                automatic=True, trigger_id=trigger.id)
                    break
    
    async def execute_stop_level(self, level: EmergencyStopLevel, test_mode: bool = False,
                                automatic: bool = False, trigger_id: Optional[str] = None) -> StopExecution:
        """Execute an emergency stop level"""
        if self.current_execution and not test_mode:
            raise ValueError("Another stop execution is already in progress")
            
        config = self.configurations.get(level)
        if not config or not config.enabled:
            raise ValueError(f"Stop level {level} is not configured or disabled")
        
        # Create execution record
        execution_id = str(uuid.uuid4())
        start_time = datetime.now()
        estimated_completion = start_time + timedelta(seconds=config.estimated_duration)
        
        execution = StopExecution(
            id=execution_id,
            level=level,
            start_time=start_time,
            estimated_completion=estimated_completion,
            current_step="Initializing",
            progress=0.0,
            errors=[],
            warnings=[],
            status=StopExecutionStatus.EXECUTING,
            test_mode=test_mode,
            actions_total=len(config.actions),
        )
        
        self.current_execution = execution
        
        try:
            logger.info(f"Executing stop level {level} (test_mode={test_mode})")
            
            # Notify callbacks
            await self._notify_callbacks("stop_execution_started", {
                "execution": asdict(execution),
                "automatic": automatic,
                "trigger_id": trigger_id,
            })
            
            # Execute actions in order
            for i, action in enumerate(sorted(config.actions, key=lambda a: a.order)):
                execution.current_step = f"Executing: {action.name}"
                execution.progress = (i / len(config.actions)) * 100
                
                await self._notify_callbacks("stop_execution_progress", asdict(execution))
                
                success = await action.execute(test_mode)
                
                if success:
                    execution.actions_completed += 1
                    logger.info(f"Completed action: {action.name}")
                else:
                    error_msg = f"Failed to execute action: {action.name}"
                    execution.errors.append(error_msg)
                    logger.error(error_msg)
                    
                    if action.critical and not test_mode:
                        execution.status = StopExecutionStatus.FAILED
                        break
            
            # Complete execution
            if execution.status == StopExecutionStatus.EXECUTING:
                execution.status = StopExecutionStatus.COMPLETED
                execution.progress = 100.0
                execution.current_step = "Completed"
                
            logger.info(f"Stop level {level} execution completed with status: {execution.status}")
            
            # Notify callbacks
            await self._notify_callbacks("stop_execution_completed", asdict(execution))
            
            return execution
            
        except Exception as e:
            execution.status = StopExecutionStatus.FAILED
            execution.errors.append(str(e))
            logger.error(f"Stop level {level} execution failed: {e}")
            
            await self._notify_callbacks("stop_execution_failed", asdict(execution))
            raise
            
        finally:
            # Clear current execution after a delay to allow UI updates
            asyncio.create_task(self._clear_execution_after_delay(5.0))
    
    async def _clear_execution_after_delay(self, delay: float):
        """Clear current execution after delay"""
        await asyncio.sleep(delay)
        self.current_execution = None
    
    async def cancel_execution(self) -> bool:
        """Cancel current execution"""
        if not self.current_execution:
            return False
            
        logger.info(f"Cancelling execution {self.current_execution.id}")
        
        self.current_execution.status = StopExecutionStatus.CANCELLED
        self.current_execution.current_step = "Cancelled"
        
        await self._notify_callbacks("stop_execution_cancelled", asdict(self.current_execution))
        
        self.current_execution = None
        return True
    
    async def set_test_mode(self, enabled: bool):
        """Set test mode"""
        if self.current_execution:
            raise ValueError("Cannot change test mode during execution")
            
        self.test_mode = enabled
        logger.info(f"Test mode {'enabled' if enabled else 'disabled'}")
        
        await self._notify_callbacks("test_mode_changed", {"enabled": enabled})
    
    async def execute_test_scenario(self, scenario: TestScenario) -> TestExecutionResult:
        """Execute a test scenario"""
        if not self.test_mode:
            raise ValueError("Test scenarios can only be executed in test mode")
            
        if self.current_test:
            raise ValueError("Another test is already running")
        
        logger.info(f"Starting test scenario: {scenario.name}")
        
        start_time = datetime.now()
        
        # Initialize test execution tracking
        self.current_test = {
            "scenario": scenario,
            "status": TestExecutionStatus.RUNNING,
            "progress": 0.0,
            "current_step": "Initializing",
            "elapsed_time": 0.0,
        }
        
        # Initialize result
        result = TestExecutionResult(
            scenario_id=scenario.id,
            start_time=start_time,
            end_time=start_time,  # Will be updated
            status=TestExecutionStatus.RUNNING,
            metrics=TestMetrics(
                total_execution_time=0.0,
                average_response_time=0.0,
                success_rate=0.0,
                error_count=0,
                warning_count=0,
                performance_score=0.0,
                memory_usage=0.0,
                cpu_usage=0.0,
                network_latency=0.0,
            ),
            errors=[],
            warnings=[],
            passed=False,
            score=0.0,
        )
        
        try:
            await self._notify_callbacks("test_execution_started", {
                "scenario": asdict(scenario),
                "test_execution": self.current_test,
            })
            
            # Execute stop levels in the scenario
            total_steps = len(scenario.stop_levels)
            response_times = []
            
            for i, level in enumerate(scenario.stop_levels):
                step_start = time.time()
                
                self.current_test["current_step"] = f"Testing Level {level}"
                self.current_test["progress"] = (i / total_steps) * 100
                self.current_test["elapsed_time"] = (datetime.now() - start_time).total_seconds()
                
                await self._notify_callbacks("test_execution_progress", self.current_test)
                
                try:
                    # Execute the stop level in test mode
                    execution = await self.execute_stop_level(level, test_mode=True)
                    
                    step_time = time.time() - step_start
                    response_times.append(step_time)
                    
                    # Record result for this stop level
                    result.stop_level_results[level] = {
                        "execution_time": step_time * 1000,  # Convert to ms
                        "response_time": step_time * 1000,
                        "steps_completed": execution.actions_completed,
                        "steps_total": execution.actions_total,
                        "errors": execution.errors,
                        "warnings": execution.warnings,
                        "passed": execution.status == StopExecutionStatus.COMPLETED,
                        "metrics": {},
                    }
                    
                    if execution.errors:
                        result.errors.extend(execution.errors)
                    if execution.warnings:
                        result.warnings.extend(execution.warnings)
                        
                except Exception as e:
                    error_msg = f"Failed to execute level {level}: {str(e)}"
                    result.errors.append(error_msg)
                    logger.error(error_msg)
                
                # Delay between levels based on scenario parameters
                delay = scenario.parameters.get("delayBetweenLevels", 1.0)
                await asyncio.sleep(delay)
            
            # Calculate final metrics
            end_time = datetime.now()
            total_time = (end_time - start_time).total_seconds()
            
            result.end_time = end_time
            result.status = TestExecutionStatus.COMPLETED
            result.metrics.total_execution_time = total_time
            result.metrics.average_response_time = sum(response_times) / len(response_times) if response_times else 0
            result.metrics.success_rate = (len([r for r in result.stop_level_results.values() if r["passed"]]) / 
                                        len(result.stop_level_results)) * 100 if result.stop_level_results else 0
            result.metrics.error_count = len(result.errors)
            result.metrics.warning_count = len(result.warnings)
            result.metrics.performance_score = min(100, max(0, result.metrics.success_rate - result.metrics.error_count * 10))
            
            # Determine if test passed
            result.passed = (result.metrics.success_rate >= 90 and 
                           result.metrics.error_count == 0)
            result.score = result.metrics.performance_score
            
            # Store result
            self.test_results.append(result)
            
            logger.info(f"Test scenario completed: {scenario.name} (passed={result.passed}, score={result.score})")
            
            await self._notify_callbacks("test_execution_completed", asdict(result))
            
            return result
            
        except Exception as e:
            result.status = TestExecutionStatus.FAILED
            result.errors.append(str(e))
            result.end_time = datetime.now()
            
            logger.error(f"Test scenario failed: {scenario.name} - {e}")
            
            await self._notify_callbacks("test_execution_failed", asdict(result))
            
            return result
            
        finally:
            self.current_test = None
    
    async def stop_test_execution(self):
        """Stop current test execution"""
        if not self.current_test:
            return False
            
        logger.info("Stopping test execution")
        
        self.current_test["status"] = TestExecutionStatus.CANCELLED
        
        await self._notify_callbacks("test_execution_stopped", self.current_test)
        
        self.current_test = None
        return True
    
    def get_system_state(self) -> SystemState:
        """Get current system state"""
        return self.system_state
    
    def get_current_execution(self) -> Optional[StopExecution]:
        """Get current execution"""
        return self.current_execution
    
    def get_test_results(self) -> List[TestExecutionResult]:
        """Get all test results"""
        return self.test_results.copy()
    
    def add_event_callback(self, callback: Callable):
        """Add event callback"""
        self.event_callbacks.append(callback)
    
    def remove_event_callback(self, callback: Callable):
        """Remove event callback"""
        if callback in self.event_callbacks:
            self.event_callbacks.remove(callback)
    
    async def _notify_callbacks(self, event_type: str, data: Any):
        """Notify all event callbacks"""
        for callback in self.event_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event_type, data)
                else:
                    callback(event_type, data)
            except Exception as e:
                logger.error(f"Error in event callback: {e}")
    
    # Configuration management methods
    
    def get_configuration(self, level: EmergencyStopLevel) -> Optional[StopLevelConfiguration]:
        """Get configuration for a stop level"""
        return self.configurations.get(level)
    
    def update_configuration(self, level: EmergencyStopLevel, config: StopLevelConfiguration):
        """Update configuration for a stop level"""
        self.configurations[level] = config
        logger.info(f"Updated configuration for stop level {level}")
    
    def export_configuration(self) -> Dict[str, Any]:
        """Export all configurations"""
        return {
            "stop_levels": {str(level): asdict(config) for level, config in self.configurations.items()},
            "test_mode": self.test_mode,
            "export_date": datetime.now().isoformat(),
            "version": "1.0",
        }
    
    def import_configuration(self, config_data: Dict[str, Any]):
        """Import configurations"""
        try:
            stop_levels = config_data.get("stop_levels", {})
            
            for level_str, config_dict in stop_levels.items():
                level = EmergencyStopLevel(int(level_str))
                
                # Convert dict back to objects
                actions = [StopAction(**action) for action in config_dict.get("actions", [])]
                triggers = [AutomaticTrigger(**trigger) for trigger in config_dict.get("automatic_triggers", [])]
                
                config = StopLevelConfiguration(
                    level=level,
                    name=config_dict["name"],
                    description=config_dict["description"],
                    enabled=config_dict["enabled"],
                    estimated_duration=config_dict["estimated_duration"],
                    confirmation_required=config_dict["confirmation_required"],
                    confirmation_timeout=config_dict["confirmation_timeout"],
                    actions=actions,
                    automatic_triggers=triggers,
                    custom_parameters=config_dict.get("custom_parameters", {}),
                )
                
                self.configurations[level] = config
                
            logger.info("Configuration imported successfully")
            
        except Exception as e:
            logger.error(f"Failed to import configuration: {e}")
            raise