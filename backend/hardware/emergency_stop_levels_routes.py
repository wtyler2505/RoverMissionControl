"""
Emergency Stop Levels REST API Routes

Provides REST API endpoints for emergency stop levels configuration,
testing, and management. Complements the WebSocket interface with
stateless operations and configuration management.

Features:
- Stop level configuration CRUD operations
- Test scenario management
- System status and diagnostics
- Configuration import/export
- Audit log access
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from dataclasses import asdict
import json
import tempfile
import os

from .emergency_stop_levels import (
    EmergencyStopLevelsService,
    EmergencyStopLevel,
    StopLevelConfiguration,
    StopAction,
    AutomaticTrigger,
    SystemState,
    TestScenario,
    TestExecutionResult,
    StopExecution,
)

# Pydantic models for API requests/responses

class StopActionModel(BaseModel):
    id: str
    name: str
    description: str
    order: int
    timeout: float
    critical: bool
    retry_count: int = 0
    rollback_action: Optional[str] = None


class AutomaticTriggerModel(BaseModel):
    id: str
    name: str
    description: str
    enabled: bool
    condition: str
    threshold: float
    comparison_operator: str = Field(..., regex=r'^(>|<|>=|<=|==|!=)$')
    data_source: str
    debounce_time: float
    priority: int


class StopLevelConfigurationModel(BaseModel):
    level: int = Field(..., ge=1, le=5)
    name: str
    description: str
    enabled: bool
    estimated_duration: float
    confirmation_required: bool
    confirmation_timeout: float
    actions: List[StopActionModel]
    automatic_triggers: List[AutomaticTriggerModel]
    custom_parameters: Dict[str, Any] = {}


class SystemStateModel(BaseModel):
    is_moving: bool
    power_level: float
    sensors_active: int
    communication_health: str
    battery_level: float
    emergency_battery: bool
    hardware_status: str
    timestamp: Optional[datetime] = None


class TestScenarioModel(BaseModel):
    id: str
    name: str
    type: str
    description: str
    duration: float
    stop_levels: List[int]
    parameters: Dict[str, Any]
    expected_results: List[str]
    validation_criteria: List[str]
    automated_validation: bool


class ExecuteStopLevelRequest(BaseModel):
    level: int = Field(..., ge=1, le=5)
    test_mode: bool = False
    confirmation_override: bool = False


class TestModeRequest(BaseModel):
    enabled: bool


class ConfigurationExportModel(BaseModel):
    stop_levels: Dict[str, StopLevelConfigurationModel]
    test_mode: bool
    export_date: str
    version: str


def create_emergency_stop_levels_router(
    emergency_stop_service: EmergencyStopLevelsService
) -> APIRouter:
    """Create FastAPI router for emergency stop levels"""
    
    router = APIRouter(
        prefix="/api/emergency-stop-levels",
        tags=["Emergency Stop Levels"]
    )
    
    # Dependency to get the service
    def get_service() -> EmergencyStopLevelsService:
        return emergency_stop_service
    
    @router.get("/status", response_model=Dict[str, Any])
    async def get_system_status(service: EmergencyStopLevelsService = Depends(get_service)):
        """Get current system status"""
        try:
            system_state = service.get_system_state()
            current_execution = service.get_current_execution()
            
            return {
                "system_state": asdict(system_state),
                "current_execution": asdict(current_execution) if current_execution else None,
                "test_mode": service.test_mode,
                "available_levels": [level.value for level in EmergencyStopLevel],
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/execute", response_model=Dict[str, Any])
    async def execute_stop_level(
        request: ExecuteStopLevelRequest,
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Execute an emergency stop level"""
        try:
            level = EmergencyStopLevel(request.level)
            
            if not request.test_mode and service.test_mode:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot execute real stop level while in test mode"
                )
                
            if request.test_mode and not service.test_mode:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot execute test while not in test mode"
                )
            
            execution = await service.execute_stop_level(level, request.test_mode)
            
            return {
                "success": True,
                "execution": asdict(execution),
                "message": f"Stop level {level.value} execution started",
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/cancel", response_model=Dict[str, Any])
    async def cancel_execution(service: EmergencyStopLevelsService = Depends(get_service)):
        """Cancel current stop level execution"""
        try:
            success = await service.cancel_execution()
            
            return {
                "success": success,
                "message": "Execution cancelled" if success else "No execution to cancel",
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/test-mode", response_model=Dict[str, Any])
    async def set_test_mode(
        request: TestModeRequest,
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Set test mode on/off"""
        try:
            await service.set_test_mode(request.enabled)
            
            return {
                "success": True,
                "test_mode": request.enabled,
                "message": f"Test mode {'enabled' if request.enabled else 'disabled'}",
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/configurations", response_model=Dict[int, StopLevelConfigurationModel])
    async def get_configurations(service: EmergencyStopLevelsService = Depends(get_service)):
        """Get all stop level configurations"""
        try:
            configurations = {}
            
            for level in EmergencyStopLevel:
                config = service.get_configuration(level)
                if config:
                    configurations[level.value] = StopLevelConfigurationModel(
                        level=config.level.value,
                        name=config.name,
                        description=config.description,
                        enabled=config.enabled,
                        estimated_duration=config.estimated_duration,
                        confirmation_required=config.confirmation_required,
                        confirmation_timeout=config.confirmation_timeout,
                        actions=[
                            StopActionModel(**asdict(action)) for action in config.actions
                        ],
                        automatic_triggers=[
                            AutomaticTriggerModel(**asdict(trigger)) 
                            for trigger in config.automatic_triggers
                        ],
                        custom_parameters=config.custom_parameters,
                    )
            
            return configurations
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/configurations/{level}", response_model=StopLevelConfigurationModel)
    async def get_configuration(
        level: int = Field(..., ge=1, le=5),
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Get configuration for a specific stop level"""
        try:
            stop_level = EmergencyStopLevel(level)
            config = service.get_configuration(stop_level)
            
            if not config:
                raise HTTPException(status_code=404, detail=f"Configuration for level {level} not found")
            
            return StopLevelConfigurationModel(
                level=config.level.value,
                name=config.name,
                description=config.description,
                enabled=config.enabled,
                estimated_duration=config.estimated_duration,
                confirmation_required=config.confirmation_required,
                confirmation_timeout=config.confirmation_timeout,
                actions=[StopActionModel(**asdict(action)) for action in config.actions],
                automatic_triggers=[
                    AutomaticTriggerModel(**asdict(trigger)) 
                    for trigger in config.automatic_triggers
                ],
                custom_parameters=config.custom_parameters,
            )
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.put("/configurations/{level}", response_model=Dict[str, Any])
    async def update_configuration(
        level: int = Field(..., ge=1, le=5),
        config_model: StopLevelConfigurationModel = Body(...),
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Update configuration for a specific stop level"""
        try:
            stop_level = EmergencyStopLevel(level)
            
            # Convert from Pydantic model to dataclass
            actions = [
                StopAction(
                    id=action.id,
                    name=action.name,
                    description=action.description,
                    order=action.order,
                    timeout=action.timeout,
                    critical=action.critical,
                    retry_count=action.retry_count,
                    rollback_action=action.rollback_action,
                ) for action in config_model.actions
            ]
            
            triggers = [
                AutomaticTrigger(
                    id=trigger.id,
                    name=trigger.name,
                    description=trigger.description,
                    enabled=trigger.enabled,
                    condition=trigger.condition,
                    threshold=trigger.threshold,
                    comparison_operator=trigger.comparison_operator,
                    data_source=trigger.data_source,
                    debounce_time=trigger.debounce_time,
                    priority=trigger.priority,
                ) for trigger in config_model.automatic_triggers
            ]
            
            config = StopLevelConfiguration(
                level=stop_level,
                name=config_model.name,
                description=config_model.description,
                enabled=config_model.enabled,
                estimated_duration=config_model.estimated_duration,
                confirmation_required=config_model.confirmation_required,
                confirmation_timeout=config_model.confirmation_timeout,
                actions=actions,
                automatic_triggers=triggers,
                custom_parameters=config_model.custom_parameters,
            )
            
            service.update_configuration(stop_level, config)
            
            return {
                "success": True,
                "message": f"Configuration for level {level} updated successfully",
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/configurations/{level}/test", response_model=Dict[str, Any])
    async def test_configuration(
        level: int = Field(..., ge=1, le=5),
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Test a stop level configuration"""
        try:
            stop_level = EmergencyStopLevel(level)
            config = service.get_configuration(stop_level)
            
            if not config:
                raise HTTPException(status_code=404, detail=f"Configuration for level {level} not found")
            
            # Perform configuration validation
            errors = []
            warnings = []
            
            if not config.enabled:
                warnings.append("Configuration is disabled")
            
            if len(config.actions) == 0:
                errors.append("No actions configured")
            
            if config.estimated_duration <= 0:
                errors.append("Invalid estimated duration")
            
            # Check action ordering
            orders = [action.order for action in config.actions]
            if len(orders) != len(set(orders)):
                errors.append("Duplicate action orders found")
            
            # Check trigger configuration
            for trigger in config.automatic_triggers:
                if trigger.enabled and trigger.threshold < 0:
                    warnings.append(f"Trigger {trigger.name} has negative threshold")
            
            is_valid = len(errors) == 0
            
            return {
                "success": True,
                "valid": is_valid,
                "errors": errors,
                "warnings": warnings,
                "level": level,
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/test-results", response_model=List[Dict[str, Any]])
    async def get_test_results(
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0),
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Get test execution results"""
        try:
            all_results = service.get_test_results()
            
            # Apply pagination
            start = offset
            end = offset + limit
            paginated_results = all_results[start:end]
            
            return [asdict(result) for result in paginated_results]
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/test-scenarios", response_model=Dict[str, Any])
    async def execute_test_scenario(
        scenario_model: TestScenarioModel,
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Execute a test scenario"""
        try:
            if not service.test_mode:
                raise HTTPException(
                    status_code=400,
                    detail="Test scenarios can only be executed in test mode"
                )
            
            # Convert to TestScenario dataclass
            scenario = TestScenario(
                id=scenario_model.id,
                name=scenario_model.name,
                type=scenario_model.type,
                description=scenario_model.description,
                duration=scenario_model.duration,
                stop_levels=[EmergencyStopLevel(level) for level in scenario_model.stop_levels],
                parameters=scenario_model.parameters,
                expected_results=scenario_model.expected_results,
                validation_criteria=scenario_model.validation_criteria,
                automated_validation=scenario_model.automated_validation,
            )
            
            # Start test execution asynchronously
            import asyncio
            task = asyncio.create_task(service.execute_test_scenario(scenario))
            
            return {
                "success": True,
                "scenario_id": scenario.id,
                "message": "Test scenario execution started",
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/export", response_class=FileResponse)
    async def export_configuration(service: EmergencyStopLevelsService = Depends(get_service)):
        """Export all configurations to JSON file"""
        try:
            config_data = service.export_configuration()
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(config_data, f, indent=2, default=str)
                temp_file = f.name
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"emergency_stop_configuration_{timestamp}.json"
            
            return FileResponse(
                path=temp_file,
                filename=filename,
                media_type='application/json',
                background=lambda: os.unlink(temp_file)  # Clean up temp file
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.post("/import", response_model=Dict[str, Any])
    async def import_configuration(
        config_data: Dict[str, Any] = Body(...),
        service: EmergencyStopLevelsService = Depends(get_service)
    ):
        """Import configuration from JSON data"""
        try:
            service.import_configuration(config_data)
            
            return {
                "success": True,
                "message": "Configuration imported successfully",
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
    
    @router.get("/health", response_model=Dict[str, Any])
    async def health_check(service: EmergencyStopLevelsService = Depends(get_service)):
        """Health check endpoint"""
        try:
            system_state = service.get_system_state()
            
            # Basic health checks
            health_status = "healthy"
            issues = []
            
            if system_state.battery_level < 10:
                health_status = "warning"
                issues.append("Low battery level")
            
            if system_state.communication_health in ["poor", "lost"]:
                health_status = "critical" if system_state.communication_health == "lost" else "warning"
                issues.append(f"Communication health: {system_state.communication_health}")
            
            if system_state.hardware_status in ["error", "critical"]:
                health_status = "critical"
                issues.append(f"Hardware status: {system_state.hardware_status}")
            
            return {
                "status": health_status,
                "timestamp": datetime.now().isoformat(),
                "system_state": asdict(system_state),
                "issues": issues,
                "test_mode": service.test_mode,
            }
            
        except Exception as e:
            return {
                "status": "error",
                "timestamp": datetime.now().isoformat(),
                "error": str(e),
            }
    
    return router