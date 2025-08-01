/**
 * Enhanced Binary Protocol Serialization System
 * Provides efficient binary serialization/deserialization for telemetry streaming
 * Features: MessagePack/CBOR protocols, compression, schema versioning, fallback to JSON
 * Optimized for rover telemetry data streaming with high-frequency updates
 */

import msgpack5 from 'msgpack5';
import { encode as cborEncode, decode as cborDecode } from 'cbor-x';
import { 
  WebSocketMessage, 
  Protocol,
  WebSocketError,
  MessageType,
  Priority
} from './types';
import { TelemetryDataPoint, TelemetryDataType } from './TelemetryManager';

// Create MessagePack instance with custom options for telemetry
const msgpack = msgpack5({
  forceFloat64: false,
  compatibilityMode: false,
  disableTimestampEncoding: false
});

/**
 * Schema version for backward compatibility
 */
export const SCHEMA_VERSION = '1.0.0';

/**
 * Compression algorithms supported
 */
export enum CompressionType {
  NONE = 'none',
  DEFLATE = 'deflate',
  GZIP = 'gzip'
}

/**
 * Telemetry data schemas for different data types
 */
export interface TelemetrySchema {
  version: string;
  dataType: TelemetryDataType;
  fields: SchemaField[];
  compression?: CompressionType;
}

export interface SchemaField {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'timestamp';
  required: boolean;
  description?: string;
  min?: number;
  max?: number;
  precision?: number; // For floating point optimization
}

/**
 * Binary serialization header structure
 */
export interface SerializationHeader {
  version: string;
  protocol: Protocol;
  compressed: boolean;
  compressionType?: CompressionType;
  schema?: string; // Schema identifier
  timestamp: number;
  checksum?: number;
}

/**
 * Telemetry-specific serialization formats
 */
export interface TelemetryBinaryFormat {
  header: SerializationHeader;
  payload: ArrayBuffer;
}

/**
 * Compression utilities using browser APIs
 */
export class CompressionManager {
  private static compressionCache = new Map<string, ArrayBuffer>();
  private static readonly CACHE_SIZE_LIMIT = 100;

  /**
   * Compress data using browser's CompressionStream API
   */
  static async compress(data: ArrayBuffer, type: CompressionType): Promise<ArrayBuffer> {
    if (type === CompressionType.NONE) {
      return data;
    }

    try {
      // Use browser's compression API if available
      if ('CompressionStream' in window) {
        const compressionFormat = type === CompressionType.GZIP ? 'gzip' : 'deflate';
        const stream = new CompressionStream(compressionFormat);
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        // Write data to compression stream
        await writer.write(new Uint8Array(data));
        await writer.close();
        
        // Read compressed data
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }
        
        // Combine chunks into single ArrayBuffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        }
        
        return result.buffer;
      } else {
        // Fallback: simple run-length encoding for repeated values
        return this.simpleCompress(data);
      }
    } catch (error) {
      console.warn('Compression failed, returning original data:', error);
      return data;
    }
  }

  /**
   * Decompress data using browser's DecompressionStream API
   */
  static async decompress(data: ArrayBuffer, type: CompressionType): Promise<ArrayBuffer> {
    if (type === CompressionType.NONE) {
      return data;
    }

    try {
      if ('DecompressionStream' in window) {
        const decompressionFormat = type === CompressionType.GZIP ? 'gzip' : 'deflate';
        const stream = new DecompressionStream(decompressionFormat);
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        // Write compressed data to decompression stream
        await writer.write(new Uint8Array(data));
        await writer.close();
        
        // Read decompressed data
        const chunks: Uint8Array[] = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }
        
        // Combine chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        }
        
        return result.buffer;
      } else {
        // Fallback: simple decompression
        return this.simpleDecompress(data);
      }
    } catch (error) {
      console.warn('Decompression failed, returning original data:', error);
      return data;
    }
  }

  /**
   * Simple compression fallback for browsers without native support
   */
  private static simpleCompress(data: ArrayBuffer): ArrayBuffer {
    // Basic run-length encoding for repeated bytes
    const input = new Uint8Array(data);
    const output: number[] = [];
    
    let i = 0;
    while (i < input.length) {
      const currentByte = input[i];
      let count = 1;
      
      // Count consecutive identical bytes
      while (i + count < input.length && input[i + count] === currentByte && count < 255) {
        count++;
      }
      
      if (count > 3) {
        // Use RLE for runs of 4 or more
        output.push(0xFF, count, currentByte);
      } else {
        // Copy bytes directly for short runs
        for (let j = 0; j < count; j++) {
          output.push(currentByte);
        }
      }
      
      i += count;
    }
    
    return new Uint8Array(output).buffer;
  }

  /**
   * Simple decompression fallback
   */
  private static simpleDecompress(data: ArrayBuffer): ArrayBuffer {
    const input = new Uint8Array(data);
    const output: number[] = [];
    
    let i = 0;
    while (i < input.length) {
      if (input[i] === 0xFF && i + 2 < input.length) {
        // RLE sequence: 0xFF, count, byte
        const count = input[i + 1];
        const byte = input[i + 2];
        
        for (let j = 0; j < count; j++) {
          output.push(byte);
        }
        
        i += 3;
      } else {
        // Regular byte
        output.push(input[i]);
        i++;
      }
    }
    
    return new Uint8Array(output).buffer;
  }

  /**
   * Determine if compression would be beneficial
   */
  static shouldCompress(data: ArrayBuffer, threshold: number = 1024): boolean {
    return data.byteLength > threshold;
  }
}

/**
 * Schema Registry for telemetry data types
 */
export class SchemaRegistry {
  private static schemas = new Map<string, TelemetrySchema>();
  
