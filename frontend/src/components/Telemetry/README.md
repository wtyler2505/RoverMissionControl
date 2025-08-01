# Telemetry Components

This directory contains comprehensive telemetry management components for the Rover Mission Control system.

## Overview

The telemetry system provides:
- Real-time data streaming with WebSocket integration
- High-performance charting and visualization
- Data recording and export capabilities
- Stream health monitoring
- Historical data access
- User preferences management
- Alert system for threshold monitoring

## Core Components

### TelemetryProvider

The main context provider that manages all telemetry functionality.

```tsx
import { TelemetryProvider } from './components/Telemetry';

function App() {
  return (
    <TelemetryProvider autoConnect={true}>
      {/* Your app components */}
    </TelemetryProvider>
  );
}
```

**Features:**
- Manages TelemetryManager instance lifecycle
- Handles stream subscriptions and data flow
- Provides recording capabilities
- Manages user preferences
- Monitors stream health

### RealTimeChart

High-performance Canvas-based charting component for real-time data visualization.

```tsx
import { RealTimeChart } from './components/Telemetry';

<RealTimeChart
  data={[
    {
      id: 'velocity',
      data: velocityData,
      color: '#1976d2',
      name: 'Velocity'
    }
  ]}
  options={{
    height: 400,
    timeWindow: 60000, // 60 seconds
    showGrid: true,
    showLegend: true
  }}
/>
```

### TelemetryDashboard

Pre-built dashboard component for telemetry visualization.

```tsx
import { TelemetryDashboard } from './components/Telemetry';

<TelemetryDashboard
  streamIds={['rover.velocity', 'rover.battery']}
  layout="grid"
/>
```

## Hooks

### useTelemetry

Main hook for accessing telemetry context.

```tsx
const {
  manager,
  isConnected,
  availableStreams,
  subscribe,
  unsubscribe,
  getStreamData
} = useTelemetry();
```

### useRealTimeTelemetry

Hook for subscribing to and accessing real-time telemetry data.

```tsx
const {
  data,
  stats,
  health,
  isActive,
  pause,
  resume
} = useRealTimeTelemetry('rover.velocity', {
  bufferSize: 1000,
  decimationFactor: 2
});
```

### useTelemetryStatistics

Calculate statistics for a telemetry stream.

```tsx
const statistics = useTelemetryStatistics('rover.velocity', 60); // 60 second window

console.log({
  current: statistics.current,
  average: statistics.average,
  min: statistics.min,
  max: statistics.max,
  standardDeviation: statistics.standardDeviation
});
```

### useTelemetryRecording

Manage telemetry recording sessions.

```tsx
const {
  session,
  isRecording,
  startRecording,
  stopRecording,
  exportRecording
} = useTelemetryRecording();

// Start recording
startRecording(['rover.velocity', 'rover.battery']);

// Export when done
const blob = await exportRecording('json');
```

### useTelemetryAlerts

Monitor telemetry streams for threshold violations.

```tsx
const alerts = useTelemetryAlerts([
  {
    streamId: 'rover.velocity',
    condition: 'above',
    threshold: 5.0,
    message: 'Velocity exceeds safe limit'
  }
]);
```

### useHistoricalTelemetry

Fetch historical telemetry data from the server.

```tsx
const { data, isLoading, error } = useHistoricalTelemetry(
  'rover.velocity',
  {
    start: new Date(Date.now() - 3600000), // 1 hour ago
    end: new Date()
  },
  {
    maxPoints: 1000,
    aggregation: 'average'
  }
);
```

## Usage Examples

### Basic Setup

```tsx
import React from 'react';
import { TelemetryProvider, useTelemetry } from './components/Telemetry';
import { WebSocketProvider } from './components/WebSocket';

function App() {
  return (
    <WebSocketProvider autoConnect={true}>
      <TelemetryProvider>
        <TelemetryDashboard />
      </TelemetryProvider>
    </WebSocketProvider>
  );
}

function TelemetryDashboard() {
  const { subscribe, activeStreams } = useTelemetry();
  
  React.useEffect(() => {
    // Subscribe to velocity stream
    subscribe({
      streamId: 'rover.velocity',
      name: 'Rover Velocity',
      dataType: 'numeric',
      bufferSize: 1000,
      units: 'm/s'
    });
  }, [subscribe]);
  
  return (
    <div>
      {activeStreams.map(stream => (
        <StreamDisplay key={stream.streamId} streamId={stream.streamId} />
      ))}
    </div>
  );
}
```

