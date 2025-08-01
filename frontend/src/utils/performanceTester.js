/**
 * Performance Testing Suite
 * Comprehensive testing utilities for validating memoization and optimization results
 * Measures render performance, memory usage, and optimization effectiveness
 */

import React from 'react';
import { render, act } from '@testing-library/react';

/**
 * Performance metrics collector
 */
class PerformanceCollector {
  constructor() {
    this.metrics = {
      renderTimes: [],
      reRenderCounts: {},
      memoryUsage: [],
      frameTimes: [],
      cacheStats: {
        hits: 0,
        misses: 0
      }
    };
    this.observers = [];
    this.startTime = performance.now();
  }
  
  recordRenderTime(componentName, duration) {
    this.metrics.renderTimes.push({
      component: componentName,
      duration,
      timestamp: performance.now() - this.startTime
    });
  }
  
  recordReRender(componentName) {
    this.metrics.reRenderCounts[componentName] = 
      (this.metrics.reRenderCounts[componentName] || 0) + 1;
  }
  
  recordMemoryUsage() {
    if (performance.memory) {
      this.metrics.memoryUsage.push({
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: performance.now() - this.startTime
      });
    }
  }
  
  recordFrameTime(duration) {
    this.metrics.frameTimes.push({
      duration,
      timestamp: performance.now() - this.startTime
    });
  }
  
  recordCacheHit() {
    this.metrics.cacheStats.hits++;
  }
  
  recordCacheMiss() {
    this.metrics.cacheStats.misses++;
  }
  
  getReport() {
    return {
      summary: this.getSummary(),
      detailed: this.metrics
    };
  }
  
  getSummary() {
    const renderTimes = this.metrics.renderTimes.map(r => r.duration);
    const frameTimes = this.metrics.frameTimes.map(f => f.duration);
    
    return {
      totalRenders: renderTimes.length,
      averageRenderTime: this.average(renderTimes),
      maxRenderTime: Math.max(...renderTimes, 0),
      minRenderTime: Math.min(...renderTimes, Infinity),
      totalReRenders: Object.values(this.metrics.reRenderCounts).reduce((sum, count) => sum + count, 0),
      componentReRenderCounts: this.metrics.reRenderCounts,
      averageFrameTime: this.average(frameTimes),
      droppedFrames: frameTimes.filter(t => t > 16.67).length, // 60fps threshold
      cacheHitRate: this.metrics.cacheStats.hits / Math.max(1, this.metrics.cacheStats.hits + this.metrics.cacheStats.misses),
      peakMemoryUsage: Math.max(...this.metrics.memoryUsage.map(m => m.used), 0),
      memoryGrowth: this.calculateMemoryGrowth()
    };
  }
  
  average(numbers) {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }
  
  calculateMemoryGrowth() {
    const usage = this.metrics.memoryUsage;
    if (usage.length < 2) return 0;
    
    const first = usage[0].used;
    const last = usage[usage.length - 1].used;
    return last - first;
  }
}

/**
 * Component wrapper for render tracking
 */
export function withRenderTracking(Component, componentName) {
  return React.forwardRef((props, ref) => {
    const renderStartTime = React.useRef(0);
    
    // Track render start
    renderStartTime.current = performance.now();
    
    // Track render completion
    React.useLayoutEffect(() => {
      const duration = performance.now() - renderStartTime.current;
      window.performanceCollector?.recordRenderTime(componentName, duration);
      window.performanceCollector?.recordReRender(componentName);
    });
    
    return <Component {...props} ref={ref} />;
  });
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
  constructor(interval = 1000) {
    this.interval = interval;
    this.intervalId = null;
  }
  
  start() {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      window.performanceCollector?.recordMemoryUsage();
    }, this.interval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/**
 * Frame rate monitor
 */
export class FrameRateMonitor {
  constructor() {
    this.frameId = null;
    this.lastTime = 0;
  }
  
  start() {
    if (this.frameId) return;
    
    const measureFrame = (currentTime) => {
      if (this.lastTime > 0) {
        const frameTime = currentTime - this.lastTime;
        window.performanceCollector?.recordFrameTime(frameTime);
      }
      
      this.lastTime = currentTime;
      this.frameId = requestAnimationFrame(measureFrame);
    };
    
    this.frameId = requestAnimationFrame(measureFrame);
  }
  
  stop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }
}

