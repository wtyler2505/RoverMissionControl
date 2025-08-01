/**
 * TelemetryStreamManager - Manages WebSocket integration for real-time telemetry data streaming
 * Bridges the existing WebSocket infrastructure with the telemetry analysis framework
 */

import { EventEmitter } from 'events';
import { TelemetryManager } from '../TelemetryManager';
import { WebSocketClient } from '../WebSocketClient';
import { ConnectionManager } from '../ConnectionManager';
import { ProtocolManager } from '../ProtocolManager';
import { MessageQueue, MessagePriority } from '../MessageQueue';
import { TelemetryAnalyzer } from './TelemetryAnalyzer';
import { CorrelationAnalyzer } from './CorrelationAnalyzer';
import { AdvancedTrendAnalyzer } from './trend/AdvancedTrendAnalyzer';
import { DriftDetector } from './trend/DriftDetector';
import { PredictionEngine } from './trend/PredictionEngine';
import { StreamDataProcessor } from '../StreamDataProcessor';
import {
  TelemetryStreamConfig,
  TelemetryDataPoint,
  StreamMetadata,
  StreamStatistics,
  StreamSubscription,
  BinaryProtocol,
  StreamQuality
} from '../../types/telemetry';

/**
 * Stream manager configuration
 */
export interface StreamManagerConfig {
  maxConcurrentStreams?: number;
  defaultBufferSize?: number;
  defaultDecimationRatio?: number;
  analysisInterval?: number;
  enableRealTimeAnalysis?: boolean;
  enableBinaryProtocol?: boolean;
  compressionThreshold?: number;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
  rateLimitPerSecond?: number;
}

/**
 * Stream channel information
 */
export interface StreamChannel {
  id: string;
  name: string;
  description?: string;
  dataType: 'scalar' | 'vector' | 'matrix';
  unit?: string;
  minValue?: number;
  maxValue?: number;
  frequency: number;
  protocol: BinaryProtocol;
  requiresAuth: boolean;
  requiredRole?: string;
}

/**
 * Stream analysis configuration
 */
export interface StreamAnalysisConfig {
  enableStatistics: boolean;
  enableAnomalyDetection: boolean;
  enableCorrelation: boolean;
  enableTrendAnalysis: boolean;
  enablePredictions: boolean;
  enableDriftDetection: boolean;
  correlationStreams?: string[];
  anomalyThreshold?: number;
  predictionHorizon?: number;
}

/**
 * Stream health status
 */
export interface StreamHealth {
  streamId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  latency: number;
  dataRate: number;
  errorRate: number;
  lastDataTimestamp: number;
  quality: StreamQuality;
  issues: string[];
}

/**
 * Events emitted by TelemetryStreamManager
 */
export interface TelemetryStreamManagerEvents {
  'stream:subscribed': (channel: StreamChannel, subscription: StreamSubscription) => void;
  'stream:unsubscribed': (streamId: string) => void;
  'stream:data': (streamId: string, data: TelemetryDataPoint) => void;
  'stream:error': (streamId: string, error: Error) => void;
  'stream:health': (health: StreamHealth) => void;
  'analysis:result': (streamId: string, result: any) => void;
  'connection:status': (status: string) => void;
  'protocol:switched': (from: BinaryProtocol, to: BinaryProtocol) => void;
}

/**
 * TelemetryStreamManager class
 */
export class TelemetryStreamManager extends EventEmitter {
  private config: Required<StreamManagerConfig>;
  private telemetryManager: TelemetryManager;
  private wsClient: WebSocketClient;
  private connectionManager: ConnectionManager;
  private protocolManager: ProtocolManager;
  private messageQueue: MessageQueue;
  private activeStreams: Map<string, StreamSubscription>;
  private streamProcessors: Map<string, StreamDataProcessor>;
  private streamChannels: Map<string, StreamChannel>;
  private streamHealth: Map<string, StreamHealth>;
  private analyzers: Map<string, TelemetryAnalyzer>;
  private correlationAnalyzer: CorrelationAnalyzer;
  private trendAnalyzers: Map<string, AdvancedTrendAnalyzer>;
  private driftDetectors: Map<string, DriftDetector>;
  private predictionEngines: Map<string, PredictionEngine>;
  private analysisTimers: Map<string, NodeJS.Timer>;
  private healthCheckTimer?: NodeJS.Timer;
  private reconnectTimer?: NodeJS.Timer;
  private isInitialized: boolean = false;

