/**
 * Command Acknowledgment Service
 * 
 * Manages command acknowledgments and real-time status updates via WebSocket.
 * Provides observable patterns for UI components to track command execution.
 */

import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  Command,
  CommandStatus,
  CommandResult,
  CommandEventType,
  CommandEvent,
  AcknowledgmentStatus,
  CommandAcknowledgment,
  AcknowledgmentProgress
} from '../../../shared/types/command-queue.types';

export { AcknowledgmentStatus, CommandAcknowledgment, AcknowledgmentProgress };

export interface AcknowledgmentConfig {
  enableAutoReconnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  enableProgressTracking: boolean;
  progressUpdateThrottle: number;
  enableCaching: boolean;
  cacheSize: number;
  cacheTTL: number;
}

export class AcknowledgmentService {
  private socket: Socket | null = null;
  private config: AcknowledgmentConfig;
  
  // Observable subjects for real-time updates
  private acknowledgmentsSubject = new BehaviorSubject<Map<string, CommandAcknowledgment>>(new Map());
  private progressSubject = new Subject<AcknowledgmentProgress>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new Subject<Error>();
  
  // Caching
  private acknowledgmentCache = new Map<string, CommandAcknowledgment>();
  private resultCache = new Map<string, CommandResult>();
  private cacheTimestamps = new Map<string, number>();
  
  // Subscriptions
  private subscribedCommands = new Set<string>();
  private progressThrottleTimers = new Map<string, NodeJS.Timeout>();
  
  // Statistics
  private stats = {
    totalAcknowledged: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalTimeouts: 0,
    averageAcknowledgmentTime: 0,
    averageExecutionTime: 0
  };

  constructor(config?: Partial<AcknowledgmentConfig>) {
    this.config = {
      enableAutoReconnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      enableProgressTracking: true,
      progressUpdateThrottle: 500, // ms
      enableCaching: true,
      cacheSize: 100,
      cacheTTL: 3600000, // 1 hour
      ...config
    };
  }

