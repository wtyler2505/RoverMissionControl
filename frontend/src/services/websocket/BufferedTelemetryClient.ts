/**
 * BufferedTelemetryClient - Integration layer for TelemetryBufferManager
 * 
 * This class integrates the advanced buffering system with the existing
 * WebSocketTelemetryClient and TelemetryManager to provide configurable
 * data buffering with overflow handling and persistence.
 */

import { WebSocketTelemetryClient, TelemetryClientConfig, TelemetrySubscription } from './WebSocketTelemetryClient';
import { 
  TelemetryBufferManager, 
  BufferConfig, 
  BufferOverflowStrategy, 
  FlushTrigger,
  BufferStatistics,
  BufferFlushEvent,
  DEFAULT_BUFFER_CONFIG
} from './TelemetryBufferManager';
import { TelemetryStreamConfig, TelemetryDataPoint } from './TelemetryManager';
import { EventEmitter } from './EventEmitter';
import { Priority } from './types';

/**
 * Enhanced telemetry client configuration with buffering options
 */
export interface BufferedTelemetryConfig extends TelemetryClientConfig {
  buffering: {
    enabled: boolean;                    // Enable advanced buffering
    defaultWindowMs: number;             // Default buffer window size
    defaultOverflowStrategy: BufferOverflowStrategy;
    defaultFlushTriggers: FlushTrigger[];
    enablePersistence: boolean;          // Enable persistence during disconnections
    enableStatistics: boolean;           // Enable buffer statistics
    statisticsInterval: number;          // Statistics update interval
    autoOptimize: boolean;              // Enable automatic buffer optimization
    memoryLimit: number;                // Maximum memory usage in MB
  };
}

/**
 * Stream-specific buffer configuration
 */
export interface StreamBufferConfig extends BufferConfig {
  telemetryConfig: TelemetryStreamConfig;
  priority: Priority;
  autoFlush: boolean;                  // Auto-flush on disconnection
  adaptiveWindowSize: boolean;         // Adjust window size based on data rate
}

/**
 * Buffered telemetry events
 */
export interface BufferedTelemetryEvents {
  // Inherit all base events
  'telemetry:connected': () => void;
  'telemetry:disconnected': (reason: string) => void;
  'telemetry:subscribed': (subscription: TelemetrySubscription) => void;
  'telemetry:unsubscribed': (streamId: string) => void;
  'telemetry:data': (streamId: string, data: TelemetryDataPoint) => void;
  'telemetry:error': (streamId: string, error: Error) => void;
  
  // Buffer-specific events
  'buffer:created': (streamId: string, config: StreamBufferConfig) => void;
  'buffer:overflow': (streamId: string, strategy: BufferOverflowStrategy, droppedCount: number) => void;
  'buffer:flushed': (event: BufferFlushEvent) => void;
  'buffer:statistics': (streamId: string, stats: BufferStatistics) => void;
  'buffer:optimized': (streamId: string, oldConfig: BufferConfig, newConfig: BufferConfig) => void;
  'buffer:persistent:saved': (streamId: string, size: number) => void;
  'buffer:persistent:restored': (streamId: string, size: number) => void;
  'buffer:health:warning': (streamId: string, score: number, issues: string[]) => void;
  'buffer:memory:limit': (currentUsage: number, limit: number) => void;
}

/**
 * Performance optimization recommendations
 */
export interface BufferOptimizationRecommendation {
  streamId: string;
  currentConfig: BufferConfig;
  recommendedConfig: BufferConfig;
  reason: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
}

/**
 * BufferedTelemetryClient - Main class with advanced buffering capabilities
 */
export class BufferedTelemetryClient extends EventEmitter<BufferedTelemetryEvents> {
  private baseClient: WebSocketTelemetryClient;
  private bufferManager: TelemetryBufferManager;
  private config: BufferedTelemetryConfig;
  private streamBufferConfigs = new Map<string, StreamBufferConfig>();
  private optimizationInterval?: NodeJS.Timeout;
  private connectionStateListener?: () => void;
  private isDestroyed = false;

  // Performance tracking
  private performanceMetrics = {
    totalDataPointsBuffered: 0,
    totalFlushEvents: 0,
    totalOverflowEvents: 0,
    memoryUsageMB: 0,
    averageBufferUtilization: 0
  };

  constructor(config: BufferedTelemetryConfig) {
    super();
    
    this.config = config;
    this.baseClient = new WebSocketTelemetryClient(config);
    this.bufferManager = new TelemetryBufferManager();
    
    this.setupEventHandlers();
    
    if (this.config.buffering.autoOptimize) {
      this.startAutoOptimization();
    }
  }