  constructor(config: StreamManagerConfig = {}) {
    super();
    this.config = {
      maxConcurrentStreams: 20,
      defaultBufferSize: 10000,
      defaultDecimationRatio: 10,
      analysisInterval: 1000,
      enableRealTimeAnalysis: true,
      enableBinaryProtocol: true,
      compressionThreshold: 1024,
      reconnectAttempts: 5,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      messageQueueSize: 1000,
      rateLimitPerSecond: 100,
      ...config
    };

    // Initialize core services
    this.telemetryManager = TelemetryManager.getInstance();
    this.wsClient = WebSocketClient.getInstance();
    this.connectionManager = ConnectionManager.getInstance();
    this.protocolManager = ProtocolManager.getInstance();
    this.messageQueue = new MessageQueue(this.config.messageQueueSize);

    // Initialize collections
    this.activeStreams = new Map();
    this.streamProcessors = new Map();
    this.streamChannels = new Map();
    this.streamHealth = new Map();
    this.analyzers = new Map();
    this.trendAnalyzers = new Map();
    this.driftDetectors = new Map();
    this.predictionEngines = new Map();
    this.analysisTimers = new Map();

    // Initialize correlation analyzer (shared across streams)
    this.correlationAnalyzer = new CorrelationAnalyzer();

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize the stream manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Connect to WebSocket server
      await this.wsClient.connect();

      // Discover available channels
      await this.discoverChannels();

      // Start health monitoring
      this.startHealthMonitoring();

      // Set up protocol optimization
      if (this.config.enableBinaryProtocol) {
        this.protocolManager.enableAutoSwitch(true);
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize TelemetryStreamManager:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a telemetry stream
   */
  public async subscribe(
    streamId: string,
    config?: Partial<TelemetryStreamConfig>,
    analysisConfig?: StreamAnalysisConfig
  ): Promise<StreamSubscription> {
    // Check if already subscribed
    if (this.activeStreams.has(streamId)) {
      throw new Error(`Already subscribed to stream: ${streamId}`);
    }

    // Check concurrent stream limit
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error(`Maximum concurrent streams (${this.config.maxConcurrentStreams}) reached`);
    }

    // Get channel information
    const channel = this.streamChannels.get(streamId);
    if (!channel) {
      throw new Error(`Unknown stream channel: ${streamId}`);
    }

    // Create stream configuration
    const streamConfig: TelemetryStreamConfig = {
      streamId,
      bufferSize: this.config.defaultBufferSize,
      decimationRatio: this.config.defaultDecimationRatio,
      fields: ['all'],
      frequency: channel.frequency,
      ...config
    };

    // Subscribe through telemetry manager
    const subscription = await this.telemetryManager.subscribeToStream(streamConfig);

    // Create stream processor
    const processor = new StreamDataProcessor({
      bufferSize: streamConfig.bufferSize!,
      decimationRatio: streamConfig.decimationRatio!
    });

    // Set up analysis if enabled
    if (analysisConfig && this.config.enableRealTimeAnalysis) {
      this.setupStreamAnalysis(streamId, analysisConfig);
    }

    // Store references
    this.activeStreams.set(streamId, subscription);
    this.streamProcessors.set(streamId, processor);

    // Initialize stream health
    this.streamHealth.set(streamId, {
      streamId,
      status: 'healthy',
      latency: 0,
      dataRate: 0,
      errorRate: 0,
      lastDataTimestamp: Date.now(),
      quality: StreamQuality.Good,
      issues: []
    });

    // Set up data forwarding
    this.telemetryManager.on(`stream:${streamId}:data`, (data: TelemetryDataPoint) => {
      this.handleStreamData(streamId, data);
    });

    this.emit('stream:subscribed', channel, subscription);
    return subscription;
  }

  /**
   * Unsubscribe from a telemetry stream
   */
  public async unsubscribe(streamId: string): Promise<void> {
    const subscription = this.activeStreams.get(streamId);
    if (!subscription) {
      return;
    }

    // Stop analysis
    this.stopStreamAnalysis(streamId);

    // Unsubscribe through telemetry manager
    await this.telemetryManager.unsubscribeFromStream(streamId);

    // Clean up resources
    this.activeStreams.delete(streamId);
    this.streamProcessors.delete(streamId);
    this.streamHealth.delete(streamId);
    this.analyzers.delete(streamId);
    this.trendAnalyzers.delete(streamId);
    this.driftDetectors.delete(streamId);
    this.predictionEngines.delete(streamId);

    // Remove from correlation analyzer
    this.correlationAnalyzer.removeStream(streamId);

    this.emit('stream:unsubscribed', streamId);
  }

  /**
   * Get available stream channels
   */
  public getAvailableChannels(): StreamChannel[] {
    return Array.from(this.streamChannels.values());
  }

  /**
   * Get active stream subscriptions
   */
  public getActiveStreams(): StreamSubscription[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Get stream health status
   */
  public getStreamHealth(streamId?: string): StreamHealth | StreamHealth[] {
    if (streamId) {
      return this.streamHealth.get(streamId) || null;
    }
    return Array.from(this.streamHealth.values());
  }

  /**
   * Get stream statistics
   */
  public getStreamStatistics(streamId: string): StreamStatistics | null {
    const processor = this.streamProcessors.get(streamId);
    if (!processor) {
      return null;
    }

    return processor.getStatistics();
  }

  /**
   * Get buffered data for a stream
   */
  public getStreamData(streamId: string, count?: number): TelemetryDataPoint[] {
    const processor = this.streamProcessors.get(streamId);
    if (!processor) {
      return [];
    }

    return processor.getData(count);
  }

  /**
   * Configure stream analysis
   */
  public configureAnalysis(streamId: string, config: StreamAnalysisConfig): void {
    if (!this.activeStreams.has(streamId)) {
      throw new Error(`Not subscribed to stream: ${streamId}`);
    }

    this.setupStreamAnalysis(streamId, config);
  }

  /**
   * Send a telemetry request
   */
  public async sendTelemetryRequest(
    request: any,
    priority: MessagePriority = MessagePriority.Normal
  ): Promise<void> {
    await this.messageQueue.enqueue({
      type: 'telemetry_request',
      payload: request,
      priority,
      timestamp: Date.now()
    });

    this.processMessageQueue();
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    connected: boolean;
    protocol: BinaryProtocol;
    latency: number;
    metrics: any;
  } {
    return {
      connected: this.wsClient.isConnected(),
      protocol: this.protocolManager.getCurrentProtocol(),
      latency: this.connectionManager.getLatency(),
      metrics: this.connectionManager.getMetrics()
    };
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Unsubscribe from all streams
    const streamIds = Array.from(this.activeStreams.keys());
    await Promise.all(streamIds.map(id => this.unsubscribe(id)));

    // Clear timers
    this.analysisTimers.forEach(timer => clearInterval(timer));
    this.analysisTimers.clear();

    // Disconnect WebSocket
    await this.wsClient.disconnect();

    this.isInitialized = false;
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // WebSocket events
    this.wsClient.on('connected', () => {
      this.emit('connection:status', 'connected');
      this.restoreSubscriptions();
    });

    this.wsClient.on('disconnected', () => {
      this.emit('connection:status', 'disconnected');
      this.handleDisconnection();
    });

    this.wsClient.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.emit('connection:status', 'error');
    });

    // Protocol events
    this.protocolManager.on('protocol:switched', (from: BinaryProtocol, to: BinaryProtocol) => {
      this.emit('protocol:switched', from, to);
    });

    // Connection manager events
    this.connectionManager.on('latency:updated', (latency: number) => {
      this.updateStreamHealthLatency(latency);
    });
  }

