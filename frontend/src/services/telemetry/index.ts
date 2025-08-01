/**
 * Telemetry Services - Export Index
 * Central export point for all telemetry analysis services
 */

// Core telemetry analyzer
export {
  TelemetryAnalyzer,
  StatisticalAnalysis,
  AnomalyDetection,
  TrendAnalysis,
  FrequencyAnalysis,
  DataFilter,
  ReportGenerator
} from './TelemetryAnalyzer';

// Correlation analysis
export {
  CorrelationAnalyzer
} from './CorrelationAnalyzer';

// Historical data management
export { HistoricalDataManager } from './HistoricalDataManager';
export { PlaybackController } from './PlaybackController';

// Advanced trend detection and prediction
export {
  AdvancedTrendAnalyzer,
  DriftDetector,
  PredictionEngine,
  createAdvancedTrendAnalyzer,
  createDriftDetector,
  createPredictionEngine,
  DEFAULT_ADVANCED_TREND_CONFIG,
  DEFAULT_DRIFT_CONFIG,
  DEFAULT_PREDICTION_CONFIG
} from './trend';

// Integration service
export {
  TelemetryIntegrationService,
  telemetryIntegration
} from './TelemetryIntegrationService';

// Dashboard template engine
export { DashboardTemplateEngine } from './DashboardTemplateEngine';

// WebSocket stream management
export {
  TelemetryStreamManager,
  telemetryStreamManager
} from './TelemetryStreamManager';

// Types and interfaces
export type {
  TelemetryStream,
  AnalysisConfig,
  AnalysisReport
} from './TelemetryAnalyzer';

export type {
  CorrelationResult,
  CrossCorrelationResult,
  LagAnalysisConfig,
  CorrelationMatrixEntry,
  CorrelationStreamData,
  CorrelationAnalyzerEvents
} from './CorrelationAnalyzer';

export type {
  AdvancedTrendAnalysis,
  ARIMAConfig,
  ARIMAModel,
  TrendModel,
  TrendType,
  DriftResult,
  DriftMethod,
  PredictionResult,
  EnsemblePrediction,
  ChangePoint,
  TimeSeriesDecomposition,
  AdvancedTrendAnalyzerEvents,
  DriftDetectorEvents,
  PredictionEngineEvents
} from './trend';

export type {
  IntegrationConfig,
  IntegrationStatus,
  IntegrationEvents
} from './TelemetryIntegrationService';

// Default configurations
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  anomalyDetection: {
    method: 'zscore',
    threshold: 3,
    windowSize: 50,
    contamination: 0.1
  },
  frequencyAnalysis: {
    enabled: true,
    windowSize: 1024,
    peakThreshold: 0.1
  },
  filtering: {
    type: 'lowpass',
    cutoffFreq: 10,
    windowSize: 5,
    polyOrder: 2
  },
  correlation: {
    enabled: true,
    streams: []
  },
  trends: {
    enabled: true,
    windowSize: 100,
    predictionPeriods: 5
  }
};

export const DEFAULT_LAG_ANALYSIS_CONFIG: LagAnalysisConfig = {
  maxLag: 100,
  significanceThreshold: 0.3,
  windowSize: 1000,
  step: 1
};

// WebSocket types
export type {
  StreamManagerConfig,
  StreamChannel,
  StreamAnalysisConfig,
  StreamHealth,
  TelemetryStreamManagerEvents
} from './TelemetryStreamManager';

// Data Binding Layer
export {
  DataBindingLayer,
  DataBinding,
  DataSource
} from './DataBindingLayer';

export type {
  TelemetryDataPoint,
  DataSourceConfig,
  DataBindingConfig,
  DataTransformFunction,
  DataFilterFunction,
  AggregationConfig,
  NormalizationConfig,
  ValidationConfig,
  ErrorHandlingConfig,
  DataSubscription,
  ChartDataAdapter
} from './DataBindingLayer';

// Chart Adapters
export {
  LineChartAdapter,
  GaugeChartAdapter,
  HeatmapChartAdapter,
  HistogramChartAdapter,
  ScatterChartAdapter,
  AreaChartAdapter,
  ChartAdapterFactory,
  TelemetryPresets
} from './ChartAdapters';

// Real-Time Update System
export {
  RealTimeUpdateManager,
  StreamProcessor,
  BackpressureHandler,
  ChartPerformanceOptimizer,
  RealTimeChartConnector,
  createHighFrequencyProcessor,
  createLowLatencyProcessor,
  createAggregationProcessor
} from './realtime';

export type {
  UpdateFrame,
  ChartUpdate,
  TransitionConfig,
  PerformanceMetrics as RealTimePerformanceMetrics,
  BackpressureConfig,
  UpdateManagerConfig,
  StreamConfig,
  StreamMetrics,
  ProcessedDataPoint,
  BackpressureStrategy,
  PrioritizedMessage,
  BackpressureMetrics,
  PerformanceConfig,
  RenderBudget,
  PerformanceProfile,
  OptimizationSuggestion,
  ObjectPool,
  PerformanceReport,
  RealTimeChartConfig,
  ChartConnection,
  ChartConnectionMetrics
} from './realtime';