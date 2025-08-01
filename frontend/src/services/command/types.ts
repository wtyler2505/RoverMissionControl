/**
 * Command Types and Enums
 * Mirrors backend command types for consistency
 */

export enum CommandPriority {
  EMERGENCY = 3,
  HIGH = 2,
  NORMAL = 1,
  LOW = 0
}

export enum CommandStatus {
  PENDING = "pending",
  QUEUED = "queued",
  EXECUTING = "executing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RETRYING = "retrying",
  TIMEOUT = "timeout"
}

export enum CommandType {
  // Movement commands
  MOVE_FORWARD = "move_forward",
  MOVE_BACKWARD = "move_backward",
  TURN_LEFT = "turn_left",
  TURN_RIGHT = "turn_right",
  STOP = "stop",
  EMERGENCY_STOP = "emergency_stop",
  
  // Control commands
  SET_SPEED = "set_speed",
  SET_POWER = "set_power",
  RESET = "reset",
  
  // Sensor commands
  READ_SENSOR = "read_sensor",
  CALIBRATE_SENSOR = "calibrate_sensor",
  
  // System commands
  SYSTEM_STATUS = "system_status",
  DIAGNOSTIC = "diagnostic",
  FIRMWARE_UPDATE = "firmware_update",
  
  // Communication commands
  PING = "ping",
  HEARTBEAT = "heartbeat",
  
  // Custom commands
  CUSTOM = "custom"
}

export interface CommandMetadata {
  source: string;
  sessionId?: string;
  userId?: string;
  correlationId?: string;
  tags: string[];
  customData: Record<string, any>;
}

export interface CommandResult {
  success: boolean;
  commandId: string;
  status: CommandStatus;
  resultData?: Record<string, any>;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  executionTimeMs?: number;
  timestamp: string;
}

export interface Command {
  id: string;
  commandType: CommandType;
  priority: CommandPriority;
  parameters: Record<string, any>;
  metadata: CommandMetadata;
  timeoutMs: number;
  maxRetries: number;
  
  // Execution state
  status?: CommandStatus;
  createdAt?: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount?: number;
  result?: CommandResult;
}

// Parameter type definitions for each command
export interface MovementParameters {
  distance?: number; // meters
  angle?: number; // degrees
  duration?: number; // seconds
  speed?: number; // m/s
}

export interface SpeedParameters {
  speed: number; // m/s
  acceleration?: number; // m/s²
}

export interface PowerParameters {
  powerLevel: number; // percentage
  rampTime?: number; // seconds
}

export interface SensorParameters {
  sensorId: string;
  sensorType?: 'temperature' | 'distance' | 'camera' | 'imu' | 'gps';
  sampleRate?: number; // Hz
}

export interface CalibrationParameters {
  sensorId: string;
  calibrationType: 'zero' | 'span' | 'full';
  referenceValue?: number;
}

export interface DiagnosticParameters {
  subsystem?: 'motors' | 'sensors' | 'communication' | 'power' | 'all';
  verbose?: boolean;
  includeLogs?: boolean;
  logDuration?: number; // seconds
}

export interface FirmwareUpdateParameters {
  version: string;
  checksum: string;
  url?: string;
  force?: boolean;
}

export interface CustomCommandParameters {
  commandName: string;
  parameters: Record<string, any>;
}