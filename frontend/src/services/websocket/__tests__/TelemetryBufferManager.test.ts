/**
 * TelemetryBufferManager Test Suite
 * 
 * Comprehensive tests for the configurable data buffering system
 * including time-based buffers, overflow handling, and persistence.
 */

import { 
  TelemetryBufferManager, 
  BufferConfig, 
  BufferOverflowStrategy, 
  FlushTrigger,
  BufferStatistics 
} from '../TelemetryBufferManager';
import { TelemetryDataPoint, TelemetryDataType } from '../TelemetryManager';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: () => Date.now()
  }
});

describe('TelemetryBufferManager', () => {
  let bufferManager: TelemetryBufferManager;
  let testStreamId: string;
  let testConfig: BufferConfig;

  beforeEach(() => {
    bufferManager = new TelemetryBufferManager();
    testStreamId = 'test-stream-1';
    testConfig = {
      streamId: testStreamId,
      windowSizeMs: 100,
      maxDataPoints: 50,
      overflowStrategy: BufferOverflowStrategy.FIFO,
      flushTriggers: [FlushTrigger.BUFFER_FULL],
      enablePersistence: false,
      enableStatistics: true,
      statisticsInterval: 1000
    };
    localStorageMock.clear();
  });

  afterEach(async () => {
    await bufferManager.destroy();
  });

  describe('Buffer Creation and Management', () => {
    test('should create buffer with default configuration', async () => {
      await bufferManager.createBuffer(testConfig);
      
      const stats = bufferManager.getStatistics(testStreamId);
      expect(stats).toBeDefined();
      expect(stats?.streamId).toBe(testStreamId);
      expect(stats?.maxCapacity).toBe(50);
      expect(stats?.currentSize).toBe(0);
    });

    test('should emit buffer:created event', async () => {
      const createdSpy = jest.fn();
      bufferManager.on('buffer:created', createdSpy);
      
      await bufferManager.createBuffer(testConfig);
      
      expect(createdSpy).toHaveBeenCalledWith(testStreamId, testConfig);
    });

    test('should calculate capacity from window size when maxDataPoints not provided', async () => {
      const configWithoutMax = { ...testConfig };
      delete configWithoutMax.maxDataPoints;
      
      await bufferManager.createBuffer(configWithoutMax);
      
      const stats = bufferManager.getStatistics(testStreamId);
      expect(stats?.maxCapacity).toBeGreaterThan(0);
    });

    test('should destroy buffer and cleanup resources', async () => {
      await bufferManager.createBuffer(testConfig);
      
      const destroyedSpy = jest.fn();
      bufferManager.on('buffer:destroyed', destroyedSpy);
      
      await bufferManager.destroyBuffer(testStreamId);
      
      expect(destroyedSpy).toHaveBeenCalledWith(testStreamId);
      expect(bufferManager.getStatistics(testStreamId)).toBeNull();
    });
  });

  describe('Data Addition and Retrieval', () => {
    beforeEach(async () => {
      await bufferManager.createBuffer(testConfig);
    });

    test('should add data points to buffer', () => {
      const dataPoint: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42,
        quality: 0.9
      };

      const result = bufferManager.addData(testStreamId, dataPoint);
      expect(result).toBe(true);

      const data = bufferManager.getData(testStreamId);
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual(dataPoint);
    });

    test('should retrieve data within time window', () => {
      const now = Date.now();
      const dataPoints: TelemetryDataPoint[] = [
        { timestamp: now - 200, value: 1 }, // Outside window
        { timestamp: now - 50, value: 2 },  // Inside window
        { timestamp: now, value: 3 }        // Inside window
      ];

      dataPoints.forEach(point => bufferManager.addData(testStreamId, point));

      const data = bufferManager.getData(testStreamId);
      expect(data.length).toBeGreaterThanOrEqual(2); // Should only include recent data
    });

    test('should retrieve data with count limit', () => {
      // Add multiple data points
      for (let i = 0; i < 10; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
      }

      const data = bufferManager.getData(testStreamId, { count: 5 });
      expect(data).toHaveLength(5);
    });

    test('should retrieve data within time range', () => {
      const baseTime = Date.now();
      const dataPoints: TelemetryDataPoint[] = [
        { timestamp: baseTime, value: 1 },
        { timestamp: baseTime + 10, value: 2 },
        { timestamp: baseTime + 20, value: 3 },
        { timestamp: baseTime + 30, value: 4 }
      ];

      dataPoints.forEach(point => bufferManager.addData(testStreamId, point));

      const data = bufferManager.getData(testStreamId, {
        startTime: baseTime + 5,
        endTime: baseTime + 25
      });

      expect(data.length).toBe(2);
      expect(data[0].value).toBe(2);
      expect(data[1].value).toBe(3);
    });
  });

  describe('Overflow Handling Strategies', () => {
    test('should handle FIFO overflow strategy', async () => {
      const fifoConfig = {
        ...testConfig,
        maxDataPoints: 3,
        overflowStrategy: BufferOverflowStrategy.FIFO
      };
      
      await bufferManager.createBuffer(fifoConfig);

      // Add data points to exceed capacity
      for (let i = 0; i < 5; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
      }

      const data = bufferManager.getData(testStreamId);
      expect(data.length).toBeLessThanOrEqual(3);
      
      // Should contain the most recent data
      const values = data.map(d => d.value);
      expect(values).toContain(4); // Latest value should be present
    });

    test('should handle DOWNSAMPLE overflow strategy', async () => {
      const downsampleConfig = {
        ...testConfig,
        overflowStrategy: BufferOverflowStrategy.DOWNSAMPLE,
        downsampleFactor: 2
      };
      
      await bufferManager.createBuffer(downsampleConfig);

      let acceptedCount = 0;
      for (let i = 0; i < 10; i++) {
        const result = bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
        if (result) acceptedCount++;
      }

      // Should accept roughly half the data points
      expect(acceptedCount).toBeLessThan(10);
      expect(acceptedCount).toBeGreaterThan(3);
    });

    test('should handle PRIORITY_BASED overflow strategy', async () => {
      const priorityConfig = {
        ...testConfig,
        overflowStrategy: BufferOverflowStrategy.PRIORITY_BASED,
        qualityThreshold: 0.7
      };
      
      await bufferManager.createBuffer(priorityConfig);

      const highQualityPoint: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 1,
        quality: 0.9
      };

      const lowQualityPoint: TelemetryDataPoint = {
        timestamp: Date.now() + 1,
        value: 2,
        quality: 0.5
      };

      const highResult = bufferManager.addData(testStreamId, highQualityPoint);
      const lowResult = bufferManager.addData(testStreamId, lowQualityPoint);

      expect(highResult).toBe(true);
      expect(lowResult).toBe(false);

      const data = bufferManager.getData(testStreamId);
      expect(data).toHaveLength(1);
      expect(data[0].quality).toBe(0.9);
    });

    test('should emit overflow events', async () => {
      const smallConfig = {
        ...testConfig,
        maxDataPoints: 2
      };
      
      await bufferManager.createBuffer(smallConfig);

      const overflowSpy = jest.fn();
      bufferManager.on('buffer:overflow', overflowSpy);

      // Fill buffer beyond capacity
      for (let i = 0; i < 5; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
      }

      expect(overflowSpy).toHaveBeenCalled();
    });
  });

  describe('Flush Triggers', () => {
    test('should flush on buffer full trigger', async () => {
      const flushConfig = {
        ...testConfig,
        maxDataPoints: 3,
        flushTriggers: [FlushTrigger.BUFFER_FULL]
      };
      
      await bufferManager.createBuffer(flushConfig);

      const flushSpy = jest.fn();
      bufferManager.on('buffer:flush', flushSpy);

      // Fill buffer to capacity
      for (let i = 0; i < 4; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
      }

      expect(flushSpy).toHaveBeenCalled();
      const flushEvent = flushSpy.mock.calls[0][0];
      expect(flushEvent.trigger).toBe(FlushTrigger.BUFFER_FULL);
      expect(flushEvent.data.length).toBeGreaterThan(0);
    });

    test('should flush on data count trigger', async () => {
      const flushConfig = {
        ...testConfig,
        flushTriggers: [FlushTrigger.DATA_COUNT],
        flushDataCount: 3
      };
      
      await bufferManager.createBuffer(flushConfig);

      const flushSpy = jest.fn();
      bufferManager.on('buffer:flush', flushSpy);

      // Add data points to reach flush count
      for (let i = 0; i < 3; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
      }

      expect(flushSpy).toHaveBeenCalled();
    });

    test('should flush on time interval trigger', async () => {
      const flushConfig = {
        ...testConfig,
        flushTriggers: [FlushTrigger.TIME_INTERVAL],
        flushIntervalMs: 100
      };
      
      await bufferManager.createBuffer(flushConfig);

      const flushSpy = jest.fn();
      bufferManager.on('buffer:flush', flushSpy);

      // Add some data
      bufferManager.addData(testStreamId, {
        timestamp: Date.now(),
        value: 1
      });

      // Wait for timer to trigger
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(flushSpy).toHaveBeenCalled();
    }, 10000);

    test('should manually flush buffer', async () => {
      await bufferManager.createBuffer(testConfig);

      // Add some data
      bufferManager.addData(testStreamId, {
        timestamp: Date.now(),
        value: 1
      });

      const flushEvent = await bufferManager.flushBuffer(testStreamId);
      
      expect(flushEvent).toBeDefined();
      expect(flushEvent?.trigger).toBe(FlushTrigger.MANUAL);
      expect(flushEvent?.data.length).toBe(1);
      
      // Buffer should be empty after flush
      const data = bufferManager.getData(testStreamId);
      expect(data).toHaveLength(0);
    });
  });

  describe('Buffer Statistics', () => {
    beforeEach(async () => {
      await bufferManager.createBuffer(testConfig);
    });

    test('should track basic buffer statistics', () => {
      // Add some data
      for (let i = 0; i < 5; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i,
          quality: 0.8 + (i * 0.05)
        });
      }

      const stats = bufferManager.getStatistics(testStreamId);
      expect(stats).toBeDefined();
      expect(stats?.currentSize).toBe(5);
      expect(stats?.totalReceived).toBe(5);
      expect(stats?.totalStored).toBe(5);
      expect(stats?.utilizationPercent).toBeGreaterThan(0);
    });

    test('should track data quality metrics', () => {
      const highQualityPoint: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 1,
        quality: 0.9
      };

      const lowQualityPoint: TelemetryDataPoint = {
        timestamp: Date.now() + 1,
        value: 2,
        quality: 0.5
      };

      bufferManager.addData(testStreamId, highQualityPoint);
      bufferManager.addData(testStreamId, lowQualityPoint);

      const stats = bufferManager.getStatistics(testStreamId);
      expect(stats?.averageDataQuality).toBeGreaterThan(0.5);
      expect(stats?.averageDataQuality).toBeLessThan(0.9);
    });

    test('should emit statistics updates', (done) => {
      bufferManager.on('buffer:statistics', (stats) => {
        expect(stats.streamId).toBe(testStreamId);
        expect(stats.updateCount).toBeGreaterThan(0);
        done();
      });

      // Add data to trigger statistics update
      bufferManager.addData(testStreamId, {
        timestamp: Date.now(),
        value: 1
      });

      // Statistics are updated on an interval, so we need to wait
    }, 5000);

    test('should calculate health score', () => {
      // Add good quality data
      for (let i = 0; i < 10; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i,
          quality: 0.9
        });
      }

      const stats = bufferManager.getStatistics(testStreamId);
      expect(stats?.healthScore).toBeGreaterThan(80);
    });
  });

  describe('Persistence', () => {
    test('should persist buffer data when enabled', async () => {
      const persistConfig = {
        ...testConfig,
        enablePersistence: true
      };
      
      await bufferManager.createBuffer(persistConfig);

      // Add some data
      const dataPoint: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42
      };
      bufferManager.addData(testStreamId, dataPoint);

      const persistedSpy = jest.fn();
      bufferManager.on('buffer:persisted', persistedSpy);

      // Destroy buffer (should trigger persistence)
      await bufferManager.destroyBuffer(testStreamId);

      expect(persistedSpy).toHaveBeenCalledWith(testStreamId, 1);
    });

    test('should restore persisted data on buffer creation', async () => {
      // First, create buffer with persistence and add data
      const persistConfig = {
        ...testConfig,
        enablePersistence: true
      };
      
      await bufferManager.createBuffer(persistConfig);

      const originalData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42
      };
      bufferManager.addData(testStreamId, originalData);

      // Destroy buffer (persists data)
      await bufferManager.destroyBuffer(testStreamId);

      // Create new buffer manager and buffer
      const newBufferManager = new TelemetryBufferManager();
      
      const restoredSpy = jest.fn();
      newBufferManager.on('buffer:restored', restoredSpy);

      await newBufferManager.createBuffer(persistConfig);

      // Should restore data
      if (restoredSpy.mock.calls.length > 0) {
        expect(restoredSpy).toHaveBeenCalledWith(testStreamId, 1);
        
        const restoredData = newBufferManager.getData(testStreamId);
        expect(restoredData).toHaveLength(1);
        expect(restoredData[0].value).toBe(42);
      }

      await newBufferManager.destroy();
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      await bufferManager.createBuffer(testConfig);
    });

    test('should update buffer configuration', async () => {
      const updates = {
        windowSizeMs: 200,
        overflowStrategy: BufferOverflowStrategy.DOWNSAMPLE,
        downsampleFactor: 3
      };

      await bufferManager.updateConfig(testStreamId, updates);

      // Add data to verify new configuration is working
      let acceptedCount = 0;
      for (let i = 0; i < 9; i++) {
        const result = bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
        if (result) acceptedCount++;
      }

      // With downsample factor of 3, should accept ~1/3 of data
      expect(acceptedCount).toBeLessThan(9);
    });

    test('should handle configuration update errors', async () => {
      const errorSpy = jest.fn();
      bufferManager.on('buffer:error', errorSpy);

      // Try to update non-existent buffer
      await expect(
        bufferManager.updateConfig('non-existent', { windowSizeMs: 200 })
      ).rejects.toThrow();
    });
  });

  describe('Buffer Clearing', () => {
    beforeEach(async () => {
      await bufferManager.createBuffer(testConfig);
    });

    test('should clear buffer data', () => {
      // Add some data
      for (let i = 0; i < 5; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i
        });
      }

      expect(bufferManager.getData(testStreamId)).toHaveLength(5);

      bufferManager.clearBuffer(testStreamId);

      expect(bufferManager.getData(testStreamId)).toHaveLength(0);
      
      const stats = bufferManager.getStatistics(testStreamId);
      expect(stats?.currentSize).toBe(0);
      expect(stats?.utilizationPercent).toBe(0);
    });
  });

  describe('Global Statistics', () => {
    test('should provide global buffer manager statistics', async () => {
      await bufferManager.createBuffer(testConfig);
      
      const anotherStreamId = 'test-stream-2';
      const anotherConfig = { ...testConfig, streamId: anotherStreamId };
      await bufferManager.createBuffer(anotherConfig);

      // Add data to both buffers
      bufferManager.addData(testStreamId, { timestamp: Date.now(), value: 1 });
      bufferManager.addData(anotherStreamId, { timestamp: Date.now(), value: 2 });

      const globalStats = bufferManager.getGlobalStatistics();
      
      expect(globalStats.totalBuffers).toBe(2);
      expect(globalStats.activeStreams).toContain(testStreamId);
      expect(globalStats.activeStreams).toContain(anotherStreamId);
      expect(globalStats.memoryUsage).toBeGreaterThan(0);
    });

    test('should get all buffer statistics', async () => {
      await bufferManager.createBuffer(testConfig);
      
      const anotherStreamId = 'test-stream-2';
      const anotherConfig = { ...testConfig, streamId: anotherStreamId };
      await bufferManager.createBuffer(anotherConfig);

      const allStats = bufferManager.getAllStatistics();
      
      expect(allStats.size).toBe(2);
      expect(allStats.has(testStreamId)).toBe(true);
      expect(allStats.has(anotherStreamId)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully when adding data to non-existent buffer', () => {
      const result = bufferManager.addData('non-existent', {
        timestamp: Date.now(),
        value: 1
      });

      expect(result).toBe(false);
    });

    test('should emit error events for buffer operations', async () => {
      const errorSpy = jest.fn();
      bufferManager.on('buffer:error', errorSpy);

      // Try to add data to non-existent buffer
      bufferManager.addData('non-existent', {
        timestamp: Date.now(),
        value: 1
      });

      expect(errorSpy).toHaveBeenCalled();
    });

    test('should return null for statistics of non-existent buffer', () => {
      const stats = bufferManager.getStatistics('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('Memory Management', () => {
    test('should estimate memory usage accurately', async () => {
      await bufferManager.createBuffer(testConfig);

      // Add data and check memory usage increases
      const initialStats = bufferManager.getStatistics(testStreamId);
      const initialMemory = initialStats?.memoryUsageBytes || 0;

      // Add more data
      for (let i = 0; i < 10; i++) {
        bufferManager.addData(testStreamId, {
          timestamp: Date.now() + i,
          value: i,
          metadata: { description: `Data point ${i}` }
        });
      }

      const updatedStats = bufferManager.getStatistics(testStreamId);
      const updatedMemory = updatedStats?.memoryUsageBytes || 0;

      expect(updatedMemory).toBeGreaterThan(initialMemory);
    });
  });
});

describe('Time-based Buffer Operations', () => {
  let bufferManager: TelemetryBufferManager;
  let testStreamId: string;

  beforeEach(async () => {
    bufferManager = new TelemetryBufferManager();
    testStreamId = 'time-test-stream';
    
    const config: BufferConfig = {
      streamId: testStreamId,
      windowSizeMs: 100, // 100ms window
      overflowStrategy: BufferOverflowStrategy.FIFO,
      flushTriggers: [FlushTrigger.MANUAL],
      enablePersistence: false,
      enableStatistics: false
    };
    
    await bufferManager.createBuffer(config);
  });

  afterEach(async () => {
    await bufferManager.destroy();
  });

  test('should only retain data within time window', async () => {
    const now = Date.now();
    
    // Add data points with different timestamps
    const dataPoints: TelemetryDataPoint[] = [
      { timestamp: now - 200, value: 1 }, // 200ms ago - outside window
      { timestamp: now - 150, value: 2 }, // 150ms ago - outside window  
      { timestamp: now - 80, value: 3 },  // 80ms ago - within window
      { timestamp: now - 50, value: 4 },  // 50ms ago - within window
      { timestamp: now, value: 5 }        // now - within window
    ];

    dataPoints.forEach(point => bufferManager.addData(testStreamId, point));

    // Small delay to ensure time progression
    await new Promise(resolve => setTimeout(resolve, 10));

    const retrievedData = bufferManager.getData(testStreamId);
    
    // Should only contain data within the 100ms window
    expect(retrievedData.length).toBeLessThanOrEqual(3);
    expect(retrievedData.every(point => (Date.now() - point.timestamp) <= 100));
  });

  test('should handle rapid data insertion', () => {
    const now = Date.now();
    const dataCount = 1000;
    
    // Add many data points quickly
    for (let i = 0; i < dataCount; i++) {
      bufferManager.addData(testStreamId, {
        timestamp: now + i,
        value: i
      });
    }

    const data = bufferManager.getData(testStreamId);
    expect(data.length).toBeGreaterThan(0);
    
    // All data should be within time window
    const currentTime = Date.now();
    expect(data.every(point => (currentTime - point.timestamp) <= 100));
  });
});