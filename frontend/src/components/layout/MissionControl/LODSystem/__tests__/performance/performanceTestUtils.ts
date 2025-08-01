/**
 * Performance Testing Utilities
 * 
 * Core utilities for performance testing of 3D visualization components.
 * Provides measurement, analysis, and reporting tools.
 */

import { act } from '@testing-library/react';
import { performance } from 'perf_hooks';

// Performance metrics interface
export interface PerformanceMetrics {
  fps: {
    average: number;
    min: number;
    max: number;
    percentile95: number;
    stability: number; // Standard deviation
  };
  frameTime: {
    average: number;
    max: number;
    percentile95: number;
    jank: number; // Frames over 16.67ms
  };
  memory: {
    initial: number;
    peak: number;
    average: number;
    leakRate: number; // MB per minute
    gcCount: number;
  };
  gpu: {
    drawCalls: number;
    triangles: number;
    textureMemory: number;
    shaderSwitches: number;
  };
  cpu: {
    userTime: number;
    systemTime: number;
    idleTime: number;
    utilizationPercent: number;
  };
}

// Performance test configuration
export interface PerformanceTestConfig {
  duration: number; // Test duration in milliseconds
  warmupTime: number; // Warmup period before measurements
  sampleRate: number; // Samples per second
  targetFPS: number; // Expected FPS
  maxFrameTime: number; // Maximum acceptable frame time
  memoryThreshold: number; // Maximum memory usage in MB
  enableGPUMetrics: boolean;
  enableMemoryProfiling: boolean;
}

// Default test configuration
export const defaultTestConfig: PerformanceTestConfig = {
  duration: 10000, // 10 seconds
  warmupTime: 2000, // 2 seconds warmup
  sampleRate: 60,
  targetFPS: 60,
  maxFrameTime: 33.33, // 30 FPS minimum
  memoryThreshold: 500, // 500 MB
  enableGPUMetrics: true,
  enableMemoryProfiling: true
};

/**
 * Performance measurement class
 */
export class PerformanceMeasurement {
  private frameTimes: number[] = [];
  private memorySnapshots: number[] = [];
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private rafHandle?: number;
  private isRunning: boolean = false;
  private config: PerformanceTestConfig;
  
  constructor(config: Partial<PerformanceTestConfig> = {}) {
    this.config = { ...defaultTestConfig, ...config };
  }

  /**
   * Start performance measurement
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameTimes = [];
    this.memorySnapshots = [];
    
    // Start measurement loop
    this.measureFrame();
  }

  /**
   * Stop performance measurement
   */
  stop(): PerformanceMetrics {
    this.isRunning = false;
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
    }
    
    return this.calculateMetrics();
  }

  /**
   * Measure a single frame
   */
  private measureFrame = (): void => {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;
    
    // Skip warmup period
    if (elapsed > this.config.warmupTime) {
      const frameTime = currentTime - this.lastFrameTime;
      this.frameTimes.push(frameTime);
      
      // Sample memory if enabled
      if (this.config.enableMemoryProfiling && performance.memory) {
        this.memorySnapshots.push(performance.memory.usedJSHeapSize / 1048576); // Convert to MB
      }
    }
    
    this.lastFrameTime = currentTime;
    
    // Continue until duration is reached
    if (elapsed < this.config.duration) {
      this.rafHandle = requestAnimationFrame(this.measureFrame);
    } else {
      this.stop();
    }
  };

  /**
   * Calculate performance metrics from collected data
   */
  private calculateMetrics(): PerformanceMetrics {
    const sortedFrameTimes = [...this.frameTimes].sort((a, b) => a - b);
    const avgFrameTime = this.average(this.frameTimes);
    const fps = this.frameTimes.map(ft => 1000 / ft);
    const avgFPS = this.average(fps);
    
    return {
      fps: {
        average: avgFPS,
        min: Math.min(...fps),
        max: Math.max(...fps),
        percentile95: this.percentile(fps, 95),
        stability: this.standardDeviation(fps)
      },
      frameTime: {
        average: avgFrameTime,
        max: Math.max(...this.frameTimes),
        percentile95: this.percentile(sortedFrameTimes, 95),
        jank: this.frameTimes.filter(ft => ft > 16.67).length
      },
      memory: this.calculateMemoryMetrics(),
      gpu: this.getGPUMetrics(),
      cpu: this.getCPUMetrics()
    };
  }

  /**
   * Calculate memory metrics
   */
  private calculateMemoryMetrics() {
    if (this.memorySnapshots.length === 0) {
      return {
        initial: 0,
        peak: 0,
        average: 0,
        leakRate: 0,
        gcCount: 0
      };
    }

    const initial = this.memorySnapshots[0];
    const peak = Math.max(...this.memorySnapshots);
    const average = this.average(this.memorySnapshots);
    
    // Calculate leak rate (MB per minute)
    const duration = this.config.duration / 60000; // Convert to minutes
    const leakRate = (this.memorySnapshots[this.memorySnapshots.length - 1] - initial) / duration;
    
    // Count GC events (significant drops in memory)
    let gcCount = 0;
    for (let i = 1; i < this.memorySnapshots.length; i++) {
      if (this.memorySnapshots[i] < this.memorySnapshots[i - 1] * 0.8) {
        gcCount++;
      }
    }
    
    return { initial, peak, average, leakRate, gcCount };
  }

  /**
   * Get GPU metrics (mock implementation - requires WebGL extension)
   */
  private getGPUMetrics() {
    // In a real implementation, this would query WebGL extensions
    return {
      drawCalls: 0,
      triangles: 0,
      textureMemory: 0,
      shaderSwitches: 0
    };
  }

  /**
   * Get CPU metrics (mock implementation)
   */
  private getCPUMetrics() {
    // In a real implementation, this would use performance.measureUserAgentSpecificMemory()
    return {
      userTime: 0,
      systemTime: 0,
      idleTime: 0,
      utilizationPercent: 0
    };
  }

  /**
   * Helper functions
   */
  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private standardDeviation(values: number[]): number {
    const avg = this.average(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(this.average(squareDiffs));
  }

  private percentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[index];
  }
}

