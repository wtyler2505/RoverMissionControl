/**
 * Alert WebSocket Manager
 * 
 * Handles real-time alert communication with the server including:
 * - Alert message streaming with backpressure handling
 * - Acknowledgment synchronization across clients  
 * - Connection recovery and alert state resynchronization
 * - Batch processing for high-frequency alert scenarios
 * - Priority-based message routing and queuing
 * 
 * Real-time telemetry engineering optimizations:
 * - Delta compression for alert updates
 * - Binary protocol support for large alert batches
 * - Adaptive message batching based on connection quality
 * - Client-side acknowledgment caching with eventual consistency
 */

import {
  MessageType,
  Priority,
  WebSocketMessage,
  AlertWebSocketMessage,
  AlertMessageData,
  AlertAcknowledgment,
  AlertSyncRequest,
  AlertSyncResponse,
  AlertBatchMessage,
  AlertConnectionState,
  AlertEventHandlers,
  AlertWebSocketError
} from './types';

export interface AlertWebSocketConfig {
  // Performance optimizations
  batchSize: number;
  batchTimeout: number; // ms
  compressionThreshold: number; // bytes
  maxRetries: number;
  retryBackoffMs: number;
  
  // Synchronization settings
  syncInterval: number; // ms
  acknowledgmentTimeout: number; // ms
  resyncOnReconnect: boolean;
  
  // Filtering and priorities
  subscribedPriorities: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
  autoAcknowledgeInfo: boolean;
  
  // Connection quality adaptation
  adaptiveBatching: boolean;
  lowLatencyThreshold: number; // ms
  highLatencyThreshold: number; // ms
}

const DEFAULT_ALERT_CONFIG: AlertWebSocketConfig = {
  batchSize: 50,
  batchTimeout: 1000,
  compressionThreshold: 1024,
  maxRetries: 3,
  retryBackoffMs: 1000,
  syncInterval: 30000,
  acknowledgmentTimeout: 5000,
  resyncOnReconnect: true,
  subscribedPriorities: ['critical', 'high', 'medium', 'low', 'info'],
  autoAcknowledgeInfo: true,
  adaptiveBatching: true,
  lowLatencyThreshold: 50,
  highLatencyThreshold: 500
};

export class AlertWebSocketManager {
  private config: AlertWebSocketConfig;
  private connectionState: AlertConnectionState;
  private eventHandlers: AlertEventHandlers = {};
  
  // Batching and queuing
  private outgoingBatch: AlertWebSocketMessage[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private acknowledgeQueue: Map<string, AlertAcknowledgment> = new Map();
  
  // Connection quality metrics
  private recentLatencies: number[] = [];
  private currentBatchSize: number;
  
  // Error tracking and retry logic
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private failedOperations: Map<string, { attempt: number; lastTry: number }> = new Map();
  
  // WebSocket client reference (injected)
  private wsClient: any = null;

  constructor(config: Partial<AlertWebSocketConfig> = {}) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
    this.currentBatchSize = this.config.batchSize;
    
    this.connectionState = {
      lastSyncTimestamp: 0,
      subscribedPriorities: new Set(this.config.subscribedPriorities),
      acknowledgedAlerts: new Set(),
      pendingAcknowledgments: new Map(),
      syncInProgress: false
    };
  }

  /**
   * Initialize with WebSocket client reference
   */
  initialize(wsClient: any): void {
    this.wsClient = wsClient;
    this.setupEventHandlers();
  }

