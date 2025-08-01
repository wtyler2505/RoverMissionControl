# Performance Monitoring System

A comprehensive performance monitoring system for the telemetry UI that tracks FPS, memory usage, render times, and telemetry data processing performance with adaptive quality controls and real-time alerts.

## Features

- **Real-time Performance Metrics**: FPS, memory usage, render times, frame drops
- **Telemetry-Specific Monitoring**: Data throughput and processing times
- **WebWorker Performance Tracking**: Task queue monitoring and error rates
- **Adaptive Quality Controls**: Automatic performance optimization
- **Performance Alerts**: Configurable thresholds with severity levels
- **Performance Overlay**: Visual real-time monitoring interface
- **Performance Reports**: Exportable performance analysis
- **Bottleneck Detection**: Automated performance issue identification
- **Optimization Recommendations**: AI-powered suggestions

## Quick Start

### Basic Usage

```tsx
import { PerformanceIntegration } from './components/Performance';
import { usePerformanceMonitoring } from './hooks/usePerformanceMonitoring';

// Wrap your telemetry component
function TelemetryDashboard() {
  return (
    <PerformanceIntegration 
      componentName="TelemetryDashboard"
      enableOverlay={true}
      autoOptimize={true}
    >
      <YourTelemetryComponent />
    </PerformanceIntegration>
  );
}
```

### Using the Hook Directly

```tsx
import { usePerformanceMonitoring } from './hooks/usePerformanceMonitoring';

function MyComponent() {
  const [performanceState, controls] = usePerformanceMonitoring({
    autoStart: true,
    thresholds: {
      minFPS: 30,
      maxMemoryUsage: 80
    },
    onAlert: (alert) => {
      console.warn('Performance alert:', alert.message);
    }
  });

  // Track data processing
  const processData = async (data) => {
    return controls.trackDataProcessing(async () => {
      // Your data processing logic
      return processedData;
    });
  };

  return (
    <div>
      <h2>FPS: {performanceState.metrics?.fps}</h2>
      <button onClick={controls.startMonitoring}>Start Monitoring</button>
    </div>
  );
}
```

## Components

### PerformanceOverlay

Real-time performance monitoring overlay with minimizable interface.

```tsx
import { PerformanceOverlay } from './components/Performance';

<PerformanceOverlay
  position="top-right"        // top-left, top-right, bottom-left, bottom-right
  minimized={false}           // Start minimized
  showAdvanced={true}         // Show detailed metrics
  theme="dark"               // dark or light
  onClose={() => {}}         // Close handler
/>
```

**Features:**
- Real-time metrics display with trend indicators
- Mini charts for visual trend analysis
- Performance alerts with severity indicators
- Adaptive quality settings display
- Export functionality for performance reports
- Keyboard shortcut (Ctrl/Cmd + Shift + P) to toggle

### PerformanceIntegration

Wrapper component that provides automatic performance tracking and optimization.

```tsx
import { PerformanceIntegration } from './components/Performance';

<PerformanceIntegration
  componentName="MyComponent"     // Component identifier
  enableOverlay={true}            // Show performance overlay
  overlayPosition="top-right"     // Overlay position
  overlayTheme="dark"            // Overlay theme
  autoOptimize={true}            // Enable auto-optimization
  onPerformanceDegraded={(metrics) => {
    // Handle performance issues
  }}
>
  <YourComponent />
</PerformanceIntegration>
```

## Hooks

### usePerformanceMonitoring

Main hook for performance monitoring with full control.

```tsx
const [performanceState, controls] = usePerformanceMonitoring({
  autoStart: true,                    // Start monitoring automatically
  thresholds: {                       // Performance thresholds
    minFPS: 30,
    maxFrameDrops: 10,
    maxMemoryUsage: 80,
    maxRenderTime: 16.67,
    minThroughput: 100,
    maxProcessingTime: 5
  },
  onAlert: (alert) => {},            // Alert callback
  onQualityChange: (settings) => {}   // Quality change callback
});
```