  /**
   * Discover available telemetry channels
   */
  private async discoverChannels(): Promise<void> {
    try {
      const response = await this.wsClient.emit('discover_channels', {});
      const channels = response.channels as StreamChannel[];

      channels.forEach(channel => {
        this.streamChannels.set(channel.id, channel);
      });
    } catch (error) {
      console.error('Failed to discover channels:', error);
    }
  }

  /**
   * Handle incoming stream data
   */
  private handleStreamData(streamId: string, data: TelemetryDataPoint): void {
    const processor = this.streamProcessors.get(streamId);
    if (!processor) {
      return;
    }

    // Add to buffer
    processor.addData(data);

    // Update stream health
    this.updateStreamHealth(streamId, data);

    // Emit data event
    this.emit('stream:data', streamId, data);

    // Forward to analyzers if real-time analysis is enabled
    if (this.config.enableRealTimeAnalysis) {
      const analyzer = this.analyzers.get(streamId);
      if (analyzer) {
        analyzer.addDataPoint(data);
      }
    }
  }

  /**
   * Set up stream analysis
   */
  private setupStreamAnalysis(streamId: string, config: StreamAnalysisConfig): void {
    // Create telemetry analyzer
    if (config.enableStatistics || config.enableAnomalyDetection) {
      const analyzer = new TelemetryAnalyzer({
        anomalyDetection: {
          enabled: config.enableAnomalyDetection,
          threshold: config.anomalyThreshold || 3
        }
      });
      this.analyzers.set(streamId, analyzer);

      // Set up analysis result handler
      analyzer.on('analysis:complete', (result) => {
        this.emit('analysis:result', streamId, { type: 'statistics', result });
      });

      analyzer.on('anomaly:detected', (anomaly) => {
        this.emit('analysis:result', streamId, { type: 'anomaly', result: anomaly });
      });
    }

    // Set up correlation analysis
    if (config.enableCorrelation && config.correlationStreams) {
      this.correlationAnalyzer.addStream({
        id: streamId,
        name: streamId,
        data: []
      });

      // Configure correlation with other streams
      config.correlationStreams.forEach(otherStreamId => {
        if (this.activeStreams.has(otherStreamId)) {
          this.correlationAnalyzer.on('correlation:found', (correlation) => {
            if (correlation.streamIds.includes(streamId)) {
              this.emit('analysis:result', streamId, { type: 'correlation', result: correlation });
            }
          });
        }
      });
    }

    // Set up trend analysis
    if (config.enableTrendAnalysis) {
      const trendAnalyzer = new AdvancedTrendAnalyzer({
        enableARIMA: true,
        enableNonLinear: true,
        enableChangePoint: true
      });
      this.trendAnalyzers.set(streamId, trendAnalyzer);

      trendAnalyzer.on('analysis:complete', (result) => {
        this.emit('analysis:result', streamId, { type: 'trend', result });
      });
    }

    // Set up drift detection
    if (config.enableDriftDetection) {
      const driftDetector = new DriftDetector({
        method: 'adwin',
        sensitivity: 0.1
      });
      this.driftDetectors.set(streamId, driftDetector);

      driftDetector.on('drift:detected', (drift) => {
        this.emit('analysis:result', streamId, { type: 'drift', result: drift });
      });
    }

    // Set up predictions
    if (config.enablePredictions) {
      const predictionEngine = new PredictionEngine({
        horizon: config.predictionHorizon || 10,
        updateInterval: 5000
      });
      this.predictionEngines.set(streamId, predictionEngine);

      predictionEngine.on('prediction:generated', (prediction) => {
        this.emit('analysis:result', streamId, { type: 'prediction', result: prediction });
      });
    }

    // Start analysis timer
    const timer = setInterval(() => {
      this.runStreamAnalysis(streamId);
    }, this.config.analysisInterval);
    this.analysisTimers.set(streamId, timer);
  }

