/**
 * Alert Queue Manager
 * Handles alert processing, timing, and lifecycle management
 */

import { AlertPriorityQueue, QueuedAlert } from './PriorityQueue';
import { AlertPriority } from '../../theme/alertPriorities';

export interface AlertQueueConfig {
  maxAlertsPerPriority: Record<AlertPriority, number>;
  maxTotalAlerts: number;
  processingDelays: Record<AlertPriority, number>;
  defaultExpiration: Record<AlertPriority, number | null>;
  overflowStrategy: 'drop-oldest' | 'drop-lowest' | 'compress' | 'paginate' | 'summarize';
}

export interface ProcessedAlert extends QueuedAlert {
  processedAt: Date;
  position: number;
  isGrouped: boolean;
  groupCount?: number;
}

export type AlertProcessor = (alert: ProcessedAlert) => void | Promise<void>;
export type OverflowHandler = (alerts: QueuedAlert[]) => QueuedAlert[];

export class AlertQueueManager {
  private queue: AlertPriorityQueue;
  private config: AlertQueueConfig;
  private processors: AlertProcessor[] = [];
  private processingTimer: NodeJS.Timeout | null = null;
  private processedAlerts: Map<string, ProcessedAlert> = new Map();
  private groupedAlerts: Map<string, QueuedAlert[]> = new Map();

  constructor(config: Partial<AlertQueueConfig> = {}) {
    this.queue = new AlertPriorityQueue();
    this.config = {
      maxAlertsPerPriority: {
        critical: 10,
        high: 20,
        medium: 30,
        low: 40,
        info: 50,
      },
      maxTotalAlerts: 100,
      processingDelays: {
        critical: 0,      // Immediate
        high: 5000,       // 5 seconds
        medium: 30000,    // 30 seconds
        low: 300000,      // 5 minutes
        info: 300000,     // 5 minutes (background)
      },
      defaultExpiration: {
        critical: null,   // Never expires
        high: 3600000,    // 1 hour
        medium: 1800000,  // 30 minutes
        low: 900000,      // 15 minutes
        info: 300000,     // 5 minutes
      },
      overflowStrategy: 'drop-oldest',
      ...config,
    };
  }

  /**
   * Add an alert to the queue
   */
  async addAlert(alert: Omit<QueuedAlert, 'id' | 'timestamp'>): Promise<string> {
    const id = this.generateId();
    const timestamp = new Date();
    const expirationTime = this.config.defaultExpiration[alert.priority];
    
    const queuedAlert: QueuedAlert = {
      ...alert,
      id,
      timestamp,
      expiresAt: expirationTime ? new Date(timestamp.getTime() + expirationTime) : undefined,
    };

    // Check for overflow
    if (this.isOverflowing(alert.priority)) {
      await this.handleOverflow(alert.priority);
    }

    // Handle grouping if groupId is provided
    if (queuedAlert.groupId) {
      const group = this.groupedAlerts.get(queuedAlert.groupId) || [];
      group.push(queuedAlert);
      this.groupedAlerts.set(queuedAlert.groupId, group);
      
      // Only add the first alert of a group to the queue
      if (group.length > 1) {
        return id;
      }
    }

    this.queue.enqueue(queuedAlert);
    this.scheduleProcessing();
    
    return id;
  }

  /**
   * Remove an alert from the queue
   */
  removeAlert(id: string): boolean {
    const removed = this.queue.remove(id);
    if (removed) {
      this.processedAlerts.delete(id);
      // Remove from grouped alerts if applicable
      for (const [groupId, group] of this.groupedAlerts.entries()) {
        const filtered = group.filter(alert => alert.id !== id);
        if (filtered.length === 0) {
          this.groupedAlerts.delete(groupId);
        } else {
          this.groupedAlerts.set(groupId, filtered);
        }
      }
    }
    return removed;
  }

  /**
   * Register an alert processor
   */
  addProcessor(processor: AlertProcessor): void {
    this.processors.push(processor);
  }

  /**
   * Remove an alert processor
   */
  removeProcessor(processor: AlertProcessor): void {
    const index = this.processors.indexOf(processor);
    if (index > -1) {
      this.processors.splice(index, 1);
    }
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    total: number;
    byPriority: Record<AlertPriority, number>;
    processed: number;
    grouped: number;
  } {
    return {
      total: this.queue.size(),
      byPriority: this.queue.getCountByPriority(),
      processed: this.processedAlerts.size,
      grouped: this.groupedAlerts.size,
    };
  }

  /**
   * Get all alerts in priority order
   */
  getAllAlerts(): ProcessedAlert[] {
    const alerts = this.queue.toArray();
    return alerts.map((alert, index) => {
      const processed = this.processedAlerts.get(alert.id);
      if (processed) return processed;

      const groupCount = alert.groupId ? 
        this.groupedAlerts.get(alert.groupId)?.length || 1 : 
        undefined;

      return {
        ...alert,
        processedAt: new Date(),
        position: index,
        isGrouped: !!alert.groupId,
        groupCount,
      };
    });
  }

