/**
 * TelemetryManager - Advanced Telemetry Stream Management
 * Handles telemetry data streams with circular buffers, data decimation,
 * and efficient subscription lifecycle management
 */

import { EventEmitter } from './EventEmitter';
import { WebSocketClient } from './WebSocketClient';
import {
  MessageType,
  Priority,
  WebSocketMessage,
  SubscriptionConfig,
  Protocol
} from './types';

/**
 * Supported telemetry data types
 */
export enum TelemetryDataType {
  NUMERIC = 'numeric',
  VECTOR = 'vector',      // Array of numbers
  MATRIX = 'matrix',      // 2D array of numbers
  STRING = 'string',
  BOOLEAN = 'boolean',
  OBJECT = 'object'       // Generic object data
}

/**
 * Telemetry stream configuration
 */
export interface TelemetryStreamConfig {
  streamId: string;
  name: string;
  dataType: TelemetryDataType;
  bufferSize: number;         // Maximum data points to retain
  decimationFactor?: number;  // Keep 1 out of N data points
  sampleRate?: number;        // Expected samples per second
  units?: string;
  minValue?: number;
  maxValue?: number;
  dimensions?: {              // For vector/matrix types
    rows?: number;
    cols?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Individual telemetry data point
 */
export interface TelemetryDataPoint {
  timestamp: number;
  value: any;
  quality?: number;     // 0-1 quality indicator
  metadata?: Record<string, any>;
}

/**
 * Telemetry stream statistics
 */
export interface TelemetryStreamStats {
  streamId: string;
  totalReceived: number;
  totalStored: number;
  droppedPoints: number;
  averageRate: number;    // Points per second
  lastUpdate: number;
  bufferUtilization: number; // 0-1 percentage
  dataQuality: number;    // 0-1 average quality
}

/**
 * Stream subscription state
 */
export interface StreamSubscription {
  streamId: string;
  subscriptionId: string;
  config: TelemetryStreamConfig;
  active: boolean;
  paused: boolean;
  createdAt: number;
  lastActivity: number;
}

/**
 * Telemetry update event
 */
export interface TelemetryUpdateEvent {
  streamId: string;
  data: TelemetryDataPoint;
  stats: TelemetryStreamStats;
}

/**
 * Telemetry manager events
 */
export interface TelemetryManagerEvents {
  'stream:subscribed': (subscription: StreamSubscription) => void;
  'stream:unsubscribed': (streamId: string) => void;
  'stream:paused': (streamId: string) => void;
  'stream:resumed': (streamId: string) => void;
  'stream:data': (event: TelemetryUpdateEvent) => void;
  'stream:error': (streamId: string, error: Error) => void;
  'buffer:overflow': (streamId: string, droppedCount: number) => void;
  'stats:update': (stats: TelemetryStreamStats) => void;
}

/**
 * Circular buffer implementation for efficient data storage
 */
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private writeIndex = 0;
  private size = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): boolean {
    const wasOverflow = this.size === this.capacity;
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
    return wasOverflow;
  }

  getAll(): T[] {
    if (this.size === 0) return [];
    
    const result: T[] = [];
    if (this.size < this.capacity) {
      // Buffer not full, read from beginning
      for (let i = 0; i < this.size; i++) {
        result.push(this.buffer[i] as T);
      }
    } else {
      // Buffer full, read in circular order
      for (let i = 0; i < this.capacity; i++) {
        const index = (this.writeIndex + i) % this.capacity;
        result.push(this.buffer[index] as T);
      }
    }
    return result;
  }

  getLatest(count: number): T[] {
    if (this.size === 0) return [];
    
    const actualCount = Math.min(count, this.size);
    const result: T[] = [];
    
    for (let i = actualCount - 1; i >= 0; i--) {
      const index = (this.writeIndex - 1 - i + this.capacity) % this.capacity;
      result.push(this.buffer[index] as T);
    }
    
    return result;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.writeIndex = 0;
    this.size = 0;
  }

  getSize(): number {
    return this.size;
  }

  getCapacity(): number {
    return this.capacity;
  }

  getUtilization(): number {
    return this.size / this.capacity;
  }
}

/**
 * Data decimator for reducing high-frequency data
 */
