/**
 * Optimized Telemetry Client for High-Performance WebSocket Communication
 * Targets <50ms response time and 200Hz telemetry updates
 */

import { io, Socket } from 'socket.io-client';
import pako from 'pako';
import msgpack from 'msgpack-lite';

export interface TelemetryBatch {
  batch_id: string;
  timestamp: number;
  message_count: number;
  compression: 'none' | 'zlib' | 'lz4';
  data: string; // hex-encoded compressed data
}

export interface PerformanceMetrics {
  total_messages: number;
  total_bytes_received: number;
  average_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  message_rate_hz: number;
  decompression_time_ms: number;
  processing_time_ms: number;
  dropped_messages: number;
  last_update: number;
}

export interface OptimizedClientConfig {
  url: string;
  targetFrequency: number;
  maxLatency: number;
  enableCompression: boolean;
  enableBatching: boolean;
  bufferSize: number;
  reconnectAttempts: number;
  debug: boolean;
}

export interface TelemetryCallback {
  (data: any[], timestamp: number, latency: number): void;
}

export interface PerformanceCallback {
  (metrics: PerformanceMetrics): void;
}

const DEFAULT_CONFIG: OptimizedClientConfig = {
  url: 'ws://localhost:8000',
  targetFrequency: 200,
  maxLatency: 50,
  enableCompression: true,
  enableBatching: true,
  bufferSize: 1000,
  reconnectAttempts: 10,
  debug: false
};

export class OptimizedTelemetryClient {
  private socket: Socket | null = null;
  private config: OptimizedClientConfig;
  private isConnected = false;
  private connectionId: string | null = null;
  
  // Performance tracking
  private metrics: PerformanceMetrics = {
    total_messages: 0,
    total_bytes_received: 0,
    average_latency_ms: 0,
    p95_latency_ms: 0,
    p99_latency_ms: 0,
    message_rate_hz: 0,
    decompression_time_ms: 0,
    processing_time_ms: 0,
    dropped_messages: 0,
    last_update: Date.now()
  };
  
  private latencySamples: number[] = [];
  private messageTimestamps = new Map<string, number>();
  private lastMessageTime = 0;
  private messageCount = 0;
  
  // Data buffering
  private telemetryBuffer: any[] = [];
  private maxBufferSize: number;
  
  // Event handlers
  private telemetryCallbacks: TelemetryCallback[] = [];
  private performanceCallbacks: PerformanceCallback[] = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  
  // Background tasks
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private latencyTestInterval: NodeJS.Timeout | null = null;
  
  constructor(config: Partial<OptimizedClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.maxBufferSize = this.config.bufferSize;
    
    if (this.config.debug) {
      console.log('OptimizedTelemetryClient initialized with config:', this.config);
    }
  }
  
