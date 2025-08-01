/**
 * Emergency Stop Recovery Types
 * 
 * Type definitions for the emergency stop recovery system following
 * IEC 61508 functional safety standards and fail-safe design principles.
 */

export enum RecoveryStepType {
  INITIAL_ASSESSMENT = 'initial_assessment',
  HARDWARE_CHECK = 'hardware_check',
  SOFTWARE_VALIDATION = 'software_validation',
  SYSTEM_INTEGRITY = 'system_integrity',
  OPERATOR_CONFIRMATION = 'operator_confirmation',
  FINAL_VERIFICATION = 'final_verification',
  ROLLBACK = 'rollback'
}

export enum RecoveryStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  BLOCKED = 'blocked'
}

export enum RecoveryResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  ABORTED = 'aborted',
  ROLLBACK_REQUIRED = 'rollback_required'
}

export enum EmergencyStopCause {
  MANUAL_ACTIVATION = 'manual_activation',
  HARDWARE_FAULT = 'hardware_fault',
  SOFTWARE_ERROR = 'software_error',
  COMMUNICATION_LOSS = 'communication_loss',
  SAFETY_VIOLATION = 'safety_violation',
  EXTERNAL_TRIGGER = 'external_trigger',
  WATCHDOG_TIMEOUT = 'watchdog_timeout',
  UNKNOWN = 'unknown'
}

export enum SystemComponent {
  MOTORS = 'motors',
  SENSORS = 'sensors',
  ACTUATORS = 'actuators',
  COMMUNICATIONS = 'communications',
  POWER_SYSTEM = 'power_system',
  NAVIGATION = 'navigation',
  TELEMETRY = 'telemetry',
  SAFETY_SYSTEMS = 'safety_systems',
  EMERGENCY_HARDWARE = 'emergency_hardware'
}

export enum ComponentStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
  UNKNOWN = 'unknown',
  OFFLINE = 'offline'
}

export interface ComponentCheck {
  component: SystemComponent;
  status: ComponentStatus;
  description: string;
  checkTime: Date;
  diagnostics?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  recommendations?: string[];
}

export interface RecoveryStep {
  id: string;
  type: RecoveryStepType;
  title: string;
  description: string;
  instructions: string[];
  status: RecoveryStepStatus;
  required: boolean;
  canSkip: boolean;
  canRollback: boolean;
  estimatedDurationMs: number;
  actualDurationMs?: number;
  startTime?: Date;
  endTime?: Date;
  result?: RecoveryResult;
  errorMessage?: string;
  operatorId?: string;
  dependencies?: string[];
  preconditions?: string[];
  postconditions?: string[];
  componentChecks?: ComponentCheck[];
  verificationTests?: VerificationTest[];
  rollbackSteps?: string[];
}

export interface VerificationTest {
  id: string;
  name: string;
  description: string;
  component: SystemComponent;
  testType: 'functional' | 'safety' | 'communication' | 'diagnostic';
  required: boolean;
  status: 'pending' | 'running' | 'passed' | 'failed';
  result?: {
    passed: boolean;
    value?: any;
    expectedValue?: any;
    tolerance?: number;
    message?: string;
    timestamp: Date;
  };
  automatedTest: boolean;
  testFunction?: string;
  timeout?: number;
}

export interface RecoverySession {
  id: string;
  startTime: Date;
  endTime?: Date;
  operatorId: string;
  operatorName: string;
  emergencyStopCause: EmergencyStopCause;
  emergencyStopTime: Date;
  emergencyStopReason: string;
  steps: RecoveryStep[];
  currentStepId?: string;
  status: RecoverySessionStatus;
  result?: RecoveryResult;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  estimatedTotalTime: number;
  actualTotalTime?: number;
  canResume: boolean;
  requiresRollback: boolean;
  rollbackReason?: string;
  metadata: Record<string, any>;
  auditLog: AuditLogEntry[];
}

