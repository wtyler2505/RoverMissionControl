/**
 * Comprehensive test suite for the Telemetry Processing Pipeline
 * Tests all stages, pipeline orchestration, performance monitoring, and edge cases
 */

import {
  TelemetryProcessingPipeline,
  DataTransformationStage,
  WindowedOperationsStage,
  DataInterpolationStage,
  TimeAlignmentStage,
  ProcessingStage,
  ProcessingStageType,
  ProcessingContext,
  WindowOperationType,
  InterpolationMethod,
  PipelineConfig
} from '../TelemetryProcessingPipeline';
import { TelemetryDataPoint, TelemetryDataType } from '../TelemetryManager';

describe('Telemetry Processing Pipeline', () => {
  let pipeline: TelemetryProcessingPipeline;
  
  beforeEach(() => {
    pipeline = new TelemetryProcessingPipeline({
      maxConcurrentStreams: 10,
      defaultWindowSize: 50,
      interpolationMethod: InterpolationMethod.LINEAR,
      timeAlignmentTolerance: 100,
      enablePerformanceMonitoring: true,
      memoryLimitMB: 100,
      processingTimeout: 1000
    });
  });

  afterEach(async () => {
    await pipeline.destroy();
  });

  describe('Pipeline Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultPipeline = new TelemetryProcessingPipeline();
      const metrics = defaultPipeline.getMetrics();
      
      expect(metrics.totalStreams).toBe(0);
      expect(metrics.activeStreams).toBe(0);
      expect(metrics.stageMetrics.size).toBeGreaterThan(0);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<PipelineConfig> = {
        maxConcurrentStreams: 50,
        defaultWindowSize: 200,
        processingTimeout: 2000
      };
      
      const customPipeline = new TelemetryProcessingPipeline(customConfig);
      expect(customPipeline).toBeDefined();
    });
  });

  describe('Stage Management', () => {
    it('should add and remove stages', () => {
      const customStage: ProcessingStage = {
        name: 'custom_test_stage',
        stageType: ProcessingStageType.FILTER,
        inputTypes: [TelemetryDataType.NUMERIC],
        outputTypes: [TelemetryDataType.NUMERIC],
        
        async process(data: any): Promise<any> {
          return data;
        },
        
        configure(config: Record<string, any>): void {
          // No configuration needed for test
        },
        
        reset(): void {
          // No state to reset for test
        },
        
        getMetrics() {
          return {
            processedCount: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            errorCount: 0,
            lastProcessingTime: 0,
            throughput: 0
          };
        }
      };

      pipeline.addStage(customStage);
      
      // Try to add the same stage again (should throw)
      expect(() => pipeline.addStage(customStage)).toThrow();
      
      // Remove the stage
      pipeline.removeStage('custom_test_stage');
      
      // Try to remove non-existent stage (should throw)
      expect(() => pipeline.removeStage('non_existent_stage')).toThrow();
    });

    it('should configure stages', () => {
      const config = { testParam: 'testValue' };
      
      // This should not throw for existing stages
      expect(() => pipeline.configureStage('data_transformation', config)).not.toThrow();
      
      // This should throw for non-existent stage
      expect(() => pipeline.configureStage('non_existent_stage', config)).toThrow();
    });
  });

  describe('Data Processing', () => {
    it('should process single data point', async () => {
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42.123456789,
        quality: 0.95
      };

      const result = await pipeline.processSingle('test_stream', testData, TelemetryDataType.NUMERIC);
      
      expect(result).toBeDefined();
      expect(result.timestamp).toBe(testData.timestamp);
      expect(typeof result.value).toBe('number');
      expect(result.quality).toBe(testData.quality);
    });

    it('should process batch data', async () => {
      const testData: TelemetryDataPoint[] = [
        { timestamp: Date.now(), value: 1.0, quality: 1.0 },
        { timestamp: Date.now() + 100, value: 2.0, quality: 1.0 },
        { timestamp: Date.now() + 200, value: 3.0, quality: 1.0 }
      ];

      const results = await pipeline.processBatch('test_stream', testData, TelemetryDataType.NUMERIC);
      
      expect(results).toHaveLength(testData.length);
      expect(results[0].value).toBeDefined();
      expect(results[1].value).toBeDefined();
      expect(results[2].value).toBeDefined();
    });

    it('should handle vector data processing', async () => {
      const vectorData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: [1.123456789, 2.987654321, 3.555555555],
        quality: 0.98
      };

      const result = await pipeline.processSingle('vector_stream', vectorData, TelemetryDataType.VECTOR);
      
      expect(result.value).toBeInstanceOf(Array);
      expect(result.value).toHaveLength(3);
      // Check precision rounding
      expect(result.value[0]).toBeCloseTo(1.123457, 5);
      expect(result.value[1]).toBeCloseTo(2.987654, 5);
      expect(result.value[2]).toBeCloseTo(3.555556, 5);
    });

    it('should handle matrix data processing', async () => {
      const matrixData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: [[1.1, 2.2], [3.3, 4.4], [5.5, 6.6]],
        quality: 1.0
      };

      const result = await pipeline.processSingle('matrix_stream', matrixData, TelemetryDataType.MATRIX);
      
      expect(Array.isArray(result.value)).toBe(true);
      expect(result.value).toHaveLength(3);
      expect(result.value[0]).toHaveLength(2);
    });

    it('should handle invalid data gracefully', async () => {
      const invalidData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: NaN,
        quality: 0.5
      };

      const result = await pipeline.processSingle('invalid_stream', invalidData, TelemetryDataType.NUMERIC);
      
      expect(result.value).toBe(0); // Should be cleaned to 0
    });
  });

  describe('Stream Management', () => {
    it('should start and stop streams', () => {
      pipeline.startStream('stream1');
      pipeline.startStream('stream2');
      
      const metrics = pipeline.getMetrics();
      expect(metrics.activeStreams).toBe(2);
      
      pipeline.stopStream('stream1');
      const updatedMetrics = pipeline.getMetrics();
      expect(updatedMetrics.activeStreams).toBe(1);
    });

    it('should enforce maximum concurrent streams', () => {
      const maxStreams = 10;
      
      // Start maximum allowed streams
      for (let i = 0; i < maxStreams; i++) {
        pipeline.startStream(`stream_${i}`);
      }
      
      // Try to start one more (should throw)
      expect(() => pipeline.startStream('extra_stream')).toThrow();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42.0,
        quality: 1.0
      };

      await pipeline.processSingle('perf_stream', testData, TelemetryDataType.NUMERIC);
      
      const metrics = pipeline.getMetrics();
      expect(metrics.totalDataPoints).toBe(1);
      expect(metrics.stageMetrics.size).toBeGreaterThan(0);
    });

    it('should emit performance events', (done) => {
      pipeline.on('performance:update', (metrics) => {
        expect(metrics).toBeDefined();
        expect(metrics.totalStreams).toBeDefined();
        expect(metrics.stageMetrics).toBeDefined();
        done();
      });

      // Trigger performance update by processing data
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 1.0,
        quality: 1.0
      };

      pipeline.processSingle('event_stream', testData, TelemetryDataType.NUMERIC);
    });

    it('should reset metrics', async () => {
      const testData: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: 42.0,
        quality: 1.0
      };

      await pipeline.processSingle('reset_stream', testData, TelemetryDataType.NUMERIC);
      let metrics = pipeline.getMetrics();
      expect(metrics.totalDataPoints).toBe(1);

      pipeline.resetMetrics();
      metrics = pipeline.getMetrics();
      expect(metrics.totalDataPoints).toBe(0);
    });
  });
});

