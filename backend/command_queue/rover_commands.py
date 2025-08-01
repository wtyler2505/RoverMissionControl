"""
Concrete command implementations for rover operations
"""

import asyncio
import logging
from typing import Dict, Any, Optional

from .command_base import Command, CommandResult, CommandStatus, CommandType, CommandPriority
from .command_factory import register_command


logger = logging.getLogger(__name__)


@register_command(CommandType.MOVE_FORWARD.value)
class MoveForwardCommand(Command):
    """Command to move the rover forward"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.MOVE_FORWARD, **kwargs)
    
    def _validate_parameters(self):
        """Validate move forward parameters"""
        required = ['distance', 'speed']
        for param in required:
            if param not in self.parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        # Validate ranges
        distance = self.parameters['distance']
        speed = self.parameters['speed']
        
        if not 0 < distance <= 100:  # Max 100 meters
            raise ValueError("Distance must be between 0 and 100 meters")
        
        if not 0 < speed <= 1:  # Speed as fraction of max
            raise ValueError("Speed must be between 0 and 1")
    
    async def execute(self) -> CommandResult:
        """Execute move forward command"""
        try:
            distance = self.parameters['distance']
            speed = self.parameters['speed']
            
            # In real implementation, this would interface with rover hardware
            # For now, simulate the movement
            travel_time = distance / (speed * 2.0)  # Assume max speed is 2 m/s
            
            logger.info(f"Moving forward {distance}m at speed {speed}")
            
            # Simulate movement with progress updates
            steps = min(int(travel_time * 10), 100)
            for i in range(steps):
                await asyncio.sleep(travel_time / steps)
                # Could emit progress updates here
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    "distance_traveled": distance,
                    "actual_speed": speed,
                    "travel_time": travel_time
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={"exception": type(e).__name__}
            )


@register_command(CommandType.TURN_LEFT.value)
class TurnLeftCommand(Command):
    """Command to turn the rover left"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.TURN_LEFT, **kwargs)
    
    def _validate_parameters(self):
        """Validate turn parameters"""
        if 'angle' not in self.parameters:
            raise ValueError("Missing required parameter: angle")
        
        angle = self.parameters['angle']
        if not -180 <= angle <= 180:
            raise ValueError("Angle must be between -180 and 180 degrees")
    
    async def execute(self) -> CommandResult:
        """Execute turn left command"""
        try:
            angle = self.parameters['angle']
            speed = self.parameters.get('speed', 0.5)
            
            # Calculate turn time based on angle and speed
            turn_time = abs(angle) / (speed * 90.0)  # Assume 90 deg/s at max speed
            
            logger.info(f"Turning left {angle} degrees")
            
            await asyncio.sleep(turn_time)
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    "angle_turned": angle,
                    "turn_time": turn_time
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e)
            )


@register_command(CommandType.EMERGENCY_STOP.value)
class EmergencyStopCommand(Command):
    """Emergency stop command - highest priority"""
    
    def __init__(self, **kwargs):
        # Force emergency priority
        kwargs['priority'] = CommandPriority.EMERGENCY
        kwargs['timeout_ms'] = kwargs.get('timeout_ms', 1000)  # 1 second timeout
        super().__init__(command_type=CommandType.EMERGENCY_STOP, **kwargs)
    
    def _validate_parameters(self):
        """No parameters needed for emergency stop"""
        pass
    
    async def execute(self) -> CommandResult:
        """Execute emergency stop"""
        try:
            reason = self.parameters.get('reason', 'Manual emergency stop')
            
            logger.warning(f"EMERGENCY STOP: {reason}")
            
            # In real implementation, this would:
            # 1. Immediately stop all motors
            # 2. Cancel all pending movement commands
            # 3. Engage brakes if available
            # 4. Send alerts
            
            # Simulate immediate stop
            await asyncio.sleep(0.1)
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    "reason": reason,
                    "timestamp": self.started_at.isoformat(),
                    "stopped_commands": []  # Would list cancelled commands
                }
            )
            
        except Exception as e:
            # Emergency stop should never fail
            logger.error(f"CRITICAL: Emergency stop failed: {e}")
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=f"Emergency stop failed: {str(e)}"
            )


