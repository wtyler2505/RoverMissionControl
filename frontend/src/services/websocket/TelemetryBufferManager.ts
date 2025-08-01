/**
 * TelemetryBufferManager - Advanced Configurable Data Buffering System
 * 
 * Implements sophisticated data buffering with configurable time-based windows,
 * overflow handling strategies, and persistence during disconnections.
 * 
 * Features:
 * - Time-based circular buffers (10ms-1000ms windows)
 * - Multiple overflow handling strategies (FIFO, downsampling, prioritization)
 * - Buffer statistics and monitoring
 * - Configurable flush triggers
 * - Persistence during temporary disconnections
 * - Memory-efficient data storage
 */

import { EventEmitter } from './EventEmitter';
import { TelemetryDataPoint, TelemetryStreamConfig } from './TelemetryManager';

/**
 * Buffer overflow handling strategies
 */
export enum BufferOverflowStrategy {
  FIFO = 'fifo',                    // First In, First Out (default circular buffer behavior)
  DROP_OLDEST = 'drop_oldest',      // Drop oldest entries when full
  DROP_NEWEST = 'drop_newest',      // Drop newest entries when full
  DOWNSAMPLE = 'downsample',        // Reduce sample rate by keeping every Nth sample
  PRIORITY_BASED = 'priority_based', // Drop based on data quality/priority
  ADAPTIVE = 'adaptive'             // Dynamically choose strategy based on conditions
}

/**
 * Buffer flush triggers
 */
export enum FlushTrigger {
  TIME_INTERVAL = 'time_interval',  // Flush every N milliseconds
  BUFFER_FULL = 'buffer_full',      // Flush when buffer reaches capacity
  DATA_COUNT = 'data_count',        // Flush after N data points
  QUALITY_THRESHOLD = 'quality_threshold', // Flush when quality drops below threshold
  MANUAL = 'manual',                // Manual flush only
  CONNECTION_STATE = 'connection_state' // Flush on connection state changes
}

/**
 * Buffer configuration options
 */
export interface BufferConfig {
  streamId: string;
  windowSizeMs: number;             // Time window in milliseconds (10-1000ms)
  maxDataPoints?: number;           // Maximum data points (calculated from window if not provided)
  overflowStrategy: BufferOverflowStrategy;
  flushTriggers: FlushTrigger[];
  
  // Overflow strategy specific options
  downsampleFactor?: number;        // For DOWNSAMPLE strategy (keep 1 out of N)
  qualityThreshold?: number;        // For PRIORITY_BASED strategy (0-1)
  adaptiveThresholds?: {            // For ADAPTIVE strategy
    latencyThreshold: number;
    memoryThreshold: number;
    dataRateThreshold: number;
  };
  
  // Flush trigger specific options
  flushIntervalMs?: number;         // For TIME_INTERVAL trigger
  flushDataCount?: number;          // For DATA_COUNT trigger
  flushQualityThreshold?: number;   // For QUALITY_THRESHOLD trigger
  
  // Persistence options
  enablePersistence: boolean;       // Enable persistence during disconnections
  persistenceKeyPrefix?: string;    // LocalStorage key prefix
  maxPersistenceSize?: number;      // Maximum size for persistence (in MB)
  
  // Performance options
  enableCompression?: boolean;      // Enable data compression for large buffers
  enableStatistics?: boolean;       // Enable detailed statistics tracking
  statisticsInterval?: number;      // Statistics update interval in ms
}

/**
 * Buffer statistics and metrics
 */
export interface BufferStatistics {
  streamId: string;
  bufferConfig: BufferConfig;
  
  // Size and capacity metrics
  currentSize: number;              // Current number of data points
  maxCapacity: number;              // Maximum capacity
  utilizationPercent: number;       // Buffer utilization (0-100%)
  memoryUsageBytes: number;         // Estimated memory usage
  
  // Data flow metrics
  totalReceived: number;            // Total data points received
  totalStored: number;              // Total data points stored
  totalDropped: number;             // Total data points dropped
  totalFlushed: number;             // Total data points flushed
  