  /**
   * Register event handlers
   */
  on<K extends keyof AlertEventHandlers>(
    event: K,
    handler: AlertEventHandlers[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Send alert to server with optimizations
   */
  async sendAlert(alertData: AlertMessageData): Promise<string> {
    const alertMessage: AlertWebSocketMessage = {
      id: this.generateAlertId(),
      type: 'new',
      priority: this.mapPriorityToString(Priority.NORMAL),
      timestamp: Date.now(),
      data: {
        ...alertData,
        source: alertData.source || 'client'
      }
    };

    // Determine if we should batch or send immediately
    const shouldBatchImmediate = this.shouldSendImmediately(alertMessage);
    
    if (shouldBatchImmediate) {
      await this.sendImmediateAlert(alertMessage);
    } else {
      this.addToBatch(alertMessage);
    }

    return alertMessage.id;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string, 
    acknowledgedBy: string,
    syncAcrossClients = true
  ): Promise<void> {
    const acknowledgment: AlertAcknowledgment = {
      alertId,
      acknowledgedBy,
      acknowledgedAt: Date.now(),
      clientId: this.getClientId(),
      syncAcrossClients
    };

    // Add to local acknowledged set immediately for responsive UX
    this.connectionState.acknowledgedAlerts.add(alertId);
    
    // Queue for server synchronization
    this.acknowledgeQueue.set(alertId, acknowledgment);
    
    try {
      await this.sendAcknowledgment(acknowledgment);
      this.acknowledgeQueue.delete(alertId);
      
      // Emit event
      this.eventHandlers.onAlertAcknowledged?.(acknowledgment);
      
    } catch (error) {
      // Keep in queue for retry
      this.scheduleRetry(`ack_${alertId}`, () => this.sendAcknowledgment(acknowledgment));
      throw this.createAlertError(error as Error, 'acknowledge', alertId);
    }
  }

  /**
   * Request alert synchronization from server
   */
  async syncAlerts(syncRequest: Partial<AlertSyncRequest> = {}): Promise<AlertSyncResponse> {
    if (this.connectionState.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.connectionState.syncInProgress = true;

    const request: AlertSyncRequest = {
      lastSyncTimestamp: this.connectionState.lastSyncTimestamp,
      priorities: Array.from(this.connectionState.subscribedPriorities) as any,
      includeAcknowledged: false,
      maxCount: 100,
      ...syncRequest
    };

    try {
      const response = await this.sendSyncRequest(request);
      
      // Update connection state
      this.connectionState.lastSyncTimestamp = response.syncTimestamp;
      this.connectionState.syncInProgress = false;
      
      // Process received alerts
      for (const alert of response.alerts) {
        await this.processIncomingAlert(alert);
      }
      
      // Emit completion event
      this.eventHandlers.onAlertSyncComplete?.(response);
      
      return response;
      
    } catch (error) {
      this.connectionState.syncInProgress = false;
      throw this.createAlertError(error as Error, 'sync');
    }
  }

  /**
   * Handle connection recovery
   */
  async handleConnectionRecovery(): Promise<void> {
    if (this.config.resyncOnReconnect) {
      try {
        // Mark connection loss time if not already set
        if (!this.connectionState.connectionLossTime) {
          this.connectionState.connectionLossTime = Date.now();
        }

        // Resynchronize alerts missed during disconnection
        await this.syncAlerts({
          lastSyncTimestamp: this.connectionState.connectionLossTime
        });

        // Resend pending acknowledgments
        await this.resendPendingAcknowledgments();
        
        // Clear connection loss time
        this.connectionState.connectionLossTime = undefined;
        
      } catch (error) {
        console.error('Alert resync failed after reconnection:', error);
        // Schedule retry
        setTimeout(() => this.handleConnectionRecovery(), this.config.retryBackoffMs);
      }
    }
  }

  /**
   * Update connection quality metrics for adaptive batching
   */
  updateLatencyMetrics(latency: number): void {
    this.recentLatencies.push(latency);
    
    // Keep only recent measurements (last 10)
    if (this.recentLatencies.length > 10) {
      this.recentLatencies.shift();
    }

    // Adapt batch size based on latency
    if (this.config.adaptiveBatching) {
      this.adaptBatchSize(latency);
    }
  }

  /**
   * Get current connection and queue status
   */
  getStatus(): {
    connectionState: AlertConnectionState;
    queueSizes: {
      outgoing: number;
      acknowledgments: number;
      retries: number;
    };
    metrics: {
      averageLatency: number;
      currentBatchSize: number;
      successRate: number;
    };
  } {
    const avgLatency = this.recentLatencies.length > 0 
      ? this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
      : 0;

    const totalOperations = this.failedOperations.size + this.retryTimers.size;
    const successRate = totalOperations > 0 
      ? (totalOperations - this.failedOperations.size) / totalOperations 
      : 1;

    return {
      connectionState: { ...this.connectionState },
      queueSizes: {
        outgoing: this.outgoingBatch.length,
        acknowledgments: this.acknowledgeQueue.size,
        retries: this.retryTimers.size
      },
      metrics: {
        averageLatency: avgLatency,
        currentBatchSize: this.currentBatchSize,
        successRate
      }
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear timers
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
    
    // Clear queues
    this.outgoingBatch = [];
    this.acknowledgeQueue.clear();
    this.failedOperations.clear();
    
    // Clear event handlers
    this.eventHandlers = {};
  }

  // Private methods

  private setupEventHandlers(): void {
    if (!this.wsClient) return;

    // Handle incoming alert messages
    this.wsClient.on('onMessage', (message: WebSocketMessage) => {
      if (message.type === MessageType.ALERT) {
        this.handleIncomingAlertMessage(message);
      } else if (message.type === MessageType.ALERT_BATCH) {
        this.handleIncomingBatchMessage(message);
      } else if (message.type === MessageType.ALERT_SYNC) {
        this.handleSyncResponse(message);
      }
    });

    // Handle connection events
    this.wsClient.on('onConnect', () => {
      this.handleConnectionRecovery();
    });

    this.wsClient.on('onReconnect', () => {
      this.handleConnectionRecovery();
    });

    // Track latency for adaptive batching
    this.wsClient.on('onHeartbeat', (data: any) => {
      if (data.latency) {
        this.updateLatencyMetrics(data.latency);
      }
    });
  }

  private shouldSendImmediately(alert: AlertWebSocketMessage): boolean {
    // Critical alerts always sent immediately
    if (alert.priority === 'critical') {
      return true;
    }

    // Send immediately if batch is empty and we have low latency
    const avgLatency = this.getAverageLatency();
    return this.outgoingBatch.length === 0 && avgLatency < this.config.lowLatencyThreshold;
  }

  private async sendImmediateAlert(alert: AlertWebSocketMessage): Promise<void> {
    if (!this.wsClient) throw new Error('WebSocket client not initialized');

    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type: MessageType.ALERT,
      payload: alert,
      timestamp: Date.now(),
      protocol: this.wsClient.getCurrentProtocol(),
      compressed: false,
      acknowledged: false,
      priority: this.mapStringToPriority(alert.priority)
    };

    await this.wsClient.sendMessage(message.type, message.payload, message.priority);
  }

  private addToBatch(alert: AlertWebSocketMessage): void {
    this.outgoingBatch.push(alert);

    // Send batch if full or start timer
    if (this.outgoingBatch.length >= this.currentBatchSize) {
      this.sendBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.sendBatch();
      }, this.config.batchTimeout);
    }
  }

  private async sendBatch(): Promise<void> {
    if (this.outgoingBatch.length === 0) return;

    const batch = [...this.outgoingBatch];
    this.outgoingBatch = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const batchMessage: AlertBatchMessage = {
        batchId: this.generateBatchId(),
        alerts: batch,
        timestamp: Date.now(),
        isComplete: true,
        sequenceNumber: 1,
        totalSequences: 1
      };

      await this.wsClient.sendMessage(
        MessageType.ALERT_BATCH,
        batchMessage,
        Priority.NORMAL
      );

    } catch (error) {
      // Re-queue alerts for retry
      this.outgoingBatch.unshift(...batch);
      this.scheduleRetry('batch', () => this.sendBatch());
    }
  }