describe('DataTransformationStage', () => {
  let stage: DataTransformationStage;
  let context: ProcessingContext;

  beforeEach(() => {
    stage = new DataTransformationStage();
    context = {
      streamId: 'test_stream',
      timestamp: Date.now(),
      dataType: TelemetryDataType.NUMERIC,
      metadata: {}
    };
  });

  it('should transform numeric data with precision', async () => {
    const data: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 42.123456789,
      quality: 1.0
    };

    const result = await stage.process(data, context);
    expect(result.value).toBeCloseTo(42.123457, 5);
    expect(result.metadata?.transformed).toBe(true);
  });

  it('should handle invalid numeric data', async () => {
    const data: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: Infinity,
      quality: 1.0
    };

    const result = await stage.process(data, context);
    expect(result.value).toBe(0);
  });

  it('should transform vector data', async () => {
    context.dataType = TelemetryDataType.VECTOR;
    const data: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: [1.123456789, 2.987654321, 3.555555555],
      quality: 1.0
    };

    const result = await stage.process(data, context);
    expect(result.value).toHaveLength(3);
    expect(result.value[0]).toBeCloseTo(1.123457, 5);
  });

  it('should handle string data', async () => {
    context.dataType = TelemetryDataType.STRING;
    const data: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: '  test string  ',
      quality: 1.0
    };

    const result = await stage.process(data, context);
    expect(result.value).toBe('test string');
  });

  it('should track metrics', async () => {
    const data: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 42.0,
      quality: 1.0
    };

    await stage.process(data, context);
    const metrics = stage.getMetrics();
    
    expect(metrics.processedCount).toBe(1);
    expect(metrics.errorCount).toBe(0);
    expect(metrics.totalProcessingTime).toBeGreaterThan(0);
  });
});