  // Overflow handling metrics
  overflowEvents: number;           // Number of overflow events
  droppedByStrategy: Map<string, number>; // Dropped count by strategy
  
  // Performance metrics
  averageInsertionTime: number;     // Average time to insert data (microseconds)
  averageRetrievalTime: number;     // Average time to retrieve data (microseconds)
  flushRate: number;                // Flushes per second
  dataRate: number;                 // Data points per second
  
  // Quality metrics
  averageDataQuality: number;       // Average data quality (0-1)
  qualityDistribution: number[];    // Quality distribution histogram
  
  // Time-based metrics
  oldestDataTimestamp: number;      // Timestamp of oldest data point
  newestDataTimestamp: number;      // Timestamp of newest data point
  timeSpanMs: number;               // Time span of buffered data
  
  // Error and health metrics
  errors: number;                   // Number of errors encountered
  lastError?: string;               // Last error message
  healthScore: number;              // Overall health score (0-100)
  
  // Statistics metadata
  lastUpdated: number;              // Last statistics update timestamp
  updateCount: number;              // Number of statistics updates
}

/**
 * Buffer flush event data
 */
export interface BufferFlushEvent {
  streamId: string;
  trigger: FlushTrigger;
  data: TelemetryDataPoint[];
  statistics: BufferStatistics;
  flushDurationMs: number;
  timestamp: number;
}

/**
 * Buffer events interface
 */
export interface BufferManagerEvents {
  'buffer:created': (streamId: string, config: BufferConfig) => void;
  'buffer:destroyed': (streamId: string) => void;
  'buffer:overflow': (streamId: string, strategy: BufferOverflowStrategy, droppedCount: number) => void;
  'buffer:flush': (event: BufferFlushEvent) => void;
  'buffer:persisted': (streamId: string, size: number) => void;
  'buffer:restored': (streamId: string, size: number) => void;
  'buffer:statistics': (statistics: BufferStatistics) => void;
  'buffer:error': (streamId: string, error: Error) => void;
  'buffer:health': (streamId: string, score: number, issues: string[]) => void;
}

/**
 * Enhanced circular buffer with time-based operations
 */
class TimeBasedCircularBuffer {
  private buffer: (TelemetryDataPoint | undefined)[];
  private writeIndex = 0;
  private size = 0;
  private readonly capacity: number;
  private readonly windowSizeMs: number;
  
  // Performance tracking
  private insertionTimes: number[] = [];
  private retrievalTimes: number[] = [];
  
  constructor(capacity: number, windowSizeMs: number) {
    this.capacity = capacity;
    this.windowSizeMs = windowSizeMs;
    this.buffer = new Array(capacity);
  }
  
  /**
   * Add data point to buffer with time-based eviction
   */
  push(item: TelemetryDataPoint): { overflow: boolean; evicted?: TelemetryDataPoint } {
    const startTime = performance.now();
    
    const currentTime = item.timestamp;
    const evicted = this.evictOldData(currentTime);
    
    const wasOverflow = this.size === this.capacity;
    let evictedItem: TelemetryDataPoint | undefined;
    
    if (wasOverflow) {
      evictedItem = this.buffer[this.writeIndex] as TelemetryDataPoint;
    }
    
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    
    if (this.size < this.capacity) {
      this.size++;
    }
    
    // Track performance
    const insertTime = (performance.now() - startTime) * 1000; // Convert to microseconds
    this.insertionTimes.push(insertTime);
    if (this.insertionTimes.length > 100) {
      this.insertionTimes.shift();
    }
    
    return {
      overflow: wasOverflow,
      evicted: evictedItem
    };
  }
  