  async connect(): Promise<void> {
    if (this.isConnected) {
      throw new Error('Already connected');
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
      
      this.socket = io(this.config.url, {
        transports: ['websocket'], // Force WebSocket for best performance
        upgrade: false,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.config.reconnectAttempts,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        auth: {
          protocols: ['msgpack', 'binary', 'json'],
          client_type: 'optimized_telemetry'
        }
      });
      
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.connectionId = this.socket?.id || null;
        
        this.setupEventHandlers();
        this.startPerformanceMonitoring();
        
        if (this.config.debug) {
          console.log('OptimizedTelemetryClient connected:', this.connectionId);
        }
        
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this.handleError(new Error(`Connection failed: ${error.message}`));
        reject(error);
      });
    });
  }
  
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    // Handle optimized connection acknowledgment
    this.socket.on('connected', (data) => {
      if (this.config.debug) {
        console.log('Server connection details:', data);
      }
      
      // Subscribe to telemetry with optimal settings
      this.subscribeTelemetry();
    });
    
    // Handle batched telemetry data
    this.socket.on('telemetry_batch', (batch: TelemetryBatch) => {
      this.processTelemetryBatch(batch);
    });
    
    // Handle individual telemetry messages (fallback)
    this.socket.on('telemetry', (data) => {
      this.processTelemetryMessage(data);
    });
    
    // Handle binary messages
    this.socket.on('binary_message', (data: ArrayBuffer) => {
      this.processBinaryMessage(data);
    });
    
    // Handle latency responses
    this.socket.on('latency_response', (data) => {
      this.processLatencyResponse(data);
    });
    
    // Handle pong responses
    this.socket.on('pong', (data) => {
      if (data.latency_ms !== null && data.latency_ms !== undefined) {
        this.recordLatency(data.latency_ms);
      }
    });
    
    // Error handling
    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.connectionId = null;
      
      if (reason !== 'io client disconnect') {
        this.handleError(new Error(`Disconnected: ${reason}`));
      }
      
      this.stopPerformanceMonitoring();
    });
    
    this.socket.on('error', (error) => {
      this.handleError(new Error(`Socket error: ${error}`));
    });
  }
  
  private async subscribeTelemetry(): Promise<void> {
    if (!this.socket) return;
    
    const subscription = {
      channels: ['telemetry'],
      frequency: this.config.targetFrequency,
      filters: {},
      enable_batching: this.config.enableBatching
    };
    
    return new Promise((resolve, reject) => {
      this.socket!.emit('subscribe_telemetry', subscription, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          if (this.config.debug) {
            console.log('Telemetry subscription confirmed:', response);
          }
          resolve();
        }
      });
    });
  }
  
  private async processTelemetryBatch(batch: TelemetryBatch): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Decode hex data
      const compressedData = this.hexToBytes(batch.data);
      
      // Decompress if needed
      let decompressedData: Uint8Array;
      const decompressStart = performance.now();
      
      switch (batch.compression) {
        case 'zlib':
          decompressedData = pako.inflate(compressedData);
          break;
        case 'lz4':
          // Note: LZ4 decompression would need a separate library
          // For now, fall back to no compression
          decompressedData = compressedData;
          break;
        default:
          decompressedData = compressedData;
      }
      
      const decompressTime = performance.now() - decompressStart;
      
      // Parse batch format: message_count(4) + total_size(4) + messages
      const dataView = new DataView(decompressedData.buffer);
      let offset = 0;
      
      const messageCount = dataView.getUint32(offset, true); // little-endian
      offset += 4;
      const totalSize = dataView.getUint32(offset, true);
      offset += 4;
      
      const messages: any[] = [];
      
      // Parse individual messages
      for (let i = 0; i < messageCount; i++) {
        if (offset >= decompressedData.length) break;
        
        // Read message: timestamp(8) + priority(1) + data_size(4) + data
        const timestamp = dataView.getFloat64(offset, true);
        offset += 8;
        
        const priority = dataView.getUint8(offset);
        offset += 1;
        
        const dataSize = dataView.getUint32(offset, true);
        offset += 4;
        
        if (offset + dataSize > decompressedData.length) break;
        
        // Extract message data
        const messageData = decompressedData.slice(offset, offset + dataSize);
        offset += dataSize;
        
        // Parse JSON data
        try {
          const messageText = new TextDecoder().decode(messageData);
          const parsedData = JSON.parse(messageText);
          messages.push({
            ...parsedData,
            timestamp,
            priority,
            batch_id: batch.batch_id
          });
        } catch (e) {
          if (this.config.debug) {
            console.warn('Failed to parse message in batch:', e);
          }
        }
      }
      
      // Update metrics
      this.metrics.total_messages += messageCount;
      this.metrics.total_bytes_received += compressedData.length;
      this.metrics.decompression_time_ms = decompressTime;
      
      // Calculate processing latency
      const processingTime = performance.now() - startTime;
      this.metrics.processing_time_ms = processingTime;
      
      // Calculate approximate network latency
      const networkLatency = (Date.now() - batch.timestamp * 1000);
      this.recordLatency(networkLatency);
      
      // Buffer messages
      this.addToBuffer(messages);
      
      // Trigger callbacks
      this.triggerTelemetryCallbacks(messages, batch.timestamp, networkLatency);
      
    } catch (error) {
      this.handleError(new Error(`Batch processing failed: ${error}`));
      this.metrics.dropped_messages += 1;
    }
  }
  
  private processTelemetryMessage(data: any): void {
    const networkLatency = data.server_timestamp ? 
      (Date.now() - data.server_timestamp * 1000) : 0;
    
    this.metrics.total_messages += 1;
    this.recordLatency(networkLatency);
    
    this.addToBuffer([data]);
    this.triggerTelemetryCallbacks([data], Date.now() / 1000, networkLatency);
  }
  
  private async processBinaryMessage(data: ArrayBuffer): Promise<void> {
    try {
      // Attempt to decode as MessagePack
      const uint8Data = new Uint8Array(data);
      const decoded = msgpack.decode(uint8Data);
      
      this.metrics.total_messages += 1;
      this.metrics.total_bytes_received += data.byteLength;
      
      this.addToBuffer([decoded]);
      this.triggerTelemetryCallbacks([decoded], Date.now() / 1000, 0);
      
    } catch (error) {
      this.handleError(new Error(`Binary message decode failed: ${error}`));
    }
  }
  
  private processLatencyResponse(data: any): void {
    if (data.message_id && this.messageTimestamps.has(data.message_id)) {
      const sendTime = this.messageTimestamps.get(data.message_id)!;
      const latency = performance.now() - sendTime;
      
      this.recordLatency(latency);
      this.messageTimestamps.delete(data.message_id);
    }
  }
  
  private recordLatency(latencyMs: number): void {
    this.latencySamples.push(latencyMs);
    
    // Keep only recent samples
    if (this.latencySamples.length > 100) {
      this.latencySamples = this.latencySamples.slice(-100);
    }
    
    // Update metrics
    if (this.latencySamples.length > 0) {
      this.metrics.average_latency_ms = this.latencySamples.reduce((a, b) => a + b) / this.latencySamples.length;
      
      const sorted = [...this.latencySamples].sort((a, b) => a - b);
      this.metrics.p95_latency_ms = sorted[Math.floor(sorted.length * 0.95)];
      this.metrics.p99_latency_ms = sorted[Math.floor(sorted.length * 0.99)];
    }
  }
  
  private addToBuffer(messages: any[]): void {
    this.telemetryBuffer.push(...messages);
    
    // Trim buffer to max size
    if (this.telemetryBuffer.length > this.maxBufferSize) {
      const excess = this.telemetryBuffer.length - this.maxBufferSize;
      this.telemetryBuffer.splice(0, excess);
      this.metrics.dropped_messages += excess;
    }
  }
  
  private triggerTelemetryCallbacks(messages: any[], timestamp: number, latency: number): void {
    for (const callback of this.telemetryCallbacks) {
      try {
        callback(messages, timestamp, latency);
      } catch (error) {
        this.handleError(new Error(`Telemetry callback failed: ${error}`));
      }
    }
  }
  
  private startPerformanceMonitoring(): void {
    // Update metrics every second
    this.metricsUpdateInterval = setInterval(() => {
      this.updateMetrics();
    }, 1000);
    
    // Send latency test every 5 seconds
    this.latencyTestInterval = setInterval(() => {
      this.sendLatencyTest();
    }, 5000);
  }
  
  private stopPerformanceMonitoring(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }
    
    if (this.latencyTestInterval) {
      clearInterval(this.latencyTestInterval);
      this.latencyTestInterval = null;
    }
  }
  
  private updateMetrics(): void {
    const now = Date.now();
    const timeDiff = (now - this.metrics.last_update) / 1000;
    
    if (timeDiff > 0) {
      const newMessages = this.messageCount - this.metrics.total_messages;
      this.metrics.message_rate_hz = newMessages / timeDiff;
    }
    
    this.metrics.last_update = now;
    
    // Trigger performance callbacks
    for (const callback of this.performanceCallbacks) {
      try {
        callback({ ...this.metrics });
      } catch (error) {
        this.handleError(new Error(`Performance callback failed: ${error}`));
      }
    }
  }
  
  private sendLatencyTest(): void {
    if (!this.socket || !this.isConnected) return;
    
    const messageId = `latency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = performance.now();
    
    this.messageTimestamps.set(messageId, timestamp);
    
    this.socket.emit('latency_test', {
      message_id: messageId,
      timestamp: Date.now() / 1000
    });
    
    // Clean up old timestamps
    const cutoff = timestamp - 30000; // 30 seconds
    for (const [id, time] of this.messageTimestamps.entries()) {
      if (time < cutoff) {
        this.messageTimestamps.delete(id);
      }
    }
  }
  
  private handleError(error: Error): void {
    if (this.config.debug) {
      console.error('OptimizedTelemetryClient error:', error);
    }
    
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        console.error('Error callback failed:', e);
      }
    }
  }
  
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
  
  // Public API
  
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.connectionId = null;
    this.stopPerformanceMonitoring();
  }
  
  onTelemetry(callback: TelemetryCallback): () => void {
    this.telemetryCallbacks.push(callback);
    return () => {
      const index = this.telemetryCallbacks.indexOf(callback);
      if (index >= 0) {
        this.telemetryCallbacks.splice(index, 1);
      }
    };
  }
  
  onPerformanceUpdate(callback: PerformanceCallback): () => void {
    this.performanceCallbacks.push(callback);
    return () => {
      const index = this.performanceCallbacks.indexOf(callback);
      if (index >= 0) {
        this.performanceCallbacks.splice(index, 1);
      }
    };
  }
  
  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index >= 0) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }
  
  getLatestData(count = 100): any[] {
    return this.telemetryBuffer.slice(-count);
  }
  
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  isConnectedToServer(): boolean {
    return this.isConnected;
  }
  
  getConnectionId(): string | null {
    return this.connectionId;
  }
  
  clearBuffer(): void {
    this.telemetryBuffer = [];
  }
  
  // Force a ping to measure current latency
  async measureLatency(): Promise<number> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected');
    }
    
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const timeout = setTimeout(() => {
        reject(new Error('Latency measurement timeout'));
      }, 5000);
      
      this.socket!.emit('ping', { timestamp: Date.now() / 1000 }, () => {
        clearTimeout(timeout);
        const latency = performance.now() - startTime;
        resolve(latency);
      });
    });
  }
}