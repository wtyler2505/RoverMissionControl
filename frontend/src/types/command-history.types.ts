/**
 * TypeScript types for command history and auditing
 */

import { CommandType, CommandPriority, CommandStatus } from '../../../shared/types/command-queue.types';

/**
 * Command history record
 */
export interface CommandHistory {
  id: number;
  commandId: string;
  commandType: CommandType;
  priority: CommandPriority;
  finalStatus: CommandStatus;
  createdAt: Date;
  queuedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  totalExecutionTimeMs?: number;
  queueWaitTimeMs?: number;
  processingTimeMs?: number;
  retryCount: number;
  success: boolean;
  errorCode?: string;
  errorCategory?: string;
  userId?: string;
  sessionId?: string;
  sourceSystem?: string;
  parameterSummary?: Record<string, any>;
  resultSummary?: Record<string, any>;
  tags?: string[];
  dataClassification?: string;
  searchText?: string;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  auditId: string;
  commandId: string;
  eventType: string;
  eventTimestamp: Date;
  status: CommandStatus;
  userId?: string;
  sessionId?: string;
  sourceIp?: string;
  sourceSystem?: string;
  eventDetails?: string;
  executionTimeMs?: number;
  retryCount: number;
}

/**
 * Filter options for command history
 */
export interface CommandHistoryFilter {
  startTime?: Date;
  endTime?: Date;
  commandTypes?: CommandType[];
  priorities?: CommandPriority[];
  statuses?: CommandStatus[];
  userIds?: string[];
  sessionIds?: string[];
  minExecutionTimeMs?: number;
  maxExecutionTimeMs?: number;
  onlyErrors?: boolean;
  errorCodes?: string[];
  searchText?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Paginated response for command history
 */
export interface CommandHistoryResponse {
  items: CommandHistory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Audit log response
 */
export interface AuditLogResponse {
  commandId: string;
  auditTrail: AuditLogEntry[];
  totalEvents: number;
}

/**
 * Aggregated statistics
 */
export interface HistoryStatistics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  avgExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  minExecutionTimeMs: number;
  avgQueueTimeMs: number;
  totalRetries: number;
  commandTypeDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
}

/**
 * Time-series metrics
 */
export interface MetricsResponse {
  metricTimestamp: Date;
  metricInterval: TimeInterval;
  commandType?: CommandType;
  priority?: CommandPriority;
  status?: CommandStatus;
  commandCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  avgExecutionTimeMs?: number;
  minExecutionTimeMs?: number;
  maxExecutionTimeMs?: number;
  p95ExecutionTimeMs?: number;
  p99ExecutionTimeMs?: number;
  avgQueueTimeMs?: number;
  maxQueueTimeMs?: number;
}

/**
 * Export formats
 */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
  PDF = 'pdf'
}

/**
 * Export request
 */
export interface ExportRequest {
  format: ExportFormat;
  filters: CommandHistoryFilter;
  columns?: string[];
  includeAuditTrail?: boolean;
  compress?: boolean;
}

/**
 * Sort order
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Time intervals for metrics
 */
export enum TimeInterval {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  id: number;
  policyName: string;
  commandTypePattern?: string;
  priorityLevels?: CommandPriority[];
  dataClassification?: string;
  retentionDays: number;
  deleteParameters: boolean;
  deleteResults: boolean;
  anonymizeUserData: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  legalRequirement?: string;
  approvalReference?: string;
}

/**
 * User access log
 */
export interface UserAccessLog {
  accessId: string;
  userId: string;
  accessedAt: Date;
  accessType: 'view' | 'export' | 'delete' | 'modify';
  commandIds: string[];
  queryFilters: Record<string, any>;
  exportFormat?: ExportFormat;
  purpose?: string;
  recordsAccessed: number;
  accessGranted: boolean;
  denialReason?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  query: string;
  searchFields?: string[];
  useFuzzyMatching?: boolean;
  highlightResults?: boolean;
  maxResults?: number;
}

/**
 * Chart data point for visualization
 */
export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * History view preferences (for UI state)
 */
export interface HistoryViewPreferences {
  columns: string[];
  pageSize: number;
  sortBy: string;
  sortOrder: SortOrder;
  filters: CommandHistoryFilter;
  chartType: 'line' | 'bar' | 'pie';
  metricInterval: TimeInterval;
}

/**
 * Type guards
 */
export const isCommandHistory = (obj: any): obj is CommandHistory => {
  return obj && 
    typeof obj.commandId === 'string' &&
    typeof obj.commandType === 'string' &&
    typeof obj.priority === 'number' &&
    typeof obj.success === 'boolean';
};

export const isAuditLogEntry = (obj: any): obj is AuditLogEntry => {
  return obj &&
    typeof obj.auditId === 'string' &&
    typeof obj.commandId === 'string' &&
    typeof obj.eventType === 'string';
};