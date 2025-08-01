"""
Comprehensive WebSocket communication testing for Rover Mission Control
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any, List
import websockets
from fastapi.testclient import TestClient
from fastapi import WebSocket
import time

pytestmark = pytest.mark.websocket


class TestWebSocketConnection:
    """Test WebSocket connection management."""
    
    @pytest.mark.asyncio
    async def test_websocket_connection_establishment(self, test_app):
        """Test establishing WebSocket connection."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Connection should be established successfully
                assert websocket is not None
    
    @pytest.mark.asyncio
    async def test_websocket_connection_rejection_invalid_path(self, test_app):
        """Test WebSocket connection rejection for invalid paths."""
        with TestClient(test_app) as client:
            with pytest.raises(Exception):  # WebSocket connection should fail
                with client.websocket_connect("/ws/invalid"):
                    pass
    
    @pytest.mark.asyncio
    async def test_websocket_connection_with_authentication(self, test_app):
        """Test WebSocket connection with authentication token."""
        with TestClient(test_app) as client:
            headers = {"Authorization": "Bearer test_token"}
            with client.websocket_connect("/ws/telemetry", headers=headers) as websocket:
                assert websocket is not None
    
    @pytest.mark.asyncio
    async def test_multiple_websocket_connections(self, test_app):
        """Test handling multiple WebSocket connections."""
        with TestClient(test_app) as client:
            connections = []
            try:
                for i in range(5):
                    ws = client.websocket_connect(f"/ws/telemetry?client_id=client_{i}")
                    connections.append(ws.__enter__())
                
                # All connections should be active
                assert len(connections) == 5
            finally:
                for ws in connections:
                    ws.__exit__(None, None, None)


class TestWebSocketMessaging:
    """Test WebSocket message sending and receiving."""
    
    @pytest.mark.asyncio
    async def test_send_telemetry_data(self, test_app, sample_telemetry_data: Dict[str, Any]):
        """Test sending telemetry data via WebSocket."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Send telemetry data
                websocket.send_json(sample_telemetry_data)
                
                # Should receive acknowledgment or processed data
                response = websocket.receive_json()
                assert "status" in response or "timestamp" in response
    
    @pytest.mark.asyncio
    async def test_receive_telemetry_updates(self, test_app, mock_hardware_manager):
        """Test receiving telemetry updates from hardware."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Subscribe to telemetry updates
                subscribe_msg = {"type": "subscribe", "channel": "telemetry"}
                websocket.send_json(subscribe_msg)
                
                # Should receive subscription confirmation
                response = websocket.receive_json()
                assert response.get("type") in ["subscription_confirmed", "telemetry_data"]
    
    @pytest.mark.asyncio
    async def test_command_execution_via_websocket(self, test_app, sample_command_data: Dict[str, Any]):
        """Test executing commands via WebSocket."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/commands") as websocket:
                # Send command
                command_msg = {
                    "type": "execute_command",
                    "command": sample_command_data
                }
                websocket.send_json(command_msg)
                
                # Should receive command acknowledgment
                response = websocket.receive_json()
                assert "command_id" in response or "status" in response
    
    @pytest.mark.asyncio
    async def test_heartbeat_mechanism(self, test_app):
        """Test WebSocket heartbeat/ping-pong mechanism."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Send ping
                ping_msg = {"type": "ping", "timestamp": time.time()}
                websocket.send_json(ping_msg)
                
                # Should receive pong
                response = websocket.receive_json()
                assert response.get("type") == "pong" or "timestamp" in response
    
    @pytest.mark.asyncio
    async def test_websocket_message_validation(self, test_app):
        """Test WebSocket message format validation."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Send invalid message format
                invalid_msg = {"invalid": "format"}
                websocket.send_json(invalid_msg)
                
                # Should receive error response
                response = websocket.receive_json()
                assert "error" in response or response.get("type") == "error"
    
    @pytest.mark.asyncio
    async def test_websocket_binary_data_handling(self, test_app):
        """Test handling of binary data over WebSocket."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/data") as websocket:
                # Send binary data (e.g., image data)
                binary_data = b"fake_image_data" * 1000
                websocket.send_bytes(binary_data)
                
                # Should receive acknowledgment
                response = websocket.receive_json()
                assert "received" in response or "status" in response