**State Properties:**
- `metrics`: Current performance metrics
- `alerts`: Performance alerts array
- `qualitySettings`: Adaptive quality settings
- `isMonitoring`: Monitoring status
- `history`: Historical metrics data

**Control Methods:**
- `startMonitoring()`: Start performance monitoring
- `stopMonitoring()`: Stop monitoring
- `clearAlerts()`: Clear alert history
- `clearHistory()`: Clear metrics history
- `generateReport(duration)`: Generate performance report
- `exportReport(format)`: Export report as JSON/CSV
- `recordTelemetryData(time)`: Record processing time
- `startRender()` / `endRender()`: Track render performance
- `updateWorkerMetrics(metrics)`: Update web worker metrics

### useTelemetryPerformanceTracking

Specialized hook for telemetry data processing performance.

```tsx
const {
  metrics,
  controls,
  trackDataProcessing,
  trackBatchProcessing
} = useTelemetryPerformanceTracking();

// Track individual operations
const result = await trackDataProcessing(
  () => processData(rawData),
  { dataSize: rawData.length, operationType: 'transform' }
);

// Track batch operations
const results = await trackBatchProcessing(
  () => processBatch(batchData),
  batchData.length
);
```

### useComponentPerformanceTracking

Automatic render performance tracking for components.

```tsx
const {
  metrics,
  controls,
  startTracking,
  endTracking
} = useComponentPerformanceTracking('ComponentName');

// Tracks render performance automatically
// Manual tracking also available
useEffect(() => {
  startTracking();
  // Component work
  endTracking();
}, [dependency]);
```

## Performance Metrics

### Core Metrics
- **FPS**: Frames per second
- **Frame Drops**: Number of dropped frames
- **Memory Usage**: JS heap usage percentage
- **Render Time**: Component render duration
- **Telemetry Throughput**: Messages processed per second
- **Processing Time**: Average data processing time

### WebWorker Metrics
- **Task Queue Size**: Pending tasks
- **Average Processing Time**: Worker task duration
- **Error Rate**: Worker error percentage
- **Throughput**: Worker processing rate

## Adaptive Quality System

The system automatically adjusts quality settings based on performance:

### Quality Levels
- **High**: 60Hz updates, full resolution, animations enabled
- **Medium**: 45Hz updates, medium resolution, basic animations
- **Low**: 30Hz updates, low resolution, animations disabled

### Automatic Adjustments
- Chart resolution scaling
- Update frequency throttling
- Animation disabling
- Effect reduction
- Data point limiting

## Performance Alerts

### Alert Types
- **FPS**: Low frame rate warnings
- **Memory**: High memory usage alerts
- **Processing**: Slow data processing alerts
- **Throughput**: Low data throughput warnings
- **Worker**: WebWorker performance issues

### Alert Severity
- **Warning**: Performance degradation detected
- **Critical**: Severe performance impact

## Performance Optimization

### Automatic Optimizations
```tsx
// Triggered automatically when performance degrades
window.addEventListener('performance-optimize', (event) => {
  const { component, metrics, qualitySettings } = event.detail;
  
  // Apply component-specific optimizations
  if (metrics.fps < 30) {
    // Reduce update frequency
    // Disable animations
    // Lower chart resolution
  }
});
```

### Manual Optimizations
```tsx
// Force garbage collection (if available)
if (window.gc && memoryUsage > 80) {
  window.gc();
}

// Apply quality settings
const settings = performanceMonitor.getQualitySettings();
if (settings.chartResolution === 'low') {
  // Use simplified chart rendering
}
```

## Performance Reports

### Generate Reports
```tsx
const report = controls.generateReport(60000); // Last 60 seconds

console.log('Average FPS:', report.averageMetrics.fps);
console.log('Peak Memory:', report.peakMetrics.memoryUsage.usagePercentage);
console.log('Bottlenecks:', report.bottlenecks);
console.log('Recommendations:', report.recommendations);
```