describe('WindowedOperationsStage', () => {
  let stage: WindowedOperationsStage;
  let context: ProcessingContext;

  beforeEach(() => {
    stage = new WindowedOperationsStage();
    context = {
      streamId: 'test_stream',
      timestamp: Date.now(),
      dataType: TelemetryDataType.NUMERIC,
      metadata: {},
      windowSize: 5
    };
  });

  it('should calculate moving average for numeric data', async () => {
    const values = [1.0, 2.0, 3.0, 4.0, 5.0];
    
    for (const value of values) {
      const data: TelemetryDataPoint = {
        timestamp: Date.now(),
        value,
        quality: 1.0
      };
      
      await stage.process(data, context);
    }

    // Process one more to get the moving average of all 5 values
    const finalData: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 6.0,
      quality: 1.0
    };

    const result = await stage.process(finalData, context);
    expect(result.value).toBeCloseTo(4.0, 2); // Average of [2,3,4,5,6]
  });

  it('should calculate moving average for vector data', async () => {
    context.dataType = TelemetryDataType.VECTOR;
    const vectors = [[1, 2, 3], [2, 3, 4], [3, 4, 5]];
    
    for (const vector of vectors) {
      const data: TelemetryDataPoint = {
        timestamp: Date.now(),
        value: vector,
        quality: 1.0
      };
      
      await stage.process(data, context);
    }

    const finalData: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: [4, 5, 6],
      quality: 1.0
    };

    const result = await stage.process(finalData, context);
    expect(result.value).toHaveLength(3);
    expect(result.value[0]).toBeCloseTo(2.5, 1);
    expect(result.value[1]).toBeCloseTo(3.5, 1);
    expect(result.value[2]).toBeCloseTo(4.5, 1);
  });

  it('should configure window operations', () => {
    const config = {
      operations: {
        'test_stream_numeric': [WindowOperationType.MOVING_AVERAGE, WindowOperationType.MIN, WindowOperationType.MAX]
      },
      windowSizes: {
        'test_stream_numeric': 10
      }
    };

    stage.configure(config);
    // Configuration should not throw and should be stored internally
    expect(() => stage.configure(config)).not.toThrow();
  });

  it('should reset window data', async () => {
    const data: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 42.0,
      quality: 1.0
    };

    await stage.process(data, context);
    stage.reset();
    
    const metrics = stage.getMetrics();
    expect(metrics.processedCount).toBe(0);
  });
});

