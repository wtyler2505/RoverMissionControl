/**
 * Threshold and Alert Components Index
 * Centralized exports for all threshold and alert related components
 */

// Type definitions
export * from '../types/threshold-types';

// Core components
export { default as ThresholdOverlay } from '../overlays/ThresholdOverlay';
export { default as AlertIndicator } from '../indicators/AlertIndicator';
export { default as ThresholdConfiguration } from '../configuration/ThresholdConfiguration';
export { default as AlertDashboard } from '../dashboards/AlertDashboard';

// Enhanced chart integration
export { default as ChartWithThresholds } from '../enhanced/ChartWithThresholds';

// Utility functions and hooks (to be implemented)
export const createThreshold = (
  name: string,
  metricId: string,
  type: 'static' | 'dynamic_percentile' | 'dynamic_stddev',
  value: number,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'warning'
) => ({
  id: `threshold-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name,
  metricId,
  metricName: '', // Would be populated from metric lookup
  type,
  severity,
  enabled: true,
  value,
  operator: 'gt' as const,
  consecutiveViolations: 1,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date()
});

export const createAlert = (
  thresholdId: string,
  value: number,
  message: string,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'warning'
) => ({
  id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  thresholdId,
  timestamp: new Date(),
  value,
  severity,
  message,
  acknowledged: false,
  resolved: false,
  escalationLevel: 0,
  suppressed: false
});

// Color and style utilities
export const THRESHOLD_COLORS = {
  info: '#2196f3',
  warning: '#ff9800',
  error: '#f44336',
  critical: '#9c27b0'
};

export const THRESHOLD_STYLES = {
  solid: 'none',
  dashed: '8,4',
  dotted: '2,2'
};

// Validation utilities
export const validateThreshold = (threshold: any): string[] => {
  const errors: string[] = [];
  
  if (!threshold.name || threshold.name.trim() === '') {
    errors.push('Threshold name is required');
  }
  
  if (!threshold.metricId || threshold.metricId.trim() === '') {
    errors.push('Metric ID is required');
  }
  
  if (!threshold.type) {
    errors.push('Threshold type is required');
  }
  
  if (threshold.type === 'static' && (threshold.value === undefined || threshold.value === null)) {
    errors.push('Static threshold value is required');
  }
  
  if (!threshold.severity || !['info', 'warning', 'error', 'critical'].includes(threshold.severity)) {
    errors.push('Valid severity level is required');
  }
  
  if (!threshold.operator || !['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in_range', 'out_of_range'].includes(threshold.operator)) {
    errors.push('Valid operator is required');
  }
  
  if ((threshold.operator === 'in_range' || threshold.operator === 'out_of_range') && 
      (threshold.lowerBound === undefined || threshold.upperBound === undefined)) {
    errors.push('Range operators require both lower and upper bounds');
  }
  
  if (threshold.lowerBound !== undefined && threshold.upperBound !== undefined && 
      threshold.lowerBound >= threshold.upperBound) {
    errors.push('Lower bound must be less than upper bound');
  }
  
  if (threshold.hysteresis !== undefined && threshold.hysteresis < 0) {
    errors.push('Hysteresis must be non-negative');
  }
  
  if (threshold.consecutiveViolations !== undefined && threshold.consecutiveViolations < 1) {
    errors.push('Consecutive violations must be at least 1');
  }
  
  return errors;
};

export const validateAlert = (alert: any): string[] => {
  const errors: string[] = [];
  
  if (!alert.thresholdId || alert.thresholdId.trim() === '') {
    errors.push('Threshold ID is required');
  }
  
  if (alert.value === undefined || alert.value === null || isNaN(alert.value)) {
    errors.push('Valid alert value is required');
  }
  
  if (!alert.message || alert.message.trim() === '') {
    errors.push('Alert message is required');
  }
  
  if (!alert.severity || !['info', 'warning', 'error', 'critical'].includes(alert.severity)) {
    errors.push('Valid severity level is required');
  }
  
  if (!alert.timestamp || !(alert.timestamp instanceof Date)) {
    errors.push('Valid timestamp is required');
  }
  
  return errors;
};

// Data transformation utilities
export const transformChartDataForThresholds = (data: any[], chartType: string) => {
  // Transform data based on chart type for threshold evaluation
  switch (chartType) {
    case 'line':
    case 'area':
      return data.map(d => ({
        time: d.x instanceof Date ? d.x : new Date(d.x),
        value: d.y,
        metadata: d
      }));
      
    case 'gauge':
      return [{
        time: new Date(),
        value: data[0]?.value || 0,
        metadata: data[0]
      }];
      
    case 'heatmap':
      return data.map(d => ({
        time: new Date(),
        value: d.value,
        metadata: d
      }));
      
    case 'scatter':
      return data.map(d => ({
        time: d.x instanceof Date ? d.x : new Date(),
        value: d.y,
        metadata: d
      }));
      
    default:
      return data.map(d => ({
        time: new Date(),
        value: typeof d === 'number' ? d : d.value || d.y || 0,
        metadata: d
      }));
  }
};

// Theme integration
export const getThresholdColorScheme = (theme: any) => ({
  info: theme.palette.info.main,
  warning: theme.palette.warning.main,
  error: theme.palette.error.main,
  critical: theme.palette.error.dark,
  background: theme.palette.background.paper,
  text: theme.palette.text.primary,
  border: theme.palette.divider
});

export const getAlertColorScheme = (theme: any) => ({
  ...getThresholdColorScheme(theme),
  acknowledged: theme.palette.warning.light,
  resolved: theme.palette.success.main,
  suppressed: theme.palette.grey[500]
});