### Export Reports
```tsx
// Export as JSON
const jsonReport = controls.exportReport('json');
downloadFile('performance-report.json', jsonReport);

// Export as CSV
const csvReport = controls.exportReport('csv');
downloadFile('performance-metrics.csv', csvReport);
```

## Integration Examples

### Telemetry Chart Component
```tsx
import { usePerformanceContext } from './components/Performance';

function TelemetryChart({ data }) {
  const { trackDataProcessing, qualitySettings } = usePerformanceContext();
  
  const processChartData = async (rawData) => {
    return trackDataProcessing(
      () => transformDataForChart(rawData),
      { dataSize: rawData.length, operationType: 'chart-transform' }
    );
  };

  // Apply quality settings
  const chartConfig = {
    resolution: qualitySettings.chartResolution,
    animationDuration: qualitySettings.enableAnimations ? 300 : 0,
    maxDataPoints: qualitySettings.maxDataPoints
  };

  return <Chart data={processedData} config={chartConfig} />;
}
```

### WebSocket Data Handler
```tsx
function WebSocketHandler() {
  const { controls } = useTelemetryPerformanceTracking();
  
  useEffect(() => {
    const websocket = new WebSocket(url);
    
    websocket.onmessage = async (event) => {
      await controls.trackDataProcessing(
        () => processIncomingMessage(event.data),
        { dataSize: event.data.length, operationType: 'websocket-message' }
      );
    };

    return () => websocket.close();
  }, [controls]);
}
```

### High-Order Component Usage
```tsx
import { withPerformanceTracking } from './components/Performance';

const EnhancedTelemetryDashboard = withPerformanceTracking(TelemetryDashboard, {
  componentName: 'TelemetryDashboard',
  enableOverlay: process.env.NODE_ENV === 'development',
  trackRenders: true,
  autoOptimize: true
});
```

## Best Practices

### 1. Selective Monitoring
Only monitor critical components to avoid performance overhead:
```tsx
// Good: Monitor main dashboard
<PerformanceIntegration componentName="MainDashboard">
  <TelemetryDashboard />
</PerformanceIntegration>

// Avoid: Monitoring every small component
```

### 2. Threshold Configuration
Set appropriate thresholds for your use case:
```tsx
// For real-time telemetry
const realtimeThresholds = {
  minFPS: 30,
  maxProcessingTime: 5,
  minThroughput: 50
};

// For historical data analysis
const analysisThresholds = {
  minFPS: 15,
  maxProcessingTime: 100,
  minThroughput: 10
};
```

### 3. Memory Management
```tsx
// Clear metrics periodically
useEffect(() => {
  const interval = setInterval(() => {
    if (memoryUsage > 70) {
      controls.clearHistory();
    }
  }, 60000);
  
  return () => clearInterval(interval);
}, [controls]);
```

### 4. Development vs Production
```tsx
const enableMonitoring = process.env.NODE_ENV === 'development' || 
                        process.env.ENABLE_PERFORMANCE_MONITORING === 'true';

<PerformanceIntegration enableOverlay={enableMonitoring}>
  <App />
</PerformanceIntegration>
```

## Troubleshooting

### High Memory Usage
1. Check for memory leaks in data processing
2. Clear metrics history regularly
3. Reduce data retention period
4. Use web workers for heavy processing

### Low FPS
1. Enable adaptive quality mode
2. Reduce chart complexity
3. Decrease update frequency
4. Optimize render cycles

### Slow Processing
1. Implement data chunking
2. Use web workers
3. Add data caching
4. Optimize algorithms

### WebWorker Issues
1. Monitor task queue size
2. Implement error handling
3. Use proper data serialization
4. Monitor worker memory usage

## API Reference

See the TypeScript definitions in the source files for complete API documentation:
- `services/performance/PerformanceMonitor.ts`
- `hooks/usePerformanceMonitoring.ts`
- `components/Performance/PerformanceOverlay.tsx`