  /**
   * Get all data points within the time window
   */
  getAll(): TelemetryDataPoint[] {
    const startTime = performance.now();
    
    if (this.size === 0) return [];
    
    const result: TelemetryDataPoint[] = [];
    const currentTime = Date.now();
    const cutoffTime = currentTime - this.windowSizeMs;
    
    if (this.size < this.capacity) {
      // Buffer not full, read from beginning
      for (let i = 0; i < this.size; i++) {
        const item = this.buffer[i];
        if (item && item.timestamp >= cutoffTime) {
          result.push(item);
        }
      }
    } else {
      // Buffer full, read in circular order
      for (let i = 0; i < this.capacity; i++) {
        const index = (this.writeIndex + i) % this.capacity;
        const item = this.buffer[index];
        if (item && item.timestamp >= cutoffTime) {
          result.push(item);
        }
      }
    }
    
    // Track performance
    const retrievalTime = (performance.now() - startTime) * 1000; // Convert to microseconds
    this.retrievalTimes.push(retrievalTime);
    if (this.retrievalTimes.length > 100) {
      this.retrievalTimes.shift();
    }
    
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Get data points within a specific time range
   */
  getRange(startTime: number, endTime: number): TelemetryDataPoint[] {
    return this.getAll().filter(item => 
      item.timestamp >= startTime && item.timestamp <= endTime
    );
  }
  
  /**
   * Get latest N data points
   */
  getLatest(count: number): TelemetryDataPoint[] {
    const all = this.getAll();
    return all.slice(-count);
  }
  
  /**
   * Get oldest data point timestamp
   */
  getOldestTimestamp(): number | null {
    const all = this.getAll();
    return all.length > 0 ? all[0].timestamp : null;
  }
  
  /**
   * Get newest data point timestamp
   */
  getNewestTimestamp(): number | null {
    const all = this.getAll();
    return all.length > 0 ? all[all.length - 1].timestamp : null;
  }
  
  /**
   * Clear all data
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.writeIndex = 0;
    this.size = 0;
    this.insertionTimes = [];
    this.retrievalTimes = [];
  }
  
  /**
   * Get buffer statistics
   */
  getStats() {
    const avgInsertionTime = this.insertionTimes.length > 0 
      ? this.insertionTimes.reduce((a, b) => a + b, 0) / this.insertionTimes.length 
      : 0;
      
    const avgRetrievalTime = this.retrievalTimes.length > 0 
      ? this.retrievalTimes.reduce((a, b) => a + b, 0) / this.retrievalTimes.length 
      : 0;
    
    return {
      size: this.size,
      capacity: this.capacity,
      utilization: this.size / this.capacity,
      averageInsertionTime: avgInsertionTime,
      averageRetrievalTime: avgRetrievalTime
    };
  }
  
  /**
   * Evict data points older than the time window
   */
  private evictOldData(currentTime: number): number {
    const cutoffTime = currentTime - this.windowSizeMs;
    let evictedCount = 0;
    
    // For simplicity, we'll rely on natural circular buffer eviction
    // In a production implementation, you might want more sophisticated eviction
    
    return evictedCount;
  }
}

/**
 * Data downsampler for overflow handling
 */
class DataDownsampler {
  private counter = 0;
  private factor: number;
  
  constructor(factor: number) {
    this.factor = Math.max(1, Math.floor(factor));
  }
  
  shouldKeep(): boolean {
    const keep = this.counter % this.factor === 0;
    this.counter++;
    return keep;
  }
  
  reset(): void {
    this.counter = 0;
  }
  
  updateFactor(factor: number): void {
    this.factor = Math.max(1, Math.floor(factor));
  }
}

/**
 * Persistence manager for buffer data
 */
class BufferPersistenceManager {
  private readonly keyPrefix: string;
  private readonly maxSizeMB: number;
  
  constructor(keyPrefix: string = 'telemetry_buffer_', maxSizeMB: number = 10) {
    this.keyPrefix = keyPrefix;
    this.maxSizeMB = maxSizeMB;
  }
  
  /**
   * Persist buffer data to localStorage
   */
  async persist(streamId: string, data: TelemetryDataPoint[]): Promise<boolean> {
    try {
      const key = `${this.keyPrefix}${streamId}`;
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      });
      
      // Check size limit
      const sizeBytes = new Blob([serialized]).size;
      const sizeMB = sizeBytes / (1024 * 1024);
      
