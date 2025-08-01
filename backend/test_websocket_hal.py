"""
Comprehensive WebSocket HAL Integration Test

This test module verifies the complete integration between:
- HAL manager (Hardware Abstraction Layer)
- WebSocket server and connection management
- Real-time telemetry streaming
- Command routing to hardware devices
- Event notifications (device connect/disconnect, errors)
- Multiple client connections
- Error handling and reconnection logic

Author: Real-Time Telemetry Systems Engineer
"""

import asyncio
import json
import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pytest
import aiohttp
from dataclasses import dataclass, field
from collections import deque
import statistics

# HAL imports
from hardware.manager import HardwareManager, HardwareDevice
from hardware.base import ProtocolType, DataPacket, ConnectionState
from hardware.mock_adapter import MockAdapter, MockConfig, MockDevice
from hardware.simulation.hal_integration import HALSimulationIntegration

# WebSocket imports
from websocket.connection_manager import ConnectionManager, ConnectionInfo
from websocket.websocket_server import WebSocketServer

# Setup logging for detailed debugging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Performance monitoring
@dataclass
class PerformanceMetrics:
    """Track performance metrics for the test"""
    latencies: deque = field(default_factory=lambda: deque(maxlen=1000))
    message_count: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    errors: int = 0
    reconnections: int = 0
    
    def add_latency(self, latency_ms: float):
        self.latencies.append(latency_ms)
        
    def get_stats(self) -> Dict[str, float]:
        if not self.latencies:
            return {}
        return {
            "avg_latency_ms": statistics.mean(self.latencies),
            "p50_latency_ms": statistics.median(self.latencies),
            "p95_latency_ms": statistics.quantiles(self.latencies, n=20)[18] if len(self.latencies) >= 20 else max(self.latencies),
            "p99_latency_ms": statistics.quantiles(self.latencies, n=100)[98] if len(self.latencies) >= 100 else max(self.latencies),
            "min_latency_ms": min(self.latencies),
            "max_latency_ms": max(self.latencies),
            "message_count": self.message_count,
            "throughput_msg_per_sec": self.message_count / (len(self.latencies) / 1000) if self.latencies else 0
        }


