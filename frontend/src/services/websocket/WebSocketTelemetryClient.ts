/**
 * WebSocketTelemetryClient - Specialized WebSocket client for high-performance telemetry streaming
 * 
 * This class extends the base WebSocket infrastructure to provide telemetry-specific optimizations:
 * - Sub-100ms latency for real-time data
 * - Support for 100+ channels at 10-100 Hz each
 * - Binary protocol optimization
 * - Intelligent buffering and throttling
 * - Performance monitoring and diagnostics
 */

import { WebSocketClient } from './WebSocketClient';
import { TelemetryManager, TelemetryStreamConfig, TelemetryDataPoint } from './TelemetryManager';
import { EventEmitter } from './EventEmitter';
import {
  WebSocketConfig,
  ConnectionState,
  MessageType,
  Priority,
  Protocol,
  AuthenticationData,
  ConnectionOptions,
  WebSocketEventHandlers,
  ConnectionMetrics
} from './types';

/**
 * Telemetry-specific configuration options
 */
export interface TelemetryClientConfig extends WebSocketConfig {
  telemetry: {
    maxChannels: number;              // Maximum concurrent telemetry channels
    bufferSize: number;              // Default buffer size per channel
    targetLatency: number;           // Target end-to-end latency in ms
    batchSize: number;               // Number of points to batch for processing
    adaptiveThrottling: boolean;     // Enable adaptive throttling based on performance
    priorityChannels: string[];      // Channel IDs with high priority
    compressionThreshold: number;    // Minimum points before compression
    memoryPoolSize: number;          // Size of pre-allocated memory pool
    enableWebWorkers: boolean;       // Use Web Workers for background processing
    diagnosticsInterval: number;     // Diagnostics collection interval in ms
  };
}

/**
 * Telemetry stream subscription with performance tracking
 */
export interface TelemetrySubscription {
  streamId: string;
  config: TelemetryStreamConfig;
  subscriptionId: string;
  active: boolean;
  priority: Priority;
  performanceProfile: {
    averageLatency: number;
    dataRate: number;
    lossRate: number;
    bufferUtilization: number;
    lastUpdate: number;
  };
  healthCheck: {
    lastHeartbeat: number;
    missedHeartbeats: number;
    status: 'healthy' | 'warning' | 'critical' | 'offline';
  };
}

/**
 * Real-time performance metrics for telemetry
 */
export interface TelemetryPerformanceMetrics {
  totalChannels: number;
  activeChannels: number;
  totalDataRate: number;              // Points per second across all channels
  averageLatency: number;             // Average end-to-end latency
  memoryUsage: number;                // Memory usage in MB
  cpuUsage: number;                   // Estimated CPU usage percentage
  networkThroughput: number;          // Bytes per second
  droppedPackets: number;
  bufferOverflows: number;
  performanceScore: number;           // 0-100 performance score
  bottlenecks: string[];              // List of detected bottlenecks
  recommendations: string[];          // Performance recommendations
}

/**
 * Telemetry events for monitoring and diagnostics
 */
export interface TelemetryClientEvents {
  'telemetry:connected': () => void;
  'telemetry:disconnected': (reason: string) => void;
  'telemetry:subscribed': (subscription: TelemetrySubscription) => void;
  'telemetry:unsubscribed': (streamId: string) => void;
  'telemetry:data': (streamId: string, data: TelemetryDataPoint) => void;
  'telemetry:batch': (streamId: string, data: TelemetryDataPoint[]) => void;
  'telemetry:error': (streamId: string, error: Error) => void;
  'telemetry:performance': (metrics: TelemetryPerformanceMetrics) => void;
  'telemetry:bottleneck': (type: string, description: string) => void;
  'telemetry:health': (streamId: string, status: string) => void;
  'telemetry:overflow': (streamId: string, droppedCount: number) => void;
}

/**
 * Adaptive throttling controller for managing data flow
 */