@register_command(CommandType.SET_SPEED.value)
class SetSpeedCommand(Command):
    """Command to set rover speed"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.SET_SPEED, **kwargs)
    
    def _validate_parameters(self):
        """Validate speed parameters"""
        if 'speed' not in self.parameters:
            raise ValueError("Missing required parameter: speed")
        
        speed = self.parameters['speed']
        if not 0 <= speed <= 1:
            raise ValueError("Speed must be between 0 and 1")
    
    async def execute(self) -> CommandResult:
        """Execute set speed command"""
        try:
            speed = self.parameters['speed']
            ramp_time = self.parameters.get('ramp_time', 1.0)
            
            logger.info(f"Setting speed to {speed} over {ramp_time}s")
            
            # Simulate speed ramping
            steps = int(ramp_time * 10)
            for i in range(steps):
                current_speed = speed * (i + 1) / steps
                await asyncio.sleep(ramp_time / steps)
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    "target_speed": speed,
                    "ramp_time": ramp_time
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e)
            )


@register_command(CommandType.READ_SENSOR.value)
class ReadSensorCommand(Command):
    """Command to read sensor data"""
    
    def __init__(self, **kwargs):
        # Default to low priority for sensor reads
        if 'priority' not in kwargs:
            kwargs['priority'] = CommandPriority.LOW
        super().__init__(command_type=CommandType.READ_SENSOR, **kwargs)
    
    def _validate_parameters(self):
        """Validate sensor parameters"""
        if 'sensor_type' not in self.parameters:
            raise ValueError("Missing required parameter: sensor_type")
        
        valid_sensors = [
            'battery_motor', 'battery_logic', 'temperature',
            'wheel_rpm', 'position', 'orientation', 'hall_sensors'
        ]
        
        if self.parameters['sensor_type'] not in valid_sensors:
            raise ValueError(f"Invalid sensor type. Must be one of: {valid_sensors}")
    
    async def execute(self) -> CommandResult:
        """Execute sensor read"""
        try:
            sensor_type = self.parameters['sensor_type']
            
            # Simulate sensor read delay
            await asyncio.sleep(0.1)
            
            # Mock sensor data based on type
            sensor_data = self._get_mock_sensor_data(sensor_type)
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    "sensor_type": sensor_type,
                    "reading": sensor_data,
                    "timestamp": self.started_at.isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e)
            )
    
    def _get_mock_sensor_data(self, sensor_type: str) -> Any:
        """Get mock sensor data for testing"""
        mock_data = {
            'battery_motor': {"voltage": 36.5, "current": 5.2, "percentage": 85},
            'battery_logic': {"voltage": 25.1, "percentage": 92},
            'temperature': {"celsius": 35.2, "fahrenheit": 95.4},
            'wheel_rpm': {"fl": 120, "fr": 122, "rl": 119, "rr": 121},
            'position': {"x": 10.5, "y": 20.3, "z": 0.0},
            'orientation': {"roll": 0.1, "pitch": -0.5, "yaw": 45.2},
            'hall_sensors': {"fl": 2345, "fr": 2356, "rl": 2340, "rr": 2351}
        }
        return mock_data.get(sensor_type, {})


@register_command(CommandType.DIAGNOSTIC.value)
class DiagnosticCommand(Command):
    """Command to run system diagnostics"""
    
    def __init__(self, **kwargs):
        # Diagnostic commands get longer timeout
        kwargs['timeout_ms'] = kwargs.get('timeout_ms', 30000)  # 30 seconds
        super().__init__(command_type=CommandType.DIAGNOSTIC, **kwargs)
    
    def _validate_parameters(self):
        """Validate diagnostic parameters"""
        diagnostic_level = self.parameters.get('level', 'basic')
        if diagnostic_level not in ['basic', 'full', 'quick']:
            raise ValueError("Diagnostic level must be: basic, full, or quick")
    
    async def execute(self) -> CommandResult:
        """Execute system diagnostics"""
        try:
            level = self.parameters.get('level', 'basic')
            
            logger.info(f"Running {level} diagnostics")
            
            # Simulate diagnostic steps
            diagnostics = {
                'motors': await self._check_motors(),
                'sensors': await self._check_sensors(),
                'communication': await self._check_communication(),
                'battery': await self._check_battery()
            }
            
            if level == 'full':
                diagnostics['memory'] = await self._check_memory()
                diagnostics['storage'] = await self._check_storage()
            
            # Determine overall health
            all_ok = all(diag.get('status') == 'ok' for diag in diagnostics.values())
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    "diagnostic_level": level,
                    "overall_status": "healthy" if all_ok else "issues_detected",
                    "diagnostics": diagnostics
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e)
            )
    
    async def _check_motors(self) -> Dict[str, Any]:
        """Check motor health"""
        await asyncio.sleep(0.5)
        return {
            "status": "ok",
            "details": {
                "fl": "operational",
                "fr": "operational",
                "rl": "operational",
                "rr": "operational"
            }
        }
    
    async def _check_sensors(self) -> Dict[str, Any]:
        """Check sensor health"""
        await asyncio.sleep(0.3)
        return {
            "status": "ok",
            "active_sensors": 12,
            "failed_sensors": 0
        }
    
    async def _check_communication(self) -> Dict[str, Any]:
        """Check communication systems"""
        await asyncio.sleep(0.2)
        return {
            "status": "ok",
            "wifi_strength": -45,  # dBm
            "latency_ms": 23
        }
    
    async def _check_battery(self) -> Dict[str, Any]:
        """Check battery health"""
        await asyncio.sleep(0.2)
        return {
            "status": "ok",
            "motor_battery": {"health": 95, "cycles": 234},
            "logic_battery": {"health": 98, "cycles": 156}
        }
    
    async def _check_memory(self) -> Dict[str, Any]:
        """Check memory usage"""
        await asyncio.sleep(0.1)
        return {
            "status": "ok",
            "ram_usage_percent": 45,
            "swap_usage_percent": 10
        }
    
    async def _check_storage(self) -> Dict[str, Any]:
        """Check storage health"""
        await asyncio.sleep(0.2)
        return {
            "status": "ok",
            "disk_usage_percent": 32,
            "free_space_gb": 68
        }