describe('DataInterpolationStage', () => {
  let stage: DataInterpolationStage;
  let context: ProcessingContext;

  beforeEach(() => {
    stage = new DataInterpolationStage();
    context = {
      streamId: 'test_stream',
      timestamp: Date.now(),
      dataType: TelemetryDataType.NUMERIC,
      metadata: {},
      sampleRate: 10 // 10 Hz
    };
  });

  it('should interpolate missing numeric data points', async () => {
    const baseTime = Date.now();
    const data: TelemetryDataPoint[] = [
      { timestamp: baseTime, value: 0.0, quality: 1.0 },
      { timestamp: baseTime + 500, value: 5.0, quality: 1.0 } // 500ms gap, should interpolate
    ];

    const result = await stage.process(data, context);
    
    // Should have interpolated points between the two
    expect(result.length).toBeGreaterThan(data.length);
    
    // Check that interpolated points have correct metadata
    const interpolatedPoints = result.filter(p => p.metadata?.interpolated);
    expect(interpolatedPoints.length).toBeGreaterThan(0);
    expect(interpolatedPoints[0].metadata?.interpolationMethod).toBe(InterpolationMethod.LINEAR);
  });

  it('should interpolate vector data', async () => {
    context.dataType = TelemetryDataType.VECTOR;
    const baseTime = Date.now();
    const data: TelemetryDataPoint[] = [
      { timestamp: baseTime, value: [0, 0, 0], quality: 1.0 },
      { timestamp: baseTime + 300, value: [3, 6, 9], quality: 1.0 }
    ];

    const result = await stage.process(data, context);
    expect(result.length).toBeGreaterThan(data.length);
  });

  it('should configure interpolation method', () => {
    const config = {
      interpolationMethod: InterpolationMethod.CUBIC,
      maxInterpolationGap: 1000
    };

    stage.configure(config);
    expect(() => stage.configure(config)).not.toThrow();
  });

  it('should not interpolate if gap is too large', async () => {
    stage.configure({ maxInterpolationGap: 100 }); // 100ms max gap
    
    const baseTime = Date.now();
    const data: TelemetryDataPoint[] = [
      { timestamp: baseTime, value: 0.0, quality: 1.0 },
      { timestamp: baseTime + 5000, value: 5.0, quality: 1.0 } // 5 second gap, too large
    ];

    const result = await stage.process(data, context);
    expect(result.length).toBe(data.length); // No interpolation should occur
  });

  it('should handle insufficient data', async () => {
    const data: TelemetryDataPoint[] = [
      { timestamp: Date.now(), value: 42.0, quality: 1.0 }
    ];

    const result = await stage.process(data, context);
    expect(result).toEqual(data); // Should return original data unchanged
  });
});

describe('TimeAlignmentStage', () => {
  let stage: TimeAlignmentStage;
  let context: ProcessingContext;

  beforeEach(() => {
    stage = new TimeAlignmentStage();
    context = {
      streamId: 'test_stream',
      timestamp: Date.now(),
      dataType: TelemetryDataType.NUMERIC,
      metadata: {}
    };
  });

  it('should align multiple streams by time', async () => {
    const baseTime = Date.now();
    const streamData = new Map<string, TelemetryDataPoint[]>();
    
    // Reference stream with regular intervals
    streamData.set('reference', [
      { timestamp: baseTime, value: 1.0, quality: 1.0 },
      { timestamp: baseTime + 100, value: 2.0, quality: 1.0 },
      { timestamp: baseTime + 200, value: 3.0, quality: 1.0 }
    ]);
    
    // Secondary stream with slightly different timestamps
    streamData.set('secondary', [
      { timestamp: baseTime + 5, value: 10.0, quality: 1.0 },
      { timestamp: baseTime + 105, value: 20.0, quality: 1.0 },
      { timestamp: baseTime + 195, value: 30.0, quality: 1.0 }
    ]);

    const result = await stage.process(streamData, context);
    
    expect(result.size).toBe(2);
    
    const referenceData = result.get('reference')!;
    const secondaryData = result.get('secondary')!;
    
    expect(referenceData).toHaveLength(3);
    expect(secondaryData).toHaveLength(3);
    
    // Check that timestamps are aligned
    expect(secondaryData[0].timestamp).toBe(baseTime);
    expect(secondaryData[0].metadata?.timeAligned).toBe(true);
    expect(secondaryData[0].metadata?.originalTimestamp).toBe(baseTime + 5);
  });

  it('should configure tolerance and reference stream', () => {
    const config = {
      toleranceMs: 50,
      referenceStream: 'custom_reference'
    };

    stage.configure(config);
    expect(() => stage.configure(config)).not.toThrow();
  });

  it('should handle empty stream data', async () => {
    const emptyStreamData = new Map<string, TelemetryDataPoint[]>();
    
    const result = await stage.process(emptyStreamData, context);
    expect(result.size).toBe(0);
  });

  it('should handle streams with no alignable points', async () => {
    const baseTime = Date.now();
    const streamData = new Map<string, TelemetryDataPoint[]>();
    
    streamData.set('reference', [
      { timestamp: baseTime, value: 1.0, quality: 1.0 }
    ]);
    
    // Stream with timestamps too far apart
    streamData.set('distant', [
      { timestamp: baseTime + 5000, value: 10.0, quality: 1.0 }
    ]);

    stage.configure({ toleranceMs: 100 });
    const result = await stage.process(streamData, context);
    
    const distantData = result.get('distant')!;
    expect(distantData).toHaveLength(0); // No points within tolerance
  });
});