/**
 * Memoization effectiveness tester
 */
export class MemoizationTester {
  constructor() {
    this.reRenderCounts = new Map();
    this.originalMemo = React.memo;
    this.originalUseMemo = React.useMemo;
    this.originalUseCallback = React.useCallback;
  }
  
  startTracking() {
    // Override React.memo to track re-renders
    React.memo = (component, areEqual) => {
      const MemoizedComponent = this.originalMemo(component, (prevProps, nextProps) => {
        const shouldSkip = areEqual ? areEqual(prevProps, nextProps) : this.shallowEqual(prevProps, nextProps);
        
        const componentName = component.displayName || component.name || 'Unknown';
        
        if (shouldSkip) {
          // Prevented re-render
          window.performanceCollector?.recordCacheHit();
        } else {
          // Re-render occurred
          this.reRenderCounts.set(componentName, (this.reRenderCounts.get(componentName) || 0) + 1);
          window.performanceCollector?.recordCacheMiss();
        }
        
        return shouldSkip;
      });
      
      return MemoizedComponent;
    };
  }
  
  stopTracking() {
    React.memo = this.originalMemo;
    React.useMemo = this.originalUseMemo;
    React.useCallback = this.originalUseCallback;
  }
  
  shallowEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => obj1[key] === obj2[key]);
  }
  
  getResults() {
    return {
      reRenderCounts: Object.fromEntries(this.reRenderCounts),
      totalPreventedRenders: Array.from(this.reRenderCounts.values()).reduce((sum, count) => sum + count, 0)
    };
  }
}

/**
 * Performance test suite
 */
export class PerformanceTestSuite {
  constructor() {
    this.collector = new PerformanceCollector();
    this.memoryMonitor = new MemoryMonitor();
    this.frameMonitor = new FrameRateMonitor();
    this.memoTester = new MemoizationTester();
    
    // Make collector globally available
    window.performanceCollector = this.collector;
  }
  
  async runTest(testName, testFunction, options = {}) {
    const {
      duration = 5000,
      iterations = 1,
      memoryMonitoring = true,
      frameMonitoring = true,
      memoizationTracking = true
    } = options;
    
    console.log(`Starting performance test: ${testName}`);
    
    // Start monitoring
    if (memoryMonitoring) this.memoryMonitor.start();
    if (frameMonitoring) this.frameMonitor.start();
    if (memoizationTracking) this.memoTester.startTracking();
    
    const startTime = performance.now();
    
    try {
      // Run test iterations
      for (let i = 0; i < iterations; i++) {
        await testFunction(i);
        
        // Break if duration exceeded
        if (performance.now() - startTime > duration) {
          break;
        }
      }
      
      // Wait for any pending operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } finally {
      // Stop monitoring
      if (memoryMonitoring) this.memoryMonitor.stop();
      if (frameMonitoring) this.frameMonitor.stop();
      if (memoizationTracking) this.memoTester.stopTracking();
    }
    
    const endTime = performance.now();
    const report = this.collector.getReport();
    
    console.log(`Performance test completed: ${testName}`);
    console.log(`Duration: ${endTime - startTime}ms`);
    console.log('Summary:', report.summary);
    
    return {
      testName,
      duration: endTime - startTime,
      ...report,
      memoizationResults: memoizationTracking ? this.memoTester.getResults() : null
    };
  }
  
  // Specific test methods
  async testComponentRendering(Component, props, iterations = 100) {
    return this.runTest('Component Rendering', async (iteration) => {
      const { unmount } = render(<Component {...props} />);
      
      // Simulate prop changes
      if (iteration % 10 === 0) {
        render(<Component {...props} key={iteration} />);
      }
      
      unmount();
    }, { iterations });
  }
  
  async testMemoizationEffectiveness(Component, propVariations) {
    return this.runTest('Memoization Effectiveness', async (iteration) => {
      const propIndex = iteration % propVariations.length;
      const props = propVariations[propIndex];
      
      const { rerender, unmount } = render(<Component {...props} />);
      
      // Re-render with same props (should be memoized)
      rerender(<Component {...props} />);
      
      // Re-render with different props
      const nextPropIndex = (propIndex + 1) % propVariations.length;
      rerender(<Component {...propVariations[nextPropIndex]} />);
      
      unmount();
    }, { 
      iterations: propVariations.length * 10,
      memoizationTracking: true 
    });
  }
  
