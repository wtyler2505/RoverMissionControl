/**
 * Historical Data Comparison Type Definitions
 * Comprehensive TypeScript interfaces for historical data comparison features
 */

import { TimeSeriesDataPoint, ChartDimensions, ChartEvents } from '../types';

// Comparison Mode Types
export type ComparisonMode = 'overlay' | 'side-by-side' | 'difference' | 'statistical';

export type AlignmentMode = 'absolute' | 'relative' | 'phase';

export type StatisticalMetric = 'mean' | 'median' | 'min' | 'max' | 'stddev' | 'percentile' | 'correlation';

// Historical Data Types
export interface HistoricalDataPoint extends TimeSeriesDataPoint {
  historicalPeriod: string;
  originalTimestamp: Date;
  alignedTimestamp: Date;
  metadata?: {
    sessionId?: string;
    dataQuality?: number;
    interpolated?: boolean;
    [key: string]: any;
  };
}

export interface HistoricalPeriod {
  id: string;
  label: string;
  startTime: Date;
  endTime: Date;
  color: string;
  opacity?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  visible: boolean;
  dataSourceId?: string;
}

export interface ComparisonDataset {
  id: string;
  label: string;
  data: HistoricalDataPoint[];
  period: HistoricalPeriod;
  statistics: DatasetStatistics;
  loadingState: LoadingState;
}

// Statistical Analysis Types
export interface DatasetStatistics {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  variance: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  correlation?: number;
  drift?: number;
  anomalies?: number;
}

export interface ComparisonStatistics {
  current: DatasetStatistics;
  historical: Record<string, DatasetStatistics>;
  correlations: Record<string, number>;
  differences: Record<string, {
    absolute: DatasetStatistics;
    relative: DatasetStatistics;
  }>;
  confidenceIntervals: Record<string, {
    lower: number;
    upper: number;
    confidence: number;
  }>;
}

// Time Range and Alignment Types
export interface TimeRange {
  start: Date;
  end: Date;
  duration: number;
  label?: string;
}

export interface AlignmentConfig {
  mode: AlignmentMode;
  referencePoint?: Date;
  phaseOffset?: number;
  customAlignment?: (timestamp: Date, period: HistoricalPeriod) => Date;
}

export interface TimeRangePreset {
  id: string;
  label: string;
  duration: number; // milliseconds
  description?: string;
  icon?: string;
}

// Progressive Loading Types
export interface LoadingState {
  phase: 'idle' | 'overview' | 'details' | 'full-resolution' | 'complete' | 'error';
  progress: number; // 0-100
  message?: string;
  error?: Error;
  dataPointsLoaded: number;
  totalDataPoints: number;
  loadingStartTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface ProgressiveLoadingConfig {
  enableProgressive: boolean;
  overviewResolution: number; // points per time unit
  detailResolution: number;
  fullResolution: number;
  chunkSize: number;
  maxConcurrentRequests: number;
  adaptiveLoading: boolean;
  memoryThreshold: number; // MB
}

// Visualization Configuration Types
export interface ComparisonVisualizationConfig {
  mode: ComparisonMode;
  alignment: AlignmentConfig;
  showConfidenceBands: boolean;
  showTrendlines: boolean;
  showAnomalies: boolean;
  showStatisticalMarkers: boolean;
  highlightDifferences: boolean;
  animationDuration: number;
  colorScheme: ComparisonColorScheme;
}

export interface ComparisonColorScheme {
  current: string;
  historical: string[];
  difference: {
    positive: string;
    negative: string;
    neutral: string;
  };
  confidence: {
    primary: string;
    secondary: string;
  };
}

// Component Props Types
export interface HistoricalComparisonChartProps {
  // Data
  currentData: TimeSeriesDataPoint[];
  historicalPeriods: HistoricalPeriod[];
  datasets: ComparisonDataset[];
  
  // Configuration
  mode: ComparisonMode;
  alignment: AlignmentConfig;
  visualization: ComparisonVisualizationConfig;
  progressiveLoading: ProgressiveLoadingConfig;
  
  // Display options
  dimensions?: Partial<ChartDimensions>;
  showLegend?: boolean;
  showStatistics?: boolean;
  showControls?: boolean;
  
  // Events
  onModeChange?: (mode: ComparisonMode) => void;
  onPeriodSelect?: (period: HistoricalPeriod) => void;
  onAlignmentChange?: (alignment: AlignmentConfig) => void;
  onDataRequest?: (period: HistoricalPeriod, resolution: number) => Promise<HistoricalDataPoint[]>;
  onStatisticsUpdate?: (statistics: ComparisonStatistics) => void;
  onExport?: (format: 'csv' | 'json' | 'png' | 'svg') => void;
  
  // Chart events
  events?: ChartEvents;
  