export enum RecoverySessionStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABORTED = 'aborted',
  SUSPENDED = 'suspended',
  ROLLBACK_IN_PROGRESS = 'rollback_in_progress',
  ROLLBACK_COMPLETED = 'rollback_completed'
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operatorId: string;
  operatorName: string;
  action: string;
  stepId?: string;
  component?: SystemComponent;
  details: Record<string, any>;
  result: 'success' | 'failure' | 'warning';
  message: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecoveryConfiguration {
  maxRecoveryTimeMs: number;
  requireTwoPersonConfirmation: boolean;
  allowSkipNonCriticalSteps: boolean;
  automaticRollbackOnFailure: boolean;
  requireHardwareVerification: boolean;
  requireSoftwareVerification: boolean;
  enableAuditLogging: boolean;
  suspendOnCommunicationLoss: boolean;
  maxRetryAttempts: number;
  stepTimeoutMs: number;
  verificationTimeoutMs: number;
  rolesToAllowRecovery: string[];
  criticalComponents: SystemComponent[];
  emergencyContacts: string[];
}

export interface RecoveryWizardProps {
  session: RecoverySession;
  configuration: RecoveryConfiguration;
  onStepComplete: (stepId: string, result: RecoveryResult, data?: any) => Promise<void>;
  onStepFailed: (stepId: string, error: string) => Promise<void>;
  onStepSkipped: (stepId: string, reason: string) => Promise<void>;
  onSessionComplete: (session: RecoverySession) => Promise<void>;
  onSessionAborted: (reason: string) => Promise<void>;
  onRollbackRequested: (stepId: string, reason: string) => Promise<void>;
  onAuditEvent: (entry: AuditLogEntry) => Promise<void>;
}

export interface RecoveryTestResult {
  testId: string;
  component: SystemComponent;
  passed: boolean;
  value?: any;
  expectedValue?: any;
  message: string;
  timestamp: Date;
  duration: number;
  retryCount: number;
}

export interface RecoveryMetrics {
  totalRecoverySessions: number;
  averageRecoveryTime: number;
  successRate: number;
  mostCommonFailurePoint: string;
  componentFailureRates: Record<SystemComponent, number>;
  operatorPerformance: Record<string, {
    sessionsCompleted: number;
    averageTime: number;
    successRate: number;
  }>;
  timeToRecoveryByDay: Record<string, number>;
  emergencyStopCauses: Record<EmergencyStopCause, number>;
}

export interface RecoveryTemplate {
  id: string;
  name: string;
  description: string;
  applicableCauses: EmergencyStopCause[];
  steps: Omit<RecoveryStep, 'id' | 'status' | 'startTime' | 'endTime' | 'result'>[];
  estimatedTotalTime: number;
  requiredRoles: string[];
  criticalSteps: string[];
  allowCustomization: boolean;
  version: string;
  lastUpdated: Date;
  createdBy: string;
}

// Recovery step factory functions
export interface RecoveryStepFactory {
  createInitialAssessment(cause: EmergencyStopCause): RecoveryStep[];
  createHardwareChecks(components: SystemComponent[]): RecoveryStep[];
  createSoftwareValidation(subsystems: string[]): RecoveryStep[];
  createSystemIntegrityChecks(): RecoveryStep[];
  createFinalVerification(): RecoveryStep[];
  createRollbackProcedure(failedStep: RecoveryStep): RecoveryStep[];
}

// Error types for recovery system
export class RecoveryError extends Error {
  constructor(
    message: string,
    public stepId?: string,
    public component?: SystemComponent,
    public code?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'RecoveryError';
  }
}

export class SafetyViolationError extends RecoveryError {
  constructor(message: string, component: SystemComponent, safetyCheck: string) {
    super(message, undefined, component, 'SAFETY_VIOLATION', false);
    this.name = 'SafetyViolationError';
  }
}

export class ComponentFailureError extends RecoveryError {
  constructor(
    message: string,
    component: SystemComponent,
    diagnostics?: Record<string, any>
  ) {
    super(message, undefined, component, 'COMPONENT_FAILURE', true);
    this.name = 'ComponentFailureError';
  }
}

// Recovery context for state management
export interface RecoveryContext {
  session: RecoverySession | null;
  currentStep: RecoveryStep | null;
  configuration: RecoveryConfiguration;
  isActive: boolean;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canAbort: boolean;
  canRollback: boolean;
  systemStatus: Record<SystemComponent, ComponentStatus>;
  emergencyStopStatus: {
    isActive: boolean;
    cause: EmergencyStopCause;
    triggerTime: Date;
    canClear: boolean;
  };
}