  /**
   * Get current connection state
   */
  get connectionState() {
    return this.baseClient.connectionState;
  }

  /**
   * Get performance metrics including buffer metrics
   */
  get metrics() {
    const baseMetrics = this.baseClient.metrics;
    const globalBufferStats = this.bufferManager.getGlobalStatistics();
    
    return {
      ...baseMetrics,
      buffering: {
        ...this.performanceMetrics,
        totalBuffers: globalBufferStats.totalBuffers,
        activeStreams: globalBufferStats.activeStreams.length,
        totalMemoryUsageMB: globalBufferStats.memoryUsage
      }
    };
  }

  /**
   * Connect with buffer restoration
   */
  async connect(options?: any): Promise<void> {
    try {
      await this.baseClient.connect(options);
      
      // Restore any persisted buffer data
      if (this.config.buffering.enablePersistence) {
        await this.restorePersistedBuffers();
      }
      
      this.emit('telemetry:connected');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disconnect with buffer persistence
   */
  async disconnect(): Promise<void> {
    try {
      // Persist buffer data if enabled
      if (this.config.buffering.enablePersistence) {
        await this.persistAllBuffers();
      }
      
      await this.baseClient.disconnect();
      this.emit('telemetry:disconnected', 'manual');
    } catch (error) {
      this.emit('telemetry:disconnected', `error: ${error}`);
      throw error;
    }
  }

  /**
   * Subscribe to telemetry stream with advanced buffering
   */
  async subscribe(
    config: TelemetryStreamConfig, 
    priority: Priority = Priority.NORMAL,
    bufferOptions?: Partial<BufferConfig>
  ): Promise<string> {
    try {
      // Subscribe via base client
      const streamId = await this.baseClient.subscribe(config, priority);
      
      // Create buffer configuration
      const bufferConfig = this.createBufferConfig(streamId, config, priority, bufferOptions);
      
      // Create buffer
      await this.bufferManager.createBuffer(bufferConfig);
      
      // Store stream buffer config
      const streamBufferConfig: StreamBufferConfig = {
        ...bufferConfig,
        telemetryConfig: config,
        priority,
        autoFlush: true,
        adaptiveWindowSize: this.config.buffering.autoOptimize
      };
      
      this.streamBufferConfigs.set(streamId, streamBufferConfig);
      
      this.emit('buffer:created', streamId, streamBufferConfig);
      this.emit('telemetry:subscribed', { 
        streamId, 
        config, 
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
      });
      
      return streamId;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Unsubscribe from telemetry stream
   */
  async unsubscribe(streamId: string): Promise<void> {
    try {
      // Persist buffer data if needed
      const bufferConfig = this.streamBufferConfigs.get(streamId);
      if (bufferConfig?.enablePersistence) {
        const data = this.bufferManager.getData(streamId);
        if (data.length > 0) {
          // Buffer manager will handle persistence internally
          await this.bufferManager.flushBuffer(streamId);
        }
      }
      
      // Destroy buffer
      await this.bufferManager.destroyBuffer(streamId);
      
      // Unsubscribe from base client
      await this.baseClient.unsubscribe(streamId);
      
      // Cleanup
      this.streamBufferConfigs.delete(streamId);
      
      this.emit('telemetry:unsubscribed', streamId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get buffered data with enhanced options
   */
  getBufferedData(streamId: string, options?: {
    count?: number;
    startTime?: number;
    endTime?: number;
    includeStatistics?: boolean;
  }): {
    data: TelemetryDataPoint[];
    statistics?: BufferStatistics;
  } {
    const data = this.bufferManager.getData(streamId, options);
    const result: any = { data };
    
    if (options?.includeStatistics) {
      result.statistics = this.bufferManager.getStatistics(streamId);
    }
    
    return result;
  }

  /**
   * Get buffer statistics
   */
  getBufferStatistics(streamId?: string): BufferStatistics | Map<string, BufferStatistics> | null {
    if (streamId) {
      return this.bufferManager.getStatistics(streamId);
    } else {
      return this.bufferManager.getAllStatistics();
    }
  }

  /**
   * Manually flush buffer
   */
  async flushBuffer(streamId: string): Promise<BufferFlushEvent | null> {
    return this.bufferManager.flushBuffer(streamId);
  }

  /**
   * Flush all buffers
   */
  async flushAllBuffers(): Promise<BufferFlushEvent[]> {
    const streamIds = Array.from(this.streamBufferConfigs.keys());
    const flushPromises = streamIds.map(id => this.bufferManager.flushBuffer(id));
    const results = await Promise.all(flushPromises);
    return results.filter(event => event !== null) as BufferFlushEvent[];
  }

  /**
   * Update buffer configuration for a stream
   */
  async updateBufferConfig(streamId: string, updates: Partial<BufferConfig>): Promise<void> {
    try {
      await this.bufferManager.updateConfig(streamId, updates);
      
      // Update local config
      const streamConfig = this.streamBufferConfigs.get(streamId);
      if (streamConfig) {
        Object.assign(streamConfig, updates);
      }
    } catch (error) {
      this.emit('telemetry:error', streamId, error as Error);
      throw error;
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): BufferOptimizationRecommendation[] {
    const recommendations: BufferOptimizationRecommendation[] = [];
    const allStats = this.bufferManager.getAllStatistics();
    
    for (const [streamId, stats] of allStats) {
      const streamConfig = this.streamBufferConfigs.get(streamId);
      if (!streamConfig) continue;
      
      const recommendation = this.analyzeBufferPerformance(streamId, stats, streamConfig);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }
    
    return recommendations;
  }

  /**
   * Apply optimization recommendations automatically
   */
  async applyOptimizations(recommendations?: BufferOptimizationRecommendation[]): Promise<void> {
    const recs = recommendations || this.getOptimizationRecommendations();
    
    for (const rec of recs) {
      if (rec.confidence > 0.7 && rec.impact !== 'low') {
        try {
          const oldConfig = rec.currentConfig;
          await this.updateBufferConfig(rec.streamId, rec.recommendedConfig);
          this.emit('buffer:optimized', rec.streamId, oldConfig, rec.recommendedConfig);
        } catch (error) {
          this.emit('telemetry:error', rec.streamId, error as Error);
        }
      }
    }
  }

  /**
   * Clear buffer for a stream
   */
  clearBuffer(streamId: string): void {
    this.bufferManager.clearBuffer(streamId);
  }

  /**
   * Clear all buffers
   */
  clearAllBuffers(): void {
    const streamIds = Array.from(this.streamBufferConfigs.keys());
    streamIds.forEach(id => this.bufferManager.clearBuffer(id));
  }

  /**
   * Get comprehensive report
   */
  getComprehensiveReport(): {
    connection: any;
    performance: any;
    buffers: Map<string, BufferStatistics>;
    optimizations: BufferOptimizationRecommendation[];
    health: {
      overallScore: number;
      issues: string[];
      recommendations: string[];
    };
  } {
    const allStats = this.bufferManager.getAllStatistics();
    const optimizations = this.getOptimizationRecommendations();
    
    // Calculate overall health score
    let totalScore = 0;
    let streamCount = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    for (const [streamId, stats] of allStats) {
      totalScore += stats.healthScore;
      streamCount++;
      
      if (stats.healthScore < 70) {
        issues.push(`Stream ${streamId} health score is low (${stats.healthScore})`);
      }
      
      if (stats.overflowEvents > 10) {
        issues.push(`Stream ${streamId} has frequent overflows`);
        recommendations.push(`Consider increasing buffer size for stream ${streamId}`);
      }
      
      if (stats.utilizationPercent > 90) {
        recommendations.push(`Consider optimizing buffer configuration for stream ${streamId}`);
      }
    }
    
    const overallScore = streamCount > 0 ? totalScore / streamCount : 100;
    
    // Check memory usage
    const globalStats = this.bufferManager.getGlobalStatistics();
    if (globalStats.memoryUsage > this.config.buffering.memoryLimit * 0.9) {
      issues.push('Memory usage is approaching limit');
      recommendations.push('Consider reducing buffer sizes or enabling compression');
    }
    
    return {
      connection: this.baseClient.getPerformanceReport(),
      performance: this.metrics,
      buffers: allStats,
      optimizations,
      health: {
        overallScore,
        issues,
        recommendations
      }
    };
  }

  /**
   * Destroy client and cleanup
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    
    // Stop auto-optimization
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }
    
    // Persist buffers if needed
    if (this.config.buffering.enablePersistence) {
      await this.persistAllBuffers();
    }
    
    // Destroy buffer manager
    await this.bufferManager.destroy();
    
    // Destroy base client
    await this.baseClient.destroy();
    
    // Cleanup
    this.streamBufferConfigs.clear();
    this.removeAllListeners();
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Forward base client events
    this.baseClient.on('telemetry:connected', () => this.emit('telemetry:connected'));
    this.baseClient.on('telemetry:disconnected', (reason) => this.emit('telemetry:disconnected', reason));
    this.baseClient.on('telemetry:error', (streamId, error) => this.emit('telemetry:error', streamId, error));

    // Handle telemetry data through buffer manager
    this.baseClient.on('telemetry:data', (streamId, data) => {
      if (this.config.buffering.enabled) {
        const success = this.bufferManager.addData(streamId, data);
        if (success) {
          this.performanceMetrics.totalDataPointsBuffered++;
        }
        // Emit data event (could be from buffer or direct)
        this.emit('telemetry:data', streamId, data);
      } else {
        // Direct passthrough if buffering disabled
        this.emit('telemetry:data', streamId, data);
      }
    });

    // Handle buffer manager events
    this.bufferManager.on('buffer:overflow', (streamId, strategy, droppedCount) => {
      this.performanceMetrics.totalOverflowEvents++;
      this.emit('buffer:overflow', streamId, strategy, droppedCount);
    });

    this.bufferManager.on('buffer:flush', (event) => {
      this.performanceMetrics.totalFlushEvents++;
      this.emit('buffer:flushed', event);
    });

    this.bufferManager.on('buffer:statistics', (stats) => {
      this.emit('buffer:statistics', stats.streamId, stats);
      
      // Update global performance metrics
      this.updateGlobalMetrics();
    });

    this.bufferManager.on('buffer:persisted', (streamId, size) => {
      this.emit('buffer:persistent:saved', streamId, size);
    });

    this.bufferManager.on('buffer:restored', (streamId, size) => {
      this.emit('buffer:persistent:restored', streamId, size);
    });

    this.bufferManager.on('buffer:health', (streamId, score, issues) => {
      this.emit('buffer:health:warning', streamId, score, issues);
    });

    this.bufferManager.on('buffer:error', (streamId, error) => {
      this.emit('telemetry:error', streamId, error);
    });

    // Monitor connection state for auto-persistence
    this.connectionStateListener = () => {
      if (this.baseClient.connectionState === 'disconnected' && this.config.buffering.enablePersistence) {
        this.persistAllBuffers().catch(console.error);
      }
    };
  }

  private createBufferConfig(
    streamId: string, 
    telemetryConfig: TelemetryStreamConfig, 
    priority: Priority,
    overrides?: Partial<BufferConfig>
  ): BufferConfig {
    // Calculate optimal window size based on sample rate
    let windowSizeMs = this.config.buffering.defaultWindowMs;
    if (telemetryConfig.sampleRate && this.config.buffering.autoOptimize) {
      // For high-frequency streams, use smaller windows
      if (telemetryConfig.sampleRate > 100) {
        windowSizeMs = Math.max(50, this.config.buffering.defaultWindowMs / 2);
      } else if (telemetryConfig.sampleRate < 10) {
        // For low-frequency streams, use larger windows
        windowSizeMs = Math.min(1000, this.config.buffering.defaultWindowMs * 2);
      }
    }

    // Determine overflow strategy based on priority and data type
    let overflowStrategy = this.config.buffering.defaultOverflowStrategy;
    if (priority === Priority.CRITICAL) {
      overflowStrategy = BufferOverflowStrategy.DROP_OLDEST; // Keep newest data for critical streams
    } else if (telemetryConfig.sampleRate && telemetryConfig.sampleRate > 50) {
      overflowStrategy = BufferOverflowStrategy.DOWNSAMPLE; // Downsample high-frequency streams
    }

    return {
      streamId,
      windowSizeMs,
      overflowStrategy,
      flushTriggers: [...this.config.buffering.defaultFlushTriggers],
      enablePersistence: this.config.buffering.enablePersistence,
      enableStatistics: this.config.buffering.enableStatistics,
      statisticsInterval: this.config.buffering.statisticsInterval,
      flushIntervalMs: windowSizeMs * 10, // Flush every 10 windows by default
      downsampleFactor: overflowStrategy === BufferOverflowStrategy.DOWNSAMPLE ? 2 : undefined,
      qualityThreshold: priority === Priority.HIGH ? 0.8 : 0.5,
      ...DEFAULT_BUFFER_CONFIG,
      ...overrides
    };
  }

  private analyzeBufferPerformance(
    streamId: string, 
    stats: BufferStatistics, 
    config: StreamBufferConfig
  ): BufferOptimizationRecommendation | null {
    // Skip if buffer is healthy
    if (stats.healthScore > 90 && stats.overflowEvents < 5) {
      return null;
    }

    const recommendations: Partial<BufferConfig> = {};
    let reason = '';
    let impact: 'low' | 'medium' | 'high' = 'low';
    let confidence = 0.5;

    // Analyze overflow events
    if (stats.overflowEvents > 20) {
      recommendations.windowSizeMs = Math.min(1000, config.windowSizeMs * 1.5);
      reason += 'Frequent overflows detected. ';
      impact = 'high';
      confidence += 0.3;
    }

    // Analyze utilization
    if (stats.utilizationPercent > 95) {
      recommendations.maxDataPoints = Math.floor((config.maxDataPoints || 1000) * 1.2);
      reason += 'High buffer utilization. ';
      impact = impact === 'high' ? 'high' : 'medium';
      confidence += 0.2;
    }

    // Analyze data rate vs buffer size
    if (stats.dataRate > 100 && config.windowSizeMs < 200) {
      recommendations.windowSizeMs = 200;
      recommendations.overflowStrategy = BufferOverflowStrategy.DOWNSAMPLE;
      recommendations.downsampleFactor = 2;
      reason += 'High data rate detected. ';
      impact = 'medium';
      confidence += 0.25;
    }

    // Analyze quality issues
    if (stats.averageDataQuality < 0.6 && config.overflowStrategy !== BufferOverflowStrategy.PRIORITY_BASED) {
      recommendations.overflowStrategy = BufferOverflowStrategy.PRIORITY_BASED;
      recommendations.qualityThreshold = 0.7;
      reason += 'Low data quality detected. ';
      impact = 'medium';
      confidence += 0.15;
    }

    if (Object.keys(recommendations).length === 0) {
      return null;
    }

    return {
      streamId,
      currentConfig: config,
      recommendedConfig: { ...config, ...recommendations },
      reason: reason.trim(),
      impact,
      confidence: Math.min(1, confidence)
    };
  }

  private async persistAllBuffers(): Promise<void> {
    const streamIds = Array.from(this.streamBufferConfigs.keys());
    const persistPromises = streamIds.map(async (streamId) => {
      try {
        const data = this.bufferManager.getData(streamId);
        if (data.length > 0) {
          await this.bufferManager.flushBuffer(streamId);
        }
      } catch (error) {
        console.error(`Failed to persist buffer for stream ${streamId}:`, error);
      }
    });

    await Promise.all(persistPromises);
  }

  private async restorePersistedBuffers(): Promise<void> {
    // Buffer restoration is handled internally by the buffer manager
    // when buffers are created with persistence enabled
  }

  private updateGlobalMetrics(): void {
    const allStats = this.bufferManager.getAllStatistics();
    let totalUtilization = 0;
    let streamCount = 0;
    let totalMemory = 0;

    for (const [streamId, stats] of allStats) {
      totalUtilization += stats.utilizationPercent;
      totalMemory += stats.memoryUsageBytes;
      streamCount++;
    }

    this.performanceMetrics.averageBufferUtilization = streamCount > 0 ? totalUtilization / streamCount : 0;
    this.performanceMetrics.memoryUsageMB = totalMemory / (1024 * 1024);

    // Check memory limit
    if (this.performanceMetrics.memoryUsageMB > this.config.buffering.memoryLimit) {
      this.emit('buffer:memory:limit', this.performanceMetrics.memoryUsageMB, this.config.buffering.memoryLimit);
    }
  }

  private startAutoOptimization(): void {
    this.optimizationInterval = setInterval(async () => {
      if (this.isDestroyed) return;

      try {
        const recommendations = this.getOptimizationRecommendations();
        if (recommendations.length > 0) {
          await this.applyOptimizations(recommendations);
        }
      } catch (error) {
        console.error('Auto-optimization failed:', error);
      }
    }, 30000); // Run every 30 seconds
  }
}

/**
 * Default configuration for buffered telemetry client
 */
export const DEFAULT_BUFFERED_TELEMETRY_CONFIG: BufferedTelemetryConfig = {
  // Base configuration
  url: 'ws://localhost:8000/ws',
  reconnect: true,
  reconnectAttempts: 10,
  reconnectDelay: 500,
  reconnectDelayMax: 5000,
  randomizationFactor: 0.2,
  timeout: 10000,
  heartbeatInterval: 15000,
  heartbeatTimeout: 30000,
  protocols: ['messagepack', 'cbor', 'json'],
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
  },

  // Advanced buffering configuration
  buffering: {
    enabled: true,
    defaultWindowMs: 100,
    defaultOverflowStrategy: BufferOverflowStrategy.ADAPTIVE,
    defaultFlushTriggers: [FlushTrigger.TIME_INTERVAL, FlushTrigger.BUFFER_FULL],
    enablePersistence: true,
    enableStatistics: true,
    statisticsInterval: 1000,
    autoOptimize: true,
    memoryLimit: 100 // 100MB limit
  }
};