# WebSocket Client System

A comprehensive WebSocket client implementation for the Rover Mission Control frontend, featuring Socket.IO integration, authentication, offline message queuing, and professional UI components.

## Features

- **Socket.IO v4.x Integration**: Modern WebSocket communication with fallback support
- **Connection State Management**: Robust state machine with automatic reconnection
- **Authentication Integration**: JWT token support with automatic refresh
- **Offline Message Queuing**: IndexedDB-based message persistence during disconnections
- **Protocol Negotiation**: Support for multiple data formats (JSON, MessagePack, CBOR, Binary)
- **Performance Monitoring**: Real-time metrics and latency tracking
- **Professional UI Components**: Status indicators, connection modals, and notifications
- **React Context Integration**: Easy-to-use hooks and providers
- **TypeScript Support**: Comprehensive type definitions
- **Error Handling**: Detailed error categorization and recovery strategies

## Quick Start

### 1. Install Dependencies

The system requires `socket.io-client` which has been added to package.json:

```bash
npm install socket.io-client@^4.8.1
```

### 2. Setup WebSocket Provider

Wrap your application with the WebSocket provider:

```tsx
import React from 'react';
import { WebSocketProvider } from './components/WebSocket';

function App() {
  return (
    <WebSocketProvider
      config={{
        url: 'ws://localhost:8000/ws',
        debug: true,
        autoConnect: true
      }}
      autoConnect={true}
      showNotifications={true}
    >
      <YourAppContent />
    </WebSocketProvider>
  );
}
```

### 3. Use WebSocket Hooks

```tsx
import React from 'react';
import { useWebSocket, useWebSocketStatus } from './components/WebSocket';

function MyComponent() {
  const { connect, disconnect, sendMessage } = useWebSocket();
  const { isConnected, state, metrics } = useWebSocketStatus();

  const handleSendCommand = async () => {
    await sendMessage('command', {
      action: 'move_rover',
      direction: 'forward',
      speed: 0.5
    });
  };

  return (
    <div>
      <p>Status: {state}</p>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Latency: {metrics.currentLatency}ms</p>
      <button onClick={handleSendCommand}>Send Command</button>
    </div>
  );
}
```

### 4. Add Connection Status Indicator

```tsx
import React from 'react';
import { ConnectionStatus } from './components/WebSocket';
import { useWebSocketStatus } from './components/WebSocket';

function Dashboard() {
  const { status } = useWebSocketStatus();

  return (
    <div>
      <ConnectionStatus
        connectionStatus={status}
        showDetails={true}
        position="top-right"
      />
      {/* Your dashboard content */}
    </div>
  );
}
```

## Architecture

### Core Classes

#### WebSocketClient
The main client class that handles Socket.IO connections, message sending, and event management.

```typescript
const client = new WebSocketClient({
  url: 'ws://localhost:8000/ws',
  reconnect: true,
  debug: true
});

await client.connect({
  auth: {
    token: 'your-jwt-token',
    userId: 'user123'
  }
});
```

#### ConnectionManager
Manages connection state transitions, authentication, and heartbeat monitoring.

#### MessageQueue
Handles offline message storage and retry logic with IndexedDB persistence.

### State Machine

The connection follows a clear state machine:

```
DISCONNECTED → CONNECTING → CONNECTED → AUTHENTICATED → ACTIVE
                    ↓            ↓            ↓
                  ERROR ← RECONNECTING ←------┘
```

### Message Types

- `COMMAND`: Rover commands and control messages
- `TELEMETRY`: Real-time sensor data and status
- `STATUS`: System status updates
- `HEARTBEAT`: Connection health monitoring
- `AUTH`: Authentication messages
- `ERROR`: Error notifications
- `NOTIFICATION`: User notifications
- `BINARY`: Binary data transfer

## Configuration

### WebSocket Config

```typescript
const config: WebSocketConfig = {
  url: 'ws://localhost:8000/ws',
  reconnect: true,
  reconnectAttempts: 10,
  reconnectDelay: 2000,
  reconnectDelayMax: 30000,
  timeout: 20000,
  heartbeatInterval: 25000,
  protocols: ['json', 'messagepack'],
  compression: true,
  debug: false,
  auth: {
    enabled: true,
    tokenRefreshThreshold: 300,
    autoRefresh: true
  },
  queue: {
    maxSize: 1000,
    persistOffline: true,
    priorityEnabled: true
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 5000,
    latencyThreshold: 1000
  }
};
```

### Environment Variables

Set these in your `.env` file:

```bash
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_WS_DEBUG=true
```

## Authentication

The system integrates with your existing JWT authentication:

```typescript
// Automatic token retrieval from localStorage
const { connect } = useWebSocketConnection();

await connect(); // Uses stored token

// Or provide credentials explicitly
await connect({
  auth: {
    token: 'jwt-token',
    userId: 'user123',
    role: 'operator'
  }
});
```

