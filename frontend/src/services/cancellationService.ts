/**
 * Command Cancellation Service
 * 
 * Provides client-side API for safe command cancellation with:
 * - Real-time cancellation status updates
 * - Confirmation dialogs for critical commands
 * - Rollback request handling
 * - Comprehensive error handling
 */

import axios from 'axios';
import { io, Socket } from 'socket.io-client';

// Types
export enum CancellationReason {
  USER_REQUEST = 'user_request',
  TIMEOUT = 'timeout',
  EMERGENCY_STOP = 'emergency_stop',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  DEPENDENCY_FAILED = 'dependency_failed',
  RESOURCE_UNAVAILABLE = 'resource_unavailable',
  SAFETY_VIOLATION = 'safety_violation'
}

export enum CancellationState {
  REQUESTED = 'requested',
  VALIDATING = 'validating',
  CANCELLING = 'cancelling',
  CLEANING_UP = 'cleaning_up',
  ROLLING_BACK = 'rolling_back',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

export interface CancellationRequest {
  commandId: string;
  reason: CancellationReason;
  force?: boolean;
  rollback?: boolean;
  confirmationToken?: string;
  notes?: string;
}

export interface CancellationConfirmation {
  commandId: string;
  confirmationText: string;
  expiresAt: number;
}

export interface CancellationResponse {
  success: boolean;
  commandId: string;
  state: CancellationState;
  message?: string;
  requiresConfirmation: boolean;
  confirmationRequest?: CancellationConfirmation;
  validationErrors: string[];
  cleanupActions: string[];
  rollbackActions: string[];
}

export interface CancellationStatus {
  commandId: string;
  state: CancellationState;
  reason: CancellationReason;
  requesterId: string;
  timestamp: Date;
  completedAt?: Date;
  validationErrors: string[];
  cleanupActions: string[];
  rollbackActions: string[];
  errorMessage?: string;
}

export interface CancellationStats {
  totalRequests: number;
  successfulCancellations: number;
  failedCancellations: number;
  rejectedCancellations: number;
  averageCancellationTimeMs: number;
  resourceCleanupFailures: number;
  rollbackFailures: number;
  activeCancellations: number;
}

export interface CancellationEvent {
  eventType: string;
  commandId: string;
  cancellationState: CancellationState;
  reason: CancellationReason;
  requester: string;
  validationErrors?: string[];
  cleanupActions?: string[];
  rollbackActions?: string[];
}

// Service configuration
interface CancellationServiceConfig {
  apiBaseUrl: string;
  wsUrl: string;
  authToken?: string;
  confirmationTimeout?: number;
  retryAttempts?: number;
}

export class CancellationService {
  private api: any;
  private socket?: Socket;
  private config: CancellationServiceConfig;
  private eventHandlers: Map<string, ((event: CancellationEvent) => void)[]> = new Map();
  private confirmationCallbacks: Map<string, (confirmed: boolean) => void> = new Map();

  constructor(config: CancellationServiceConfig) {
    this.config = {
      confirmationTimeout: 60000, // 1 minute default
      retryAttempts: 3,
      ...config
    };

    // Setup axios instance
    this.api = axios.create({
      baseURL: `${config.apiBaseUrl}/api/commands/cancel`,
      headers: {
        'Content-Type': 'application/json',
        ...(config.authToken && { Authorization: `Bearer ${config.authToken}` })
      }
    });

    // Setup WebSocket connection
    this.connectWebSocket();
  }