class AdaptiveThrottleController {
  private targetLatency: number;
  private currentLatency = 0;
  private throttleLevel = 0;        // 0-1, where 1 is maximum throttling
  private performanceSamples: number[] = [];
  private adjustmentInterval?: NodeJS.Timeout;

  constructor(targetLatency: number) {
    this.targetLatency = targetLatency;
    this.startPerformanceMonitoring();
  }

  updateLatency(latency: number): void {
    this.currentLatency = latency;
    this.performanceSamples.push(latency);
    
    // Keep only recent samples (last 100)
    if (this.performanceSamples.length > 100) {
      this.performanceSamples.shift();
    }
  }

  getThrottleLevel(): number {
    return this.throttleLevel;
  }

  shouldThrottle(priority: Priority): boolean {
    if (priority === Priority.CRITICAL) return false;
    if (priority === Priority.HIGH && this.throttleLevel < 0.7) return false;
    
    return Math.random() < this.throttleLevel;
  }

  private startPerformanceMonitoring(): void {
    this.adjustmentInterval = setInterval(() => {
      this.adjustThrottling();
    }, 1000); // Adjust every second
  }

  private adjustThrottling(): void {
    if (this.performanceSamples.length < 10) return;

    const avgLatency = this.performanceSamples.reduce((a, b) => a + b, 0) / this.performanceSamples.length;
    const latencyTrend = this.calculateTrend();

    // Adjust throttling based on performance
    if (avgLatency > this.targetLatency * 1.5) {
      // Latency too high, increase throttling
      this.throttleLevel = Math.min(1, this.throttleLevel + 0.1);
    } else if (avgLatency < this.targetLatency * 0.8 && latencyTrend <= 0) {
      // Latency good and stable/improving, decrease throttling
      this.throttleLevel = Math.max(0, this.throttleLevel - 0.05);
    }
  }

  private calculateTrend(): number {
    if (this.performanceSamples.length < 20) return 0;
    
    const recent = this.performanceSamples.slice(-10);
    const older = this.performanceSamples.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return recentAvg - olderAvg;
  }

  destroy(): void {
    if (this.adjustmentInterval) {
      clearInterval(this.adjustmentInterval);
    }
  }
}

/**
 * Memory pool for efficient buffer management
 */
class TelemetryMemoryPool {
  private pools = new Map<number, any[]>();
  private sizes = [1024, 4096, 16384, 65536]; // Different buffer sizes

  constructor(poolSize: number) {
    // Pre-allocate buffers of different sizes
    this.sizes.forEach(size => {
      const pool: any[] = [];
      for (let i = 0; i < poolSize; i++) {
        pool.push(new ArrayBuffer(size));
      }
      this.pools.set(size, pool);
    });
  }

  acquire(minSize: number): ArrayBuffer | null {
    // Find the smallest pool that can accommodate the size
    const targetSize = this.sizes.find(size => size >= minSize);
    if (!targetSize) return null;

    const pool = this.pools.get(targetSize);
    return pool && pool.length > 0 ? pool.pop() : null;
  }

  release(buffer: ArrayBuffer): void {
    const size = buffer.byteLength;
    const pool = this.pools.get(size);
    if (pool && pool.length < 100) { // Don't let pools grow too large
      pool.push(buffer);
    }
  }

  getUtilization(): Map<number, number> {
    const utilization = new Map<number, number>();
    this.pools.forEach((pool, size) => {
      const totalCapacity = 100; // Assume max 100 buffers per pool
      const used = totalCapacity - pool.length;
      utilization.set(size, used / totalCapacity);
    });
    return utilization;
  }
}

/**
 * WebSocketTelemetryClient - High-performance telemetry streaming client
 */
