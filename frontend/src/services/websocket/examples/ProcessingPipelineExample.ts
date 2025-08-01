/**
 * Telemetry Processing Pipeline Usage Examples
 * 
 * This file demonstrates various ways to use the processing pipeline
 * for different telemetry data types and scenarios.
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

/**
 * Example 1: Basic Pipeline Setup and Usage
 */
export async function basicPipelineExample(): Promise<void> {
  console.log('=== Basic Pipeline Example ===');
  
  // Create pipeline with custom configuration
  const pipeline = new TelemetryProcessingPipeline({
    maxConcurrentStreams: 50,
    defaultWindowSize: 100,
    interpolationMethod: InterpolationMethod.LINEAR,
    timeAlignmentTolerance: 50,
    enablePerformanceMonitoring: true,
    memoryLimitMB: 200,
    processingTimeout: 2000
  });

  // Set up event listeners
  pipeline.on('data:processed', (streamId, data, stage) => {
    console.log(`Data processed in stage '${stage}' for stream '${streamId}'`);
  });

  pipeline.on('performance:update', (metrics) => {
    console.log('Performance update:', {
      activeStreams: metrics.activeStreams,
      dataPointsPerSecond: metrics.dataPointsPerSecond,
      averageLatency: metrics.averageLatency,
      memoryUsageMB: metrics.memoryUsageMB
    });
  });

  // Process some sample data
  const sampleData: TelemetryDataPoint = {
    timestamp: Date.now(),
    value: 42.123456789,
    quality: 0.95,
    metadata: { sensor: 'temperature_01' }
  };

  try {
    const result = await pipeline.processSingle('temperature_stream', sampleData, TelemetryDataType.NUMERIC);
    console.log('Processed result:', result);
  } catch (error) {
    console.error('Processing failed:', error);
  }

  // Cleanup
  await pipeline.destroy();
}

/**
 * Example 2: Custom Processing Stage
 */
class AnomalyDetectionStage implements ProcessingStage<TelemetryDataPoint, TelemetryDataPoint> {
  readonly name = 'anomaly_detection';
  readonly stageType = ProcessingStageType.VALIDATION;
  readonly inputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR];
  readonly outputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR];

  private thresholds = new Map<string, { min: number; max: number }>();
  private metrics = {
    processedCount: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastProcessingTime: 0,
    throughput: 0
  };

  async process(data: TelemetryDataPoint, context: ProcessingContext): Promise<TelemetryDataPoint> {
    const startTime = performance.now();
    
    try {
      const threshold = this.thresholds.get(context.streamId) || { min: -1000, max: 1000 };
      let isAnomaly = false;

      if (context.dataType === TelemetryDataType.NUMERIC) {
        const value = typeof data.value === 'number' ? data.value : 0;
        isAnomaly = value < threshold.min || value > threshold.max;
      } else if (context.dataType === TelemetryDataType.VECTOR && Array.isArray(data.value)) {
        // Check if any component is out of range
        isAnomaly = data.value.some(v => 
          typeof v === 'number' && (v < threshold.min || v > threshold.max)
        );
      }

      const result = {
        ...data,
        quality: isAnomaly ? (data.quality || 1.0) * 0.5 : data.quality, // Reduce quality if anomaly
        metadata: {
          ...data.metadata,
          anomalyDetected: isAnomaly,
          anomalyThreshold: threshold
        }
      };

      this.updateMetrics(performance.now() - startTime, false);
      return result;

    } catch (error) {
      this.updateMetrics(performance.now() - startTime, true);
      throw error;
    }
  }

  configure(config: Record<string, any>): void {
    if (config.thresholds) {
      for (const [streamId, threshold] of Object.entries(config.thresholds)) {
        this.thresholds.set(streamId, threshold as { min: number; max: number });
      }
    }
  }

  reset(): void {
    this.thresholds.clear();
    this.metrics = {
      processedCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      lastProcessingTime: 0,
      throughput: 0
    };
  }

  getMetrics() {
    return { ...this.metrics };
  }

  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.processedCount++;
    if (isError) this.metrics.errorCount++;
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processedCount;
    this.metrics.throughput = (this.metrics.processedCount * 1000) / Math.max(this.metrics.totalProcessingTime, 1000);
  }
}

