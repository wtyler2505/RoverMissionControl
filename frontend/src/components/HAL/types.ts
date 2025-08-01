export interface HALDevice {
  id: string;
  name: string;
  type: 'sensor' | 'actuator' | 'controller' | 'communication' | 'power' | 'other';
  protocol: 'serial' | 'i2c' | 'spi' | 'can' | 'ethernet' | 'usb' | 'bluetooth' | 'wifi';
  status: 'connected' | 'disconnected' | 'error' | 'updating' | 'simulated';
  address?: string;
  port?: string | number;
  firmwareVersion?: string;
  lastSeen: Date;
  capabilities: DeviceCapability[];
  metadata: Record<string, any>;
  health: DeviceHealth;
  isSimulated?: boolean;
}

export interface DeviceCapability {
  id: string;
  name: string;
  type: 'read' | 'write' | 'readwrite' | 'command' | 'stream';
  dataType: 'boolean' | 'number' | 'string' | 'binary' | 'json';
  unit?: string;
  range?: {
    min?: number;
    max?: number;
    step?: number;
  };
  description?: string;
}

export interface DeviceHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  metrics: HealthMetric[];
  lastDiagnostic?: Date;
  issues: HealthIssue[];
}

export interface HealthMetric {
  name: string;
  value: number | string;
  unit?: string;
  status: 'normal' | 'warning' | 'critical';
  threshold?: {
    warning?: number;
    critical?: number;
  };
}

export interface HealthIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  recommendation?: string;
}

export interface HALActivity {
  id: string;
  timestamp: Date;
  type: 'device_connected' | 'device_disconnected' | 'firmware_update' | 'diagnostic_run' | 'error' | 'warning' | 'info' | 'command_sent' | 'data_received';
  deviceId?: string;
  deviceName?: string;
  message: string;
  details?: any;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export interface HALSettings {
  autoDiscovery: boolean;
  discoveryInterval: number; // seconds
  connectionTimeout: number; // milliseconds
  retryAttempts: number;
  logLevel: 'trace' | 'debug' | 'info' | 'warning' | 'error';
  enableSimulation: boolean;
  defaultProtocol: string;
  notifications: {
    deviceConnection: boolean;
    firmwareUpdates: boolean;
    errors: boolean;
    diagnostics: boolean;
  };
  export: {
    format: 'json' | 'csv' | 'excel';
    includeRawData: boolean;
    compression: boolean;
  };
}

export interface HALStatistics {
  totalDevices: number;
  connectedDevices: number;
  protocolBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  healthSummary: {
    healthy: number;
    warning: number;
    critical: number;
    unknown: number;
  };
  activitySummary: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  performance: {
    averageLatency: number;
    packetLoss: number;
    throughput: number;
    uptime: number;
  };
}

export interface HALFilter {
  protocols?: string[];
  types?: string[];
  statuses?: string[];
  health?: string[];
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface HALExportOptions {
  format: 'json' | 'csv' | 'excel' | 'pdf';
  includeDevices: boolean;
  includeActivities: boolean;
  includeDiagnostics: boolean;
  includeConfiguration: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: HALFilter;
}

export interface HALPermissions {
  canViewDevices: boolean;
  canManageDevices: boolean;
  canRunDiagnostics: boolean;
  canUpdateFirmware: boolean;
  canViewLogs: boolean;
  canExportData: boolean;
  canManageSimulation: boolean;
  canChangeSettings: boolean;
}

export interface HALNotification {
  id: string;
  timestamp: Date;
  type: 'device' | 'firmware' | 'diagnostic' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  deviceId?: string;
  actionRequired?: boolean;
  actions?: NotificationAction[];
  read: boolean;
}

export interface NotificationAction {
  label: string;
  action: string;
  primary?: boolean;
}

export interface SimulationProfile {
  id: string;
  name: string;
  description: string;
  devices: SimulatedDevice[];
  scenarios: SimulationScenario[];
  networkConditions?: NetworkCondition;
  environmentConditions?: EnvironmentCondition;
}

export interface SimulatedDevice {
  id: string;
  baseDeviceId: string;
  overrides: Partial<HALDevice>;
  behaviorProfile: string;
  errorRate?: number;
  latency?: number;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  duration: number; // seconds
  events: SimulationEvent[];
}

export interface SimulationEvent {
  timestamp: number; // seconds from start
  type: string;
  deviceId: string;
  action: string;
  parameters?: any;
}

export interface NetworkCondition {
  latency: number;
  jitter: number;
  packetLoss: number;
  bandwidth: number;
}

export interface EnvironmentCondition {
  temperature: number;
  humidity: number;
  pressure: number;
  vibration: number;
}

export interface FirmwareInfo {
  version: string;
  releaseDate: Date;
  size: number;
  checksum: string;
  releaseNotes?: string;
  compatibility: string[];
  critical?: boolean;
}

export interface DiagnosticResult {
  id: string;
  deviceId: string;
  timestamp: Date;
  duration: number; // milliseconds
  tests: DiagnosticTest[];
  overallStatus: 'passed' | 'warning' | 'failed';
  recommendations: string[];
}

export interface DiagnosticTest {
  name: string;
  status: 'passed' | 'warning' | 'failed' | 'skipped';
  duration: number;
  details?: string;
  metrics?: Record<string, any>;
}

export interface CommunicationLog {
  id: string;
  timestamp: Date;
  deviceId: string;
  protocol: string;
  direction: 'sent' | 'received';
  type: 'command' | 'data' | 'acknowledgment' | 'error';
  payload: any;
  size: number;
  latency?: number;
  success: boolean;
  error?: string;
}