export class WebSocketTelemetryClient extends EventEmitter<TelemetryClientEvents> {
  private wsClient: WebSocketClient;
  private telemetryManager: TelemetryManager;
  private config: TelemetryClientConfig;
  private subscriptions = new Map<string, TelemetrySubscription>();
  private throttleController?: AdaptiveThrottleController;
  private memoryPool?: TelemetryMemoryPool;
  private performanceMetrics: TelemetryPerformanceMetrics;
  private diagnosticsInterval?: NodeJS.Timeout;
  private webWorker?: Worker;
  private isDestroyed = false;

  // Performance tracking
  private latencySamples: number[] = [];
  private throughputSamples: number[] = [];
  private lastMetricsUpdate = 0;

  constructor(config: TelemetryClientConfig) {
    super();
    
    this.config = config;
    this.wsClient = new WebSocketClient(config);
    this.telemetryManager = new TelemetryManager(this.wsClient);
    
    this.performanceMetrics = {
      totalChannels: 0,
      activeChannels: 0,
      totalDataRate: 0,
      averageLatency: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      networkThroughput: 0,
      droppedPackets: 0,
      bufferOverflows: 0,
      performanceScore: 100,
      bottlenecks: [],
      recommendations: []
    };

    this.initializeOptimizations();
    this.setupEventHandlers();
    this.startDiagnostics();
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.wsClient.connectionStatus.state;
  }

