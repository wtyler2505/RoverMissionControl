/**
 * Advanced Trend Detection and Prediction Types
 * Comprehensive type definitions for ARIMA models, non-linear trends, 
 * drift detection, and prediction with confidence intervals
 */

import { TelemetryDataPoint } from '../../websocket/TelemetryManager';

/**
 * ARIMA model parameters
 */
export interface ARIMAConfig {
  p: number;              // Autoregressive order
  d: number;              // Differencing order
  q: number;              // Moving average order
  seasonalPeriod?: number; // For SARIMA models
  P?: number;             // Seasonal AR order
  D?: number;             // Seasonal differencing
  Q?: number;             // Seasonal MA order
  includeConstant?: boolean;
  maxIterations?: number;
  tolerance?: number;
}

/**
 * ARIMA model results
 */
export interface ARIMAModel {
  config: ARIMAConfig;
  coefficients: {
    ar: number[];         // AR coefficients
    ma: number[];         // MA coefficients
    sar?: number[];       // Seasonal AR coefficients
    sma?: number[];       // Seasonal MA coefficients
    constant?: number;
  };
  residuals: number[];
  aic: number;           // Akaike Information Criterion
  bic: number;           // Bayesian Information Criterion
  logLikelihood: number;
  sigma2: number;        // Residual variance
  fitTime: number;       // Model fitting time in ms
}

/**
 * Non-linear trend types
 */
export enum TrendType {
  LINEAR = 'linear',
  POLYNOMIAL = 'polynomial',
  EXPONENTIAL = 'exponential',
  LOGARITHMIC = 'logarithmic',
  POWER = 'power',
  MOVING_AVERAGE = 'moving_average',
  LOESS = 'loess'
}

/**
 * Non-linear trend configuration
 */
export interface NonLinearTrendConfig {
  type: TrendType;
  order?: number;              // For polynomial trends
  window?: number;             // For moving average
  bandwidth?: number;          // For LOESS smoothing
  robustWeights?: boolean;     // For robust regression
}

/**
 * Trend model results
 */
export interface TrendModel {
  type: TrendType;
  coefficients: number[];
  r2: number;                  // R-squared value
  rmse: number;                // Root mean square error
  mae: number;                 // Mean absolute error
  equation: string;            // Human-readable equation
  residuals: number[];
  detrended: number[];         // Original data minus trend
}

/**
 * Change point in time series
 */
export interface ChangePoint {
  index: number;
  timestamp: number;
  confidence: number;
  type: 'level' | 'variance' | 'trend';
  magnitude: number;
  direction: 'increase' | 'decrease';
}

/**
 * Drift detection methods
 */
export enum DriftMethod {
  ADWIN = 'adwin',            // Adaptive Windowing
  PAGE_HINKLEY = 'page_hinkley',
  DDM = 'ddm',                // Drift Detection Method
  EDDM = 'eddm',              // Early Drift Detection Method
  CUSUM = 'cusum',            // Cumulative Sum
  EWMA = 'ewma'               // Exponentially Weighted Moving Average
}

/**
 * Drift detection configuration
 */
export interface DriftConfig {
  method: DriftMethod;
  sensitivity: number;         // 0-1, higher = more sensitive
  windowSize?: number;
  warningThreshold?: number;
  driftThreshold?: number;
  minSamples?: number;
  adaptiveThresholds?: boolean;
}

/**
 * Drift detection result
 */
export interface DriftResult {
  detected: boolean;
  warning: boolean;
  confidence: number;
  driftPoint?: number;         // Index where drift detected
  driftTimestamp?: number;
  currentMean: number;
  referenceMean: number;
  currentVariance: number;
  referenceVariance: number;
  statistics: {
    testStatistic: number;
    pValue?: number;
    threshold: number;
  };
}

/**
 * Prediction configuration
 */
export interface PredictionConfig {
  horizon: number;             // Steps ahead to predict
  confidenceLevel: number;     // e.g., 0.95 for 95% CI
  method: 'arima' | 'exponential' | 'trend' | 'ensemble';
  includeSeasonality?: boolean;
  exogenousVariables?: string[]; // External predictors
}

/**
 * Prediction result with intervals
 */
