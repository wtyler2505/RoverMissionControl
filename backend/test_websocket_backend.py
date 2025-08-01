#!/usr/bin/env python3
"""
WebSocket test for the actual backend server
Tests the /api/ws/telemetry endpoint
"""

import asyncio
import json
import time
import websockets
from datetime import datetime

# Test configuration
WEBSOCKET_URL = "ws://localhost:8001/api/ws/telemetry"  # Actual backend endpoint (server running on 8001)
TEST_DURATION = 10  # seconds


async def test_backend_websocket():
    """Test WebSocket connection to the backend server"""
    print("\n" + "=" * 60)
    print("BACKEND WEBSOCKET TEST")
    print("=" * 60)
    
    try:
        # Try to connect to the WebSocket server
        print(f"\n[TEST] Attempting to connect to {WEBSOCKET_URL}...")
        
        async with websockets.connect(WEBSOCKET_URL) as websocket:
            print("[PASS] Connected to backend WebSocket server")
            
            # Send initial test message
            test_msg = {
                "type": "ping",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            print("\n[TEST] Sending test message...")
            await websocket.send(json.dumps(test_msg))
            print("[PASS] Test message sent")
            
            # Listen for messages
            print(f"\n[TEST] Listening for messages for {TEST_DURATION} seconds...")
            
            start_time = time.time()
            message_count = 0
            telemetry_count = 0
            heartbeat_count = 0
            
            while time.time() - start_time < TEST_DURATION:
                try:
                    # Wait for message with timeout
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    
                    # Try to parse as JSON
                    try:
                        data = json.loads(message)
                        message_count += 1
                        
                        msg_type = data.get("type", "unknown")
                        
                        if msg_type == "telemetry":
                            telemetry_count += 1
                            if telemetry_count == 1:
                                print(f"[INFO] First telemetry received")
                                print(f"       Data: {json.dumps(data, indent=2)}")
                        elif msg_type == "heartbeat":
                            heartbeat_count += 1
                            if heartbeat_count == 1:
                                print(f"[INFO] First heartbeat received")
                        else:
                            print(f"[INFO] Received message type: {msg_type}")
                            if message_count < 5:  # Print first few messages
                                print(f"       Data: {json.dumps(data, indent=2)}")
                        
                        # Print progress every 10 messages
                        if message_count % 10 == 0:
                            print(f"[INFO] Received {message_count} messages...")
                            
                    except json.JSONDecodeError:
                        print(f"[INFO] Received non-JSON message: {message[:100]}")
                        
                except asyncio.TimeoutError:
                    # No message received in 1 second, continue
                    pass
                except Exception as e:
                    print(f"[ERROR] Error receiving message: {e}")
                    break
            
            # Send a telemetry request
            print("\n[TEST] Sending telemetry request...")
            telemetry_request = {
                "type": "telemetry_request",
                "devices": ["all"]
            }
            await websocket.send(json.dumps(telemetry_request))
            print("[PASS] Telemetry request sent")
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                response_data = json.loads(response)
                print(f"[PASS] Response received: {response_data.get('type', 'unknown')}")
            except asyncio.TimeoutError:
                print("[INFO] No immediate response to telemetry request")
            
            # Print summary
            print("\n" + "-" * 60)
            print("TEST SUMMARY")
            print("-" * 60)
            print(f"Connection URL: {WEBSOCKET_URL}")
            print(f"Test duration: {TEST_DURATION} seconds")
            print(f"Total messages received: {message_count}")
            print(f"Telemetry messages: {telemetry_count}")
            print(f"Heartbeat messages: {heartbeat_count}")
            
            if message_count > 0:
                print(f"Average rate: {message_count / TEST_DURATION:.1f} messages/second")
            
            # Close connection gracefully
            print("\n[TEST] Closing connection...")
            await websocket.close()
            print("[PASS] Connection closed")
            
            print("\n[SUCCESS] WebSocket communication test completed!")
            return True
                
    except websockets.exceptions.WebSocketException as e:
        print(f"[ERROR] WebSocket connection failed: {e}")
        print("\nPossible causes:")
        print("1. Backend server is not running")
        print("2. Wrong URL or port")
        print("3. WebSocket endpoint not available")
        print("\nTo fix:")
        print("1. Start the backend server: cd backend && python server.py")
        print("2. Verify the server is running on http://localhost:8000")
        print("3. Check that /api/ws/telemetry endpoint exists")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False


async def main():
    """Main test function"""
    print("\nTesting WebSocket connection to backend server...")
    print("Make sure the backend server is running on port 8000")
    
    success = await test_backend_websocket()
    
    if not success:
        print("\n[TIP] Start the backend server with:")
        print("cd backend && python server.py")
    
    import sys
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())