  /**
   * Get telemetry-specific metrics
   */
  get metrics(): TelemetryPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get active subscriptions
   */
  get activeSubscriptions(): TelemetrySubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.active);
  }

  /**
   * Connect to the telemetry server with optimization
   */
  async connect(options?: ConnectionOptions): Promise<void> {
    try {
      // Optimize connection for telemetry
      const telemetryOptions: ConnectionOptions = {
        ...options,
        // Force WebSocket transport for lowest latency
        transports: ['websocket'],
        // Disable upgrade to avoid connection switching
        upgrade: false,
        // Enable multiplexing for multiple channels
        multiplex: true,
        // Add telemetry-specific headers
        headers: {
          ...options?.headers,
          'X-Telemetry-Client': 'high-performance',
          'X-Target-Latency': this.config.telemetry.targetLatency.toString(),
          'X-Max-Channels': this.config.telemetry.maxChannels.toString()
        }
      };

      await this.wsClient.connect(telemetryOptions);
      
      // Negotiate optimal protocol for telemetry
      await this.negotiateOptimalProtocol();
      
      this.emit('telemetry:connected');
    } catch (error) {
      throw new Error(`Failed to connect telemetry client: ${error}`);
    }
  }

  /**
   * Disconnect from the telemetry server
   */
  async disconnect(): Promise<void> {
    try {
      // Unsubscribe from all streams first
      const streamIds = Array.from(this.subscriptions.keys());
      await Promise.all(streamIds.map(id => this.unsubscribe(id)));
      
      await this.wsClient.disconnect();
      this.emit('telemetry:disconnected', 'manual');
    } catch (error) {
      this.emit('telemetry:disconnected', `error: ${error}`);
      throw error;
    }
  }

  /**
   * Subscribe to a telemetry stream with performance optimization
   */
  async subscribe(config: TelemetryStreamConfig, priority: Priority = Priority.NORMAL): Promise<string> {
    try {
      if (this.subscriptions.size >= this.config.telemetry.maxChannels) {
        throw new Error(`Maximum channels exceeded: ${this.config.telemetry.maxChannels}`);
      }

      // Optimize stream configuration for performance
      const optimizedConfig = this.optimizeStreamConfig(config);
      
      // Subscribe via telemetry manager
      const streamId = await this.telemetryManager.subscribe(optimizedConfig);
      
      // Create subscription record
      const subscription: TelemetrySubscription = {
        streamId,
        config: optimizedConfig,
        subscriptionId: streamId,
        active: true,
        priority,
        performanceProfile: {
          averageLatency: 0,
          dataRate: 0,
          lossRate: 0,
          bufferUtilization: 0,
          lastUpdate: Date.now()
        },
        healthCheck: {
          lastHeartbeat: Date.now(),
          missedHeartbeats: 0,
          status: 'healthy'
        }
      };

      this.subscriptions.set(streamId, subscription);
      this.emit('telemetry:subscribed', subscription);
      
      return streamId;
    } catch (error) {
      throw new Error(`Failed to subscribe to telemetry stream: ${error}`);
    }
  }

  /**
   * Unsubscribe from a telemetry stream
   */
  async unsubscribe(streamId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(streamId);
      if (!subscription) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      await this.telemetryManager.unsubscribe(streamId);
      this.subscriptions.delete(streamId);
      
      this.emit('telemetry:unsubscribed', streamId);
    } catch (error) {
      throw new Error(`Failed to unsubscribe from stream ${streamId}: ${error}`);
    }
  }

  /**
   * Pause a telemetry stream
   */
  async pause(streamId: string): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    await this.telemetryManager.pause(streamId);
    subscription.active = false;
  }

  /**
   * Resume a paused telemetry stream
   */
  async resume(streamId: string): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    await this.telemetryManager.resume(streamId);
    subscription.active = true;
  }

  /**
   * Get buffered data for a stream
   */
  getStreamData(streamId: string, count?: number): TelemetryDataPoint[] {
    return this.telemetryManager.getData(streamId, count);
  }

  /**
   * Get stream statistics
   */
  getStreamStats(streamId: string) {
    return this.telemetryManager.getStreamStats(streamId);
  }

  /**
   * Update stream configuration with performance considerations
   */
  async updateStreamConfig(streamId: string, updates: Partial<TelemetryStreamConfig>): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Optimize the updated configuration
    const optimizedUpdates = this.optimizeStreamConfig({ ...subscription.config, ...updates });
    
    await this.telemetryManager.updateStreamConfig(streamId, optimizedUpdates);
    
    // Update local subscription
    Object.assign(subscription.config, optimizedUpdates);
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    metrics: TelemetryPerformanceMetrics;
    subscriptions: TelemetrySubscription[];
    recommendations: string[];
    bottlenecks: string[];
  } {
    return {
      metrics: this.performanceMetrics,
      subscriptions: this.activeSubscriptions,
      recommendations: this.generateRecommendations(),
      bottlenecks: this.detectBottlenecks()
    };
  }

  /**
   * Destroy the client and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Stop diagnostics
    if (this.diagnosticsInterval) {
      clearInterval(this.diagnosticsInterval);
    }

    // Cleanup throttle controller
    this.throttleController?.destroy();

    // Terminate web worker
    this.webWorker?.terminate();

    // Destroy telemetry manager
    await this.telemetryManager.destroy();

    // Destroy WebSocket client
    await this.wsClient.destroy();

    // Clear all subscriptions
    this.subscriptions.clear();

    // Remove all listeners
    this.removeAllListeners();
  }

  private initializeOptimizations(): void {
    // Initialize adaptive throttling if enabled
    if (this.config.telemetry.adaptiveThrottling) {
      this.throttleController = new AdaptiveThrottleController(this.config.telemetry.targetLatency);
    }

    // Initialize memory pool
    if (this.config.telemetry.memoryPoolSize > 0) {
      this.memoryPool = new TelemetryMemoryPool(this.config.telemetry.memoryPoolSize);
    }

    // Initialize Web Worker for background processing if enabled
    if (this.config.telemetry.enableWebWorkers && typeof Worker !== 'undefined') {
      this.initializeWebWorker();
    }
  }

  private initializeWebWorker(): void {
    try {
      // Create Web Worker for telemetry processing
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          switch (type) {
            case 'process_batch':
              // Process telemetry batch in background
              const processed = data.map(point => ({
                ...point,
                processed: true,
                processingTime: Date.now()
              }));
              self.postMessage({ type: 'batch_processed', data: processed });
              break;
              
            case 'calculate_stats':
              // Calculate statistics in background
              const stats = calculateStreamStats(data);
              self.postMessage({ type: 'stats_calculated', data: stats });
              break;
          }
        };
        
        function calculateStreamStats(data) {
          // Statistical calculations
          const values = data.map(p => p.value).filter(v => typeof v === 'number');
          return {
            count: values.length,
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.webWorker = new Worker(URL.createObjectURL(blob));
      
      this.webWorker.onmessage = (e) => {
        const { type, data } = e.data;
        // Handle worker messages
        if (type === 'batch_processed') {
          // Process completed batch
        }
      };
    } catch (error) {
      console.warn('Failed to initialize Web Worker for telemetry processing:', error);
    }
  }

  private setupEventHandlers(): void {
    // Handle telemetry data events
    this.telemetryManager.on('stream:data', (event) => {
      const subscription = this.subscriptions.get(event.streamId);
      if (!subscription) return;

      // Update performance metrics
      this.updatePerformanceMetrics(event);

      // Apply throttling if needed
      if (this.throttleController?.shouldThrottle(subscription.priority)) {
        return; // Skip this data point due to throttling
      }

      // Track latency
      const latency = Date.now() - event.data.timestamp;
      this.latencySamples.push(latency);
      this.throttleController?.updateLatency(latency);

      this.emit('telemetry:data', event.streamId, event.data);
    });

    // Handle buffer overflow events
    this.telemetryManager.on('buffer:overflow', (streamId, droppedCount) => {
      this.performanceMetrics.bufferOverflows += droppedCount;
      this.emit('telemetry:overflow', streamId, droppedCount);
    });

    // Handle stream errors
    this.telemetryManager.on('stream:error', (streamId, error) => {
      this.emit('telemetry:error', streamId, error);
    });

    // Handle WebSocket connection events
    this.wsClient.on('onConnect', () => {
      this.emit('telemetry:connected');
    });

    this.wsClient.on('onDisconnect', (event) => {
      this.emit('telemetry:disconnected', event.error?.message || 'unknown');
    });
  }

  private async negotiateOptimalProtocol(): Promise<void> {
    // Determine optimal protocol based on configuration and server capabilities
    const protocols = this.wsClient.getProtocolMetrics();
    let optimalProtocol = Protocol.MESSAGEPACK; // Default for telemetry

    // Choose protocol based on data characteristics
    if (this.config.telemetry.maxChannels > 50) {
      // High channel count benefits from binary protocols
      optimalProtocol = Protocol.MESSAGEPACK;
    }

    try {
      await this.wsClient.switchProtocol(optimalProtocol);
    } catch (error) {
      console.warn('Failed to switch to optimal protocol:', error);
    }
  }

  private optimizeStreamConfig(config: TelemetryStreamConfig): TelemetryStreamConfig {
    const optimized = { ...config };

    // Optimize buffer size based on sample rate
    if (config.sampleRate && config.sampleRate > 50) {
      // High-frequency streams need larger buffers
      optimized.bufferSize = Math.max(optimized.bufferSize, config.sampleRate * 2);
    }

    // Apply decimation for very high frequency streams
    if (config.sampleRate && config.sampleRate > 100 && !config.decimationFactor) {
      optimized.decimationFactor = Math.ceil(config.sampleRate / 60); // Target ~60 fps
    }

    return optimized;
  }

  private updatePerformanceMetrics(event: any): void {
    const now = Date.now();
    
    // Update data rate
    this.throughputSamples.push(now);
    this.throughputSamples = this.throughputSamples.filter(t => now - t < 1000); // Last second
    this.performanceMetrics.totalDataRate = this.throughputSamples.length;

    // Update subscription performance
    const subscription = this.subscriptions.get(event.streamId);
    if (subscription) {
      subscription.performanceProfile.dataRate = this.performanceMetrics.totalDataRate;
      subscription.performanceProfile.lastUpdate = now;
      subscription.healthCheck.lastHeartbeat = now;
    }

    // Calculate performance score
    this.calculatePerformanceScore();
  }

  private calculatePerformanceScore(): void {
    let score = 100;

    // Penalize high latency
    if (this.performanceMetrics.averageLatency > this.config.telemetry.targetLatency) {
      score -= Math.min(30, (this.performanceMetrics.averageLatency - this.config.telemetry.targetLatency) / 10);
    }

    // Penalize buffer overflows
    if (this.performanceMetrics.bufferOverflows > 0) {
      score -= Math.min(20, this.performanceMetrics.bufferOverflows / 10);
    }

    // Penalize high CPU usage
    if (this.performanceMetrics.cpuUsage > 80) {
      score -= 15;
    }

    this.performanceMetrics.performanceScore = Math.max(0, score);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.performanceMetrics.averageLatency > this.config.telemetry.targetLatency * 1.5) {
      recommendations.push('Consider reducing sample rates or enabling adaptive throttling');
    }

    if (this.performanceMetrics.bufferOverflows > 10) {
      recommendations.push('Increase buffer sizes or enable data compression');
    }

    if (this.subscriptions.size > this.config.telemetry.maxChannels * 0.8) {
      recommendations.push('Close unused telemetry channels to improve performance');
    }

    return recommendations;
  }

  private detectBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    if (this.performanceMetrics.averageLatency > 200) {
      bottlenecks.push('High network latency detected');
    }

    if (this.performanceMetrics.cpuUsage > 90) {
      bottlenecks.push('CPU usage critical - consider enabling Web Workers');
    }

    if (this.performanceMetrics.memoryUsage > 500) {
      bottlenecks.push('High memory usage - consider memory pool optimization');
    }

    return bottlenecks;
  }

  private startDiagnostics(): void {
    this.diagnosticsInterval = setInterval(() => {
      if (this.isDestroyed) return;

      // Update latency metrics
      if (this.latencySamples.length > 0) {
        this.performanceMetrics.averageLatency = 
          this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
        
        // Keep only recent samples
        this.latencySamples = this.latencySamples.slice(-100);
      }

      // Update channel counts
      this.performanceMetrics.totalChannels = this.subscriptions.size;
      this.performanceMetrics.activeChannels = this.activeSubscriptions.length;

      // Estimate memory usage
      if (this.memoryPool) {
        const utilization = this.memoryPool.getUtilization();
        this.performanceMetrics.memoryUsage = Array.from(utilization.values())
          .reduce((a, b) => a + b, 0) * 50; // Rough estimate in MB
      }

      // Update network throughput
      const wsMetrics = this.wsClient.getMetrics();
      this.performanceMetrics.networkThroughput = wsMetrics.bytesReceived;

      // Emit performance update
      this.emit('telemetry:performance', this.performanceMetrics);

    }, this.config.telemetry.diagnosticsInterval);
  }
}

// Default telemetry client configuration
export const DEFAULT_TELEMETRY_CONFIG: TelemetryClientConfig = {
  // Base WebSocket config
  url: 'ws://localhost:8000/ws',
  reconnect: true,
  reconnectAttempts: 10,
  reconnectDelay: 500,
  reconnectDelayMax: 5000,
  randomizationFactor: 0.2,
  timeout: 10000,
  heartbeatInterval: 15000,
  heartbeatTimeout: 30000,
  protocols: [Protocol.MESSAGEPACK, Protocol.CBOR, Protocol.JSON],
  compression: true,
  debug: false,
  auth: {
    enabled: true,
    tokenRefreshThreshold: 300,
    autoRefresh: true
  },
  queue: {
    maxSize: 10000,
    persistOffline: true,
    priorityEnabled: true
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 1000,
    latencyThreshold: 100
  },
  
  // Telemetry-specific config
  telemetry: {
    maxChannels: 150,
    bufferSize: 5000,
    targetLatency: 50,
    batchSize: 10,
    adaptiveThrottling: true,
    priorityChannels: [],
    compressionThreshold: 1000,
    memoryPoolSize: 50,
    enableWebWorkers: true,
    diagnosticsInterval: 2000
  }
};