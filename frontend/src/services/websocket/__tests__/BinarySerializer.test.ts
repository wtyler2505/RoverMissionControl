/**
 * Comprehensive test suite for enhanced binary serialization system
 * Tests all major components: serializers, compression, schema validation, telemetry integration
 */

import {
  SerializerFactory,
  SchemaRegistry,
  CompressionManager,
  TelemetrySerializationManager,
  TelemetrySerializationUtils,
  MessagePackSerializer,
  CBORSerializer,
  JSONSerializer,
  CompressionType,
  SCHEMA_VERSION,
  telemetrySerializer
} from '../BinarySerializer';
import { TelemetryDataPoint, TelemetryDataType } from '../TelemetryManager';
import { Protocol, MessageType, Priority } from '../types';

describe('Enhanced Binary Serialization System', () => {
  beforeAll(() => {
    // Initialize all systems
    SerializerFactory.initialize();
    SchemaRegistry.initialize();
  });

  describe('SchemaRegistry', () => {
    it('should initialize with default telemetry schemas', () => {
      const schemas = SchemaRegistry.getAllSchemas();
      expect(schemas.size).toBeGreaterThan(0);
      
      // Check for required schemas
      expect(SchemaRegistry.getSchema('telemetry.numeric.v1')).toBeDefined();
      expect(SchemaRegistry.getSchema('telemetry.vector.v1')).toBeDefined();
      expect(SchemaRegistry.getSchema('telemetry.matrix.v1')).toBeDefined();
      expect(SchemaRegistry.getSchema('telemetry.string.v1')).toBeDefined();
      expect(SchemaRegistry.getSchema('telemetry.boolean.v1')).toBeDefined();
      expect(SchemaRegistry.getSchema('telemetry.object.v1')).toBeDefined();
    });

    it('should validate telemetry data against schemas', () => {
      const numericSchema = SchemaRegistry.getSchema('telemetry.numeric.v1')!;
      
      const validData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42.5,
        quality: 0.95
      };
      
      const invalidData = {
        timestamp: 'invalid',
        value: 'not a number'
      };
      
      expect(SchemaRegistry.validateData(validData, numericSchema)).toBe(true);
      expect(SchemaRegistry.validateData(invalidData as any, numericSchema)).toBe(false);
    });

    it('should get correct schema ID for data types', () => {
      expect(SchemaRegistry.getSchemaId(TelemetryDataType.NUMERIC)).toBe('telemetry.numeric.v1');
      expect(SchemaRegistry.getSchemaId(TelemetryDataType.VECTOR)).toBe('telemetry.vector.v1');
      expect(SchemaRegistry.getSchemaId(TelemetryDataType.MATRIX)).toBe('telemetry.matrix.v1');
    });
  });

  describe('CompressionManager', () => {
    const testData = new ArrayBuffer(1024);
    new Uint8Array(testData).fill(65); // Fill with 'A' characters

    it('should determine when compression is beneficial', () => {
      expect(CompressionManager.shouldCompress(testData, 512)).toBe(true);
      expect(CompressionManager.shouldCompress(testData, 2048)).toBe(false);
    });

    it('should compress and decompress data correctly', async () => {
      const compressed = await CompressionManager.compress(testData, CompressionType.DEFLATE);
      const decompressed = await CompressionManager.decompress(compressed, CompressionType.DEFLATE);
      
      expect(decompressed.byteLength).toBe(testData.byteLength);
      expect(new Uint8Array(decompressed)).toEqual(new Uint8Array(testData));
    });

    it('should handle compression types correctly', async () => {
      const original = testData;
      
      // Test NONE compression
      const none = await CompressionManager.compress(original, CompressionType.NONE);
      expect(none).toBe(original);
      
      // Test DEFLATE compression
      const deflate = await CompressionManager.compress(original, CompressionType.DEFLATE);
      expect(deflate.byteLength).toBeLessThanOrEqual(original.byteLength);
      
      // Test GZIP compression (if supported)
      const gzip = await CompressionManager.compress(original, CompressionType.GZIP);
      expect(gzip.byteLength).toBeLessThanOrEqual(original.byteLength);
    });
  });

  describe('Serializer Implementations', () => {
    const testMessage = {
      id: 'test-123',
      type: MessageType.TELEMETRY,
      payload: { timestamp: Date.now(), value: 42.5, quality: 0.95 },
      timestamp: Date.now(),
      protocol: Protocol.MESSAGEPACK,
      compressed: false,
      acknowledged: false
    };

    describe('MessagePackSerializer', () => {
      let serializer: MessagePackSerializer;

      beforeEach(() => {
        serializer = new MessagePackSerializer();
      });

      it('should encode and decode messages correctly', async () => {
        const encoded = await serializer.encode(testMessage);
        const decoded = await serializer.decode(encoded);
        
        expect(decoded.id).toBe(testMessage.id);
        expect(decoded.type).toBe(testMessage.type);
        expect(decoded.payload).toEqual(testMessage.payload);
      });

      it('should support compression', () => {
        expect(serializer.supportsCompression()).toBe(true);
        expect(serializer.getCompressionTypes()).toContain(CompressionType.DEFLATE);
      });

      it('should encode telemetry data optimally', async () => {
        const telemetryData: TelemetryDataPoint = {
          timestamp: Date.now(),
          value: 123.456789,
          quality: 0.95
        };
        
        const encoded = await serializer.encodeTelemetry(
          telemetryData, 
          TelemetryDataType.NUMERIC,
          { precision: 3, schemaValidation: true }
        );
        
        expect(encoded.byteLength).toBeGreaterThan(0);
        
        const decoded = await serializer.decodeTelemetry(encoded, {
          validateSchema: true,
          expectedDataType: TelemetryDataType.NUMERIC
        });
        
        expect(decoded.timestamp).toBe(telemetryData.timestamp);
        expect(decoded.value).toBeCloseTo(123.457, 2); // Precision optimization applied
      });
    });

    describe('CBORSerializer', () => {
      let serializer: CBORSerializer;

      beforeEach(() => {
        serializer = new CBORSerializer();
      });

      it('should encode and decode messages correctly', async () => {
        const encoded = await serializer.encode(testMessage);
        const decoded = await serializer.decode(encoded);
        
        expect(decoded.id).toBe(testMessage.id);
        expect(decoded.type).toBe(testMessage.type);
        expect(decoded.payload).toEqual(testMessage.payload);
      });

      it('should handle matrix data efficiently', async () => {
        const matrixData: TelemetryDataPoint = {
          timestamp: Date.now(),
          value: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          quality: 1.0
        };
        
        const encoded = await serializer.encodeTelemetry(
          matrixData,
          TelemetryDataType.MATRIX,
          { schemaValidation: true }
        );
        
        const decoded = await serializer.decodeTelemetry(encoded);
        expect(decoded.value).toEqual(matrixData.value);
      });
    });

    describe('JSONSerializer', () => {
      let serializer: JSONSerializer;

      beforeEach(() => {
        serializer = new JSONSerializer();
      });

      it('should encode and decode messages correctly', async () => {
        const encoded = await serializer.encode(testMessage);
        const decoded = await serializer.decode(encoded);
        
        expect(decoded.id).toBe(testMessage.id);
        expect(decoded.type).toBe(testMessage.type);
        expect(decoded.payload).toEqual(testMessage.payload);
      });

      it('should work with compression layer', () => {
        expect(serializer.supportsCompression()).toBe(true);
      });
    });
  });

  describe('SerializerFactory', () => {
    it('should provide correct serializer for each protocol', () => {
      const msgpackSerializer = SerializerFactory.getSerializer(Protocol.MESSAGEPACK);
      const cborSerializer = SerializerFactory.getSerializer(Protocol.CBOR);
      const jsonSerializer = SerializerFactory.getSerializer(Protocol.JSON);
      
      expect(msgpackSerializer.protocol).toBe(Protocol.MESSAGEPACK);
      expect(cborSerializer.protocol).toBe(Protocol.CBOR);
      expect(jsonSerializer.protocol).toBe(Protocol.JSON);
    });

    it('should recommend optimal protocols for telemetry data', () => {
      const numericMessage = {
        id: 'test',
        type: MessageType.TELEMETRY,
        payload: { timestamp: Date.now(), value: 42.5 },
        timestamp: Date.now(),
        protocol: Protocol.JSON,
        compressed: false,
        acknowledged: false
      };
      
      const recommendation = SerializerFactory.recommendProtocol(numericMessage);
      expect(recommendation.protocol).toBe(Protocol.MESSAGEPACK);
      expect(recommendation.reason).toContain('telemetry');
    });

    it('should provide telemetry configuration optimization', () => {
      const config = SerializerFactory.getTelemetryConfiguration(TelemetryDataType.MATRIX, 2048);
      
      expect(config.protocol).toBe(Protocol.CBOR); // Optimal for matrix data
      expect(config.compression).toBeDefined();
      expect(config.options.schemaValidation).toBe(true);
      expect(config.options.precision).toBeDefined();
    });

    it('should cache serializers for performance', () => {
      const serializer1 = SerializerFactory.getSerializer(Protocol.MESSAGEPACK);
      const serializer2 = SerializerFactory.getSerializer(Protocol.MESSAGEPACK);
      
      expect(serializer1).toBe(serializer2); // Same instance
    });
  });

  describe('TelemetrySerializationManager', () => {
    let manager: TelemetrySerializationManager;

    beforeEach(() => {
      manager = TelemetrySerializationManager.getInstance();
    });

    it('should serialize and deserialize telemetry data', async () => {
      const originalData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: [1.1, 2.2, 3.3],
        quality: 0.95,
        metadata: { sensor: 'accelerometer' }
      };
      
      const result = await manager.serializeTelemetry(originalData, TelemetryDataType.VECTOR);
      
      expect(result.data.byteLength).toBeGreaterThan(0);
      expect(result.protocol).toBeDefined();
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      
      const deserialized = await manager.deserializeTelemetry(result.data, TelemetryDataType.VECTOR);
      
      expect(deserialized.data.timestamp).toBe(originalData.timestamp);
      expect(deserialized.data.value).toEqual(originalData.value);
      expect(deserialized.data.quality).toBe(originalData.quality);
      expect(deserialized.validated).toBe(true);
    });

    it('should handle batch serialization', async () => {
      const batch = [
        { data: { timestamp: Date.now(), value: 1.1 }, dataType: TelemetryDataType.NUMERIC },
        { data: { timestamp: Date.now(), value: 2.2 }, dataType: TelemetryDataType.NUMERIC },
        { data: { timestamp: Date.now(), value: 3.3 }, dataType: TelemetryDataType.NUMERIC }
      ];
      
      const serializedBatch = await manager.serializeBatch(batch);
      expect(serializedBatch.byteLength).toBeGreaterThan(0);
    });

    it('should collect performance statistics', async () => {
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42.0
      };
      
      await manager.serializeTelemetry(testData, TelemetryDataType.NUMERIC);
      await manager.deserializeTelemetry(
        (await manager.serializeTelemetry(testData, TelemetryDataType.NUMERIC)).data
      );
      
      const stats = manager.getPerformanceStats();
      expect(stats.serialize).toBeDefined();
      expect(stats.deserialize).toBeDefined();
    });

    it('should handle errors gracefully with fallback', async () => {
      const corruptedData = new ArrayBuffer(10);
      new Uint8Array(corruptedData).fill(255); // Invalid data
      
      await expect(
        manager.deserializeTelemetry(corruptedData, TelemetryDataType.NUMERIC, {
          fallbackToJson: false
        })
      ).rejects.toThrow();
    });
  });

  describe('TelemetrySerializationUtils', () => {
    it('should estimate serialization sizes correctly', () => {
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: { x: 1.1, y: 2.2, z: 3.3 },
        quality: 0.95
      };
      
      const sizes = TelemetrySerializationUtils.estimateSerializationSizes(testData);
      
      expect(sizes[Protocol.JSON]).toBeGreaterThan(0);
      expect(sizes[Protocol.MESSAGEPACK]).toBeGreaterThan(0);
      expect(sizes[Protocol.CBOR]).toBeGreaterThan(0);
      
      // MessagePack should generally be smaller than JSON for structured data
      expect(sizes[Protocol.MESSAGEPACK]).toBeLessThan(sizes[Protocol.JSON]);
    });

    it('should compare compression ratios', async () => {
      const largeData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: Array(100).fill(0).map((_, i) => i * 1.1), // Large array
        quality: 1.0
      };
      
      const ratios = await TelemetrySerializationUtils.compareCompressionRatios(
        largeData,
        TelemetryDataType.VECTOR
      );
      
      expect(ratios[CompressionType.NONE]).toBe(1.0);
      expect(ratios[CompressionType.DEFLATE]).toBeLessThan(1.0);
      expect(ratios[CompressionType.GZIP]).toBeLessThan(1.0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle mixed data types efficiently', async () => {
      const testCases = [
        { data: { timestamp: Date.now(), value: 42.5 }, type: TelemetryDataType.NUMERIC },
        { data: { timestamp: Date.now(), value: [1, 2, 3] }, type: TelemetryDataType.VECTOR },
        { data: { timestamp: Date.now(), value: 'status ok' }, type: TelemetryDataType.STRING },
        { data: { timestamp: Date.now(), value: true }, type: TelemetryDataType.BOOLEAN },
        { data: { timestamp: Date.now(), value: { x: 1, y: 2 } }, type: TelemetryDataType.OBJECT }
      ];
      
      for (const testCase of testCases) {
        const result = await telemetrySerializer.serializeTelemetry(testCase.data, testCase.type);
        const deserialized = await telemetrySerializer.deserializeTelemetry(result.data, testCase.type);
        
        expect(deserialized.data.value).toEqual(testCase.data.value);
      }
    });

    it('should maintain performance under load', async () => {
      const iterations = 100;
      const startTime = performance.now();
      
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: Array(50).fill(0).map(() => Math.random())
      };
      
      for (let i = 0; i < iterations; i++) {
        const result = await telemetrySerializer.serializeTelemetry(testData, TelemetryDataType.VECTOR);
        await telemetrySerializer.deserializeTelemetry(result.data, TelemetryDataType.VECTOR);
      }
      
      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / iterations;
      
      // Should process each iteration in under 10ms on average
      expect(averageTime).toBeLessThan(10);
    });

    it('should handle schema evolution gracefully', () => {
      // Test that the system can handle version changes
      const currentVersion = SCHEMA_VERSION;
      expect(currentVersion).toBe('1.0.0');
      
      // Future versions should be backward compatible
      const schema = SchemaRegistry.getSchema('telemetry.numeric.v1');
      expect(schema?.version).toBe('1.0.0');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      const emptyData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: null
      };
      
      const result = await telemetrySerializer.serializeTelemetry(emptyData, TelemetryDataType.OBJECT);
      const deserialized = await telemetrySerializer.deserializeTelemetry(result.data);
      
      expect(deserialized.data.value).toBe(null);
    });

    it('should handle very large data sets', async () => {
      const largeData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: Array(10000).fill(0).map(() => Math.random())
      };
      
      const result = await telemetrySerializer.serializeTelemetry(largeData, TelemetryDataType.VECTOR, {
        compress: true,
        compressionType: CompressionType.GZIP
      });
      
      expect(result.compressed).toBe(true);
      expect(result.compressedSize).toBeLessThan(result.originalSize);
      
      const deserialized = await telemetrySerializer.deserializeTelemetry(result.data);
      expect(deserialized.data.value).toHaveLength(10000);
    });

    it('should validate checksums when enabled', async () => {
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42.5
      };
      
      const result = await telemetrySerializer.serializeTelemetry(testData, TelemetryDataType.NUMERIC, {
        includeChecksum: true
      });
      
      // Valid checksum should pass
      const deserialized = await telemetrySerializer.deserializeTelemetry(result.data, undefined, {
        verifyChecksum: true
      });
      
      expect(deserialized.data.value).toBe(testData.value);
    });
  });
});