export enum RotationFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually',
  CUSTOM = 'custom'
}

export enum RotationStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum NotificationChannel {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  SMS = 'sms',
  IN_APP = 'in_app'
}

export interface RotationPolicy {
  id: string;
  name: string;
  description?: string;
  frequency: RotationFrequency;
  customIntervalDays?: number;
  rotationHourUtc: number;
  rotationDayOfWeek?: number;
  rotationDayOfMonth?: number;
  gracePeriodHours: number;
  overlapPeriodHours: number;
  notifyDaysBefore: number[];
  notificationChannels: string[];
  notificationRecipients?: string[];
  autoUpdateEnabled: boolean;
  autoUpdateConfig?: Record<string, any>;
  requireApproval: boolean;
  approverRoles: string[];
  appliesToAllKeys: boolean;
  apiKeyTags?: string[];
  excludedApiKeys?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface RotationJob {
  id: string;
  policyId: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  status: RotationStatus;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  targetApiKeys: string[];
  rotatedKeys: Array<{
    oldKeyId: string;
    newKeyId: string;
    rotationId: string;
  }>;
  failedKeys: Array<{
    keyId: string;
    error: string;
  }>;
  executionLog: Array<{
    timestamp: string;
    action: string;
    details: Record<string, any>;
  }>;
  notificationsSent: Record<string, any>;
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface RotationHistory {
  rotationId: string;
  apiKey: {
    id: string;
    name: string;
    hint: string;
  };
  initiatedAt: string;
  completedAt?: string;
  initiatedBy: string;
  oldKeyHint: string;
  newKeyId?: string;
  status: string;
  gracePeriodEnd?: string;
}

export interface UpcomingRotation {
  jobId: string;
  scheduledAt: string;
  policyName: string;
  policyFrequency: RotationFrequency;
  affectedKeys: Array<{
    id: string;
    name: string;
    hint: string;
  }>;
  requiresApproval: boolean;
  approved: boolean;
}

export interface RotationMetrics {
  periodStart: string;
  periodEnd: string;
  totalRotationsScheduled: number;
  totalRotationsCompleted: number;
  totalRotationsFailed: number;
  averageRotationTimeSeconds?: number;
  maxRotationTimeSeconds?: number;
  minRotationTimeSeconds?: number;
  rotationsWithinPolicy: number;
  rotationsOverdue: number;
  averageDaysBetweenRotations?: number;
  notificationsSent: number;
  notificationsDelivered: number;
  notificationsFailed: number;
  autoUpdatesAttempted: number;
  autoUpdatesSuccessful: number;
  autoUpdatesFailed: number;
  calculatedAt: string;
}

export interface RotationNotification {
  id: string;
  jobId: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  message: string;
  metadata?: Record<string, any>;
  sentAt: string;
  delivered: boolean;
  readAt?: string;
  errorMessage?: string;
  responseCode?: number;
  responseBody?: string;
}

export interface AutoUpdateConnector {
  id: string;
  name: string;
  description?: string;
  connectorType: string;
  connectionConfig: Record<string, any>;
  updateStrategy: string;
  rollbackEnabled: boolean;
  testEndpoint?: string;
  lastTestAt?: string;
  lastTestSuccess?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}