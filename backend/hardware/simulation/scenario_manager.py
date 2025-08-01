"""
Scenario Management System
Provides scenario scripting, recording, and playback capabilities
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Callable, Union, Tuple
from enum import Enum
import json
import asyncio
from datetime import datetime, timedelta
import logging
from pathlib import Path
import pickle
import gzip


logger = logging.getLogger(__name__)


class ScenarioActionType(Enum):
    """Types of actions in a scenario"""
    SET_ENVIRONMENT = "set_environment"
    SET_DEVICE_STATE = "set_device_state"
    SEND_COMMAND = "send_command"
    WAIT = "wait"
    ASSERT_STATE = "assert_state"
    INJECT_FAULT = "inject_fault"
    CLEAR_FAULT = "clear_fault"
    SET_NETWORK = "set_network"
    TRIGGER_EVENT = "trigger_event"
    LOG_MESSAGE = "log_message"
    CHECKPOINT = "checkpoint"
    LOOP_START = "loop_start"
    LOOP_END = "loop_end"
    CONDITIONAL = "conditional"


class ScenarioStatus(Enum):
    """Status of scenario execution"""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


@dataclass
class ScenarioStep:
    """A single step in a scenario"""
    step_id: str
    action_type: ScenarioActionType
    parameters: Dict[str, Any]
    description: str = ""
    
    # Timing
    delay_before: float = 0.0  # Seconds to wait before executing
    timeout: float = 30.0  # Maximum time for step execution
    
    # Conditions
    skip_condition: Optional[Dict[str, Any]] = None  # Condition to skip step
    retry_count: int = 0  # Number of retries on failure
    
    # Metadata
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'step_id': self.step_id,
            'action_type': self.action_type.value,
            'parameters': self.parameters,
            'description': self.description,
            'delay_before': self.delay_before,
            'timeout': self.timeout,
            'skip_condition': self.skip_condition,
            'retry_count': self.retry_count,
            'tags': self.tags,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScenarioStep':
        """Create from dictionary"""
        return cls(
            step_id=data['step_id'],
            action_type=ScenarioActionType(data['action_type']),
            parameters=data['parameters'],
            description=data.get('description', ''),
            delay_before=data.get('delay_before', 0.0),
            timeout=data.get('timeout', 30.0),
            skip_condition=data.get('skip_condition'),
            retry_count=data.get('retry_count', 0),
            tags=data.get('tags', []),
            metadata=data.get('metadata', {})
        )


@dataclass
class Scenario:
    """A complete test scenario"""
    scenario_id: str
    name: str
    description: str = ""
    version: str = "1.0.0"
    
    # Steps
    steps: List[ScenarioStep] = field(default_factory=list)
    
    # Configuration
    setup_steps: List[ScenarioStep] = field(default_factory=list)  # Run before main steps
    teardown_steps: List[ScenarioStep] = field(default_factory=list)  # Run after main steps
    
    # Variables for parameterization
    variables: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    author: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_step(self, step: ScenarioStep):
        """Add a step to the scenario"""
        self.steps.append(step)
    
    def remove_step(self, step_id: str):
        """Remove a step by ID"""
        self.steps = [s for s in self.steps if s.step_id != step_id]
    
    def get_step(self, step_id: str) -> Optional[ScenarioStep]:
        """Get a step by ID"""
        for step in self.steps:
            if step.step_id == step_id:
                return step
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'scenario_id': self.scenario_id,
            'name': self.name,
            'description': self.description,
            'version': self.version,
            'steps': [s.to_dict() for s in self.steps],
            'setup_steps': [s.to_dict() for s in self.setup_steps],
            'teardown_steps': [s.to_dict() for s in self.teardown_steps],
            'variables': self.variables,
            'author': self.author,
            'created_at': self.created_at.isoformat(),
            'tags': self.tags,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Scenario':
        """Create from dictionary"""
        return cls(
            scenario_id=data['scenario_id'],
            name=data['name'],
            description=data.get('description', ''),
            version=data.get('version', '1.0.0'),
            steps=[ScenarioStep.from_dict(s) for s in data.get('steps', [])],
            setup_steps=[ScenarioStep.from_dict(s) for s in data.get('setup_steps', [])],
            teardown_steps=[ScenarioStep.from_dict(s) for s in data.get('teardown_steps', [])],
            variables=data.get('variables', {}),
            author=data.get('author', ''),
            created_at=datetime.fromisoformat(data.get('created_at', datetime.utcnow().isoformat())),
            tags=data.get('tags', []),
            metadata=data.get('metadata', {})
        )
    
    def save_to_file(self, filepath: Union[str, Path]):
        """Save scenario to JSON file"""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
    
    @classmethod
    def load_from_file(cls, filepath: Union[str, Path]) -> 'Scenario':
        """Load scenario from JSON file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        return cls.from_dict(data)


