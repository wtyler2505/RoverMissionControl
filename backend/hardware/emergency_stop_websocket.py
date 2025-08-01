"""
Emergency Stop WebSocket Integration
Real-time bidirectional communication for emergency stop hardware

This module provides WebSocket endpoints for real-time emergency stop state
synchronization between hardware and UI components.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect, Depends
from fastapi.websockets import WebSocketState

from ..websocket.connection_manager import ConnectionManager
from ..websocket.message_protocols import WebSocketMessage, MessageType
from .emergency_stop_manager import (
    EmergencyStopManager, SystemSafetyState, EmergencyEvent,
    EmergencyStopState, FaultType
)

logger = logging.getLogger(__name__)


class EmergencyStopWebSocketHandler:
    """Handles WebSocket connections for emergency stop system"""
    
    def __init__(self, emergency_manager: EmergencyStopManager):
        self.emergency_manager = emergency_manager
        self.connection_manager = ConnectionManager()
        self._client_subscriptions: Dict[str, Set[str]] = {}
        
        # Register callbacks with emergency manager
        self._register_callbacks()
        
    def _register_callbacks(self):
        """Register callbacks with the emergency stop manager"""
        # System state changes
        self.emergency_manager.register_state_change_handler(
            lambda state: asyncio.create_task(self._broadcast_state_change(state))
        )
        
        # Emergency events
        self.emergency_manager.register_emergency_handler(
            lambda event: asyncio.create_task(self._broadcast_emergency_event(event))
        )
        
        # Fault notifications
        self.emergency_manager.register_fault_handler(
            lambda device_id, faults: asyncio.create_task(
                self._broadcast_fault_notification(device_id, faults)
            )
        )
        
    async def handle_connection(self, websocket: WebSocket, client_id: str):
        """Handle a new WebSocket connection"""
        await self.connection_manager.connect(websocket, client_id)
        self._client_subscriptions[client_id] = set()
        
        try:
            # Send initial state
            await self._send_initial_state(websocket, client_id)
            
            # Message handling loop
            while True:
                # Receive message
                data = await websocket.receive_text()
                message = WebSocketMessage.from_json(data)
                
                # Process message
                await self._process_message(websocket, client_id, message)
                
        except WebSocketDisconnect:
            logger.info(f"Client {client_id} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error for client {client_id}: {e}")
        finally:
            # Cleanup
            self.connection_manager.disconnect(client_id)
            self._client_subscriptions.pop(client_id, None)
            
    async def _send_initial_state(self, websocket: WebSocket, client_id: str):
        """Send initial system state to new connection"""
        # System state
        state_msg = WebSocketMessage(
            type=MessageType.EMERGENCY_STATE,
            data={
                'system_state': self.emergency_manager.system_state.value,
                'is_emergency_active': self.emergency_manager.is_emergency_active,
                'device_count': self.emergency_manager.device_count,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        await self._send_message(websocket, state_msg)
        
        # Device states
        device_states = self.emergency_manager.get_device_states()
        devices_msg = WebSocketMessage(
            type=MessageType.DEVICE_STATUS,
            data={
                'devices': {
                    device_id: {
                        'state': status.state.value,
                        'button_type': status.button_type.value,
                        'is_healthy': status.is_healthy,
                        'voltage': status.voltage_level,
                        'response_time_ms': status.response_time_ms,
                        'fault_codes': [f.name for f in status.fault_codes]
                    }
                    for device_id, status in device_states.items()
                }
            }
        )
        await self._send_message(websocket, devices_msg)
        
        # Recent events
        events = self.emergency_manager.get_emergency_events(limit=10)
        if events:
            events_msg = WebSocketMessage(
                type=MessageType.EVENT_HISTORY,
                data={
                    'events': [
                        {
                            'timestamp': event.timestamp.isoformat(),
                            'trigger_source': event.trigger_source.value,
                            'trigger_reason': event.trigger_reason,
                            'cleared': event.cleared_timestamp.isoformat() 
                                     if event.cleared_timestamp else None
                        }
                        for event in events
                    ]
                }
            )
            await self._send_message(websocket, events_msg)
            
    async def _process_message(self, websocket: WebSocket, client_id: str, 
                             message: WebSocketMessage):
        """Process incoming WebSocket message"""
        try:
            if message.type == MessageType.SUBSCRIBE:
                # Subscribe to specific updates
                topics = message.data.get('topics', [])
                self._client_subscriptions[client_id].update(topics)
                
                # Acknowledge
                ack_msg = WebSocketMessage(
                    type=MessageType.ACKNOWLEDGE,
                    data={'subscribed': topics}
                )
                await self._send_message(websocket, ack_msg)
                
            elif message.type == MessageType.ACTIVATE_EMERGENCY:
                # Activate emergency stop
                source = message.data.get('source', client_id)
                reason = message.data.get('reason', 'WebSocket activation')
                
                success = await self.emergency_manager.activate_emergency_stop(
                    source=source,
                    reason=reason
                )
                
                # Send result
                result_msg = WebSocketMessage(
                    type=MessageType.COMMAND_RESULT,
                    data={
                        'command': 'activate_emergency',
                        'success': success,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                await self._send_message(websocket, result_msg)
                
            elif message.type == MessageType.DEACTIVATE_EMERGENCY:
                # Deactivate emergency stop
                operator_id = message.data.get('operator_id', client_id)
                override_safety = message.data.get('override_safety', False)
                
                success = await self.emergency_manager.deactivate_emergency_stop(
                    operator_id=operator_id,
                    override_safety=override_safety
                )
                
                # Send result
                result_msg = WebSocketMessage(
                    type=MessageType.COMMAND_RESULT,
                    data={
                        'command': 'deactivate_emergency',
                        'success': success,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                await self._send_message(websocket, result_msg)
                
            elif message.type == MessageType.TEST_SYSTEM:
                # Test emergency stop system
                test_results = await self.emergency_manager.test_system()
                
                # Send results
                test_msg = WebSocketMessage(
                    type=MessageType.TEST_RESULTS,
                    data=test_results
                )
                await self._send_message(websocket, test_msg)
                
            elif message.type == MessageType.GET_DIAGNOSTICS:
                # Get system diagnostics
                diagnostics = self.emergency_manager.export_diagnostics()
                
                # Send diagnostics
                diag_msg = WebSocketMessage(
                    type=MessageType.DIAGNOSTICS,
                    data=diagnostics
                )
                await self._send_message(websocket, diag_msg)
                
            elif message.type == MessageType.HEARTBEAT:
                # Respond to heartbeat
                hb_msg = WebSocketMessage(
                    type=MessageType.HEARTBEAT,
                    data={'timestamp': datetime.utcnow().isoformat()}
                )
                await self._send_message(websocket, hb_msg)
                
            else:
                # Unknown message type
                error_msg = WebSocketMessage(
                    type=MessageType.ERROR,
                    data={
                        'error': f'Unknown message type: {message.type}',
                        'original_type': message.type
                    }
                )
                await self._send_message(websocket, error_msg)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            error_msg = WebSocketMessage(
                type=MessageType.ERROR,
                data={'error': str(e)}
            )
            await self._send_message(websocket, error_msg)
            
    async def _send_message(self, websocket: WebSocket, message: WebSocketMessage):
        """Send a message to a specific client"""
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_text(message.to_json())
            
    async def _broadcast_state_change(self, state: SystemSafetyState):
        """Broadcast system state change to all clients"""
        message = WebSocketMessage(
            type=MessageType.EMERGENCY_STATE,
            data={
                'system_state': state.value,
                'is_emergency_active': state == SystemSafetyState.EMERGENCY,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Broadcast to all connected clients
        await self.connection_manager.broadcast(message.to_json())
        
    async def _broadcast_emergency_event(self, event: EmergencyEvent):
        """Broadcast emergency event to subscribed clients"""
        message = WebSocketMessage(
            type=MessageType.EMERGENCY_EVENT,
            data={
                'timestamp': event.timestamp.isoformat(),
                'trigger_source': event.trigger_source.value,
                'trigger_reason': event.trigger_reason,
                'system_state_before': event.system_state_before.value,
                'system_state_after': event.system_state_after.value,
                'actions_taken': [action.name for action in event.actions_taken]
            }
        )
        
        # Broadcast to clients subscribed to emergency events
        for client_id, topics in self._client_subscriptions.items():
            if 'emergency_events' in topics or 'all' in topics:
                await self.connection_manager.send_to_client(
                    client_id, 
                    message.to_json()
                )
                
    async def _broadcast_fault_notification(self, device_id: str, faults: list[FaultType]):
        """Broadcast fault notification to subscribed clients"""
        message = WebSocketMessage(
            type=MessageType.FAULT_NOTIFICATION,
            data={
                'device_id': device_id,
                'faults': [f.name for f in faults],
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Broadcast to clients subscribed to fault notifications
        for client_id, topics in self._client_subscriptions.items():
            if 'faults' in topics or 'all' in topics:
                await self.connection_manager.send_to_client(
                    client_id,
                    message.to_json()
                )
                
    async def broadcast_device_update(self, device_id: str, status: dict):
        """Broadcast device status update"""
        message = WebSocketMessage(
            type=MessageType.DEVICE_UPDATE,
            data={
                'device_id': device_id,
                'status': status,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Broadcast to all connected clients
        await self.connection_manager.broadcast(message.to_json())


# Extended message types for emergency stop
class EmergencyMessageType:
    """Additional message types for emergency stop system"""
    EMERGENCY_STATE = "emergency_state"
    EMERGENCY_EVENT = "emergency_event"
    DEVICE_STATUS = "device_status"
    DEVICE_UPDATE = "device_update"
    FAULT_NOTIFICATION = "fault_notification"
    ACTIVATE_EMERGENCY = "activate_emergency"
    DEACTIVATE_EMERGENCY = "deactivate_emergency"
    TEST_SYSTEM = "test_system"
    TEST_RESULTS = "test_results"
    GET_DIAGNOSTICS = "get_diagnostics"
    DIAGNOSTICS = "diagnostics"
    EVENT_HISTORY = "event_history"
    COMMAND_RESULT = "command_result"


# Update MessageType enum to include emergency types
MessageType.EMERGENCY_STATE = EmergencyMessageType.EMERGENCY_STATE
MessageType.EMERGENCY_EVENT = EmergencyMessageType.EMERGENCY_EVENT
MessageType.DEVICE_STATUS = EmergencyMessageType.DEVICE_STATUS
MessageType.DEVICE_UPDATE = EmergencyMessageType.DEVICE_UPDATE
MessageType.FAULT_NOTIFICATION = EmergencyMessageType.FAULT_NOTIFICATION
MessageType.ACTIVATE_EMERGENCY = EmergencyMessageType.ACTIVATE_EMERGENCY
MessageType.DEACTIVATE_EMERGENCY = EmergencyMessageType.DEACTIVATE_EMERGENCY
MessageType.TEST_SYSTEM = EmergencyMessageType.TEST_SYSTEM
MessageType.TEST_RESULTS = EmergencyMessageType.TEST_RESULTS
MessageType.GET_DIAGNOSTICS = EmergencyMessageType.GET_DIAGNOSTICS
MessageType.DIAGNOSTICS = EmergencyMessageType.DIAGNOSTICS
MessageType.EVENT_HISTORY = EmergencyMessageType.EVENT_HISTORY
MessageType.COMMAND_RESULT = EmergencyMessageType.COMMAND_RESULT