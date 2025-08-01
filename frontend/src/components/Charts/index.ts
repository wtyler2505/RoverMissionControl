/**
 * Chart Components Library
 * Export all chart components, utilities, hooks, and types
 */

// Base Components
export { BaseChart, BaseChartFC } from './base/BaseChart';
export { ResponsiveContainer, useResponsiveDimensions } from './base/ResponsiveContainer';
export { ChartThemeProvider, useChartTheme } from './base/ChartThemeProvider';

// Chart Components
export { LineChart } from './charts/LineChart';
export { AreaChart } from './charts/AreaChart';
export { BarChart } from './charts/BarChart';
export { GaugeChart } from './charts/GaugeChart';
export { HeatmapChart } from './charts/HeatmapChart';

// Hooks
export {
  useTimeSeriesData,
  useRealTimeData,
  useDataFilter,
  useCachedChartData,
  useDataExport
} from './hooks/useChartData';

// Utilities
export {
  binData,
  decimateData,
  smoothData,
  removeOutliers,
  aggregateByTimeWindow,
  convertToHeatmapData,
  pivotData,
  interpolateMissingValues,
  calculateCorrelationMatrix,
  createTransformationPipeline,
  commonPipelines
} from './utils/dataTransformers';

export {
  createScale,
  inferScaleType,
  createTimeScale,
  createColorScale,
  createAdaptiveScale,
  createMultiSeriesScales,
  createScalesWithMargins,
  updateScaleDomain,
  commonScaleConfigs
} from './utils/scaleFactories';

// Types
export type {
  ChartDataPoint,
  TimeSeriesDataPoint,
  HeatmapDataPoint,
  GaugeDataPoint,
  ChartDimensions,
  ScaleType,
  AxisConfig,
  AnimationConfig,
  TooltipConfig,
  LegendConfig,
  BaseChartProps,
  LineChartProps,
  AreaChartProps,
  BarChartProps,
  GaugeChartProps,
  HeatmapChartProps,
  ChartUpdateConfig,
  PerformanceOptions,
  ExportConfig,
  ChartEvents,
  ChartState,
  ChartContextValue,
  ResponsiveContainerProps,
  ChartAnnotation,
  DataTransformer,
  TransformationPipeline,
  ScaleFactoryOptions,
  ChartRegistryEntry
} from './types';

// Chart Theme Types
export type { ChartTheme } from './base/ChartThemeProvider';

// Threshold and Alert Components
export {
  ThresholdOverlay,
  AlertIndicator,
  ThresholdConfiguration,
  AlertDashboard,
  ChartWithThresholds,
  createThreshold,
  createAlert,
  validateThreshold,
  validateAlert,
  transformChartDataForThresholds,
  getThresholdColorScheme,
  getAlertColorScheme,
  THRESHOLD_COLORS,
  THRESHOLD_STYLES
} from './threshold';

// Threshold and Alert Types
export type {
  ThresholdDefinition,
  AlertInstance,
  ThresholdVisualization,
  ThresholdOverlayProps,
  AlertIndicatorProps,
  ThresholdTemplate,
  ThresholdConfigurationProps,
  AlertFilter,
  AlertDashboardProps,
  ChartWithThresholdsProps,
  AlertStatistics,
  ThresholdEvaluationContext,
  ThresholdEvaluationResult,
  ThresholdRenderingOptions,
  ThresholdAccessibilityConfig,
  ThresholdIntegrationConfig,
  ThresholdColorScheme,
  AlertColorScheme,
  ThresholdExportConfig,
  ThresholdUpdateEvent,
  RealTimeThresholdConfig
} from './threshold';

// Historical Data Comparison Components
export {
  HistoricalComparisonChart,
  HistoricalComparisonChartFC,
  ComparisonModeSelector,
  EnhancedComparisonModeSelector,
  PresetComparisonModeSelector,
  useComparisonModeShortcuts,
  StatisticalSummaryPanel,
  TimeRangeAlignmentTools,
  ProgressiveDataLoader,
  CompactProgressiveDataLoader,
  EnhancedTelemetryChart,
  HistoricalComparisonDashboard,
  useHistoricalComparison,
  COMPARISON_MODES,
  ALIGNMENT_MODES,
  STATISTICAL_METRICS,
  DEFAULT_TIME_PRESETS,
  DEFAULT_COMPARISON_COLORS
} from './historical';

// Historical Data Comparison Types
export type {
  ComparisonMode,
  AlignmentMode,
  StatisticalMetric,
  HistoricalDataPoint,
  HistoricalPeriod,
  ComparisonDataset,
  DatasetStatistics,
  ComparisonStatistics,
  TimeRange,
  AlignmentConfig,
  TimeRangePreset,
  LoadingState,
  ProgressiveLoadingConfig,
  ComparisonVisualizationConfig,
  ComparisonColorScheme,
  HistoricalComparisonChartProps,
  ComparisonModeSelectorProps,
  StatisticalSummaryPanelProps,
  TimeRangeAlignmentToolsProps,
  ProgressiveDataLoaderProps,
  HistoricalDataService,
  ComparisonChartEvents,
  UseHistoricalComparisonOptions,
  UseHistoricalComparisonReturn
} from './historical';