@dataclass
class ScenarioExecutionContext:
    """Context for scenario execution"""
    scenario: Scenario
    current_step_index: int = 0
    status: ScenarioStatus = ScenarioStatus.IDLE
    
    # Execution state
    variables: Dict[str, Any] = field(default_factory=dict)  # Runtime variables
    checkpoints: Dict[str, Any] = field(default_factory=dict)  # Saved checkpoints
    loop_counters: Dict[str, int] = field(default_factory=dict)  # Loop iteration counts
    
    # Results
    executed_steps: List[str] = field(default_factory=list)
    failed_steps: List[Tuple[str, str]] = field(default_factory=list)  # (step_id, error)
    assertions_passed: int = 0
    assertions_failed: int = 0
    
    # Timing
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    step_durations: Dict[str, float] = field(default_factory=dict)
    
    # Recording
    recorded_events: List[Dict[str, Any]] = field(default_factory=list)
    
    def get_current_step(self) -> Optional[ScenarioStep]:
        """Get the current step being executed"""
        if 0 <= self.current_step_index < len(self.scenario.steps):
            return self.scenario.steps[self.current_step_index]
        return None
    
    def record_event(self, event_type: str, data: Any):
        """Record an event during execution"""
        self.recorded_events.append({
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'data': data,
            'step_index': self.current_step_index
        })


