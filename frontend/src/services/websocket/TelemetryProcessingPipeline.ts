/**
 * Streaming Data Processing Pipeline
 * 
 * High-performance telemetry data processing pipeline with pluggable stages,
 * windowed operations, data transformations, and time-alignment capabilities.
 * 
 * Features:
 * - Pluggable processing stages architecture
 * - Real-time data transformations for different telemetry types
 * - Windowed operations (moving averages, min/max, statistics)
 * - Derived calculations on raw telemetry
 * - Data interpolation for missing samples
 * - Time-alignment system for multi-source data
 * - Performance monitoring and optimization
 */

import { TelemetryDataPoint, TelemetryDataType } from './TelemetryManager';
import { EventEmitter } from './EventEmitter';

/**
 * Processing stage interface for pipeline components
 */
export interface ProcessingStage<TInput = any, TOutput = any> {
  readonly name: string;
  readonly stageType: ProcessingStageType;
  readonly inputTypes: TelemetryDataType[];
  readonly outputTypes: TelemetryDataType[];
  
  process(data: TInput, context: ProcessingContext): Promise<TOutput>;
  configure(config: Record<string, any>): void;
  reset(): void;
  getMetrics(): ProcessingStageMetrics;
}

/**
 * Types of processing stages
 */
export enum ProcessingStageType {
  TRANSFORMATION = 'transformation',
  AGGREGATION = 'aggregation',
  FILTER = 'filter',
  INTERPOLATION = 'interpolation',
  VALIDATION = 'validation',
  ENRICHMENT = 'enrichment'
}

/**
 * Processing context for stage execution
 */
export interface ProcessingContext {
  streamId: string;
  timestamp: number;
  dataType: TelemetryDataType;
  metadata: Record<string, any>;
  windowSize?: number;
  sampleRate?: number;
  quality?: number;
}

/**
 * Stage performance metrics
 */
export interface ProcessingStageMetrics {
  processedCount: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  errorCount: number;
  lastProcessingTime: number;
  throughput: number; // items per second
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  maxConcurrentStreams: number;
  defaultWindowSize: number;
  interpolationMethod: InterpolationMethod;
  timeAlignmentTolerance: number; // milliseconds
  enablePerformanceMonitoring: boolean;
  memoryLimitMB: number;
  processingTimeout: number; // milliseconds
}

/**
 * Interpolation methods for missing data
 */
export enum InterpolationMethod {
  LINEAR = 'linear',
  CUBIC = 'cubic',
  NEAREST = 'nearest',
  ZERO_ORDER_HOLD = 'zero_order_hold',
  FORWARD_FILL = 'forward_fill',
  BACKWARD_FILL = 'backward_fill'
}

/**
 * Window operation types
 */
export enum WindowOperationType {
  MOVING_AVERAGE = 'moving_average',
  WEIGHTED_AVERAGE = 'weighted_average',
  MIN = 'min',
  MAX = 'max',
  MEDIAN = 'median',
  STANDARD_DEVIATION = 'standard_deviation',
  VARIANCE = 'variance',
  SUM = 'sum',
  COUNT = 'count',
  RATE_OF_CHANGE = 'rate_of_change',
  DERIVATIVE = 'derivative',
  INTEGRAL = 'integral'
}

/**
 * Pipeline execution events
 */
export interface PipelineEvents {
  'data:processed': (streamId: string, data: TelemetryDataPoint, stage: string) => void;
  'data:error': (streamId: string, error: Error, stage: string) => void;
  'pipeline:started': (streamId: string) => void;
  'pipeline:stopped': (streamId: string) => void;
  'stage:added': (stageName: string) => void;
  'stage:removed': (stageName: string) => void;
  'performance:update': (metrics: PipelinePerformanceMetrics) => void;
  'memory:warning': (usageMB: number, limitMB: number) => void;
}

/**
 * Pipeline performance metrics
 */
export interface PipelinePerformanceMetrics {
  totalStreams: number;
  activeStreams: number;
  totalDataPoints: number;
  dataPointsPerSecond: number;
  averageLatency: number;
  memoryUsageMB: number;
  stageMetrics: Map<string, ProcessingStageMetrics>;
  bottlenecks: string[];
}

/**
 * Data transformation stage for type-specific operations
 */
export class DataTransformationStage implements ProcessingStage<TelemetryDataPoint, TelemetryDataPoint> {
  readonly name = 'data_transformation';
  readonly stageType = ProcessingStageType.TRANSFORMATION;
  readonly inputTypes = [
    TelemetryDataType.NUMERIC,
    TelemetryDataType.VECTOR,
    TelemetryDataType.MATRIX,
    TelemetryDataType.STRING,
    TelemetryDataType.BOOLEAN,
    TelemetryDataType.OBJECT
  ];
  readonly outputTypes = this.inputTypes;

