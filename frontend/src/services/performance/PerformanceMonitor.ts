import { EventEmitter } from '../websocket/EventEmitter';

// Performance metric types
export interface PerformanceMetrics {
  fps: number;
  frameDrops: number;
  memoryUsage: MemoryUsage;
  renderTime: number;
  telemetryThroughput: number;
  telemetryProcessingTime: number;
  webWorkerPerformance: WebWorkerMetrics;
  timestamp: number;
}

export interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
}

export interface WebWorkerMetrics {
  taskQueueSize: number;
  avgProcessingTime: number;
  errorRate: number;
  throughput: number;
}

export interface PerformanceAlert {
  type: 'fps' | 'memory' | 'processing' | 'throughput' | 'worker';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  recommendations?: string[];
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameDrops: number;
  maxMemoryUsage: number;
  maxRenderTime: number;
  minThroughput: number;
  maxProcessingTime: number;
}

export interface PerformanceReport {
  startTime: number;
  endTime: number;
  duration: number;
  averageMetrics: PerformanceMetrics;
  peakMetrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  bottlenecks: string[];
  recommendations: string[];
}

export interface AdaptiveQualitySettings {
  chartResolution: 'high' | 'medium' | 'low';
  updateFrequency: number;
  maxDataPoints: number;
  enableAnimations: boolean;
  enableEffects: boolean;
}

/**
 * PerformanceMonitor - Comprehensive performance monitoring for telemetry UI
 */