/**
 * Performance test runner
 */
export class PerformanceTestRunner {
  private scenarios: Map<string, () => Promise<PerformanceMetrics>> = new Map();
  
  /**
   * Register a test scenario
   */
  registerScenario(name: string, scenario: () => Promise<PerformanceMetrics>): void {
    this.scenarios.set(name, scenario);
  }

  /**
   * Run all registered scenarios
   */
  async runAll(): Promise<Map<string, PerformanceMetrics>> {
    const results = new Map<string, PerformanceMetrics>();
    
    for (const [name, scenario] of this.scenarios) {
      console.log(`Running performance scenario: ${name}`);
      const metrics = await scenario();
      results.set(name, metrics);
    }
    
    return results;
  }

  /**
   * Run a specific scenario
   */
  async runScenario(name: string): Promise<PerformanceMetrics> {
    const scenario = this.scenarios.get(name);
    if (!scenario) {
      throw new Error(`Scenario "${name}" not found`);
    }
    
    return await scenario();
  }

  /**
   * Generate performance report
   */
  generateReport(results: Map<string, PerformanceMetrics>): string {
    let report = '# Performance Test Report\n\n';
    report += `Generated at: ${new Date().toISOString()}\n\n`;
    
    for (const [scenario, metrics] of results) {
      report += `## Scenario: ${scenario}\n\n`;
      report += `### FPS Metrics\n`;
      report += `- Average: ${metrics.fps.average.toFixed(2)} FPS\n`;
      report += `- Min: ${metrics.fps.min.toFixed(2)} FPS\n`;
      report += `- Max: ${metrics.fps.max.toFixed(2)} FPS\n`;
      report += `- 95th Percentile: ${metrics.fps.percentile95.toFixed(2)} FPS\n`;
      report += `- Stability (σ): ${metrics.fps.stability.toFixed(2)}\n\n`;
      
      report += `### Frame Time\n`;
      report += `- Average: ${metrics.frameTime.average.toFixed(2)}ms\n`;
      report += `- Max: ${metrics.frameTime.max.toFixed(2)}ms\n`;
      report += `- Jank Frames: ${metrics.frameTime.jank}\n\n`;
      
      report += `### Memory\n`;
      report += `- Initial: ${metrics.memory.initial.toFixed(2)} MB\n`;
      report += `- Peak: ${metrics.memory.peak.toFixed(2)} MB\n`;
      report += `- Average: ${metrics.memory.average.toFixed(2)} MB\n`;
      report += `- Leak Rate: ${metrics.memory.leakRate.toFixed(2)} MB/min\n`;
      report += `- GC Count: ${metrics.memory.gcCount}\n\n`;
    }
    
    return report;
  }
}

/**
 * Create a performance test harness
 */
export function createPerformanceTest(
  name: string,
  setup: () => void | Promise<void>,
  test: (measurement: PerformanceMeasurement) => void | Promise<void>,
  teardown?: () => void | Promise<void>,
  config?: Partial<PerformanceTestConfig>
): () => Promise<PerformanceMetrics> {
  return async () => {
    // Setup
    await act(async () => {
      await setup();
    });
    
    // Create measurement
    const measurement = new PerformanceMeasurement(config);
    
    // Run test
    await act(async () => {
      measurement.start();
      await test(measurement);
    });
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, (config?.duration || defaultTestConfig.duration) + 100));
    
    // Get results
    const metrics = measurement.stop();
    
    // Teardown
    if (teardown) {
      await act(async () => {
        await teardown();
      });
    }
    
    return metrics;
  };
}

/**
 * Assert performance metrics meet requirements
 */
export function assertPerformance(
  metrics: PerformanceMetrics,
  requirements: {
    minFPS?: number;
    maxFrameTime?: number;
    maxMemory?: number;
    maxJankFrames?: number;
  }
): void {
  if (requirements.minFPS && metrics.fps.average < requirements.minFPS) {
    throw new Error(`FPS ${metrics.fps.average.toFixed(2)} below minimum ${requirements.minFPS}`);
  }
  
  if (requirements.maxFrameTime && metrics.frameTime.max > requirements.maxFrameTime) {
    throw new Error(`Max frame time ${metrics.frameTime.max.toFixed(2)}ms exceeds limit ${requirements.maxFrameTime}ms`);
  }
  
  if (requirements.maxMemory && metrics.memory.peak > requirements.maxMemory) {
    throw new Error(`Peak memory ${metrics.memory.peak.toFixed(2)}MB exceeds limit ${requirements.maxMemory}MB`);
  }
  
  if (requirements.maxJankFrames && metrics.frameTime.jank > requirements.maxJankFrames) {
    throw new Error(`Jank frames ${metrics.frameTime.jank} exceeds limit ${requirements.maxJankFrames}`);
  }
}

// Export performance global for browser environments
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}