  async testChartPerformance(ChartComponent, dataVariations) {
    return this.runTest('Chart Performance', async (iteration) => {
      const dataIndex = iteration % dataVariations.length;
      const data = dataVariations[dataIndex];
      
      const { rerender, unmount } = render(<ChartComponent data={data} />);
      
      // Simulate real-time data updates
      for (let i = 0; i < 5; i++) {
        const updatedData = {
          ...data,
          datasets: data.datasets.map(dataset => ({
            ...dataset,
            data: dataset.data.map(value => value + Math.random() * 2 - 1)
          }))
        };
        
        rerender(<ChartComponent data={updatedData} />);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      unmount();
    }, { 
      iterations: dataVariations.length * 5,
      frameMonitoring: true 
    });
  }
  
  async test3DPerformance(ThreeDComponent, cameraVariations) {
    return this.runTest('3D Rendering Performance', async (iteration) => {
      const cameraIndex = iteration % cameraVariations.length;
      const camera = cameraVariations[cameraIndex];
      
      const { rerender, unmount } = render(<ThreeDComponent camera={camera} />);
      
      // Simulate camera movements
      for (let i = 0; i < 10; i++) {
        const movedCamera = {
          ...camera,
          position: camera.position.map(pos => pos + Math.sin(i * 0.1))
        };
        
        rerender(<ThreeDComponent camera={movedCamera} />);
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      }
      
      unmount();
    }, { 
      iterations: cameraVariations.length * 3,
      frameMonitoring: true 
    });
  }
  
  generateReport() {
    const report = this.collector.getReport();
    
    const performanceScore = this.calculatePerformanceScore(report.summary);
    
    return {
      ...report,
      performanceScore,
      recommendations: this.generateRecommendations(report.summary)
    };
  }
  
  calculatePerformanceScore(summary) {
    let score = 100;
    
    // Penalize slow render times
    if (summary.averageRenderTime > 16) score -= 20;
    if (summary.maxRenderTime > 50) score -= 15;
    
    // Penalize excessive re-renders
    if (summary.totalReRenders > summary.totalRenders * 0.5) score -= 25;
    
    // Penalize dropped frames
    if (summary.droppedFrames > 0) score -= summary.droppedFrames * 2;
    
    // Reward good cache hit rate
    if (summary.cacheHitRate > 0.8) score += 10;
    if (summary.cacheHitRate < 0.5) score -= 15;
    
    // Penalize memory growth
    if (summary.memoryGrowth > 10 * 1024 * 1024) score -= 10; // 10MB
    
    return Math.max(0, Math.min(100, score));
  }
  
  generateRecommendations(summary) {
    const recommendations = [];
    
    if (summary.averageRenderTime > 16) {
      recommendations.push('Consider optimizing render performance - average render time exceeds 16ms target');
    }
    
    if (summary.totalReRenders > summary.totalRenders * 0.5) {
      recommendations.push('High re-render count detected - review memoization strategy');
    }
    
    if (summary.droppedFrames > 0) {
      recommendations.push(`${summary.droppedFrames} dropped frames detected - optimize for 60fps performance`);
    }
    
    if (summary.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate - review memoization effectiveness');
    }
    
    if (summary.memoryGrowth > 5 * 1024 * 1024) {
      recommendations.push('Significant memory growth detected - check for memory leaks');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! Consider testing with larger datasets or longer durations');
    }
    
    return recommendations;
  }
}

// Export convenience functions
export function createPerformanceTest() {
  return new PerformanceTestSuite();
}

export function benchmarkComponent(Component, testProps, iterations = 100) {
  const suite = new PerformanceTestSuite();
  return suite.testComponentRendering(Component, testProps, iterations);
}

export function benchmarkMemoization(Component, propVariations) {
  const suite = new PerformanceTestSuite();
  return suite.testMemoizationEffectiveness(Component, propVariations);
}

export default PerformanceTestSuite;