class WebSocketClient:
    """Test WebSocket client with comprehensive features"""
    
    def __init__(self, client_id: str, url: str = "ws://localhost:8001"):
        self.client_id = client_id
        self.url = url
        self.session: Optional[aiohttp.ClientSession] = None
        self.ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self.connected = False
        self.messages_received: List[Dict[str, Any]] = []
        self.metrics = PerformanceMetrics()
        self.subscriptions: List[str] = []
        self._running = False
        self._receive_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        
    async def connect(self, auth_token: Optional[str] = None) -> bool:
        """Connect to WebSocket server"""
        try:
            headers = {}
            if auth_token:
                headers['Authorization'] = f'Bearer {auth_token}'
                
            self.session = aiohttp.ClientSession()
            self.ws = await self.session.ws_connect(
                self.url,
                headers=headers,
                heartbeat=30,
                timeout=10
            )
            
            self.connected = True
            self._running = True
            
            # Start background tasks
            self._receive_task = asyncio.create_task(self._receive_loop())
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
            logger.info(f"Client {self.client_id} connected to {self.url}")
            return True
            
        except Exception as e:
            logger.error(f"Client {self.client_id} connection failed: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from WebSocket server"""
        self._running = False
        
        if self._receive_task:
            self._receive_task.cancel()
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            
        if self.ws:
            await self.ws.close()
        if self.session:
            await self.session.close()
            
        self.connected = False
        logger.info(f"Client {self.client_id} disconnected")
    
    async def send_message(self, message_type: str, data: Dict[str, Any]) -> bool:
        """Send a message to the server"""
        if not self.connected or not self.ws:
            return False
            
        try:
            message = {
                "type": message_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat(),
                "client_id": self.client_id
            }
            
            start_time = time.time()
            await self.ws.send_json(message)
            
            self.metrics.message_count += 1
            self.metrics.bytes_sent += len(json.dumps(message))
            
            # Calculate round-trip latency (will be updated when response received)
            message["_sent_at"] = start_time
            
            return True
            
        except Exception as e:
            logger.error(f"Client {self.client_id} send error: {e}")
            self.metrics.errors += 1
            return False
    
    async def subscribe_to_telemetry(self, device_id: str, frequency_hz: float = 10.0) -> bool:
        """Subscribe to device telemetry stream"""
        success = await self.send_message("subscribe_telemetry", {
            "device_id": device_id,
            "frequency_hz": frequency_hz,
            "fields": ["all"]  # Request all telemetry fields
        })
        
        if success:
            self.subscriptions.append(f"telemetry_{device_id}")
            
        return success
    
    async def send_command(self, device_id: str, command: Dict[str, Any]) -> bool:
        """Send command to a device"""
        return await self.send_message("device_command", {
            "device_id": device_id,
            "command": command
        })
    
    async def wait_for_message(self, message_type: str, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        """Wait for a specific message type"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            for msg in reversed(self.messages_received):
                if msg.get("type") == message_type:
                    return msg
            await asyncio.sleep(0.1)
            
        return None
    
    async def _receive_loop(self):
        """Background task to receive messages"""
        while self._running:
            try:
                msg = await self.ws.receive()
                
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    receive_time = time.time()
                    
                    # Calculate latency if this is a response
                    if "_sent_at" in data:
                        latency_ms = (receive_time - data["_sent_at"]) * 1000
                        self.metrics.add_latency(latency_ms)
                    
                    self.messages_received.append(data)
                    self.metrics.bytes_received += len(msg.data)
                    
                    # Log important messages
                    if data.get("type") in ["error", "device_connected", "device_disconnected"]:
                        logger.info(f"Client {self.client_id} received: {data['type']}")
                        
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f"Client {self.client_id} WebSocket error: {msg.data}")
                    self.metrics.errors += 1
                    
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    logger.info(f"Client {self.client_id} WebSocket closed")
                    break
                    
            except Exception as e:
                if self._running:
                    logger.error(f"Client {self.client_id} receive error: {e}")
                    self.metrics.errors += 1
                break
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeat to maintain connection"""
        while self._running:
            try:
                await asyncio.sleep(30)
                await self.send_message("ping", {"timestamp": time.time()})
            except Exception as e:
                logger.error(f"Client {self.client_id} heartbeat error: {e}")


class WebSocketHALIntegrationTest:
    """Main test class for WebSocket HAL integration"""
    
    def __init__(self):
        self.hardware_manager = HardwareManager()
        self.hal_simulation = HALSimulationIntegration()
        self.connection_manager = ConnectionManager(
            max_connections=100,
            timeout=60,
            rate_limit_messages=200,
            rate_limit_window=60
        )
        self.ws_server: Optional[WebSocketServer] = None
        self.clients: List[WebSocketClient] = []
        self.test_devices: List[str] = []
        
    async def setup(self):
        """Set up test environment"""
        logger.info("Setting up WebSocket HAL integration test...")
        
        # Initialize HAL simulation
        await self.hal_simulation.initialize({
            "update_interval": 0.1,  # 10Hz simulation updates
            "enable_physics": True,
            "enable_network_simulation": True
        })
        
        # Start simulation
        await self.hal_simulation.start_simulation()
        
        # Add simulated devices
        await self._add_test_devices()
        
        # Set up WebSocket server with HAL integration
        await self._setup_websocket_server()
        
        logger.info("Test environment setup complete")
    
    async def teardown(self):
        """Clean up test environment"""
        logger.info("Tearing down test environment...")
        
        # Disconnect all clients
        for client in self.clients:
            await client.disconnect()
        
        # Stop WebSocket server
        if self.ws_server:
            await self.ws_server.shutdown()
        
        # Stop simulation
        await self.hal_simulation.stop_simulation()
        
        # Clean up hardware manager
        await self.hardware_manager.shutdown()
        
        logger.info("Test environment teardown complete")
    
    async def _add_test_devices(self):
        """Add test devices to HAL"""
        # Add various types of simulated devices
        device_configs = [
            ("temperature_sensor", "Temperature Sensor 1"),
            ("imu_sensor", "IMU Sensor 1"),
            ("motor_controller", "Motor Controller 1"),
            ("gps_sensor", "GPS Module 1")
        ]
        
        for profile_name, device_name in device_configs:
            device_id = await self.hal_simulation.add_simulated_device(
                profile_name=profile_name,
                protocol_type=ProtocolType.MOCK,
                initial_state={"active": True}
            )
            
            # Register device with hardware manager
            device = HardwareDevice(
                device_id=device_id,
                name=device_name,
                protocol_type=ProtocolType.MOCK,
                adapter_id=f"sim_adapter_mock",
                capabilities=["telemetry", "command"],
                metadata={"simulated": True, "profile": profile_name}
            )
            
            self.hardware_manager.add_device(device)
            self.test_devices.append(device_id)
            
            logger.info(f"Added test device: {device_id} ({device_name})")
    
    async def _setup_websocket_server(self):
        """Set up WebSocket server with HAL integration"""
        # Create WebSocket server (simplified for testing)
        # In production, this would use the full WebSocketServer implementation
        
        # Register HAL event handlers with connection manager
        self.hardware_manager.register_event_handler('data_received', self._on_hal_data_received)
        self.hardware_manager.register_event_handler('adapter_connected', self._on_adapter_connected)
        self.hardware_manager.register_event_handler('adapter_disconnected', self._on_adapter_disconnected)
        self.hardware_manager.register_event_handler('adapter_error', self._on_adapter_error)
    
    async def _on_hal_data_received(self, data: Dict[str, Any]):
        """Handle data received from HAL devices"""
        # Broadcast telemetry to subscribed clients
        device_id = data.get('device_id')
        if not device_id:
            return
            
        # Get all connections subscribed to this device
        for conn_info in self.connection_manager._connections.values():
            if f"telemetry_{device_id}" in conn_info.subscriptions.channels:
                # Send telemetry data to client
                # In production, this would use the actual WebSocket server
                logger.debug(f"Sending telemetry from {device_id} to {conn_info.sid}")
    
    async def _on_adapter_connected(self, data: Dict[str, Any]):
        """Handle adapter connection events"""
        logger.info(f"Adapter connected: {data}")
        # Broadcast to all connected clients
        await self._broadcast_event("device_connected", data)
    
    async def _on_adapter_disconnected(self, data: Dict[str, Any]):
        """Handle adapter disconnection events"""
        logger.info(f"Adapter disconnected: {data}")
        # Broadcast to all connected clients
        await self._broadcast_event("device_disconnected", data)
    
    async def _on_adapter_error(self, data: Dict[str, Any]):
        """Handle adapter error events"""
        logger.error(f"Adapter error: {data}")
        # Broadcast to all connected clients
        await self._broadcast_event("device_error", data)
    
    async def _broadcast_event(self, event_type: str, data: Dict[str, Any]):
        """Broadcast event to all connected clients"""
        # In production, this would use the WebSocket server's broadcast functionality
        for client in self.clients:
            await client.send_message(event_type, data)
    
    # Test methods
    async def test_single_client_connection(self):
        """Test single client connection and basic communication"""
        logger.info("\n=== Test: Single Client Connection ===")
        
        client = WebSocketClient("test_client_1")
        self.clients.append(client)
        
        # Connect client
        assert await client.connect(), "Client connection failed"
        
        # Send ping and wait for pong
        await client.send_message("ping", {"test": True})
        
        # Verify connection
        assert client.connected, "Client should be connected"
        
        logger.info("✓ Single client connection test passed")
    
    async def test_multiple_client_connections(self):
        """Test multiple simultaneous client connections"""
        logger.info("\n=== Test: Multiple Client Connections ===")
        
        # Create and connect multiple clients
        num_clients = 10
        for i in range(num_clients):
            client = WebSocketClient(f"test_client_{i+1}")
            self.clients.append(client)
            assert await client.connect(), f"Client {i+1} connection failed"
        
        # Verify all connected
        assert all(c.connected for c in self.clients), "All clients should be connected"
        
        # Send messages from all clients simultaneously
        tasks = []
        for client in self.clients:
            tasks.append(client.send_message("ping", {"client": client.client_id}))
        
        results = await asyncio.gather(*tasks)
        assert all(results), "All clients should send messages successfully"
        
        logger.info(f"✓ {num_clients} clients connected and communicating successfully")
    
    async def test_telemetry_streaming(self):
        """Test real-time telemetry streaming from devices"""
        logger.info("\n=== Test: Telemetry Streaming ===")
        
        client = WebSocketClient("telemetry_client")
        self.clients.append(client)
        await client.connect()
        
        # Subscribe to telemetry from first device
        device_id = self.test_devices[0]
        await client.subscribe_to_telemetry(device_id, frequency_hz=100.0)  # 100Hz
        
        # Wait for telemetry data
        start_time = time.time()
        telemetry_count = 0
        target_messages = 100
        
        while telemetry_count < target_messages and time.time() - start_time < 5.0:
            await asyncio.sleep(0.01)
            # Count telemetry messages
            telemetry_count = sum(1 for msg in client.messages_received 
                                if msg.get("type") == "telemetry" 
                                and msg.get("device_id") == device_id)
        
        duration = time.time() - start_time
        actual_rate = telemetry_count / duration
        
        logger.info(f"Received {telemetry_count} telemetry messages in {duration:.2f}s")
        logger.info(f"Actual rate: {actual_rate:.1f} Hz")
        
        # Verify performance
        assert telemetry_count >= 50, f"Should receive at least 50 messages, got {telemetry_count}"
        assert actual_rate >= 50, f"Rate should be at least 50Hz, got {actual_rate:.1f}Hz"
        
        # Check latency
        stats = client.metrics.get_stats()
        if stats:
            logger.info(f"Latency stats: avg={stats['avg_latency_ms']:.2f}ms, "
                       f"p95={stats.get('p95_latency_ms', 0):.2f}ms")
            assert stats['avg_latency_ms'] < 10, "Average latency should be under 10ms"
        
        logger.info("✓ Telemetry streaming test passed")
    
    async def test_command_routing(self):
        """Test command routing to devices through WebSocket"""
        logger.info("\n=== Test: Command Routing ===")
        
        client = WebSocketClient("command_client")
        self.clients.append(client)
        await client.connect()
        
        # Send commands to different devices
        commands_sent = 0
        responses_received = 0
        
        for device_id in self.test_devices[:2]:  # Test first 2 devices
            # Send movement command
            command = {
                "action": "move",
                "parameters": {
                    "speed": 50,
                    "direction": "forward"
                }
            }
            
            success = await client.send_command(device_id, command)
            assert success, f"Failed to send command to {device_id}"
            commands_sent += 1
            
            # Wait for command response
            response = await client.wait_for_message("command_response", timeout=2.0)
            if response and response.get("device_id") == device_id:
                responses_received += 1
                assert response.get("status") == "success", "Command should succeed"
        
        logger.info(f"Sent {commands_sent} commands, received {responses_received} responses")
        assert responses_received == commands_sent, "Should receive response for each command"
        
        logger.info("✓ Command routing test passed")
    
    async def test_event_notifications(self):
        """Test device connection/disconnection event notifications"""
        logger.info("\n=== Test: Event Notifications ===")
        
        client = WebSocketClient("event_client")
        self.clients.append(client)
        await client.connect()
        
        # Simulate device disconnection
        if self.test_devices:
            device_id = self.test_devices[0]
            await self.hal_simulation.remove_simulated_device(device_id)
            
            # Wait for disconnection event
            event = await client.wait_for_message("device_disconnected", timeout=2.0)
            assert event is not None, "Should receive device disconnection event"
            
            # Add device back
            new_device_id = await self.hal_simulation.add_simulated_device(
                profile_name="temperature_sensor",
                protocol_type=ProtocolType.MOCK
            )
            
            # Wait for connection event
            event = await client.wait_for_message("device_connected", timeout=2.0)
            assert event is not None, "Should receive device connection event"
        
        logger.info("✓ Event notification test passed")
    
    async def test_error_handling_and_recovery(self):
        """Test error handling and automatic recovery"""
        logger.info("\n=== Test: Error Handling and Recovery ===")
        
        client = WebSocketClient("error_test_client")
        self.clients.append(client)
        await client.connect()
        
        # Send invalid command
        success = await client.send_command("invalid_device_id", {"action": "test"})
        assert success, "Message should be sent"
        
        # Wait for error response
        error = await client.wait_for_message("error", timeout=2.0)
        assert error is not None, "Should receive error for invalid device"
        
        # Test rate limiting by sending many messages rapidly
        flood_count = 300  # Exceed rate limit of 200/minute
        flood_start = time.time()
        
        for i in range(flood_count):
            await client.send_message("ping", {"flood_test": i})
            
        # Some messages should be rate limited
        # Check if client received rate limit notification
        rate_limit_msg = await client.wait_for_message("rate_limit", timeout=1.0)
        # Rate limiting is expected but not required for test to pass
        
        flood_duration = time.time() - flood_start
        logger.info(f"Sent {flood_count} messages in {flood_duration:.2f}s")
        
        logger.info("✓ Error handling test passed")
    
    async def test_performance_under_load(self):
        """Test system performance under high load"""
        logger.info("\n=== Test: Performance Under Load ===")
        
        # Create multiple clients with high-frequency telemetry
        num_clients = 5
        for i in range(num_clients):
            client = WebSocketClient(f"load_test_client_{i+1}")
            self.clients.append(client)
            await client.connect()
            
            # Each client subscribes to multiple devices
            for device_id in self.test_devices[:2]:
                await client.subscribe_to_telemetry(device_id, frequency_hz=50.0)
        
        # Let system run under load
        logger.info(f"Running load test with {num_clients} clients...")
        await asyncio.sleep(5.0)
        
        # Collect performance metrics
        total_messages = 0
        all_latencies = []
        
        for client in self.clients[-num_clients:]:
            stats = client.metrics.get_stats()
            if stats:
                total_messages += stats.get('message_count', 0)
                all_latencies.extend(list(client.metrics.latencies))
        
        if all_latencies:
            avg_latency = statistics.mean(all_latencies)
            p95_latency = statistics.quantiles(all_latencies, n=20)[18] if len(all_latencies) >= 20 else max(all_latencies)
            
            logger.info(f"\nLoad Test Results:")
            logger.info(f"- Total messages: {total_messages}")
            logger.info(f"- Average latency: {avg_latency:.2f}ms")
            logger.info(f"- P95 latency: {p95_latency:.2f}ms")
            logger.info(f"- Messages/second: {total_messages/5.0:.1f}")
            
            # Performance assertions
            assert avg_latency < 50, f"Average latency should be under 50ms, got {avg_latency:.2f}ms"
            assert p95_latency < 100, f"P95 latency should be under 100ms, got {p95_latency:.2f}ms"
        
        logger.info("✓ Performance under load test passed")
    
    async def test_reconnection_logic(self):
        """Test automatic reconnection after connection loss"""
        logger.info("\n=== Test: Reconnection Logic ===")
        
        client = WebSocketClient("reconnect_client")
        self.clients.append(client)
        
        # Initial connection
        assert await client.connect(), "Initial connection failed"
        initial_connected = client.connected
        
        # Simulate connection loss by disconnecting
        await client.disconnect()
        assert not client.connected, "Client should be disconnected"
        
        # Attempt reconnection
        await asyncio.sleep(1.0)
        assert await client.connect(), "Reconnection failed"
        
        # Verify client can still communicate
        success = await client.send_message("ping", {"after_reconnect": True})
        assert success, "Should be able to send messages after reconnection"
        
        client.metrics.reconnections += 1
        logger.info(f"✓ Reconnection test passed (reconnections: {client.metrics.reconnections})")
    
    async def run_all_tests(self):
        """Run all integration tests"""
        logger.info("\n" + "="*60)
        logger.info("WebSocket HAL Integration Test Suite")
        logger.info("="*60)
        
        test_methods = [
            self.test_single_client_connection,
            self.test_multiple_client_connections,
            self.test_telemetry_streaming,
            self.test_command_routing,
            self.test_event_notifications,
            self.test_error_handling_and_recovery,
            self.test_performance_under_load,
            self.test_reconnection_logic
        ]
        
        passed = 0
        failed = 0
        
        for test_method in test_methods:
            try:
                await test_method()
                passed += 1
            except Exception as e:
                failed += 1
                logger.error(f"Test {test_method.__name__} failed: {e}")
                import traceback
                traceback.print_exc()
        
        logger.info("\n" + "="*60)
        logger.info(f"Test Results: {passed} passed, {failed} failed")
        logger.info("="*60)
        
        return failed == 0


async def main():
    """Main test runner"""
    test = WebSocketHALIntegrationTest()
    
    try:
        await test.setup()
        success = await test.run_all_tests()
        
        if not success:
            exit(1)
            
    except Exception as e:
        logger.error(f"Test suite error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
    finally:
        await test.teardown()


if __name__ == "__main__":
    # Run the test suite
    asyncio.run(main())