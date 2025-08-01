/**
 * StreamProcessor
 * 
 * Advanced stream processing utilities for telemetry data with:
 * - Configurable throttling and debouncing strategies
 * - Adaptive sampling based on data rate
 * - Stream transformation pipelines
 * - Statistical aggregations and windowing
 * - Anomaly detection in streams
 */

import { 
  Observable, 
  Subject, 
  BehaviorSubject,
  interval,
  merge,
  EMPTY,
  of
} from 'rxjs';
import {
  throttleTime,
  debounceTime,
  sampleTime,
  bufferTime,
  scan,
  map,
  filter,
  switchMap,
  catchError,
  tap,
  share,
  distinctUntilChanged,
  pairwise,
  withLatestFrom,
  takeUntil
} from 'rxjs/operators';

export interface StreamConfig {
  // Throttling configuration
  throttle?: {
    strategy: 'time' | 'count' | 'adaptive' | 'selective';
    windowMs?: number;
    maxCount?: number;
    adaptiveThreshold?: number;
    selector?: (data: any) => boolean;
  };

  // Debouncing configuration
  debounce?: {
    strategy: 'trailing' | 'leading' | 'both';
    windowMs: number;
    maxWait?: number;
  };

  // Sampling configuration
  sampling?: {
    strategy: 'uniform' | 'adaptive' | 'priority' | 'reservoir';
    rate?: number;
    adaptiveRates?: { slow: number; medium: number; fast: number };
    priorityFn?: (data: any) => number;
    reservoirSize?: number;
  };

  // Aggregation configuration
  aggregation?: {
    windowMs: number;
    windowType: 'tumbling' | 'sliding' | 'session';
    aggregateFn: (values: any[]) => any;
    sessionTimeout?: number;
  };

  // Filtering configuration
  filter?: {
    predicateFn: (data: any) => boolean;
    anomalyDetection?: boolean;
    anomalyThreshold?: number;
  };

  // Transformation configuration
  transform?: {
    mapFn?: (data: any) => any;
    enrichFn?: (data: any) => Promise<any>;
    normalizeFn?: (data: any) => any;
  };

  // Performance configuration
  performance?: {
    enableMetrics: boolean;
    metricsInterval: number;
    adaptiveOptimization: boolean;
  };
}

export interface StreamMetrics {
  inputRate: number;
  outputRate: number;
  droppedCount: number;
  processedCount: number;
  averageLatency: number;
  backpressure: boolean;
  memoryUsage: number;
}

export interface ProcessedDataPoint<T> {
  data: T;
  timestamp: number;
  metadata: {
    processed: boolean;
    latency: number;
    transformations: string[];
    priority?: number;
  };
}

export class StreamProcessor<T = any> {
  private config: StreamConfig;
  private metrics$ = new BehaviorSubject<StreamMetrics>({
    inputRate: 0,
    outputRate: 0,
    droppedCount: 0,
    processedCount: 0,
    averageLatency: 0,
    backpressure: false,
    memoryUsage: 0
  });

  private destroy$ = new Subject<void>();
  private inputCounter = 0;
  private outputCounter = 0;
  private droppedCounter = 0;
  private latencyBuffer: number[] = [];
  private lastMetricsUpdate = Date.now();

  // Adaptive parameters
  private adaptiveThrottle = new BehaviorSubject<number>(100);
  private adaptiveSampleRate = new BehaviorSubject<number>(1);

  constructor(config: StreamConfig = {}) {
    this.config = config;
    
    if (config.performance?.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  /**
   * Process a stream with configured transformations
   */
  public process(source$: Observable<T>): Observable<ProcessedDataPoint<T>> {
    let pipeline = source$.pipe(
      // Add input metrics
      tap(() => this.inputCounter++),
      
      // Convert to ProcessedDataPoint
      map(data => this.wrapData(data)),
      
      // Apply filtering first (reduce data early)
      this.applyFiltering(),
      
      // Apply throttling
      this.applyThrottling(),
      
      // Apply debouncing
      this.applyDebouncing(),
      
      // Apply sampling
      this.applySampling(),
      
      // Apply transformations
      this.applyTransformations(),
      
      // Apply aggregation
      this.applyAggregation(),
      
      // Add output metrics
      tap(() => this.outputCounter++),
      
      // Share the stream
      share(),
      
      // Complete on destroy
      takeUntil(this.destroy$)
    );

    return pipeline;
  }

  /**
   * Wrap raw data in ProcessedDataPoint
   */
  private wrapData(data: T): ProcessedDataPoint<T> {
    return {
      data,
      timestamp: Date.now(),
      metadata: {
        processed: true,
        latency: 0,
        transformations: []
      }
    };
  }

  /**
   * Apply filtering to the stream
   */
  private applyFiltering() {
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      if (!this.config.filter) return source$;

      const { predicateFn, anomalyDetection, anomalyThreshold = 3 } = this.config.filter;

      return source$.pipe(
        // Apply basic predicate filter
        filter(point => predicateFn ? predicateFn(point.data) : true),
        
        // Apply anomaly detection if enabled
        anomalyDetection ? this.detectAnomalies(anomalyThreshold) : tap(),
        
        // Track filtered data
        tap(point => {
          point.metadata.transformations.push('filtered');
        })
      );
    };
  }

  /**
   * Detect anomalies in the stream using z-score
   */
  private detectAnomalies(threshold: number) {
    const windowSize = 100;
    const buffer: number[] = [];
    
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      return source$.pipe(
        map(point => {
          // Extract numeric value (customize based on data structure)
          const value = this.extractNumericValue(point.data);
          
          if (value !== null) {
            buffer.push(value);
            if (buffer.length > windowSize) {
              buffer.shift();
            }
            
            if (buffer.length >= 10) {
              const mean = buffer.reduce((a, b) => a + b) / buffer.length;
              const variance = buffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buffer.length;
              const stdDev = Math.sqrt(variance);
              const zScore = Math.abs((value - mean) / stdDev);
              
              if (zScore > threshold) {
                point.metadata.transformations.push('anomaly-detected');
                (point.metadata as any).anomalyScore = zScore;
              }
            }
          }
          
          return point;
        })
      );
    };
  }