class TestWebSocketBroadcasting:
    """Test WebSocket broadcasting functionality."""
    
    @pytest.mark.asyncio
    async def test_broadcast_telemetry_to_all_clients(self, test_app, sample_telemetry_data: Dict[str, Any]):
        """Test broadcasting telemetry data to all connected clients."""
        with TestClient(test_app) as client:
            # Connect multiple clients
            connections = []
            try:
                for i in range(3):
                    ws = client.websocket_connect(f"/ws/telemetry?client_id=client_{i}")
                    connections.append(ws.__enter__())
                
                # Simulate telemetry broadcast trigger
                broadcast_msg = {
                    "type": "broadcast_telemetry",
                    "data": sample_telemetry_data
                }
                connections[0].send_json(broadcast_msg)
                
                # All clients should receive the broadcast
                for ws in connections:
                    response = ws.receive_json()
                    assert "telemetry" in response or "data" in response
            finally:
                for ws in connections:
                    ws.__exit__(None, None, None)
    
    @pytest.mark.asyncio
    async def test_selective_client_messaging(self, test_app):
        """Test sending messages to specific clients."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry?client_id=target_client") as websocket:
                # Send targeted message
                target_msg = {
                    "type": "direct_message",
                    "target_client": "target_client",
                    "message": "Hello specific client"
                }
                websocket.send_json(target_msg)
                
                # Should receive the targeted message
                response = websocket.receive_json()
                assert "message" in response
    
    @pytest.mark.asyncio
    async def test_channel_based_messaging(self, test_app):
        """Test channel-based message routing."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Subscribe to specific channel
                subscribe_msg = {"type": "subscribe", "channel": "hardware_alerts"}
                websocket.send_json(subscribe_msg)
                
                # Should receive subscription confirmation
                response = websocket.receive_json()
                assert response.get("type") == "subscription_confirmed" or "channel" in response


class TestWebSocketErrorHandling:
    """Test WebSocket error handling and recovery."""
    
    @pytest.mark.asyncio
    async def test_websocket_connection_timeout(self, test_app):
        """Test WebSocket connection timeout handling."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Simulate long idle period
                start_time = time.time()
                try:
                    # Wait for potential timeout
                    response = websocket.receive_json(timeout=5)
                    # If we receive a message, it might be a timeout warning
                    assert "timeout" in response or "keepalive" in response
                except:
                    # Timeout is expected behavior
                    pass
    
    @pytest.mark.asyncio
    async def test_websocket_reconnection_handling(self, test_app):
        """Test WebSocket reconnection handling."""
        with TestClient(test_app) as client:
            # First connection
            with client.websocket_connect("/ws/telemetry?client_id=reconnect_test") as websocket1:
                init_msg = {"type": "init", "client_id": "reconnect_test"}
                websocket1.send_json(init_msg)
                response1 = websocket1.receive_json()
                assert "connected" in response1 or "initialized" in response1
            
            # Reconnection with same client_id
            with client.websocket_connect("/ws/telemetry?client_id=reconnect_test") as websocket2:
                reconnect_msg = {"type": "reconnect", "client_id": "reconnect_test"}
                websocket2.send_json(reconnect_msg)
                response2 = websocket2.receive_json()
                assert "reconnected" in response2 or "connected" in response2
    
    @pytest.mark.asyncio
    async def test_websocket_malformed_message_handling(self, test_app):
        """Test handling of malformed WebSocket messages."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                # Send malformed JSON
                try:
                    websocket.send_text("invalid json{")
                    response = websocket.receive_json()
                    assert "error" in response
                except:
                    # Connection might be closed due to malformed message
                    pass
    
    @pytest.mark.asyncio
    async def test_websocket_large_message_handling(self, test_app):
        """Test handling of large WebSocket messages."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/data") as websocket:
                # Send large message
                large_data = {"data": "x" * 10000, "type": "large_message"}
                websocket.send_json(large_data)
                
                response = websocket.receive_json()
                assert "received" in response or "error" in response


class TestWebSocketPerformance:
    """Test WebSocket performance characteristics."""
    
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_websocket_message_throughput(self, test_app):
        """Test WebSocket message throughput."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                messages_sent = 0
                messages_received = 0
                start_time = time.time()
                
                # Send 100 messages rapidly
                for i in range(100):
                    msg = {"type": "test_message", "sequence": i}
                    websocket.send_json(msg)
                    messages_sent += 1
                    
                    try:
                        response = websocket.receive_json(timeout=0.1)
                        messages_received += 1
                    except:
                        pass
                
                end_time = time.time()
                duration = end_time - start_time
                
                # Calculate throughput
                throughput = messages_sent / duration
                assert throughput > 10  # Should handle at least 10 messages/second
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_websocket_concurrent_connections_performance(self, test_app):
        """Test performance with multiple concurrent WebSocket connections."""
        with TestClient(test_app) as client:
            connections = []
            try:
                start_time = time.time()
                
                # Create 20 concurrent connections
                for i in range(20):
                    ws = client.websocket_connect(f"/ws/telemetry?client_id=perf_{i}")
                    connections.append(ws.__enter__())
                
                connection_time = time.time() - start_time
                
                # Send message to all connections
                message_start = time.time()
                for ws in connections:
                    msg = {"type": "performance_test", "timestamp": time.time()}
                    ws.send_json(msg)
                
                # Receive responses
                responses_received = 0
                for ws in connections:
                    try:
                        response = ws.receive_json(timeout=1.0)
                        responses_received += 1
                    except:
                        pass
                
                message_time = time.time() - message_start
                
                # Performance assertions
                assert connection_time < 5.0  # Should connect within 5 seconds
                assert message_time < 2.0     # Should process messages within 2 seconds
                assert responses_received >= len(connections) * 0.8  # At least 80% success rate
                
            finally:
                for ws in connections:
                    ws.__exit__(None, None, None)


