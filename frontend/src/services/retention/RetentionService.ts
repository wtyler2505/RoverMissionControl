/**
 * Retention Service
 * Manages alert lifecycle, expiration, and deletion according to retention policies
 */

import { PersistedAlert } from '../persistence/AlertPersistenceService';
import { RetentionPolicy, RetentionPeriod, retentionPolicy } from './RetentionPolicy';
import { AlertPriority } from '../../theme/alertPriorities';

export interface AlertRetentionMetadata {
  createdAt: Date;
  expiresAt: Date;
  gracePeriodEndsAt?: Date;
  retentionPolicyId?: string;
  customRetentionPeriod?: RetentionPeriod;
  legalHold?: {
    enabled: boolean;
    placedBy: string;
    placedAt: Date;
    reason: string;
    expiresAt?: Date;
    reference?: string; // Legal case reference
  };
  retentionStatus: 'active' | 'expired' | 'grace_period' | 'pending_deletion' | 'legal_hold';
  notificationsSent: {
    sevenDayWarning?: Date;
    oneDayWarning?: Date;
    expiredNotice?: Date;
  };
}

export interface RetentionAuditLog {
  id: string;
  alertId: string;
  action: 'created' | 'updated' | 'expired' | 'deleted' | 'legal_hold_placed' | 'legal_hold_removed';
  timestamp: Date;
  userId?: string;
  reason?: string;
  metadata?: Record<string, any>;
  policyVersion: string;
}

export interface RetentionStats {
  totalAlerts: number;
  activeAlerts: number;
  expiredAlerts: number;
  gracePeriodAlerts: number;
  legalHoldAlerts: number;
  pendingDeletion: number;
  recentlyDeleted: number;
  retentionByPriority: Record<AlertPriority, {
    active: number;
    expired: number;
    averageAge: number; // in days
  }>;
}

export class RetentionService {
  private policy: RetentionPolicy;
  private auditLogs: RetentionAuditLog[] = [];

  constructor(policy: RetentionPolicy = retentionPolicy) {
    this.policy = policy;
    this.loadAuditLogs();
  }

  /**
   * Add retention metadata to a new alert
   */
  addRetentionMetadata(
    alert: PersistedAlert,
    customPolicyId?: string,
    customPeriod?: RetentionPeriod
  ): PersistedAlert {
    const now = new Date();
    const period = customPeriod || this.policy.getRetentionPeriod(alert.priority, customPolicyId);
    const expiresAt = this.policy.calculateExpirationDate(now, alert.priority, customPolicyId, customPeriod);
    const gracePeriodEndsAt = this.policy.calculateGracePeriodEnd(expiresAt, alert.priority, customPolicyId);

    const retentionMetadata: AlertRetentionMetadata = {
      createdAt: now,
      expiresAt,
      gracePeriodEndsAt: gracePeriodEndsAt || undefined,
      retentionPolicyId: customPolicyId,
      customRetentionPeriod: customPeriod,
      retentionStatus: 'active',
      notificationsSent: {}
    };

    const enhancedAlert: PersistedAlert = {
      ...alert,
      metadata: {
        ...alert.metadata,
        retention: retentionMetadata
      }
    };

    // Log the creation
    this.addAuditLog({
      alertId: alert.id,
      action: 'created',
      timestamp: now,
      metadata: {
        priority: alert.priority,
        expiresAt,
        retentionPeriod: period
      },
      policyVersion: this.policy.getCurrentPolicy(customPolicyId).version
    });

    return enhancedAlert;
  }

