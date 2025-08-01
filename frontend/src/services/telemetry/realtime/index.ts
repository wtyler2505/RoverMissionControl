/**
 * Real-Time Update System Exports
 * 
 * Central export point for all real-time data update components
 */

export { RealTimeUpdateManager } from '../RealTimeUpdateManager';
export type { 
  UpdateFrame, 
  ChartUpdate, 
  TransitionConfig, 
  PerformanceMetrics, 
  BackpressureConfig, 
  UpdateManagerConfig 
} from '../RealTimeUpdateManager';

export { StreamProcessor, createHighFrequencyProcessor, createLowLatencyProcessor, createAggregationProcessor } from '../StreamProcessor';
export type { 
  StreamConfig, 
  StreamMetrics, 
  ProcessedDataPoint 
} from '../StreamProcessor';

export { BackpressureHandler } from '../BackpressureHandler';
export type { 
  BackpressureStrategy, 
  PrioritizedMessage, 
  BackpressureMetrics 
} from '../BackpressureHandler';

export { ChartPerformanceOptimizer } from '../ChartPerformanceOptimizer';
export type { 
  PerformanceConfig, 
  RenderBudget, 
  PerformanceProfile, 
  OptimizationSuggestion,
  ObjectPool,
  PerformanceReport 
} from '../ChartPerformanceOptimizer';

export { RealTimeChartConnector } from '../RealTimeChartConnector';
export type { 
  RealTimeChartConfig, 
  ChartConnection, 
  ChartConnectionMetrics 
} from '../RealTimeChartConnector';

// Re-export commonly used RxJS operators for convenience
export { 
  throttleTime, 
  debounceTime, 
  sampleTime, 
  bufferTime,
  scan,
  map,
  filter,
  switchMap,
  withLatestFrom
} from 'rxjs/operators';

export { 
  Observable, 
  Subject, 
  BehaviorSubject,
  interval,
  animationFrameScheduler 
} from 'rxjs';