  private transformations = new Map<TelemetryDataType, (data: any) => any>();
  private metrics: ProcessingStageMetrics = {
    processedCount: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastProcessingTime: 0,
    throughput: 0
  };

  constructor() {
    this.initializeDefaultTransformations();
  }

  async process(data: TelemetryDataPoint, context: ProcessingContext): Promise<TelemetryDataPoint> {
    const startTime = performance.now();
    
    try {
      const transformation = this.transformations.get(context.dataType);
      if (!transformation) {
        return data; // Pass through if no transformation defined
      }

      const transformedValue = transformation(data.value);
      const result = {
        ...data,
        value: transformedValue,
        metadata: {
          ...data.metadata,
          transformed: true,
          transformationType: context.dataType,
          transformationTimestamp: context.timestamp
        }
      };

      this.updateMetrics(performance.now() - startTime, false);
      return result;

    } catch (error) {
      this.updateMetrics(performance.now() - startTime, true);
      throw new Error(`Data transformation failed: ${error}`);
    }
  }

  configure(config: Record<string, any>): void {
    // Configure custom transformations
    if (config.transformations) {
      for (const [dataType, transformFn] of Object.entries(config.transformations)) {
        this.transformations.set(dataType as TelemetryDataType, transformFn as (data: any) => any);
      }
    }
  }

  reset(): void {
    this.metrics = {
      processedCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      lastProcessingTime: 0,
      throughput: 0
    };
  }

  getMetrics(): ProcessingStageMetrics {
    return { ...this.metrics };
  }

  private initializeDefaultTransformations(): void {
    // Numeric data transformations
    this.transformations.set(TelemetryDataType.NUMERIC, (value: number) => {
      if (typeof value !== 'number' || !isFinite(value)) {
        return 0;
      }
      return Math.round(value * 1000000) / 1000000; // 6 decimal precision
    });

    // Vector data transformations
    this.transformations.set(TelemetryDataType.VECTOR, (value: number[]) => {
      if (!Array.isArray(value)) return [0, 0, 0];
      return value.map(v => typeof v === 'number' && isFinite(v) ? 
        Math.round(v * 1000000) / 1000000 : 0);
    });

    // Matrix data transformations
    this.transformations.set(TelemetryDataType.MATRIX, (value: number[][]) => {
      if (!Array.isArray(value)) return [[0]];
      return value.map(row => 
        Array.isArray(row) ? 
          row.map(v => typeof v === 'number' && isFinite(v) ? 
            Math.round(v * 1000000) / 1000000 : 0) : 
          [0]
      );
    });

    // String data transformations
    this.transformations.set(TelemetryDataType.STRING, (value: string) => {
      return typeof value === 'string' ? value.trim() : '';
    });

    // Boolean data transformations
    this.transformations.set(TelemetryDataType.BOOLEAN, (value: boolean) => {
      return Boolean(value);
    });

    // Object data transformations
    this.transformations.set(TelemetryDataType.OBJECT, (value: any) => {
      return value !== null && typeof value === 'object' ? value : {};
    });
  }

  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.processedCount++;
    if (isError) {
      this.metrics.errorCount++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processedCount;
    
    // Estimate throughput (items per second)
    const recentWindowMs = 5000; // 5 second window
    this.metrics.throughput = (this.metrics.processedCount * 1000) / Math.max(this.metrics.totalProcessingTime, recentWindowMs);
  }
}

/**
 * Windowed operations stage for statistical calculations
 */