export async function customStageExample(): Promise<void> {
  console.log('=== Custom Stage Example ===');
  
  const pipeline = new TelemetryProcessingPipeline();
  
  // Add custom anomaly detection stage
  const anomalyStage = new AnomalyDetectionStage();
  pipeline.addStage(anomalyStage, 1); // Insert after data transformation
  
  // Configure anomaly thresholds
  pipeline.configureStage('anomaly_detection', {
    thresholds: {
      'temperature_stream': { min: -50, max: 150 },
      'pressure_stream': { min: 0, max: 1000 },
      'accelerometer_stream': { min: -10, max: 10 }
    }
  });

  // Test with normal data
  const normalData: TelemetryDataPoint = {
    timestamp: Date.now(),
    value: 25.5, // Normal temperature
    quality: 1.0
  };

  const normalResult = await pipeline.processSingle('temperature_stream', normalData, TelemetryDataType.NUMERIC);
  console.log('Normal data result:', {
    value: normalResult.value,
    quality: normalResult.quality,
    anomalyDetected: normalResult.metadata?.anomalyDetected
  });

  // Test with anomalous data
  const anomalousData: TelemetryDataPoint = {
    timestamp: Date.now(),
    value: 200.0, // Anomalous temperature
    quality: 1.0
  };

  const anomalousResult = await pipeline.processSingle('temperature_stream', anomalousData, TelemetryDataType.NUMERIC);
  console.log('Anomalous data result:', {
    value: anomalousResult.value,
    quality: anomalousResult.quality,
    anomalyDetected: anomalousResult.metadata?.anomalyDetected
  });

  await pipeline.destroy();
}

/**
 * Example 3: Windowed Operations Configuration
 */
export async function windowedOperationsExample(): Promise<void> {
  console.log('=== Windowed Operations Example ===');
  
  const pipeline = new TelemetryProcessingPipeline({
    defaultWindowSize: 10
  });

  // Configure windowed operations for different streams
  pipeline.configureStage('windowed_operations', {
    operations: {
      'sensor_01_numeric': [
        WindowOperationType.MOVING_AVERAGE,
        WindowOperationType.MIN,
        WindowOperationType.MAX,
        WindowOperationType.STANDARD_DEVIATION
      ],
      'accelerometer_vector': [
        WindowOperationType.MOVING_AVERAGE,
        WindowOperationType.RATE_OF_CHANGE
      ]
    },
    windowSizes: {
      'sensor_01_numeric': 20,
      'accelerometer_vector': 15
    }
  });

  // Simulate sensor data stream
  const sensorValues = [10, 12, 11, 13, 15, 14, 16, 18, 17, 19, 20, 22, 21, 23, 25];
  
  console.log('Processing sensor data through windowed operations...');
  
  for (let i = 0; i < sensorValues.length; i++) {
    const data: TelemetryDataPoint = {
      timestamp: Date.now() + i * 100,
      value: sensorValues[i],
      quality: 1.0
    };

    const result = await pipeline.processSingle('sensor_01', data, TelemetryDataType.NUMERIC);
    
    if (i >= 5) { // Start showing results after some window is built
      console.log(`Sample ${i + 1}:`, {
        original: data.value,
        processed: typeof result.value === 'object' ? result.value : result.value,
        windowSize: result.metadata?.windowSize
      });
    }
  }

  await pipeline.destroy();
}

/**
 * Example 4: Data Interpolation
 */
export async function interpolationExample(): Promise<void> {
  console.log('=== Data Interpolation Example ===');
  
  const pipeline = new TelemetryProcessingPipeline();
  
  // Configure interpolation
  pipeline.configureStage('data_interpolation', {
    interpolationMethod: InterpolationMethod.LINEAR,
    maxInterpolationGap: 2000 // 2 seconds
  });

  // Create data with gaps
  const baseTime = Date.now();
  const dataWithGaps: TelemetryDataPoint[] = [
    { timestamp: baseTime, value: 0.0, quality: 1.0 },
    { timestamp: baseTime + 500, value: 5.0, quality: 1.0 }, // 500ms gap - should interpolate
    { timestamp: baseTime + 1500, value: 10.0, quality: 1.0 }, // 1000ms gap - should interpolate
    { timestamp: baseTime + 6000, value: 15.0, quality: 1.0 } // 4500ms gap - too large, no interpolation
  ];

  console.log('Original data points:', dataWithGaps.length);

  // Process data through interpolation stage
  const interpolationStage = new DataInterpolationStage();
  const context: ProcessingContext = {
    streamId: 'test_stream',
    timestamp: Date.now(),
    dataType: TelemetryDataType.NUMERIC,
    metadata: {},
    sampleRate: 10 // 10 Hz expected
  };

  const interpolatedData = await interpolationStage.process(dataWithGaps, context);
  console.log('After interpolation:', interpolatedData.length);
  
  // Show interpolated points
  const interpolatedPoints = interpolatedData.filter(p => p.metadata?.interpolated);
  console.log('Interpolated points:', interpolatedPoints.length);
  
  interpolatedPoints.slice(0, 5).forEach((point, index) => {
    console.log(`Interpolated ${index + 1}:`, {
      timestamp: new Date(point.timestamp).toISOString(),
      value: point.value,
      quality: point.quality,
      interpolationFactor: point.metadata?.interpolationFactor
    });
  });

  await pipeline.destroy();
}