  // Accessibility
  ariaLabel?: string;
  ariaDescription?: string;
}

export interface ComparisonModeSelectorProps {
  currentMode: ComparisonMode;
  availableModes: ComparisonMode[];
  onModeChange: (mode: ComparisonMode) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  showIcons?: boolean;
}

export interface StatisticalSummaryPanelProps {
  statistics: ComparisonStatistics;
  selectedMetrics: StatisticalMetric[];
  onMetricToggle: (metric: StatisticalMetric) => void;
  showConfidenceIntervals?: boolean;
  precision?: number;
  compactMode?: boolean;
  exportable?: boolean;
}

export interface TimeRangeAlignmentToolsProps {
  currentRange: TimeRange;
  historicalRanges: TimeRange[];
  alignment: AlignmentConfig;
  presets: TimeRangePreset[];
  onRangeChange: (range: TimeRange) => void;
  onAlignmentChange: (alignment: AlignmentConfig) => void;
  onPresetSelect: (preset: TimeRangePreset) => void;
  syncEnabled?: boolean;
  onSyncToggle?: (enabled: boolean) => void;
}

export interface ProgressiveDataLoaderProps {
  loadingStates: Record<string, LoadingState>;
  config: ProgressiveLoadingConfig;
  onConfigChange: (config: ProgressiveLoadingConfig) => void;
  onLoadingPhaseChange: (phase: LoadingState['phase']) => void;
  showMemoryUsage?: boolean;
  showPerformanceMetrics?: boolean;
  compactView?: boolean;
}

// Service and Data Access Types
export interface HistoricalDataService {
  queryHistoricalData: (
    dataSourceId: string,
    timeRange: TimeRange,
    resolution: number,
    options?: {
      includeMetadata?: boolean;
      maxPoints?: number;
      compression?: 'none' | 'lossless' | 'lossy';
    }
  ) => Promise<HistoricalDataPoint[]>;
  
  getAvailablePeriods: (
    dataSourceId: string,
    timeRange?: TimeRange
  ) => Promise<HistoricalPeriod[]>;
  
  calculateStatistics: (
    data: HistoricalDataPoint[],
    metrics: StatisticalMetric[]
  ) => Promise<DatasetStatistics>;
  
  alignTimeRanges: (
    datasets: ComparisonDataset[],
    alignment: AlignmentConfig
  ) => Promise<ComparisonDataset[]>;
  
  exportData: (
    datasets: ComparisonDataset[],
    format: 'csv' | 'json' | 'xlsx',
    options?: {
      includeStatistics?: boolean;
      includeMetadata?: boolean;
      compression?: boolean;
    }
  ) => Promise<Blob>;
}

// Event Types
export interface ComparisonChartEvents extends ChartEvents {
  onComparisonModeChange?: (mode: ComparisonMode) => void;
  onHistoricalPeriodToggle?: (period: HistoricalPeriod, visible: boolean) => void;
  onAlignmentModeChange?: (alignment: AlignmentConfig) => void;
  onStatisticalAnalysisComplete?: (statistics: ComparisonStatistics) => void;
  onDataLoadingProgress?: (state: LoadingState) => void;
  onMemoryThresholdExceeded?: (usage: number, threshold: number) => void;
}

// Hook Types
export interface UseHistoricalComparisonOptions {
  dataService: HistoricalDataService;
  defaultMode?: ComparisonMode;
  defaultAlignment?: AlignmentConfig;
  progressiveLoading?: ProgressiveLoadingConfig;
  caching?: {
    enabled: boolean;
    maxCacheSize: number;
    ttl: number;
  };
}

export interface UseHistoricalComparisonReturn {
  // State
  currentMode: ComparisonMode;
  datasets: ComparisonDataset[];
  statistics: ComparisonStatistics | null;
  loadingStates: Record<string, LoadingState>;
  alignment: AlignmentConfig;
  
  // Actions
  setMode: (mode: ComparisonMode) => void;
  addHistoricalPeriod: (period: HistoricalPeriod) => Promise<void>;
  removeHistoricalPeriod: (periodId: string) => void;
  updateAlignment: (alignment: AlignmentConfig) => void;
  refreshData: () => Promise<void>;
  clearCache: () => void;
  
  // Utilities
  exportComparison: (format: 'csv' | 'json' | 'png' | 'svg') => Promise<void>;
  calculateDifferences: () => ComparisonDataset;
  getMemoryUsage: () => number;
}

// Constants
export const COMPARISON_MODES: ComparisonMode[] = ['overlay', 'side-by-side', 'difference', 'statistical'];

export const ALIGNMENT_MODES: AlignmentMode[] = ['absolute', 'relative', 'phase'];

export const STATISTICAL_METRICS: StatisticalMetric[] = [
  'mean', 'median', 'min', 'max', 'stddev', 'percentile', 'correlation'
];

export const DEFAULT_TIME_PRESETS: TimeRangePreset[] = [
  { id: 'last-hour', label: 'Last Hour', duration: 3600000 },
  { id: 'last-day', label: 'Last Day', duration: 86400000 },
  { id: 'last-week', label: 'Last Week', duration: 604800000 },
  { id: 'last-month', label: 'Last Month', duration: 2592000000 },
  { id: 'last-year', label: 'Last Year', duration: 31536000000 },
];

export const DEFAULT_COMPARISON_COLORS: ComparisonColorScheme = {
  current: '#2196f3',
  historical: ['#ff9800', '#4caf50', '#9c27b0', '#f44336', '#795548'],
  difference: {
    positive: '#4caf50',
    negative: '#f44336',
    neutral: '#9e9e9e'
  },
  confidence: {
    primary: 'rgba(33, 150, 243, 0.2)',
    secondary: 'rgba(33, 150, 243, 0.1)'
  }
};