export class WindowedOperationsStage implements ProcessingStage<TelemetryDataPoint, TelemetryDataPoint> {
  readonly name = 'windowed_operations';
  readonly stageType = ProcessingStageType.AGGREGATION;
  readonly inputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR];
  readonly outputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR, TelemetryDataType.OBJECT];

  private windows = new Map<string, TelemetryDataPoint[]>();
  private operations = new Map<string, WindowOperationType[]>();
  private windowSizes = new Map<string, number>();
  private metrics: ProcessingStageMetrics = {
    processedCount: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastProcessingTime: 0,
    throughput: 0
  };

  async process(data: TelemetryDataPoint, context: ProcessingContext): Promise<TelemetryDataPoint> {
    const startTime = performance.now();
    const windowKey = `${context.streamId}_${context.dataType}`;
    
    try {
      // Initialize window if not exists
      if (!this.windows.has(windowKey)) {
        this.windows.set(windowKey, []);
        this.windowSizes.set(windowKey, context.windowSize || 100);
        this.operations.set(windowKey, [WindowOperationType.MOVING_AVERAGE]);
      }

      const window = this.windows.get(windowKey)!;
      const windowSize = this.windowSizes.get(windowKey)!;
      const operations = this.operations.get(windowKey)!;

      // Add new data point to window
      window.push(data);

      // Maintain window size
      if (window.length > windowSize) {
        window.splice(0, window.length - windowSize);
      }

      // Calculate windowed operations
      const derivedData = this.calculateWindowedOperations(window, operations, context.dataType);

      const result: TelemetryDataPoint = {
        timestamp: data.timestamp,
        value: derivedData,
        quality: data.quality,
        metadata: {
          ...data.metadata,
          windowSize: window.length,
          windowOperations: operations,
          derived: true
        }
      };

      this.updateMetrics(performance.now() - startTime, false);
      return result;

    } catch (error) {
      this.updateMetrics(performance.now() - startTime, true);
      throw new Error(`Windowed operations failed: ${error}`);
    }
  }

  configure(config: Record<string, any>): void {
    if (config.operations) {
      for (const [streamKey, ops] of Object.entries(config.operations)) {
        this.operations.set(streamKey, ops as WindowOperationType[]);
      }
    }
    
    if (config.windowSizes) {
      for (const [streamKey, size] of Object.entries(config.windowSizes)) {
        this.windowSizes.set(streamKey, size as number);
      }
    }
  }

  reset(): void {
    this.windows.clear();
    this.operations.clear();
    this.windowSizes.clear();
    this.metrics = {
      processedCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      lastProcessingTime: 0,
      throughput: 0
    };
  }

  getMetrics(): ProcessingStageMetrics {
    return { ...this.metrics };
  }

  private calculateWindowedOperations(
    window: TelemetryDataPoint[], 
    operations: WindowOperationType[], 
    dataType: TelemetryDataType
  ): any {
    const result: Record<string, any> = {};

    for (const operation of operations) {
      switch (operation) {
        case WindowOperationType.MOVING_AVERAGE:
          result.movingAverage = this.calculateMovingAverage(window, dataType);
          break;
        case WindowOperationType.MIN:
          result.min = this.calculateMin(window, dataType);
          break;
        case WindowOperationType.MAX:
          result.max = this.calculateMax(window, dataType);
          break;
        case WindowOperationType.MEDIAN:
          result.median = this.calculateMedian(window, dataType);
          break;
        case WindowOperationType.STANDARD_DEVIATION:
          result.standardDeviation = this.calculateStandardDeviation(window, dataType);
          break;
        case WindowOperationType.RATE_OF_CHANGE:
          result.rateOfChange = this.calculateRateOfChange(window, dataType);
          break;
        default:
          console.warn(`Unsupported operation: ${operation}`);
      }
    }

    return Object.keys(result).length === 1 ? Object.values(result)[0] : result;
  }

  private calculateMovingAverage(window: TelemetryDataPoint[], dataType: TelemetryDataType): any {
    if (window.length === 0) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    if (dataType === TelemetryDataType.NUMERIC) {
      const values = window.map(p => typeof p.value === 'number' ? p.value : 0);
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    } else if (dataType === TelemetryDataType.VECTOR) {
      const vectors = window.map(p => Array.isArray(p.value) ? p.value : [0, 0, 0]);
      const dimensions = Math.max(...vectors.map(v => v.length));
      const result = new Array(dimensions).fill(0);
      
      for (let i = 0; i < dimensions; i++) {
        const dimensionValues = vectors.map(v => v[i] || 0);
        result[i] = dimensionValues.reduce((sum, val) => sum + val, 0) / dimensionValues.length;
      }
      
      return result;
    }

    return 0;
  }

  private calculateMin(window: TelemetryDataPoint[], dataType: TelemetryDataType): any {
    if (window.length === 0) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    if (dataType === TelemetryDataType.NUMERIC) {
      const values = window.map(p => typeof p.value === 'number' ? p.value : 0);
      return Math.min(...values);
    } else if (dataType === TelemetryDataType.VECTOR) {
      const vectors = window.map(p => Array.isArray(p.value) ? p.value : [0, 0, 0]);
      const dimensions = Math.max(...vectors.map(v => v.length));
      const result = new Array(dimensions).fill(Infinity);
      
      for (let i = 0; i < dimensions; i++) {
        const dimensionValues = vectors.map(v => v[i] || 0);
        result[i] = Math.min(...dimensionValues);
      }
      
      return result;
    }

    return 0;
  }

  private calculateMax(window: TelemetryDataPoint[], dataType: TelemetryDataType): any {
    if (window.length === 0) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    if (dataType === TelemetryDataType.NUMERIC) {
      const values = window.map(p => typeof p.value === 'number' ? p.value : 0);
      return Math.max(...values);
    } else if (dataType === TelemetryDataType.VECTOR) {
      const vectors = window.map(p => Array.isArray(p.value) ? p.value : [0, 0, 0]);
      const dimensions = Math.max(...vectors.map(v => v.length));
      const result = new Array(dimensions).fill(-Infinity);
      
      for (let i = 0; i < dimensions; i++) {
        const dimensionValues = vectors.map(v => v[i] || 0);
        result[i] = Math.max(...dimensionValues);
      }
      
      return result;
    }

    return 0;
  }

  private calculateMedian(window: TelemetryDataPoint[], dataType: TelemetryDataType): any {
    if (window.length === 0) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    if (dataType === TelemetryDataType.NUMERIC) {
      const values = window.map(p => typeof p.value === 'number' ? p.value : 0).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    } else if (dataType === TelemetryDataType.VECTOR) {
      const vectors = window.map(p => Array.isArray(p.value) ? p.value : [0, 0, 0]);
      const dimensions = Math.max(...vectors.map(v => v.length));
      const result = new Array(dimensions).fill(0);
      
      for (let i = 0; i < dimensions; i++) {
        const dimensionValues = vectors.map(v => v[i] || 0).sort((a, b) => a - b);
        const mid = Math.floor(dimensionValues.length / 2);
        result[i] = dimensionValues.length % 2 === 0 ? 
          (dimensionValues[mid - 1] + dimensionValues[mid]) / 2 : 
          dimensionValues[mid];
      }
      
      return result;
    }

    return 0;
  }

  private calculateStandardDeviation(window: TelemetryDataPoint[], dataType: TelemetryDataType): any {
    if (window.length === 0) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    if (dataType === TelemetryDataType.NUMERIC) {
      const values = window.map(p => typeof p.value === 'number' ? p.value : 0);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      return Math.sqrt(variance);
    } else if (dataType === TelemetryDataType.VECTOR) {
      const vectors = window.map(p => Array.isArray(p.value) ? p.value : [0, 0, 0]);
      const dimensions = Math.max(...vectors.map(v => v.length));
      const result = new Array(dimensions).fill(0);
      
      for (let i = 0; i < dimensions; i++) {
        const dimensionValues = vectors.map(v => v[i] || 0);
        const mean = dimensionValues.reduce((sum, val) => sum + val, 0) / dimensionValues.length;
        const variance = dimensionValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dimensionValues.length;
        result[i] = Math.sqrt(variance);
      }
      
      return result;
    }

    return 0;
  }

  private calculateRateOfChange(window: TelemetryDataPoint[], dataType: TelemetryDataType): any {
    if (window.length < 2) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    const first = window[0];
    const last = window[window.length - 1];
    const timeDelta = (last.timestamp - first.timestamp) / 1000; // Convert to seconds

    if (timeDelta === 0) return dataType === TelemetryDataType.VECTOR ? [0, 0, 0] : 0;

    if (dataType === TelemetryDataType.NUMERIC) {
      const firstValue = typeof first.value === 'number' ? first.value : 0;
      const lastValue = typeof last.value === 'number' ? last.value : 0;
      return (lastValue - firstValue) / timeDelta;
    } else if (dataType === TelemetryDataType.VECTOR) {
      const firstVector = Array.isArray(first.value) ? first.value : [0, 0, 0];
      const lastVector = Array.isArray(last.value) ? last.value : [0, 0, 0];
      const dimensions = Math.max(firstVector.length, lastVector.length);
      const result = new Array(dimensions).fill(0);
      
      for (let i = 0; i < dimensions; i++) {
        const firstVal = firstVector[i] || 0;
        const lastVal = lastVector[i] || 0;
        result[i] = (lastVal - firstVal) / timeDelta;
      }
      
      return result;
    }

    return 0;
  }

  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.processedCount++;
    if (isError) {
      this.metrics.errorCount++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processedCount;
    
    const recentWindowMs = 5000;
    this.metrics.throughput = (this.metrics.processedCount * 1000) / Math.max(this.metrics.totalProcessingTime, recentWindowMs);
  }
}

