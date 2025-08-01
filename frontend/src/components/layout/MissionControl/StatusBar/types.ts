/**
 * Status Bar Types and Interfaces
 * Comprehensive type definitions for mission control status bar system
 */

import { ReactNode } from 'react';
import { ConnectionState, ConnectionMetrics } from '../../../../services/websocket/types';

export type StatusLevel = 'normal' | 'warning' | 'error' | 'critical';
export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'offline';
export type MissionStatus = 'active' | 'paused' | 'complete' | 'error' | 'standby';
export type SignalStrength = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

export interface StatusWidget {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  component: ReactNode;
  updateInterval?: number; // ms
  critical?: boolean; // Always show even in compact mode
}

export interface SystemHealthData {
  cpu: {
    usage: number; // 0-100
    temperature?: number; // °C
    status: HealthStatus;
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    percentage: number; // 0-100
    status: HealthStatus;
  };
  network: {
    latency: number; // ms
    bandwidth: number; // bytes/s
    packetsLost: number;
    status: HealthStatus;
    signalStrength: SignalStrength;
  };
  disk?: {
    used: number; // bytes
    total: number; // bytes
    percentage: number; // 0-100
    status: HealthStatus;
  };
  overall: HealthStatus;
  lastUpdated: number; // timestamp
  uptime: number; // seconds
}

export interface ConnectionStatusData {
  state: ConnectionState;
  isConnected: boolean;
  signalStrength: SignalStrength;
  latency: number; // ms
  lastConnected?: number; // timestamp
  reconnectAttempts: number;
  metrics: ConnectionMetrics;
  error?: string;
}

export interface CommandQueueData {
  length: number;
  processing: boolean;
  processingCommand?: string;
  successCount: number;
  errorCount: number;
  lastProcessed?: number; // timestamp
  avgProcessingTime: number; // ms
  status: StatusLevel;
}

export interface MissionData {
  status: MissionStatus;
  name: string;
  startTime: number; // timestamp
  elapsedTime: number; // seconds
  estimatedDuration?: number; // seconds
  progress?: number; // 0-100
  waypoints?: {
    total: number;
    completed: number;
    current?: string;
  };
  emergencyLevel?: 'none' | 'advisory' | 'warning' | 'alert' | 'emergency';
}

export interface PowerStatusData {
  battery: {
    level: number; // 0-100
    voltage: number; // volts
    current: number; // amps
    temperature: number; // °C
    charging: boolean;
    timeRemaining?: number; // minutes
    status: HealthStatus;
  };
  solar?: {
    power: number; // watts
    efficiency: number; // 0-100
    status: HealthStatus;
  };
  overall: HealthStatus;
  powerConsumption: number; // watts
  estimatedRuntime?: number; // minutes
}

export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // ms, auto-dismiss time
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  source?: 'system' | 'mission' | 'hardware' | 'user';
}

export interface StatusBarData {
  systemHealth: SystemHealthData;
  connection: ConnectionStatusData;
  commandQueue: CommandQueueData;
  mission: MissionData;
  power: PowerStatusData;
  notifications: NotificationData[];
  timestamp: number;
}

export interface StatusBarConfiguration {
  widgets: StatusWidget[];
  position: 'top' | 'bottom';
  compact: boolean;
  autoHide: boolean;
  updateInterval: number; // ms
  showTimestamp: boolean;
  theme: 'auto' | 'light' | 'dark' | 'high-contrast' | 'mission-critical';
  emergencyMode: boolean;
  customization: {
    allowReordering: boolean;
    allowHiding: boolean;
    persistLayout: boolean;
  };
}

export interface StatusBarProps {
  data?: Partial<StatusBarData>;
  config?: Partial<StatusBarConfiguration>;
  onConfigChange?: (config: StatusBarConfiguration) => void;
  onNotificationAction?: (notificationId: string, actionIndex: number) => void;
  onStatusClick?: (widgetId: string) => void;
  onEmergencyToggle?: (enabled: boolean) => void;
  className?: string;
  'data-testid'?: string;
}

export interface StatusWidgetProps {
  data: any;
  config: StatusBarConfiguration;
  compact?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
}

export interface StatusUpdateEvent {
  type: 'system-health' | 'connection' | 'command-queue' | 'mission' | 'power' | 'notification';
  data: any;
  timestamp: number;
  critical?: boolean;
}

export interface StatusBarContextValue {
  data: StatusBarData;
  config: StatusBarConfiguration;
  updateData: (updates: Partial<StatusBarData>) => void;
  updateConfig: (updates: Partial<StatusBarConfiguration>) => void;
  addNotification: (notification: Omit<NotificationData, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (widgetIds: string[]) => void;
  resetToDefaults: () => void;
  exportConfig: () => string;
  importConfig: (config: string) => boolean;
  subscribe: (callback: (event: StatusUpdateEvent) => void) => () => void;
}

// Default configurations
export const DEFAULT_WIDGETS: StatusWidget[] = [
  {
    id: 'connection',
    name: 'Connection Status',
    order: 1,
    visible: true,
    component: null, // Will be set by component
    critical: true,
  },
  {
    id: 'system-health',
    name: 'System Health',
    order: 2,
    visible: true,
    component: null,
    updateInterval: 5000,
  },
  {
    id: 'mission',
    name: 'Mission Status',
    order: 3,
    visible: true,
    component: null,
    critical: true,
  },
  {
    id: 'command-queue',
    name: 'Command Queue',
    order: 4,
    visible: true,
    component: null,
    updateInterval: 1000,
  },
  {
    id: 'power',
    name: 'Power Status',
    order: 5,
    visible: true,
    component: null,
    updateInterval: 10000,
  },
  {
    id: 'time',
    name: 'Mission Timer',
    order: 6,
    visible: true,
    component: null,
    updateInterval: 1000,
    critical: true,
  },
  {
    id: 'notifications',
    name: 'Notifications',
    order: 7,
    visible: true,
    component: null,
    critical: true,
  },
];

export const DEFAULT_CONFIGURATION: StatusBarConfiguration = {
  widgets: DEFAULT_WIDGETS,
  position: 'top',
  compact: false,
  autoHide: false,
  updateInterval: 1000,
  showTimestamp: true,
  theme: 'auto',
  emergencyMode: false,
  customization: {
    allowReordering: true,
    allowHiding: true,
    persistLayout: true,
  },
};

// Utility type guards
export const isHealthy = (status: HealthStatus): boolean => status === 'healthy';
export const isCritical = (status: HealthStatus): boolean => status === 'critical' || status === 'offline';
export const isWarning = (status: HealthStatus): boolean => status === 'degraded';

export const getStatusLevel = (health: HealthStatus): StatusLevel => {
  switch (health) {
    case 'healthy':
      return 'normal';
    case 'degraded':
      return 'warning';
    case 'critical':
      return 'error';
    case 'offline':
      return 'critical';
    default:
      return 'normal';
  }
};

export const getSignalStrengthValue = (strength: SignalStrength): number => {
  switch (strength) {
    case 'excellent':
      return 5;
    case 'good':
      return 4;
    case 'fair':
      return 3;
    case 'poor':
      return 2;
    case 'none':
      return 1;
    default:
      return 0;
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatLatency = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};