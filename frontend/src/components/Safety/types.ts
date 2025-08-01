/**
 * Type definitions for safety-critical components
 * 
 * @module Safety/types
 */

export interface EmergencyStopState {
  /** Whether the emergency stop is currently active */
  isActive: boolean;
  /** Timestamp when emergency stop was activated */
  activatedAt?: Date;
  /** User who activated the emergency stop */
  activatedBy?: string;
  /** Reason for activation (optional) */
  reason?: string;
  /** Systems affected by the emergency stop */
  affectedSystems?: string[];
}

export interface SafetyEvent {
  /** Unique identifier for the event */
  id: string;
  /** Type of safety event */
  type: 'emergency_stop' | 'safety_warning' | 'system_fault' | 'recovery';
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Timestamp of the event */
  timestamp: Date;
  /** Human-readable message */
  message: string;
  /** Additional context data */
  data?: Record<string, any>;
  /** User who triggered or acknowledged the event */
  user?: string;
}

export interface SafetySystemStatus {
  /** Overall system safety state */
  overallState: 'safe' | 'warning' | 'emergency' | 'fault';
  /** Emergency stop state */
  emergencyStop: EmergencyStopState;
  /** Active safety warnings */
  activeWarnings: SafetyEvent[];
  /** Recent safety events */
  recentEvents: SafetyEvent[];
  /** System readiness checks */
  systemChecks: {
    communications: boolean;
    power: boolean;
    motors: boolean;
    sensors: boolean;
    navigation: boolean;
  };
}

export interface SafetyConfiguration {
  /** Enable audio alerts for safety events */
  enableAudioAlerts: boolean;
  /** Enable vibration feedback on mobile */
  enableVibration: boolean;
  /** Require double confirmation for critical actions */
  requireDoubleConfirmation: boolean;
  /** Auto-recovery timeout in seconds (0 = disabled) */
  autoRecoveryTimeout: number;
  /** Safety check interval in milliseconds */
  safetyCheckInterval: number;
  /** Maximum number of retry attempts for safety operations */
  maxRetryAttempts: number;
}

export type SafetyEventHandler = (event: SafetyEvent) => void | Promise<void>;

export interface SafetyContextValue {
  /** Current safety system status */
  status: SafetySystemStatus;
  /** Safety configuration */
  config: SafetyConfiguration;
  /** Activate emergency stop */
  activateEmergencyStop: (reason?: string) => Promise<void>;
  /** Deactivate emergency stop */
  deactivateEmergencyStop: () => Promise<void>;
  /** Report a safety event */
  reportSafetyEvent: (event: Omit<SafetyEvent, 'id' | 'timestamp'>) => void;
  /** Clear a safety warning */
  clearWarning: (warningId: string) => void;
  /** Subscribe to safety events */
  subscribe: (handler: SafetyEventHandler) => () => void;
  /** Update safety configuration */
  updateConfig: (config: Partial<SafetyConfiguration>) => void;
}