  /**
   * Initialize the service and connect to WebSocket
   */
  async initialize(socketUrl?: string): Promise<void> {
    const url = socketUrl || process.env.REACT_APP_WEBSOCKET_URL || 'http://localhost:8000';
    
    this.socket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: this.config.enableAutoReconnect,
      reconnectionAttempts: this.config.reconnectAttempts,
      reconnectionDelay: this.config.reconnectDelay,
      auth: {
        token: localStorage.getItem('auth_token')
      }
    });

    this.setupSocketHandlers();
    
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.on('connect', () => {
        console.log('Acknowledgment service connected to WebSocket');
        this.connectionStatusSubject.next(true);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Acknowledgment service connection error:', error);
        this.connectionStatusSubject.next(false);
        reject(error);
      });

      // Set a timeout for initial connection
      setTimeout(() => {
        if (!this.connectionStatusSubject.value) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Clear throttle timers
    this.progressThrottleTimers.forEach(timer => clearTimeout(timer));
    this.progressThrottleTimers.clear();
    
    this.connectionStatusSubject.next(false);
  }

  /**
   * Track a command for acknowledgment updates
   */
  async trackCommand(commandId: string): Promise<CommandAcknowledgment | null> {
    if (!this.socket || !this.connectionStatusSubject.value) {
      throw new Error('Not connected to WebSocket');
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getCachedAcknowledgment(commandId);
      if (cached) {
        return cached;
      }
    }

    // Subscribe to updates for this command
    this.subscribedCommands.add(commandId);
    await this.subscribeToCommandUpdates([commandId]);

    // Request current status
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not available'));
        return;
      }

      this.socket.emit('get_acknowledgment_status', { command_id: commandId });

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout getting acknowledgment for command ${commandId}`));
      }, 5000);

      this.socket.once('acknowledgment_status', (data: CommandAcknowledgment) => {
        clearTimeout(timeout);
        this.updateAcknowledgment(data);
        resolve(data);
      });

      this.socket.once('acknowledgment_status_error', (error: { error: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.error));
      });
    });
  }

  /**
   * Stop tracking a command
   */
  untrackCommand(commandId: string): void {
    this.subscribedCommands.delete(commandId);
    
    // Clear from cache
    this.acknowledgmentCache.delete(commandId);
    this.resultCache.delete(commandId);
    this.cacheTimestamps.delete(commandId);
    
    // Clear progress throttle timer
    const timer = this.progressThrottleTimers.get(commandId);
    if (timer) {
      clearTimeout(timer);
      this.progressThrottleTimers.delete(commandId);
    }
    
    // Update subscriptions
    if (this.socket && this.subscribedCommands.size === 0) {
      this.socket.emit('unsubscribe_command_events', {});
    }
  }

  /**
   * Get acknowledgment observable for a specific command
   */
  getAcknowledgment$(commandId: string): Observable<CommandAcknowledgment | undefined> {
    return this.acknowledgmentsSubject.pipe(
      map(acknowledgments => acknowledgments.get(commandId)),
      filter(ack => ack !== undefined)
    );
  }

  /**
   * Get progress updates observable for a specific command
   */
  getProgress$(commandId: string): Observable<AcknowledgmentProgress> {
    return this.progressSubject.pipe(
      filter(progress => progress.commandId === commandId)
    );
  }

  /**
   * Get all acknowledgments observable
   */
  getAllAcknowledgments$(): Observable<Map<string, CommandAcknowledgment>> {
    return this.acknowledgmentsSubject.asObservable();
  }

  /**
   * Get connection status observable
   */
  getConnectionStatus$(): Observable<boolean> {
    return this.connectionStatusSubject.asObservable();
  }

  /**
   * Get error observable
   */
  getErrors$(): Observable<Error> {
    return this.errorSubject.asObservable();
  }

  /**
   * Get service statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.acknowledgmentCache.clear();
    this.resultCache.clear();
    this.cacheTimestamps.clear();
    this.acknowledgmentsSubject.next(new Map());
  }

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('disconnect', () => {
      console.log('Acknowledgment service disconnected');
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('reconnect', () => {
      console.log('Acknowledgment service reconnected');
      this.connectionStatusSubject.next(true);
      // Re-subscribe to tracked commands
      if (this.subscribedCommands.size > 0) {
        this.subscribeToCommandUpdates(Array.from(this.subscribedCommands));
      }
    });

    // Acknowledgment events
    this.socket.on('acknowledgment_update', (data: any) => {
      this.handleAcknowledgmentUpdate(data);
    });

    this.socket.on('command_progress', (data: AcknowledgmentProgress) => {
      this.handleProgressUpdate(data);
    });

    this.socket.on('command_event', (event: CommandEvent) => {
      this.handleCommandEvent(event);
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      console.error('Acknowledgment service error:', error);
      this.errorSubject.next(new Error(error.message || 'Unknown WebSocket error'));
    });
  }

  private async subscribeToCommandUpdates(commandIds: string[]): Promise<void> {
    if (!this.socket) return;

    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }

      this.socket.emit('subscribe_acknowledgment_updates', { command_ids: commandIds });

      this.socket.once('acknowledgment_subscription_confirmed', () => {
        resolve();
      });

      // Don't wait forever for confirmation
      setTimeout(resolve, 1000);
    });
  }

  private handleAcknowledgmentUpdate(data: any): void {
    const acknowledgment: CommandAcknowledgment = {
      commandId: data.command_id,
      trackingId: data.tracking_id,
      status: data.status,
      createdAt: data.created_at || new Date().toISOString(),
      acknowledgedAt: data.acknowledged_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      progress: data.progress || 0,
      progressMessage: data.message,
      errorMessage: data.error_message,
      acknowledgmentRetries: data.acknowledgment_retries || 0,
      executionRetries: data.execution_retries || 0,
      metadata: data.metadata || {},
      errorDetails: data.error_details
    };

    this.updateAcknowledgment(acknowledgment);
    this.updateStats(acknowledgment);
  }

  private handleProgressUpdate(progress: AcknowledgmentProgress): void {
    // Throttle progress updates if configured
    if (this.config.progressUpdateThrottle > 0) {
      const existingTimer = this.progressThrottleTimers.get(progress.commandId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.progressSubject.next(progress);
        this.progressThrottleTimers.delete(progress.commandId);
      }, this.config.progressUpdateThrottle);

      this.progressThrottleTimers.set(progress.commandId, timer);
    } else {
      this.progressSubject.next(progress);
    }

    // Update acknowledgment with progress
    const acknowledgment = this.acknowledgmentCache.get(progress.commandId);
    if (acknowledgment) {
      acknowledgment.progress = progress.progress;
      acknowledgment.progressMessage = progress.message;
      this.updateAcknowledgment(acknowledgment);
    }
  }

  private handleCommandEvent(event: CommandEvent): void {
    const commandId = event.command.id;
    
    // Map command events to acknowledgment updates
    switch (event.eventType) {
      case CommandEventType.COMMAND_QUEUED:
        this.handleAcknowledgmentUpdate({
          command_id: commandId,
          tracking_id: event.additionalData?.tracking_id,
          status: 'pending',
          timestamp: event.timestamp
        });
        break;
        
      case CommandEventType.COMMAND_STARTED:
        this.handleAcknowledgmentUpdate({
          command_id: commandId,
          tracking_id: event.additionalData?.tracking_id,
          status: 'acknowledged',
          acknowledged_at: event.timestamp,
          timestamp: event.timestamp
        });
        break;
        
      case CommandEventType.COMMAND_COMPLETED:
        this.handleAcknowledgmentUpdate({
          command_id: commandId,
          tracking_id: event.additionalData?.tracking_id,
          status: 'completed',
          completed_at: event.timestamp,
          progress: 1.0,
          timestamp: event.timestamp
        });
        break;
        
      case CommandEventType.COMMAND_FAILED:
        this.handleAcknowledgmentUpdate({
          command_id: commandId,
          tracking_id: event.additionalData?.tracking_id,
          status: 'failed',
          completed_at: event.timestamp,
          error_message: event.additionalData?.error_message,
          timestamp: event.timestamp
        });
        break;
        
      case CommandEventType.COMMAND_RETRYING:
        this.handleAcknowledgmentUpdate({
          command_id: commandId,
          tracking_id: event.additionalData?.tracking_id,
          status: 'retrying',
          execution_retries: event.command.retryCount,
          timestamp: event.timestamp
        });
        break;
    }
  }

  private updateAcknowledgment(acknowledgment: CommandAcknowledgment): void {
    // Update cache
    if (this.config.enableCaching) {
      this.acknowledgmentCache.set(acknowledgment.commandId, acknowledgment);
      this.cacheTimestamps.set(acknowledgment.commandId, Date.now());
      this.cleanupCache();
    }

    // Update observable
    const currentAcknowledgments = new Map(this.acknowledgmentsSubject.value);
    currentAcknowledgments.set(acknowledgment.commandId, acknowledgment);
    this.acknowledgmentsSubject.next(currentAcknowledgments);
  }

  private getCachedAcknowledgment(commandId: string): CommandAcknowledgment | null {
    const cached = this.acknowledgmentCache.get(commandId);
    if (!cached) return null;

    const timestamp = this.cacheTimestamps.get(commandId);
    if (!timestamp || Date.now() - timestamp > this.config.cacheTTL) {
      // Cache expired
      this.acknowledgmentCache.delete(commandId);
      this.cacheTimestamps.delete(commandId);
      return null;
    }

    return cached;
  }

  private cleanupCache(): void {
    if (this.acknowledgmentCache.size <= this.config.cacheSize) return;

    // Remove oldest entries
    const entries = Array.from(this.cacheTimestamps.entries())
      .sort((a, b) => a[1] - b[1]);

    const toRemove = entries.slice(0, entries.length - this.config.cacheSize);
    toRemove.forEach(([commandId]) => {
      this.acknowledgmentCache.delete(commandId);
      this.resultCache.delete(commandId);
      this.cacheTimestamps.delete(commandId);
    });
  }

  private updateStats(acknowledgment: CommandAcknowledgment): void {
    switch (acknowledgment.status) {
      case AcknowledgmentStatus.ACKNOWLEDGED:
        this.stats.totalAcknowledged++;
        if (acknowledgment.acknowledgedAt && acknowledgment.createdAt) {
          const ackTime = new Date(acknowledgment.acknowledgedAt).getTime() - 
                         new Date(acknowledgment.createdAt).getTime();
          this.updateAverageTime('acknowledgment', ackTime);
        }
        break;
        
      case AcknowledgmentStatus.COMPLETED:
        this.stats.totalCompleted++;
        if (acknowledgment.completedAt && acknowledgment.startedAt) {
          const execTime = new Date(acknowledgment.completedAt).getTime() - 
                          new Date(acknowledgment.startedAt).getTime();
          this.updateAverageTime('execution', execTime);
        }
        break;
        
      case AcknowledgmentStatus.FAILED:
        this.stats.totalFailed++;
        break;
        
      case AcknowledgmentStatus.TIMEOUT:
        this.stats.totalTimeouts++;
        break;
    }
  }

  private updateAverageTime(type: 'acknowledgment' | 'execution', timeMs: number): void {
    if (type === 'acknowledgment') {
      const total = this.stats.totalAcknowledged;
      this.stats.averageAcknowledgmentTime = 
        (this.stats.averageAcknowledgmentTime * (total - 1) + timeMs) / total;
    } else {
      const total = this.stats.totalCompleted;
      this.stats.averageExecutionTime = 
        (this.stats.averageExecutionTime * (total - 1) + timeMs) / total;
    }
  }
}

// Singleton instance
let acknowledgmentServiceInstance: AcknowledgmentService | null = null;

export const getAcknowledgmentService = (config?: Partial<AcknowledgmentConfig>): AcknowledgmentService => {
  if (!acknowledgmentServiceInstance) {
    acknowledgmentServiceInstance = new AcknowledgmentService(config);
  }
  return acknowledgmentServiceInstance;
};