/**
 * Enhanced Progress Tracking Types
 * 
 * Comprehensive type definitions for granular command progress tracking,
 * real-time updates, performance monitoring, and analytics.
 */

import { CommandType, CommandPriority, CommandStatus } from '../../../shared/types/command-queue.types';

/**
 * Granular progress step definition
 */
export interface ProgressStep {
  id: string;
  name: string;
  description?: string;
  order: number;
  status: 'pending' | 'active' | 'completed' | 'error' | 'skipped';
  progress: number; // 0-1
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  estimatedDuration?: number; // milliseconds
  errorMessage?: string;
  metadata?: Record<string, any>;
  substeps?: ProgressStep[];
}

/**
 * Enhanced command progress tracking
 */
export interface EnhancedProgress {
  commandId: string;
  trackingId: string;
  overallProgress: number; // 0-1
  currentStep?: string;
  steps: ProgressStep[];
  startedAt: Date;
  estimatedCompletionTime?: Date;
  actualCompletionTime?: Date;
  isStalled: boolean;
  stalledDuration?: number;
  throughput: number; // commands per second
  errorRate: number; // 0-1
  retryCount: number;
  lastUpdatedAt: Date;
  updateFrequency: number; // updates per second
}

/**
 * Real-time progress update event
 */
export interface ProgressUpdateEvent {
  eventId: string;
  commandId: string;
  timestamp: Date;
  updateType: 'step_started' | 'step_completed' | 'progress_update' | 
              'error' | 'stalled' | 'resumed' | 'completed';
  stepId?: string;
  progress?: number;
  message?: string;
  metadata?: Record<string, any>;
  delta?: {
    progressChange: number;
    timeElapsed: number;
    estimatedTimeRemaining?: number;
  };
}

/**
 * Progress notification
 */
export interface ProgressNotification {
  id: string;
  commandId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionable: boolean;
  actions?: NotificationAction[];
  autoHide?: boolean;
  autoHideDelay?: number; // milliseconds
  metadata?: Record<string, any>;
}

/**
 * Notification action
 */
export interface NotificationAction {
  id: string;
  label: string;
  action: 'retry' | 'cancel' | 'view_details' | 'acknowledge' | 'custom';
  customHandler?: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Performance metrics for commands
 */
export interface CommandPerformanceMetrics {
  commandId: string;
  commandType: CommandType;
  priority: CommandPriority;
  queueTime: number; // milliseconds
  executionTime: number; // milliseconds
  totalTime: number; // milliseconds
  cpuUsage?: number; // percentage
  memoryUsage?: number; // bytes
  networkLatency?: number; // milliseconds
  throughput?: number; // operations per second
  errorCount: number;
  retryCount: number;
  timestamp: Date;
}

/**
 * Aggregated performance analytics
 */
export interface PerformanceAnalytics {
  timeRange: {
    start: Date;
    end: Date;
  };
  totalCommands: number;
  averageQueueTime: number;
  averageExecutionTime: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  successRate: number;
  errorRate: number;
  throughput: {
    current: number;
    average: number;
    peak: number;
  };
  commandTypeBreakdown: Record<CommandType, {
    count: number;
    avgExecutionTime: number;
    successRate: number;
  }>;
  priorityBreakdown: Record<CommandPriority, {
    count: number;
    avgQueueTime: number;
    avgExecutionTime: number;
  }>;
  errorCategories: Record<string, number>;
  resourceUsage: {
    avgCpuUsage: number;
    peakCpuUsage: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
  };
}

/**
 * Progress history entry for replay
 */
export interface ProgressHistoryEntry {
  id: string;
  commandId: string;
  timestamp: Date;
  snapshot: EnhancedProgress;
  events: ProgressUpdateEvent[];
  metrics: CommandPerformanceMetrics;
  outcome: 'success' | 'failure' | 'cancelled' | 'timeout';
}

/**
 * Alert rule definition
 */
export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownPeriod?: number; // milliseconds
  lastTriggered?: Date;
  triggerCount: number;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: 'execution_time' | 'queue_time' | 'error_rate' | 'stall_duration' | 
          'retry_count' | 'throughput' | 'resource_usage';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  threshold: number;
  duration?: number; // condition must be true for this duration
  commandTypeFilter?: CommandType[];
  priorityFilter?: CommandPriority[];
}

