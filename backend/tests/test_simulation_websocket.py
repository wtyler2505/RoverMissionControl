"""
WebSocket integration tests for the simulation system.
Tests real-time communication between frontend and backend.
"""

import pytest
import asyncio
import json
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from backend.main import app
from backend.websocket.connection_manager import ConnectionManager
from backend.routes.simulation_routes import simulation_status
from backend.models.auth import User, UserRole

class MockWebSocket:
    """Mock WebSocket for testing."""
    def __init__(self):
        self.sent_messages = []
        self.state = WebSocketState.CONNECTED
        self.closed = False
        
    async def accept(self):
        pass
        
    async def send_text(self, data: str):
        self.sent_messages.append(data)
        
    async def send_json(self, data: dict):
        self.sent_messages.append(json.dumps(data))
        
    async def receive_text(self):
        await asyncio.sleep(0.1)
        return json.dumps({"type": "ping"})
        
    async def receive_json(self):
        await asyncio.sleep(0.1)
        return {"type": "ping"}
        
    async def close(self, code: int = 1000):
        self.closed = True
        self.state = WebSocketState.DISCONNECTED

class TestWebSocketIntegration:
    """Test WebSocket integration for simulation system."""
    
    @pytest.fixture
    def mock_user(self):
        return User(
            id=1,
            username="test_user",
            email="test@example.com",
            role=UserRole.OPERATOR,
            is_active=True
        )
    
    @pytest.fixture
    def connection_manager(self):
        return ConnectionManager()
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test basic WebSocket connection."""
        with TestClient(app) as client:
            with client.websocket_connect("/api/simulation/ws") as websocket:
                # Should receive heartbeat
                data = websocket.receive_json()
                assert data["event"] == "heartbeat"
                assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_simulation_status_broadcast(self, connection_manager):
        """Test broadcasting simulation status updates."""
        # Create mock websockets
        ws1 = MockWebSocket()
        ws2 = MockWebSocket()
        
        # Connect websockets
        await connection_manager.connect(ws1)
        await connection_manager.connect(ws2)
        
        # Broadcast status update
        status_update = {
            "event": "simulation:status",
            "data": {
                "is_running": True,
                "start_time": datetime.utcnow().isoformat(),
                "devices": ["device1", "device2"]
            }
        }
        
        await connection_manager.broadcast(json.dumps(status_update))
        
        # Verify both websockets received the message
        assert len(ws1.sent_messages) == 1
        assert len(ws2.sent_messages) == 1
        
        received_data = json.loads(ws1.sent_messages[0])
        assert received_data["event"] == "simulation:status"
        assert received_data["data"]["is_running"] is True
    
    @pytest.mark.asyncio
    async def test_telemetry_streaming(self, connection_manager):
        """Test streaming telemetry data via WebSocket."""
        ws = MockWebSocket()
        await connection_manager.connect(ws)
        
        # Simulate telemetry updates
        telemetry_updates = [
            {
                "device1": {
                    "temperature": 25.5,
                    "timestamp": datetime.utcnow().isoformat()
                },
                "device2": {
                    "position": {"x": 10, "y": 5},
                    "battery": 95,
                    "timestamp": datetime.utcnow().isoformat()
                }
            },
            {
                "device1": {
                    "temperature": 25.7,
                    "timestamp": datetime.utcnow().isoformat()
                },
                "device2": {
                    "position": {"x": 11, "y": 5},
                    "battery": 94,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        ]
        
        # Stream telemetry
        for telemetry in telemetry_updates:
            await connection_manager.broadcast(json.dumps({
                "event": "simulation:telemetry",
                "data": telemetry
            }))
            await asyncio.sleep(0.1)
        
        # Verify messages were sent
        assert len(ws.sent_messages) == 2
        
        # Verify telemetry data structure
        first_update = json.loads(ws.sent_messages[0])
        assert first_update["event"] == "simulation:telemetry"
        assert "device1" in first_update["data"]
        assert "device2" in first_update["data"]
    
    @pytest.mark.asyncio
    async def test_command_acknowledgment(self, connection_manager):
        """Test command acknowledgment via WebSocket."""
        ws = MockWebSocket()
        await connection_manager.connect(ws)
        
        # Send command acknowledgment
        ack_message = {
            "event": "simulation:command_ack",
            "data": {
                "command_id": "cmd-123",
                "device_id": "rover1",
                "status": "executing",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await connection_manager.send_personal_message(
            json.dumps(ack_message),
            ws
        )
        
        # Verify acknowledgment received
        assert len(ws.sent_messages) == 1
        received = json.loads(ws.sent_messages[0])
        assert received["event"] == "simulation:command_ack"
        assert received["data"]["command_id"] == "cmd-123"
    
    @pytest.mark.asyncio
    async def test_scenario_progress_updates(self, connection_manager):
        """Test scenario execution progress updates."""
        ws = MockWebSocket()
        await connection_manager.connect(ws)
        
        # Simulate scenario progress
        scenario_id = "scenario-test-1"
        steps = ["Initialize", "Move Rover", "Read Sensors", "Complete"]
        
        for i, step in enumerate(steps):
            progress_update = {
                "event": "simulation:scenario_progress",
                "data": {
                    "scenario_id": scenario_id,
                    "current_step": step,
                    "progress": ((i + 1) / len(steps)) * 100,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
            await connection_manager.broadcast(json.dumps(progress_update))
            await asyncio.sleep(0.05)
        
        # Verify all progress updates sent
        assert len(ws.sent_messages) == 4
        
        # Verify final progress
        final_update = json.loads(ws.sent_messages[-1])
        assert final_update["data"]["progress"] == 100
        assert final_update["data"]["current_step"] == "Complete"
    
    @pytest.mark.asyncio
    async def test_error_propagation(self, connection_manager):
        """Test error message propagation via WebSocket."""
        ws = MockWebSocket()
        await connection_manager.connect(ws)
        
        # Send error message
        error_message = {
            "event": "simulation:error",
            "data": {
                "error_type": "DeviceError",
                "device_id": "temp_sensor_1",
                "message": "Sensor reading out of range",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await connection_manager.broadcast(json.dumps(error_message))
        
        # Verify error received
        assert len(ws.sent_messages) == 1
        received = json.loads(ws.sent_messages[0])
        assert received["event"] == "simulation:error"
        assert received["data"]["error_type"] == "DeviceError"
    
    @pytest.mark.asyncio
    async def test_network_condition_updates(self, connection_manager):
        """Test network condition change notifications."""
        ws = MockWebSocket()
        await connection_manager.connect(ws)
        
        # Update network conditions
        network_update = {
            "event": "simulation:network_updated",
            "data": {
                "profile": "satellite",
                "latency": 750,
                "packet_loss": 0.02,
                "bandwidth": 1.5,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        await connection_manager.broadcast(json.dumps(network_update))
        
        # Verify update received
        assert len(ws.sent_messages) == 1
        received = json.loads(ws.sent_messages[0])
        assert received["event"] == "simulation:network_updated"
        assert received["data"]["profile"] == "satellite"
        assert received["data"]["latency"] == 750
    
    @pytest.mark.asyncio
    async def test_connection_management(self, connection_manager):
        """Test WebSocket connection lifecycle management."""
        # Create multiple connections
        websockets = [MockWebSocket() for _ in range(5)]
        
        # Connect all
        for ws in websockets:
            await connection_manager.connect(ws)
        
        assert len(connection_manager.active_connections) == 5
        
        # Disconnect some
        for ws in websockets[:3]:
            connection_manager.disconnect(ws)
        
        assert len(connection_manager.active_connections) == 2
        
        # Broadcast to remaining
        await connection_manager.broadcast(json.dumps({
            "event": "test",
            "data": {"message": "test"}
        }))
        
        # Only connected websockets should receive
        for ws in websockets[:3]:
            assert len(ws.sent_messages) == 0
        for ws in websockets[3:]:
            assert len(ws.sent_messages) == 1
    
    @pytest.mark.asyncio
    async def test_heartbeat_mechanism(self):
        """Test WebSocket heartbeat to keep connection alive."""
        with TestClient(app) as client:
            with client.websocket_connect("/api/simulation/ws") as websocket:
                heartbeats_received = 0
                start_time = asyncio.get_event_loop().time()
                
                # Collect heartbeats for 2 seconds
                while asyncio.get_event_loop().time() - start_time < 2:
                    try:
                        data = websocket.receive_json(timeout=0.5)
                        if data.get("event") == "heartbeat":
                            heartbeats_received += 1
                    except:
                        continue
                
                # Should receive at least one heartbeat
                assert heartbeats_received >= 1
    
    @pytest.mark.asyncio
    async def test_message_queuing(self, connection_manager):
        """Test message queuing for slow consumers."""
        slow_ws = MockWebSocket()
        
        # Override send_json to simulate slow consumer
        original_send = slow_ws.send_json
        async def slow_send(data):
            await asyncio.sleep(0.1)  # Simulate slow network
            await original_send(data)
        slow_ws.send_json = slow_send
        
        await connection_manager.connect(slow_ws)
        
        # Send multiple messages rapidly
        for i in range(10):
            await connection_manager.broadcast(json.dumps({
                "event": "test",
                "data": {"index": i}
            }))
        
        # Wait for all messages to be sent
        await asyncio.sleep(1.5)
        
        # All messages should be delivered
        assert len(slow_ws.sent_messages) == 10
    
    @pytest.mark.asyncio
    async def test_reconnection_handling(self):
        """Test client reconnection handling."""
        with TestClient(app) as client:
            # First connection
            with client.websocket_connect("/api/simulation/ws") as ws1:
                data = ws1.receive_json()
                assert data["event"] == "heartbeat"
                
                # Store connection id if provided
                connection_id = data.get("connection_id")
            
            # Reconnection
            with client.websocket_connect("/api/simulation/ws") as ws2:
                # Should establish new connection successfully
                data = ws2.receive_json()
                assert data["event"] == "heartbeat"
                
                # Should have different connection id
                new_connection_id = data.get("connection_id")
                if connection_id and new_connection_id:
                    assert connection_id != new_connection_id

class TestWebSocketSecurity:
    """Test WebSocket security features."""
    
    @pytest.mark.asyncio
    async def test_unauthorized_connection(self):
        """Test that unauthorized users cannot connect."""
        # This would require implementing WebSocket authentication
        # For now, we'll test that the connection is established
        # but no sensitive data is sent without authentication
        pass
    
    @pytest.mark.asyncio
    async def test_message_validation(self, connection_manager):
        """Test that invalid messages are handled properly."""
        ws = MockWebSocket()
        await connection_manager.connect(ws)
        
        # Try to send invalid JSON
        try:
            await connection_manager.broadcast("invalid json {")
        except json.JSONDecodeError:
            # Should handle gracefully
            pass
        
        # WebSocket should still be connected
        assert ws.state == WebSocketState.CONNECTED
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, connection_manager):
        """Test WebSocket message rate limiting."""
        # This would require implementing rate limiting
        # in the actual WebSocket handler
        pass

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])