/**
 * Data interpolation stage for handling missing samples
 */
export class DataInterpolationStage implements ProcessingStage<TelemetryDataPoint[], TelemetryDataPoint[]> {
  readonly name = 'data_interpolation';
  readonly stageType = ProcessingStageType.INTERPOLATION;
  readonly inputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR];
  readonly outputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR];

  private interpolationMethod: InterpolationMethod = InterpolationMethod.LINEAR;
  private maxInterpolationGap = 5000; // 5 seconds in milliseconds
  private metrics: ProcessingStageMetrics = {
    processedCount: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastProcessingTime: 0,
    throughput: 0
  };

  async process(data: TelemetryDataPoint[], context: ProcessingContext): Promise<TelemetryDataPoint[]> {
    const startTime = performance.now();
    
    try {
      if (data.length <= 1) return data; // Cannot interpolate with insufficient data

      const interpolatedData = this.interpolateMissingData(data, context);
      
      this.updateMetrics(performance.now() - startTime, false);
      return interpolatedData;

    } catch (error) {
      this.updateMetrics(performance.now() - startTime, true);
      throw new Error(`Data interpolation failed: ${error}`);
    }
  }

  configure(config: Record<string, any>): void {
    if (config.interpolationMethod) {
      this.interpolationMethod = config.interpolationMethod;
    }
    if (config.maxInterpolationGap) {
      this.maxInterpolationGap = config.maxInterpolationGap;
    }
  }

  reset(): void {
    this.metrics = {
      processedCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      lastProcessingTime: 0,
      throughput: 0
    };
  }

  getMetrics(): ProcessingStageMetrics {
    return { ...this.metrics };
  }

  private interpolateMissingData(data: TelemetryDataPoint[], context: ProcessingContext): TelemetryDataPoint[] {
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const result: TelemetryDataPoint[] = [];
    
    for (let i = 0; i < sortedData.length - 1; i++) {
      const current = sortedData[i];
      const next = sortedData[i + 1];
      
      result.push(current);
      
      // Check if interpolation is needed
      const timeDiff = next.timestamp - current.timestamp;
      const sampleRate = context.sampleRate || 10; // Default 10 Hz
      const expectedInterval = 1000 / sampleRate;
      const missingSamples = Math.floor(timeDiff / expectedInterval) - 1;
      
      if (missingSamples > 0 && timeDiff <= this.maxInterpolationGap) {
        const interpolatedPoints = this.generateInterpolatedPoints(
          current, 
          next, 
          missingSamples, 
          context.dataType
        );
        result.push(...interpolatedPoints);
      }
    }
    
    // Add the last point
    if (sortedData.length > 0) {
      result.push(sortedData[sortedData.length - 1]);
    }
    
    return result;
  }

  private generateInterpolatedPoints(
    start: TelemetryDataPoint, 
    end: TelemetryDataPoint, 
    count: number, 
    dataType: TelemetryDataType
  ): TelemetryDataPoint[] {
    const result: TelemetryDataPoint[] = [];
    const timeDiff = end.timestamp - start.timestamp;
    const timeStep = timeDiff / (count + 1);
    
    for (let i = 1; i <= count; i++) {
      const timestamp = start.timestamp + (timeStep * i);
      const interpolatedValue = this.interpolateValue(start.value, end.value, i / (count + 1), dataType);
      
      result.push({
        timestamp,
        value: interpolatedValue,
        quality: Math.min(start.quality || 1, end.quality || 1) * 0.8, // Reduced quality for interpolated data
        metadata: {
          interpolated: true,
          interpolationMethod: this.interpolationMethod,
          interpolationFactor: i / (count + 1)
        }
      });
    }
    
    return result;
  }

  private interpolateValue(startValue: any, endValue: any, factor: number, dataType: TelemetryDataType): any {
    switch (this.interpolationMethod) {
      case InterpolationMethod.LINEAR:
        return this.linearInterpolation(startValue, endValue, factor, dataType);
      case InterpolationMethod.CUBIC:
        return this.cubicInterpolation(startValue, endValue, factor, dataType);
      case InterpolationMethod.NEAREST:
        return factor < 0.5 ? startValue : endValue;
      case InterpolationMethod.ZERO_ORDER_HOLD:
        return startValue;
      case InterpolationMethod.FORWARD_FILL:
        return endValue;
      case InterpolationMethod.BACKWARD_FILL:
        return startValue;
      default:
        return this.linearInterpolation(startValue, endValue, factor, dataType);
    }
  }

  private linearInterpolation(startValue: any, endValue: any, factor: number, dataType: TelemetryDataType): any {
    if (dataType === TelemetryDataType.NUMERIC) {
      const start = typeof startValue === 'number' ? startValue : 0;
      const end = typeof endValue === 'number' ? endValue : 0;
      return start + (end - start) * factor;
    } else if (dataType === TelemetryDataType.VECTOR) {
      const startVector = Array.isArray(startValue) ? startValue : [0, 0, 0];
      const endVector = Array.isArray(endValue) ? endValue : [0, 0, 0];
      const dimensions = Math.max(startVector.length, endVector.length);
      const result = new Array(dimensions);
      
      for (let i = 0; i < dimensions; i++) {
        const start = startVector[i] || 0;
        const end = endVector[i] || 0;
        result[i] = start + (end - start) * factor;
      }
      
      return result;
    }
    
    return startValue;
  }

  private cubicInterpolation(startValue: any, endValue: any, factor: number, dataType: TelemetryDataType): any {
    // Simplified cubic interpolation (Hermite spline with zero derivatives)
    const t = factor;
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    
    if (dataType === TelemetryDataType.NUMERIC) {
      const start = typeof startValue === 'number' ? startValue : 0;
      const end = typeof endValue === 'number' ? endValue : 0;
      // Assume zero derivatives at endpoints
      return h00 * start + h01 * end;
    } else if (dataType === TelemetryDataType.VECTOR) {
      const startVector = Array.isArray(startValue) ? startValue : [0, 0, 0];
      const endVector = Array.isArray(endValue) ? endValue : [0, 0, 0];
      const dimensions = Math.max(startVector.length, endVector.length);
      const result = new Array(dimensions);
      
      for (let i = 0; i < dimensions; i++) {
        const start = startVector[i] || 0;
        const end = endVector[i] || 0;
        result[i] = h00 * start + h01 * end;
      }
      
      return result;
    }
    
    return startValue;
  }

  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.processedCount++;
    if (isError) {
      this.metrics.errorCount++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processedCount;
    
    const recentWindowMs = 5000;
    this.metrics.throughput = (this.metrics.processedCount * 1000) / Math.max(this.metrics.totalProcessingTime, recentWindowMs);
  }
}