/**
 * Alert action
 */
export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'log' | 'custom';
  config: Record<string, any>;
}

/**
 * Alert instance
 */
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: Date;
  resolvedAt?: Date;
  affectedCommands: string[];
  message: string;
  details: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  id: string;
  name: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  refreshInterval: number; // milliseconds
  timeRange: 'last_15m' | 'last_1h' | 'last_6h' | 'last_24h' | 'custom';
  customTimeRange?: {
    start: Date;
    end: Date;
  };
  filters?: {
    commandTypes?: CommandType[];
    priorities?: CommandPriority[];
    statuses?: CommandStatus[];
  };
}

/**
 * Dashboard layout
 */
export interface DashboardLayout {
  type: 'grid' | 'flex' | 'custom';
  columns?: number;
  rows?: number;
  gap?: number;
}

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  id: string;
  type: 'progress_overview' | 'performance_chart' | 'alert_list' | 
        'command_queue' | 'notification_feed' | 'metrics_summary' | 
        'resource_usage' | 'error_log' | 'custom';
  title: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: Record<string, any>;
  refreshInterval?: number;
}

/**
 * Progress tracking configuration
 */
export interface ProgressTrackingConfig {
  enableGranularTracking: boolean;
  trackingGranularity: 'low' | 'medium' | 'high';
  updateInterval: number; // milliseconds
  enableNotifications: boolean;
  notificationThreshold: {
    error: boolean;
    warning: boolean;
    info: boolean;
    success: boolean;
  };
  enablePerformanceMetrics: boolean;
  metricsRetentionPeriod: number; // milliseconds
  enableAlerts: boolean;
  alertCheckInterval: number; // milliseconds
  enableHistory: boolean;
  historyRetentionPeriod: number; // milliseconds
  maxHistoryEntries: number;
  enableReplay: boolean;
  replaySpeed: number; // 1x, 2x, etc.
}

/**
 * WebSocket events for progress tracking
 */
export enum ProgressTrackingEvent {
  PROGRESS_UPDATE = 'progress_update',
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',
  COMMAND_STALLED = 'command_stalled',
  COMMAND_RESUMED = 'command_resumed',
  PERFORMANCE_METRICS = 'performance_metrics',
  ALERT_TRIGGERED = 'alert_triggered',
  ALERT_RESOLVED = 'alert_resolved',
  NOTIFICATION_CREATED = 'notification_created'
}

/**
 * Type guards
 */
export const isProgressStep = (obj: any): obj is ProgressStep => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.order === 'number' &&
    typeof obj.progress === 'number';
};

export const isEnhancedProgress = (obj: any): obj is EnhancedProgress => {
  return obj &&
    typeof obj.commandId === 'string' &&
    typeof obj.overallProgress === 'number' &&
    Array.isArray(obj.steps);
};

export const isProgressNotification = (obj: any): obj is ProgressNotification => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.commandId === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.severity === 'string';
};

/**
 * Utility functions
 */
export const calculateEstimatedCompletion = (
  progress: number,
  startedAt: Date,
  currentTime: Date = new Date()
): Date | null => {
  if (progress <= 0 || progress >= 1) return null;
  
  const elapsedMs = currentTime.getTime() - startedAt.getTime();
  const estimatedTotalMs = elapsedMs / progress;
  const remainingMs = estimatedTotalMs - elapsedMs;
  
  return new Date(currentTime.getTime() + remainingMs);
};

export const getProgressStatus = (progress: EnhancedProgress): string => {
  if (progress.isStalled) return 'Stalled';
  if (progress.overallProgress >= 1) return 'Completed';
  if (progress.errorRate > 0.5) return 'Error';
  if (progress.overallProgress > 0) return 'In Progress';
  return 'Pending';
};

export const getSeverityColor = (severity: string): string => {
  const colors = {
    low: '#2196F3',
    medium: '#FF9800',
    high: '#F44336',
    critical: '#B71C1C'
  };
  return colors[severity as keyof typeof colors] || '#9E9E9E';
};