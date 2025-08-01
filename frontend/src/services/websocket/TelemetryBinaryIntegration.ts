/**
 * Telemetry Binary Integration
 * Integration layer between existing telemetry infrastructure and new binary serialization system
 * Provides backward compatibility while enabling high-performance binary serialization
 */

import { WebSocketTelemetryClient, TelemetryClientConfig } from './WebSocketTelemetryClient';
import { TelemetryManager, TelemetryDataPoint, TelemetryDataType } from './TelemetryManager';
import { 
  telemetrySerializer, 
  TelemetrySerializationManager,
  SerializerFactory,
  SchemaRegistry,
  CompressionType,
  TelemetrySerializationOptions
} from './BinarySerializer';
import { Protocol, MessageType, Priority } from './types';

/**
 * Enhanced telemetry configuration with binary serialization support
 */
export interface BinaryTelemetryConfig extends TelemetryClientConfig {
  binarySerialization: {
    enabled: boolean;
    autoProtocolSelection: boolean;      // Automatically select optimal protocol per data type
    compressionEnabled: boolean;          // Enable compression for large payloads
    fallbackToJson: boolean;             // Fall back to JSON if binary fails
    performanceMonitoring: boolean;       // Monitor serialization performance
    schemaValidation: boolean;           // Validate data against schemas
    precisionOptimization: boolean;      // Optimize numeric precision
    batchSerialization: boolean;         // Enable batch serialization for multiple points
    debugMode: boolean;                  // Enable debug logging for serialization
  };
}

/**
 * Binary telemetry event data
 */
export interface BinaryTelemetryEvent {
  streamId: string;
  dataType: TelemetryDataType;
  protocol: Protocol;
  compressed: boolean;
  originalSize: number;
  serializedSize: number;
  serializationTime: number;
  compressionRatio: number;
}

/**
 * Enhanced WebSocket Telemetry Client with Binary Serialization
 * Extends the existing telemetry client to support high-performance binary protocols
 */
export class BinaryWebSocketTelemetryClient extends WebSocketTelemetryClient {
  private binaryConfig: BinaryTelemetryConfig['binarySerialization'];
  private serializationManager: TelemetrySerializationManager;
  private performanceMetrics = new Map<string, { 
    totalTime: number; 
    operations: number; 
    compressionRatio: number;
    protocol: Protocol;
  }>();

  constructor(config: BinaryTelemetryConfig) {
    super(config);
    
    this.binaryConfig = config.binarySerialization;
    this.serializationManager = TelemetrySerializationManager.getInstance();
    
    // Initialize serialization system
    if (this.binaryConfig.enabled) {
      this.initializeBinarySerialization();
    }
  }

  /**
   * Initialize binary serialization system
   */
  private initializeBinarySerialization(): void {
    // Initialize the serialization manager
    this.serializationManager.initialize();
    
    // Enable performance monitoring if requested
    if (this.binaryConfig.performanceMonitoring) {
      this.setupPerformanceMonitoring();
    }
    
    // Set up compression defaults
    if (this.binaryConfig.compressionEnabled) {
      this.setupCompressionOptimization();
    }
    
    console.log('Binary telemetry serialization initialized', {
      autoProtocolSelection: this.binaryConfig.autoProtocolSelection,
      compressionEnabled: this.binaryConfig.compressionEnabled,
      schemaValidation: this.binaryConfig.schemaValidation
    });
  }

