/**
 * Protocol Manager
 * Handles protocol negotiation, performance tracking, and runtime protocol switching
 * for WebSocket communication with advanced compression and optimization features
 */

import {
  Protocol,
  ProtocolNegotiation,
  WebSocketMessage,
  MessageType,
  WebSocketError
} from './types';
import {
  SerializerFactory,
  SerializerInterface,
  SizeEstimator,
  getSerializationMetrics
} from './BinarySerializer';
import { EventEmitter } from './EventEmitter';

/**
 * Client protocol capabilities
 * Defines what the browser/client supports
 */
export interface ProtocolCapabilities {
  supportedProtocols: Protocol[];
  compressionSupported: boolean;
  compressionAlgorithms: CompressionAlgorithm[];
  maxMessageSize: number;
  binarySupported: boolean;
  streamingSupported: boolean;
  hardwareAcceleration: boolean;
}

/**
 * Compression algorithms supported
 */
export enum CompressionAlgorithm {
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  BROTLI = 'brotli',
  LZ4 = 'lz4',
  ZSTD = 'zstd'
}

/**
 * Protocol performance metrics
 */
export interface ProtocolMetrics {
  protocol: Protocol;
  messageCount: number;
  totalBytes: number;
  averageMessageSize: number;
  encodingTime: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
  };
  decodingTime: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
  };
  compressionRatio: number;
  throughput: number; // messages per second
  errorRate: number;
  lastUpdated: number;
}

/**
 * Protocol negotiation result
 */
export interface NegotiationResult {
  selectedProtocol: Protocol;
  compressionEnabled: boolean;
  compressionAlgorithm?: CompressionAlgorithm;
  maxMessageSize: number;
  features: string[];
  negotiatedAt: number;
  serverCapabilities: {
    protocols: Protocol[];
    compression: boolean;
    algorithms: CompressionAlgorithm[];
    maxMessageSize: number;
    version: string;
  };
}

/**
 * Protocol preferences configuration
 */
export interface ProtocolPreferences {
  preferredProtocol?: Protocol;
  preferredCompression?: CompressionAlgorithm;
  autoSwitch: boolean;
  switchThreshold: {
    errorRate: number; // Switch if error rate exceeds this
    latency: number; // Switch if latency exceeds this (ms)
    throughput: number; // Switch if throughput falls below this
  };
  messageTypeHints: Map<MessageType, Protocol>;
  sizeThreshold: {
    small: number; // bytes
    medium: number; // bytes
    large: number; // bytes
  };
}

/**
 * Protocol switch event data
 */
export interface ProtocolSwitchEvent {
  from: Protocol;
  to: Protocol;
  reason: 'manual' | 'performance' | 'error' | 'recommendation';
  metrics?: ProtocolMetrics;
  timestamp: number;
}

/**
 * Performance sample for tracking
 */
interface PerformanceSample {
  timestamp: number;
  encodingTime: number;
  decodingTime: number;
  messageSize: number;
  compressed: boolean;
  error?: boolean;
}

/**
 * Protocol Manager Events
 */
export interface ProtocolManagerEvents {
  'protocol:switched': (event: ProtocolSwitchEvent) => void;
  'protocol:negotiated': (result: NegotiationResult) => void;
  'protocol:error': (error: WebSocketError) => void;
  'metrics:updated': (metrics: ProtocolMetrics[]) => void;
  'recommendation:available': (recommendation: ProtocolRecommendation) => void;
}

/**
 * Protocol recommendation
 */
export interface ProtocolRecommendation {
  currentProtocol: Protocol;
  recommendedProtocol: Protocol;
  reason: string;
  confidence: number; // 0-1
  potentialImprovement: {
    latency?: number; // percentage
    throughput?: number; // percentage
    size?: number; // percentage
  };
}

/**
 * Protocol Manager Implementation
 */
