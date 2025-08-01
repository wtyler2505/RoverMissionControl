/**
 * Alert Persistence Service
 * Provides IndexedDB-based storage for alerts with structured schema and transaction support
 */

import Dexie, { Table } from 'dexie';
import { AlertPriority } from '../../theme/alertPriorities';

export interface PersistedAlert {
  id: string;
  title?: string;
  message: string;
  priority: AlertPriority;
  timestamp: Date;
  closable: boolean;
  persistent: boolean;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  dismissedAt?: Date;
  expiresAt?: Date;
  source: string;
  deviceId: string;
  sessionId: string;
  groupId?: string;
  metadata?: Record<string, any>;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'failed';
  version: number;
  lastModified: Date;
}

export interface AlertDevice {
  deviceId: string;
  deviceName: string;
  lastSeen: Date;
  isActive: boolean;
}

export interface AlertSyncState {
  lastSyncTimestamp: Date;
  deviceId: string;
  isLeader: boolean;
  syncInProgress: boolean;
  conflictCount: number;
}

class AlertPersistenceDatabase extends Dexie {
  alerts!: Table<PersistedAlert>;
  devices!: Table<AlertDevice>;
  syncState!: Table<AlertSyncState>;

  constructor() {
    super('AlertPersistenceDB');
    
    this.version(1).stores({
      alerts: '++id, priority, timestamp, acknowledged, dismissedAt, expiresAt, deviceId, sessionId, syncStatus, lastModified',
      devices: '++deviceId, lastSeen, isActive',
      syncState: '++deviceId, lastSyncTimestamp, isLeader'
    });

    // Add hooks for automatic timestamp updates
    this.alerts.hook('creating', (primKey, obj, trans) => {
      obj.timestamp = obj.timestamp || new Date();
      obj.lastModified = new Date();
      obj.version = 1;
    });

    this.alerts.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.lastModified = new Date();
      modifications.version = (obj.version || 0) + 1;
    });
  }
}

export class AlertPersistenceService {
  private db: AlertPersistenceDatabase;
  private deviceId: string;
  private sessionId: string;
  private retentionPolicies: Record<AlertPriority, number> = {
    critical: -1, // Never expire
    high: 30 * 24 * 60 * 60 * 1000, // 30 days
    medium: 7 * 24 * 60 * 60 * 1000, // 7 days
    low: 24 * 60 * 60 * 1000, // 24 hours
    info: 0 // Memory only, no persistence
  };
  private cleanupIntervalId?: NodeJS.Timeout;

  constructor() {
    this.db = new AlertPersistenceDatabase();
    this.deviceId = this.generateDeviceId();
    this.sessionId = this.generateSessionId();
    this.startCleanupScheduler();
  }

  /**
   * Initialize the persistence service
   */
  async initialize(): Promise<void> {
    try {
      await this.db.open();
      await this.registerDevice();
      await this.cleanupExpiredAlerts();
      console.log('Alert persistence service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize alert persistence service:', error);
      throw error;
    }
  }

  /**
   * Store an alert in IndexedDB
   */
  async storeAlert(alert: Omit<PersistedAlert, 'deviceId' | 'sessionId' | 'timestamp' | 'lastModified' | 'version'>): Promise<string> {
    // Skip persistence for info alerts unless explicitly persistent
    if (alert.priority === 'info' && !alert.persistent) {
      return alert.id;
    }

    const now = new Date();
    const expirationTime = this.retentionPolicies[alert.priority];
    
    const persistedAlert: PersistedAlert = {
      ...alert,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      timestamp: alert.timestamp || now,
      lastModified: now,
      version: 1,
      expiresAt: expirationTime > 0 ? new Date(now.getTime() + expirationTime) : undefined,
    };

    try {
      await this.db.alerts.put(persistedAlert);
      return alert.id;
    } catch (error) {
      console.error('Failed to store alert:', error);
      throw error;
    }
  }

