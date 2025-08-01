# WebSocket HAL Integration Test

This document explains how to run and understand the comprehensive WebSocket HAL integration test.

## Overview

The test suite (`test_websocket_hal.py`) verifies the complete integration between:
- Hardware Abstraction Layer (HAL) manager
- WebSocket server and connection management
- Real-time telemetry streaming
- Command routing to hardware devices
- Event notifications (device connect/disconnect, errors)
- Multiple client connections
- Error handling and reconnection logic

## Running the Test

### Prerequisites

Ensure you have the required dependencies installed:
```bash
pip install aiohttp pytest pytest-asyncio msgpack
```

### Basic Test Run

To run the complete test suite:
```bash
cd backend
python test_websocket_hal.py
```

### Running with pytest

For more detailed output and test isolation:
```bash
pytest backend/test_websocket_hal.py -v -s
```

### Running Individual Tests

To run specific test methods:
```bash
pytest backend/test_websocket_hal.py::WebSocketHALIntegrationTest::test_telemetry_streaming -v
```

## Test Coverage

The test suite includes the following test scenarios:

### 1. Single Client Connection
- Tests basic WebSocket connection
- Verifies ping/pong communication
- Ensures connection state management

### 2. Multiple Client Connections
- Tests simultaneous connections (10 clients by default)
- Verifies connection pooling
- Tests concurrent message handling

### 3. Telemetry Streaming
- Tests high-frequency telemetry (100Hz)
- Measures latency and throughput
- Verifies delta compression and binary serialization
- Performance targets:
  - Average latency < 10ms
  - P95 latency < 20ms
  - Throughput > 50 messages/second

### 4. Command Routing
- Tests command sending to devices
- Verifies command acknowledgment
- Tests response handling
- Validates timeout behavior

### 5. Event Notifications
- Tests device connection/disconnection events
- Verifies event broadcasting to all clients
- Tests error event propagation

### 6. Error Handling and Recovery
- Tests invalid device commands
- Verifies rate limiting (200 messages/minute)
- Tests graceful error responses

### 7. Performance Under Load
- Tests with 5 clients, each subscribing to multiple devices
- Each client requests 50Hz telemetry from 2 devices
- Performance targets:
  - Average latency < 50ms under load
  - P95 latency < 100ms under load
  - No message drops

### 8. Reconnection Logic
- Tests client disconnection and reconnection
- Verifies state recovery after reconnection
- Tests automatic cleanup of stale connections

## Architecture Components

### Hardware WebSocket Handler (`hardware_websocket.py`)

The main integration module that provides:

- **Telemetry Streaming**: High-performance real-time data streaming with:
  - Multiple streaming modes (full, delta, sampled, custom)
  - Configurable frequency (up to 1000Hz)
  - Binary serialization with MessagePack
  - Optional compression with zlib
  - Per-stream flow control

- **Command Processing**: Asynchronous command queue with:
  - Command acknowledgment
  - Timeout handling
  - Retry logic
  - Response routing

- **Connection Management**: Enterprise-grade features:
  - Connection pooling
  - Rate limiting
  - Backpressure handling
  - Automatic cleanup
  - Health monitoring

### Performance Optimizations

1. **Binary Protocol**: Uses MessagePack for efficient serialization
2. **Compression**: Automatic compression for messages > 1KB
3. **Delta Updates**: Only sends changed values to reduce bandwidth
4. **Connection Pooling**: Reuses connections for efficiency
5. **Async Processing**: Non-blocking I/O throughout

## Monitoring and Metrics

The test collects comprehensive metrics:

```python
{
    "avg_latency_ms": 5.2,
    "p50_latency_ms": 4.8,
    "p95_latency_ms": 12.3,
    "p99_latency_ms": 18.7,
    "min_latency_ms": 2.1,
    "max_latency_ms": 25.4,
    "message_count": 5000,
    "throughput_msg_per_sec": 523.4
}
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - The test uses port 8001 by default
   - Kill any processes using this port or change the port in the test

2. **Connection Timeouts**
   - Increase timeout values if running on slower hardware
   - Check firewall settings for local connections

3. **High Latency**
   - Reduce telemetry frequency
   - Enable compression for large messages
   - Check CPU usage during test

### Debug Mode

Enable detailed logging:
```python
logging.basicConfig(level=logging.DEBUG)
```

## Integration with Production

To integrate the WebSocket HAL handler with your FastAPI application:

```python
from backend.websocket.hardware_websocket import create_hardware_websocket_handler
from backend.hardware.manager import hardware_manager
from backend.websocket.connection_manager import ConnectionManager

# Create connection manager
connection_manager = ConnectionManager()

# Create hardware WebSocket handler
hw_ws_handler = create_hardware_websocket_handler(
    hardware_manager=hardware_manager,
    connection_manager=connection_manager,
    config={
        "max_telemetry_rate_hz": 100.0,  # Limit to 100Hz
        "enable_compression": True,
        "enable_binary": True
    }
)

# Start the handler
await hw_ws_handler.start()

# In your WebSocket endpoint
@app.websocket("/ws/hardware")
async def hardware_websocket(websocket: WebSocket):
    # Handle connection...
    message = await websocket.receive_json()
    response = await hw_ws_handler.handle_message(client_id, message)
    await websocket.send_json(response)
```

## Performance Tuning

For production deployments:

1. **Adjust Rate Limits**: Based on your bandwidth and client needs
2. **Configure Compression**: Enable for WAN deployments
3. **Set Stream Limits**: Prevent single client from overwhelming system
4. **Monitor Metrics**: Use the metrics endpoint to track performance
5. **Scale Horizontally**: Use Redis for multi-server deployments

## Security Considerations

The test assumes an open connection for simplicity. In production:

1. Enable authentication via JWT tokens
2. Use WSS (WebSocket Secure) with TLS
3. Implement CSRF protection
4. Add rate limiting per user/IP
5. Validate all input data
6. Implement access control for device commands