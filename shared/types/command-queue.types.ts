/**
 * TypeScript types for the command queue system
 */

/**
 * Command priority levels (higher value = higher priority)
 */
export enum CommandPriority {
  EMERGENCY = 3,
  HIGH = 2,
  NORMAL = 1,
  LOW = 0
}

/**
 * Command execution status
 */
export enum CommandStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
  TIMEOUT = 'timeout'
}

/**
 * Types of rover commands
 */
export enum CommandType {
  // Movement commands
  MOVE_FORWARD = 'move_forward',
  MOVE_BACKWARD = 'move_backward',
  TURN_LEFT = 'turn_left',
  TURN_RIGHT = 'turn_right',
  STOP = 'stop',
  EMERGENCY_STOP = 'emergency_stop',
  
  // Control commands
  SET_SPEED = 'set_speed',
  SET_POWER = 'set_power',
  RESET = 'reset',
  
  // Sensor commands
  READ_SENSOR = 'read_sensor',
  CALIBRATE_SENSOR = 'calibrate_sensor',
  
  // System commands
  SYSTEM_STATUS = 'system_status',
  DIAGNOSTIC = 'diagnostic',
  FIRMWARE_UPDATE = 'firmware_update',
  
  // Communication commands
  PING = 'ping',
  HEARTBEAT = 'heartbeat',
  
  // Custom commands
  CUSTOM = 'custom'
}

/**
 * Command metadata
 */
export interface CommandMetadata {
  source: string;
  sessionId?: string;
  userId?: string;
  correlationId?: string;
  tags: string[];
  customData: Record<string, any>;
}

/**
 * Command result
 */
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

/**
 * Command interface
 */
export interface Command {
  id: string;
  commandType: CommandType;
  priority: CommandPriority;
  parameters: Record<string, any>;
  metadata: CommandMetadata;
  timeoutMs: number;
  maxRetries: number;
  status: CommandStatus;
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  result?: CommandResult;
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  totalCommands: number;
  commandsByPriority: Record<CommandPriority, number>;
  commandsByStatus: Record<CommandStatus, number>;
  averageQueueTimeMs: number;
  averageExecutionTimeMs: number;
  peakQueueSize: number;
  commandsProcessedLastMinute: number;
  commandsFailedLastMinute: number;
  currentQueueSize: number;
}

/**
 * Command event types for WebSocket communication
 */
export enum CommandEventType {
  COMMAND_QUEUED = 'command_queued',
  COMMAND_STARTED = 'command_started',
  COMMAND_COMPLETED = 'command_completed',
  COMMAND_FAILED = 'command_failed',
  COMMAND_CANCELLED = 'command_cancelled',
  COMMAND_RETRYING = 'command_retrying',
  QUEUE_STATUS_UPDATE = 'queue_status_update',
  PROCESSOR_STATUS_UPDATE = 'processor_status_update'
}

/**
 * Command event payload
 */
export interface CommandEvent {
  eventType: CommandEventType;
  timestamp: string;
  command: {
    id: string;
    type: CommandType;
    priority: string;
    status: CommandStatus;
    createdAt: string;
    retryCount: number;
  };
  additionalData?: Record<string, any>;
}

/**
 * Queue status update
 */
export interface QueueStatusUpdate {
  eventType: CommandEventType.QUEUE_STATUS_UPDATE;
  timestamp: string;
  queueSizes: Record<string, number>;
  currentSize: number;
  processingRate: number;
}

/**
 * Command subscription filters
 */
export interface CommandSubscriptionFilters {
  priorities?: CommandPriority[];
  commandTypes?: CommandType[];
  statuses?: CommandStatus[];
}

/**
 * Command creation request
 */
export interface CommandCreateRequest {
  commandType: CommandType;
  parameters?: Record<string, any>;
  priority?: CommandPriority;
  metadata?: Partial<CommandMetadata>;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Processor status
 */
export enum ProcessorStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Processor status info
 */
export interface ProcessorStatusInfo {
  status: ProcessorStatus;
  activeCommands: number;
  activeByPriority: Record<string, number>;
  totalProcessed: number;
  totalFailed: number;
  uptimeSeconds: number;
}

/**
 * Command parameters for specific command types
 */
export namespace CommandParameters {
  export interface MoveForward {
    distance: number;  // meters
    speed: number;     // 0-1 fraction of max speed
  }
  
  export interface Turn {
    angle: number;     // degrees (-180 to 180)
    speed?: number;    // 0-1 fraction of max speed
  }
  
  export interface SetSpeed {
    speed: number;     // 0-1 fraction of max speed
    rampTime?: number; // seconds to ramp to speed
  }
  
  export interface ReadSensor {
    sensorType: 'battery_motor' | 'battery_logic' | 'temperature' | 
                'wheel_rpm' | 'position' | 'orientation' | 'hall_sensors';
  }
  
  export interface Diagnostic {
    level: 'basic' | 'full' | 'quick';
  }
  
  export interface EmergencyStop {
    reason?: string;
  }
}

/**
 * Type guards
 */
export const isCommandEvent = (event: any): event is CommandEvent => {
  return event && 
         typeof event.eventType === 'string' &&
         typeof event.timestamp === 'string' &&
         event.command &&
         typeof event.command.id === 'string';
};

export const isQueueStatusUpdate = (event: any): event is QueueStatusUpdate => {
  return event &&
         event.eventType === CommandEventType.QUEUE_STATUS_UPDATE &&
         typeof event.queueSizes === 'object';
};

/**
 * Acknowledgment status states
 */
export enum AcknowledgmentStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying'
}

/**
 * Command acknowledgment tracking
 */
export interface CommandAcknowledgment {
  commandId: string;
  trackingId: string;
  status: AcknowledgmentStatus;
  createdAt: string;
  acknowledgedAt?: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  progressMessage?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  acknowledgmentRetries: number;
  executionRetries: number;
  metadata: Record<string, any>;
}

/**
 * Progress update for acknowledgments
 */
export interface AcknowledgmentProgress {
  commandId: string;
  trackingId: string;
  progress: number;
  message?: string;
  status: AcknowledgmentStatus;
  timestamp: string;
}

/**
 * Acknowledgment configuration
 */
export interface AcknowledgmentConfig {
  acknowledgmentTimeout: number;
  executionTimeout: number;
  resultDeliveryTimeout: number;
  maxAcknowledgmentRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  maxBackoff: number;
  progressUpdateInterval: number;
  enableProgressTracking: boolean;
  cacheResults: boolean;
  resultCacheTTL: number;
  maxCachedResults: number;
}

/**
 * Utility functions
 */
export const getPriorityName = (priority: CommandPriority): string => {
  const names = {
    [CommandPriority.EMERGENCY]: 'Emergency',
    [CommandPriority.HIGH]: 'High',
    [CommandPriority.NORMAL]: 'Normal',
    [CommandPriority.LOW]: 'Low'
  };
  return names[priority] || 'Unknown';
};

export const getStatusColor = (status: CommandStatus): string => {
  const colors = {
    [CommandStatus.PENDING]: '#gray',
    [CommandStatus.QUEUED]: '#blue',
    [CommandStatus.EXECUTING]: '#yellow',
    [CommandStatus.COMPLETED]: '#green',
    [CommandStatus.FAILED]: '#red',
    [CommandStatus.CANCELLED]: '#orange',
    [CommandStatus.RETRYING]: '#purple',
    [CommandStatus.TIMEOUT]: '#darkred'
  };
  return colors[status] || '#gray';
};