class DataDecimator {
  private counter = 0;
  private readonly factor: number;

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
}

/**
 * Stream data processor handles individual telemetry streams
 */
class StreamDataProcessor {
  private buffer: CircularBuffer<TelemetryDataPoint>;
  private decimator?: DataDecimator;
  private stats: TelemetryStreamStats;
  private rateCalculator: {
    timestamps: number[];
    windowSize: number;
  };

  constructor(
    private config: TelemetryStreamConfig,
    private onUpdate: (event: TelemetryUpdateEvent) => void,
    private onOverflow: (droppedCount: number) => void
  ) {
    this.buffer = new CircularBuffer(config.bufferSize);
    
    if (config.decimationFactor && config.decimationFactor > 1) {
      this.decimator = new DataDecimator(config.decimationFactor);
    }

    this.stats = {
      streamId: config.streamId,
      totalReceived: 0,
      totalStored: 0,
      droppedPoints: 0,
      averageRate: 0,
      lastUpdate: Date.now(),
      bufferUtilization: 0,
      dataQuality: 1
    };

    this.rateCalculator = {
      timestamps: [],
      windowSize: 100 // Calculate rate over last 100 samples
    };
  }

  addDataPoint(data: TelemetryDataPoint): void {
    this.stats.totalReceived++;
    this.stats.lastUpdate = Date.now();

    // Update rate calculation
    this.updateRate(data.timestamp);

    // Apply decimation if configured
    if (this.decimator && !this.decimator.shouldKeep()) {
      this.stats.droppedPoints++;
      return;
    }

    // Validate data based on type and constraints
    if (!this.validateData(data)) {
      this.stats.droppedPoints++;
      return;
    }

    // Add to buffer
    const overflow = this.buffer.push(data);
    if (overflow) {
      this.stats.droppedPoints++;
      this.onOverflow(1);
    }

    this.stats.totalStored++;
    this.stats.bufferUtilization = this.buffer.getUtilization();

    // Update quality metric
    this.updateQuality(data);

    // Emit update event
    this.onUpdate({
      streamId: this.config.streamId,
      data,
      stats: { ...this.stats }
    });
  }

  getData(count?: number): TelemetryDataPoint[] {
    return count ? this.buffer.getLatest(count) : this.buffer.getAll();
  }

  getStats(): TelemetryStreamStats {
    return { ...this.stats };
  }

  clear(): void {
    this.buffer.clear();
    this.decimator?.reset();
    this.stats.totalStored = 0;
    this.stats.bufferUtilization = 0;
    this.rateCalculator.timestamps = [];
  }

  private validateData(data: TelemetryDataPoint): boolean {
    const { dataType, minValue, maxValue, dimensions } = this.config;

    switch (dataType) {
      case TelemetryDataType.NUMERIC:
        if (typeof data.value !== 'number') return false;
        if (minValue !== undefined && data.value < minValue) return false;
        if (maxValue !== undefined && data.value > maxValue) return false;
        break;

      case TelemetryDataType.VECTOR:
        if (!Array.isArray(data.value)) return false;
        if (!data.value.every(v => typeof v === 'number')) return false;
        if (dimensions?.cols && data.value.length !== dimensions.cols) return false;
        break;

      case TelemetryDataType.MATRIX:
        if (!Array.isArray(data.value)) return false;
        if (dimensions?.rows && data.value.length !== dimensions.rows) return false;
        if (dimensions?.cols) {
          for (const row of data.value) {
            if (!Array.isArray(row) || row.length !== dimensions.cols) return false;
            if (!row.every(v => typeof v === 'number')) return false;
          }
        }
        break;

      case TelemetryDataType.STRING:
        if (typeof data.value !== 'string') return false;
        break;

      case TelemetryDataType.BOOLEAN:
        if (typeof data.value !== 'boolean') return false;
        break;

      case TelemetryDataType.OBJECT:
        if (typeof data.value !== 'object' || data.value === null) return false;
        break;
    }

    return true;
  }

  private updateRate(timestamp: number): void {
    this.rateCalculator.timestamps.push(timestamp);
    
    // Keep only recent timestamps
    const cutoff = timestamp - 10000; // Last 10 seconds
    this.rateCalculator.timestamps = this.rateCalculator.timestamps.filter(
      t => t > cutoff
    );

    // Calculate rate
    if (this.rateCalculator.timestamps.length > 1) {
      const duration = (timestamp - this.rateCalculator.timestamps[0]) / 1000;
      this.stats.averageRate = this.rateCalculator.timestamps.length / duration;
    }
  }

