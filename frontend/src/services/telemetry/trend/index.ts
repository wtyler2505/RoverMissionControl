/**
 * Advanced Trend Detection and Prediction Services
 * Central export point for trend analysis components
 */

// Main services
export { AdvancedTrendAnalyzer } from './AdvancedTrendAnalyzer';
export { DriftDetector } from './DriftDetector';
export { PredictionEngine } from './PredictionEngine';

// Types and interfaces
export * from './TrendTypes';

// Re-export specific event types
export type { AdvancedTrendAnalyzerEvents } from './TrendTypes';
export type { DriftDetectorEvents, DriftStatistics } from './DriftDetector';
export type { PredictionEngineEvents } from './PredictionEngine';

// Default configurations
import { 
  AdvancedTrendConfig, 
  DriftConfig, 
  PredictionConfig,
  TrendType,
  DriftMethod 
} from './TrendTypes';

export const DEFAULT_ADVANCED_TREND_CONFIG: AdvancedTrendConfig = {
  enableARIMA: true,
  enableNonLinear: true,
  enableDriftDetection: true,
  enableChangePointDetection: true,
  enablePrediction: true,
  enableSeasonalDecomposition: true,
  
  arima: {
    autoFit: true,
    maxP: 5,
    maxD: 2,
    maxQ: 5,
    seasonal: false,
    seasonalPeriod: 12
  },
  
  nonLinear: {
    types: [TrendType.POLYNOMIAL, TrendType.EXPONENTIAL, TrendType.LOGARITHMIC],
    maxPolynomialOrder: 3,
    crossValidate: true
  },
  
  drift: {
    method: DriftMethod.ADWIN,
    sensitivity: 0.5,
    windowSize: 100,
    warningThreshold: 2,
    driftThreshold: 3,
    adaptiveThresholds: true
  },
  
  changePoint: {
    method: 'pelt',
    penalty: 3,
    minSegmentLength: 10
  },
  
  prediction: {
    horizon: 10,
    confidenceLevel: 0.95,
    method: 'ensemble',
    includeSeasonality: true
  },
  
  performance: {
    useWebWorkers: false,
    cacheModels: true,
    batchSize: 1000
  }
};

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  method: DriftMethod.ADWIN,
  sensitivity: 0.5,
  windowSize: 100,
  warningThreshold: 2,
  driftThreshold: 3,
  minSamples: 30,
  adaptiveThresholds: true
};

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  horizon: 10,
  confidenceLevel: 0.95,
  method: 'ensemble',
  includeSeasonality: true
};

// Utility functions
export const createAdvancedTrendAnalyzer = (config?: Partial<AdvancedTrendConfig>) => {
  return new AdvancedTrendAnalyzer({
    ...DEFAULT_ADVANCED_TREND_CONFIG,
    ...config
  });
};

export const createDriftDetector = (config?: Partial<DriftConfig>) => {
  return new DriftDetector({
    ...DEFAULT_DRIFT_CONFIG,
    ...config
  });
};

export const createPredictionEngine = (analyzer: AdvancedTrendAnalyzer) => {
  return new PredictionEngine(analyzer);
};