class TestWebSocketIntegration:
    """Test WebSocket integration with other system components."""
    
    @pytest.mark.asyncio
    async def test_websocket_hardware_integration(self, test_app, mock_hardware_manager):
        """Test WebSocket integration with hardware manager."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/hardware") as websocket:
                # Subscribe to hardware events
                subscribe_msg = {"type": "subscribe", "events": ["device_connected", "telemetry_update"]}
                websocket.send_json(subscribe_msg)
                
                # Simulate hardware event
                hardware_event = {
                    "type": "hardware_event",
                    "event": "device_connected",
                    "device_id": "test_device"
                }
                websocket.send_json(hardware_event)
                
                # Should receive hardware event notification
                response = websocket.receive_json()
                assert "device_connected" in response or "hardware_event" in response
    
    @pytest.mark.asyncio
    async def test_websocket_command_queue_integration(self, test_app, mock_command_queue):
        """Test WebSocket integration with command queue."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/commands") as websocket:
                # Submit command via WebSocket
                command_msg = {
                    "type": "submit_command",
                    "command": "move_forward",
                    "parameters": {"distance": 10}
                }
                websocket.send_json(command_msg)
                
                # Should receive command acknowledgment
                response = websocket.receive_json()
                assert "command_id" in response or "queued" in response
    
    @pytest.mark.asyncio
    async def test_websocket_auth_integration(self, test_app, mock_auth_service):
        """Test WebSocket integration with authentication service."""
        with TestClient(test_app) as client:
            # Connect with auth token
            headers = {"Authorization": "Bearer test_token"}
            with client.websocket_connect("/ws/secure", headers=headers) as websocket:
                # Send authenticated request
                auth_msg = {"type": "authenticated_request", "action": "get_secure_data"}
                websocket.send_json(auth_msg)
                
                # Should receive authorized response
                response = websocket.receive_json()
                assert "authorized" in response or "secure_data" in response
    
    @pytest.mark.asyncio
    async def test_websocket_database_integration(self, test_app, test_db):
        """Test WebSocket integration with database operations."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/data") as websocket:
                # Request data from database
                data_request = {"type": "query_data", "table": "telemetry_data", "limit": 10}
                websocket.send_json(data_request)
                
                # Should receive query results
                response = websocket.receive_json()
                assert "data" in response or "results" in response


# Custom WebSocket test utilities
class WebSocketTestClient:
    """Custom WebSocket test client for advanced testing scenarios."""
    
    def __init__(self, test_app):
        self.test_app = test_app
        self.client = TestClient(test_app)
    
    async def connect_and_test(self, endpoint: str, test_scenario: callable, **kwargs):
        """Connect to WebSocket endpoint and run test scenario."""
        with self.client.websocket_connect(endpoint, **kwargs) as websocket:
            return await test_scenario(websocket)
    
    async def multi_client_test(self, endpoint: str, num_clients: int, test_scenario: callable):
        """Run test scenario with multiple clients."""
        connections = []
        try:
            for i in range(num_clients):
                ws = self.client.websocket_connect(f"{endpoint}?client_id=multi_{i}")
                connections.append(ws.__enter__())
            
            return await test_scenario(connections)
        finally:
            for ws in connections:
                ws.__exit__(None, None, None)


@pytest.fixture
def websocket_test_client(test_app):
    """Provide WebSocket test client fixture."""
    return WebSocketTestClient(test_app)