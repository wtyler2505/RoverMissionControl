/**
 * Type definitions for Batch Command System
 */

import { CommandType, CommandPriority } from '../../types/command.types';

export interface BatchDependency {
  fromCommandId: string;
  toCommandId: string;
  dependencyType: 'completion' | 'success' | 'data' | 'conditional';
  condition?: any;
}

export interface BatchCommand {
  id: string;
  type: CommandType;
  priority: CommandPriority;
  parameters: Record<string, any>;
  metadata: {
    name?: string;
    description?: string;
    tags?: string[];
  };
}

export interface BatchConfiguration {
  name: string;
  description: string;
  executionMode: 'sequential' | 'parallel' | 'mixed';
  transactionMode: 'all_or_nothing' | 'best_effort' | 'stop_on_error' | 'isolated';
  priority: CommandPriority;
  enableRollback: boolean;
  validateBeforeExecution: boolean;
  parallelLimit?: number;
  timeoutSeconds?: number;
  retryFailedCommands: boolean;
  tags: string[];
}

export interface BatchStatus {
  batchId: string;
  name: string;
  status: 'pending' | 'validating' | 'queued' | 'executing' | 'partially_completed' | 
          'completed' | 'failed' | 'cancelled' | 'rolling_back' | 'rolled_back';
  executionMode: 'sequential' | 'parallel' | 'mixed';
  transactionMode: 'all_or_nothing' | 'best_effort' | 'stop_on_error' | 'isolated';
  totalCommands: number;
  completedCommands: number;
  failedCommands: number;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
  currentCommand?: {
    id: string;
    type: string;
    status: string;
    progress: number;
  };
  commandResults: Record<string, any>;
  errorSummary: Array<{
    commandId: string;
    error: string;
    timestamp: string;
  }>;
  rollbackStatus?: string;
}

export interface CommandError {
  commandId: string;
  commandType: string;
  error: string;
  errorCode?: string;
  errorDetails?: any;
  timestamp: string;
  retryCount: number;
  canRetry: boolean;
  canRollback: boolean;
  suggestedFix?: string;
  stackTrace?: string;
}

export interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: 'retry' | 'skip' | 'rollback' | 'abort' | 'fix';
  requiresConfirmation: boolean;
  fixScript?: string;
}

export interface BatchTemplate {
  templateId: string;
  name: string;
  description?: string;
  version: string;
  commandTemplates: Array<{
    type: CommandType;
    priority: CommandPriority;
    parameterTemplate: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  dependencies: BatchDependency[];
  executionMode: 'sequential' | 'parallel' | 'mixed';
  transactionMode: 'all_or_nothing' | 'best_effort' | 'stop_on_error' | 'isolated';
  defaultPriority: CommandPriority;
  tags: string[];
  parameters?: Record<string, any>;
  requiredParameters?: string[];
}

export interface BatchExecutionProgress {
  batchId: string;
  status: BatchStatus['status'];
  totalCommands: number;
  completedCommands: number;
  failedCommands: number;
  currentCommandId?: string;
  currentCommandIndex?: number;
  progressPercentage: number;
  estimatedCompletionTime?: Date;
  elapsedTimeMs?: number;
}

export interface BatchStatistics {
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  activeBatches: number;
  pendingBatches: number;
  averageBatchSize: number;
  averageExecutionTimeMs: number;
  successRate: number;
  batchesLastHour: number;
  batchesLastDay: number;
  peakConcurrentBatches: number;
  totalCommandsExecuted: number;
  commandsSuccessRate: number;
}