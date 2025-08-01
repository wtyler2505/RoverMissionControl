"""
Emergency Stop Levels WebSocket Integration

Provides real-time WebSocket communication for the emergency stop levels system.
Handles bidirectional communication between frontend and backend services.

Features:
- Real-time system state updates
- Stop level execution monitoring
- Test execution progress tracking
- Configuration change notifications
- Event streaming and subscription management
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Set, Any, Callable
from dataclasses import asdict
import websockets
from websockets.server import WebSocketServerProtocol

from .emergency_stop_levels import (
    EmergencyStopLevelsService,
    EmergencyStopLevel,
    StopExecution,
    TestScenario,
    TestExecutionResult,
    SystemState,
)

logger = logging.getLogger(__name__)


class EmergencyStopWebSocketHandler:
    """WebSocket handler for emergency stop levels system"""
    
    def __init__(self, emergency_stop_service: EmergencyStopLevelsService):
        self.emergency_stop_service = emergency_stop_service
        self.connections: Set[WebSocketServerProtocol] = set()
        self.subscriptions: Dict[WebSocketServerProtocol, Set[str]] = {}
        
        # Register with the service for events
        self.emergency_stop_service.add_event_callback(self._handle_service_event)
        
    async def register_connection(self, websocket: WebSocketServerProtocol):
        """Register a new WebSocket connection"""
        self.connections.add(websocket)
        self.subscriptions[websocket] = set()
        logger.info(f"WebSocket connection registered: {websocket.remote_address}")
        
        # Send initial system state
        await self._send_to_connection(websocket, {
            "type": "system_state_update",
            "payload": asdict(self.emergency_stop_service.get_system_state()),
            "timestamp": datetime.now().isoformat(),
        })
        
    async def unregister_connection(self, websocket: WebSocketServerProtocol):
        """Unregister a WebSocket connection"""
        self.connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        logger.info(f"WebSocket connection unregistered: {websocket.remote_address}")
        
    async def handle_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            payload = data.get("payload", {})
            
            if message_type == "subscribe":
                await self._handle_subscribe(websocket, payload)
            elif message_type == "unsubscribe":
                await self._handle_unsubscribe(websocket, payload)
            elif message_type == "execute_emergency_stop_level":
                await self._handle_execute_stop_level(websocket, payload)
            elif message_type == "cancel_emergency_stop_execution":
                await self._handle_cancel_execution(websocket, payload)
            elif message_type == "set_test_mode":
                await self._handle_set_test_mode(websocket, payload)
            elif message_type == "execute_test_scenario":
                await self._handle_execute_test_scenario(websocket, payload)
            elif message_type == "stop_test_execution":
                await self._handle_stop_test_execution(websocket, payload)
            elif message_type == "get_system_state":
                await self._handle_get_system_state(websocket, payload)
            elif message_type == "get_test_results":
                await self._handle_get_test_results(websocket, payload)
            elif message_type == "save_configuration":
                await self._handle_save_configuration(websocket, payload)
            elif message_type == "load_configuration":
                await self._handle_load_configuration(websocket, payload)
            elif message_type == "test_configuration":
                await self._handle_test_configuration(websocket, payload)
            else:
                await self._send_error(websocket, f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError as e:
            await self._send_error(websocket, f"Invalid JSON: {e}")
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
            await self._send_error(websocket, f"Internal error: {e}")
            
    async def _handle_subscribe(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle subscription request"""
        channel = payload.get("channel")
        if not channel:
            await self._send_error(websocket, "Missing channel in subscribe request")
            return
            
        self.subscriptions[websocket].add(channel)
        
        await self._send_to_connection(websocket, {
            "type": "subscription_confirmed",
            "payload": {"channel": channel},
            "timestamp": datetime.now().isoformat(),
        })
        
        logger.debug(f"Client subscribed to channel: {channel}")
        
    async def _handle_unsubscribe(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle unsubscribe request"""
        channel = payload.get("channel")
        if not channel:
            await self._send_error(websocket, "Missing channel in unsubscribe request")
            return
            
        self.subscriptions[websocket].discard(channel)
        
        await self._send_to_connection(websocket, {
            "type": "unsubscription_confirmed",
            "payload": {"channel": channel},
            "timestamp": datetime.now().isoformat(),
        })
        
        logger.debug(f"Client unsubscribed from channel: {channel}")
        
    async def _handle_execute_stop_level(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle execute stop level request"""
        try:
            level = EmergencyStopLevel(payload.get("level"))
            test_mode = payload.get("testMode", False)
            
            execution = await self.emergency_stop_service.execute_stop_level(level, test_mode)
            
            await self._send_to_connection(websocket, {
                "type": "stop_level_execution_started",
                "payload": asdict(execution),
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to execute stop level: {e}")
            
    async def _handle_cancel_execution(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle cancel execution request"""
        try:
            success = await self.emergency_stop_service.cancel_execution()
            
            await self._send_to_connection(websocket, {
                "type": "execution_cancelled",
                "payload": {"success": success},
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to cancel execution: {e}")
            
    async def _handle_set_test_mode(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle set test mode request"""
        try:
            enabled = payload.get("enabled", False)
            
            await self.emergency_stop_service.set_test_mode(enabled)
            
            await self._send_to_connection(websocket, {
                "type": "test_mode_set",
                "payload": {"enabled": enabled},
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to set test mode: {e}")
            
    async def _handle_execute_test_scenario(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle execute test scenario request"""
        try:
            scenario_data = payload.get("scenario")
            if not scenario_data:
                await self._send_error(websocket, "Missing scenario data")
                return
                
            # Convert dict to TestScenario object
            scenario = TestScenario(
                id=scenario_data["id"],
                name=scenario_data["name"],
                type=scenario_data["type"],
                description=scenario_data["description"],
                duration=scenario_data["duration"],
                stop_levels=[EmergencyStopLevel(level) for level in scenario_data["stop_levels"]],
                parameters=scenario_data["parameters"],
                expected_results=scenario_data["expected_results"],
                validation_criteria=scenario_data["validation_criteria"],
                automated_validation=scenario_data["automated_validation"],
            )
            
            # Execute scenario asynchronously
            asyncio.create_task(self._execute_test_scenario_async(websocket, scenario))
            
            await self._send_to_connection(websocket, {
                "type": "test_scenario_accepted",
                "payload": {"scenario_id": scenario.id},
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to execute test scenario: {e}")
            
    async def _execute_test_scenario_async(self, websocket: WebSocketServerProtocol, scenario: TestScenario):
        """Execute test scenario asynchronously"""
        try:
            result = await self.emergency_stop_service.execute_test_scenario(scenario)
            
            await self._send_to_connection(websocket, {
                "type": "test_completion",
                "payload": asdict(result),
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            logger.error(f"Error in async test execution: {e}")
            await self._send_error(websocket, f"Test execution failed: {e}")
            
    async def _handle_stop_test_execution(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle stop test execution request"""
        try:
            success = await self.emergency_stop_service.stop_test_execution()
            
            await self._send_to_connection(websocket, {
                "type": "test_execution_stopped",
                "payload": {"success": success},
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to stop test execution: {e}")
            
    async def _handle_get_system_state(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle get system state request"""
        try:
            system_state = self.emergency_stop_service.get_system_state()
            
            await self._send_to_connection(websocket, {
                "type": "system_state_response",
                "payload": asdict(system_state),
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to get system state: {e}")
            
    async def _handle_get_test_results(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle get test results request"""
        try:
            results = self.emergency_stop_service.get_test_results()
            
            await self._send_to_connection(websocket, {
                "type": "test_results_response",
                "payload": [asdict(result) for result in results],
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to get test results: {e}")
            
    async def _handle_save_configuration(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle save configuration request"""
        try:
            configuration = payload.get("configuration")
            if not configuration:
                await self._send_error(websocket, "Missing configuration data")
                return
                
            # Import the configuration
            self.emergency_stop_service.import_configuration(configuration)
            
            await self._send_to_connection(websocket, {
                "type": "configuration_saved",
                "payload": {"success": True},
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to save configuration: {e}")
            
    async def _handle_load_configuration(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle load configuration request"""
        try:
            configuration = self.emergency_stop_service.export_configuration()
            
            await self._send_to_connection(websocket, {
                "type": "configuration_loaded",
                "payload": configuration,
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to load configuration: {e}")
            
    async def _handle_test_configuration(self, websocket: WebSocketServerProtocol, payload: Dict[str, Any]):
        """Handle test configuration request"""
        try:
            level = EmergencyStopLevel(payload.get("level"))
            
            # Perform a quick test of the configuration
            config = self.emergency_stop_service.get_configuration(level)
            if not config:
                await self._send_error(websocket, f"No configuration found for level {level}")
                return
                
            # Simple validation test
            is_valid = (
                config.enabled and
                len(config.actions) > 0 and
                config.estimated_duration > 0
            )
            
            await self._send_to_connection(websocket, {
                "type": "configuration_test_result",
                "payload": {
                    "level": level,
                    "valid": is_valid,
                    "errors": [] if is_valid else ["Configuration validation failed"],
                },
                "timestamp": datetime.now().isoformat(),
            })
            
        except Exception as e:
            await self._send_error(websocket, f"Failed to test configuration: {e}")
            
    async def _handle_service_event(self, event_type: str, data: Any):
        """Handle events from the emergency stop service"""
        message = {
            "type": event_type,
            "payload": data,
            "timestamp": datetime.now().isoformat(),
        }
        
        # Determine which channel this event belongs to
        channel = self._get_channel_for_event(event_type)
        
        # Send to all subscribed connections
        await self._broadcast_to_channel(channel, message)
        
    def _get_channel_for_event(self, event_type: str) -> str:
        """Get the channel name for an event type"""
        if event_type.startswith("system_state"):
            return "emergency_stop_system_state"
        elif event_type.startswith("stop_execution") or event_type.startswith("emergency_stop"):
            return "emergency_stop_events"
        elif event_type.startswith("test_"):
            return "emergency_stop_test_events"
        elif event_type.startswith("configuration"):
            return "emergency_stop_configuration"
        else:
            return "emergency_stop_events"  # Default channel
            
    async def _broadcast_to_channel(self, channel: str, message: Dict[str, Any]):
        """Broadcast message to all connections subscribed to a channel"""
        if not self.connections:
            return
            
        # Find connections subscribed to this channel
        subscribed_connections = [
            conn for conn, channels in self.subscriptions.items()
            if channel in channels and conn in self.connections
        ]
        
        if not subscribed_connections:
            return
            
        # Send message to all subscribed connections
        await asyncio.gather(
            *[self._send_to_connection(conn, message) for conn in subscribed_connections],
            return_exceptions=True
        )
        
    async def _send_to_connection(self, websocket: WebSocketServerProtocol, message: Dict[str, Any]):
        """Send message to a specific WebSocket connection"""
        try:
            if websocket in self.connections and not websocket.closed:
                await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            # Connection closed, remove it
            await self.unregister_connection(websocket)
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            
    async def _send_error(self, websocket: WebSocketServerProtocol, error_message: str):
        """Send error message to WebSocket connection"""
        await self._send_to_connection(websocket, {
            "type": "error",
            "payload": {"message": error_message},
            "timestamp": datetime.now().isoformat(),
        })
        
    async def broadcast_system_update(self, update_type: str, data: Any):
        """Broadcast system update to all connections"""
        message = {
            "type": update_type,
            "payload": data,
            "timestamp": datetime.now().isoformat(),
        }
        
        await asyncio.gather(
            *[self._send_to_connection(conn, message) for conn in self.connections],
            return_exceptions=True
        )


class EmergencyStopWebSocketServer:
    """WebSocket server for emergency stop levels system"""
    
    def __init__(self, emergency_stop_service: EmergencyStopLevelsService, 
                 host: str = "localhost", port: int = 8765):
        self.emergency_stop_service = emergency_stop_service
        self.host = host
        self.port = port
        self.handler = EmergencyStopWebSocketHandler(emergency_stop_service)
        self.server = None
        
    async def start(self):
        """Start the WebSocket server"""
        logger.info(f"Starting Emergency Stop WebSocket server on {self.host}:{self.port}")
        
        self.server = await websockets.serve(
            self._handle_connection,
            self.host,
            self.port,
            ping_interval=30,
            ping_timeout=10,
            close_timeout=10,
        )
        
        logger.info("Emergency Stop WebSocket server started")
        
    async def stop(self):
        """Stop the WebSocket server"""
        if self.server:
            logger.info("Stopping Emergency Stop WebSocket server")
            self.server.close()
            await self.server.wait_closed()
            logger.info("Emergency Stop WebSocket server stopped")
            
    async def _handle_connection(self, websocket: WebSocketServerProtocol, path: str):
        """Handle new WebSocket connection"""
        await self.handler.register_connection(websocket)
        
        try:
            async for message in websocket:
                await self.handler.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.debug(f"WebSocket connection closed: {websocket.remote_address}")
        except Exception as e:
            logger.error(f"Error in WebSocket connection handler: {e}")
        finally:
            await self.handler.unregister_connection(websocket)


# Utility function to create and start the WebSocket server
async def create_emergency_stop_websocket_server(
    emergency_stop_service: EmergencyStopLevelsService,
    host: str = "localhost",
    port: int = 8765
) -> EmergencyStopWebSocketServer:
    """Create and start emergency stop WebSocket server"""
    server = EmergencyStopWebSocketServer(emergency_stop_service, host, port)
    await server.start()
    return server