  /**
   * Clear all alerts
   */
  clear(): void {
    this.queue.clear();
    this.processedAlerts.clear();
    this.groupedAlerts.clear();
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Process alerts based on priority timing
   */
  private async processAlerts(): Promise<void> {
    // Remove expired alerts first
    const expired = this.queue.removeExpired();
    expired.forEach(alert => {
      this.processedAlerts.delete(alert.id);
    });

    // Process alerts by priority
    const now = new Date();
    const toProcess: ProcessedAlert[] = [];

    // Get all alerts and check which ones are ready to process
    const alerts = this.queue.toArray();
    let position = 0;

    for (const alert of alerts) {
      const timeSinceQueued = now.getTime() - alert.timestamp.getTime();
      const processingDelay = this.config.processingDelays[alert.priority];

      if (timeSinceQueued >= processingDelay) {
        const groupCount = alert.groupId ? 
          this.groupedAlerts.get(alert.groupId)?.length || 1 : 
          undefined;

        const processedAlert: ProcessedAlert = {
          ...alert,
          processedAt: now,
          position: position++,
          isGrouped: !!alert.groupId,
          groupCount,
        };

        toProcess.push(processedAlert);
        this.processedAlerts.set(alert.id, processedAlert);
      }
    }

    // Process alerts
    for (const alert of toProcess) {
      for (const processor of this.processors) {
        try {
          await processor(alert);
        } catch (error) {
          console.error('Alert processor error:', error);
        }
      }
    }

    // Schedule next processing
    this.scheduleProcessing();
  }

  /**
   * Schedule the next processing cycle
   */
  private scheduleProcessing(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
    }

    if (this.queue.isEmpty()) return;

    // Find the next alert that needs processing
    const now = new Date();
    const alerts = this.queue.toArray();
    let nextProcessingTime = Infinity;

    for (const alert of alerts) {
      const timeSinceQueued = now.getTime() - alert.timestamp.getTime();
      const processingDelay = this.config.processingDelays[alert.priority];
      const timeUntilProcess = processingDelay - timeSinceQueued;

      if (timeUntilProcess > 0 && timeUntilProcess < nextProcessingTime) {
        nextProcessingTime = timeUntilProcess;
      }
    }

    if (nextProcessingTime < Infinity) {
      this.processingTimer = setTimeout(() => {
        this.processAlerts();
      }, Math.min(nextProcessingTime, 1000)); // Check at least every second
    }
  }

  /**
   * Check if queue is overflowing
   */
  private isOverflowing(priority: AlertPriority): boolean {
    const counts = this.queue.getCountByPriority();
    return (
      counts[priority] >= this.config.maxAlertsPerPriority[priority] ||
      this.queue.size() >= this.config.maxTotalAlerts
    );
  }

  /**
   * Handle queue overflow
   */
  private async handleOverflow(newPriority: AlertPriority): Promise<void> {
    switch (this.config.overflowStrategy) {
      case 'drop-oldest':
        this.dropOldestAlerts(newPriority);
        break;
      case 'drop-lowest':
        this.dropLowestPriorityAlerts();
        break;
      case 'compress':
        this.compressAlerts();
        break;
      case 'paginate':
        // Pagination handled by UI layer
        break;
      case 'summarize':
        this.summarizeAlerts();
        break;
    }
  }

  /**
   * Drop oldest alerts of same or lower priority
   */
  private dropOldestAlerts(priority: AlertPriority): void {
    const priorities: AlertPriority[] = ['info', 'low', 'medium', 'high', 'critical'];
    const priorityIndex = priorities.indexOf(priority);
    
    for (let i = 0; i <= priorityIndex; i++) {
      const currentPriority = priorities[i];
      const alerts = this.queue.getByPriority(currentPriority);
      
      if (alerts.length > 0) {
        // Sort by timestamp and remove oldest
        alerts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        this.queue.remove(alerts[0].id);
        break;
      }
    }
  }

  /**
   * Drop lowest priority alerts
   */
  private dropLowestPriorityAlerts(): void {
    const priorities: AlertPriority[] = ['info', 'low', 'medium', 'high', 'critical'];
    
    for (const priority of priorities) {
      const alerts = this.queue.getByPriority(priority);
      if (alerts.length > 0) {
        this.queue.remove(alerts[0].id);
        break;
      }
    }
  }

  /**
   * Compress similar alerts into groups
   */
  private compressAlerts(): void {
    // Group alerts by similarity
    const alerts = this.queue.toArray();
    const groups = new Map<string, QueuedAlert[]>();

    alerts.forEach(alert => {
      const key = `${alert.priority}-${alert.data?.type || 'default'}`;
      const group = groups.get(key) || [];
      group.push(alert);
      groups.set(key, group);
    });

    // Compress groups with more than 3 alerts
    groups.forEach((group, key) => {
      if (group.length > 3) {
        // Keep the newest alert and remove others
        group.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const keeper = group[0];
        
        // Update the keeper with group information
        keeper.groupId = key;
        keeper.data = {
          ...keeper.data,
          groupCount: group.length,
          firstOccurrence: group[group.length - 1].timestamp,
        };

        // Remove other alerts
        for (let i = 1; i < group.length; i++) {
          this.queue.remove(group[i].id);
        }
      }
    });
  }

  /**
   * Summarize alerts by creating summary alerts
   */
  private summarizeAlerts(): void {
    const counts = this.queue.getCountByPriority();
    const summaries: Array<{ priority: AlertPriority; count: number }> = [];

    // Check each priority level
    (['info', 'low', 'medium'] as AlertPriority[]).forEach(priority => {
      if (counts[priority] > 5) {
        summaries.push({ priority, count: counts[priority] });
        
        // Remove all alerts of this priority
        const alerts = this.queue.getByPriority(priority);
        alerts.forEach(alert => this.queue.remove(alert.id));
      }
    });

    // Create summary alerts
    summaries.forEach(({ priority, count }) => {
      this.addAlert({
        priority: 'medium',
        data: {
          type: 'summary',
          originalPriority: priority,
          count,
          message: `${count} ${priority} priority alerts summarized`,
        },
      });
    });
  }

  /**
   * Generate unique alert ID
   */
  private generateId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}