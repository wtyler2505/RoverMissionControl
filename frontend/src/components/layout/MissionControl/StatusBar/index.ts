/**
 * Status Bar Module Exports
 * Centralized exports for the Mission Control Status Bar system
 */

export { StatusBar, StatusBarProvider, useStatusBar } from './StatusBar';
export { ConnectionStatus } from './widgets/ConnectionStatus';
export { SystemHealth } from './widgets/SystemHealth';
export { MissionStatus } from './widgets/MissionStatus';
export { CommandQueue } from './widgets/CommandQueue';
export { NotificationCenter } from './widgets/NotificationCenter';

export type {
  StatusBarProps,
  StatusBarData,
  StatusBarConfiguration,
  StatusBarContextValue,
  StatusWidget,
  StatusWidgetProps,
  SystemHealthData,
  ConnectionStatusData,
  CommandQueueData,
  MissionData,
  PowerStatusData,
  NotificationData,
  StatusUpdateEvent,
  StatusLevel,
  HealthStatus,
  MissionStatus as MissionStatusType,
  SignalStrength
} from './types';

export {
  DEFAULT_CONFIGURATION,
  DEFAULT_WIDGETS,
  isHealthy,
  isCritical,
  isWarning,
  getStatusLevel,
  getSignalStrengthValue,
  formatBytes,
  formatDuration,
  formatLatency
} from './types';

// Re-export commonly used WebSocket types for convenience
export type {
  ConnectionState,
  ConnectionMetrics,
  WebSocketClient
} from '../../../../services/websocket/types';