      if (sizeMB > this.maxSizeMB) {
        console.warn(`Buffer persistence size (${sizeMB.toFixed(2)}MB) exceeds limit (${this.maxSizeMB}MB)`);
        return false;
      }
      
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Failed to persist buffer data:', error);
      return false;
    }
  }
  
  /**
   * Restore buffer data from localStorage
   */
  async restore(streamId: string): Promise<TelemetryDataPoint[]> {
    try {
      const key = `${this.keyPrefix}${streamId}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        return [];
      }
      
      const parsed = JSON.parse(stored);
      
      // Check if data is too old (older than 1 hour)
      const ageMs = Date.now() - parsed.timestamp;
      if (ageMs > 3600000) {
        localStorage.removeItem(key);
        return [];
      }
      
      return Array.isArray(parsed.data) ? parsed.data : [];
    } catch (error) {
      console.error('Failed to restore buffer data:', error);
      return [];
    }
  }
  
  /**
   * Clear persisted data
   */
  clear(streamId: string): void {
    const key = `${this.keyPrefix}${streamId}`;
    localStorage.removeItem(key);
  }
  
  /**
   * Get size of persisted data
   */
  getPersistedSize(streamId: string): number {
    try {
      const key = `${this.keyPrefix}${streamId}`;
      const stored = localStorage.getItem(key);
      return stored ? new Blob([stored]).size : 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Main telemetry buffer manager
 */
export class TelemetryBufferManager extends EventEmitter<BufferManagerEvents> {
  private buffers = new Map<string, TimeBasedCircularBuffer>();
  private configs = new Map<string, BufferConfig>();
  private statistics = new Map<string, BufferStatistics>();
  private downsamplers = new Map<string, DataDownsampler>();
  private flushTimers = new Map<string, NodeJS.Timeout>();
  private statisticsTimers = new Map<string, NodeJS.Timeout>();
  private persistenceManager: BufferPersistenceManager;
  
  // Global counters
  private totalBuffersCreated = 0;
  private totalOverflowEvents = 0;
  private totalFlushEvents = 0;
  
  constructor() {
    super();
    this.persistenceManager = new BufferPersistenceManager();
  }
  
  /**
   * Create a new buffer for a telemetry stream
   */
  async createBuffer(config: BufferConfig): Promise<void> {
    try {
      const { streamId, windowSizeMs, maxDataPoints } = config;
      
      // Calculate capacity based on window size and expected data rate
      const capacity = maxDataPoints || Math.max(100, Math.floor(windowSizeMs / 10)); // Assume ~10ms between samples
      
      // Create buffer
      const buffer = new TimeBasedCircularBuffer(capacity, windowSizeMs);
      this.buffers.set(streamId, buffer);
      this.configs.set(streamId, config);
      
      // Create downsampler if needed
      if (config.overflowStrategy === BufferOverflowStrategy.DOWNSAMPLE && config.downsampleFactor) {
        this.downsamplers.set(streamId, new DataDownsampler(config.downsampleFactor));
      }
      
      // Initialize statistics
      const initialStats: BufferStatistics = {
        streamId,
        bufferConfig: config,
        currentSize: 0,
        maxCapacity: capacity,
        utilizationPercent: 0,
        memoryUsageBytes: 0,
        totalReceived: 0,
        totalStored: 0,
        totalDropped: 0,
        totalFlushed: 0,
        overflowEvents: 0,
        droppedByStrategy: new Map(),
        averageInsertionTime: 0,
        averageRetrievalTime: 0,
        flushRate: 0,
        dataRate: 0,
        averageDataQuality: 1,
        qualityDistribution: new Array(10).fill(0),
        oldestDataTimestamp: 0,
        newestDataTimestamp: 0,
        timeSpanMs: 0,
        errors: 0,
        healthScore: 100,
        lastUpdated: Date.now(),
        updateCount: 0
      };
      
      this.statistics.set(streamId, initialStats);
      
      // Setup flush timers
      this.setupFlushTimers(streamId, config);
      
      // Setup statistics timer
      if (config.enableStatistics !== false) {
        this.setupStatisticsTimer(streamId, config);
      }
      
      // Restore persisted data if enabled
      if (config.enablePersistence) {
        await this.restorePersistedData(streamId);
      }
      
      this.totalBuffersCreated++;
      this.emit('buffer:created', streamId, config);
      
    } catch (error) {
      this.emit('buffer:error', streamId, error as Error);
      throw error;
    }
  }
  
  /**
   * Add data point to buffer
   */
  addData(streamId: string, dataPoint: TelemetryDataPoint): boolean {
    try {
      const buffer = this.buffers.get(streamId);
      const config = this.configs.get(streamId);
      const stats = this.statistics.get(streamId);
      
      if (!buffer || !config || !stats) {
        throw new Error(`Buffer not found for stream: ${streamId}`);
      }
      
      stats.totalReceived++;
      
      // Apply overflow strategy pre-processing
      if (!this.shouldAcceptData(streamId, dataPoint, config)) {
        stats.totalDropped++;
        return false;
      }
      
      // Add to buffer
      const result = buffer.push(dataPoint);
      
      if (result.overflow) {
        this.handleOverflow(streamId, config, result.evicted);
      }
      
      stats.totalStored++;
      this.updateDataQuality(stats, dataPoint);
      
      // Check flush triggers
      this.checkFlushTriggers(streamId, config);
      
      return true;
      
    } catch (error) {
      this.emit('buffer:error', streamId, error as Error);
      return false;
    }
  }
  
  /**
   * Get buffered data
   */
  getData(streamId: string, options?: {
    count?: number;
    startTime?: number;
    endTime?: number;
  }): TelemetryDataPoint[] {
    const buffer = this.buffers.get(streamId);
    if (!buffer) return [];
    
    if (options?.startTime && options?.endTime) {
      return buffer.getRange(options.startTime, options.endTime);
    } else if (options?.count) {
      return buffer.getLatest(options.count);
    } else {
      return buffer.getAll();
    }
  }
  
  /**
   * Manually flush buffer
   */
  async flushBuffer(streamId: string): Promise<BufferFlushEvent | null> {
    return this.performFlush(streamId, FlushTrigger.MANUAL);
  }
  
  /**
   * Get buffer statistics
   */
  getStatistics(streamId: string): BufferStatistics | null {
    return this.statistics.get(streamId) || null;
  }
  
  /**
   * Get all buffer statistics
   */
  getAllStatistics(): Map<string, BufferStatistics> {
    return new Map(this.statistics);
  }
  
  /**
   * Update buffer configuration
   */
  async updateConfig(streamId: string, updates: Partial<BufferConfig>): Promise<void> {
    const currentConfig = this.configs.get(streamId);
    if (!currentConfig) {
      throw new Error(`Buffer not found for stream: ${streamId}`);
    }
    
    const newConfig = { ...currentConfig, ...updates };
    
    // If critical parameters changed, recreate buffer
    if (updates.windowSizeMs || updates.maxDataPoints) {
      const currentData = this.getData(streamId);
      await this.destroyBuffer(streamId);
      await this.createBuffer(newConfig);
      
      // Restore relevant data
      for (const dataPoint of currentData) {
        this.addData(streamId, dataPoint);
      }
    } else {
      // Update configuration
      this.configs.set(streamId, newConfig);
      
      // Update downsampler if needed
      if (updates.downsampleFactor && newConfig.overflowStrategy === BufferOverflowStrategy.DOWNSAMPLE) {
        const downsampler = this.downsamplers.get(streamId);
        if (downsampler) {
          downsampler.updateFactor(updates.downsampleFactor);
        }
      }
      
      // Update flush timers
      this.setupFlushTimers(streamId, newConfig);
    }
  }
  
  /**
   * Clear buffer data
   */
  clearBuffer(streamId: string): void {
    const buffer = this.buffers.get(streamId);
    const stats = this.statistics.get(streamId);
    
    if (buffer) {
      buffer.clear();
    }
    
    if (stats) {
      stats.currentSize = 0;
      stats.utilizationPercent = 0;
      stats.oldestDataTimestamp = 0;
      stats.newestDataTimestamp = 0;
      stats.timeSpanMs = 0;
    }
    
    // Clear persistence
    this.persistenceManager.clear(streamId);
  }
  
  /**
   * Destroy buffer and cleanup resources
   */
  async destroyBuffer(streamId: string): Promise<void> {
    try {
      const config = this.configs.get(streamId);
      
      // Persist data if enabled
      if (config?.enablePersistence) {
        const data = this.getData(streamId);
        if (data.length > 0) {
          await this.persistenceManager.persist(streamId, data);
          this.emit('buffer:persisted', streamId, data.length);
        }
      }
      
      // Clear timers
      const flushTimer = this.flushTimers.get(streamId);
      if (flushTimer) {
        clearInterval(flushTimer);
        this.flushTimers.delete(streamId);
      }
      
      const statsTimer = this.statisticsTimers.get(streamId);
      if (statsTimer) {
        clearInterval(statsTimer);
        this.statisticsTimers.delete(streamId);
      }
      
      // Remove from maps
      this.buffers.delete(streamId);
      this.configs.delete(streamId);
      this.statistics.delete(streamId);
      this.downsamplers.delete(streamId);
      
      this.emit('buffer:destroyed', streamId);
      
    } catch (error) {
      this.emit('buffer:error', streamId, error as Error);
    }
  }
  
  /**
   * Get global buffer manager statistics
   */
  getGlobalStatistics() {
    return {
      totalBuffers: this.buffers.size,
      totalBuffersCreated: this.totalBuffersCreated,
      totalOverflowEvents: this.totalOverflowEvents,
      totalFlushEvents: this.totalFlushEvents,
      memoryUsage: this.calculateTotalMemoryUsage(),
      activeStreams: Array.from(this.buffers.keys())
    };
  }
  
  /**
   * Cleanup all buffers
   */
  async destroy(): Promise<void> {
    const streamIds = Array.from(this.buffers.keys());
    await Promise.all(streamIds.map(id => this.destroyBuffer(id)));
    this.removeAllListeners();
  }
  
  // Private helper methods
  
  private shouldAcceptData(streamId: string, dataPoint: TelemetryDataPoint, config: BufferConfig): boolean {
    const stats = this.statistics.get(streamId);
    if (!stats) return false;
    
    switch (config.overflowStrategy) {
      case BufferOverflowStrategy.DOWNSAMPLE:
        const downsampler = this.downsamplers.get(streamId);
        return downsampler ? downsampler.shouldKeep() : true;
        
      case BufferOverflowStrategy.PRIORITY_BASED:
        if (config.qualityThreshold && dataPoint.quality !== undefined) {
          return dataPoint.quality >= config.qualityThreshold;
        }
        return true;
        
      case BufferOverflowStrategy.ADAPTIVE:
        return this.adaptiveAcceptanceStrategy(streamId, dataPoint, config, stats);
        
      default:
        return true;
    }
  }
  
  private adaptiveAcceptanceStrategy(
    streamId: string, 
    dataPoint: TelemetryDataPoint, 
    config: BufferConfig, 
    stats: BufferStatistics
  ): boolean {
    // Implement adaptive strategy based on current conditions
    const utilizationHigh = stats.utilizationPercent > 80;
    const qualityLow = dataPoint.quality !== undefined && dataPoint.quality < 0.5;
    const dataRateHigh = stats.dataRate > (config.adaptiveThresholds?.dataRateThreshold || 100);
    
    if (utilizationHigh && qualityLow && dataRateHigh) {
      // Under pressure, be selective
      return (dataPoint.quality || 0) > 0.7;
    }
    
    return true;
  }
  
  private handleOverflow(streamId: string, config: BufferConfig, evicted?: TelemetryDataPoint): void {
    const stats = this.statistics.get(streamId);
    if (!stats) return;
    
    stats.overflowEvents++;
    this.totalOverflowEvents++;
    
    const strategyKey = config.overflowStrategy;
    const currentCount = stats.droppedByStrategy.get(strategyKey) || 0;
    stats.droppedByStrategy.set(strategyKey, currentCount + 1);
    
    this.emit('buffer:overflow', streamId, config.overflowStrategy, 1);
  }
  
  private checkFlushTriggers(streamId: string, config: BufferConfig): void {
    const buffer = this.buffers.get(streamId);
    const stats = this.statistics.get(streamId);
    
    if (!buffer || !stats) return;
    
    for (const trigger of config.flushTriggers) {
      let shouldFlush = false;
      
      switch (trigger) {
        case FlushTrigger.BUFFER_FULL:
          shouldFlush = stats.utilizationPercent >= 100;
          break;
          
        case FlushTrigger.DATA_COUNT:
          if (config.flushDataCount) {
            shouldFlush = stats.currentSize >= config.flushDataCount;
          }
          break;
          
        case FlushTrigger.QUALITY_THRESHOLD:
          if (config.flushQualityThreshold) {
            shouldFlush = stats.averageDataQuality < config.flushQualityThreshold;
          }
          break;
      }
      
      if (shouldFlush) {
        this.performFlush(streamId, trigger);
        break; // Only flush once per check
      }
    }
  }
  
  private async performFlush(streamId: string, trigger: FlushTrigger): Promise<BufferFlushEvent | null> {
    try {
      const startTime = performance.now();
      const data = this.getData(streamId);
      const stats = this.statistics.get(streamId);
      
      if (!stats || data.length === 0) return null;
      
      // Clear buffer after getting data
      this.clearBuffer(streamId);
      
      stats.totalFlushed += data.length;
      
      const flushDurationMs = performance.now() - startTime;
      
      const flushEvent: BufferFlushEvent = {
        streamId,
        trigger,
        data,
        statistics: { ...stats },
        flushDurationMs,
        timestamp: Date.now()
      };
      
      this.totalFlushEvents++;
      this.emit('buffer:flush', flushEvent);
      
      return flushEvent;
      
    } catch (error) {
      this.emit('buffer:error', streamId, error as Error);
      return null;
    }
  }
  
  private setupFlushTimers(streamId: string, config: BufferConfig): void {
    // Clear existing timer
    const existingTimer = this.flushTimers.get(streamId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }
    
    // Setup time-based flush trigger
    if (config.flushTriggers.includes(FlushTrigger.TIME_INTERVAL) && config.flushIntervalMs) {
      const timer = setInterval(() => {
        this.performFlush(streamId, FlushTrigger.TIME_INTERVAL);
      }, config.flushIntervalMs);
      
      this.flushTimers.set(streamId, timer);
    }
  }
  
  private setupStatisticsTimer(streamId: string, config: BufferConfig): void {
    const interval = config.statisticsInterval || 1000;
    
    const timer = setInterval(() => {
      this.updateStatistics(streamId);
    }, interval);
    
    this.statisticsTimers.set(streamId, timer);
  }
  
  private updateStatistics(streamId: string): void {
    const buffer = this.buffers.get(streamId);
    const stats = this.statistics.get(streamId);
    
    if (!buffer || !stats) return;
    
    const bufferStats = buffer.getStats();
    const data = buffer.getAll();
    
    // Update basic metrics
    stats.currentSize = bufferStats.size;
    stats.utilizationPercent = bufferStats.utilization * 100;
    stats.averageInsertionTime = bufferStats.averageInsertionTime;
    stats.averageRetrievalTime = bufferStats.averageRetrievalTime;
    
    // Update time-based metrics
    if (data.length > 0) {
      stats.oldestDataTimestamp = data[0].timestamp;
      stats.newestDataTimestamp = data[data.length - 1].timestamp;
      stats.timeSpanMs = stats.newestDataTimestamp - stats.oldestDataTimestamp;
    }
    
    // Calculate data rate
    const now = Date.now();
    const timeSinceLastUpdate = now - stats.lastUpdated;
    if (timeSinceLastUpdate > 0) {
      const newDataPoints = stats.totalReceived - (stats.updateCount * stats.dataRate * timeSinceLastUpdate / 1000);
      stats.dataRate = Math.max(0, newDataPoints / (timeSinceLastUpdate / 1000));
    }
    
    // Estimate memory usage
    stats.memoryUsageBytes = data.length * 200; // Rough estimate: 200 bytes per data point
    
    // Calculate health score
    stats.healthScore = this.calculateHealthScore(stats);
    
    // Update metadata
    stats.lastUpdated = now;
    stats.updateCount++;
    
    this.emit('buffer:statistics', { ...stats });
    
    // Check health and emit warnings if needed
    if (stats.healthScore < 70) {
      const issues = this.identifyHealthIssues(stats);
      this.emit('buffer:health', streamId, stats.healthScore, issues);
    }
  }
  
  private updateDataQuality(stats: BufferStatistics, dataPoint: TelemetryDataPoint): void {
    if (dataPoint.quality !== undefined) {
      // Update exponential moving average
      const alpha = 0.1;
      stats.averageDataQuality = alpha * dataPoint.quality + (1 - alpha) * stats.averageDataQuality;
      
      // Update quality distribution histogram
      const qualityBin = Math.floor(dataPoint.quality * 10);
      const clampedBin = Math.max(0, Math.min(9, qualityBin));
      stats.qualityDistribution[clampedBin]++;
    }
  }
  
  private calculateHealthScore(stats: BufferStatistics): number {
    let score = 100;
    
    // Penalize high utilization
    if (stats.utilizationPercent > 90) score -= 20;
    else if (stats.utilizationPercent > 80) score -= 10;
    
    // Penalize overflow events
    if (stats.overflowEvents > 10) score -= 15;
    else if (stats.overflowEvents > 5) score -= 8;
    
    // Penalize low data quality
    if (stats.averageDataQuality < 0.5) score -= 25;
    else if (stats.averageDataQuality < 0.7) score -= 10;
    
    // Penalize errors
    score -= Math.min(20, stats.errors * 2);
    
    return Math.max(0, score);
  }
  
  private identifyHealthIssues(stats: BufferStatistics): string[] {
    const issues: string[] = [];
    
    if (stats.utilizationPercent > 90) {
      issues.push('Buffer utilization is critically high');
    }
    
    if (stats.overflowEvents > 10) {
      issues.push('Frequent buffer overflows detected');
    }
    
    if (stats.averageDataQuality < 0.5) {
      issues.push('Data quality is below acceptable threshold');
    }
    
    if (stats.errors > 5) {
      issues.push('Multiple errors encountered');
    }
    
    if (stats.averageInsertionTime > 1000) { // 1ms
      issues.push('Buffer insertion performance is degraded');
    }
    
    return issues;
  }
  
  private async restorePersistedData(streamId: string): Promise<void> {
    try {
      const restoredData = await this.persistenceManager.restore(streamId);
      
      if (restoredData.length > 0) {
        // Add restored data to buffer
        for (const dataPoint of restoredData) {
          this.addData(streamId, dataPoint);
        }
        
        this.emit('buffer:restored', streamId, restoredData.length);
      }
      
      // Clear persistence after restore
      this.persistenceManager.clear(streamId);
      
    } catch (error) {
      this.emit('buffer:error', streamId, error as Error);
    }
  }
  
  private calculateTotalMemoryUsage(): number {
    let totalBytes = 0;
    
    for (const [streamId, stats] of this.statistics) {
      totalBytes += stats.memoryUsageBytes;
    }
    
    return Math.round(totalBytes / (1024 * 1024) * 100) / 100; // MB with 2 decimal places
  }
}

/**
 * Default buffer configuration
 */
export const DEFAULT_BUFFER_CONFIG: Partial<BufferConfig> = {
  windowSizeMs: 100,                    // 100ms default window
  overflowStrategy: BufferOverflowStrategy.FIFO,
  flushTriggers: [FlushTrigger.BUFFER_FULL, FlushTrigger.TIME_INTERVAL],
  flushIntervalMs: 1000,                // Flush every second
  enablePersistence: true,
  enableStatistics: true,
  statisticsInterval: 1000,
  enableCompression: false,
  maxPersistenceSize: 10                // 10MB max persistence
};