export interface PredictionResult {
  predictions: number[];        // Point forecasts
  timestamps: number[];
  confidenceIntervals: {
    lower: number[];
    upper: number[];
    level: number;
  };
  predictionIntervals?: {      // Wider than confidence intervals
    lower: number[];
    upper: number[];
    level: number;
  };
  method: string;
  metrics?: {
    mape?: number;             // Mean Absolute Percentage Error
    smape?: number;            // Symmetric MAPE
    mase?: number;             // Mean Absolute Scaled Error
  };
}

/**
 * Ensemble prediction result
 */
export interface EnsemblePrediction extends PredictionResult {
  models: {
    name: string;
    weight: number;
    predictions: number[];
    performance: number;       // Historical accuracy
  }[];
  aggregationMethod: 'mean' | 'weighted' | 'median' | 'best';
}

/**
 * Advanced trend analysis result
 */
export interface AdvancedTrendAnalysis {
  streamId: string;
  timestamp: number;
  dataPoints: number;
  trends: {
    linear: TrendModel;
    nonLinear?: TrendModel;
    best: TrendModel;          // Best fitting model
  };
  arima?: ARIMAModel;
  changePoints: ChangePoint[];
  drift?: DriftResult;
  predictions?: PredictionResult;
  seasonality?: {
    detected: boolean;
    period: number;
    strength: number;
    seasonal: number[];
    trend: number[];
    residual: number[];
  };
  stationarity: {
    isStationary: boolean;
    adfStatistic: number;      // Augmented Dickey-Fuller test
    pValue: number;
    criticalValues: {
      '1%': number;
      '5%': number;
      '10%': number;
    };
  };
}

/**
 * Model selection criteria
 */
export interface ModelSelectionResult {
  selectedModel: 'linear' | 'polynomial' | 'exponential' | 'arima' | 'ensemble';
  criteria: {
    aic: number;
    bic: number;
    r2: number;
    crossValidationScore: number;
  };
  rankings: Array<{
    model: string;
    score: number;
    rank: number;
  }>;
}

/**
 * Time series decomposition result
 */
export interface TimeSeriesDecomposition {
  method: 'additive' | 'multiplicative' | 'stl';
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalPeriod: number;
  strength: {
    trend: number;
    seasonal: number;
  };
}

/**
 * Anomaly in context of trends
 */
export interface TrendAnomaly {
  index: number;
  timestamp: number;
  value: number;
  expectedValue: number;
  deviation: number;
  type: 'spike' | 'dip' | 'level_shift' | 'trend_break';
  significance: number;
}

/**
 * Advanced trend analyzer events
 */
export interface AdvancedTrendAnalyzerEvents {
  'analysis:start': (streamId: string) => void;
  'analysis:complete': (result: AdvancedTrendAnalysis) => void;
  'analysis:error': (error: Error, streamId: string) => void;
  'model:fitted': (model: ARIMAModel | TrendModel, streamId: string) => void;
  'drift:detected': (drift: DriftResult, streamId: string) => void;
  'changepoint:detected': (changePoint: ChangePoint, streamId: string) => void;
  'prediction:generated': (prediction: PredictionResult, streamId: string) => void;
}

/**
 * Configuration for advanced trend analysis
 */
export interface AdvancedTrendConfig {
  enableARIMA: boolean;
  enableNonLinear: boolean;
  enableDriftDetection: boolean;
  enableChangePointDetection: boolean;
  enablePrediction: boolean;
  enableSeasonalDecomposition: boolean;
  
  arima?: {
    autoFit: boolean;          // Automatically determine p, d, q
    maxP?: number;
    maxD?: number;
    maxQ?: number;
    seasonal?: boolean;
    seasonalPeriod?: number;
  };
  
  nonLinear?: {
    types: TrendType[];
    maxPolynomialOrder?: number;
    crossValidate?: boolean;
  };
  
  drift?: DriftConfig;
  
  changePoint?: {
    method: 'pelt' | 'binseg' | 'window';
    penalty?: number;
    minSegmentLength?: number;
  };
  
  prediction?: PredictionConfig;
  
  performance?: {
    useWebWorkers?: boolean;
    cacheModels?: boolean;
    batchSize?: number;
  };
}

/**
 * Validation result for time series data
 */
export interface TimeSeriesValidation {
  isValid: boolean;
  issues: Array<{
    type: 'missing' | 'outlier' | 'duplicate' | 'irregular_spacing';
    indices: number[];
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  statistics: {
    length: number;
    missingCount: number;
    outlierCount: number;
    averageSpacing: number;
    spacingVariance: number;
  };
}