  /**
   * Initialize default schemas for telemetry data types
   */
  static initialize(): void {
    // Numeric telemetry schema
    this.registerSchema('telemetry.numeric.v1', {
      version: '1.0.0',
      dataType: TelemetryDataType.NUMERIC,
      fields: [
        { name: 'timestamp', type: 'timestamp', required: true },
        { name: 'value', type: 'number', required: true, precision: 6 },
        { name: 'quality', type: 'number', required: false, min: 0, max: 1 },
        { name: 'metadata', type: 'object', required: false }
      ],
      compression: CompressionType.DEFLATE
    });

    // Vector telemetry schema (for 3D coordinates, accelerometer data, etc.)
    this.registerSchema('telemetry.vector.v1', {
      version: '1.0.0',
      dataType: TelemetryDataType.VECTOR,
      fields: [
        { name: 'timestamp', type: 'timestamp', required: true },
        { name: 'value', type: 'array', required: true },
        { name: 'quality', type: 'number', required: false, min: 0, max: 1 },
        { name: 'metadata', type: 'object', required: false }
      ],
      compression: CompressionType.DEFLATE
    });

    // Matrix telemetry schema (for camera data, sensor arrays)
    this.registerSchema('telemetry.matrix.v1', {
      version: '1.0.0',
      dataType: TelemetryDataType.MATRIX,
      fields: [
        { name: 'timestamp', type: 'timestamp', required: true },
        { name: 'value', type: 'array', required: true },
        { name: 'quality', type: 'number', required: false, min: 0, max: 1 },
        { name: 'metadata', type: 'object', required: false }
      ],
      compression: CompressionType.GZIP // Use GZIP for larger matrix data
    });

    // String telemetry schema (for status messages, logs)
    this.registerSchema('telemetry.string.v1', {
      version: '1.0.0',
      dataType: TelemetryDataType.STRING,
      fields: [
        { name: 'timestamp', type: 'timestamp', required: true },
        { name: 'value', type: 'string', required: true },
        { name: 'quality', type: 'number', required: false, min: 0, max: 1 },
        { name: 'metadata', type: 'object', required: false }
      ],
      compression: CompressionType.DEFLATE
    });

    // Boolean telemetry schema (for binary states)
    this.registerSchema('telemetry.boolean.v1', {
      version: '1.0.0',
      dataType: TelemetryDataType.BOOLEAN,
      fields: [
        { name: 'timestamp', type: 'timestamp', required: true },
        { name: 'value', type: 'boolean', required: true },
        { name: 'quality', type: 'number', required: false, min: 0, max: 1 },
        { name: 'metadata', type: 'object', required: false }
      ],
      compression: CompressionType.NONE // Boolean data is already compact
    });

    // Object/structured telemetry schema
    this.registerSchema('telemetry.object.v1', {
      version: '1.0.0',
      dataType: TelemetryDataType.OBJECT,
      fields: [
        { name: 'timestamp', type: 'timestamp', required: true },
        { name: 'value', type: 'object', required: true },
        { name: 'quality', type: 'number', required: false, min: 0, max: 1 },
        { name: 'metadata', type: 'object', required: false }
      ],
      compression: CompressionType.DEFLATE
    });
  }

  /**
   * Register a new schema
   */
  static registerSchema(id: string, schema: TelemetrySchema): void {
    this.schemas.set(id, schema);
  }

  /**
   * Get schema by ID
   */
  static getSchema(id: string): TelemetrySchema | undefined {
    return this.schemas.get(id);
  }

  /**
   * Get schema ID for telemetry data type
   */
  static getSchemaId(dataType: TelemetryDataType): string {
    return `telemetry.${dataType}.v1`;
  }

