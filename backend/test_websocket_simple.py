#!/usr/bin/env python3
"""
Simple WebSocket test for HAL integration
Tests basic WebSocket functionality without complex dependencies
"""

import asyncio
import json
import time
import websockets
from datetime import datetime

# Test configuration
WEBSOCKET_URL = "ws://localhost:8767"  # Mock server for testing (changed to avoid conflicts)
TEST_DURATION = 10  # seconds


async def test_websocket_client():
    """Test WebSocket client connection and telemetry"""
    print("\n" + "=" * 60)
    print("WEBSOCKET HAL INTEGRATION TEST")
    print("=" * 60)
    
    try:
        # Try to connect to the WebSocket server
        print("\n[TEST] Attempting to connect to WebSocket server...")
        
        async with websockets.connect(WEBSOCKET_URL) as websocket:
            print("[PASS] Connected to WebSocket server")
            
            # Send a subscription message
            subscribe_msg = {
                "type": "subscribe",
                "data": {
                    "devices": ["all"],
                    "telemetry": True,
                    "events": True
                }
            }
            
            print("\n[TEST] Sending subscription message...")
            await websocket.send(json.dumps(subscribe_msg))
            print("[PASS] Subscription sent")
            
            # Listen for messages
            print(f"\n[TEST] Listening for messages for {TEST_DURATION} seconds...")
            
            start_time = time.time()
            message_count = 0
            telemetry_count = 0
            event_count = 0
            
            while time.time() - start_time < TEST_DURATION:
                try:
                    # Wait for message with timeout
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    message_count += 1
                    
                    if data.get("type") == "telemetry":
                        telemetry_count += 1
                        if telemetry_count == 1:
                            print(f"[INFO] First telemetry received: {data.get('device_id', 'unknown')}")
                    elif data.get("type") == "event":
                        event_count += 1
                        print(f"[INFO] Event received: {data.get('event', 'unknown')}")
                    
                    # Print progress every 10 messages
                    if message_count % 10 == 0:
                        print(f"[INFO] Received {message_count} messages...")
                        
                except asyncio.TimeoutError:
                    # No message received in 1 second, continue
                    pass
                except Exception as e:
                    print(f"[ERROR] Error receiving message: {e}")
                    break
            
            # Test sending a command
            print("\n[TEST] Sending test command...")
            command_msg = {
                "type": "command",
                "data": {
                    "device_id": "test_device",
                    "command": "status"
                }
            }
            await websocket.send(json.dumps(command_msg))
            print("[PASS] Command sent")
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                response_data = json.loads(response)
                print(f"[PASS] Response received: {response_data.get('type', 'unknown')}")
            except asyncio.TimeoutError:
                print("[INFO] No response received (server may not be configured)")
            
            # Print summary
            print("\n" + "-" * 60)
            print("TEST SUMMARY")
            print("-" * 60)
            print(f"Total messages received: {message_count}")
            print(f"Telemetry messages: {telemetry_count}")
            print(f"Event messages: {event_count}")
            print(f"Average rate: {message_count / TEST_DURATION:.1f} messages/second")
            
            if message_count > 0:
                print("\n[SUCCESS] WebSocket communication test passed!")
                return True
            else:
                print("\n[WARNING] No messages received - server may not be sending data")
                return False
                
    except websockets.exceptions.WebSocketException as e:
        print(f"[ERROR] WebSocket connection failed: {e}")
        print("\nPossible causes:")
        print("1. WebSocket server is not running")
        print("2. Wrong URL or port")
        print("3. Server doesn't have /ws/hardware endpoint")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False


async def test_websocket_server_mock():
    """Create a mock WebSocket server for testing"""
    print("\n[INFO] Starting mock WebSocket server on port 8767...")
    
    async def handler(websocket):
        """Handle WebSocket connections"""
        client_info = websocket.remote_address if hasattr(websocket, 'remote_address') else 'unknown'
        print(f"[SERVER] Client connected from {client_info}")
        
        try:
            # Send periodic telemetry
            device_id = "mock_temp_sensor"
            while True:
                # Send telemetry data
                telemetry = {
                    "type": "telemetry",
                    "device_id": device_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "data": {
                        "temperature": 25.0 + (time.time() % 10) / 10,
                        "status": "active"
                    }
                }
                await websocket.send(json.dumps(telemetry))
                
                # Check for incoming messages
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                    data = json.loads(message)
                    print(f"[SERVER] Received: {data.get('type', 'unknown')}")
                    
                    # Send acknowledgment
                    if data.get("type") == "command":
                        response = {
                            "type": "command_response",
                            "device_id": data.get("data", {}).get("device_id"),
                            "status": "success"
                        }
                        await websocket.send(json.dumps(response))
                except asyncio.TimeoutError:
                    pass
                
                await asyncio.sleep(0.5)  # Send telemetry every 500ms
                
        except websockets.exceptions.ConnectionClosed:
            print(f"[SERVER] Client disconnected")
        except Exception as e:
            print(f"[SERVER] Error: {e}")
    
    # Start server
    async with websockets.serve(handler, "localhost", 8767):
        print("[SERVER] Mock WebSocket server started on ws://localhost:8767")
        print("[SERVER] Press Ctrl+C to stop")
        await asyncio.Future()  # Run forever


async def main():
    """Main test function"""
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--server":
        # Run mock server
        await test_websocket_server_mock()
    else:
        # Run client test
        print("\nTesting WebSocket client connection...")
        print("Note: Make sure the backend server is running with WebSocket support")
        print("Or run 'python test_websocket_simple.py --server' in another terminal")
        
        success = await test_websocket_client()
        
        if not success:
            print("\n[TIP] To test with mock server:")
            print("1. Run 'python test_websocket_simple.py --server' in another terminal")
            print("2. Change WEBSOCKET_URL to 'ws://localhost:8767' in this script")
            print("3. Run this test again")
        
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())