## Telemetry Subscriptions

Subscribe to real-time telemetry streams:

```typescript
const { subscribe, unsubscribe } = useWebSocketMessaging();

// Subscribe to rover telemetry
const subscriptionId = await subscribe({
  channel: 'rover.telemetry',
  filter: {
    subsystem: 'navigation'
  },
  compression: true,
  priority: 'high'
});

// Unsubscribe later
await unsubscribe(subscriptionId);
```

## Error Handling

The system provides comprehensive error categorization:

```typescript
client.on('onError', (error: WebSocketError) => {
  console.log('Error type:', error.type); // 'connection', 'authentication', 'protocol', etc.
  console.log('Recoverable:', error.recoverable);
  console.log('Error code:', error.code);
  
  if (error.type === 'authentication') {
    // Handle auth errors
    redirectToLogin();
  }
});
```

## Performance Monitoring

Real-time metrics are available:

```typescript
const { getMetrics } = useWebSocket();

const metrics = getMetrics();
console.log('Latency:', metrics.currentLatency);
console.log('Messages sent:', metrics.messagesSent);
console.log('Uptime:', metrics.uptime);
```

## UI Components

### ConnectionStatus

A professional status indicator with optional detailed view:

```tsx
<ConnectionStatus
  connectionStatus={status}
  showDetails={true}
  compact={false}
  position="top-right"
  onStatusClick={() => setModalOpen(true)}
/>
```

### ConnectionModal

A comprehensive connection management dialog:

```tsx
<ConnectionModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  onConnect={handleConnect}
  onDisconnect={handleDisconnect}
  connectionStatus={status}
  config={wsConfig}
/>
```

## Best Practices

### 1. Connection Management

```typescript
// Always check connection status before sending
const { isConnected, sendMessage } = useWebSocket();

const sendCommand = async (command) => {
  if (!isConnected) {
    throw new Error('Not connected to server');
  }
  
  await sendMessage('command', command, 'high');
};
```

### 2. Error Recovery

```typescript
// Implement retry logic for critical operations
const sendCriticalCommand = async (command, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sendMessage('command', command, 'critical');
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};
```

### 3. Memory Management

```typescript
// Clean up subscriptions on component unmount
useEffect(() => {
  const subscriptionId = subscribe(config);
  
  return () => {
    unsubscribe(subscriptionId);
  };
}, []);
```

## Integration Examples

### Rover Command Interface

```tsx
function RoverControls() {
  const { sendMessage, isConnected } = useWebSocket();
  
  const moveRover = async (direction: string) => {
    if (!isConnected) return;
    
    await sendMessage('command', {
      type: 'movement',
      action: 'move',
      direction,
      timestamp: Date.now()
    }, 'high');
  };
  
  return (
    <div>
      <button onClick={() => moveRover('forward')} disabled={!isConnected}>
        Forward
      </button>
      {/* Other controls */}
    </div>
  );
}
```

### Telemetry Dashboard

```tsx
function TelemetryDashboard() {
  const [telemetryData, setTelemetryData] = useState(null);
  const { subscribe, client } = useWebSocket();
  
  useEffect(() => {
    const subscriptionId = subscribe({
      channel: 'rover.telemetry',
      filter: { type: 'all' }
    });
    
    client?.on('onMessage', (message) => {
      if (message.type === 'telemetry') {
        setTelemetryData(message.payload);
      }
    });
    
    return () => {
      if (subscriptionId) {
        unsubscribe(subscriptionId);
      }
    };
  }, []);
  
  return (
    <div>
      {telemetryData && (
        <div>
          <p>Battery: {telemetryData.battery}%</p>
          <p>Position: {telemetryData.position.x}, {telemetryData.position.y}</p>
        </div>
      )}
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **Connection Fails**: Check server URL and network connectivity
2. **Authentication Errors**: Verify JWT token is valid and not expired
3. **Messages Not Sending**: Check connection status and queue size
4. **High Latency**: Review network conditions and server performance

### Debug Mode

Enable debug mode for detailed logging:

```typescript
const config = {
  debug: true,
  // ... other config
};
```

### Export Diagnostics

```typescript
const { exportMetrics } = useWebSocket();

// Get diagnostic data
const diagnostics = exportMetrics();
console.log(diagnostics);
```

## Server Integration

This client is designed to work with the WebSocket server implemented in `backend/websocket/`. Ensure your server supports:

- Socket.IO v4.x
- JWT authentication
- Protocol negotiation
- Heartbeat/ping-pong
- Message acknowledgments
- Binary data transfer

## Contributing

When extending this system:

1. Follow TypeScript strict mode
2. Add comprehensive error handling
3. Include unit tests for new features
4. Update type definitions
5. Document new APIs and hooks
6. Consider backward compatibility

## License

This WebSocket system is part of the Rover Mission Control project and follows the same licensing terms.