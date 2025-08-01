/**
 * Historical Data Comparison Components
 * Export all components, hooks, types, and utilities for historical data comparison
 */

// Main Components
export { 
  HistoricalComparisonChart,
  HistoricalComparisonChartFC 
} from './HistoricalComparisonChart';

export { 
  ComparisonModeSelector,
  EnhancedComparisonModeSelector,
  PresetComparisonModeSelector,
  useComparisonModeShortcuts
} from './ComparisonModeSelector';

export { StatisticalSummaryPanel } from './StatisticalSummaryPanel';

export { TimeRangeAlignmentTools } from './TimeRangeAlignmentTools';

export { 
  ProgressiveDataLoader,
  CompactProgressiveDataLoader 
} from './ProgressiveDataLoader';

// Hooks
export { useHistoricalComparison } from './useHistoricalComparison';

// Types
export type {
  // Core types
  ComparisonMode,
  AlignmentMode,
  StatisticalMetric,
  
  // Data types
  HistoricalDataPoint,
  HistoricalPeriod,
  ComparisonDataset,
  DatasetStatistics,
  ComparisonStatistics,
  
  // Configuration types
  TimeRange,
  AlignmentConfig,
  TimeRangePreset,
  LoadingState,
  ProgressiveLoadingConfig,
  ComparisonVisualizationConfig,
  ComparisonColorScheme,
  
  // Component props
  HistoricalComparisonChartProps,
  ComparisonModeSelectorProps,
  StatisticalSummaryPanelProps,
  TimeRangeAlignmentToolsProps,
  ProgressiveDataLoaderProps,
  
  // Service types
  HistoricalDataService,
  ComparisonChartEvents,
  
  // Hook types
  UseHistoricalComparisonOptions,
  UseHistoricalComparisonReturn
} from './types';

// Constants
export {
  COMPARISON_MODES,
  ALIGNMENT_MODES,
  STATISTICAL_METRICS,
  DEFAULT_TIME_PRESETS,
  DEFAULT_COMPARISON_COLORS
} from './types';

// Enhanced Integration Components
export { EnhancedTelemetryChart } from './EnhancedTelemetryChart';
export { HistoricalComparisonDashboard } from './HistoricalComparisonDashboard';