export class ProtocolManager extends EventEmitter {
  private capabilities: ProtocolCapabilities;
  private preferences: ProtocolPreferences;
  private currentProtocol: Protocol = Protocol.JSON;
  private negotiationResult?: NegotiationResult;
  private metrics: Map<Protocol, ProtocolMetrics> = new Map();
  private performanceSamples: Map<Protocol, PerformanceSample[]> = new Map();
  private serializers: Map<Protocol, SerializerInterface> = new Map();
  private compressionWorker?: Worker;
  private metricsInterval?: NodeJS.Timeout;
  private recommendationInterval?: NodeJS.Timeout;

  constructor(preferences?: Partial<ProtocolPreferences>) {
    super();
    
    // Initialize capabilities based on browser/runtime detection
    this.capabilities = this.detectCapabilities();
    
    // Set default preferences
    this.preferences = {
      autoSwitch: true,
      switchThreshold: {
        errorRate: 0.05, // 5%
        latency: 100, // ms
        throughput: 10 // messages/second
      },
      messageTypeHints: new Map([
        [MessageType.TELEMETRY, Protocol.MESSAGEPACK],
        [MessageType.BINARY, Protocol.CBOR],
        [MessageType.COMMAND, Protocol.JSON],
        [MessageType.STATUS, Protocol.JSON]
      ]),
      sizeThreshold: {
        small: 1024, // 1KB
        medium: 10240, // 10KB
        large: 102400 // 100KB
      },
      ...preferences
    };

    // Initialize metrics for all supported protocols
    this.initializeMetrics();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    // Start recommendation engine
    this.startRecommendationEngine();
    
    // Initialize compression worker if supported
    this.initializeCompressionWorker();
  }

  /**
   * Detect client capabilities
   */
  private detectCapabilities(): ProtocolCapabilities {
    const capabilities: ProtocolCapabilities = {
      supportedProtocols: [Protocol.JSON], // Always support JSON
      compressionSupported: false,
      compressionAlgorithms: [],
      maxMessageSize: 16 * 1024 * 1024, // 16MB default
      binarySupported: false,
      streamingSupported: false,
      hardwareAcceleration: false
    };

    // Check for binary support
    if (typeof ArrayBuffer !== 'undefined' && typeof Uint8Array !== 'undefined') {
      capabilities.binarySupported = true;
      capabilities.supportedProtocols.push(Protocol.MESSAGEPACK, Protocol.CBOR, Protocol.BINARY);
    }

    // Check for compression support
    if ('CompressionStream' in globalThis) {
      capabilities.compressionSupported = true;
      capabilities.compressionAlgorithms.push(CompressionAlgorithm.GZIP, CompressionAlgorithm.DEFLATE);
    }

    // Check for streaming support
    if ('ReadableStream' in globalThis && 'WritableStream' in globalThis) {
      capabilities.streamingSupported = true;
    }

    // Check for WebAssembly (for potential hardware acceleration)
    if (typeof WebAssembly !== 'undefined') {
      capabilities.hardwareAcceleration = true;
    }

    // Detect max message size based on available memory (simplified)
    if ('performance' in globalThis && 'memory' in performance) {
      const memory = (performance as any).memory;
      if (memory && memory.jsHeapSizeLimit) {
        // Use 1% of heap size limit as max message size
        capabilities.maxMessageSize = Math.min(
          memory.jsHeapSizeLimit * 0.01,
          64 * 1024 * 1024 // Cap at 64MB
        );
      }
    }

    return capabilities;
  }

  /**
   * Initialize metrics for all protocols
   */
  private initializeMetrics(): void {
    for (const protocol of this.capabilities.supportedProtocols) {
      this.metrics.set(protocol, {
        protocol,
        messageCount: 0,
        totalBytes: 0,
        averageMessageSize: 0,
        encodingTime: { min: Infinity, max: 0, average: 0, p95: 0, p99: 0 },
        decodingTime: { min: Infinity, max: 0, average: 0, p95: 0, p99: 0 },
        compressionRatio: 1,
        throughput: 0,
        errorRate: 0,
        lastUpdated: Date.now()
      });
      this.performanceSamples.set(protocol, []);
    }
  }

