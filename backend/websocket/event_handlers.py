"""
Event Handler Registry and Message Routing System

This module provides a comprehensive event handling system for WebSocket messages:
- Message routing and dispatching
- Command validation and processing
- Telemetry streaming management
- Real-time rover control
- System monitoring and alerts
- Error handling and recovery
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any, Callable, Union, Awaitable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import traceback

from .connection_manager import ConnectionInfo, ConnectionManager
from .message_protocols import ProtocolType, MessageProtocolManager
from ..auth.models import User


class AlertPriority(Enum):
    """Alert priority levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class AlertMessage:
    """Alert message structure"""
    id: str
    type: str  # 'new', 'update', 'remove', 'clear'
    priority: AlertPriority
    timestamp: datetime
    data: Dict[str, Any]
    client_id: Optional[str] = None
    sync_id: Optional[str] = None
    batch_id: Optional[str] = None


@dataclass
class AlertAcknowledgment:
    """Alert acknowledgment structure"""
    alert_id: str
    acknowledged_by: str
    acknowledged_at: datetime
    client_id: str
    sync_across_clients: bool = True


class AlertManager:
    """Manages alert distribution and synchronization across clients"""

    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.active_alerts: Dict[str, AlertMessage] = {}
        self.acknowledged_alerts: Set[str] = set()
        self.client_subscriptions: Dict[str, Dict[str, Any]] = {}
        self.alert_history: List[AlertMessage] = []
        self.max_history_size = 1000

    async def create_alert(
        self,
        priority: AlertPriority,
        title: str,
        message: str,
        source: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
        group_id: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> str:
        """Create and distribute new alert"""
        alert_id = self._generate_alert_id()
        
        alert = AlertMessage(
            id=alert_id,
            type="new",
            priority=priority,
            timestamp=datetime.utcnow(),
            data={
                "title": title,
                "message": message,
                "source": source,
                "metadata": metadata or {},
                "group_id": group_id,
                "expires_at": expires_at.isoformat() if expires_at else None,
                "closable": priority != AlertPriority.CRITICAL,
                "persistent": priority == AlertPriority.CRITICAL
            }
        )

        # Store alert
        self.active_alerts[alert_id] = alert
        self.alert_history.append(alert)
        
        # Trim history if needed
        if len(self.alert_history) > self.max_history_size:
            self.alert_history = self.alert_history[-self.max_history_size:]

        # Distribute to subscribed clients
        await self._distribute_alert(alert)
        
        return alert_id

    async def acknowledge_alert(
        self,
        alert_id: str,
        acknowledged_by: str,
        client_id: str,
        sync_across_clients: bool = True
    ) -> CommandResult:
        """Acknowledge an alert"""
        try:
            if alert_id not in self.active_alerts:
                return CommandResult(False, "Alert not found", error_code="ALERT_NOT_FOUND")

            # Create acknowledgment
            ack = AlertAcknowledgment(
                alert_id=alert_id,
                acknowledged_by=acknowledged_by,
                acknowledged_at=datetime.utcnow(),
                client_id=client_id,
                sync_across_clients=sync_across_clients
            )

            # Mark as acknowledged
            self.acknowledged_alerts.add(alert_id)
            
            # Update alert data
            alert = self.active_alerts[alert_id]
            alert.data["acknowledged"] = True
            alert.data["acknowledged_by"] = acknowledged_by
            alert.data["acknowledged_at"] = ack.acknowledged_at.isoformat()

            # Distribute acknowledgment if required
            if sync_across_clients:
                await self._distribute_acknowledgment(ack)

            logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
            return CommandResult(True, "Alert acknowledged", data=ack.__dict__)

        except Exception as e:
            logger.error(f"Error acknowledging alert: {e}")
            return CommandResult(False, f"Acknowledgment error: {str(e)}", error_code="ACK_ERROR")

    async def sync_alerts(
        self,
        client_id: str,
        last_sync_timestamp: Optional[int] = None,
        priorities: Optional[List[str]] = None,
        include_acknowledged: bool = False,
        max_count: int = 100
    ) -> Dict[str, Any]:
        """Synchronize alerts with client"""
        try:
            # Convert timestamp
            if last_sync_timestamp:
                sync_time = datetime.fromtimestamp(last_sync_timestamp / 1000)
            else:
                sync_time = datetime.min

            # Filter alerts
            filtered_alerts = []
            
            for alert in self.active_alerts.values():
                # Check timestamp
                if alert.timestamp <= sync_time:
                    continue
                
                # Check priority filter
                if priorities and alert.priority.value not in priorities:
                    continue
                
                # Check acknowledgment filter
                if not include_acknowledged and alert.id in self.acknowledged_alerts:
                    continue
                
                filtered_alerts.append(alert)

            # Sort by timestamp and limit
            filtered_alerts.sort(key=lambda a: a.timestamp)
            if len(filtered_alerts) > max_count:
                filtered_alerts = filtered_alerts[:max_count]

            # Convert to response format
            alert_data = []
            for alert in filtered_alerts:
                alert_data.append({
                    "id": alert.id,
                    "type": alert.type,
                    "priority": alert.priority.value,
                    "timestamp": int(alert.timestamp.timestamp() * 1000),
                    "data": alert.data
                })

            response = {
                "alerts": alert_data,
                "sync_timestamp": int(datetime.utcnow().timestamp() * 1000),
                "has_more": len(self.active_alerts) > max_count,
                "total_count": len(self.active_alerts)
            }

            logger.info(f"Synced {len(alert_data)} alerts for client {client_id}")
            return response

        except Exception as e:
            logger.error(f"Error syncing alerts: {e}")
            raise

    async def clear_alerts(
        self,
        priority: Optional[AlertPriority] = None,
        source: Optional[str] = None,
        group_id: Optional[str] = None
    ) -> CommandResult:
        """Clear alerts based on criteria"""
        try:
            removed_count = 0
            to_remove = []

            for alert_id, alert in self.active_alerts.items():
                should_remove = True
                
                if priority and alert.priority != priority:
                    should_remove = False
                
                if source and alert.data.get("source") != source:
                    should_remove = False
                
                if group_id and alert.data.get("group_id") != group_id:
                    should_remove = False
                
                if should_remove:
                    to_remove.append(alert_id)

            # Remove alerts
            for alert_id in to_remove:
                del self.active_alerts[alert_id]
                self.acknowledged_alerts.discard(alert_id)
                removed_count += 1

            # Notify clients
            clear_message = AlertMessage(
                id=self._generate_alert_id(),
                type="clear",
                priority=priority or AlertPriority.INFO,
                timestamp=datetime.utcnow(),
                data={
                    "cleared_count": removed_count,
                    "criteria": {
                        "priority": priority.value if priority else None,
                        "source": source,
                        "group_id": group_id
                    }
                }
            )
            
            await self._distribute_alert(clear_message)

            logger.info(f"Cleared {removed_count} alerts")
            return CommandResult(True, f"Cleared {removed_count} alerts", 
                               data={"count": removed_count})

        except Exception as e:
            logger.error(f"Error clearing alerts: {e}")
            return CommandResult(False, f"Clear error: {str(e)}", error_code="CLEAR_ERROR")

    async def subscribe_client(
        self,
        client_id: str,
        priorities: List[str],
        auto_acknowledge_info: bool = True
    ):
        """Subscribe client to alert notifications"""
        self.client_subscriptions[client_id] = {
            "priorities": set(priorities),
            "auto_acknowledge_info": auto_acknowledge_info,
            "subscribed_at": datetime.utcnow()
        }
        
        logger.info(f"Client {client_id} subscribed to alerts: {priorities}")

    async def unsubscribe_client(self, client_id: str):
        """Unsubscribe client from alert notifications"""
        if client_id in self.client_subscriptions:
            del self.client_subscriptions[client_id]
            logger.info(f"Client {client_id} unsubscribed from alerts")

    async def _distribute_alert(self, alert: AlertMessage):
        """Distribute alert to subscribed clients"""
        message_data = {
            "id": alert.id,
            "type": alert.type,
            "priority": alert.priority.value,
            "timestamp": int(alert.timestamp.timestamp() * 1000),
            "data": alert.data
        }

        # Send to all subscribed clients
        for client_id, subscription in self.client_subscriptions.items():
            if alert.priority.value in subscription["priorities"]:
                try:
                    connection_info = await self.connection_manager.get_connection(client_id)
                    if connection_info and connection_info.socket:
                        await connection_info.socket.emit("alert", message_data)
                except Exception as e:
                    logger.error(f"Failed to send alert to client {client_id}: {e}")

    async def _distribute_acknowledgment(self, ack: AlertAcknowledgment):
        """Distribute acknowledgment to other clients"""
        ack_data = {
            "alert_id": ack.alert_id,
            "acknowledged_by": ack.acknowledged_by,
            "acknowledged_at": int(ack.acknowledged_at.timestamp() * 1000),
            "client_id": ack.client_id
        }

        # Send to all clients except the acknowledging one
        for client_id in self.client_subscriptions.keys():
            if client_id != ack.client_id:
                try:
                    connection_info = await self.connection_manager.get_connection(client_id)
                    if connection_info and connection_info.socket:
                        await connection_info.socket.emit("alert_ack", ack_data)
                except Exception as e:
                    logger.error(f"Failed to send acknowledgment to client {client_id}: {e}")

    def _generate_alert_id(self) -> str:
        """Generate unique alert ID"""
        return f"alert_{int(datetime.utcnow().timestamp() * 1000)}_{id(self) % 10000}"

    def get_stats(self) -> Dict[str, Any]:
        """Get alert manager statistics"""
        return {
            "active_alerts": len(self.active_alerts),
            "acknowledged_alerts": len(self.acknowledged_alerts),
            "subscribed_clients": len(self.client_subscriptions),
            "total_history": len(self.alert_history),
            "alerts_by_priority": {
                priority.value: sum(1 for a in self.active_alerts.values() 
                                  if a.priority == priority)
                for priority in AlertPriority
            }
        }


logger = logging.getLogger(__name__)


class EventType(Enum):
    """Event type enumeration"""
    ROVER_COMMAND = "rover_command"
    TELEMETRY_REQUEST = "telemetry_request"
    SUBSCRIPTION = "subscription"
    SYSTEM_STATUS = "system_status"
    ERROR = "error"
    HEARTBEAT = "heartbeat"
    AUTH = "auth"
    BINARY_DATA = "binary_data"
    # Alert-specific event types
    ALERT = "alert"
    ALERT_ACK = "alert_ack"
    ALERT_SYNC = "alert_sync"
    ALERT_BATCH = "alert_batch"


class CommandType(Enum):
    """Rover command types"""
    MOVE = "move"
    STOP = "stop"
    EMERGENCY_STOP = "emergency_stop"
    RESUME = "resume"
    GET_STATUS = "get_status"
    SET_SPEED = "set_speed"
    CALIBRATE = "calibrate"
    RESET = "reset"
    UPDATE_CONFIG = "update_config"


@dataclass
class EventContext:
    """Context information for event processing"""
    sid: str
    connection_info: ConnectionInfo
    event_type: EventType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None
    user: Optional[User] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary"""
        return {
            "sid": self.sid,
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "request_id": self.request_id,
            "user_id": self.user.id if self.user else None,
            "username": self.user.username if self.user else None,
            "client_type": self.connection_info.client_type,
            "protocol": self.connection_info.protocol.value
        }


@dataclass
class CommandResult:
    """Result of command processing"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary"""
        result = {
            "success": self.success,
            "message": self.message,
            "timestamp": self.timestamp.isoformat()
        }
        if self.data:
            result["data"] = self.data
        if self.error_code:
            result["error_code"] = self.error_code
        return result


class TelemetryStreamer:
    """Manages telemetry streaming to connected clients"""
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
        self.active_streams: Dict[str, Dict[str, Any]] = {}
        self.stream_configs: Dict[str, Dict[str, Any]] = {
            "basic": {
                "fields": ["timestamp", "battery", "temperature", "emergency_stop"],
                "frequency": 1.0  # Hz
            },
            "full": {
                "fields": ["timestamp", "wheels", "battery", "temperature", "position", 
                          "orientation", "velocity", "control", "emergency_stop", "alerts"],
                "frequency": 10.0  # Hz
            },
            "diagnostics": {
                "fields": ["timestamp", "wheels", "battery", "temperature", "motor_faults", 
                          "system_health", "latency", "uptime"],
                "frequency": 0.5  # Hz
            }
        }
    
    async def start_stream(
        self,
        sid: str,
        stream_type: str = "basic",
        custom_fields: Optional[List[str]] = None,
        frequency: Optional[float] = None
    ) -> CommandResult:
        """Start telemetry stream for a connection"""
        try:
            connection_info = await self.connection_manager.get_connection(sid)
            if not connection_info:
                return CommandResult(False, "Connection not found", error_code="CONNECTION_NOT_FOUND")
            
            # Check authorization
            if not await self._authorize_telemetry_stream(connection_info.user, stream_type):
                return CommandResult(False, "Unauthorized", error_code="UNAUTHORIZED")
            
            # Get or validate stream configuration
            if stream_type in self.stream_configs:
                config = self.stream_configs[stream_type].copy()
            else:
                return CommandResult(False, f"Unknown stream type: {stream_type}", error_code="INVALID_STREAM_TYPE")
            
            # Apply custom configuration
            if custom_fields:
                config["fields"] = custom_fields
            if frequency:
                config["frequency"] = frequency
            
            # Store stream configuration
            self.active_streams[sid] = {
                "type": stream_type,
                "config": config,
                "last_update": datetime.utcnow(),
                "message_count": 0
            }
            
            logger.info(f"Started {stream_type} telemetry stream for {sid}")
            return CommandResult(True, f"Started {stream_type} telemetry stream", data=config)
            
        except Exception as e:
            logger.error(f"Error starting telemetry stream: {e}")
            return CommandResult(False, f"Stream error: {str(e)}", error_code="STREAM_ERROR")
    
    async def stop_stream(self, sid: str) -> CommandResult:
        """Stop telemetry stream for a connection"""
        try:
            if sid in self.active_streams:
                stream_info = self.active_streams.pop(sid)
                logger.info(f"Stopped telemetry stream for {sid} (sent {stream_info['message_count']} messages)")
                return CommandResult(True, "Telemetry stream stopped")
            else:
                return CommandResult(False, "No active stream found", error_code="NO_STREAM")
        except Exception as e:
            logger.error(f"Error stopping telemetry stream: {e}")
            return CommandResult(False, f"Stop stream error: {str(e)}", error_code="STOP_ERROR")
    
    async def _authorize_telemetry_stream(self, user: Optional[User], stream_type: str) -> bool:
        """Check if user is authorized for telemetry stream type"""
        if not user:
            return stream_type == "basic"  # Anonymous users can only access basic telemetry
        
        # Define authorization rules
        auth_rules = {
            "basic": ["admin", "operator", "viewer"],
            "full": ["admin", "operator"],
            "diagnostics": ["admin"]
        }
        
        allowed_roles = auth_rules.get(stream_type, [])
        user_roles = [role.name for role in user.roles]
        return any(role in allowed_roles for role in user_roles)
    
    def get_active_streams(self) -> Dict[str, Dict[str, Any]]:
        """Get information about active streams"""
        return self.active_streams.copy()
    
    async def cleanup_stream(self, sid: str):
        """Clean up stream when connection is closed"""
        self.active_streams.pop(sid, None)


class RoverController:
    """Handles rover control commands with safety and validation"""
    
    def __init__(self):
        self.command_history: List[Dict[str, Any]] = []
        self.safety_limits = {
            "max_speed": 1.0,
            "max_turn_rate": 1.0,
            "emergency_stop_timeout": 0.5,  # seconds
            "command_timeout": 2.0  # seconds
        }
        self.last_command_time = None
        self.emergency_state = False
    
    async def process_command(
        self,
        command_type: CommandType,
        parameters: Dict[str, Any],
        context: EventContext
    ) -> CommandResult:
        """Process rover control command with validation and safety checks"""
        try:
            # Check authorization
            if not await self._authorize_command(context.user, command_type):
                return CommandResult(False, "Unauthorized command", error_code="UNAUTHORIZED")
            
            # Validate command parameters
            validation_result = await self._validate_command(command_type, parameters)
            if not validation_result.success:
                return validation_result
            
            # Apply safety limits
            safe_parameters = await self._apply_safety_limits(command_type, parameters)
            
            # Execute command
            result = await self._execute_command(command_type, safe_parameters, context)
            
            # Log command
            self._log_command(command_type, safe_parameters, context, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Command processing error: {e}")
            return CommandResult(False, f"Command error: {str(e)}", error_code="COMMAND_ERROR")
    
    async def _authorize_command(self, user: Optional[User], command_type: CommandType) -> bool:
        """Check if user is authorized to execute command"""
        if not user:
            return command_type in [CommandType.GET_STATUS]  # Anonymous users can only get status
        
        # Define command authorization
        command_auth = {
            CommandType.MOVE: ["admin", "operator"],
            CommandType.STOP: ["admin", "operator", "viewer"],  # Anyone can stop
            CommandType.EMERGENCY_STOP: ["admin", "operator", "viewer"],  # Anyone can emergency stop
            CommandType.RESUME: ["admin", "operator"],
            CommandType.GET_STATUS: ["admin", "operator", "viewer"],
            CommandType.SET_SPEED: ["admin", "operator"],
            CommandType.CALIBRATE: ["admin"],
            CommandType.RESET: ["admin"],
            CommandType.UPDATE_CONFIG: ["admin"]
        }
        
        allowed_roles = command_auth.get(command_type, [])
        user_roles = [role.name for role in user.roles]
        return any(role in allowed_roles for role in user_roles)
    
    async def _validate_command(self, command_type: CommandType, parameters: Dict[str, Any]) -> CommandResult:
        """Validate command parameters"""
        try:
            if command_type == CommandType.MOVE:
                forward = parameters.get("forward", 0.0)
                turn = parameters.get("turn", 0.0)
                speed = parameters.get("speed", 1.0)
                
                if not all(isinstance(x, (int, float)) for x in [forward, turn, speed]):
                    return CommandResult(False, "Invalid parameter types", error_code="INVALID_PARAMS")
                
                if not (-1.0 <= forward <= 1.0 and -1.0 <= turn <= 1.0 and 0.0 <= speed <= 1.0):
                    return CommandResult(False, "Parameters out of range", error_code="OUT_OF_RANGE")
            
            elif command_type == CommandType.SET_SPEED:
                speed = parameters.get("speed", 1.0)
                if not isinstance(speed, (int, float)) or not (0.0 <= speed <= 1.0):
                    return CommandResult(False, "Invalid speed parameter", error_code="INVALID_SPEED")
            
            elif command_type == CommandType.UPDATE_CONFIG:
                if "config" not in parameters or not isinstance(parameters["config"], dict):
                    return CommandResult(False, "Invalid configuration", error_code="INVALID_CONFIG")
            
            return CommandResult(True, "Command validated")
            
        except Exception as e:
            return CommandResult(False, f"Validation error: {str(e)}", error_code="VALIDATION_ERROR")
    
    async def _apply_safety_limits(self, command_type: CommandType, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Apply safety limits to command parameters"""
        safe_params = parameters.copy()
        
        if command_type == CommandType.MOVE:
            # Clamp values to safety limits
            safe_params["forward"] = max(-self.safety_limits["max_speed"], 
                                       min(self.safety_limits["max_speed"], parameters.get("forward", 0.0)))
            safe_params["turn"] = max(-self.safety_limits["max_turn_rate"], 
                                    min(self.safety_limits["max_turn_rate"], parameters.get("turn", 0.0)))
            safe_params["speed"] = max(0.0, min(1.0, parameters.get("speed", 1.0)))
            
            # Emergency stop override
            if self.emergency_state:
                safe_params["forward"] = 0.0
                safe_params["turn"] = 0.0
                safe_params["speed"] = 0.0
        
        return safe_params
    
    async def _execute_command(
        self,
        command_type: CommandType,
        parameters: Dict[str, Any],
        context: EventContext
    ) -> CommandResult:
        """Execute the rover command"""
        # This would integrate with the actual rover control system
        # For now, we'll simulate the execution
        
        current_time = datetime.utcnow()
        
        try:
            if command_type == CommandType.MOVE:
                # Simulate rover movement command
                result_data = {
                    "forward": parameters["forward"],
                    "turn": parameters["turn"],
                    "speed": parameters["speed"],
                    "timestamp": current_time.isoformat()
                }
                self.last_command_time = current_time
                return CommandResult(True, "Movement command executed", data=result_data)
            
            elif command_type == CommandType.STOP:
                self.last_command_time = current_time
                return CommandResult(True, "Rover stopped", data={"timestamp": current_time.isoformat()})
            
            elif command_type == CommandType.EMERGENCY_STOP:
                self.emergency_state = True
                self.last_command_time = current_time
                return CommandResult(True, "Emergency stop activated", data={"timestamp": current_time.isoformat()})
            
            elif command_type == CommandType.RESUME:
                self.emergency_state = False
                self.last_command_time = current_time
                return CommandResult(True, "Rover resumed", data={"timestamp": current_time.isoformat()})
            
            elif command_type == CommandType.GET_STATUS:
                # Return current rover status
                status_data = {
                    "timestamp": current_time.isoformat(),
                    "emergency_stop": self.emergency_state,
                    "last_command": self.last_command_time.isoformat() if self.last_command_time else None,
                    "safety_limits": self.safety_limits
                }
                return CommandResult(True, "Status retrieved", data=status_data)
            
            else:
                return CommandResult(False, f"Unimplemented command: {command_type.value}", error_code="NOT_IMPLEMENTED")
                
        except Exception as e:
            logger.error(f"Command execution error: {e}")
            return CommandResult(False, f"Execution error: {str(e)}", error_code="EXECUTION_ERROR")
    
    def _log_command(
        self,
        command_type: CommandType,
        parameters: Dict[str, Any],
        context: EventContext,
        result: CommandResult
    ):
        """Log command execution for audit trail"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "command_type": command_type.value,
            "parameters": parameters,
            "user_id": context.user.id if context.user else None,
            "username": context.user.username if context.user else "anonymous",
            "sid": context.sid,
            "client_type": context.connection_info.client_type,
            "success": result.success,
            "message": result.message,
            "error_code": result.error_code
        }
        
        self.command_history.append(log_entry)
        
        # Keep only last 1000 commands
        if len(self.command_history) > 1000:
            self.command_history = self.command_history[-1000:]
        
        logger.info(f"Command logged: {command_type.value} by {log_entry['username']} - {result.message}")
    
    def get_command_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent command history"""
        return self.command_history[-limit:]


class EventHandlerRegistry:
    """Central registry for WebSocket event handlers"""
    
    def __init__(self):
        self.telemetry_streamer = None
        self.rover_controller = RoverController()
        self.alert_manager = None
        self.protocol_manager = None
        self.connection_manager = None
        
        # Handler registry
        self._handlers: Dict[str, Callable] = {}
        self._middleware: List[Callable] = []
        
        # Statistics
        self.stats = {
            "events_processed": 0,
            "errors": 0,
            "command_count": 0,
            "telemetry_requests": 0
        }
        
        self._register_default_handlers()
    
    def initialize(self, connection_manager: ConnectionManager, protocol_manager: MessageProtocolManager):
        """Initialize with required components"""
        self.connection_manager = connection_manager
        self.protocol_manager = protocol_manager
        self.telemetry_streamer = TelemetryStreamer(connection_manager)
        self.alert_manager = AlertManager(connection_manager)
    
    def _register_default_handlers(self):
        """Register default event handlers"""
        
        @self.handler("rover_command")
        async def handle_rover_command(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle rover control commands"""
            try:
                command_type_str = data.get("command")
                parameters = data.get("parameters", {})
                
                if not command_type_str:
                    return {"error": "Missing command type"}
                
                try:
                    command_type = CommandType(command_type_str)
                except ValueError:
                    return {"error": f"Invalid command type: {command_type_str}"}
                
                result = await self.rover_controller.process_command(command_type, parameters, context)
                self.stats["command_count"] += 1
                
                return result.to_dict()
                
            except Exception as e:
                logger.error(f"Rover command handler error: {e}")
                return {"error": str(e)}
        
        @self.handler("telemetry_subscribe")
        async def handle_telemetry_subscribe(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle telemetry subscription requests"""
            try:
                stream_type = data.get("stream_type", "basic")
                custom_fields = data.get("fields")
                frequency = data.get("frequency")
                
                result = await self.telemetry_streamer.start_stream(sid, stream_type, custom_fields, frequency)
                self.stats["telemetry_requests"] += 1
                
                return result.to_dict()
                
            except Exception as e:
                logger.error(f"Telemetry subscribe handler error: {e}")
                return {"error": str(e)}
        
        @self.handler("telemetry_unsubscribe")
        async def handle_telemetry_unsubscribe(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle telemetry unsubscription requests"""
            try:
                result = await self.telemetry_streamer.stop_stream(sid)
                return result.to_dict()
                
            except Exception as e:
                logger.error(f"Telemetry unsubscribe handler error: {e}")
                return {"error": str(e)}
        
        @self.handler("system_info")
        async def handle_system_info(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle system information requests"""
            try:
                info_type = data.get("type", "general")
                
                if info_type == "connections":
                    if not await self._check_admin_permission(context.user):
                        return {"error": "Insufficient permissions"}
                    
                    summary = await self.connection_manager.get_connection_summary()
                    return {"type": "connections", "data": summary}
                
                elif info_type == "command_history":
                    if not await self._check_operator_permission(context.user):
                        return {"error": "Insufficient permissions"}
                    
                    limit = min(data.get("limit", 50), 200)  # Max 200 entries
                    history = self.rover_controller.get_command_history(limit)
                    return {"type": "command_history", "data": history}
                
                elif info_type == "stats":
                    stats = self.stats.copy()
                    stats["active_streams"] = len(self.telemetry_streamer.get_active_streams()) if self.telemetry_streamer else 0
                    return {"type": "stats", "data": stats}
                
                else:
                    return {"error": f"Unknown info type: {info_type}"}
                    
            except Exception as e:
                logger.error(f"System info handler error: {e}")
                return {"error": str(e)}

        @self.handler("alert_subscribe")
        async def handle_alert_subscribe(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle alert subscription requests"""
            try:
                priorities = data.get("priorities", ["critical", "high", "medium", "low", "info"])
                auto_acknowledge_info = data.get("auto_acknowledge_info", True)
                
                await self.alert_manager.subscribe_client(sid, priorities, auto_acknowledge_info)
                
                return {"success": True, "message": "Subscribed to alerts", "data": {
                    "priorities": priorities,
                    "auto_acknowledge_info": auto_acknowledge_info
                }}
                
            except Exception as e:
                logger.error(f"Alert subscribe handler error: {e}")
                return {"error": str(e)}

        @self.handler("alert_unsubscribe")
        async def handle_alert_unsubscribe(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle alert unsubscription requests"""
            try:
                await self.alert_manager.unsubscribe_client(sid)
                return {"success": True, "message": "Unsubscribed from alerts"}
                
            except Exception as e:
                logger.error(f"Alert unsubscribe handler error: {e}")
                return {"error": str(e)}

        @self.handler("alert_ack")
        async def handle_alert_acknowledge(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle alert acknowledgment"""
            try:
                alert_id = data.get("alert_id")
                acknowledged_by = data.get("acknowledged_by")
                sync_across_clients = data.get("sync_across_clients", True)
                
                if not alert_id:
                    return {"error": "Missing alert_id"}
                
                if not acknowledged_by:
                    acknowledged_by = context.user.username if context.user else "anonymous"
                
                result = await self.alert_manager.acknowledge_alert(
                    alert_id, acknowledged_by, sid, sync_across_clients
                )
                
                return result.to_dict()
                
            except Exception as e:
                logger.error(f"Alert acknowledge handler error: {e}")
                return {"error": str(e)}

        @self.handler("alert_sync")
        async def handle_alert_sync(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle alert synchronization requests"""
            try:
                last_sync_timestamp = data.get("last_sync_timestamp")
                priorities = data.get("priorities")
                include_acknowledged = data.get("include_acknowledged", False)
                max_count = min(data.get("max_count", 100), 500)  # Cap at 500
                
                response = await self.alert_manager.sync_alerts(
                    sid, last_sync_timestamp, priorities, include_acknowledged, max_count
                )
                
                return response
                
            except Exception as e:
                logger.error(f"Alert sync handler error: {e}")
                return {"error": str(e)}

        @self.handler("alert_create")
        async def handle_alert_create(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle alert creation (admin only)"""
            try:
                # Check admin permission
                if not await self._check_admin_permission(context.user):
                    return {"error": "Insufficient permissions"}
                
                priority_str = data.get("priority", "info")
                title = data.get("title", "")
                message = data.get("message", "")
                source = data.get("source", "admin")
                metadata = data.get("metadata", {})
                group_id = data.get("group_id")
                
                try:
                    priority = AlertPriority(priority_str)
                except ValueError:
                    return {"error": f"Invalid priority: {priority_str}"}
                
                alert_id = await self.alert_manager.create_alert(
                    priority, title, message, source, metadata, group_id
                )
                
                return {"success": True, "alert_id": alert_id, "message": "Alert created"}
                
            except Exception as e:
                logger.error(f"Alert create handler error: {e}")
                return {"error": str(e)}

        @self.handler("alert_clear")
        async def handle_alert_clear(sid: str, data: Dict[str, Any], context: EventContext) -> Dict[str, Any]:
            """Handle alert clearing (operator/admin only)"""
            try:
                # Check operator permission
                if not await self._check_operator_permission(context.user):
                    return {"error": "Insufficient permissions"}
                
                priority_str = data.get("priority")
                source = data.get("source")
                group_id = data.get("group_id")
                
                priority = None
                if priority_str:
                    try:
                        priority = AlertPriority(priority_str)
                    except ValueError:
                        return {"error": f"Invalid priority: {priority_str}"}
                
                result = await self.alert_manager.clear_alerts(priority, source, group_id)
                return result.to_dict()
                
            except Exception as e:
                logger.error(f"Alert clear handler error: {e}")
                return {"error": str(e)}
    
    def handler(self, event_name: str):
        """Decorator to register event handlers"""
        def decorator(func: Callable):
            self._handlers[event_name] = func
            return func
        return decorator
    
    def middleware(self, func: Callable):
        """Decorator to register middleware"""
        self._middleware.append(func)
        return func
    
    async def handle_event(
        self,
        event_name: str,
        sid: str,
        data: Dict[str, Any],
        connection_info: ConnectionInfo
    ) -> Optional[Dict[str, Any]]:
        """Handle incoming event with middleware pipeline"""
        try:
            # Create event context
            context = EventContext(
                sid=sid,
                connection_info=connection_info,
                event_type=EventType(event_name) if event_name in [e.value for e in EventType] else EventType.ERROR,
                request_id=data.get("request_id"),
                user=connection_info.user
            )
            
            # Apply middleware
            for middleware_func in self._middleware:
                result = await middleware_func(event_name, sid, data, context)
                if result is not None:  # Middleware can block processing
                    return result
            
            # Find and execute handler
            handler = self._handlers.get(event_name)
            if not handler:
                logger.warning(f"No handler found for event: {event_name}")
                return {"error": f"Unknown event: {event_name}"}
            
            # Execute handler
            result = await handler(sid, data, context)
            
            # Update statistics
            self.stats["events_processed"] += 1
            
            return result
            
        except Exception as e:
            logger.error(f"Event handling error for {event_name}: {e}")
            logger.error(traceback.format_exc())
            self.stats["errors"] += 1
            return {"error": "Internal server error"}
    
    async def handle_rover_command(
        self,
        sid: str,
        data: Dict[str, Any],
        connection_info: ConnectionInfo
    ) -> Dict[str, Any]:
        """Convenience method for rover command handling"""
        return await self.handle_event("rover_command", sid, data, connection_info)
    
    async def _check_admin_permission(self, user: Optional[User]) -> bool:
        """Check if user has admin permission"""
        if not user:
            return False
        return any(role.name == "admin" for role in user.roles)
    
    async def _check_operator_permission(self, user: Optional[User]) -> bool:
        """Check if user has operator or admin permission"""
        if not user:
            return False
        return any(role.name in ["admin", "operator"] for role in user.roles)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get event handler statistics"""
        stats = self.stats.copy()
        if self.telemetry_streamer:
            stats["active_telemetry_streams"] = len(self.telemetry_streamer.get_active_streams())
        return stats
    
    async def cleanup_connection(self, sid: str):
        """Clean up resources when connection is closed"""
        if self.telemetry_streamer:
            await self.telemetry_streamer.cleanup_stream(sid)
        if self.alert_manager:
            await self.alert_manager.unsubscribe_client(sid)