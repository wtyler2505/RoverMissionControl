# Performance Testing Suite for Rover 3D Visualization

## Overview

This comprehensive performance testing suite provides automated testing, monitoring, and analysis tools for the rover 3D visualization system. It includes stress tests, performance benchmarks, CI/CD integration, and real-time monitoring capabilities.

## Features

### 1. Automated Test Scenarios
- **Maximum Entities Test**: Tests rendering with 10,000+ objects
- **Animation Stress Test**: Heavy animation workload with complex movements
- **Physics Simulation Test**: Physics engine performance under heavy load
- **Camera Movement Test**: Rapid camera movements and view changes
- **Memory Leak Detection**: Extended operation tests for memory leaks

### 2. Performance Metrics Collection
- **FPS Tracking**: Average, min, max, and 95th percentile
- **Frame Time Analysis**: Jank detection and frame time distribution
- **Memory Profiling**: Heap usage, leak detection, GC tracking
- **GPU Metrics**: Draw calls, triangles, texture memory
- **CPU Utilization**: User time, system time, idle percentage

### 3. Visual Performance Tools
- **Real-time HUD**: Live performance metrics overlay
- **Performance Graphs**: FPS and frame time history visualization
- **Status Indicators**: Visual warnings for performance issues
- **Debug Overlays**: LOD levels, physics state, profiling data

### 4. CI/CD Integration
- **GitHub Actions Workflow**: Automated performance testing on PRs
- **Regression Detection**: Automatic detection of performance degradation
- **Performance Reports**: Detailed markdown reports with metrics
- **Artifact Storage**: Screenshots and performance data preservation

## Usage

### Running Tests Locally

```bash
# Run all performance tests
npm run test:performance

# Run specific test suite
npm test -- LODManager.test.tsx

# Run with coverage
npm test -- --coverage LODSystem/__tests__
```

### Manual Performance Testing

```javascript
import { PerformanceMonitoringExample } from './PerformanceMonitoringExample';

// Use the example component to run interactive tests
<PerformanceMonitoringExample />
```

### CI/CD Performance Tests

```bash
# Run automated benchmarks in CI
node src/components/layout/MissionControl/LODSystem/__tests__/performance/ci-performance-test.js

# With custom configuration
PERF_TEST_URL=http://localhost:3000 \
PERF_FAIL_ON_REGRESSION=true \
PERF_REGRESSION_THRESHOLD=0.15 \
node ci-performance-test.js
```

### Using Performance HUD

```javascript
import { PerformanceHUD } from './PerformanceHUD';

// Add to your 3D scene
<Canvas>
  <PerformanceHUD 
    enabled={true}
    position="top-right"
    expanded={true}
    showGraphs={true}
    showWarnings={true}
    onPerformanceIssue={(issue) => console.warn(issue)}
  />
  {/* Your 3D content */}
</Canvas>
```

## Test Scenarios

### 1. Maximum Entities Stress Test
Tests the system's ability to handle a large number of objects:
- 10,000 entities in a grid formation
- 10% animated objects
- 5% physics-enabled objects
- Target: 30+ FPS

### 2. Animation Performance Test
Evaluates animation system performance:
- 500 animated entities
- Complex movement patterns
- Orbital motions and rotations
- Target: 30+ FPS with <50ms frame time

### 3. Physics Stress Test
Tests physics engine under load:
- 300 physics-enabled objects
- Collision detection
- Gravity simulation
- Target: 24+ FPS, <80% CPU

### 4. Camera Movement Stress
Tests rendering during rapid view changes:
- 2000 scene objects
- Rapid camera movements
- View frustum culling
- Target: 30+ FPS, <100ms max frame time

### 5. Memory Leak Detection
Long-running test for memory issues:
- Entity creation/destruction cycles
- Texture loading/unloading
- Animation state changes
- Target: <1MB/min leak rate

## Performance Metrics

### Key Metrics Tracked

1. **Frame Rate (FPS)**
   - Average FPS
   - Minimum FPS
   - 95th percentile FPS
   - FPS stability (standard deviation)

2. **Frame Time**
   - Average frame time
   - Maximum frame time
   - Jank frames (>16.67ms)
   - 95th percentile frame time

3. **Memory Usage**
   - Initial memory
   - Peak memory
   - Average memory
   - Leak rate (MB/minute)
   - Garbage collection count

4. **GPU Performance**
   - Draw call count
   - Triangle count
   - Texture memory usage
   - Shader switches

## CI/CD Integration

### GitHub Actions Workflow

The performance tests run automatically on:
- Pull requests to main branch
- Pushes to main/develop branches
- Nightly scheduled runs
- Manual workflow dispatch

### Performance Regression Detection

The system automatically detects performance regressions by:
1. Comparing metrics against historical baselines
2. Flagging degradations beyond threshold (default 10%)
3. Posting results as PR comments
4. Failing CI builds on critical regressions

### Artifacts Generated

- Performance report (Markdown)
- JUnit XML test results
- Performance screenshots
- Historical benchmark data
- Lighthouse CI reports

## Configuration

### Test Configuration Options

```javascript
const testConfig = {
  duration: 10000,        // Test duration in ms
  warmupTime: 2000,       // Warmup period before measurement
  sampleRate: 60,         // Samples per second
  targetFPS: 60,          // Expected FPS
  maxFrameTime: 33.33,    // Max acceptable frame time (ms)
  memoryThreshold: 500,   // Max memory usage (MB)
  enableGPUMetrics: true,
  enableMemoryProfiling: true
};
```

### Environment Variables

```bash
# CI/CD Configuration
PERF_TEST_URL=http://localhost:3000
PERF_OUTPUT_DIR=./performance-results
PERF_HISTORY_FILE=./benchmark-history.json
PERF_SCREENSHOT_DIR=./performance-screenshots
PERF_FAIL_ON_REGRESSION=true
PERF_REGRESSION_THRESHOLD=0.1
PERF_SLACK_WEBHOOK=https://hooks.slack.com/...
GITHUB_TOKEN=ghp_...
```

## Best Practices

1. **Regular Testing**
   - Run performance tests before major releases
   - Monitor nightly test results for trends
   - Investigate any regression immediately

2. **Baseline Management**
   - Update baselines after performance improvements
   - Document reasons for baseline changes
   - Keep historical data for trend analysis

3. **Test Environment**
   - Use consistent hardware for benchmarks
   - Close unnecessary applications
   - Disable background processes
   - Use production builds for testing

4. **Debugging Performance Issues**
   - Use Chrome DevTools Performance tab
   - Enable React Profiler for component analysis
   - Check for memory leaks with heap snapshots
   - Profile GPU usage with WebGL Inspector

## Troubleshooting

### Common Issues

1. **Tests Failing in CI but Passing Locally**
   - Check for headless browser differences
   - Verify CI environment resources
   - Review timeout configurations

2. **Inconsistent Results**
   - Increase warmup time
   - Add more samples
   - Check for background processes
   - Verify stable test environment

3. **Memory Leak False Positives**
   - Increase test duration
   - Force garbage collection
   - Check for browser caching
   - Review object disposal

## Contributing

When adding new performance tests:

1. Create test scenario in `stressTestScenarios.ts`
2. Add benchmark configuration in `automatedBenchmarks.ts`
3. Update CI workflow if needed
4. Document expected performance targets
5. Add regression thresholds

## Resources

- [Three.js Performance Tips](https://discoverthreejs.com/tips-and-tricks/)
- [React Performance Profiling](https://reactjs.org/docs/profiler.html)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)