  /**
   * Update retention status of an alert
   */
  updateRetentionStatus(alert: PersistedAlert): PersistedAlert {
    const retentionData = this.getRetentionMetadata(alert);
    if (!retentionData) {
      return alert; // No retention metadata, skip
    }

    const now = new Date();
    let newStatus = retentionData.retentionStatus;

    // Check for legal hold first
    if (retentionData.legalHold?.enabled) {
      // Check if legal hold has expired
      if (retentionData.legalHold.expiresAt && now > retentionData.legalHold.expiresAt) {
        newStatus = 'expired';
      } else {
        newStatus = 'legal_hold';
      }
    } else if (now > retentionData.expiresAt) {
      // Check if we're in grace period
      if (retentionData.gracePeriodEndsAt && now <= retentionData.gracePeriodEndsAt) {
        newStatus = 'grace_period';
        this.sendExpirationNotification(alert, 'grace_period');
      } else {
        newStatus = 'pending_deletion';
        this.sendExpirationNotification(alert, 'pending_deletion');
      }
    } else {
      // Check for pre-expiration notifications
      const daysUntilExpiration = Math.floor((retentionData.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      
      if (daysUntilExpiration <= 7 && !retentionData.notificationsSent.sevenDayWarning) {
        this.sendExpirationNotification(alert, 'seven_day_warning');
        retentionData.notificationsSent.sevenDayWarning = now;
      } else if (daysUntilExpiration <= 1 && !retentionData.notificationsSent.oneDayWarning) {
        this.sendExpirationNotification(alert, 'one_day_warning');
        retentionData.notificationsSent.oneDayWarning = now;
      }
      
      newStatus = 'active';
    }

    // Update status if changed
    if (newStatus !== retentionData.retentionStatus) {
      retentionData.retentionStatus = newStatus;
      
      this.addAuditLog({
        alertId: alert.id,
        action: 'updated',
        timestamp: now,
        metadata: {
          oldStatus: retentionData.retentionStatus,
          newStatus,
          daysActive: Math.floor((now.getTime() - retentionData.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        },
        policyVersion: this.policy.getCurrentPolicy(retentionData.retentionPolicyId).version
      });
    }

    return {
      ...alert,
      metadata: {
        ...alert.metadata,
        retention: retentionData
      }
    };
  }

  /**
   * Place a legal hold on an alert
   */
  placeLegalHold(
    alert: PersistedAlert,
    placedBy: string,
    reason: string,
    reference?: string,
    expiresAt?: Date
  ): PersistedAlert {
    const retentionData = this.getRetentionMetadata(alert);
    if (!retentionData) {
      throw new Error('Alert has no retention metadata');
    }

    if (!this.policy.canPlaceLegalHold(alert.priority, retentionData.retentionPolicyId)) {
      throw new Error(`Legal hold not allowed for ${alert.priority} priority alerts`);
    }

    const now = new Date();
    retentionData.legalHold = {
      enabled: true,
      placedBy,
      placedAt: now,
      reason,
      reference,
      expiresAt
    };
    retentionData.retentionStatus = 'legal_hold';

    this.addAuditLog({
      alertId: alert.id,
      action: 'legal_hold_placed',
      timestamp: now,
      userId: placedBy,
      reason,
      metadata: {
        reference,
        expiresAt: expiresAt?.toISOString()
      },
      policyVersion: this.policy.getCurrentPolicy(retentionData.retentionPolicyId).version
    });

    return {
      ...alert,
      metadata: {
        ...alert.metadata,
        retention: retentionData
      }
    };
  }

  /**
   * Remove legal hold from an alert
   */
  removeLegalHold(alert: PersistedAlert, removedBy: string, reason?: string): PersistedAlert {
    const retentionData = this.getRetentionMetadata(alert);
    if (!retentionData?.legalHold?.enabled) {
      throw new Error('No active legal hold on this alert');
    }

    const now = new Date();
    const previousHold = retentionData.legalHold;
    retentionData.legalHold = undefined;

    // Recalculate status based on expiration
    if (now > retentionData.expiresAt) {
      retentionData.retentionStatus = retentionData.gracePeriodEndsAt && now <= retentionData.gracePeriodEndsAt
        ? 'grace_period'
        : 'pending_deletion';
    } else {
      retentionData.retentionStatus = 'active';
    }

    this.addAuditLog({
      alertId: alert.id,
      action: 'legal_hold_removed',
      timestamp: now,
      userId: removedBy,
      reason,
      metadata: {
        holdDuration: now.getTime() - previousHold.placedAt.getTime(),
        holdReason: previousHold.reason,
        holdReference: previousHold.reference
      },
      policyVersion: this.policy.getCurrentPolicy(retentionData.retentionPolicyId).version
    });

    return {
      ...alert,
      metadata: {
        ...alert.metadata,
        retention: retentionData
      }
    };
  }

  /**
   * Check if an alert should be deleted
   */
  shouldDelete(alert: PersistedAlert): boolean {
    const retentionData = this.getRetentionMetadata(alert);
    if (!retentionData) {
      return false; // No retention metadata, don't delete
    }

    // Never delete alerts on legal hold
    if (retentionData.legalHold?.enabled) {
      return false;
    }

    const now = new Date();

    // Check if past grace period
    if (retentionData.gracePeriodEndsAt) {
      return now > retentionData.gracePeriodEndsAt;
    }

    // Check if past expiration
    return now > retentionData.expiresAt;
  }

  /**
   * Get alerts that should be deleted
   */
  getAlertsForDeletion(alerts: PersistedAlert[]): PersistedAlert[] {
    return alerts.filter(alert => this.shouldDelete(alert));
  }

  /**
   * Get alerts in grace period
   */
  getAlertsInGracePeriod(alerts: PersistedAlert[]): PersistedAlert[] {
    const now = new Date();
    return alerts.filter(alert => {
      const retentionData = this.getRetentionMetadata(alert);
      return retentionData && 
        retentionData.retentionStatus === 'grace_period' &&
        retentionData.gracePeriodEndsAt &&
        now <= retentionData.gracePeriodEndsAt;
    });
  }

  /**
   * Get alerts on legal hold
   */
  getAlertsOnLegalHold(alerts: PersistedAlert[]): PersistedAlert[] {
    return alerts.filter(alert => {
      const retentionData = this.getRetentionMetadata(alert);
      return retentionData?.legalHold?.enabled || false;
    });
  }

  /**
   * Get retention statistics
   */
  calculateRetentionStats(alerts: PersistedAlert[]): RetentionStats {
    const now = new Date();
    const stats: RetentionStats = {
      totalAlerts: alerts.length,
      activeAlerts: 0,
      expiredAlerts: 0,
      gracePeriodAlerts: 0,
      legalHoldAlerts: 0,
      pendingDeletion: 0,
      recentlyDeleted: this.getRecentlyDeletedCount(),
      retentionByPriority: {
        critical: { active: 0, expired: 0, averageAge: 0 },
        high: { active: 0, expired: 0, averageAge: 0 },
        medium: { active: 0, expired: 0, averageAge: 0 },
        low: { active: 0, expired: 0, averageAge: 0 },
        info: { active: 0, expired: 0, averageAge: 0 }
      }
    };

    const agesByPriority: Record<AlertPriority, number[]> = {
      critical: [], high: [], medium: [], low: [], info: []
    };

    alerts.forEach(alert => {
      const retentionData = this.getRetentionMetadata(alert);
      const ageInDays = Math.floor((now.getTime() - alert.timestamp.getTime()) / (24 * 60 * 60 * 1000));
      
      agesByPriority[alert.priority].push(ageInDays);

      if (!retentionData) {
        stats.activeAlerts++;
        stats.retentionByPriority[alert.priority].active++;
        return;
      }

      switch (retentionData.retentionStatus) {
        case 'active':
          stats.activeAlerts++;
          stats.retentionByPriority[alert.priority].active++;
          break;
        case 'expired':
          stats.expiredAlerts++;
          stats.retentionByPriority[alert.priority].expired++;
          break;
        case 'grace_period':
          stats.gracePeriodAlerts++;
          break;
        case 'legal_hold':
          stats.legalHoldAlerts++;
          break;
        case 'pending_deletion':
          stats.pendingDeletion++;
          break;
      }
    });

    // Calculate average ages
    Object.keys(agesByPriority).forEach(priority => {
      const ages = agesByPriority[priority as AlertPriority];
      const averageAge = ages.length > 0 
        ? ages.reduce((sum, age) => sum + age, 0) / ages.length
        : 0;
      stats.retentionByPriority[priority as AlertPriority].averageAge = Math.round(averageAge);
    });

    return stats;
  }

  /**
   * Get retention metadata from an alert
   */
  private getRetentionMetadata(alert: PersistedAlert): AlertRetentionMetadata | null {
    return alert.metadata?.retention || null;
  }

  /**
   * Send expiration notification
   */
  private sendExpirationNotification(
    alert: PersistedAlert,
    type: 'seven_day_warning' | 'one_day_warning' | 'grace_period' | 'pending_deletion'
  ): void {
    // This would integrate with the notification system
    console.log(`Retention notification [${type}]:`, {
      alertId: alert.id,
      priority: alert.priority,
      message: alert.message,
      timestamp: new Date()
    });

    // In a real implementation, this would:
    // 1. Send email notifications to administrators
    // 2. Create system alerts
    // 3. Log to audit trail
    // 4. Update notification tracking
  }

  /**
   * Add audit log entry
   */
  private addAuditLog(log: Omit<RetentionAuditLog, 'id'>): void {
    const auditLog: RetentionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...log
    };

    this.auditLogs.push(auditLog);
    this.saveAuditLogs();

    // Clean up old audit logs based on retention policy
    this.cleanupOldAuditLogs();
  }

  /**
   * Get audit logs for an alert
   */
  getAuditLogs(alertId?: string): RetentionAuditLog[] {
    if (alertId) {
      return this.auditLogs.filter(log => log.alertId === alertId);
    }
    return [...this.auditLogs];
  }

  /**
   * Get recently deleted count from audit logs
   */
  private getRecentlyDeletedCount(): number {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.auditLogs.filter(log => 
      log.action === 'deleted' && log.timestamp >= thirtyDaysAgo
    ).length;
  }

  /**
   * Load audit logs from localStorage
   */
  private loadAuditLogs(): void {
    try {
      const stored = localStorage.getItem('rover-retention-audit-logs');
      if (stored) {
        const logs = JSON.parse(stored);
        this.auditLogs = logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load retention audit logs:', error);
    }
  }

  /**
   * Save audit logs to localStorage
   */
  private saveAuditLogs(): void {
    try {
      localStorage.setItem('rover-retention-audit-logs', JSON.stringify(this.auditLogs));
    } catch (error) {
      console.error('Failed to save retention audit logs:', error);
    }
  }

  /**
   * Clean up old audit logs
   */
  private cleanupOldAuditLogs(): void {
    const policy = this.policy.getCurrentPolicy();
    const cutoffDate = new Date(Date.now() - policy.globalSettings.auditLogRetention);
    
    const initialCount = this.auditLogs.length;
    this.auditLogs = this.auditLogs.filter(log => log.timestamp >= cutoffDate);
    
    if (this.auditLogs.length < initialCount) {
      this.saveAuditLogs();
      console.log(`Cleaned up ${initialCount - this.auditLogs.length} old audit log entries`);
    }
  }

  /**
   * Export audit logs for compliance
   */
  exportAuditLogs(alertId?: string, fromDate?: Date, toDate?: Date): RetentionAuditLog[] {
    let logs = alertId ? this.getAuditLogs(alertId) : this.auditLogs;

    if (fromDate) {
      logs = logs.filter(log => log.timestamp >= fromDate);
    }

    if (toDate) {
      logs = logs.filter(log => log.timestamp <= toDate);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    this.saveAuditLogs();
  }
}

// Singleton instance
export const retentionService = new RetentionService();