  /**
   * Enhanced telemetry data sending with binary serialization
   */
  async sendTelemetryData(
    streamId: string, 
    data: TelemetryDataPoint,
    dataType: TelemetryDataType,
    options?: Partial<TelemetrySerializationOptions>
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Use binary serialization if enabled
      if (this.binaryConfig.enabled) {
        const result = await this.serializeBinaryTelemetry(data, dataType, options);
        
        // Send as binary message
        await this.sendBinaryMessage(streamId, result.data, {
          protocol: result.protocol,
          compressed: result.compressed,
          metadata: {
            dataType,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize
          }
        });
        
        // Emit binary telemetry event
        this.emit('binaryTelemetry', {
          streamId,
          dataType,
          protocol: result.protocol,
          compressed: result.compressed,
          originalSize: result.originalSize,
          serializedSize: result.compressedSize,
          serializationTime: performance.now() - startTime,
          compressionRatio: result.compressedSize / result.originalSize
        } as BinaryTelemetryEvent);
      } else {
        // Fall back to standard JSON telemetry
        await this.sendMessage(MessageType.TELEMETRY, {
          streamId,
          data,
          dataType
        }, Priority.NORMAL);
      }
      
      // Record performance metrics
      this.recordTelemetryMetric(streamId, performance.now() - startTime, dataType);
      
    } catch (error) {
      console.error('Failed to send telemetry data:', error);
      
      // Fall back to JSON if binary fails and fallback is enabled
      if (this.binaryConfig.fallbackToJson) {
        await this.sendMessage(MessageType.TELEMETRY, {
          streamId,
          data,
          dataType
        }, Priority.NORMAL);
      } else {
        throw error;
      }
    }
  }

  /**
   * Batch send multiple telemetry data points
   */
  async sendTelemetryBatch(
    batch: Array<{ streamId: string; data: TelemetryDataPoint; dataType: TelemetryDataType }>,
    options?: Partial<TelemetrySerializationOptions>
  ): Promise<void> {
    if (!this.binaryConfig.enabled || !this.binaryConfig.batchSerialization) {
      // Send individually if batch serialization is disabled
      for (const item of batch) {
        await this.sendTelemetryData(item.streamId, item.data, item.dataType, options);
      }
      return;
    }

    const startTime = performance.now();
    
    try {
      // Serialize the entire batch
      const serializedBatch = await this.serializationManager.serializeBatch(
        batch.map(item => ({ data: item.data, dataType: item.dataType })),
        options
      );
      
      // Send as single binary message
      await this.sendBinaryMessage('telemetry_batch', serializedBatch, {
        protocol: Protocol.MESSAGEPACK, // Default for batch
        compressed: true,
        metadata: {
          batchSize: batch.length,
          totalSize: serializedBatch.byteLength
        }
      });
      
      console.log(`Sent telemetry batch: ${batch.length} items, ${serializedBatch.byteLength} bytes`);
      
    } catch (error) {
      console.error('Failed to send telemetry batch:', error);
      
      // Fall back to individual sends
      if (this.binaryConfig.fallbackToJson) {
        for (const item of batch) {
          await this.sendTelemetryData(item.streamId, item.data, item.dataType, options);
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Serialize telemetry data using binary protocols
   */
  private async serializeBinaryTelemetry(
    data: TelemetryDataPoint,
    dataType: TelemetryDataType,
    customOptions?: Partial<TelemetrySerializationOptions>
  ): Promise<{
    data: ArrayBuffer;
    protocol: Protocol;
    compressed: boolean;
    originalSize: number;
    compressedSize: number;
  }> {
    // Configure serialization options
    const options: Partial<TelemetrySerializationOptions> = {
      schemaValidation: this.binaryConfig.schemaValidation,
      compress: this.binaryConfig.compressionEnabled,
      fallbackToJson: this.binaryConfig.fallbackToJson,
      ...customOptions
    };
    
    // Add precision optimization if enabled
    if (this.binaryConfig.precisionOptimization) {
      options.precision = this.getOptimalPrecision(dataType);
    }
    
    return await this.serializationManager.serializeTelemetry(data, dataType, options);
  }

  /**
   * Send binary message with metadata
   */
  private async sendBinaryMessage(
    streamId: string,
    data: ArrayBuffer,
    metadata: {
      protocol: Protocol;
      compressed: boolean;
      metadata?: any;
    }
  ): Promise<void> {
    // Create binary message wrapper
    const binaryMessage = {
      id: `binary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: MessageType.BINARY,
      payload: {
        streamId,
        data: new Uint8Array(data),
        protocol: metadata.protocol,
        compressed: metadata.compressed,
        timestamp: Date.now(),
        metadata: metadata.metadata
      },
      timestamp: Date.now(),
      protocol: Protocol.BINARY,
      compressed: metadata.compressed,
      acknowledged: false
    };
    
    // Send through WebSocket
    if (this.socket) {
      this.socket.emit('binary_telemetry', binaryMessage);
    }
  }

  /**
   * Handle incoming binary telemetry data
   */
  protected handleBinaryTelemetry(data: ArrayBuffer): void {
    if (!this.binaryConfig.enabled) {
      return;
    }

    this.deserializeBinaryTelemetry(data)
      .then(result => {
        // Process the deserialized telemetry data
        this.processTelemetryData(result.data, result.protocol);
      })
      .catch(error => {
        console.error('Failed to deserialize binary telemetry:', error);
        
        // Emit error event
        this.emit('error', {
          code: 'BINARY_DESERIALIZATION_ERROR',
          type: 'protocol',
          recoverable: true,
          timestamp: Date.now(),
          context: { error: error.message }
        });
      });
  }

  /**
   * Deserialize binary telemetry data
   */
  private async deserializeBinaryTelemetry(data: ArrayBuffer): Promise<{
    data: TelemetryDataPoint;
    protocol: Protocol;
    validated: boolean;
  }> {
    return await this.serializationManager.deserializeTelemetry(data, undefined, {
      validateSchema: this.binaryConfig.schemaValidation,
      fallbackToJson: this.binaryConfig.fallbackToJson
    });
  }

  /**
   * Process deserialized telemetry data
   */
  private processTelemetryData(data: TelemetryDataPoint, protocol: Protocol): void {
    // Add to telemetry manager
    if (this.telemetryManager) {
      // This would need to be integrated with the stream ID resolution
      // For now, we'll emit a generic telemetry event
      this.emit('telemetry:data', 'binary_stream', data);
    }
    
    if (this.binaryConfig.debugMode) {
      console.log('Processed binary telemetry data:', {
        protocol,
        timestamp: data.timestamp,
        dataSize: JSON.stringify(data).length
      });
    }
  }

  /**
   * Set up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor serialization performance every minute
    setInterval(() => {
      const stats = this.serializationManager.getPerformanceStats();
      console.log('Binary serialization performance:', stats);
      
      // Emit performance event for external monitoring
      this.emit('binaryPerformance', stats);
    }, 60000);
  }

  /**
   * Set up compression optimization
   */
  private setupCompressionOptimization(): void {
    // This could include dynamic compression threshold adjustment
    // based on network conditions and performance metrics
  }

  /**
   * Get optimal precision for data type
   */
  private getOptimalPrecision(dataType: TelemetryDataType): number | undefined {
    switch (dataType) {
      case TelemetryDataType.NUMERIC:
        return 6;
      case TelemetryDataType.VECTOR:
      case TelemetryDataType.MATRIX:
        return 4;
      default:
        return undefined;
    }
  }

  /**
   * Record telemetry performance metrics
   */
  private recordTelemetryMetric(streamId: string, time: number, dataType: TelemetryDataType): void {
    if (!this.performanceMetrics.has(streamId)) {
      this.performanceMetrics.set(streamId, {
        totalTime: 0,
        operations: 0,
        compressionRatio: 1.0,
        protocol: this.getOptimalProtocol(dataType)
      });
    }
    
    const metrics = this.performanceMetrics.get(streamId)!;
    metrics.totalTime += time;
    metrics.operations++;
  }

  /**
   * Get optimal protocol for data type
   */
  private getOptimalProtocol(dataType: TelemetryDataType): Protocol {
    if (!this.binaryConfig.autoProtocolSelection) {
      return Protocol.MESSAGEPACK; // Default
    }
    
    return SerializerFactory.getTelemetrySerializer(dataType).protocol;
  }

  /**
   * Get binary serialization performance metrics
   */
  getBinaryPerformanceMetrics(): Record<string, any> {
    const serializationStats = this.serializationManager.getPerformanceStats();
    const telemetryStats: Record<string, any> = {};
    
    for (const [streamId, metrics] of this.performanceMetrics) {
      telemetryStats[streamId] = {
        averageTime: metrics.totalTime / metrics.operations,
        operations: metrics.operations,
        protocol: metrics.protocol,
        compressionRatio: metrics.compressionRatio
      };
    }
    
    return {
      serialization: serializationStats,
      telemetry: telemetryStats,
      schemasRegistered: SchemaRegistry.getAllSchemas().size
    };
  }

  /**
   * Reset performance metrics
   */
  resetBinaryMetrics(): void {
    this.performanceMetrics.clear();
    this.serializationManager.resetStats();
  }

  /**
   * Enable/disable binary serialization at runtime
   */
  setBinarySerializationEnabled(enabled: boolean): void {
    this.binaryConfig.enabled = enabled;
    
    if (enabled && !this.serializationManager) {
      this.initializeBinarySerialization();
    }
    
    console.log(`Binary telemetry serialization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update compression settings
   */
  setCompressionSettings(enabled: boolean, threshold?: number): void {
    this.binaryConfig.compressionEnabled = enabled;
    
    console.log(`Compression ${enabled ? 'enabled' : 'disabled'}${threshold ? ` with threshold ${threshold}` : ''}`);
  }
}

/**
 * Utility function to create a binary telemetry client with sensible defaults
 */
export function createBinaryTelemetryClient(config: Partial<BinaryTelemetryConfig> = {}): BinaryWebSocketTelemetryClient {
  const defaultConfig: BinaryTelemetryConfig = {
    url: 'ws://localhost:8000/ws',
    reconnect: true,
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    reconnectDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 30000,
    heartbeatInterval: 30000,
    heartbeatTimeout: 5000,
    protocols: [Protocol.MESSAGEPACK, Protocol.CBOR, Protocol.JSON],
    compression: true,
    debug: false,
    auth: {
      enabled: false,
      tokenRefreshThreshold: 300,
      autoRefresh: true
    },
    queue: {
      maxSize: 1000,
      persistOffline: true,
      priorityEnabled: true
    },
    performance: {
      enableMetrics: true,
      metricsInterval: 5000,
      latencyThreshold: 100
    },
    telemetry: {
      maxChannels: 100,
      bufferSize: 1000,
      targetLatency: 50,
      batchSize: 10,
      adaptiveThrottling: true,
      priorityChannels: [],
      compressionThreshold: 10,
      memoryPoolSize: 10 * 1024 * 1024, // 10MB
      enableWebWorkers: false,
      diagnosticsInterval: 30000
    },
    binarySerialization: {
      enabled: true,
      autoProtocolSelection: true,
      compressionEnabled: true,
      fallbackToJson: true,
      performanceMonitoring: true,
      schemaValidation: true,
      precisionOptimization: true,
      batchSerialization: true,
      debugMode: false
    },
    ...config
  };
  
  return new BinaryWebSocketTelemetryClient(defaultConfig);
}

/**
 * Export types and utilities
 */
export {
  BinaryTelemetryConfig,
  BinaryTelemetryEvent,
  TelemetrySerializationOptions,
  CompressionType,
  Protocol,
  TelemetryDataType
};