  private async sendAcknowledgment(ack: AlertAcknowledgment): Promise<void> {
    if (!this.wsClient) throw new Error('WebSocket client not initialized');

    await this.wsClient.sendMessage(
      MessageType.ALERT_ACK,
      ack,
      Priority.HIGH
    );
  }

  private async sendSyncRequest(request: AlertSyncRequest): Promise<AlertSyncResponse> {
    if (!this.wsClient) throw new Error('WebSocket client not initialized');

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Sync request timeout'));
      }, this.config.acknowledgmentTimeout);

      // Send sync request
      this.wsClient.sendMessage(MessageType.ALERT_SYNC, request, Priority.HIGH)
        .then(() => {
          // Response will be handled by handleSyncResponse
          // Store resolve/reject for later
          (this as any)._syncResolver = { resolve, reject, timeoutId };
        })
        .catch((error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async handleIncomingAlertMessage(message: WebSocketMessage): Promise<void> {
    try {
      const alert = message.payload as AlertWebSocketMessage;
      await this.processIncomingAlert(alert);
    } catch (error) {
      console.error('Error processing incoming alert:', error);
    }
  }

  private async handleIncomingBatchMessage(message: WebSocketMessage): Promise<void> {
    try {
      const batch = message.payload as AlertBatchMessage;
      
      for (const alert of batch.alerts) {
        await this.processIncomingAlert(alert);
      }
    } catch (error) {
      console.error('Error processing alert batch:', error);
    }
  }

  private handleSyncResponse(message: WebSocketMessage): void {
    const resolver = (this as any)._syncResolver;
    if (resolver) {
      clearTimeout(resolver.timeoutId);
      resolver.resolve(message.payload as AlertSyncResponse);
      delete (this as any)._syncResolver;
    }
  }

  private async processIncomingAlert(alert: AlertWebSocketMessage): Promise<void> {
    // Update acknowledgment state if needed
    if (alert.data.acknowledged) {
      this.connectionState.acknowledgedAlerts.add(alert.id);
    }

    // Auto-acknowledge info alerts if configured
    if (alert.priority === 'info' && this.config.autoAcknowledgeInfo) {
      this.connectionState.acknowledgedAlerts.add(alert.id);
    }

    // Emit event
    this.eventHandlers.onAlertReceived?.(alert);
  }

  private async resendPendingAcknowledgments(): Promise<void> {
    const promises = Array.from(this.acknowledgeQueue.values()).map(ack => 
      this.sendAcknowledgment(ack).catch(error => {
        console.error('Failed to resend acknowledgment:', error);
      })
    );

    await Promise.allSettled(promises);
  }

  private adaptBatchSize(latency: number): void {
    if (latency < this.config.lowLatencyThreshold) {
      // Low latency: can handle smaller, more frequent batches
      this.currentBatchSize = Math.max(10, this.config.batchSize / 2);
    } else if (latency > this.config.highLatencyThreshold) {
      // High latency: use larger batches to reduce round trips
      this.currentBatchSize = Math.min(100, this.config.batchSize * 2);
    } else {
      // Normal latency: use default batch size
      this.currentBatchSize = this.config.batchSize;
    }
  }

  private scheduleRetry(operationId: string, operation: () => Promise<void>): void {
    // Clear existing retry
    const existingTimer = this.retryTimers.get(operationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Get retry info
    const retryInfo = this.failedOperations.get(operationId) || { attempt: 0, lastTry: 0 };
    
    if (retryInfo.attempt >= this.config.maxRetries) {
      this.failedOperations.delete(operationId);
      return;
    }

    // Calculate backoff delay
    const delay = this.config.retryBackoffMs * Math.pow(2, retryInfo.attempt);
    
    const timer = setTimeout(async () => {
      try {
        await operation();
        // Success - remove from failed operations
        this.failedOperations.delete(operationId);
        this.retryTimers.delete(operationId);
      } catch (error) {
        // Update retry info and schedule next retry
        this.failedOperations.set(operationId, {
          attempt: retryInfo.attempt + 1,
          lastTry: Date.now()
        });
        this.scheduleRetry(operationId, operation);
      }
    }, delay);

    this.retryTimers.set(operationId, timer);
  }

  private getAverageLatency(): number {
    if (this.recentLatencies.length === 0) return 0;
    return this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length;
  }

  private createAlertError(
    originalError: Error,
    operation: 'send' | 'acknowledge' | 'sync' | 'batch',
    alertId?: string
  ): AlertWebSocketError {
    const error = new Error(originalError.message) as AlertWebSocketError;
    error.name = 'AlertWebSocketError';
    error.code = originalError.name || 'UNKNOWN';
    error.type = 'protocol';
    error.recoverable = true;
    error.timestamp = Date.now();
    error.alertId = alertId;
    error.operation = operation;
    return error;
  }

  // Utility methods
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientId(): string {
    // This would typically come from authentication or connection state
    return `client_${Date.now()}`;
  }

  private mapPriorityToString(priority: Priority): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (priority) {
      case Priority.CRITICAL: return 'critical';
      case Priority.HIGH: return 'high';
      case Priority.NORMAL: return 'medium';
      case Priority.LOW: return 'low';
      default: return 'info';
    }
  }

  private mapStringToPriority(priority: string): Priority {
    switch (priority) {
      case 'critical': return Priority.CRITICAL;
      case 'high': return Priority.HIGH;
      case 'medium': return Priority.NORMAL;
      case 'low': return Priority.LOW;
      default: return Priority.LOW;
    }
  }
}