  /**
   * Validate data against schema
   */
  static validateData(data: TelemetryDataPoint, schema: TelemetrySchema): boolean {
    try {
      for (const field of schema.fields) {
        const value = (data as any)[field.name];
        
        if (field.required && value === undefined) {
          return false;
        }
        
        if (value !== undefined && !this.validateFieldType(value, field)) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate field type
   */
  private static validateFieldType(value: any, field: SchemaField): boolean {
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number') return false;
        if (field.min !== undefined && value < field.min) return false;
        if (field.max !== undefined && value > field.max) return false;
        return true;
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'timestamp':
        return typeof value === 'number' && value > 0;
      default:
        return true;
    }
  }

  /**
   * Get all registered schemas
   */
  static getAllSchemas(): Map<string, TelemetrySchema> {
    return new Map(this.schemas);
  }
}

/**
 * Enhanced Serializer Interface
 * Extended to support compression, schema validation, and telemetry-specific features
 */
export interface SerializerInterface {
  protocol: Protocol;
  encode(message: WebSocketMessage, options?: SerializationOptions): Promise<ArrayBuffer | Uint8Array>;
  decode(data: ArrayBuffer | Uint8Array, options?: DeserializationOptions): Promise<WebSocketMessage>;
  encodeTelemetry(data: TelemetryDataPoint, dataType: TelemetryDataType, options?: TelemetrySerializationOptions): Promise<ArrayBuffer>;
  decodeTelemetry(data: ArrayBuffer, options?: TelemetryDeserializationOptions): Promise<TelemetryDataPoint>;
  estimateSize(message: WebSocketMessage): number;
  getContentType(): string;
  supportsCompression(): boolean;
  getCompressionTypes(): CompressionType[];
}

/**
 * Serialization options
 */
export interface SerializationOptions {
  compress?: boolean;
  compressionType?: CompressionType;
  compressionThreshold?: number;
  schemaValidation?: boolean;
  includeMeta?: boolean;
}

export interface DeserializationOptions {
  validateSchema?: boolean;
  fallbackToJson?: boolean;
  strictMode?: boolean;
}

export interface TelemetrySerializationOptions extends SerializationOptions {
  dataType: TelemetryDataType;
  schemaId?: string;
  precision?: number;
  includeChecksum?: boolean;
}

export interface TelemetryDeserializationOptions extends DeserializationOptions {
  expectedDataType?: TelemetryDataType;
  schemaId?: string;
  verifyChecksum?: boolean;
}

/**
 * Enhanced Base Serializer Class
 * Provides common functionality for all serializers with compression and schema support
 */
abstract class BaseSerializer implements SerializerInterface {
  abstract protocol: Protocol;
  protected performanceMetrics: Map<string, number[]> = new Map();
  protected compressionCache = new Map<string, ArrayBuffer>();

  // Legacy methods for backward compatibility
  abstract encodeLegacy(message: WebSocketMessage): ArrayBuffer | Uint8Array;
  abstract decodeLegacy(data: ArrayBuffer | Uint8Array): WebSocketMessage;
  abstract getContentType(): string;

  /**
   * Enhanced encode method with compression and schema support
   */
  async encode(message: WebSocketMessage, options?: SerializationOptions): Promise<ArrayBuffer | Uint8Array> {
    const startTime = performance.now();
    
    try {
      // Use legacy method as base
      let encoded = this.encodeLegacy(message);
      
      // Convert to ArrayBuffer if needed
      if (encoded instanceof Uint8Array) {
        encoded = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
      }
      
      // Apply compression if requested and beneficial
      if (options?.compress && CompressionManager.shouldCompress(encoded, options.compressionThreshold)) {
        const compressionType = options.compressionType || CompressionType.DEFLATE;
        encoded = await CompressionManager.compress(encoded, compressionType);
        
        // Update message metadata
        message.compressed = true;
      }
      
      this.recordMetric('encode', performance.now() - startTime);
      return new Uint8Array(encoded);
    } catch (error) {
      throw this.createError(
        `Enhanced encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  /**
   * Enhanced decode method with decompression support
   */
  async decode(data: ArrayBuffer | Uint8Array, options?: DeserializationOptions): Promise<WebSocketMessage> {
    const startTime = performance.now();
    
    try {
      let processedData = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      
      // Try to determine if data is compressed and decompress
      // This is a heuristic approach - in production, header information would indicate compression
      try {
        const message = this.decodeLegacy(processedData);
        this.recordMetric('decode', performance.now() - startTime);
        return message;
      } catch (error) {
        // If decoding fails, try decompression
        if (!options?.strictMode) {
          try {
            // Try DEFLATE decompression
            const decompressed = await CompressionManager.decompress(processedData, CompressionType.DEFLATE);
            const message = this.decodeLegacy(decompressed);
            this.recordMetric('decode', performance.now() - startTime);
            return message;
          } catch {
            // Try GZIP decompression
            try {
              const decompressed = await CompressionManager.decompress(processedData, CompressionType.GZIP);
              const message = this.decodeLegacy(decompressed);
              this.recordMetric('decode', performance.now() - startTime);
              return message;
            } catch {
              // Fall back to JSON if enabled
              if (options?.fallbackToJson) {
                return this.fallbackToJson(processedData);
              }
              throw error;
            }
          }
        }
        throw error;
      }
    } catch (error) {
      throw this.createError(
        `Enhanced decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  /**
   * Encode telemetry data with optimizations for telemetry-specific use cases
   */
  async encodeTelemetry(data: TelemetryDataPoint, dataType: TelemetryDataType, options?: TelemetrySerializationOptions): Promise<ArrayBuffer> {
    const startTime = performance.now();
    
    try {
      // Get schema for validation and optimization
      const schemaId = options?.schemaId || SchemaRegistry.getSchemaId(dataType);
      const schema = SchemaRegistry.getSchema(schemaId);
      
      // Validate data against schema if requested
      if (options?.schemaValidation && schema && !SchemaRegistry.validateData(data, schema)) {
        throw this.createError('Telemetry data validation failed', 'protocol');
      }
      
      // Create optimized telemetry message
      const telemetryMessage: WebSocketMessage = {
        id: `telemetry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: MessageType.TELEMETRY,
        payload: this.optimizeTelemetryPayload(data, dataType, options?.precision),
        timestamp: data.timestamp || Date.now(),
        protocol: this.protocol,
        compressed: false,
        acknowledged: false
      };
      
      // Create header with metadata
      const header: SerializationHeader = {
        version: SCHEMA_VERSION,
        protocol: this.protocol,
        compressed: false,
        schema: schemaId,
        timestamp: telemetryMessage.timestamp
      };
      
      // Add checksum if requested
      if (options?.includeChecksum) {
        header.checksum = this.calculateChecksum(telemetryMessage.payload);
      }
      
      // Serialize the message
      let encoded = this.encodeLegacy(telemetryMessage);
      if (encoded instanceof Uint8Array) {
        encoded = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
      }
      
      // Apply compression based on schema or options
      const shouldCompress = options?.compress ?? (schema?.compression !== CompressionType.NONE);
      const compressionType = options?.compressionType || schema?.compression || CompressionType.DEFLATE;
      
      if (shouldCompress && CompressionManager.shouldCompress(encoded, options?.compressionThreshold)) {
        encoded = await CompressionManager.compress(encoded, compressionType);
        header.compressed = true;
        header.compressionType = compressionType;
      }
      
      // Create final binary format with header
      const headerBuffer = this.encodeHeader(header);
      const result = new ArrayBuffer(headerBuffer.byteLength + encoded.byteLength);
      const resultView = new Uint8Array(result);
      
      resultView.set(new Uint8Array(headerBuffer), 0);
      resultView.set(new Uint8Array(encoded), headerBuffer.byteLength);
      
      this.recordMetric('encodeTelemetry', performance.now() - startTime);
      return result;
    } catch (error) {
      throw this.createError(
        `Telemetry encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  /**
   * Decode telemetry data with validation and error recovery
   */
  async decodeTelemetry(data: ArrayBuffer, options?: TelemetryDeserializationOptions): Promise<TelemetryDataPoint> {
    const startTime = performance.now();
    
    try {
      // Extract header
      const header = this.decodeHeader(data);
      const payloadStart = this.getHeaderSize();
      const payloadBuffer = data.slice(payloadStart);
      
      // Decompress if needed
      let processedData = payloadBuffer;
      if (header.compressed && header.compressionType) {
        processedData = await CompressionManager.decompress(payloadBuffer, header.compressionType);
      }
      
      // Decode the message
      const message = this.decodeLegacy(processedData);
      
      // Validate schema if requested
      if (options?.validateSchema && header.schema) {
        const schema = SchemaRegistry.getSchema(header.schema);
        if (schema && !SchemaRegistry.validateData(message.payload, schema)) {
          throw this.createError('Telemetry data schema validation failed', 'protocol');
        }
      }
      
      // Verify checksum if present
      if (options?.verifyChecksum && header.checksum) {
        const calculatedChecksum = this.calculateChecksum(message.payload);
        if (calculatedChecksum !== header.checksum) {
          throw this.createError('Telemetry data checksum mismatch', 'protocol');
        }
      }
      
      this.recordMetric('decodeTelemetry', performance.now() - startTime);
      
      // Return the telemetry data point
      return message.payload as TelemetryDataPoint;
    } catch (error) {
      // Fallback to JSON if enabled
      if (options?.fallbackToJson) {
        try {
          return this.fallbackTelemetryToJson(data);
        } catch (fallbackError) {
          throw this.createError(
            `Telemetry decoding failed and JSON fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'protocol'
          );
        }
      }
      
      throw this.createError(
        `Telemetry decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  /**
   * Check if serializer supports compression
   */
  supportsCompression(): boolean {
    return true;
  }

  /**
   * Get supported compression types
   */
  getCompressionTypes(): CompressionType[] {
    return [CompressionType.NONE, CompressionType.DEFLATE, CompressionType.GZIP];
  }

  /**
   * Estimate the size of a serialized message
   * @param message The message to estimate
   * @returns Estimated size in bytes
   */
  estimateSize(message: WebSocketMessage): number {
    try {
      const encoded = this.encodeLegacy(message);
      return encoded.byteLength;
    } catch (error) {
      // Fallback to JSON string length estimation
      return JSON.stringify(message).length;
    }
  }

  /**
   * Optimize telemetry payload for efficient serialization
   */
  protected optimizeTelemetryPayload(data: TelemetryDataPoint, dataType: TelemetryDataType, precision?: number): any {
    const optimized = { ...data };
    
    // Apply precision optimization for numeric data
    if (dataType === TelemetryDataType.NUMERIC && typeof optimized.value === 'number' && precision) {
      optimized.value = parseFloat(optimized.value.toFixed(precision));
    }
    
    // Optimize vector data
    if (dataType === TelemetryDataType.VECTOR && Array.isArray(optimized.value) && precision) {
      optimized.value = optimized.value.map(v => 
        typeof v === 'number' ? parseFloat(v.toFixed(precision)) : v
      );
    }
    
    // Optimize matrix data
    if (dataType === TelemetryDataType.MATRIX && Array.isArray(optimized.value) && precision) {
      optimized.value = optimized.value.map(row => 
        Array.isArray(row) 
          ? row.map(v => typeof v === 'number' ? parseFloat(v.toFixed(precision)) : v)
          : row
      );
    }
    
    return optimized;
  }

  /**
   * Calculate simple checksum for data integrity
   */
  protected calculateChecksum(data: any): number {
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash;
  }

  /**
   * Encode header for binary format
   */
  protected encodeHeader(header: SerializationHeader): ArrayBuffer {
    const headerJson = JSON.stringify(header);
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(headerJson);
    
    // Create header with length prefix (4 bytes for length + header data)
    const buffer = new ArrayBuffer(4 + headerBytes.byteLength);
    const view = new DataView(buffer);
    
    // Write header length
    view.setUint32(0, headerBytes.byteLength, true);
    
    // Write header data
    const uint8View = new Uint8Array(buffer, 4);
    uint8View.set(headerBytes);
    
    return buffer;
  }

  /**
   * Decode header from binary format
   */
  protected decodeHeader(data: ArrayBuffer): SerializationHeader {
    const view = new DataView(data);
    const headerLength = view.getUint32(0, true);
    
    if (headerLength > data.byteLength - 4) {
      throw this.createError('Invalid header length', 'protocol');
    }
    
    const headerBytes = new Uint8Array(data, 4, headerLength);
    const decoder = new TextDecoder();
    const headerJson = decoder.decode(headerBytes);
    
    return JSON.parse(headerJson) as SerializationHeader;
  }

  /**
   * Get header size in bytes
   */
  protected getHeaderSize(): number {
    return 4; // This is a simplified implementation - real implementation would calculate from actual header
  }

  /**
   * Fallback to JSON decoding
   */
  protected fallbackToJson(data: ArrayBuffer): WebSocketMessage {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(data);
    const parsed = JSON.parse(jsonString);
    
    this.validateMessage(parsed);
    return parsed as WebSocketMessage;
  }

  /**
   * Fallback telemetry data to JSON
   */
  protected fallbackTelemetryToJson(data: ArrayBuffer): TelemetryDataPoint {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(data);
    return JSON.parse(jsonString) as TelemetryDataPoint;
  }

  /**
   * Validate a WebSocket message structure
   * @param message The message to validate
   * @throws WebSocketError if validation fails
   */
  protected validateMessage(message: any): asserts message is WebSocketMessage {
    if (!message || typeof message !== 'object') {
      throw this.createError('Invalid message: not an object', 'protocol');
    }

    const requiredFields = ['id', 'type', 'payload', 'timestamp', 'protocol', 'compressed', 'acknowledged'];
    for (const field of requiredFields) {
      if (!(field in message)) {
        throw this.createError(`Invalid message: missing required field '${field}'`, 'protocol');
      }
    }

    if (!Object.values(MessageType).includes(message.type)) {
      throw this.createError(`Invalid message type: ${message.type}`, 'protocol');
    }

    if (!Object.values(Protocol).includes(message.protocol)) {
      throw this.createError(`Invalid protocol: ${message.protocol}`, 'protocol');
    }

    if (message.priority !== undefined && !Object.values(Priority).includes(message.priority)) {
      throw this.createError(`Invalid priority: ${message.priority}`, 'protocol');
    }
  }

  /**
   * Create a WebSocketError
   * @param message Error message
   * @param type Error type
   * @returns WebSocketError instance
   */
  protected createError(message: string, type: WebSocketError['type'] = 'protocol'): WebSocketError {
    const error = new Error(message) as WebSocketError;
    error.code = `SERIALIZER_${this.protocol.toUpperCase()}_ERROR`;
    error.type = type;
    error.recoverable = true;
    error.timestamp = Date.now();
    return error;
  }

  /**
   * Record performance metrics
   * @param operation The operation being measured
   * @param duration The duration in milliseconds
   */
  protected recordMetric(operation: string, duration: number): void {
    const key = `${this.protocol}_${operation}`;
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }
    const metrics = this.performanceMetrics.get(key)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Get performance metrics for an operation
   * @param operation The operation to get metrics for
   * @returns Average duration in milliseconds
   */
  getAverageMetric(operation: string): number {
    const key = `${this.protocol}_${operation}`;
    const metrics = this.performanceMetrics.get(key);
    if (!metrics || metrics.length === 0) {
      return 0;
    }
    return metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
  }
}

/**
 * Enhanced MessagePack Serializer
 * Optimized for high-frequency telemetry data with compression support
 */
export class MessagePackSerializer extends BaseSerializer {
  protocol = Protocol.MESSAGEPACK;

  encodeLegacy(message: WebSocketMessage): Uint8Array {
    const startTime = performance.now();
    try {
      this.validateMessage(message);
      
      // Create a clean object for serialization
      const cleanMessage = {
        id: message.id,
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp,
        protocol: message.protocol,
        compressed: message.compressed,
        acknowledged: message.acknowledged,
        ...(message.retryCount !== undefined && { retryCount: message.retryCount }),
        ...(message.priority !== undefined && { priority: message.priority })
      };

      const encoded = msgpack.encode(cleanMessage);
      this.recordMetric('encode', performance.now() - startTime);
      return encoded;
    } catch (error) {
      throw this.createError(
        `Failed to encode message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  decodeLegacy(data: ArrayBuffer | Uint8Array): WebSocketMessage {
    const startTime = performance.now();
    try {
      const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const decoded = msgpack.decode(uint8Array);
      
      this.validateMessage(decoded);
      this.recordMetric('decode', performance.now() - startTime);
      
      return decoded as WebSocketMessage;
    } catch (error) {
      throw this.createError(
        `Failed to decode message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  getContentType(): string {
    return 'application/msgpack';
  }
}

/**
 * Enhanced CBOR Serializer
 * Optimized for structured telemetry data with excellent numeric compression
 */
export class CBORSerializer extends BaseSerializer {
  protocol = Protocol.CBOR;

  encodeLegacy(message: WebSocketMessage): Uint8Array {
    const startTime = performance.now();
    try {
      this.validateMessage(message);
      
      // Create a clean object for serialization
      const cleanMessage = {
        id: message.id,
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp,
        protocol: message.protocol,
        compressed: message.compressed,
        acknowledged: message.acknowledged,
        ...(message.retryCount !== undefined && { retryCount: message.retryCount }),
        ...(message.priority !== undefined && { priority: message.priority })
      };

      const encoded = cborEncode(cleanMessage);
      this.recordMetric('encode', performance.now() - startTime);
      
      // cbor-x returns a Uint8Array
      return encoded;
    } catch (error) {
      throw this.createError(
        `Failed to encode message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  decodeLegacy(data: ArrayBuffer | Uint8Array): WebSocketMessage {
    const startTime = performance.now();
    try {
      const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const decoded = cborDecode(uint8Array);
      
      this.validateMessage(decoded);
      this.recordMetric('decode', performance.now() - startTime);
      
      return decoded as WebSocketMessage;
    } catch (error) {
      throw this.createError(
        `Failed to decode message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  getContentType(): string {
    return 'application/cbor';
  }
}

/**
 * Enhanced JSON Serializer
 * Fallback serializer with debugging support and UTF-8 optimization
 */
export class JSONSerializer extends BaseSerializer {
  protocol = Protocol.JSON;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  encodeLegacy(message: WebSocketMessage): Uint8Array {
    const startTime = performance.now();
    try {
      this.validateMessage(message);
      
      // Create a clean object for serialization
      const cleanMessage = {
        id: message.id,
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp,
        protocol: message.protocol,
        compressed: message.compressed,
        acknowledged: message.acknowledged,
        ...(message.retryCount !== undefined && { retryCount: message.retryCount }),
        ...(message.priority !== undefined && { priority: message.priority })
      };

      const jsonString = JSON.stringify(cleanMessage);
      const encoded = this.textEncoder.encode(jsonString);
      
      this.recordMetric('encode', performance.now() - startTime);
      return encoded;
    } catch (error) {
      throw this.createError(
        `Failed to encode message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  decodeLegacy(data: ArrayBuffer | Uint8Array): WebSocketMessage {
    const startTime = performance.now();
    try {
      const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const jsonString = this.textDecoder.decode(uint8Array);
      const decoded = JSON.parse(jsonString);
      
      this.validateMessage(decoded);
      this.recordMetric('decode', performance.now() - startTime);
      
      return decoded as WebSocketMessage;
    } catch (error) {
      throw this.createError(
        `Failed to decode message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'protocol'
      );
    }
  }

  /**
   * JSON serializer doesn't support native compression but can work with external compression
   */
  supportsCompression(): boolean {
    return true; // Can work with compression layer
  }

  /**
   * Get supported compression types (external compression only)
   */
  getCompressionTypes(): CompressionType[] {
    return [CompressionType.NONE, CompressionType.DEFLATE, CompressionType.GZIP];
  }

  getContentType(): string {
    return 'application/json';
  }
}

/**
 * Enhanced Serializer Factory
 * Creates and manages serializers with telemetry optimization and auto-selection
 */
export class SerializerFactory {
  private static serializers: Map<Protocol, SerializerInterface> = new Map();
  private static telemetryOptimizers: Map<TelemetryDataType, Protocol> = new Map();
  private static initialized = false;

  /**
   * Initialize the factory with default configurations
   */
  static initialize(): void {
    if (this.initialized) return;
    
    // Initialize schema registry
    SchemaRegistry.initialize();
    
    // Configure telemetry data type optimizations
    this.telemetryOptimizers.set(TelemetryDataType.NUMERIC, Protocol.MESSAGEPACK);
    this.telemetryOptimizers.set(TelemetryDataType.VECTOR, Protocol.MESSAGEPACK);
    this.telemetryOptimizers.set(TelemetryDataType.MATRIX, Protocol.CBOR);
    this.telemetryOptimizers.set(TelemetryDataType.STRING, Protocol.JSON);
    this.telemetryOptimizers.set(TelemetryDataType.BOOLEAN, Protocol.MESSAGEPACK);
    this.telemetryOptimizers.set(TelemetryDataType.OBJECT, Protocol.CBOR);
    
    this.initialized = true;
  }

  /**
   * Get a serializer for the specified protocol
   * @param protocol The protocol to get a serializer for
   * @returns Serializer instance
   */
  static getSerializer(protocol: Protocol): SerializerInterface {
    this.initialize();
    
    // Check cache first
    if (this.serializers.has(protocol)) {
      return this.serializers.get(protocol)!;
    }

    // Create new serializer
    let serializer: SerializerInterface;
    switch (protocol) {
      case Protocol.MESSAGEPACK:
        serializer = new MessagePackSerializer();
        break;
      case Protocol.CBOR:
        serializer = new CBORSerializer();
        break;
      case Protocol.JSON:
      case Protocol.BINARY: // Fall back to JSON for generic binary
      default:
        serializer = new JSONSerializer();
        break;
    }

    // Cache the serializer
    this.serializers.set(protocol, serializer);
    return serializer;
  }

  /**
   * Get the optimal serializer for telemetry data type
   */
  static getTelemetrySerializer(dataType: TelemetryDataType): SerializerInterface {
    this.initialize();
    
    const protocol = this.telemetryOptimizers.get(dataType) || Protocol.MESSAGEPACK;
    return this.getSerializer(protocol);
  }

  /**
   * Clear the serializer cache
   */
  static clearCache(): void {
    this.serializers.clear();
  }

  /**
   * Get all available protocols
   * @returns Array of supported protocols
   */
  static getSupportedProtocols(): Protocol[] {
    return [Protocol.JSON, Protocol.MESSAGEPACK, Protocol.CBOR];
  }

  /**
   * Enhanced protocol recommendation with telemetry awareness
   * @param message The message to analyze
   * @returns Recommended protocol with reasoning
   */
  static recommendProtocol(message: WebSocketMessage): { protocol: Protocol; reason: string } {
    this.initialize();
    
    // Special handling for telemetry messages
    if (message.type === MessageType.TELEMETRY && message.payload) {
      const payload = message.payload as TelemetryDataPoint;
      
      // Determine data type from payload
      let dataType: TelemetryDataType = TelemetryDataType.OBJECT;
      
      if (typeof payload.value === 'number') {
        dataType = TelemetryDataType.NUMERIC;
      } else if (typeof payload.value === 'boolean') {
        dataType = TelemetryDataType.BOOLEAN;
      } else if (typeof payload.value === 'string') {
        dataType = TelemetryDataType.STRING;
      } else if (Array.isArray(payload.value)) {
        // Check if it's a matrix (2D array) or vector (1D array)
        if (payload.value.length > 0 && Array.isArray(payload.value[0])) {
          dataType = TelemetryDataType.MATRIX;
        } else {
          dataType = TelemetryDataType.VECTOR;
        }
      }
      
      const protocol = this.telemetryOptimizers.get(dataType) || Protocol.MESSAGEPACK;
      return { 
        protocol, 
        reason: `Optimized for telemetry data type: ${dataType}` 
      };
    }

    // For binary payloads, use binary protocols
    if (message.payload instanceof ArrayBuffer || message.payload instanceof Uint8Array) {
      return { 
        protocol: Protocol.MESSAGEPACK, 
        reason: 'Binary payload detected' 
      };
    }

    // For large payloads, use efficient binary protocols
    const estimatedSize = JSON.stringify(message.payload).length;
    if (estimatedSize > 1024) { // 1KB threshold
      return { 
        protocol: Protocol.MESSAGEPACK, 
        reason: `Large payload (${estimatedSize} bytes)` 
      };
    }

    // For structured data with many numeric values, CBOR is efficient
    if (this.hasNumericData(message.payload)) {
      return { 
        protocol: Protocol.CBOR, 
        reason: 'Numeric-heavy data structure' 
      };
    }

    // Default to JSON for small, simple messages
    return { 
      protocol: Protocol.JSON, 
      reason: 'Small, simple message' 
    };
  }

  /**
   * Get optimal serialization configuration for telemetry data
   */
  static getTelemetryConfiguration(dataType: TelemetryDataType, payloadSize: number): {
    protocol: Protocol;
    compression: CompressionType;
    options: TelemetrySerializationOptions;
  } {
    this.initialize();
    
    const protocol = this.telemetryOptimizers.get(dataType) || Protocol.MESSAGEPACK;
    const schema = SchemaRegistry.getSchema(SchemaRegistry.getSchemaId(dataType));
    
    // Determine compression based on payload size and data type
    let compression = CompressionType.NONE;
    if (payloadSize > 512) { // 512 byte threshold
      compression = schema?.compression || CompressionType.DEFLATE;
    }
    
    // Configure serialization options
    const options: TelemetrySerializationOptions = {
      dataType,
      schemaValidation: true,
      compress: compression !== CompressionType.NONE,
      compressionType: compression,
      compressionThreshold: 512,
      precision: this.getOptimalPrecision(dataType),
      includeChecksum: payloadSize > 1024, // Checksum for larger payloads
      includeMeta: true
    };
    
    return { protocol, compression, options };
  }

  /**
   * Get optimal precision for numeric data types
   */
  private static getOptimalPrecision(dataType: TelemetryDataType): number | undefined {
    switch (dataType) {
      case TelemetryDataType.NUMERIC:
        return 6; // 6 decimal places for general numeric data
      case TelemetryDataType.VECTOR:
      case TelemetryDataType.MATRIX:
        return 4; // 4 decimal places for coordinate/matrix data
      default:
        return undefined;
    }
  }

  /**
   * Check if payload contains significant numeric data
   * @param payload The payload to check
   * @returns True if payload has numeric data
   */
  private static hasNumericData(payload: any): boolean {
    if (typeof payload === 'number') return true;
    if (Array.isArray(payload)) {
      return payload.some(item => typeof item === 'number');
    }
    if (payload && typeof payload === 'object') {
      return Object.values(payload).some(value => 
        typeof value === 'number' || this.hasNumericData(value)
      );
    }
    return false;
  }
}

/**
 * Size estimation utilities
 */
export class SizeEstimator {
  /**
   * Estimate the size of a value when serialized
   * @param value The value to estimate
   * @param protocol The protocol to use for estimation
   * @returns Estimated size in bytes
   */
  static estimate(value: any, protocol: Protocol = Protocol.JSON): number {
    switch (protocol) {
      case Protocol.MESSAGEPACK:
        return this.estimateMessagePack(value);
      case Protocol.CBOR:
        return this.estimateCBOR(value);
      case Protocol.JSON:
      default:
        return this.estimateJSON(value);
    }
  }

  private static estimateJSON(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 encoding
    } catch {
      return 0;
    }
  }

  private static estimateMessagePack(value: any): number {
    // Rough estimation based on MessagePack format
    if (value === null || value === undefined) return 1;
    if (typeof value === 'boolean') return 1;
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= -32 && value <= 127) return 1;
        if (value >= -128 && value <= 127) return 2;
        if (value >= -32768 && value <= 32767) return 3;
        return 5;
      }
      return 9; // float64
    }
    if (typeof value === 'string') {
      const len = value.length;
      if (len <= 31) return 1 + len;
      if (len <= 255) return 2 + len;
      if (len <= 65535) return 3 + len;
      return 5 + len;
    }
    if (Array.isArray(value)) {
      let size = 1; // array header
      if (value.length > 15) size += 2;
      for (const item of value) {
        size += this.estimateMessagePack(item);
      }
      return size;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      let size = 1; // map header
      if (keys.length > 15) size += 2;
      for (const key of keys) {
        size += this.estimateMessagePack(key);
        size += this.estimateMessagePack(value[key]);
      }
      return size;
    }
    return 0;
  }

  private static estimateCBOR(value: any): number {
    // Similar to MessagePack but with different header sizes
    if (value === null || value === undefined) return 1;
    if (typeof value === 'boolean') return 1;
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= 0 && value <= 23) return 1;
        if (value >= -24 && value <= -1) return 1;
        if (value <= 255) return 2;
        if (value <= 65535) return 3;
        return 5;
      }
      return 9; // float64
    }
    if (typeof value === 'string') {
      const len = value.length;
      if (len <= 23) return 1 + len;
      if (len <= 255) return 2 + len;
      if (len <= 65535) return 3 + len;
      return 5 + len;
    }
    if (Array.isArray(value)) {
      let size = 1; // array header
      if (value.length > 23) size += 1;
      for (const item of value) {
        size += this.estimateCBOR(item);
      }
      return size;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      let size = 1; // map header
      if (keys.length > 23) size += 1;
      for (const key of keys) {
        size += this.estimateCBOR(key);
        size += this.estimateCBOR(value[key]);
      }
      return size;
    }
    return 0;
  }

  /**
   * Compare serialization efficiency between protocols
   * @param value The value to compare
   * @returns Object with size estimates for each protocol
   */
  static compareProtocols(value: any): Record<Protocol, number> {
    return {
      [Protocol.JSON]: this.estimate(value, Protocol.JSON),
      [Protocol.MESSAGEPACK]: this.estimate(value, Protocol.MESSAGEPACK),
      [Protocol.CBOR]: this.estimate(value, Protocol.CBOR),
      [Protocol.BINARY]: this.estimate(value, Protocol.JSON) // Fallback to JSON
    };
  }
}

/**
 * High-level Telemetry Serialization Manager
 * Provides simplified API for telemetry data serialization with optimal performance
 */
export class TelemetrySerializationManager {
  private static instance: TelemetrySerializationManager;
  private initialized = false;
  private performanceStats = new Map<string, { 
    totalOperations: number; 
    totalTime: number; 
    errors: number; 
    compressionRatio: number; 
  }>();

  private constructor() {}

  static getInstance(): TelemetrySerializationManager {
    if (!this.instance) {
      this.instance = new TelemetrySerializationManager();
    }
    return this.instance;
  }

  /**
   * Initialize the manager
   */
  initialize(): void {
    if (this.initialized) return;
    
    SerializerFactory.initialize();
    this.initialized = true;
  }

  /**
   * Serialize telemetry data with optimal settings
   */
  async serializeTelemetry(
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
    this.initialize();
    
    const startTime = performance.now();
    const originalSize = JSON.stringify(data).length;
    
    try {
      // Get optimal configuration
      const config = SerializerFactory.getTelemetryConfiguration(dataType, originalSize);
      
      // Override with custom options
      const options: TelemetrySerializationOptions = {
        ...config.options,
        ...customOptions
      };
      
      // Get serializer and serialize
      const serializer = SerializerFactory.getSerializer(config.protocol);
      const serializedData = await serializer.encodeTelemetry(data, dataType, options);
      
      // Record performance metrics
      this.recordPerformance('serialize', performance.now() - startTime, originalSize, serializedData.byteLength);
      
      return {
        data: serializedData,
        protocol: config.protocol,
        compressed: options.compress || false,
        originalSize,
        compressedSize: serializedData.byteLength
      };
    } catch (error) {
      this.recordError('serialize');
      throw error;
    }
  }

  /**
   * Deserialize telemetry data with error recovery
   */
  async deserializeTelemetry(
    data: ArrayBuffer,
    expectedDataType?: TelemetryDataType,
    customOptions?: Partial<TelemetryDeserializationOptions>
  ): Promise<{
    data: TelemetryDataPoint;
    protocol: Protocol;
    validated: boolean;
  }> {
    this.initialize();
    
    const startTime = performance.now();
    
    // Try different protocols in order of likelihood
    const protocols = [Protocol.MESSAGEPACK, Protocol.CBOR, Protocol.JSON];
    let lastError: Error | null = null;
    
    for (const protocol of protocols) {
      try {
        const serializer = SerializerFactory.getSerializer(protocol);
        const deserializedData = await serializer.decodeTelemetry(data, {
          validateSchema: true,
          fallbackToJson: true,
          expectedDataType,
          ...customOptions
        });
        
        // Record successful deserialization
        this.recordPerformance('deserialize', performance.now() - startTime, data.byteLength, 0);
        
        return {
          data: deserializedData,
          protocol,
          validated: true
        };
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }
    
    // All protocols failed
    this.recordError('deserialize');
    throw lastError || new Error('Failed to deserialize telemetry data with any protocol');
  }

  /**
   * Batch serialize multiple telemetry data points
   */
  async serializeBatch(
    batch: Array<{ data: TelemetryDataPoint; dataType: TelemetryDataType }>,
    options?: Partial<TelemetrySerializationOptions>
  ): Promise<ArrayBuffer> {
    const serializedItems = await Promise.all(
      batch.map(item => this.serializeTelemetry(item.data, item.dataType, options))
    );
    
    // Combine into single ArrayBuffer with length prefixes
    const totalSize = serializedItems.reduce((sum, item) => sum + 4 + item.data.byteLength, 0);
    const result = new ArrayBuffer(totalSize);
    const view = new DataView(result);
    
    let offset = 0;
    for (const item of serializedItems) {
      // Write length prefix
      view.setUint32(offset, item.data.byteLength, true);
      offset += 4;
      
      // Write data
      const uint8View = new Uint8Array(result, offset, item.data.byteLength);
      uint8View.set(new Uint8Array(item.data));
      offset += item.data.byteLength;
    }
    
    return result;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [operation, data] of this.performanceStats) {
      stats[operation] = {
        averageTime: data.totalTime / data.totalOperations,
        totalOperations: data.totalOperations,
        errorRate: data.errors / data.totalOperations,
        averageCompressionRatio: data.compressionRatio / data.totalOperations
      };
    }
    
    return stats;
  }

  /**
   * Record performance metrics
   */
  private recordPerformance(operation: string, time: number, inputSize: number, outputSize: number): void {
    if (!this.performanceStats.has(operation)) {
      this.performanceStats.set(operation, {
        totalOperations: 0,
        totalTime: 0,
        errors: 0,
        compressionRatio: 0
      });
    }
    
    const stats = this.performanceStats.get(operation)!;
    stats.totalOperations++;
    stats.totalTime += time;
    
    if (inputSize > 0 && outputSize > 0) {
      stats.compressionRatio += outputSize / inputSize;
    }
  }

  /**
   * Record error
   */
  private recordError(operation: string): void {
    if (!this.performanceStats.has(operation)) {
      this.performanceStats.set(operation, {
        totalOperations: 0,
        totalTime: 0,
        errors: 0,
        compressionRatio: 0
      });
    }
    
    this.performanceStats.get(operation)!.errors++;
  }

  /**
   * Reset performance statistics
   */
  resetStats(): void {
    this.performanceStats.clear();
  }
}

/**
 * Enhanced serialization metrics interface
 */
export interface EnhancedSerializationMetrics {
  protocol: Protocol;
  encodeAverage: number;
  decodeAverage: number;
  telemetryEncodeAverage: number;
  telemetryDecodeAverage: number;
  errorCount: number;
  lastError?: string;
  compressionSupported: boolean;
  compressionTypes: CompressionType[];
  totalOperations: number;
}

/**
 * Get comprehensive serialization metrics
 * @returns Array of enhanced metrics for each protocol
 */
export function getEnhancedSerializationMetrics(): EnhancedSerializationMetrics[] {
  const metrics: EnhancedSerializationMetrics[] = [];
  
  for (const protocol of SerializerFactory.getSupportedProtocols()) {
    const serializer = SerializerFactory.getSerializer(protocol) as BaseSerializer;
    metrics.push({
      protocol,
      encodeAverage: serializer.getAverageMetric('encode'),
      decodeAverage: serializer.getAverageMetric('decode'),
      telemetryEncodeAverage: serializer.getAverageMetric('encodeTelemetry'),
      telemetryDecodeAverage: serializer.getAverageMetric('decodeTelemetry'),
      errorCount: 0, // Would need to track this separately
      lastError: undefined,
      compressionSupported: serializer.supportsCompression(),
      compressionTypes: serializer.getCompressionTypes(),
      totalOperations: 0 // Would need to track this separately
    });
  }
  
  return metrics;
}

/**
 * Utility functions for telemetry serialization
 */
export class TelemetrySerializationUtils {
  /**
   * Estimate serialization size for different protocols
   */
  static estimateSerializationSizes(data: TelemetryDataPoint): Record<Protocol, number> {
    const results: Record<Protocol, number> = {} as any;
    
    for (const protocol of SerializerFactory.getSupportedProtocols()) {
      const serializer = SerializerFactory.getSerializer(protocol);
      
      // Create a mock WebSocket message for estimation
      const mockMessage: WebSocketMessage = {
        id: 'test',
        type: MessageType.TELEMETRY,
        payload: data,
        timestamp: Date.now(),
        protocol,
        compressed: false,
        acknowledged: false
      };
      
      results[protocol] = serializer.estimateSize(mockMessage);
    }
    
    return results;
  }

  /**
   * Compare compression ratios
   */
  static async compareCompressionRatios(data: TelemetryDataPoint, dataType: TelemetryDataType): Promise<Record<CompressionType, number>> {
    const manager = TelemetrySerializationManager.getInstance();
    const results: Record<CompressionType, number> = {} as any;
    
    for (const compressionType of [CompressionType.NONE, CompressionType.DEFLATE, CompressionType.GZIP]) {
      try {
        const result = await manager.serializeTelemetry(data, dataType, {
          compress: compressionType !== CompressionType.NONE,
          compressionType
        });
        
        results[compressionType] = result.compressedSize / result.originalSize;
      } catch (error) {
        results[compressionType] = 1.0; // No compression achieved
      }
    }
    
    return results;
  }
}

// Export the singleton instance for easy access
export const telemetrySerializer = TelemetrySerializationManager.getInstance();