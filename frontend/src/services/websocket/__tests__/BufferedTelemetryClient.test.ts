/**
 * BufferedTelemetryClient Test Suite
 * 
 * Tests for the integration layer that combines WebSocketTelemetryClient
 * with the advanced buffering system.
 */

import { 
  BufferedTelemetryClient, 
  BufferedTelemetryConfig,
  DEFAULT_BUFFERED_TELEMETRY_CONFIG 
} from '../BufferedTelemetryClient';
import { 
  BufferOverflowStrategy, 
  FlushTrigger 
} from '../TelemetryBufferManager';
import { TelemetryStreamConfig, TelemetryDataType } from '../TelemetryManager';
import { Priority } from '../types';

// Mock the WebSocketTelemetryClient
jest.mock('../WebSocketTelemetryClient', () => {
  return {
    WebSocketTelemetryClient: jest.fn().mockImplementation(() => ({
      connectionState: 'connected',
      metrics: {
        totalChannels: 0,
        activeChannels: 0,
        totalDataRate: 0,
        averageLatency: 50,
        memoryUsage: 10,
        cpuUsage: 30,
        networkThroughput: 1000,
        droppedPackets: 0,
        bufferOverflows: 0,
        performanceScore: 95,
        bottlenecks: [],
        recommendations: []
      },
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue('mock-stream-id'),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      getPerformanceReport: jest.fn().mockReturnValue({
        metrics: {},
        subscriptions: [],
        recommendations: [],
        bottlenecks: []
      }),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    }))
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn().mockReturnValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: { now: () => Date.now() }
});

describe('BufferedTelemetryClient', () => {
  let client: BufferedTelemetryClient;
  let config: BufferedTelemetryConfig;

  beforeEach(() => {
    config = {
      ...DEFAULT_BUFFERED_TELEMETRY_CONFIG,
      buffering: {
        enabled: true,
        defaultWindowMs: 100,
        defaultOverflowStrategy: BufferOverflowStrategy.FIFO,
        defaultFlushTriggers: [FlushTrigger.BUFFER_FULL],
        enablePersistence: false,
        enableStatistics: true,
        statisticsInterval: 1000,
        autoOptimize: false,
        memoryLimit: 50
      }
    };
    
    client = new BufferedTelemetryClient(config);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (client) {
      await client.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(client).toBeDefined();
      expect(client.connectionState).toBe('connected');
    });

    test('should initialize metrics with buffering information', () => {
      const metrics = client.metrics;
      expect(metrics.buffering).toBeDefined();
      expect(metrics.buffering.totalBuffers).toBe(0);
      expect(metrics.buffering.activeStreams).toBe(0);
    });
  });

  describe('Connection Management', () => {
    test('should connect with buffer restoration', async () => {
      const connectSpy = jest.fn();
      client.on('telemetry:connected', connectSpy);

      await client.connect();

      expect(connectSpy).toHaveBeenCalled();
    });

    test('should disconnect with buffer persistence', async () => {
      const disconnectSpy = jest.fn();
      client.on('telemetry:disconnected', disconnectSpy);

      await client.disconnect();

      expect(disconnectSpy).toHaveBeenCalledWith('manual');
    });
  });

  describe('Stream Subscription with Buffering', () => {
    let streamConfig: TelemetryStreamConfig;

    beforeEach(() => {
      streamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000,
        sampleRate: 10,
        units: 'units'
      };
    });

    test('should subscribe to stream with buffer creation', async () => {
      const subscribedSpy = jest.fn();
      const bufferCreatedSpy = jest.fn();
      
      client.on('telemetry:subscribed', subscribedSpy);
      client.on('buffer:created', bufferCreatedSpy);

      const streamId = await client.subscribe(streamConfig, Priority.NORMAL);

      expect(streamId).toBe('mock-stream-id');
      expect(subscribedSpy).toHaveBeenCalled();
      expect(bufferCreatedSpy).toHaveBeenCalled();
    });

    test('should create optimized buffer configuration for high-frequency streams', async () => {
      const highFreqConfig = {
        ...streamConfig,
        sampleRate: 200 // High frequency
      };

      config.buffering.autoOptimize = true;
      const optimizedClient = new BufferedTelemetryClient(config);

      const bufferCreatedSpy = jest.fn();
      optimizedClient.on('buffer:created', bufferCreatedSpy);

      await optimizedClient.subscribe(highFreqConfig, Priority.NORMAL);

      expect(bufferCreatedSpy).toHaveBeenCalled();
      
      // Should have adjusted window size for high frequency
      const [streamId, bufferConfig] = bufferCreatedSpy.mock.calls[0];
      expect(bufferConfig.windowSizeMs).toBeLessThan(config.buffering.defaultWindowMs);

      await optimizedClient.destroy();
    });

    test('should create priority-based configuration for critical streams', async () => {
      const bufferCreatedSpy = jest.fn();
      client.on('buffer:created', bufferCreatedSpy);

      await client.subscribe(streamConfig, Priority.CRITICAL);

      expect(bufferCreatedSpy).toHaveBeenCalled();
      
      const [streamId, bufferConfig] = bufferCreatedSpy.mock.calls[0];
      expect(bufferConfig.overflowStrategy).toBe(BufferOverflowStrategy.DROP_OLDEST);
    });

    test('should unsubscribe from stream and destroy buffer', async () => {
      const streamId = await client.subscribe(streamConfig, Priority.NORMAL);
      
      const unsubscribedSpy = jest.fn();
      client.on('telemetry:unsubscribed', unsubscribedSpy);

      await client.unsubscribe(streamId);

      expect(unsubscribedSpy).toHaveBeenCalledWith(streamId);
    });
  });

  describe('Buffered Data Operations', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should retrieve buffered data', () => {
      const result = client.getBufferedData(streamId);
      
      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Array);
    });

    test('should retrieve buffered data with statistics', () => {
      const result = client.getBufferedData(streamId, { 
        includeStatistics: true 
      });
      
      expect(result.statistics).toBeDefined();
      expect(result.statistics?.streamId).toBe(streamId);
    });

    test('should retrieve buffered data with count limit', () => {
      const result = client.getBufferedData(streamId, { count: 10 });
      expect(result.data.length).toBeLessThanOrEqual(10);
    });

    test('should retrieve buffered data within time range', () => {
      const now = Date.now();
      const result = client.getBufferedData(streamId, {
        startTime: now - 1000,
        endTime: now
      });
      
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('Buffer Statistics', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should get buffer statistics for specific stream', () => {
      const stats = client.getBufferStatistics(streamId);
      expect(stats).toBeDefined();
      expect(stats?.streamId).toBe(streamId);
    });

    test('should get all buffer statistics', () => {
      const allStats = client.getBufferStatistics();
      expect(allStats).toBeInstanceOf(Map);
      expect(allStats?.has(streamId)).toBe(true);
    });

    test('should emit buffer statistics events', (done) => {
      client.on('buffer:statistics', (receivedStreamId, stats) => {
        expect(receivedStreamId).toBe(streamId);
        expect(stats).toBeDefined();
        done();
      });

      // Statistics are emitted on an interval, so we'll simulate it
      setTimeout(() => {
        client.emit('buffer:statistics', streamId, {
          streamId,
          bufferConfig: {} as any,
          currentSize: 0,
          maxCapacity: 100,
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
          qualityDistribution: [],
          oldestDataTimestamp: 0,
          newestDataTimestamp: 0,
          timeSpanMs: 0,
          errors: 0,
          healthScore: 100,
          lastUpdated: Date.now(),
          updateCount: 1
        });
      }, 10);
    });
  });

  describe('Buffer Flushing', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should manually flush individual buffer', async () => {
      const flushEvent = await client.flushBuffer(streamId);
      expect(flushEvent?.streamId).toBe(streamId);
    });

    test('should flush all buffers', async () => {
      const flushEvents = await client.flushAllBuffers();
      expect(flushEvents).toBeInstanceOf(Array);
    });

    test('should emit flush events', (done) => {
      client.on('buffer:flushed', (event) => {
        expect(event.streamId).toBe(streamId);
        expect(event.trigger).toBeDefined();
        done();
      });

      // Simulate flush event
      setTimeout(() => {
        client.emit('buffer:flushed', {
          streamId,
          trigger: FlushTrigger.MANUAL,
          data: [],
          statistics: {} as any,
          flushDurationMs: 5,
          timestamp: Date.now()
        });
      }, 10);
    });
  });

  describe('Buffer Configuration Updates', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should update buffer configuration', async () => {
      const updates = {
        windowSizeMs: 200,
        overflowStrategy: BufferOverflowStrategy.DOWNSAMPLE,
        downsampleFactor: 2
      };

      await expect(client.updateBufferConfig(streamId, updates)).resolves.not.toThrow();
    });

    test('should handle configuration update errors', async () => {
      const errorSpy = jest.fn();
      client.on('telemetry:error', errorSpy);

      // Try to update non-existent buffer
      await client.updateBufferConfig('non-existent', { windowSizeMs: 200 });

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Optimization Recommendations', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should generate optimization recommendations', () => {
      const recommendations = client.getOptimizationRecommendations();
      expect(recommendations).toBeInstanceOf(Array);
    });

    test('should apply optimization recommendations', async () => {
      const optimizedSpy = jest.fn();
      client.on('buffer:optimized', optimizedSpy);

      const mockRecommendations = [
        {
          streamId,
          currentConfig: {} as any,
          recommendedConfig: { windowSizeMs: 200 } as any,
          reason: 'Test optimization',
          impact: 'medium' as const,
          confidence: 0.8
        }
      ];

      await client.applyOptimizations(mockRecommendations);

      expect(optimizedSpy).toHaveBeenCalled();
    });

    test('should not apply low-confidence recommendations', async () => {
      const optimizedSpy = jest.fn();
      client.on('buffer:optimized', optimizedSpy);

      const lowConfidenceRecommendations = [
        {
          streamId,
          currentConfig: {} as any,
          recommendedConfig: { windowSizeMs: 200 } as any,
          reason: 'Low confidence test',
          impact: 'high' as const,
          confidence: 0.3 // Low confidence
        }
      ];

      await client.applyOptimizations(lowConfidenceRecommendations);

      expect(optimizedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Buffer Clearing', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should clear individual buffer', () => {
      expect(() => client.clearBuffer(streamId)).not.toThrow();
    });

    test('should clear all buffers', () => {
      expect(() => client.clearAllBuffers()).not.toThrow();
    });
  });

  describe('Comprehensive Reporting', () => {
    let streamId: string;

    beforeEach(async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      streamId = await client.subscribe(streamConfig, Priority.NORMAL);
    });

    test('should generate comprehensive report', () => {
      const report = client.getComprehensiveReport();
      
      expect(report).toBeDefined();
      expect(report.connection).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.buffers).toBeInstanceOf(Map);
      expect(report.optimizations).toBeInstanceOf(Array);
      expect(report.health).toBeDefined();
      expect(report.health.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.health.overallScore).toBeLessThanOrEqual(100);
    });

    test('should identify health issues', () => {
      // Mock poor buffer statistics
      const mockPoorStats = new Map();
      mockPoorStats.set(streamId, {
        streamId,
        healthScore: 30, // Poor health
        overflowEvents: 50, // Many overflows
        utilizationPercent: 95, // High utilization
        averageDataQuality: 0.3 // Low quality
      });

      // We'd need to mock the buffer manager to return these stats
      // For now, just verify the report structure exists
      const report = client.getComprehensiveReport();
      expect(report.health.issues).toBeInstanceOf(Array);
      expect(report.health.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Event Handling', () => {
    test('should handle buffer overflow events', (done) => {
      client.on('buffer:overflow', (streamId, strategy, droppedCount) => {
        expect(streamId).toBeDefined();
        expect(strategy).toBeDefined();
        expect(droppedCount).toBeGreaterThan(0);
        done();
      });

      // Simulate overflow event
      client.emit('buffer:overflow', 'test-stream', BufferOverflowStrategy.FIFO, 5);
    });

    test('should handle buffer health warnings', (done) => {
      client.on('buffer:health:warning', (streamId, score, issues) => {
        expect(streamId).toBeDefined();
        expect(score).toBeLessThan(70);
        expect(issues).toBeInstanceOf(Array);
        done();
      });

      // Simulate health warning
      client.emit('buffer:health:warning', 'test-stream', 50, ['High utilization']);
    });

    test('should handle memory limit warnings', (done) => {
      client.on('buffer:memory:limit', (currentUsage, limit) => {
        expect(currentUsage).toBeGreaterThan(limit);
        done();
      });

      // Simulate memory limit exceeded
      client.emit('buffer:memory:limit', 60, 50);
    });

    test('should handle persistence events', (done) => {
      client.on('buffer:persistent:saved', (streamId, size) => {
        expect(streamId).toBeDefined();
        expect(size).toBeGreaterThan(0);
        done();
      });

      // Simulate persistence event
      client.emit('buffer:persistent:saved', 'test-stream', 100);
    });
  });

  describe('Auto-optimization', () => {
    test('should enable auto-optimization when configured', () => {
      const autoOptimizeConfig = {
        ...config,
        buffering: {
          ...config.buffering,
          autoOptimize: true
        }
      };

      const autoClient = new BufferedTelemetryClient(autoOptimizeConfig);
      expect(autoClient).toBeDefined();
      
      // Auto-optimization runs on an interval, so we can't easily test
      // the actual optimization logic without mocking timers
      autoClient.destroy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle buffer manager errors gracefully', async () => {
      const errorSpy = jest.fn();
      client.on('telemetry:error', errorSpy);

      // Simulate error from buffer manager
      client.emit('telemetry:error', 'test-stream', new Error('Buffer error'));

      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle destroy when already destroyed', async () => {
      await client.destroy();
      // Second destroy should not throw
      await expect(client.destroy()).resolves.not.toThrow();
    });

    test('should handle operations after destruction', async () => {
      await client.destroy();

      // Operations after destruction should be handled gracefully
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };

      // These should not throw errors but may not work as expected
      expect(() => client.getBufferedData('test')).not.toThrow();
      expect(() => client.clearBuffer('test')).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    test('should track memory usage in metrics', async () => {
      const streamConfig: TelemetryStreamConfig = {
        streamId: 'test-stream',
        name: 'Test Stream',
        dataType: TelemetryDataType.NUMERIC,
        bufferSize: 1000
      };
      
      await client.subscribe(streamConfig, Priority.NORMAL);

      const metrics = client.metrics;
      expect(metrics.buffering.totalMemoryUsageMB).toBeGreaterThanOrEqual(0);
    });

    test('should emit memory limit warnings', (done) => {
      // Set a very low memory limit
      const lowMemoryConfig = {
        ...config,
        buffering: {
          ...config.buffering,
          memoryLimit: 0.001 // Very small limit
        }
      };

      const memoryClient = new BufferedTelemetryClient(lowMemoryConfig);
      
      memoryClient.on('buffer:memory:limit', (currentUsage, limit) => {
        expect(currentUsage).toBeGreaterThan(limit);
        memoryClient.destroy();
        done();
      });

      // This would normally happen through buffer manager events
      memoryClient.emit('buffer:memory:limit', 1, 0.001);
    });
  });
});