  /**
   * Stop stream analysis
   */
  private stopStreamAnalysis(streamId: string): void {
    const timer = this.analysisTimers.get(streamId);
    if (timer) {
      clearInterval(timer);
      this.analysisTimers.delete(streamId);
    }
  }

  /**
   * Run analysis for a stream
   */
  private async runStreamAnalysis(streamId: string): Promise<void> {
    const processor = this.streamProcessors.get(streamId);
    if (!processor) {
      return;
    }

    const data = processor.getData();
    if (data.length === 0) {
      return;
    }

    // Run trend analysis
    const trendAnalyzer = this.trendAnalyzers.get(streamId);
    if (trendAnalyzer) {
      try {
        await trendAnalyzer.analyze(data);
      } catch (error) {
        console.error(`Trend analysis error for stream ${streamId}:`, error);
      }
    }

    // Run drift detection
    const driftDetector = this.driftDetectors.get(streamId);
    if (driftDetector) {
      const latestValue = data[data.length - 1];
      try {
        driftDetector.addDataPoint(latestValue[streamId] || latestValue.value);
      } catch (error) {
        console.error(`Drift detection error for stream ${streamId}:`, error);
      }
    }

    // Run predictions
    const predictionEngine = this.predictionEngines.get(streamId);
    if (predictionEngine) {
      try {
        await predictionEngine.updateModels(data.map(d => ({
          timestamp: d.timestamp,
          value: d[streamId] || d.value
        })));
      } catch (error) {
        console.error(`Prediction error for stream ${streamId}:`, error);
      }
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.checkStreamHealth();
    }, 5000);
  }

  /**
   * Check health of all active streams
   */
  private checkStreamHealth(): void {
    const now = Date.now();

    this.activeStreams.forEach((subscription, streamId) => {
      const health = this.streamHealth.get(streamId);
      if (!health) {
        return;
      }

      const timeSinceLastData = now - health.lastDataTimestamp;
      const channel = this.streamChannels.get(streamId);
      const expectedInterval = channel ? 1000 / channel.frequency : 1000;

      // Update health status based on data freshness
      if (timeSinceLastData > expectedInterval * 10) {
        health.status = 'offline';
        health.issues.push('No data received');
      } else if (timeSinceLastData > expectedInterval * 5) {
        health.status = 'unhealthy';
        health.issues.push('Data delay detected');
      } else if (health.errorRate > 0.1) {
        health.status = 'degraded';
        health.issues.push('High error rate');
      } else {
        health.status = 'healthy';
        health.issues = [];
      }

      // Update quality indicator
      if (health.latency > 100) {
        health.quality = StreamQuality.Poor;
      } else if (health.latency > 50) {
        health.quality = StreamQuality.Fair;
      } else {
        health.quality = StreamQuality.Good;
      }

      this.emit('stream:health', health);
    });
  }

  /**
   * Update stream health metrics
   */
  private updateStreamHealth(streamId: string, data: TelemetryDataPoint): void {
    const health = this.streamHealth.get(streamId);
    if (!health) {
      return;
    }

    health.lastDataTimestamp = Date.now();
    health.dataRate = this.calculateDataRate(streamId);
  }

  /**
   * Update stream health latency
   */
  private updateStreamHealthLatency(latency: number): void {
    this.streamHealth.forEach(health => {
      health.latency = latency;
    });
  }

  /**
   * Calculate data rate for a stream
   */
  private calculateDataRate(streamId: string): number {
    const processor = this.streamProcessors.get(streamId);
    if (!processor) {
      return 0;
    }

    const stats = processor.getStatistics();
    return stats.dataRate || 0;
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    // Update all stream health to offline
    this.streamHealth.forEach(health => {
      health.status = 'offline';
      health.issues = ['Connection lost'];
    });

    // Start reconnection attempts
    this.startReconnection();
  }

  /**
   * Start reconnection attempts
   */
  private startReconnection(): void {
    let attempts = 0;

    this.reconnectTimer = setInterval(async () => {
      if (attempts >= this.config.reconnectAttempts) {
        clearInterval(this.reconnectTimer!);
        this.emit('connection:status', 'failed');
        return;
      }

      try {
        await this.wsClient.connect();
        clearInterval(this.reconnectTimer!);
        this.emit('connection:status', 'reconnected');
      } catch (error) {
        attempts++;
        console.error(`Reconnection attempt ${attempts} failed:`, error);
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Restore subscriptions after reconnection
   */
  private async restoreSubscriptions(): Promise<void> {
    const subscriptions = Array.from(this.activeStreams.entries());

    for (const [streamId, subscription] of subscriptions) {
      try {
        await this.telemetryManager.subscribeToStream(subscription.config);
        console.log(`Restored subscription to stream: ${streamId}`);
      } catch (error) {
        console.error(`Failed to restore subscription to stream ${streamId}:`, error);
      }
    }
  }

  /**
   * Process message queue
   */
  private async processMessageQueue(): Promise<void> {
    const messages = await this.messageQueue.dequeueMany(10);

    for (const message of messages) {
      try {
        await this.wsClient.emit(message.type, message.payload);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }
}

// Export singleton instance
export const telemetryStreamManager = new TelemetryStreamManager();