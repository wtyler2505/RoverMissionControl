/**
 * Progress Dashboard Exports
 * 
 * Central export point for all progress tracking components and utilities
 */

// Main Dashboard
export { ProgressDashboard } from './ProgressDashboard';
export { DashboardSettings } from './DashboardSettings';

// Widgets
export { CommandOverview } from './widgets/CommandOverview';
export { PerformanceChart } from './widgets/PerformanceChart';
export { NotificationFeed } from './widgets/NotificationFeed';
export { AlertList } from './widgets/AlertList';
export { MetricsSummary } from './widgets/MetricsSummary';
export { CommandQueue } from './widgets/CommandQueue';
export { ResourceUsageMonitor } from './widgets/ResourceUsageMonitor';
export { ProgressTimeline } from './widgets/ProgressTimeline';

// Re-export types for convenience
export type {
  EnhancedProgress,
  ProgressStep,
  ProgressUpdateEvent,
  ProgressNotification,
  CommandPerformanceMetrics,
  PerformanceAnalytics,
  Alert,
  AlertRule,
  DashboardConfig,
  DashboardWidget,
  ProgressTrackingConfig
} from '../../types/progress-tracking.types';

// Re-export service
export { ProgressTrackingService } from '../../services/progress-tracking.service';