/**
 * Threshold and Alert Type Definitions
 * Comprehensive TypeScript interfaces for threshold visualization and alerting
 */

// Core Threshold Types
export interface ThresholdDefinition {
  id: string;
  name: string;
  description?: string;
  metricId: string;
  metricName: string;
  type: 'static' | 'dynamic_percentile' | 'dynamic_stddev' | 'conditional' | 'time_based' | 'rate_of_change';
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  
  // Static threshold config
  value?: number;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in_range' | 'out_of_range';
  lowerBound?: number;
  upperBound?: number;
  
  // Dynamic threshold config
  baselineWindow?: { value: number; unit: 'minutes' | 'hours' | 'days' };
  evaluationMethod?: 'percentile' | 'stddev' | 'moving_avg';
  percentile?: number;
  stddevMultiplier?: number;
  smoothingFactor?: number;
  minDataPoints?: number;
  
  // Conditional config
  conditionMetric?: string;
  conditionOperator?: 'gt' | 'lt' | 'eq';
  conditionValue?: number;
  
  // General settings
  hysteresis?: number;
  consecutiveViolations?: number;
  debounceTime?: { value: number; unit: 'seconds' | 'minutes' };
  
  // Visualization settings
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  fill?: boolean;
  fillOpacity?: number;
  showLabel?: boolean;
  showValue?: boolean;
  showConfidenceInterval?: boolean;
  
  // Metadata
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// Alert Types
export interface AlertInstance {
  id: string;
  thresholdId: string;
  timestamp: Date;
  value: number;
  expectedValue?: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  escalationLevel: number;
  suppressed: boolean;
  metadata?: Record<string, any>;
}

// Threshold Visualization Types
export interface ThresholdVisualization {
  type: 'line' | 'band' | 'zone' | 'gradient';
  threshold: ThresholdDefinition;
  calculatedValue?: number;
  confidenceInterval?: [number, number];
  animated: boolean;
  visible: boolean;
  interactive: boolean;
}

export interface ThresholdOverlayProps {
  thresholds: ThresholdDefinition[];
  alerts: AlertInstance[];
  data: any[];
  dimensions: { width: number; height: number };
  scales: { x: any; y: any };
  animationEnabled?: boolean;
  interactiveEnabled?: boolean;
  showConfidenceIntervals?: boolean;
  onThresholdClick?: (threshold: ThresholdDefinition, event: MouseEvent) => void;
  onThresholdHover?: (threshold: ThresholdDefinition | null, event: MouseEvent) => void;
  className?: string;
}

// Alert Indicator Types
export interface AlertIndicatorProps {
  alerts: AlertInstance[];
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  maxVisible?: number;
  showCount?: boolean;
  showSeverityIcons?: boolean;
  showTimestamp?: boolean;
  onAlertClick?: (alert: AlertInstance) => void;
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  className?: string;
}

// Threshold Configuration Types
export interface ThresholdTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thresholdType: ThresholdDefinition['type'];
  config: Partial<ThresholdDefinition>;
  requiredVariables: string[];
  optionalVariables: string[];
  isSystem: boolean;
  tags: string[];
}

export interface ThresholdConfigurationProps {
  metricId?: string;
  metricName?: string;
  thresholds: ThresholdDefinition[];
  templates: ThresholdTemplate[];
  availableMetrics: Array<{ id: string; name: string; unit?: string }>;
  onThresholdCreate: (threshold: Partial<ThresholdDefinition>) => Promise<ThresholdDefinition>;
  onThresholdUpdate: (id: string, updates: Partial<ThresholdDefinition>) => Promise<ThresholdDefinition>;
  onThresholdDelete: (id: string) => Promise<void>;
  onThresholdTest: (id: string, testValue?: number) => Promise<any>;
  onTemplateApply: (templateId: string, variables: Record<string, any>) => Promise<any>;
  onBulkOperation: (operation: string, thresholdIds: string[], updates?: any) => Promise<any>;
  onImportExport: (action: 'import' | 'export', data?: any) => Promise<any>;
  className?: string;
}

