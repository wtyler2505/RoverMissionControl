// Main components
export { default as RealTimeChart } from './RealTimeChart';
export { default as TelemetryDashboard } from './TelemetryDashboard';
export { useRealTimeData, useWebWorkerProcessing } from './useRealTimeData';

// Analysis components
export { default as DataAnalysisPanel } from './DataAnalysisPanel';
export { default as FilterBuilder } from './FilterBuilder';
export { default as AlertConfiguration } from './AlertConfiguration';

// Correlation analysis components
export { default as CorrelationMatrix } from './CorrelationMatrix';
export { default as LagAnalysisChart } from './LagAnalysisChart';
export { default as CorrelationPanel } from './CorrelationPanel';

// Dashboard and layout components
export { default as ComprehensiveDashboard } from './ComprehensiveDashboard';
export { default as StreamSelector } from './StreamSelector';
export { default as TimeControlBar } from './TimeControlBar';

// Provider and context
export { 
  TelemetryProvider,
  useTelemetry,
  useTelemetryStream,
  useTelemetryRecording,
  useTelemetryPreferences,
  useTelemetryHealth
} from './TelemetryProvider';

// Additional hooks
export {
  useRealTimeTelemetry,
  useWindowedTelemetry,
  useTelemetryStatistics,
  useTelemetryAlerts,
  useTelemetryExport,
  useHistoricalTelemetry,
  useTelemetryComparison
} from './hooks';

// Re-export types from components
export type {
  DataPoint,
  DataSeries,
  YAxis,
  ChartOptions,
  PerformanceMetrics,
} from './RealTimeChart';

export type {
  UseRealTimeDataOptions,
  RealTimeDataManager,
  DataStatistics,
} from './useRealTimeData';

// Re-export types from provider
export type {
  TelemetryPreferences,
  HistoricalDataRequest,
  RecordingSession,
  StreamHealth,
  TelemetryContextValue,
  TelemetryAlert
} from './TelemetryProvider';

// Re-export correlation analysis types
export type {
  CorrelationMatrixProps
} from './CorrelationMatrix';

export type {
  LagAnalysisChartProps
} from './LagAnalysisChart';

export type {
  CorrelationPanelProps
} from './CorrelationPanel';

// Streaming visualization components
export { default as RealTimeStreamChart } from './RealTimeStreamChart';
export { default as MultiStreamDashboard } from './MultiStreamDashboard';
export { default as StreamingIndicators } from './StreamingIndicators';

// Enhanced interactive components
export { default as EnhancedRealTimeChart } from './EnhancedRealTimeChart';

// Export components
export { default as ExportToolbar } from './ExportToolbar';
export { default as ChartWithExport } from './ChartWithExport';

// Annotation components
export { default as ChartAnnotations } from './ChartAnnotations';

// Dashboard template components
export * from './Dashboard/DashboardTemplateManager';
export * from './Dashboard/QuickActionsToolbar';

// Trend analysis components
export * from './TrendAnalysis';

// Integration showcase
export { default as TelemetryIntegrationShowcase } from './TelemetryIntegrationShowcase';

// WebSocket integration components
export { default as WebSocketStatusIndicator } from './WebSocketStatusIndicator';
export { default as WebSocketStreamSelector } from './WebSocketStreamSelector';
export { default as StreamStatistics } from './StreamStatistics';
export { default as WebSocketRealTimeChart } from './WebSocketRealTimeChart';

// Re-export streaming types
export type {
  RealTimeStreamChartProps
} from './RealTimeStreamChart';

export type {
  MultiStreamDashboardProps
} from './MultiStreamDashboard';

export type {
  StreamingIndicatorsProps
} from './StreamingIndicators';

export type {
  EnhancedRealTimeChartProps
} from './EnhancedRealTimeChart';

export type {
  ExportToolbarProps
} from './ExportToolbar';

// WebSocket component types
export type {
  WebSocketStatusIndicatorProps
} from './WebSocketStatusIndicator';

export type {
  WebSocketStreamSelectorProps
} from './WebSocketStreamSelector';

export type {
  StreamStatisticsProps
} from './StreamStatistics';

export type {
  WebSocketRealTimeChartProps
} from './WebSocketRealTimeChart';