class ScenarioPlayer:
    """Executes scenarios with recording and playback"""
    
    def __init__(self):
        self.contexts: Dict[str, ScenarioExecutionContext] = {}
        self.action_handlers: Dict[ScenarioActionType, Callable] = {}
        self.event_handlers: List[Callable[[str, Dict[str, Any]], None]] = []
        self._recordings: Dict[str, List[Dict[str, Any]]] = {}
        
        # Register default handlers
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Register default action handlers"""
        self.register_action_handler(ScenarioActionType.WAIT, self._handle_wait)
        self.register_action_handler(ScenarioActionType.LOG_MESSAGE, self._handle_log)
        self.register_action_handler(ScenarioActionType.CHECKPOINT, self._handle_checkpoint)
    
    def register_action_handler(self, action_type: ScenarioActionType, 
                              handler: Callable[[ScenarioStep, ScenarioExecutionContext], Any]):
        """Register a handler for a specific action type"""
        self.action_handlers[action_type] = handler
    
    def add_event_handler(self, handler: Callable[[str, Dict[str, Any]], None]):
        """Add an event handler for execution events"""
        self.event_handlers.append(handler)
    
    def remove_event_handler(self, handler: Callable[[str, Dict[str, Any]], None]):
        """Remove an event handler"""
        if handler in self.event_handlers:
            self.event_handlers.remove(handler)
    
    async def execute_scenario(self, scenario: Scenario, 
                             variables: Optional[Dict[str, Any]] = None) -> ScenarioExecutionContext:
        """Execute a complete scenario"""
        # Create execution context
        context = ScenarioExecutionContext(
            scenario=scenario,
            variables={**scenario.variables, **(variables or {})}
        )
        
        self.contexts[scenario.scenario_id] = context
        
        try:
            # Execute setup steps
            await self._execute_steps(scenario.setup_steps, context, "setup")
            
            # Execute main steps
            context.status = ScenarioStatus.RUNNING
            context.start_time = datetime.utcnow()
            self._emit_event("scenario_started", {
                'scenario_id': scenario.scenario_id,
                'name': scenario.name
            })
            
            await self._execute_steps(scenario.steps, context, "main")
            
            # Execute teardown steps
            await self._execute_steps(scenario.teardown_steps, context, "teardown")
            
            # Mark completion
            context.status = ScenarioStatus.COMPLETED
            context.end_time = datetime.utcnow()
            
            self._emit_event("scenario_completed", {
                'scenario_id': scenario.scenario_id,
                'duration': (context.end_time - context.start_time).total_seconds(),
                'steps_executed': len(context.executed_steps),
                'assertions_passed': context.assertions_passed,
                'assertions_failed': context.assertions_failed
            })
            
        except Exception as e:
            context.status = ScenarioStatus.FAILED
            context.end_time = datetime.utcnow()
            
            self._emit_event("scenario_failed", {
                'scenario_id': scenario.scenario_id,
                'error': str(e),
                'step_index': context.current_step_index
            })
            
            logger.error(f"Scenario {scenario.scenario_id} failed: {e}")
            raise
        
        finally:
            # Clean up context
            if scenario.scenario_id in self.contexts:
                del self.contexts[scenario.scenario_id]
        
        return context
    
    async def _execute_steps(self, steps: List[ScenarioStep], 
                           context: ScenarioExecutionContext, 
                           phase: str = "main"):
        """Execute a list of steps"""
        for i, step in enumerate(steps):
            if context.status == ScenarioStatus.ABORTED:
                break
            
            # Update current step index for main phase
            if phase == "main":
                context.current_step_index = i
            
            # Check skip condition
            if step.skip_condition and self._evaluate_condition(step.skip_condition, context):
                logger.info(f"Skipping step {step.step_id}: condition met")
                continue
            
            # Execute step with retries
            retry_count = 0
            while retry_count <= step.retry_count:
                try:
                    # Pre-step delay
                    if step.delay_before > 0:
                        await asyncio.sleep(step.delay_before)
                    
                    # Execute step
                    start_time = datetime.utcnow()
                    await self._execute_step(step, context)
                    duration = (datetime.utcnow() - start_time).total_seconds()
                    
                    # Record success
                    context.executed_steps.append(step.step_id)
                    context.step_durations[step.step_id] = duration
                    
                    self._emit_event("step_completed", {
                        'step_id': step.step_id,
                        'duration': duration,
                        'phase': phase
                    })
                    
                    break  # Success, exit retry loop
                    
                except Exception as e:
                    retry_count += 1
                    if retry_count > step.retry_count:
                        # Record failure
                        context.failed_steps.append((step.step_id, str(e)))
                        
                        self._emit_event("step_failed", {
                            'step_id': step.step_id,
                            'error': str(e),
                            'phase': phase
                        })
                        
                        raise
                    else:
                        logger.warning(f"Step {step.step_id} failed, retrying ({retry_count}/{step.retry_count})")
                        await asyncio.sleep(1.0)  # Brief delay before retry
    
    async def _execute_step(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Execute a single step"""
        if step.action_type not in self.action_handlers:
            raise ValueError(f"No handler registered for action type: {step.action_type}")
        
        handler = self.action_handlers[step.action_type]
        
        # Execute with timeout
        try:
            async with asyncio.timeout(step.timeout):
                result = await handler(step, context)
                
                # Record step execution
                context.record_event("step_executed", {
                    'step_id': step.step_id,
                    'action_type': step.action_type.value,
                    'result': result
                })
                
                return result
                
        except asyncio.TimeoutError:
            raise TimeoutError(f"Step {step.step_id} timed out after {step.timeout} seconds")
    
    def _evaluate_condition(self, condition: Dict[str, Any], context: ScenarioExecutionContext) -> bool:
        """Evaluate a condition"""
        # Simple condition evaluation
        # Format: {"variable": "var_name", "operator": "==", "value": expected_value}
        if 'variable' in condition:
            var_name = condition['variable']
            operator = condition.get('operator', '==')
            expected = condition.get('value')
            
            actual = context.variables.get(var_name)
            
            if operator == '==':
                return actual == expected
            elif operator == '!=':
                return actual != expected
            elif operator == '<':
                return actual < expected
            elif operator == '>':
                return actual > expected
            elif operator == '<=':
                return actual <= expected
            elif operator == '>=':
                return actual >= expected
            elif operator == 'in':
                return actual in expected
            elif operator == 'not in':
                return actual not in expected
        
        return False
    
    def _emit_event(self, event_type: str, data: Dict[str, Any]):
        """Emit an event to all handlers"""
        for handler in self.event_handlers:
            try:
                handler(event_type, data)
            except Exception as e:
                logger.error(f"Event handler error: {e}")
    
    # Default action handlers
    
    async def _handle_wait(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle wait action"""
        duration = step.parameters.get('duration', 1.0)
        await asyncio.sleep(duration)
    
    async def _handle_log(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle log message action"""
        message = step.parameters.get('message', '')
        level = step.parameters.get('level', 'info')
        
        # Substitute variables
        for var_name, var_value in context.variables.items():
            message = message.replace(f"${{{var_name}}}", str(var_value))
        
        getattr(logger, level)(f"[Scenario] {message}")
    
    async def _handle_checkpoint(self, step: ScenarioStep, context: ScenarioExecutionContext):
        """Handle checkpoint action"""
        checkpoint_name = step.parameters.get('name', f'checkpoint_{len(context.checkpoints)}')
        
        # Save current state
        context.checkpoints[checkpoint_name] = {
            'timestamp': datetime.utcnow().isoformat(),
            'variables': dict(context.variables),
            'step_index': context.current_step_index
        }
    
    # Recording and playback
    
    def start_recording(self, recording_id: str):
        """Start recording events"""
        self._recordings[recording_id] = []
    
    def stop_recording(self, recording_id: str) -> List[Dict[str, Any]]:
        """Stop recording and return events"""
        if recording_id in self._recordings:
            events = self._recordings[recording_id]
            del self._recordings[recording_id]
            return events
        return []
    
    def save_recording(self, recording_id: str, filepath: Union[str, Path]):
        """Save a recording to file"""
        if recording_id not in self._recordings:
            raise ValueError(f"No recording found with ID: {recording_id}")
        
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        # Compress and save
        with gzip.open(filepath, 'wb') as f:
            pickle.dump(self._recordings[recording_id], f)
    
    def load_recording(self, filepath: Union[str, Path]) -> List[Dict[str, Any]]:
        """Load a recording from file"""
        with gzip.open(filepath, 'rb') as f:
            return pickle.load(f)
    
    async def playback_recording(self, events: List[Dict[str, Any]], speed: float = 1.0):
        """Playback recorded events"""
        if not events:
            return
        
        start_time = datetime.fromisoformat(events[0]['timestamp'])
        
        for event in events:
            event_time = datetime.fromisoformat(event['timestamp'])
            delay = (event_time - start_time).total_seconds() / speed
            
            if delay > 0:
                await asyncio.sleep(delay)
            
            self._emit_event("playback_event", event)
            start_time = event_time


class ScenarioManager:
    """Manages scenarios and their execution"""
    
    def __init__(self, scenarios_dir: Optional[Path] = None):
        self.scenarios_dir = scenarios_dir or Path("scenarios")
        self.scenarios_dir.mkdir(parents=True, exist_ok=True)
        
        self.scenarios: Dict[str, Scenario] = {}
        self.player = ScenarioPlayer()
        
        # Load existing scenarios
        self._load_scenarios()
    
    def _load_scenarios(self):
        """Load scenarios from directory"""
        for filepath in self.scenarios_dir.glob("*.json"):
            try:
                scenario = Scenario.load_from_file(filepath)
                self.scenarios[scenario.scenario_id] = scenario
            except Exception as e:
                logger.error(f"Failed to load scenario from {filepath}: {e}")
    
    def create_scenario(self, name: str, description: str = "") -> Scenario:
        """Create a new scenario"""
        scenario_id = f"scenario_{int(datetime.utcnow().timestamp())}"
        scenario = Scenario(
            scenario_id=scenario_id,
            name=name,
            description=description
        )
        
        self.scenarios[scenario_id] = scenario
        return scenario
    
    def save_scenario(self, scenario_id: str):
        """Save a scenario to file"""
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario not found: {scenario_id}")
        
        scenario = self.scenarios[scenario_id]
        filepath = self.scenarios_dir / f"{scenario_id}.json"
        scenario.save_to_file(filepath)
    
    def delete_scenario(self, scenario_id: str):
        """Delete a scenario"""
        if scenario_id in self.scenarios:
            del self.scenarios[scenario_id]
            
            filepath = self.scenarios_dir / f"{scenario_id}.json"
            if filepath.exists():
                filepath.unlink()
    
    def get_scenario(self, scenario_id: str) -> Optional[Scenario]:
        """Get a scenario by ID"""
        return self.scenarios.get(scenario_id)
    
    def list_scenarios(self) -> List[Dict[str, Any]]:
        """List all available scenarios"""
        return [
            {
                'scenario_id': s.scenario_id,
                'name': s.name,
                'description': s.description,
                'steps': len(s.steps),
                'tags': s.tags,
                'created_at': s.created_at.isoformat()
            }
            for s in self.scenarios.values()
        ]
    
    async def execute_scenario(self, scenario_id: str, 
                             variables: Optional[Dict[str, Any]] = None) -> ScenarioExecutionContext:
        """Execute a scenario"""
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario not found: {scenario_id}")
        
        scenario = self.scenarios[scenario_id]
        return await self.player.execute_scenario(scenario, variables)
    
    def register_action_handler(self, action_type: ScenarioActionType, handler: Callable):
        """Register an action handler with the player"""
        self.player.register_action_handler(action_type, handler)
    
    def add_event_handler(self, handler: Callable[[str, Dict[str, Any]], None]):
        """Add an event handler"""
        self.player.add_event_handler(handler)