// Alert Dashboard Types
export interface AlertFilter {
  severity?: 'info' | 'warning' | 'error' | 'critical' | 'all';
  status?: 'active' | 'acknowledged' | 'resolved' | 'all';
  timeRange?: { start: Date; end: Date };
  metricIds?: string[];
  thresholdIds?: string[];
  searchText?: string;
}

export interface AlertDashboardProps {
  alerts: AlertInstance[];
  thresholds: ThresholdDefinition[];
  onAlertAcknowledge: (alertId: string, comment?: string) => Promise<void>;
  onAlertResolve: (alertId: string, comment?: string) => Promise<void>;
  onAlertSilence: (alertId: string, duration: number) => Promise<void>;
  onBulkOperation: (operation: string, alertIds: string[]) => Promise<void>;
  onFilterChange: (filter: AlertFilter) => void;
  refreshInterval?: number;
  className?: string;
}

// Enhanced Chart Integration Types
export interface ChartWithThresholdsProps {
  chartType: 'line' | 'area' | 'gauge' | 'heatmap' | 'scatter';
  data: any[];
  thresholds: ThresholdDefinition[];
  alerts: AlertInstance[];
  thresholdVisualizationMode?: 'overlay' | 'sidebar' | 'popup';
  alertIndicatorMode?: 'embedded' | 'floating' | 'header';
  onThresholdInteraction?: (threshold: ThresholdDefinition, action: string) => void;
  onAlertInteraction?: (alert: AlertInstance, action: string) => void;
  realTimeEnabled?: boolean;
  className?: string;
}

// Alert Statistics and Trends
export interface AlertStatistics {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byMetric: Record<string, number>;
  byTimeRange: Array<{ timestamp: Date; count: number; severity: string }>;
  averageResolutionTime: number;
  escalationRate: number;
}

export interface AlertTrend {
  timestamp: Date;
  count: number;
  severity: string;
  metric?: string;
}

// Threshold Evaluation Context
export interface ThresholdEvaluationContext {
  currentValue: number;
  historicalData: number[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ThresholdEvaluationResult {
  threshold: ThresholdDefinition;
  violated: boolean;
  calculatedThreshold: number;
  confidence?: number;
  reason?: string;
  suggestedAction?: string;
}

// Performance and Optimization Types
export interface ThresholdRenderingOptions {
  enableLOD?: boolean; // Level of Detail
  decimationFactor?: number;
  enableWebWorker?: boolean;
  enableCanvas?: boolean;
  batchSize?: number;
  renderThrottleMs?: number;
}

// Accessibility Types
export interface ThresholdAccessibilityConfig {
  announceThresholdViolations?: boolean;
  announceAlertChanges?: boolean;
  keyboardNavigation?: boolean;
  highContrastMode?: boolean;
  reducedMotion?: boolean;
  screenReaderDescriptions?: boolean;
}

// Integration Types
export interface ThresholdIntegrationConfig {
  enableNotifications?: boolean;
  enableEmailAlerts?: boolean;
  enableSlackIntegration?: boolean;
  enableWebhooks?: boolean;
  enableAuditLog?: boolean;
  retentionPolicy?: {
    alertHistoryDays: number;
    thresholdHistoryDays: number;
  };
}

// Color and Theme Types
export interface ThresholdColorScheme {
  info: string;
  warning: string;
  error: string;
  critical: string;
  background: string;
  text: string;
  border: string;
}

export interface AlertColorScheme extends ThresholdColorScheme {
  acknowledged: string;
  resolved: string;
  suppressed: string;
}

// Export Types
export interface ThresholdExportConfig {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  includeAlerts?: boolean;
  includeStatistics?: boolean;
  dateRange?: { start: Date; end: Date };
  filters?: AlertFilter;
}

// Real-time Update Types
export interface ThresholdUpdateEvent {
  type: 'threshold_created' | 'threshold_updated' | 'threshold_deleted' | 'alert_triggered' | 'alert_resolved';
  data: ThresholdDefinition | AlertInstance;
  timestamp: Date;
}

export interface RealTimeThresholdConfig {
  enableRealTimeUpdates?: boolean;
  updateInterval?: number;
  enableWebSocket?: boolean;
  enableServerSentEvents?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}