  private updateQuality(data: TelemetryDataPoint): void {
    if (data.quality !== undefined) {
      // Simple exponential moving average
      const alpha = 0.1;
      this.stats.dataQuality = alpha * data.quality + (1 - alpha) * this.stats.dataQuality;
    }
  }
}

/**
 * TelemetryManager - Main telemetry management class
 */
export class TelemetryManager extends EventEmitter<TelemetryManagerEvents> {
  private wsClient: WebSocketClient;
  private streams = new Map<string, StreamDataProcessor>();
  private subscriptions = new Map<string, StreamSubscription>();
  private messageHandler?: (message: WebSocketMessage) => void;
  private statsInterval?: NodeJS.Timeout;

  constructor(wsClient: WebSocketClient) {
    super();
    this.wsClient = wsClient;
    this.setupMessageHandler();
    this.startStatsReporting();
  }

  /**
   * Subscribe to a telemetry stream
   */
  async subscribe(config: TelemetryStreamConfig): Promise<string> {
    const { streamId } = config;

    // Check if already subscribed
    if (this.subscriptions.has(streamId)) {
      throw new Error(`Already subscribed to stream: ${streamId}`);
    }

    // Create stream processor
    const processor = new StreamDataProcessor(
      config,
      (event) => this.emit('stream:data', event),
      (droppedCount) => this.emit('buffer:overflow', streamId, droppedCount)
    );

    this.streams.set(streamId, processor);

    // Subscribe via WebSocket
    const subscriptionConfig: SubscriptionConfig = {
      channel: `telemetry.${streamId}`,
      filter: { streamId },
      compression: true,
      protocol: this.determineOptimalProtocol(config),
      priority: Priority.NORMAL
    };

    const subscriptionId = await this.wsClient.subscribe(subscriptionConfig);

    // Store subscription
    const subscription: StreamSubscription = {
      streamId,
      subscriptionId,
      config,
      active: true,
      paused: false,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.subscriptions.set(streamId, subscription);
    this.emit('stream:subscribed', subscription);

    return streamId;
  }

  /**
   * Unsubscribe from a telemetry stream
   */
  async unsubscribe(streamId: string): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Not subscribed to stream: ${streamId}`);
    }

    // Unsubscribe via WebSocket
    await this.wsClient.unsubscribe(subscription.subscriptionId);

    // Clean up
    this.streams.delete(streamId);
    this.subscriptions.delete(streamId);

    this.emit('stream:unsubscribed', streamId);
  }

  /**
   * Pause a telemetry stream
   */
  async pause(streamId: string): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Not subscribed to stream: ${streamId}`);
    }

    if (subscription.paused) {
      return;
    }

    // Send pause command
    await this.wsClient.sendMessage(
      MessageType.COMMAND,
      {
        action: 'pause_stream',
        streamId,
        subscriptionId: subscription.subscriptionId
      },
      Priority.HIGH
    );

    subscription.paused = true;
    subscription.lastActivity = Date.now();
    this.emit('stream:paused', streamId);
  }

  /**
   * Resume a paused telemetry stream
   */
  async resume(streamId: string): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Not subscribed to stream: ${streamId}`);
    }

    if (!subscription.paused) {
      return;
    }

    // Send resume command
    await this.wsClient.sendMessage(
      MessageType.COMMAND,
      {
        action: 'resume_stream',
        streamId,
        subscriptionId: subscription.subscriptionId
      },
      Priority.HIGH
    );

    subscription.paused = false;
    subscription.lastActivity = Date.now();
    this.emit('stream:resumed', streamId);
  }

  /**
   * Get data from a stream
   */
  getData(streamId: string, count?: number): TelemetryDataPoint[] {
    const processor = this.streams.get(streamId);
    if (!processor) {
      return [];
    }
    return processor.getData(count);
  }

  /**
   * Get stream statistics
   */
  getStreamStats(streamId: string): TelemetryStreamStats | null {
    const processor = this.streams.get(streamId);
    return processor ? processor.getStats() : null;
  }

  /**
   * Get all stream statistics
   */
  getAllStreamStats(): Map<string, TelemetryStreamStats> {
    const stats = new Map<string, TelemetryStreamStats>();
    for (const [streamId, processor] of this.streams) {
      stats.set(streamId, processor.getStats());
    }
    return stats;
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): StreamSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.active);
  }

  /**
   * Clear data for a stream
   */
  clearStreamData(streamId: string): void {
    const processor = this.streams.get(streamId);
    processor?.clear();
  }

  /**
   * Update stream configuration
   */
  async updateStreamConfig(
    streamId: string, 
    updates: Partial<TelemetryStreamConfig>
  ): Promise<void> {
    const subscription = this.subscriptions.get(streamId);
    if (!subscription) {
      throw new Error(`Not subscribed to stream: ${streamId}`);
    }

    // Update local config
    Object.assign(subscription.config, updates);

    // If buffer size changed, recreate processor
    if (updates.bufferSize || updates.decimationFactor) {
      const processor = new StreamDataProcessor(
        subscription.config,
        (event) => this.emit('stream:data', event),
        (droppedCount) => this.emit('buffer:overflow', streamId, droppedCount)
      );
      this.streams.set(streamId, processor);
    }

    // Notify server of config change
    await this.wsClient.sendMessage(
      MessageType.COMMAND,
      {
        action: 'update_stream_config',
        streamId,
        subscriptionId: subscription.subscriptionId,
        config: updates
      },
      Priority.HIGH
    );
  }

  /**
   * Export stream data for analysis
   */
  exportStreamData(streamId: string): {
    config: TelemetryStreamConfig;
    data: TelemetryDataPoint[];
    stats: TelemetryStreamStats;
  } | null {
    const subscription = this.subscriptions.get(streamId);
    const processor = this.streams.get(streamId);
    
    if (!subscription || !processor) {
      return null;
    }

    return {
      config: subscription.config,
      data: processor.getData(),
      stats: processor.getStats()
    };
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Stop stats reporting
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Unsubscribe from all streams
    const streamIds = Array.from(this.subscriptions.keys());
    await Promise.all(streamIds.map(id => this.unsubscribe(id)));

    // Remove message handler
    if (this.messageHandler) {
      this.wsClient.off('onMessage', this.messageHandler);
    }

    // Clear all data
    this.streams.clear();
    this.subscriptions.clear();
    this.removeAllListeners();
  }

  private setupMessageHandler(): void {
    this.messageHandler = (message: WebSocketMessage) => {
      if (message.type !== MessageType.TELEMETRY) {
        return;
      }

      const { streamId, data } = message.payload;
      if (!streamId || !data) {
        return;
      }

      const processor = this.streams.get(streamId);
      const subscription = this.subscriptions.get(streamId);
      
      if (!processor || !subscription || subscription.paused) {
        return;
      }

      // Update last activity
      subscription.lastActivity = Date.now();

      // Process data point
      try {
        const dataPoint: TelemetryDataPoint = {
          timestamp: data.timestamp || Date.now(),
          value: data.value,
          quality: data.quality,
          metadata: data.metadata
        };

        processor.addDataPoint(dataPoint);
      } catch (error) {
        this.emit('stream:error', streamId, error as Error);
      }
    };

    this.wsClient.on('onMessage', this.messageHandler);
  }

  private startStatsReporting(interval = 5000): void {
    this.statsInterval = setInterval(() => {
      for (const [streamId, processor] of this.streams) {
        const stats = processor.getStats();
        this.emit('stats:update', stats);
      }
    }, interval);
  }

  private determineOptimalProtocol(config: TelemetryStreamConfig): Protocol {
    // High-frequency numeric data benefits from binary protocols
    if (config.dataType === TelemetryDataType.NUMERIC && 
        config.sampleRate && config.sampleRate > 10) {
      return Protocol.MESSAGEPACK;
    }

    // Matrix/vector data benefits from CBOR
    if (config.dataType === TelemetryDataType.MATRIX || 
        config.dataType === TelemetryDataType.VECTOR) {
      return Protocol.CBOR;
    }

    // Default to JSON for other types
    return Protocol.JSON;
  }
}