/**
 * Privacy-Aware Alert Service
 * Wraps the alert persistence service with privacy consent checks
 */

import { AlertPersistenceService, PersistedAlert } from '../persistence/AlertPersistenceService';
import { ConsentManager, ConsentCategory, consentManager } from './ConsentManager';
import { AlertPriority } from '../../theme/alertPriorities';

export interface PrivacyAwareAlertOptions {
  respectConsent?: boolean;
  requireExplicitConsent?: boolean;
  logDataAccess?: boolean;
}

export class PrivacyAwareAlertService {
  private alertService: AlertPersistenceService;
  private consentManager: ConsentManager;
  private defaultOptions: PrivacyAwareAlertOptions = {
    respectConsent: true,
    requireExplicitConsent: false,
    logDataAccess: true
  };

  constructor(
    alertService: AlertPersistenceService,
    consentManager: ConsentManager = consentManager
  ) {
    this.alertService = alertService;
    this.consentManager = consentManager;
  }

  /**
   * Initialize the privacy-aware alert service
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.alertService.initialize(),
        this.consentManager.initialize()
      ]);
      console.log('Privacy-aware alert service initialized');
    } catch (error) {
      console.error('Failed to initialize privacy-aware alert service:', error);
      throw error;
    }
  }

  /**
   * Store an alert with privacy consent validation
   */
  async storeAlert(
    alert: Omit<PersistedAlert, 'deviceId' | 'sessionId' | 'timestamp' | 'lastModified' | 'version'>,
    options: PrivacyAwareAlertOptions = {}
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    // Check if we should respect consent
    if (opts.respectConsent) {
      const canStore = await this.canStoreAlert(alert, opts);
      if (!canStore) {
        console.log('Alert storage blocked by privacy consent:', {
          alertId: alert.id,
          priority: alert.priority,
          reason: 'No consent for alert storage'
        });
        
        // For critical alerts, we might still want to show them temporarily
        // but not persist them
        if (alert.priority === 'critical') {
          console.warn('Critical alert cannot be persisted due to privacy settings');
        }
        
        return alert.id; // Return the ID but don't actually store
      }
    }

    // Log data access if enabled
    if (opts.logDataAccess) {
      await this.logDataAccess('store', alert.id, {
        priority: alert.priority,
        hasConsent: await this.consentManager.hasConsent('alerts_storage'),
        timestamp: new Date()
      });
    }

    try {
      // Add privacy metadata to the alert
      const privacyEnhancedAlert = await this.addPrivacyMetadata(alert);
      return await this.alertService.storeAlert(privacyEnhancedAlert);
    } catch (error) {
      console.error('Failed to store alert with privacy checks:', error);
      throw error;
    }
  }