  /**
   * Retrieve alerts from IndexedDB with filtering
   */
  async getAlerts(filter?: {
    priority?: AlertPriority[];
    acknowledged?: boolean;
    dismissed?: boolean;
    deviceId?: string;
    sessionId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PersistedAlert[]> {
    try {
      let query = this.db.alerts.orderBy('timestamp').reverse();

      if (filter) {
        // Apply filters
        if (filter.priority) {
          query = query.filter(alert => filter.priority!.includes(alert.priority));
        }
        
        if (filter.acknowledged !== undefined) {
          query = query.filter(alert => alert.acknowledged === filter.acknowledged);
        }
        
        if (filter.dismissed !== undefined) {
          query = query.filter(alert => 
            filter.dismissed ? alert.dismissedAt !== undefined : alert.dismissedAt === undefined
          );
        }
        
        if (filter.deviceId) {
          query = query.filter(alert => alert.deviceId === filter.deviceId);
        }
        
        if (filter.sessionId) {
          query = query.filter(alert => alert.sessionId === filter.sessionId);
        }
        
        if (filter.from) {
          query = query.filter(alert => alert.timestamp >= filter.from!);
        }
        
        if (filter.to) {
          query = query.filter(alert => alert.timestamp <= filter.to!);
        }
        
        if (filter.offset) {
          query = query.offset(filter.offset);
        }
        
        if (filter.limit) {
          query = query.limit(filter.limit);
        }
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to retrieve alerts:', error);
      throw error;
    }
  }

  /**
   * Update alert acknowledgment status
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      await this.db.alerts.update(alertId, {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
        syncStatus: 'pending'
      });
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Mark alert as dismissed
   */
  async dismissAlert(alertId: string): Promise<void> {
    try {
      await this.db.alerts.update(alertId, {
        dismissedAt: new Date(),
        syncStatus: 'pending'
      });
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
      throw error;
    }
  }

  /**
   * Remove alert from storage
   */
  async removeAlert(alertId: string): Promise<void> {
    try {
      await this.db.alerts.delete(alertId);
    } catch (error) {
      console.error('Failed to remove alert:', error);
      throw error;
    }
  }

  /**
   * Get alerts requiring acknowledgment
   */
  async getUnacknowledgedAlerts(): Promise<PersistedAlert[]> {
    try {
      return await this.db.alerts
        .where('acknowledged')
        .equals(false)
        .and(alert => ['critical', 'high'].includes(alert.priority))
        .and(alert => !alert.dismissedAt)
        .toArray();
    } catch (error) {
      console.error('Failed to get unacknowledged alerts:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalAlerts: number;
    pendingSync: number;
    conflicts: number;
    lastSync?: Date;
  }> {
    try {
      const [totalAlerts, pendingSync, conflicts, syncState] = await Promise.all([
        this.db.alerts.count(),
        this.db.alerts.where('syncStatus').equals('pending').count(),
        this.db.alerts.where('syncStatus').equals('conflict').count(),
        this.db.syncState.where('deviceId').equals(this.deviceId).first()
      ]);

      return {
        totalAlerts,
        pendingSync,
        conflicts,
        lastSync: syncState?.lastSyncTimestamp
      };
    } catch (error) {
      console.error('Failed to get sync stats:', error);
      throw error;
    }
  }

  /**
   * Update sync status for alerts
   */
  async updateSyncStatus(alertIds: string[], status: PersistedAlert['syncStatus']): Promise<void> {
    try {
      await this.db.transaction('rw', this.db.alerts, async () => {
        for (const alertId of alertIds) {
          await this.db.alerts.update(alertId, { syncStatus: status });
        }
      });
    } catch (error) {
      console.error('Failed to update sync status:', error);
      throw error;
    }
  }

  /**
   * Get alerts pending synchronization
   */
  async getPendingSyncAlerts(): Promise<PersistedAlert[]> {
    try {
      return await this.db.alerts.where('syncStatus').equals('pending').toArray();
    } catch (error) {
      console.error('Failed to get pending sync alerts:', error);
      throw error;
    }
  }

  /**
   * Clean up expired alerts based on retention policies
   */
  async cleanupExpiredAlerts(): Promise<number> {
    try {
      const now = new Date();
      const expiredAlerts = await this.db.alerts
        .where('expiresAt')
        .below(now)
        .toArray();

      if (expiredAlerts.length > 0) {
        await this.db.alerts.bulkDelete(expiredAlerts.map(alert => alert.id));
        console.log(`Cleaned up ${expiredAlerts.length} expired alerts`);
      }

      return expiredAlerts.length;
    } catch (error) {
      console.error('Failed to cleanup expired alerts:', error);
      return 0;
    }
  }

  /**
   * Register current device
   */
  private async registerDevice(): Promise<void> {
    try {
      const device: AlertDevice = {
        deviceId: this.deviceId,
        deviceName: this.getDeviceName(),
        lastSeen: new Date(),
        isActive: true
      };

      await this.db.devices.put(device);
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    // Use existing device ID from localStorage or generate new one
    const stored = localStorage.getItem('rover-alert-device-id');
    if (stored) return stored;

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('rover-alert-device-id', deviceId);
    return deviceId;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get device name
   */
  private getDeviceName(): string {
    const platform = navigator.platform || 'Unknown Platform';
    const userAgent = navigator.userAgent;
    
    // Extract browser name
    let browser = 'Unknown Browser';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    return `${platform} - ${browser}`;
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredAlerts().catch(console.error);
    }, 60 * 60 * 1000);
  }

  /**
   * Stop cleanup scheduler
   */
  private stopCleanupScheduler(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  /**
   * Get all devices
   */
  async getDevices(): Promise<AlertDevice[]> {
    try {
      return await this.db.devices.toArray();
    } catch (error) {
      console.error('Failed to get devices:', error);
      return [];
    }
  }

  /**
   * Get all session IDs
   */
  async getSessionIds(): Promise<string[]> {
    try {
      const alerts = await this.db.alerts.toArray();
      const sessionIds = [...new Set(alerts.map(alert => alert.sessionId))];
      return sessionIds;
    } catch (error) {
      console.error('Failed to get session IDs:', error);
      return [];
    }
  }

  /**
   * Get sync history
   */
  async getSyncHistory(): Promise<any[]> {
    try {
      return await this.db.syncState.toArray();
    } catch (error) {
      console.error('Failed to get sync history:', error);
      return [];
    }
  }

  /**
   * Remove device
   */
  async removeDevice(deviceId: string): Promise<void> {
    try {
      await this.db.devices.where('deviceId').equals(deviceId).delete();
    } catch (error) {
      console.error('Failed to remove device:', error);
      throw error;
    }
  }

  /**
   * Delete alert by ID
   */
  async deleteAlert(alertId: string): Promise<void> {
    try {
      await this.db.alerts.delete(alertId);
    } catch (error) {
      console.error('Failed to delete alert:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.stopCleanupScheduler();
    await this.db.close();
  }

  // Getters
  get currentDeviceId(): string {
    return this.deviceId;
  }

  get currentSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const alertPersistenceService = new AlertPersistenceService();