/**
 * Time alignment stage for synchronizing data from multiple sources
 */
export class TimeAlignmentStage implements ProcessingStage<Map<string, TelemetryDataPoint[]>, Map<string, TelemetryDataPoint[]>> {
  readonly name = 'time_alignment';
  readonly stageType = ProcessingStageType.TRANSFORMATION;
  readonly inputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR, TelemetryDataType.MATRIX];
  readonly outputTypes = [TelemetryDataType.NUMERIC, TelemetryDataType.VECTOR, TelemetryDataType.MATRIX];

  private toleranceMs = 100; // 100ms tolerance for time alignment
  private referenceStream?: string;
  private metrics: ProcessingStageMetrics = {
    processedCount: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    errorCount: 0,
    lastProcessingTime: 0,
    throughput: 0
  };

  async process(
    streamData: Map<string, TelemetryDataPoint[]>, 
    context: ProcessingContext
  ): Promise<Map<string, TelemetryDataPoint[]>> {
    const startTime = performance.now();
    
    try {
      const alignedData = this.alignStreamsByTime(streamData);
      
      this.updateMetrics(performance.now() - startTime, false);
      return alignedData;

    } catch (error) {
      this.updateMetrics(performance.now() - startTime, true);
      throw new Error(`Time alignment failed: ${error}`);
    }
  }

  configure(config: Record<string, any>): void {
    if (config.toleranceMs) {
      this.toleranceMs = config.toleranceMs;
    }
    if (config.referenceStream) {
      this.referenceStream = config.referenceStream;
    }
  }

  reset(): void {
    this.metrics = {
      processedCount: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      lastProcessingTime: 0,
      throughput: 0
    };
  }

  getMetrics(): ProcessingStageMetrics {
    return { ...this.metrics };
  }

  private alignStreamsByTime(streamData: Map<string, TelemetryDataPoint[]>): Map<string, TelemetryDataPoint[]> {
    const result = new Map<string, TelemetryDataPoint[]>();
    
    if (streamData.size === 0) return result;
    
    // Determine reference stream
    const referenceStreamId = this.referenceStream || streamData.keys().next().value;
    const referenceData = streamData.get(referenceStreamId);
    
    if (!referenceData || referenceData.length === 0) {
      return streamData; // Return original data if no reference
    }
    
    // Get reference timestamps
    const referenceTimestamps = referenceData.map(point => point.timestamp).sort((a, b) => a - b);
    
    // Align all streams to reference timestamps
    for (const [streamId, data] of streamData) {
      const alignedData: TelemetryDataPoint[] = [];
      
      for (const refTimestamp of referenceTimestamps) {
        const alignedPoint = this.findAlignedPoint(data, refTimestamp);
        if (alignedPoint) {
          alignedData.push({
            ...alignedPoint,
            timestamp: refTimestamp, // Force alignment to reference timestamp
            metadata: {
              ...alignedPoint.metadata,
              timeAligned: true,
              originalTimestamp: alignedPoint.timestamp,
              alignmentError: Math.abs(alignedPoint.timestamp - refTimestamp)
            }
          });
        }
      }
      
      result.set(streamId, alignedData);
    }
    
    return result;
  }

  private findAlignedPoint(data: TelemetryDataPoint[], targetTimestamp: number): TelemetryDataPoint | null {
    if (data.length === 0) return null;
    
    // Find the closest point within tolerance
    let closestPoint: TelemetryDataPoint | null = null;
    let closestDistance = Infinity;
    
    for (const point of data) {
      const distance = Math.abs(point.timestamp - targetTimestamp);
      if (distance <= this.toleranceMs && distance < closestDistance) {
        closestPoint = point;
        closestDistance = distance;
      }
    }
    
    return closestPoint;
  }

  private updateMetrics(processingTime: number, isError: boolean): void {
    this.metrics.processedCount++;
    if (isError) {
      this.metrics.errorCount++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.lastProcessingTime = processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processedCount;
    
    const recentWindowMs = 5000;
    this.metrics.throughput = (this.metrics.processedCount * 1000) / Math.max(this.metrics.totalProcessingTime, recentWindowMs);
  }
}