  /**
   * Apply throttling to the stream
   */
  private applyThrottling() {
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      if (!this.config.throttle) return source$;

      const { strategy, windowMs = 100, maxCount = 10, adaptiveThreshold = 0.8, selector } = this.config.throttle;

      switch (strategy) {
        case 'time':
          return source$.pipe(
            throttleTime(windowMs),
            tap(point => point.metadata.transformations.push('throttled-time'))
          );

        case 'count':
          return source$.pipe(
            scan((acc, value) => ({ count: acc.count + 1, value }), { count: 0, value: null as any }),
            filter(({ count }) => count % maxCount === 1),
            map(({ value }) => value),
            tap(point => point.metadata.transformations.push('throttled-count'))
          );

        case 'adaptive':
          return source$.pipe(
            withLatestFrom(this.adaptiveThrottle),
            throttleTime(([_, throttle]) => throttle),
            map(([point]) => point),
            tap(point => {
              point.metadata.transformations.push('throttled-adaptive');
              this.updateAdaptiveThrottle();
            })
          );

        case 'selective':
          return source$.pipe(
            filter(point => !selector || selector(point.data)),
            throttleTime(windowMs),
            tap(point => point.metadata.transformations.push('throttled-selective'))
          );

        default:
          return source$;
      }
    };
  }

  /**
   * Apply debouncing to the stream
   */
  private applyDebouncing() {
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      if (!this.config.debounce) return source$;

      const { strategy, windowMs, maxWait = Infinity } = this.config.debounce;

      switch (strategy) {
        case 'trailing':
          return source$.pipe(
            debounceTime(windowMs),
            tap(point => point.metadata.transformations.push('debounced-trailing'))
          );

        case 'leading':
          return source$.pipe(
            throttleTime(windowMs, undefined, { leading: true, trailing: false }),
            tap(point => point.metadata.transformations.push('debounced-leading'))
          );

        case 'both':
          // Implement leading and trailing debounce
          return source$.pipe(
            switchMap(point => {
              return merge(
                of(point),
                EMPTY.pipe(
                  debounceTime(windowMs),
                  map(() => ({ ...point, metadata: { ...point.metadata, transformations: [...point.metadata.transformations, 'debounced-trailing'] } }))
                )
              );
            }),
            tap(point => {
              if (!point.metadata.transformations.includes('debounced-trailing')) {
                point.metadata.transformations.push('debounced-leading');
              }
            })
          );

        default:
          return source$;
      }
    };
  }

  /**
   * Apply sampling to the stream
   */
  private applySampling() {
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      if (!this.config.sampling) return source$;

      const { 
        strategy, 
        rate = 0.1, 
        adaptiveRates = { slow: 0.1, medium: 0.5, fast: 1.0 },
        priorityFn,
        reservoirSize = 100
      } = this.config.sampling;

      switch (strategy) {
        case 'uniform':
          return source$.pipe(
            filter(() => Math.random() < rate),
            tap(point => point.metadata.transformations.push('sampled-uniform'))
          );

        case 'adaptive':
          return source$.pipe(
            withLatestFrom(this.adaptiveSampleRate),
            filter(([_, sampleRate]) => Math.random() < sampleRate),
            map(([point]) => point),
            tap(point => {
              point.metadata.transformations.push('sampled-adaptive');
              this.updateAdaptiveSampleRate();
            })
          );

        case 'priority':
          return source$.pipe(
            map(point => {
              const priority = priorityFn ? priorityFn(point.data) : 1;
              point.metadata.priority = priority;
              return point;
            }),
            filter(point => Math.random() < (point.metadata.priority || 1) * rate),
            tap(point => point.metadata.transformations.push('sampled-priority'))
          );

        case 'reservoir':
          return this.applyReservoirSampling(source$, reservoirSize);

        default:
          return source$;
      }
    };
  }

  /**
   * Apply reservoir sampling for uniform random sampling
   */
  private applyReservoirSampling(
    source$: Observable<ProcessedDataPoint<T>>, 
    reservoirSize: number
  ): Observable<ProcessedDataPoint<T>> {
    const reservoir: ProcessedDataPoint<T>[] = [];
    let count = 0;

    return source$.pipe(
      map(point => {
        count++;
        
        if (reservoir.length < reservoirSize) {
          reservoir.push(point);
        } else {
          const j = Math.floor(Math.random() * count);
          if (j < reservoirSize) {
            reservoir[j] = point;
          }
        }
        
        point.metadata.transformations.push('sampled-reservoir');
        return point;
      }),
      filter(point => reservoir.includes(point))
    );
  }

  /**
   * Apply transformations to the stream
   */
  private applyTransformations() {
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      if (!this.config.transform) return source$;

      const { mapFn, enrichFn, normalizeFn } = this.config.transform;

      let pipeline = source$;

      // Apply map transformation
      if (mapFn) {
        pipeline = pipeline.pipe(
          map(point => ({
            ...point,
            data: mapFn(point.data),
            metadata: {
              ...point.metadata,
              transformations: [...point.metadata.transformations, 'mapped']
            }
          }))
        );
      }

      // Apply async enrichment
      if (enrichFn) {
        pipeline = pipeline.pipe(
          switchMap(async point => {
            try {
              const enrichedData = await enrichFn(point.data);
              return {
                ...point,
                data: enrichedData,
                metadata: {
                  ...point.metadata,
                  transformations: [...point.metadata.transformations, 'enriched']
                }
              };
            } catch (error) {
              console.error('Enrichment failed:', error);
              return point;
            }
          })
        );
      }

      // Apply normalization
      if (normalizeFn) {
        pipeline = pipeline.pipe(
          map(point => ({
            ...point,
            data: normalizeFn(point.data),
            metadata: {
              ...point.metadata,
              transformations: [...point.metadata.transformations, 'normalized']
            }
          }))
        );
      }

      return pipeline;
    };
  }

  /**
   * Apply aggregation to the stream
   */
  private applyAggregation() {
    return (source$: Observable<ProcessedDataPoint<T>>) => {
      if (!this.config.aggregation) return source$;

      const { 
        windowMs, 
        windowType, 
        aggregateFn, 
        sessionTimeout = 5000 
      } = this.config.aggregation;

      switch (windowType) {
        case 'tumbling':
          return source$.pipe(
            bufferTime(windowMs),
            filter(buffer => buffer.length > 0),
            map(buffer => this.aggregateBuffer(buffer, aggregateFn))
          );

        case 'sliding':
          return source$.pipe(
            scan((buffer, point) => {
              const now = Date.now();
              buffer.push(point);
              // Remove old points outside the window
              return buffer.filter(p => now - p.timestamp < windowMs);
            }, [] as ProcessedDataPoint<T>[]),
            filter(buffer => buffer.length > 0),
            map(buffer => this.aggregateBuffer(buffer, aggregateFn))
          );

        case 'session':
          return source$.pipe(
            scan((session, point) => {
              const now = Date.now();
              if (session.length === 0 || now - session[session.length - 1].timestamp > sessionTimeout) {
                // Start new session
                return [point];
              }
              return [...session, point];
            }, [] as ProcessedDataPoint<T>[]),
            filter(session => {
              const now = Date.now();
              return session.length > 0 && now - session[session.length - 1].timestamp > sessionTimeout;
            }),
            map(session => this.aggregateBuffer(session, aggregateFn))
          );

        default:
          return source$;
      }
    };
  }

  /**
   * Aggregate a buffer of points
   */
  private aggregateBuffer(
    buffer: ProcessedDataPoint<T>[], 
    aggregateFn: (values: any[]) => any
  ): ProcessedDataPoint<T> {
    const values = buffer.map(p => p.data);
    const aggregatedData = aggregateFn(values);
    
    return {
      data: aggregatedData,
      timestamp: Date.now(),
      metadata: {
        processed: true,
        latency: Date.now() - buffer[0].timestamp,
        transformations: ['aggregated'],
        aggregationCount: buffer.length
      } as any
    };
  }

  /**
   * Extract numeric value from data for anomaly detection
   */
  private extractNumericValue(data: any): number | null {
    if (typeof data === 'number') return data;
    if (data && typeof data.value === 'number') return data.value;
    if (data && typeof data.measurement === 'number') return data.measurement;
    return null;
  }

  /**
   * Update adaptive throttle based on stream rate
   */
  private updateAdaptiveThrottle(): void {
    const metrics = this.metrics$.value;
    const targetRate = 100; // Target output rate per second
    
    if (metrics.outputRate > targetRate * 1.2) {
      // Increase throttle to reduce rate
      this.adaptiveThrottle.next(Math.min(this.adaptiveThrottle.value * 1.2, 1000));
    } else if (metrics.outputRate < targetRate * 0.8) {
      // Decrease throttle to increase rate
      this.adaptiveThrottle.next(Math.max(this.adaptiveThrottle.value * 0.8, 10));
    }
  }

  /**
   * Update adaptive sample rate based on stream characteristics
   */
  private updateAdaptiveSampleRate(): void {
    const metrics = this.metrics$.value;
    
    // Adjust sample rate based on input rate
    if (metrics.inputRate > 1000) {
      this.adaptiveSampleRate.next(0.1); // Sample 10% for high-rate streams
    } else if (metrics.inputRate > 100) {
      this.adaptiveSampleRate.next(0.5); // Sample 50% for medium-rate streams
    } else {
      this.adaptiveSampleRate.next(1.0); // Sample 100% for low-rate streams
    }
  }

  /**
   * Start collecting metrics
   */
  private startMetricsCollection(): void {
    interval(this.config.performance?.metricsInterval || 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const now = Date.now();
        const timeDelta = (now - this.lastMetricsUpdate) / 1000;
        
        const inputRate = this.inputCounter / timeDelta;
        const outputRate = this.outputCounter / timeDelta;
        const droppedCount = this.inputCounter - this.outputCounter;
        
        // Calculate average latency
        const avgLatency = this.latencyBuffer.length > 0
          ? this.latencyBuffer.reduce((a, b) => a + b) / this.latencyBuffer.length
          : 0;
        
        // Estimate memory usage (simplified)
        const memoryUsage = this.estimateMemoryUsage();
        
        this.metrics$.next({
          inputRate,
          outputRate,
          droppedCount,
          processedCount: this.outputCounter,
          averageLatency: avgLatency,
          backpressure: droppedCount > this.inputCounter * 0.1,
          memoryUsage
        });
        
        // Reset counters
        this.inputCounter = 0;
        this.outputCounter = 0;
        this.droppedCounter = 0;
        this.latencyBuffer = [];
        this.lastMetricsUpdate = now;
      });
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.totalJSHeapSize;
    }
    return 0;
  }

  /**
   * Get stream metrics
   */
  public getMetrics(): Observable<StreamMetrics> {
    return this.metrics$.asObservable();
  }

  /**
   * Create a custom operator for the stream
   */
  public createOperator<R>(
    operatorFn: (source: Observable<ProcessedDataPoint<T>>) => Observable<ProcessedDataPoint<R>>
  ): (source: Observable<T>) => Observable<ProcessedDataPoint<R>> {
    return (source$: Observable<T>) => {
      const processed$ = this.process(source$);
      return operatorFn(processed$ as any);
    };
  }

  /**
   * Destroy the processor
   */
  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.metrics$.complete();
    this.adaptiveThrottle.complete();
    this.adaptiveSampleRate.complete();
  }
}