/**
 * Example 5: Time Alignment for Multiple Streams
 */
export async function timeAlignmentExample(): Promise<void> {
  console.log('=== Time Alignment Example ===');
  
  const pipeline = new TelemetryProcessingPipeline();
  
  // Configure time alignment
  pipeline.configureStage('time_alignment', {
    toleranceMs: 25, // 25ms tolerance
    referenceStream: 'primary_sensor'
  });

  const baseTime = Date.now();
  
  // Create misaligned stream data
  const streamData = new Map<string, TelemetryDataPoint[]>();
  
  // Primary sensor (reference)
  streamData.set('primary_sensor', [
    { timestamp: baseTime, value: 1.0, quality: 1.0 },
    { timestamp: baseTime + 100, value: 2.0, quality: 1.0 },
    { timestamp: baseTime + 200, value: 3.0, quality: 1.0 },
    { timestamp: baseTime + 300, value: 4.0, quality: 1.0 }
  ]);
  
  // Secondary sensor (slightly offset)
  streamData.set('secondary_sensor', [
    { timestamp: baseTime + 15, value: 10.0, quality: 1.0 },
    { timestamp: baseTime + 115, value: 20.0, quality: 1.0 },
    { timestamp: baseTime + 185, value: 30.0, quality: 1.0 },
    { timestamp: baseTime + 305, value: 40.0, quality: 1.0 }
  ]);
  
  // Tertiary sensor (different offset)
  streamData.set('tertiary_sensor', [
    { timestamp: baseTime - 10, value: 100.0, quality: 1.0 },
    { timestamp: baseTime + 95, value: 200.0, quality: 1.0 },
    { timestamp: baseTime + 210, value: 300.0, quality: 1.0 },
    { timestamp: baseTime + 290, value: 400.0, quality: 1.0 }
  ]);

  console.log('Original stream timestamps:');
  streamData.forEach((data, streamId) => {
    console.log(`${streamId}:`, data.map(p => p.timestamp - baseTime));
  });

  // Apply time alignment
  const alignmentStage = new TimeAlignmentStage();
  const context: ProcessingContext = {
    streamId: 'alignment_test',
    timestamp: Date.now(),
    dataType: TelemetryDataType.NUMERIC,
    metadata: {}
  };

  const alignedData = await alignmentStage.process(streamData, context);
  
  console.log('Aligned stream timestamps:');
  alignedData.forEach((data, streamId) => {
    console.log(`${streamId}:`, data.map(p => ({
      aligned: p.timestamp - baseTime,
      original: p.metadata?.originalTimestamp ? p.metadata.originalTimestamp - baseTime : 'N/A',
      error: p.metadata?.alignmentError || 0
    })));
  });

  await pipeline.destroy();
}

/**
 * Example 6: High-Performance Batch Processing
 */
export async function batchProcessingExample(): Promise<void> {
  console.log('=== Batch Processing Example ===');
  
  const pipeline = new TelemetryProcessingPipeline({
    maxConcurrentStreams: 20,
    enablePerformanceMonitoring: true
  });

  // Generate large dataset
  const batchSize = 1000;
  const batch: TelemetryDataPoint[] = [];
  const baseTime = Date.now();

  for (let i = 0; i < batchSize; i++) {
    batch.push({
      timestamp: baseTime + i * 10, // 10ms intervals
      value: Math.sin(i * 0.01) * 100 + Math.random() * 10, // Sine wave with noise
      quality: 0.95 + Math.random() * 0.05
    });
  }

  console.log(`Processing batch of ${batchSize} data points...`);
  
  const startTime = performance.now();
  const results = await pipeline.processBatch('batch_stream', batch, TelemetryDataType.NUMERIC);
  const processingTime = performance.now() - startTime;

  console.log('Batch processing completed:', {
    inputPoints: batch.length,
    outputPoints: results.length,
    processingTimeMs: processingTime.toFixed(2),
    throughputHz: (batch.length / (processingTime / 1000)).toFixed(0)
  });

  // Show performance metrics
  const metrics = pipeline.getMetrics();
  console.log('Pipeline metrics:', {
    totalDataPoints: metrics.totalDataPoints,
    dataPointsPerSecond: metrics.dataPointsPerSecond.toFixed(1),
    memoryUsageMB: metrics.memoryUsageMB.toFixed(2),
    bottlenecks: metrics.bottlenecks
  });

  await pipeline.destroy();
}

/**
 * Example 7: Multi-Stream Real-time Processing Simulation
 */
