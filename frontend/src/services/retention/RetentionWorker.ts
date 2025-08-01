/**
 * Retention Worker
 * Web Worker for background data purging and retention management
 */

import { PersistedAlert } from '../persistence/AlertPersistenceService';
import { RetentionService } from './RetentionService';
import { RetentionPolicy } from './RetentionPolicy';

export interface RetentionWorkerMessage {
  type: 'INITIALIZE' | 'RUN_PURGE' | 'UPDATE_POLICY' | 'GET_STATS' | 'STOP' | 'PING';
  payload?: any;
}

export interface RetentionWorkerResponse {
  type: 'INITIALIZED' | 'PURGE_COMPLETE' | 'POLICY_UPDATED' | 'STATS' | 'ERROR' | 'PONG';
  payload?: any;
  error?: string;
}

export interface PurgeResult {
  deletedCount: number;
  alertsInGracePeriod: number;
  alertsOnLegalHold: number;
  processingTime: number;
  errors: Array<{ alertId: string; error: string }>;
  summary: {
    totalProcessed: number;
    successfulDeletions: number;
    skippedDeletions: number;
    failedDeletions: number;
  };
}

/**
 * Background Retention Worker for automated data purging
 */
export class BackgroundRetentionWorker {
  private worker?: Worker;
  private isRunning = false;
  private purgeInterval?: NodeJS.Timeout;
  private retentionService: RetentionService;
  private messageHandlers: Map<string, (response: RetentionWorkerResponse) => void> = new Map();

  constructor(retentionService: RetentionService) {
    this.retentionService = retentionService;
  }

  /**
   * Initialize the background worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      return; // Already initialized
    }

    try {
      // Create worker from inline script to avoid CORS issues
      const workerScript = this.generateWorkerScript();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.setupWorkerMessageHandling();

      // Initialize the worker
      await this.sendMessage({ type: 'INITIALIZE' });
      
      // Start automatic purging
      this.startAutomaticPurging();
      
      console.log('Background retention worker initialized');
    } catch (error) {
      console.error('Failed to initialize retention worker:', error);
      throw error;
    }
  }

  /**
   * Run immediate purge operation
   */
  async runPurge(alerts: PersistedAlert[]): Promise<PurgeResult> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const startTime = Date.now();
    