// Export convenience functions for common configurations
export const createHighFrequencyProcessor = <T>(customConfig: Partial<StreamConfig> = {}) => {
  return new StreamProcessor<T>({
    throttle: {
      strategy: 'adaptive',
      windowMs: 10,
      adaptiveThreshold: 0.9
    },
    sampling: {
      strategy: 'adaptive',
      adaptiveRates: { slow: 0.01, medium: 0.1, fast: 0.5 }
    },
    performance: {
      enableMetrics: true,
      metricsInterval: 1000,
      adaptiveOptimization: true
    },
    ...customConfig
  });
};

export const createLowLatencyProcessor = <T>(customConfig: Partial<StreamConfig> = {}) => {
  return new StreamProcessor<T>({
    throttle: {
      strategy: 'time',
      windowMs: 16 // ~60fps
    },
    debounce: {
      strategy: 'leading',
      windowMs: 50
    },
    performance: {
      enableMetrics: true,
      metricsInterval: 100,
      adaptiveOptimization: false
    },
    ...customConfig
  });
};

export const createAggregationProcessor = <T>(
  windowMs: number,
  aggregateFn: (values: T[]) => T,
  customConfig: Partial<StreamConfig> = {}
) => {
  return new StreamProcessor<T>({
    aggregation: {
      windowMs,
      windowType: 'tumbling',
      aggregateFn
    },
    performance: {
      enableMetrics: true,
      metricsInterval: 1000,
      adaptiveOptimization: false
    },
    ...customConfig
  });
};