  /**
   * Retrieve alerts with privacy filtering
   */
  async getAlerts(
    filter?: Parameters<AlertPersistenceService['getAlerts']>[0],
    options: PrivacyAwareAlertOptions = {}
  ): Promise<PersistedAlert[]> {
    const opts = { ...this.defaultOptions, ...options };

    // Check if we can access stored alerts
    if (opts.respectConsent) {
      const canAccess = await this.consentManager.hasConsent('alerts_storage');
      if (!canAccess && opts.requireExplicitConsent) {
        console.log('Alert access blocked by privacy consent');
        return [];
      }
    }

    // Log data access if enabled
    if (opts.logDataAccess) {
      await this.logDataAccess('retrieve', 'bulk', {
        filter,
        hasConsent: await this.consentManager.hasConsent('alerts_storage'),
        timestamp: new Date()
      });
    }

    try {
      const alerts = await this.alertService.getAlerts(filter);
      
      // Filter alerts based on privacy preferences
      return await this.filterAlertsForPrivacy(alerts, opts);
    } catch (error) {
      console.error('Failed to retrieve alerts with privacy checks:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert with privacy logging
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string,
    options: PrivacyAwareAlertOptions = {}
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    // Check if we can store acknowledgment data
    if (opts.respectConsent) {
      const canStoreAcknowledgment = await this.consentManager.hasConsent('alert_acknowledgment');
      if (!canStoreAcknowledgment) {
        console.log('Alert acknowledgment storage blocked by privacy consent');
        // For compliance reasons, we might still need to track acknowledgments
        // even without explicit consent (legal obligation basis)
        console.warn('Acknowledgment recorded for compliance despite privacy preference');
      }
    }

    // Log data access if enabled
    if (opts.logDataAccess) {
      await this.logDataAccess('acknowledge', alertId, {
        acknowledgedBy,
        hasConsent: await this.consentManager.hasConsent('alert_acknowledgment'),
        timestamp: new Date()
      });
    }

    try {
      await this.alertService.acknowledgeAlert(alertId, acknowledgedBy);
    } catch (error) {
      console.error('Failed to acknowledge alert with privacy checks:', error);
      throw error;
    }
  }

  /**
   * Export user's alert data for GDPR compliance
   */
  async exportUserAlertData(userId?: string): Promise<{
    alerts: PersistedAlert[];
    acknowledgments: any[];
    metadata: {
      exportTimestamp: Date;
      userId?: string;
      deviceId: string;
      consentStatus: Record<ConsentCategory, boolean>;
    };
  }> {
    try {
      // Get all alerts for the user
      const alerts = await this.alertService.getAlerts({
        deviceId: this.alertService.currentDeviceId
      });

      // Get acknowledgment data
      const acknowledgments = alerts
        .filter(alert => alert.acknowledged)
        .map(alert => ({
          alertId: alert.id,
          acknowledgedBy: alert.acknowledgedBy,
          acknowledgedAt: alert.acknowledgedAt,
          message: alert.message,
          priority: alert.priority
        }));

      // Get current consent status
      const consentStatus = await this.consentManager.getAllConsents();

      return {
        alerts,
        acknowledgments,
        metadata: {
          exportTimestamp: new Date(),
          userId,
          deviceId: this.alertService.currentDeviceId,
          consentStatus
        }
      };
    } catch (error) {
      console.error('Failed to export user alert data:', error);
      throw error;
    }
  }

  /**
   * Delete user's alert data for GDPR right to erasure
   */
  async deleteUserAlertData(userId?: string): Promise<{
    deletedAlerts: number;
    deletedAcknowledgments: number;
    timestamp: Date;
  }> {
    try {
      // Get all alerts for the user
      const alerts = await this.alertService.getAlerts({
        deviceId: this.alertService.currentDeviceId
      });

      const deletedAlerts = alerts.length;
      const deletedAcknowledgments = alerts.filter(alert => alert.acknowledged).length;

      // Delete all alerts
      for (const alert of alerts) {
        await this.alertService.removeAlert(alert.id);
      }

      // Log the deletion for audit purposes
      await this.logDataAccess('delete_all', 'user_data', {
        userId,
        deletedAlerts,
        deletedAcknowledgments,
        timestamp: new Date()
      });

      return {
        deletedAlerts,
        deletedAcknowledgments,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to delete user alert data:', error);
      throw error;
    }
  }

  /**
   * Check if an alert can be stored based on privacy consent
   */
  private async canStoreAlert(
    alert: Omit<PersistedAlert, 'deviceId' | 'sessionId' | 'timestamp' | 'lastModified' | 'version'>,
    options: PrivacyAwareAlertOptions
  ): Promise<boolean> {
    // Critical alerts might have different rules (legal obligation)
    if (alert.priority === 'critical') {
      // Check if we have consent for acknowledgment tracking (required for critical alerts)
      return await this.consentManager.hasConsent('alert_acknowledgment');
    }

    // For non-critical alerts, check general alert storage consent
    return await this.consentManager.hasConsent('alerts_storage');
  }

  /**
   * Add privacy metadata to an alert
   */
  private async addPrivacyMetadata(
    alert: Omit<PersistedAlert, 'deviceId' | 'sessionId' | 'timestamp' | 'lastModified' | 'version'>
  ): Promise<typeof alert> {
    const consentStatus = await this.consentManager.getAllConsents();
    
    return {
      ...alert,
      metadata: {
        ...alert.metadata,
        privacy: {
          consentAtStorage: consentStatus,
          policyVersion: this.consentManager.policyVersion,
          storageTimestamp: new Date()
        }
      }
    };
  }

  /**
   * Filter alerts based on privacy preferences
   */
  private async filterAlertsForPrivacy(
    alerts: PersistedAlert[],
    options: PrivacyAwareAlertOptions
  ): Promise<PersistedAlert[]> {
    if (!options.respectConsent) {
      return alerts;
    }

    const hasStorageConsent = await this.consentManager.hasConsent('alerts_storage');
    const hasAcknowledgmentConsent = await this.consentManager.hasConsent('alert_acknowledgment');

    return alerts.filter(alert => {
      // Always allow critical alerts with acknowledgment tracking
      if (alert.priority === 'critical' && hasAcknowledgmentConsent) {
        return true;
      }

      // Filter based on general storage consent
      return hasStorageConsent;
    });
  }

  /**
   * Log data access for audit purposes
   */
  private async logDataAccess(
    operation: string,
    target: string,
    metadata: any
  ): Promise<void> {
    // This would typically integrate with a more comprehensive audit logging system
    console.log('Privacy audit log:', {
      operation,
      target,
      timestamp: new Date(),
      userId: this.consentManager.userId,
      deviceId: this.consentManager.deviceId,
      ...metadata
    });

    // In a real implementation, this might write to a secure audit log database
    // or send to a compliance monitoring service
  }

  // Delegate other methods to the underlying alert service
  async dismissAlert(alertId: string): Promise<void> {
    return this.alertService.dismissAlert(alertId);
  }

  async removeAlert(alertId: string): Promise<void> {
    return this.alertService.removeAlert(alertId);
  }

  async getUnacknowledgedAlerts(): Promise<PersistedAlert[]> {
    return this.alertService.getUnacknowledgedAlerts();
  }

  async getSyncStats() {
    return this.alertService.getSyncStats();
  }

  async cleanupExpiredAlerts(): Promise<number> {
    return this.alertService.cleanupExpiredAlerts();
  }

  async close(): Promise<void> {
    await Promise.all([
      this.alertService.close(),
      this.consentManager.close()
    ]);
  }

  // Getters
  get currentDeviceId(): string {
    return this.alertService.currentDeviceId;
  }

  get currentSessionId(): string {
    return this.alertService.currentSessionId;
  }
}

// Create a privacy-aware wrapper for the existing alert persistence service
import { alertPersistenceService } from '../persistence/AlertPersistenceService';
export const privacyAwareAlertService = new PrivacyAwareAlertService(
  alertPersistenceService,
  consentManager
);