  private connectWebSocket() {
    this.socket = io(this.config.wsUrl, {
      auth: {
        token: this.config.authToken
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('Cancellation service connected to WebSocket');
    });

    this.socket.on('command_event', this.handleCommandEvent.bind(this));
    
    this.socket.on('disconnect', () => {
      console.warn('Cancellation service disconnected from WebSocket');
    });
  }

  private handleCommandEvent(event: any) {
    if (event.event_type?.startsWith('cancellation_')) {
      const cancellationEvent: CancellationEvent = {
        eventType: event.event_type,
        commandId: event.command_id,
        cancellationState: event.cancellation_state,
        reason: event.reason,
        requester: event.requester,
        validationErrors: event.validation_errors,
        cleanupActions: event.cleanup_actions,
        rollbackActions: event.rollback_actions
      };

      // Notify all handlers for this command
      const handlers = this.eventHandlers.get(event.command_id) || [];
      handlers.forEach(handler => handler(cancellationEvent));

      // Notify global handlers
      const globalHandlers = this.eventHandlers.get('*') || [];
      globalHandlers.forEach(handler => handler(cancellationEvent));
    }
  }

  /**
   * Cancel a command with optional confirmation
   */
  async cancelCommand(request: CancellationRequest): Promise<CancellationResponse> {
    try {
      const response = await this.api.post('/', {
        command_id: request.commandId,
        reason: request.reason,
        force: request.force || false,
        rollback: request.rollback !== false,
        confirmation_token: request.confirmationToken,
        notes: request.notes
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to cancel command:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Cancel a command with automatic confirmation handling
   */
  async cancelCommandWithConfirmation(
    request: CancellationRequest,
    onConfirmationRequired: (confirmation: CancellationConfirmation) => Promise<boolean>
  ): Promise<CancellationResponse> {
    let attempt = 0;
    
    while (attempt < (this.config.retryAttempts || 3)) {
      const response = await this.cancelCommand(request);

      if (response.requiresConfirmation && response.confirmationRequest) {
        // Handle confirmation
        const confirmed = await onConfirmationRequired(response.confirmationRequest);
        
        if (!confirmed) {
          return {
            ...response,
            success: false,
            message: 'Cancellation aborted by user'
          };
        }

        // Retry with confirmation token
        request.confirmationToken = response.confirmationRequest.confirmationText;
        attempt++;
        continue;
      }

      return response;
    }

    throw new Error('Maximum confirmation attempts exceeded');
  }

  /**
   * Cancel multiple commands
   */
  async cancelMultipleCommands(
    commandIds: string[],
    reason: CancellationReason = CancellationReason.USER_REQUEST,
    rollback: boolean = true
  ): Promise<CancellationResponse[]> {
    try {
      const response = await this.api.post('/batch', {
        command_ids: commandIds,
        reason,
        rollback
      });

      return response.data;
    } catch (error: any) {
      console.error('Failed to cancel multiple commands:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get active cancellations
   */
  async getActiveCancellations(): Promise<CancellationStatus[]> {
    try {
      const response = await this.api.get('/active');
      return response.data.map((item: any) => this.mapToCancellationStatus(item));
    } catch (error: any) {
      console.error('Failed to get active cancellations:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get cancellation history
   */
  async getCancellationHistory(
    commandId?: string,
    limit: number = 100
  ): Promise<CancellationStatus[]> {
    try {
      const params = new URLSearchParams();
      if (commandId) params.append('command_id', commandId);
      params.append('limit', limit.toString());

      const response = await this.api.get(`/history?${params}`);
      return response.data.map((item: any) => this.mapToCancellationStatus(item));
    } catch (error: any) {
      console.error('Failed to get cancellation history:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get cancellation status for a specific command
   */
  async getCancellationStatus(commandId: string): Promise<CancellationStatus | null> {
    try {
      const response = await this.api.get(`/${commandId}/status`);
      return response.data ? this.mapToCancellationStatus(response.data) : null;
    } catch (error: any) {
      console.error('Failed to get cancellation status:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get cancellation statistics
   */
  async getCancellationStats(): Promise<CancellationStats> {
    try {
      const response = await this.api.get('/stats');
      return response.data;
    } catch (error: any) {
      console.error('Failed to get cancellation stats:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Subscribe to cancellation events for a specific command
   */
  subscribeToCancellationEvents(
    commandId: string,
    handler: (event: CancellationEvent) => void
  ): () => void {
    const handlers = this.eventHandlers.get(commandId) || [];
    handlers.push(handler);
    this.eventHandlers.set(commandId, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.eventHandlers.get(commandId) || [];
      const index = currentHandlers.indexOf(handler);
      if (index !== -1) {
        currentHandlers.splice(index, 1);
        if (currentHandlers.length === 0) {
          this.eventHandlers.delete(commandId);
        } else {
          this.eventHandlers.set(commandId, currentHandlers);
        }
      }
    };
  }

  /**
   * Subscribe to all cancellation events
   */
  subscribeToAllCancellationEvents(
    handler: (event: CancellationEvent) => void
  ): () => void {
    return this.subscribeToCancellationEvents('*', handler);
  }

  /**
   * Show confirmation dialog (returns a promise)
   */
  async showConfirmationDialog(
    confirmation: CancellationConfirmation
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Store callback
      this.confirmationCallbacks.set(confirmation.commandId, resolve);

      // Set timeout
      setTimeout(() => {
        const callback = this.confirmationCallbacks.get(confirmation.commandId);
        if (callback) {
          callback(false); // Timeout = not confirmed
          this.confirmationCallbacks.delete(confirmation.commandId);
        }
      }, this.config.confirmationTimeout || 60000);
    });
  }

  /**
   * Confirm cancellation (called when user confirms)
   */
  confirmCancellation(commandId: string, confirmed: boolean) {
    const callback = this.confirmationCallbacks.get(commandId);
    if (callback) {
      callback(confirmed);
      this.confirmationCallbacks.delete(commandId);
    }
  }

  private mapToCancellationStatus(data: any): CancellationStatus {
    return {
      commandId: data.command_id,
      state: data.state as CancellationState,
      reason: data.reason as CancellationReason,
      requesterId: data.requester_id,
      timestamp: new Date(data.timestamp),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      validationErrors: data.validation_errors || [],
      cleanupActions: data.cleanup_actions || [],
      rollbackActions: data.rollback_actions || [],
      errorMessage: data.error_message
    };
  }

  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error
      const message = error.response.data?.detail || 
                     error.response.data?.message || 
                     'Command cancellation failed';
      return new Error(message);
    } else if (error.request) {
      // No response received
      return new Error('No response from server');
    } else {
      // Request setup error
      return new Error(error.message || 'Unknown error');
    }
  }

  /**
   * Cleanup resources
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.eventHandlers.clear();
    this.confirmationCallbacks.clear();
  }
}

// Export singleton instance
let cancellationService: CancellationService | null = null;

export function initializeCancellationService(config: CancellationServiceConfig): CancellationService {
  if (cancellationService) {
    cancellationService.disconnect();
  }
  cancellationService = new CancellationService(config);
  return cancellationService;
}

export function getCancellationService(): CancellationService {
  if (!cancellationService) {
    throw new Error('Cancellation service not initialized');
  }
  return cancellationService;
}