### Custom Chart with Real-Time Data

```tsx
function VelocityChart() {
  const { data, stats } = useRealTimeTelemetry('rover.velocity');
  
  return (
    <div>
      <h3>Velocity: {stats?.current.toFixed(2)} m/s</h3>
      <RealTimeChart
        data={[{
          id: 'velocity',
          data: data.map(p => ({
            timestamp: p.timestamp,
            value: p.value
          })),
          color: '#f50057',
          name: 'Velocity'
        }]}
        options={{
          height: 300,
          timeWindow: 60000,
          yAxis: {
            min: 0,
            max: 10,
            label: 'Velocity (m/s)'
          }
        }}
      />
    </div>
  );
}
```

### Recording Session Management

```tsx
function RecordingControls() {
  const { activeStreams } = useTelemetry();
  const {
    session,
    isRecording,
    startRecording,
    stopRecording,
    exportRecording
  } = useTelemetryRecording();
  
  const handleExport = async () => {
    const blob = await exportRecording('csv');
    // Download the blob
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${Date.now()}.csv`;
    a.click();
  };
  
  return (
    <div>
      {isRecording ? (
        <>
          <p>Recording: {session.dataPoints} points</p>
          <button onClick={stopRecording}>Stop</button>
        </>
      ) : (
        <button 
          onClick={() => startRecording(activeStreams.map(s => s.streamId))}
        >
          Start Recording
        </button>
      )}
      {session && !isRecording && (
        <button onClick={handleExport}>Export</button>
      )}
    </div>
  );
}
```

### Stream Health Monitoring

```tsx
function StreamHealthIndicator({ streamId }) {
  const { health } = useTelemetryStream(streamId);
  
  const getColor = () => {
    switch (health?.status) {
      case 'healthy': return 'green';
      case 'degraded': return 'yellow';
      case 'error': return 'red';
      default: return 'gray';
    }
  };
  
  return (
    <div style={{ color: getColor() }}>
      {streamId}: {health?.status || 'unknown'}
      {health?.issues.length > 0 && (
        <ul>
          {health.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Configuration

### TelemetryProvider Props

- `autoConnect`: Automatically connect to WebSocket on mount
- `preferences`: Initial user preferences

### Stream Configuration

```tsx
interface TelemetryStreamConfig {
  streamId: string;
  name: string;
  dataType: TelemetryDataType;
  bufferSize: number;
  decimationFactor?: number;
  sampleRate?: number;
  units?: string;
  minValue?: number;
  maxValue?: number;
}
```

### User Preferences

```tsx
interface TelemetryPreferences {
  defaultBufferSize: number;
  defaultDecimationFactor: number;
  autoSubscribe: string[];
  chartDefaults: {
    timeWindow: number;
    refreshRate: number;
    theme: 'light' | 'dark';
  };
  recording: {
    autoRecord: boolean;
    maxDuration: number;
    maxFileSize: number;
  };
  display: {
    showStats: boolean;
    showQuality: boolean;
    showTimestamps: boolean;
    dateFormat: string;
  };
}
```

## Performance Considerations

1. **Data Decimation**: Use decimation factor for high-frequency streams
2. **Buffer Size**: Adjust buffer size based on memory constraints
3. **Chart Updates**: Control refresh rate to balance smoothness and CPU usage
4. **WebWorker Processing**: Use `useWebWorkerProcessing` for heavy calculations

## Best Practices

1. **Stream Naming**: Use hierarchical naming (e.g., `rover.sensors.velocity`)
2. **Error Handling**: Always handle subscription errors
3. **Cleanup**: Unsubscribe from streams when components unmount
4. **Recording Limits**: Set appropriate limits for recording duration and file size
5. **Performance Monitoring**: Use stream health indicators to detect issues

## Integration with Backend

The telemetry system expects the backend to support:

1. WebSocket connection at `/ws` endpoint
2. Telemetry stream subscription protocol
3. Historical data query endpoint
4. Stream metadata endpoint

## Troubleshooting

### Common Issues

1. **No data appearing**: Check WebSocket connection and authentication
2. **Performance issues**: Reduce buffer size or increase decimation factor
3. **Recording fails**: Check available memory and file size limits
4. **Alerts not triggering**: Verify threshold values and data types

### Debug Mode

Enable debug logging:

```tsx
<TelemetryProvider debug={true}>
  {/* Your app */}
</TelemetryProvider>
```