export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private monitoringInterval?: number;
  private frameId?: number;
  private frameCount = 0;
  private lastFrameTime = 0;
  private frameDropCount = 0;
  private renderStartTime = 0;
  private telemetryDataCount = 0;
  private telemetryProcessingTimes: number[] = [];
  private workerMetrics: WebWorkerMetrics = {
    taskQueueSize: 0,
    avgProcessingTime: 0,
    errorRate: 0,
    throughput: 0
  };

  private thresholds: PerformanceThresholds = {
    minFPS: 30,
    maxFrameDrops: 10,
    maxMemoryUsage: 80, // percentage
    maxRenderTime: 16.67, // 60fps = 16.67ms per frame
    minThroughput: 100, // messages per second
    maxProcessingTime: 5 // milliseconds
  };

  private adaptiveQuality: AdaptiveQualitySettings = {
    chartResolution: 'high',
    updateFrequency: 60,
    maxDataPoints: 1000,
    enableAnimations: true,
    enableEffects: true
  };

  private constructor() {
    super();
    this.bindMethods();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private bindMethods(): void {
    this.measureFrame = this.measureFrame.bind(this);
    this.collectMetrics = this.collectMetrics.bind(this);
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();

    // Start FPS monitoring
    this.measureFrame();

    // Start periodic metrics collection
    this.monitoringInterval = window.setInterval(this.collectMetrics, 1000);

    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.emit('monitoringStopped');
  }

  /**
   * Measure frame rate and detect frame drops
   */
  private measureFrame(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const frameDuration = currentTime - this.lastFrameTime;

    // Detect frame drops (frames taking longer than 20ms for 50fps threshold)
    if (frameDuration > 20) {
      this.frameDropCount++;
    }

    this.frameCount++;
    this.lastFrameTime = currentTime;

    this.frameId = requestAnimationFrame(this.measureFrame);
  }

  /**
   * Collect comprehensive performance metrics
   */
  private collectMetrics(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const fps = this.frameCount; // frames in the last second
    const memoryUsage = this.getMemoryUsage();

    const metrics: PerformanceMetrics = {
      fps,
      frameDrops: this.frameDropCount,
      memoryUsage,
      renderTime: this.renderStartTime ? currentTime - this.renderStartTime : 0,
      telemetryThroughput: this.telemetryDataCount,
      telemetryProcessingTime: this.getAverageProcessingTime(),
      webWorkerPerformance: { ...this.workerMetrics },
      timestamp: currentTime
    };

    this.metrics.push(metrics);

    // Keep only last 60 seconds of data
    if (this.metrics.length > 60) {
      this.metrics = this.metrics.slice(-60);
    }

    // Reset counters
    this.frameCount = 0;
    this.frameDropCount = 0;
    this.telemetryDataCount = 0;

    // Check for performance issues
    this.checkPerformanceThresholds(metrics);

    // Adapt quality if needed
    this.adaptPerformanceSettings(metrics);

    this.emit('metricsUpdated', metrics);
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): MemoryUsage {
    const memInfo = (performance as any).memory;
    
    if (!memInfo) {
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        usagePercentage: 0
      };
    }

    const usagePercentage = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100;

    return {
      usedJSHeapSize: memInfo.usedJSHeapSize,
      totalJSHeapSize: memInfo.totalJSHeapSize,
      jsHeapSizeLimit: memInfo.jsHeapSizeLimit,
      usagePercentage
    };
  }

  /**
   * Calculate average processing time
   */
  private getAverageProcessingTime(): number {
    if (this.telemetryProcessingTimes.length === 0) return 0;
    
    const sum = this.telemetryProcessingTimes.reduce((a, b) => a + b, 0);
    const average = sum / this.telemetryProcessingTimes.length;
    
    // Keep only recent processing times
    this.telemetryProcessingTimes = this.telemetryProcessingTimes.slice(-100);
    
    return average;
  }

  /**
   * Check performance thresholds and emit alerts
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const alerts: PerformanceAlert[] = [];

    // Check FPS
    if (metrics.fps < this.thresholds.minFPS) {
      alerts.push({
        type: 'fps',
        severity: metrics.fps < 15 ? 'critical' : 'warning',
        message: `Low FPS detected: ${metrics.fps}`,
        value: metrics.fps,
        threshold: this.thresholds.minFPS,
        timestamp: metrics.timestamp,
        recommendations: [
          'Reduce chart complexity',
          'Decrease update frequency',
          'Enable adaptive quality mode'
        ]
      });
    }

    // Check memory usage
    if (metrics.memoryUsage.usagePercentage > this.thresholds.maxMemoryUsage) {
      alerts.push({
        type: 'memory',
        severity: metrics.memoryUsage.usagePercentage > 90 ? 'critical' : 'warning',
        message: `High memory usage: ${metrics.memoryUsage.usagePercentage.toFixed(1)}%`,
        value: metrics.memoryUsage.usagePercentage,
        threshold: this.thresholds.maxMemoryUsage,
        timestamp: metrics.timestamp,
        recommendations: [
          'Clear historical data cache',
          'Reduce data retention period',
          'Optimize chart rendering'
        ]
      });
    }

    // Check processing time
    if (metrics.telemetryProcessingTime > this.thresholds.maxProcessingTime) {
      alerts.push({
        type: 'processing',
        severity: metrics.telemetryProcessingTime > 10 ? 'critical' : 'warning',
        message: `Slow processing time: ${metrics.telemetryProcessingTime.toFixed(2)}ms`,
        value: metrics.telemetryProcessingTime,
        threshold: this.thresholds.maxProcessingTime,
        timestamp: metrics.timestamp,
        recommendations: [
          'Optimize data processing algorithms',
          'Use web workers for heavy computations',
          'Implement data throttling'
        ]
      });
    }

    // Check throughput
    if (metrics.telemetryThroughput < this.thresholds.minThroughput) {
      alerts.push({
        type: 'throughput',
        severity: 'warning',
        message: `Low throughput: ${metrics.telemetryThroughput} msg/s`,
        value: metrics.telemetryThroughput,
        threshold: this.thresholds.minThroughput,
        timestamp: metrics.timestamp,
        recommendations: [
          'Check network connection',
          'Verify data source',
          'Review filtering settings'
        ]
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.emit('performanceAlert', alert);
    });
  }

  /**
   * Adapt performance settings based on current metrics
   */
  private adaptPerformanceSettings(metrics: PerformanceMetrics): void {
    const previousSettings = { ...this.adaptiveQuality };

    // Adapt based on FPS
    if (metrics.fps < 30) {
      this.adaptiveQuality.chartResolution = 'low';
      this.adaptiveQuality.updateFrequency = 30;
      this.adaptiveQuality.enableAnimations = false;
      this.adaptiveQuality.enableEffects = false;
      this.adaptiveQuality.maxDataPoints = 500;
    } else if (metrics.fps < 45) {
      this.adaptiveQuality.chartResolution = 'medium';
      this.adaptiveQuality.updateFrequency = 45;
      this.adaptiveQuality.enableAnimations = true;
      this.adaptiveQuality.enableEffects = false;
      this.adaptiveQuality.maxDataPoints = 750;
    } else {
      this.adaptiveQuality.chartResolution = 'high';
      this.adaptiveQuality.updateFrequency = 60;
      this.adaptiveQuality.enableAnimations = true;
      this.adaptiveQuality.enableEffects = true;
      this.adaptiveQuality.maxDataPoints = 1000;
    }

    // Adapt based on memory usage
    if (metrics.memoryUsage.usagePercentage > 80) {
      this.adaptiveQuality.maxDataPoints = Math.min(this.adaptiveQuality.maxDataPoints, 300);
      this.adaptiveQuality.enableEffects = false;
    }

    // Emit quality change event if settings changed
    if (JSON.stringify(previousSettings) !== JSON.stringify(this.adaptiveQuality)) {
      this.emit('qualitySettingsChanged', this.adaptiveQuality);
    }
  }

  /**
   * Record telemetry data processing
   */
  public recordTelemetryData(processingTime: number): void {
    this.telemetryDataCount++;
    this.telemetryProcessingTimes.push(processingTime);
  }

  /**
   * Record render start time
   */
  public startRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * Record render end time
   */
  public endRender(): void {
    if (this.renderStartTime) {
      const renderTime = performance.now() - this.renderStartTime;
      this.renderStartTime = 0;
    }
  }

  /**
   * Update web worker metrics
   */
  public updateWorkerMetrics(metrics: Partial<WebWorkerMetrics>): void {
    this.workerMetrics = { ...this.workerMetrics, ...metrics };
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get adaptive quality settings
   */
  public getQualitySettings(): AdaptiveQualitySettings {
    return { ...this.adaptiveQuality };
  }

  /**
   * Set performance thresholds
   */
  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Generate performance report
   */
  public generateReport(duration = 60000): PerformanceReport {
    const endTime = performance.now();
    const startTime = endTime - duration;
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= startTime);

    if (relevantMetrics.length === 0) {
      throw new Error('No metrics available for the specified duration');
    }

    const averageMetrics = this.calculateAverageMetrics(relevantMetrics);
    const peakMetrics = this.calculatePeakMetrics(relevantMetrics);
    const bottlenecks = this.identifyBottlenecks(relevantMetrics);
    const recommendations = this.generateRecommendations(averageMetrics, peakMetrics);

    return {
      startTime,
      endTime,
      duration,
      averageMetrics,
      peakMetrics,
      alerts: [], // Would collect alerts from the duration
      bottlenecks,
      recommendations
    };
  }

  /**
   * Calculate average metrics
   */
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const count = metrics.length;
    const sums = metrics.reduce((acc, metric) => ({
      fps: acc.fps + metric.fps,
      frameDrops: acc.frameDrops + metric.frameDrops,
      memoryUsage: acc.memoryUsage + metric.memoryUsage.usagePercentage,
      renderTime: acc.renderTime + metric.renderTime,
      telemetryThroughput: acc.telemetryThroughput + metric.telemetryThroughput,
      telemetryProcessingTime: acc.telemetryProcessingTime + metric.telemetryProcessingTime
    }), {
      fps: 0,
      frameDrops: 0,
      memoryUsage: 0,
      renderTime: 0,
      telemetryThroughput: 0,
      telemetryProcessingTime: 0
    });

    const lastMetric = metrics[metrics.length - 1];
    
    return {
      fps: sums.fps / count,
      frameDrops: sums.frameDrops / count,
      memoryUsage: {
        ...lastMetric.memoryUsage,
        usagePercentage: sums.memoryUsage / count
      },
      renderTime: sums.renderTime / count,
      telemetryThroughput: sums.telemetryThroughput / count,
      telemetryProcessingTime: sums.telemetryProcessingTime / count,
      webWorkerPerformance: lastMetric.webWorkerPerformance,
      timestamp: lastMetric.timestamp
    };
  }

  /**
   * Calculate peak metrics
   */
  private calculatePeakMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    return metrics.reduce((peak, current) => ({
      fps: Math.max(peak.fps, current.fps),
      frameDrops: Math.max(peak.frameDrops, current.frameDrops),
      memoryUsage: current.memoryUsage.usagePercentage > peak.memoryUsage.usagePercentage 
        ? current.memoryUsage 
        : peak.memoryUsage,
      renderTime: Math.max(peak.renderTime, current.renderTime),
      telemetryThroughput: Math.max(peak.telemetryThroughput, current.telemetryThroughput),
      telemetryProcessingTime: Math.max(peak.telemetryProcessingTime, current.telemetryProcessingTime),
      webWorkerPerformance: current.webWorkerPerformance,
      timestamp: current.timestamp
    }));
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: PerformanceMetrics[]): string[] {
    const bottlenecks: string[] = [];
    const averages = this.calculateAverageMetrics(metrics);

    if (averages.fps < 30) {
      bottlenecks.push('Low frame rate affecting user experience');
    }

    if (averages.memoryUsage.usagePercentage > 70) {
      bottlenecks.push('High memory usage may cause browser slowdown');
    }

    if (averages.renderTime > 16) {
      bottlenecks.push('Slow rendering affecting frame rate');
    }

    if (averages.telemetryProcessingTime > 5) {
      bottlenecks.push('Slow telemetry data processing');
    }

    return bottlenecks;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(average: PerformanceMetrics, peak: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (average.fps < 45) {
      recommendations.push('Enable adaptive quality mode to improve frame rate');
      recommendations.push('Reduce chart update frequency during high data load');
    }

    if (average.memoryUsage.usagePercentage > 60) {
      recommendations.push('Implement data chunking for large datasets');
      recommendations.push('Clear unused chart instances and data caches');
    }

    if (average.telemetryProcessingTime > 3) {
      recommendations.push('Move heavy computations to web workers');
      recommendations.push('Implement data pre-processing and caching');
    }

    if (peak.frameDrops > 20) {
      recommendations.push('Optimize rendering pipeline to reduce frame drops');
      recommendations.push('Consider using canvas-based charts for better performance');
    }

    return recommendations;
  }

  /**
   * Export performance report
   */
  public exportReport(format: 'json' | 'csv' = 'json'): string {
    const report = this.generateReport();
    
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'fps', 'frameDrops', 'memoryUsage', 'renderTime', 'throughput', 'processingTime'];
      const rows = this.metrics.map(m => [
        m.timestamp,
        m.fps,
        m.frameDrops,
        m.memoryUsage.usagePercentage,
        m.renderTime,
        m.telemetryThroughput,
        m.telemetryProcessingTime
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }

  /**
   * Clear metrics history
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.emit('metricsCleared');
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();