/**
 * Main processing pipeline orchestrator
 */
export class TelemetryProcessingPipeline extends EventEmitter<PipelineEvents> {
  private stages = new Map<string, ProcessingStage>();
  private stageOrder: string[] = [];
  private config: PipelineConfig;
  private activeStreams = new Set<string>();
  private metrics: PipelinePerformanceMetrics = {
    totalStreams: 0,
    activeStreams: 0,
    totalDataPoints: 0,
    dataPointsPerSecond: 0,
    averageLatency: 0,
    memoryUsageMB: 0,
    stageMetrics: new Map(),
    bottlenecks: []
  };
  private performanceInterval?: NodeJS.Timeout;
  private isDestroyed = false;

  constructor(config: Partial<PipelineConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentStreams: config.maxConcurrentStreams || 100,
      defaultWindowSize: config.defaultWindowSize || 100,
      interpolationMethod: config.interpolationMethod || InterpolationMethod.LINEAR,
      timeAlignmentTolerance: config.timeAlignmentTolerance || 100,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      memoryLimitMB: config.memoryLimitMB || 500,
      processingTimeout: config.processingTimeout || 5000
    };

    this.initializeDefaultStages();
    this.startPerformanceMonitoring();
  }

  /**
   * Add a processing stage to the pipeline
   */
  addStage(stage: ProcessingStage, position?: number): void {
    if (this.stages.has(stage.name)) {
      throw new Error(`Stage '${stage.name}' already exists`);
    }

    this.stages.set(stage.name, stage);
    
    if (position !== undefined && position >= 0 && position <= this.stageOrder.length) {
      this.stageOrder.splice(position, 0, stage.name);
    } else {
      this.stageOrder.push(stage.name);
    }

    this.emit('stage:added', stage.name);
  }

  /**
   * Remove a processing stage from the pipeline
   */
  removeStage(stageName: string): void {
    if (!this.stages.has(stageName)) {
      throw new Error(`Stage '${stageName}' not found`);
    }

    this.stages.delete(stageName);
    this.stageOrder = this.stageOrder.filter(name => name !== stageName);

    this.emit('stage:removed', stageName);
  }

  /**
   * Configure a specific stage
   */
  configureStage(stageName: string, config: Record<string, any>): void {
    const stage = this.stages.get(stageName);
    if (!stage) {
      throw new Error(`Stage '${stageName}' not found`);
    }

    stage.configure(config);
  }

  /**
   * Process a single data point through the pipeline
   */
  async processSingle(
    streamId: string, 
    data: TelemetryDataPoint, 
    dataType: TelemetryDataType
  ): Promise<TelemetryDataPoint> {
    if (this.isDestroyed) {
      throw new Error('Pipeline has been destroyed');
    }

    this.activeStreams.add(streamId);
    this.emit('pipeline:started', streamId);

    const context: ProcessingContext = {
      streamId,
      timestamp: Date.now(),
      dataType,
      metadata: {},
      windowSize: this.config.defaultWindowSize
    };

    try {
      let processedData = data;
      
      for (const stageName of this.stageOrder) {
        const stage = this.stages.get(stageName);
        if (!stage) continue;

        // Check if stage supports this data type
        if (!stage.inputTypes.includes(dataType)) continue;

        const startTime = performance.now();
        processedData = await this.executeStageWithTimeout(stage, processedData, context);
        const processingTime = performance.now() - startTime;

        this.updateStageMetrics(stageName, processingTime);
        this.emit('data:processed', streamId, processedData, stageName);
      }

      this.metrics.totalDataPoints++;
      return processedData;

    } catch (error) {
      this.emit('data:error', streamId, error as Error, 'pipeline');
      throw error;
    }
  }

  /**
   * Process a batch of data points through the pipeline
   */
  async processBatch(
    streamId: string, 
    data: TelemetryDataPoint[], 
    dataType: TelemetryDataType
  ): Promise<TelemetryDataPoint[]> {
    if (this.isDestroyed) {
      throw new Error('Pipeline has been destroyed');
    }

    const results: TelemetryDataPoint[] = [];
    
    for (const point of data) {
      try {
        const processed = await this.processSingle(streamId, point, dataType);
        results.push(processed);
      } catch (error) {
        console.error(`Failed to process data point in batch: ${error}`);
        // Continue processing other points in the batch
      }
    }

    return results;
  }

  /**
   * Start processing for a stream
   */
  startStream(streamId: string): void {
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error(`Maximum concurrent streams exceeded: ${this.config.maxConcurrentStreams}`);
    }

    this.activeStreams.add(streamId);
    this.emit('pipeline:started', streamId);
  }

  /**
   * Stop processing for a stream
   */
  stopStream(streamId: string): void {
    this.activeStreams.delete(streamId);
    this.emit('pipeline:stopped', streamId);
  }

  /**
   * Get pipeline performance metrics
   */
  getMetrics(): PipelinePerformanceMetrics {
    return {
      ...this.metrics,
      activeStreams: this.activeStreams.size,
      stageMetrics: new Map(this.metrics.stageMetrics)
    };
  }

  /**
   * Reset all stage metrics
   */
  resetMetrics(): void {
    for (const stage of this.stages.values()) {
      stage.reset();
    }
    
    this.metrics = {
      totalStreams: 0,
      activeStreams: 0,
      totalDataPoints: 0,
      dataPointsPerSecond: 0,
      averageLatency: 0,
      memoryUsageMB: 0,
      stageMetrics: new Map(),
      bottlenecks: []
    };
  }

  /**
   * Destroy the pipeline and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;

    // Stop performance monitoring
    if (this.performanceInterval) {
      clearInterval(this.performanceInterval);
    }

    // Clear all stages
    this.stages.clear();
    this.stageOrder = [];
    this.activeStreams.clear();

    // Remove all listeners
    this.removeAllListeners();
  }

  private initializeDefaultStages(): void {
    // Add default processing stages
    this.addStage(new DataTransformationStage());
    this.addStage(new WindowedOperationsStage());
    this.addStage(new DataInterpolationStage());
    this.addStage(new TimeAlignmentStage());
  }

  private async executeStageWithTimeout<T>(
    stage: ProcessingStage, 
    data: T, 
    context: ProcessingContext
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Stage '${stage.name}' timed out after ${this.config.processingTimeout}ms`));
      }, this.config.processingTimeout);

      stage.process(data, context)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private updateStageMetrics(stageName: string, processingTime: number): void {
    const stage = this.stages.get(stageName);
    if (!stage) return;

    const stageMetrics = stage.getMetrics();
    this.metrics.stageMetrics.set(stageName, stageMetrics);
  }

  private startPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    this.performanceInterval = setInterval(() => {
      if (this.isDestroyed) return;

      // Update memory usage estimate
      if (typeof (performance as any).memory === 'object') {
        const memInfo = (performance as any).memory;
        this.metrics.memoryUsageMB = memInfo.usedJSHeapSize / (1024 * 1024);
        
        if (this.metrics.memoryUsageMB > this.config.memoryLimitMB) {
          this.emit('memory:warning', this.metrics.memoryUsageMB, this.config.memoryLimitMB);
        }
      }

      // Calculate data points per second
      const now = Date.now();
      const timeWindow = 5000; // 5 seconds
      if (this.metrics.totalDataPoints > 0) {
        this.metrics.dataPointsPerSecond = this.metrics.totalDataPoints / (timeWindow / 1000);
      }

      // Detect bottlenecks
      this.metrics.bottlenecks = this.detectBottlenecks();

      this.emit('performance:update', this.getMetrics());
    }, 5000); // Update every 5 seconds
  }

  private detectBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    // Check for slow stages
    for (const [stageName, metrics] of this.metrics.stageMetrics) {
      if (metrics.averageProcessingTime > 100) { // > 100ms
        bottlenecks.push(`Stage '${stageName}' has high processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
      }
      if (metrics.errorCount > metrics.processedCount * 0.1) { // > 10% error rate
        bottlenecks.push(`Stage '${stageName}' has high error rate: ${((metrics.errorCount / metrics.processedCount) * 100).toFixed(1)}%`);
      }
    }

    // Check memory usage
    if (this.metrics.memoryUsageMB > this.config.memoryLimitMB * 0.8) {
      bottlenecks.push(`High memory usage: ${this.metrics.memoryUsageMB.toFixed(1)}MB`);
    }

    return bottlenecks;
  }
}

// All exports are handled at the top of the file with their declarations