  /**
   * Initialize compression worker for offloading compression tasks
   */
  private initializeCompressionWorker(): void {
    if (!this.capabilities.compressionSupported || !Worker) {
      return;
    }

    // Create inline worker for compression
    const workerCode = `
      self.onmessage = async function(e) {
        const { id, action, data, algorithm } = e.data;
        
        try {
          let result;
          
          if (action === 'compress') {
            const stream = new CompressionStream(algorithm);
            const writer = stream.writable.getWriter();
            writer.write(data);
            writer.close();
            
            const compressed = [];
            const reader = stream.readable.getReader();
            let chunk;
            while (!(chunk = await reader.read()).done) {
              compressed.push(chunk.value);
            }
            
            result = new Uint8Array(compressed.reduce((acc, val) => acc + val.length, 0));
            let offset = 0;
            for (const chunk of compressed) {
              result.set(chunk, offset);
              offset += chunk.length;
            }
          } else if (action === 'decompress') {
            const stream = new DecompressionStream(algorithm);
            const writer = stream.writable.getWriter();
            writer.write(data);
            writer.close();
            
            const decompressed = [];
            const reader = stream.readable.getReader();
            let chunk;
            while (!(chunk = await reader.read()).done) {
              decompressed.push(chunk.value);
            }
            
            result = new Uint8Array(decompressed.reduce((acc, val) => acc + val.length, 0));
            let offset = 0;
            for (const chunk of decompressed) {
              result.set(chunk, offset);
              offset += chunk.length;
            }
          }
          
          self.postMessage({ id, success: true, result });
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this.compressionWorker = new Worker(URL.createObjectURL(blob));
  }

  /**
   * Start metrics collection interval
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Start recommendation engine
   */
  private startRecommendationEngine(): void {
    this.recommendationInterval = setInterval(() => {
      const recommendation = this.generateRecommendation();
      if (recommendation && recommendation.confidence > 0.7) {
        this.emit('recommendation:available', recommendation);
        
        // Auto-switch if enabled and confidence is high
        if (this.preferences.autoSwitch && recommendation.confidence > 0.85) {
          this.switchProtocol(recommendation.recommendedProtocol, 'recommendation');
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Negotiate protocol with server
   */
  async negotiate(serverCapabilities: Partial<ProtocolNegotiation>): Promise<NegotiationResult> {
    try {
      // Find common protocols
      const commonProtocols = this.capabilities.supportedProtocols.filter(
        p => serverCapabilities.supportedProtocols?.includes(p)
      );

      if (commonProtocols.length === 0) {
        throw this.createError('No common protocols supported', 'protocol');
      }

      // Select protocol based on preferences and capabilities
      let selectedProtocol = this.preferences.preferredProtocol;
      if (!selectedProtocol || !commonProtocols.includes(selectedProtocol)) {
        selectedProtocol = serverCapabilities.preferredProtocol || commonProtocols[0];
      }

      // Determine compression
      const compressionEnabled = 
        this.capabilities.compressionSupported && 
        (serverCapabilities.compressionSupported ?? false);

      // Create negotiation result
      const result: NegotiationResult = {
        selectedProtocol,
        compressionEnabled,
        compressionAlgorithm: compressionEnabled ? CompressionAlgorithm.GZIP : undefined,
        maxMessageSize: Math.min(
          this.capabilities.maxMessageSize,
          16 * 1024 * 1024 // Server default
        ),
        features: this.getEnabledFeatures(selectedProtocol, compressionEnabled),
        negotiatedAt: Date.now(),
        serverCapabilities: {
          protocols: serverCapabilities.supportedProtocols || [],
          compression: serverCapabilities.compressionSupported || false,
          algorithms: [CompressionAlgorithm.GZIP, CompressionAlgorithm.DEFLATE],
          maxMessageSize: 16 * 1024 * 1024,
          version: '1.0.0'
        }
      };

      this.negotiationResult = result;
      this.currentProtocol = selectedProtocol;
      
      this.emit('protocol:negotiated', result);
      
      return result;
    } catch (error) {
      const wsError = error instanceof Error ? 
        this.createError(error.message, 'protocol') : 
        this.createError('Protocol negotiation failed', 'protocol');
      
      this.emit('protocol:error', wsError);
      throw wsError;
    }
  }

  /**
   * Get enabled features for a protocol
   */
  private getEnabledFeatures(protocol: Protocol, compression: boolean): string[] {
    const features: string[] = [protocol];
    
    if (compression) {
      features.push('compression');
    }
    
    if (this.capabilities.binarySupported && protocol !== Protocol.JSON) {
      features.push('binary');
    }
    
    if (this.capabilities.streamingSupported) {
      features.push('streaming');
    }
    
    if (this.capabilities.hardwareAcceleration) {
      features.push('hardware-acceleration');
    }
    
    return features;
  }

  /**
   * Get current protocol
   */
  getCurrentProtocol(): Protocol {
    return this.currentProtocol;
  }

  /**
   * Get negotiation result
   */
  getNegotiationResult(): NegotiationResult | undefined {
    return this.negotiationResult;
  }

  /**
   * Switch to a different protocol
   */
  async switchProtocol(
    newProtocol: Protocol, 
    reason: ProtocolSwitchEvent['reason'] = 'manual'
  ): Promise<void> {
    if (!this.capabilities.supportedProtocols.includes(newProtocol)) {
      throw this.createError(`Protocol ${newProtocol} not supported`, 'protocol');
    }

    if (newProtocol === this.currentProtocol) {
      return;
    }

    const oldProtocol = this.currentProtocol;
    const metrics = this.metrics.get(oldProtocol);

    this.currentProtocol = newProtocol;

    const event: ProtocolSwitchEvent = {
      from: oldProtocol,
      to: newProtocol,
      reason,
      metrics: metrics ? { ...metrics } : undefined,
      timestamp: Date.now()
    };

    this.emit('protocol:switched', event);
  }

  /**
   * Encode a message using current protocol
   */
  async encode(message: WebSocketMessage): Promise<ArrayBuffer | Uint8Array> {
    const startTime = performance.now();
    const serializer = this.getSerializer(this.currentProtocol);
    
    try {
      let encoded = serializer.encode(message);
      
      // Apply compression if enabled
      if (this.negotiationResult?.compressionEnabled && this.shouldCompress(message)) {
        encoded = await this.compress(encoded);
      }
      
      const encodingTime = performance.now() - startTime;
      this.recordPerformanceSample(this.currentProtocol, {
        timestamp: Date.now(),
        encodingTime,
        decodingTime: 0,
        messageSize: encoded.byteLength,
        compressed: this.negotiationResult?.compressionEnabled || false
      });
      
      return encoded;
    } catch (error) {
      this.recordPerformanceSample(this.currentProtocol, {
        timestamp: Date.now(),
        encodingTime: performance.now() - startTime,
        decodingTime: 0,
        messageSize: 0,
        compressed: false,
        error: true
      });
      
      throw error;
    }
  }

  /**
   * Decode a message using current protocol
   */
  async decode(data: ArrayBuffer | Uint8Array): Promise<WebSocketMessage> {
    const startTime = performance.now();
    const serializer = this.getSerializer(this.currentProtocol);
    
    try {
      // Decompress if needed
      let decoded = data;
      if (this.negotiationResult?.compressionEnabled && this.isCompressed(data)) {
        decoded = await this.decompress(data);
      }
      
      const message = serializer.decode(decoded);
      
      const decodingTime = performance.now() - startTime;
      this.recordPerformanceSample(this.currentProtocol, {
        timestamp: Date.now(),
        encodingTime: 0,
        decodingTime,
        messageSize: data.byteLength,
        compressed: this.negotiationResult?.compressionEnabled || false
      });
      
      return message;
    } catch (error) {
      this.recordPerformanceSample(this.currentProtocol, {
        timestamp: Date.now(),
        encodingTime: 0,
        decodingTime: performance.now() - startTime,
        messageSize: data.byteLength,
        compressed: false,
        error: true
      });
      
      throw error;
    }
  }

  /**
   * Get serializer for protocol
   */
  private getSerializer(protocol: Protocol): SerializerInterface {
    if (!this.serializers.has(protocol)) {
      this.serializers.set(protocol, SerializerFactory.getSerializer(protocol));
    }
    return this.serializers.get(protocol)!;
  }

  /**
   * Check if data should be compressed
   */
  private shouldCompress(message: WebSocketMessage): boolean {
    // Don't compress already compressed data
    if (message.compressed) return false;
    
    // Don't compress small messages
    const estimatedSize = SizeEstimator.estimate(message.payload, this.currentProtocol);
    if (estimatedSize < this.preferences.sizeThreshold.small) return false;
    
    // Don't compress binary data (already efficient)
    if (message.type === MessageType.BINARY) return false;
    
    return true;
  }

  /**
   * Check if data is compressed
   */
  private isCompressed(data: ArrayBuffer | Uint8Array): boolean {
    const view = new DataView(
      data instanceof ArrayBuffer ? data : data.buffer
    );
    
    // Check for gzip magic number (1f 8b)
    if (view.byteLength >= 2) {
      return view.getUint8(0) === 0x1f && view.getUint8(1) === 0x8b;
    }
    
    return false;
  }

  /**
   * Compress data
   */
  private async compress(data: Uint8Array): Promise<Uint8Array> {
    if (!this.capabilities.compressionSupported) {
      return data;
    }

    // Use compression worker if available
    if (this.compressionWorker) {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36);
        
        const handler = (e: MessageEvent) => {
          if (e.data.id === id) {
            this.compressionWorker!.removeEventListener('message', handler);
            if (e.data.success) {
              resolve(e.data.result);
            } else {
              reject(new Error(e.data.error));
            }
          }
        };
        
        this.compressionWorker.addEventListener('message', handler);
        this.compressionWorker.postMessage({
          id,
          action: 'compress',
          data,
          algorithm: this.negotiationResult?.compressionAlgorithm || 'gzip'
        });
      });
    }

    // Fallback to main thread compression
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(data);
    writer.close();
    
    const compressed: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      compressed.push(value);
    }
    
    // Concatenate chunks
    const totalLength = compressed.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of compressed) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  /**
   * Decompress data
   */
  private async decompress(data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
    if (!this.capabilities.compressionSupported) {
      return data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    }

    const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

    // Use compression worker if available
    if (this.compressionWorker) {
      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36);
        
        const handler = (e: MessageEvent) => {
          if (e.data.id === id) {
            this.compressionWorker!.removeEventListener('message', handler);
            if (e.data.success) {
              resolve(e.data.result);
            } else {
              reject(new Error(e.data.error));
            }
          }
        };
        
        this.compressionWorker.addEventListener('message', handler);
        this.compressionWorker.postMessage({
          id,
          action: 'decompress',
          data: input,
          algorithm: this.negotiationResult?.compressionAlgorithm || 'gzip'
        });
      });
    }

    // Fallback to main thread decompression
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(input);
    writer.close();
    
    const decompressed: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      decompressed.push(value);
    }
    
    // Concatenate chunks
    const totalLength = decompressed.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of decompressed) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }

  /**
   * Record performance sample
   */
  private recordPerformanceSample(protocol: Protocol, sample: PerformanceSample): void {
    const samples = this.performanceSamples.get(protocol);
    if (!samples) return;
    
    samples.push(sample);
    
    // Keep only last 1000 samples
    if (samples.length > 1000) {
      samples.shift();
    }
  }

  /**
   * Update metrics for all protocols
   */
  private updateMetrics(): void {
    const updatedMetrics: ProtocolMetrics[] = [];
    
    for (const [protocol, samples] of this.performanceSamples) {
      if (samples.length === 0) continue;
      
      const metrics = this.calculateMetrics(protocol, samples);
      this.metrics.set(protocol, metrics);
      updatedMetrics.push(metrics);
    }
    
    if (updatedMetrics.length > 0) {
      this.emit('metrics:updated', updatedMetrics);
    }
  }

  /**
   * Calculate metrics from samples
   */
  private calculateMetrics(protocol: Protocol, samples: PerformanceSample[]): ProtocolMetrics {
    const encodingTimes = samples
      .filter(s => s.encodingTime > 0)
      .map(s => s.encodingTime)
      .sort((a, b) => a - b);
    
    const decodingTimes = samples
      .filter(s => s.decodingTime > 0)
      .map(s => s.decodingTime)
      .sort((a, b) => a - b);
    
    const errorCount = samples.filter(s => s.error).length;
    const totalBytes = samples.reduce((sum, s) => sum + s.messageSize, 0);
    
    // Calculate time window for throughput
    const timeWindow = samples.length > 0 ? 
      (samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000 : 1;
    
    return {
      protocol,
      messageCount: samples.length,
      totalBytes,
      averageMessageSize: totalBytes / samples.length,
      encodingTime: {
        min: Math.min(...encodingTimes) || 0,
        max: Math.max(...encodingTimes) || 0,
        average: this.average(encodingTimes),
        p95: this.percentile(encodingTimes, 0.95),
        p99: this.percentile(encodingTimes, 0.99)
      },
      decodingTime: {
        min: Math.min(...decodingTimes) || 0,
        max: Math.max(...decodingTimes) || 0,
        average: this.average(decodingTimes),
        p95: this.percentile(decodingTimes, 0.95),
        p99: this.percentile(decodingTimes, 0.99)
      },
      compressionRatio: this.calculateCompressionRatio(samples),
      throughput: samples.length / timeWindow,
      errorRate: errorCount / samples.length,
      lastUpdated: Date.now()
    };
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(samples: PerformanceSample[]): number {
    const compressedSamples = samples.filter(s => s.compressed);
    if (compressedSamples.length === 0) return 1;
    
    // This is a simplified calculation
    // In reality, we'd need to track uncompressed size separately
    return 0.7; // Assume 30% compression on average
  }

  /**
   * Generate protocol recommendation
   */
  private generateRecommendation(): ProtocolRecommendation | null {
    const currentMetrics = this.metrics.get(this.currentProtocol);
    if (!currentMetrics || currentMetrics.messageCount < 100) {
      return null; // Not enough data
    }

    let bestProtocol = this.currentProtocol;
    let bestScore = this.calculateProtocolScore(currentMetrics);
    let reason = '';
    
    for (const [protocol, metrics] of this.metrics) {
      if (protocol === this.currentProtocol || metrics.messageCount < 50) {
        continue;
      }
      
      const score = this.calculateProtocolScore(metrics);
      if (score > bestScore * 1.2) { // 20% improvement threshold
        bestProtocol = protocol;
        bestScore = score;
        reason = this.getRecommendationReason(currentMetrics, metrics);
      }
    }
    
    if (bestProtocol === this.currentProtocol) {
      return null;
    }
    
    const bestMetrics = this.metrics.get(bestProtocol)!;
    
    return {
      currentProtocol: this.currentProtocol,
      recommendedProtocol: bestProtocol,
      reason,
      confidence: Math.min(0.9, bestMetrics.messageCount / 1000),
      potentialImprovement: {
        latency: ((currentMetrics.encodingTime.average - bestMetrics.encodingTime.average) / 
                  currentMetrics.encodingTime.average) * 100,
        throughput: ((bestMetrics.throughput - currentMetrics.throughput) / 
                     currentMetrics.throughput) * 100,
        size: ((currentMetrics.averageMessageSize - bestMetrics.averageMessageSize) / 
               currentMetrics.averageMessageSize) * 100
      }
    };
  }

  /**
   * Calculate protocol score
   */
  private calculateProtocolScore(metrics: ProtocolMetrics): number {
    // Weight different factors
    const latencyWeight = 0.3;
    const throughputWeight = 0.3;
    const sizeWeight = 0.2;
    const errorWeight = 0.2;
    
    // Normalize values (lower is better for latency and size)
    const latencyScore = 1 / (1 + metrics.encodingTime.average + metrics.decodingTime.average);
    const throughputScore = metrics.throughput;
    const sizeScore = 1 / (1 + metrics.averageMessageSize);
    const errorScore = 1 - metrics.errorRate;
    
    return (
      latencyScore * latencyWeight +
      throughputScore * throughputWeight +
      sizeScore * sizeWeight +
      errorScore * errorWeight
    );
  }

  /**
   * Get recommendation reason
   */
  private getRecommendationReason(
    current: ProtocolMetrics, 
    recommended: ProtocolMetrics
  ): string {
    const reasons: string[] = [];
    
    if (recommended.encodingTime.average < current.encodingTime.average * 0.8) {
      reasons.push('faster encoding');
    }
    
    if (recommended.throughput > current.throughput * 1.2) {
      reasons.push('higher throughput');
    }
    
    if (recommended.averageMessageSize < current.averageMessageSize * 0.8) {
      reasons.push('smaller message size');
    }
    
    if (recommended.errorRate < current.errorRate * 0.5) {
      reasons.push('lower error rate');
    }
    
    return reasons.join(', ');
  }

  /**
   * Get recommended protocol for message type
   */
  getRecommendedProtocol(message: WebSocketMessage): Protocol {
    // Check message type hints
    const hintedProtocol = this.preferences.messageTypeHints.get(message.type);
    if (hintedProtocol && this.capabilities.supportedProtocols.includes(hintedProtocol)) {
      return hintedProtocol;
    }
    
    // Use SerializerFactory recommendation
    return SerializerFactory.recommendProtocol(message);
  }

  /**
   * Get all protocol metrics
   */
  getMetrics(): Map<Protocol, ProtocolMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics for specific protocol
   */
  getProtocolMetrics(protocol: Protocol): ProtocolMetrics | undefined {
    return this.metrics.get(protocol);
  }

  /**
   * Get capabilities
   */
  getCapabilities(): ProtocolCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<ProtocolPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Store protocol preference
   */
  storePreference(messageType: MessageType, protocol: Protocol): void {
    this.preferences.messageTypeHints.set(messageType, protocol);
    
    // Persist to localStorage if available
    if (typeof localStorage !== 'undefined') {
      const hints = Array.from(this.preferences.messageTypeHints.entries());
      localStorage.setItem('ws-protocol-hints', JSON.stringify(hints));
    }
  }

  /**
   * Load stored preferences
   */
  loadStoredPreferences(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('ws-protocol-hints');
      if (stored) {
        const hints = JSON.parse(stored) as Array<[MessageType, Protocol]>;
        this.preferences.messageTypeHints = new Map(hints);
      }
    } catch (error) {
      console.error('Failed to load protocol preferences:', error);
    }
  }

  /**
   * Create WebSocket error
   */
  private createError(message: string, type: WebSocketError['type']): WebSocketError {
    const error = new Error(message) as WebSocketError;
    error.code = 'PROTOCOL_MANAGER_ERROR';
    error.type = type;
    error.recoverable = true;
    error.timestamp = Date.now();
    return error;
  }

  /**
   * Export metrics as CSV
   */
  exportMetrics(): string {
    const headers = [
      'Protocol',
      'Messages',
      'Total Bytes',
      'Avg Size',
      'Encoding Min',
      'Encoding Avg',
      'Encoding P95',
      'Decoding Min',
      'Decoding Avg', 
      'Decoding P95',
      'Throughput',
      'Error Rate'
    ];
    
    const rows: string[] = [headers.join(',')];
    
    for (const metrics of this.metrics.values()) {
      const row = [
        metrics.protocol,
        metrics.messageCount,
        metrics.totalBytes,
        metrics.averageMessageSize.toFixed(2),
        metrics.encodingTime.min.toFixed(2),
        metrics.encodingTime.average.toFixed(2),
        metrics.encodingTime.p95.toFixed(2),
        metrics.decodingTime.min.toFixed(2),
        metrics.decodingTime.average.toFixed(2),
        metrics.decodingTime.p95.toFixed(2),
        metrics.throughput.toFixed(2),
        (metrics.errorRate * 100).toFixed(2) + '%'
      ];
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Destroy the protocol manager
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.recommendationInterval) {
      clearInterval(this.recommendationInterval);
    }
    
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }
    
    this.removeAllListeners();
    this.metrics.clear();
    this.performanceSamples.clear();
    this.serializers.clear();
  }
}

// Types are already exported above, no need to re-export