    try {
      const response = await this.sendMessage({
        type: 'RUN_PURGE',
        payload: { alerts }
      });

      const processingTime = Date.now() - startTime;
      
      return {
        ...response.payload,
        processingTime
      };
    } catch (error) {
      console.error('Failed to run purge operation:', error);
      throw error;
    }
  }

  /**
   * Get retention statistics
   */
  async getStats(alerts: PersistedAlert[]): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const response = await this.sendMessage({
      type: 'GET_STATS',
      payload: { alerts }
    });

    return response.payload;
  }

  /**
   * Update retention policy in worker
   */
  async updatePolicy(policyConfig: any): Promise<void> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    await this.sendMessage({
      type: 'UPDATE_POLICY',
      payload: { policyConfig }
    });
  }

  /**
   * Stop the background worker
   */
  async stop(): Promise<void> {
    this.stopAutomaticPurging();

    if (this.worker) {
      await this.sendMessage({ type: 'STOP' });
      this.worker.terminate();
      this.worker = undefined;
    }

    this.isRunning = false;
    console.log('Background retention worker stopped');
  }

  /**
   * Check if worker is healthy
   */
  async ping(): Promise<boolean> {
    if (!this.worker) {
      return false;
    }

    try {
      const response = await this.sendMessage({ type: 'PING' });
      return response.type === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Start automatic purging based on policy interval
   */
  private startAutomaticPurging(): void {
    if (this.purgeInterval) {
      return; // Already started
    }

    // Get purge interval from policy (default: 24 hours)
    const intervalMs = 24 * 60 * 60 * 1000; // 24 hours

    this.purgeInterval = setInterval(async () => {
      try {
        console.log('Running scheduled data purge...');
        
        // This would typically get alerts from the persistence service
        // For now, we'll emit an event that the main thread can listen to
        this.emitScheduledPurgeEvent();
        
      } catch (error) {
        console.error('Scheduled purge failed:', error);
      }
    }, intervalMs);

    this.isRunning = true;
    console.log(`Automatic purging started with ${intervalMs / (60 * 60 * 1000)}h interval`);
  }

  /**
   * Stop automatic purging
   */
  private stopAutomaticPurging(): void {
    if (this.purgeInterval) {
      clearInterval(this.purgeInterval);
      this.purgeInterval = undefined;
    }
    this.isRunning = false;
  }

  /**
   * Emit event for scheduled purge
   */
  private emitScheduledPurgeEvent(): void {
    const event = new CustomEvent('retention-scheduled-purge', {
      detail: { timestamp: new Date() }
    });
    window.dispatchEvent(event);
  }

  /**
   * Setup worker message handling
   */
  private setupWorkerMessageHandling(): void {
    if (!this.worker) return;

    this.worker.onmessage = (event: MessageEvent<RetentionWorkerResponse>) => {
      const response = event.data;
      
      if (response.type === 'ERROR') {
        console.error('Worker error:', response.error);
      }

      // Handle response for specific message
      const messageId = response.payload?.messageId;
      if (messageId && this.messageHandlers.has(messageId)) {
        const handler = this.messageHandlers.get(messageId)!;
        handler(response);
        this.messageHandlers.delete(messageId);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
    };
  }

  /**
   * Send message to worker and wait for response
   */
  private sendMessage(message: RetentionWorkerMessage): Promise<RetentionWorkerResponse> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const enhancedMessage = {
        ...message,
        payload: { ...message.payload, messageId }
      };

      // Set up response handler
      this.messageHandlers.set(messageId, (response) => {
        if (response.type === 'ERROR') {
          reject(new Error(response.error || 'Unknown worker error'));
        } else {
          resolve(response);
        }
      });

      // Send message
      this.worker.postMessage(enhancedMessage);

      // Set timeout for response
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error('Worker response timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Generate the worker script as a string
   */
  private generateWorkerScript(): string {
    return `
      // Retention Worker Implementation
      let retentionService = null;
      let retentionPolicy = null;
      let isInitialized = false;

      // Simple retention logic implementation for worker
      class WorkerRetentionService {
        constructor() {
          this.auditLogs = [];
        }

        shouldDelete(alert) {
          if (!alert.metadata?.retention) return false;
          
          const retentionData = alert.metadata.retention;
          if (retentionData.legalHold?.enabled) return false;

          const now = new Date();
          const expiresAt = new Date(retentionData.expiresAt);
          
          if (retentionData.gracePeriodEndsAt) {
            const gracePeriodEndsAt = new Date(retentionData.gracePeriodEndsAt);
            return now > gracePeriodEndsAt;
          }
          
          return now > expiresAt;
        }

        getAlertsForDeletion(alerts) {
          return alerts.filter(alert => this.shouldDelete(alert));
        }

        getAlertsInGracePeriod(alerts) {
          const now = new Date();
          return alerts.filter(alert => {
            const retentionData = alert.metadata?.retention;
            if (!retentionData) return false;
            
            const expiresAt = new Date(retentionData.expiresAt);
            const gracePeriodEndsAt = retentionData.gracePeriodEndsAt ? 
              new Date(retentionData.gracePeriodEndsAt) : null;
            
            return now > expiresAt && gracePeriodEndsAt && now <= gracePeriodEndsAt;
          });
        }

        getAlertsOnLegalHold(alerts) {
          return alerts.filter(alert => {
            const retentionData = alert.metadata?.retention;
            return retentionData?.legalHold?.enabled || false;
          });
        }

        calculateStats(alerts) {
          const now = new Date();
          const stats = {
            totalAlerts: alerts.length,
            activeAlerts: 0,
            expiredAlerts: 0,
            gracePeriodAlerts: 0,
            legalHoldAlerts: 0,
            pendingDeletion: 0
          };

          alerts.forEach(alert => {
            const retentionData = alert.metadata?.retention;
            if (!retentionData) {
              stats.activeAlerts++;
              return;
            }

            if (retentionData.legalHold?.enabled) {
              stats.legalHoldAlerts++;
              return;
            }

            const expiresAt = new Date(retentionData.expiresAt);
            if (now > expiresAt) {
              const gracePeriodEndsAt = retentionData.gracePeriodEndsAt ? 
                new Date(retentionData.gracePeriodEndsAt) : null;
              
              if (gracePeriodEndsAt && now <= gracePeriodEndsAt) {
                stats.gracePeriodAlerts++;
              } else {
                stats.pendingDeletion++;
              }
            } else {
              stats.activeAlerts++;
            }
          });

          return stats;
        }
      }

      // Message handler
      self.onmessage = function(event) {
        const message = event.data;
        const messageId = message.payload?.messageId;

        try {
          switch (message.type) {
            case 'INITIALIZE':
              retentionService = new WorkerRetentionService();
              isInitialized = true;
              self.postMessage({
                type: 'INITIALIZED',
                payload: { messageId, timestamp: new Date() }
              });
              break;

            case 'RUN_PURGE':
              if (!isInitialized) {
                throw new Error('Worker not initialized');
              }
              
              const alerts = message.payload.alerts;
              const startTime = Date.now();
              
              const alertsToDelete = retentionService.getAlertsForDeletion(alerts);
              const alertsInGracePeriod = retentionService.getAlertsInGracePeriod(alerts);
              const alertsOnLegalHold = retentionService.getAlertsOnLegalHold(alerts);
              
              const result = {
                messageId,
                deletedCount: alertsToDelete.length,
                alertsInGracePeriod: alertsInGracePeriod.length,
                alertsOnLegalHold: alertsOnLegalHold.length,
                processingTime: Date.now() - startTime,
                errors: [],
                summary: {
                  totalProcessed: alerts.length,
                  successfulDeletions: alertsToDelete.length,
                  skippedDeletions: alertsInGracePeriod.length + alertsOnLegalHold.length,
                  failedDeletions: 0
                },
                alertsToDelete: alertsToDelete.map(alert => alert.id)
              };

              self.postMessage({
                type: 'PURGE_COMPLETE',
                payload: result
              });
              break;

            case 'GET_STATS':
              if (!isInitialized) {
                throw new Error('Worker not initialized');
              }
              
              const statsAlerts = message.payload.alerts;
              const stats = retentionService.calculateStats(statsAlerts);
              
              self.postMessage({
                type: 'STATS',
                payload: { messageId, stats }
              });
              break;

            case 'UPDATE_POLICY':
              // Policy update logic would go here
              self.postMessage({
                type: 'POLICY_UPDATED',
                payload: { messageId }
              });
              break;

            case 'PING':
              self.postMessage({
                type: 'PONG',
                payload: { messageId, timestamp: new Date() }
              });
              break;

            case 'STOP':
              self.postMessage({
                type: 'STOPPED',
                payload: { messageId }
              });
              self.close();
              break;

            default:
              throw new Error(\`Unknown message type: \${message.type}\`);
          }
        } catch (error) {
          self.postMessage({
            type: 'ERROR',
            payload: { messageId },
            error: error.message
          });
        }
      };

      // Keep worker alive
      setInterval(() => {
        // Heartbeat to prevent worker from being garbage collected
      }, 30000);
    `;
  }

  /**
   * Get current worker status
   */
  getStatus(): {
    isInitialized: boolean;
    isRunning: boolean;
    hasWorker: boolean;
    lastPurge?: Date;
  } {
    return {
      isInitialized: !!this.worker,
      isRunning: this.isRunning,
      hasWorker: !!this.worker,
      lastPurge: undefined // This would be tracked in a real implementation
    };
  }
}

// Create a singleton instance that can be used across the application
let backgroundWorkerInstance: BackgroundRetentionWorker | null = null;

export function getBackgroundRetentionWorker(retentionService: RetentionService): BackgroundRetentionWorker {
  if (!backgroundWorkerInstance) {
    backgroundWorkerInstance = new BackgroundRetentionWorker(retentionService);
  }
  return backgroundWorkerInstance;
}

export function cleanupBackgroundWorker(): void {
  if (backgroundWorkerInstance) {
    backgroundWorkerInstance.stop();
    backgroundWorkerInstance = null;
  }
}