export async function multiStreamExample(): Promise<void> {
  console.log('=== Multi-Stream Processing Example ===');
  
  const pipeline = new TelemetryProcessingPipeline({
    maxConcurrentStreams: 10,
    enablePerformanceMonitoring: true
  });

  // Define multiple stream types
  const streams = [
    { id: 'temperature_01', type: TelemetryDataType.NUMERIC, frequency: 5 }, // 5 Hz
    { id: 'pressure_01', type: TelemetryDataType.NUMERIC, frequency: 10 }, // 10 Hz
    { id: 'accelerometer_01', type: TelemetryDataType.VECTOR, frequency: 50 }, // 50 Hz
    { id: 'gyroscope_01', type: TelemetryDataType.VECTOR, frequency: 50 }, // 50 Hz
    { id: 'gps_position', type: TelemetryDataType.VECTOR, frequency: 1 } // 1 Hz
  ];

  // Start all streams
  streams.forEach(stream => pipeline.startStream(stream.id));

  // Simulate data generation for 5 seconds
  const simulationDuration = 5000; // 5 seconds
  const startTime = Date.now();
  
  console.log('Starting multi-stream simulation...');

  // Generate data for each stream based on its frequency
  const dataGenerators = streams.map(stream => {
    const interval = 1000 / stream.frequency; // Interval in ms
    let lastGeneration = startTime;
    let sampleCount = 0;

    return {
      ...stream,
      interval,
      lastGeneration,
      sampleCount,
      generateNext(): TelemetryDataPoint | null {
        const now = Date.now();
        if (now - this.lastGeneration >= this.interval) {
          this.lastGeneration = now;
          this.sampleCount++;

          switch (this.type) {
            case TelemetryDataType.NUMERIC:
              return {
                timestamp: now,
                value: Math.sin(this.sampleCount * 0.1) * 50 + 25 + Math.random() * 5,
                quality: 0.95 + Math.random() * 0.05
              };
            
            case TelemetryDataType.VECTOR:
              if (this.id.includes('accelerometer')) {
                return {
                  timestamp: now,
                  value: [
                    Math.sin(this.sampleCount * 0.1) * 2,
                    Math.cos(this.sampleCount * 0.1) * 2,
                    9.81 + Math.random() * 0.5
                  ],
                  quality: 0.98
                };
              } else if (this.id.includes('gyroscope')) {
                return {
                  timestamp: now,
                  value: [
                    Math.random() * 0.1 - 0.05,
                    Math.random() * 0.1 - 0.05,
                    Math.random() * 0.1 - 0.05
                  ],
                  quality: 0.97
                };
              } else if (this.id.includes('gps')) {
                return {
                  timestamp: now,
                  value: [
                    40.7128 + Math.random() * 0.001, // Latitude (NYC area)
                    -74.0060 + Math.random() * 0.001, // Longitude
                    10 + Math.random() * 5 // Altitude
                  ],
                  quality: 0.92
                };
              }
              break;
          }
        }
        return null;
      }
    };
  });

  // Process data as it's generated
  const processData = async () => {
    for (const generator of dataGenerators) {
      const data = generator.generateNext();
      if (data) {
        try {
          await pipeline.processSingle(generator.id, data, generator.type);
        } catch (error) {
          console.error(`Error processing ${generator.id}:`, error);
        }
      }
    }
  };

  // Run simulation
  const processingInterval = setInterval(processData, 10); // Check every 10ms

  // Stop after duration
  setTimeout(() => {
    clearInterval(processingInterval);
    
    // Show final metrics
    const metrics = pipeline.getMetrics();
    console.log('Multi-stream simulation completed:', {
      activeStreams: metrics.activeStreams,
      totalDataPoints: metrics.totalDataPoints,
      dataPointsPerSecond: metrics.dataPointsPerSecond.toFixed(1),
      averageLatency: metrics.averageLatency.toFixed(2) + 'ms',
      memoryUsageMB: metrics.memoryUsageMB.toFixed(2),
      bottlenecks: metrics.bottlenecks
    });

    // Show per-stage metrics
    console.log('Stage performance:');
    metrics.stageMetrics.forEach((stageMetrics, stageName) => {
      console.log(`  ${stageName}:`, {
        processed: stageMetrics.processedCount,
        avgTime: stageMetrics.averageProcessingTime.toFixed(3) + 'ms',
        throughput: stageMetrics.throughput.toFixed(1) + 'Hz',
        errors: stageMetrics.errorCount
      });
    });

    pipeline.destroy();
  }, simulationDuration);
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('Running Telemetry Processing Pipeline Examples...\n');
  
  try {
    await basicPipelineExample();
    console.log('\n');
    
    await customStageExample();
    console.log('\n');
    
    await windowedOperationsExample();
    console.log('\n');
    
    await interpolationExample();
    console.log('\n');
    
    await timeAlignmentExample();
    console.log('\n');
    
    await batchProcessingExample();
    console.log('\n');
    
    await multiStreamExample();
    
    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// If running directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}