describe('Pipeline Integration', () => {
  let pipeline: TelemetryProcessingPipeline;

  beforeEach(() => {
    pipeline = new TelemetryProcessingPipeline({
      enablePerformanceMonitoring: false // Disable for cleaner testing
    });
  });

  afterEach(async () => {
    await pipeline.destroy();
  });

  it('should process data through all stages', async () => {
    const testData: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 42.123456789,
      quality: 0.95
    };

    const result = await pipeline.processSingle('integration_stream', testData, TelemetryDataType.NUMERIC);
    
    expect(result).toBeDefined();
    expect(result.value).toBeDefined();
    expect(result.metadata?.transformed).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    // Add a stage that always throws
    const errorStage: ProcessingStage = {
      name: 'error_stage',
      stageType: ProcessingStageType.FILTER,
      inputTypes: [TelemetryDataType.NUMERIC],
      outputTypes: [TelemetryDataType.NUMERIC],
      
      async process(): Promise<any> {
        throw new Error('Test error');
      },
      
      configure(): void {},
      reset(): void {},
      getMetrics() {
        return {
          processedCount: 0,
          totalProcessingTime: 0,
          averageProcessingTime: 0,
          errorCount: 1,
          lastProcessingTime: 0,
          throughput: 0
        };
      }
    };

    pipeline.addStage(errorStage);

    const testData: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 42.0,
      quality: 1.0
    };

    await expect(
      pipeline.processSingle('error_stream', testData, TelemetryDataType.NUMERIC)
    ).rejects.toThrow('Test error');
  });

  it('should skip stages that don\'t support data type', async () => {
    // Add a stage that only supports VECTOR data
    const vectorOnlyStage: ProcessingStage = {
      name: 'vector_only_stage',
      stageType: ProcessingStageType.FILTER,
      inputTypes: [TelemetryDataType.VECTOR],
      outputTypes: [TelemetryDataType.VECTOR],
      
      async process(data: any): Promise<any> {
        return { ...data, processedByVectorStage: true };
      },
      
      configure(): void {},
      reset(): void {},
      getMetrics() {
        return {
          processedCount: 0,
          totalProcessingTime: 0,
          averageProcessingTime: 0,
          errorCount: 0,
          lastProcessingTime: 0,
          throughput: 0
        };
      }
    };

    pipeline.addStage(vectorOnlyStage);

    // Process numeric data - should skip the vector-only stage
    const numericData: TelemetryDataPoint = {
      timestamp: Date.now(),
      value: 42.0,
      quality: 1.0
    };

    const result = await pipeline.processSingle('skip_test_stream', numericData, TelemetryDataType.NUMERIC);
    
    expect(result).toBeDefined();
    expect(result.processedByVectorStage).toBeUndefined(); // Should not be processed by vector stage
  });

  it('should handle high-frequency data processing', async () => {
    const dataPoints: TelemetryDataPoint[] = [];
    const baseTime = Date.now();
    
    // Generate 100 data points at 10ms intervals
    for (let i = 0; i < 100; i++) {
      dataPoints.push({
        timestamp: baseTime + (i * 10),
        value: Math.sin(i * 0.1) * 100,
        quality: 0.95
      });
    }

    const startTime = performance.now();
    const results = await pipeline.processBatch('high_freq_stream', dataPoints, TelemetryDataType.NUMERIC);
    const processingTime = performance.now() - startTime;
    
    expect(results).toHaveLength(dataPoints.length);
    expect(processingTime).toBeLessThan(1000); // Should process 100 points in under 1 second
  });
});