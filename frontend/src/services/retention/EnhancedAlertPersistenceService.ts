/**
 * Enhanced Alert Persistence Service with Retention Management
 * Extends the base AlertPersistenceService with GDPR-compliant retention features
 */

import { AlertPersistenceService, PersistedAlert } from '../persistence/AlertPersistenceService';
import { RetentionService, retentionService } from './RetentionService';
import { RetentionPolicy, RetentionPeriod, retentionPolicy } from './RetentionPolicy';
import { BackgroundRetentionWorker, getBackgroundRetentionWorker } from './RetentionWorker';
import { AlertPriority } from '../../theme/alertPriorities';

export interface RetentionConfiguration {
  enableAutomaticPurging: boolean;
  purgeInterval: number; // in milliseconds
  enableGracePeriod: boolean;
  enableNotifications: boolean;
  customPolicyId?: string;
}

export interface BulkDeletionResult {
  requested: number;
  deleted: number;
  skipped: number;
  failed: number;
  errors: Array<{ alertId: string; reason: string }>;
  auditLog: string;
}

/**
 * Enhanced Alert Persistence Service with comprehensive retention management
 */
export class EnhancedAlertPersistenceService extends AlertPersistenceService {
  private retentionService: RetentionService;
  private retentionPolicy: RetentionPolicy;
  private backgroundWorker: BackgroundRetentionWorker;
  private retentionConfig: RetentionConfiguration;
  private scheduledPurgeListener?: (event: CustomEvent) => void;

  constructor(
    retentionService: RetentionService = retentionService,
    policy: RetentionPolicy = retentionPolicy
  ) {
    super();
    this.retentionService = retentionService;
    this.retentionPolicy = policy;
    this.backgroundWorker = getBackgroundRetentionWorker(retentionService);
    
    this.retentionConfig = {
      enableAutomaticPurging: true,
      purgeInterval: 24 * 60 * 60 * 1000, // 24 hours
      enableGracePeriod: true,
      enableNotifications: true
    };

    this.setupScheduledPurgeListener();
  }

  /**
   * Initialize the enhanced persistence service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize base service
      await super.initialize();
      
      // Initialize background worker
      await this.backgroundWorker.initialize();
      
      // Update existing alerts with retention metadata
      await this.migrateExistingAlerts();
      
      // Perform initial cleanup
      await this.performRetentionCleanup();
      
      console.log('Enhanced alert persistence service with retention initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced alert persistence service:', error);
      throw error;
    }
  }

  /**
   * Store an alert with automatic retention metadata
   */
  async storeAlert(
    alert: Omit<PersistedAlert, 'deviceId' | 'sessionId' | 'timestamp' | 'lastModified' | 'version'>,
    retentionOptions?: {
      customPolicyId?: string;
      customPeriod?: RetentionPeriod;
      bypassRetention?: boolean;
    }
  ): Promise<string> {
    try {
      // Add retention metadata unless bypassed
      let enhancedAlert = alert;
      if (!retentionOptions?.bypassRetention) {
        enhancedAlert = this.retentionService.addRetentionMetadata(
          alert as PersistedAlert,
          retentionOptions?.customPolicyId,
          retentionOptions?.customPeriod
        );
      }

      // Store using base service
      const alertId = await super.storeAlert(enhancedAlert);
      
      console.log(`Alert stored with retention metadata:`, {
        alertId,
        priority: alert.priority,
        expiresAt: enhancedAlert.metadata?.retention?.expiresAt
      });

      return alertId;
    } catch (error) {
      console.error('Failed to store alert with retention:', error);
      throw error;
    }
  }

  /**
   * Retrieve alerts with automatic retention status updates
   */
  async getAlerts(filter?: Parameters<AlertPersistenceService['getAlerts']>[0]): Promise<PersistedAlert[]> {
    try {
      const alerts = await super.getAlerts(filter);
      
      // Update retention status for all alerts
      const updatedAlerts = alerts.map(alert => 
        this.retentionService.updateRetentionStatus(alert)
      );

      // Filter out alerts that should be hidden due to retention
      return this.filterByRetentionStatus(updatedAlerts, filter);
    } catch (error) {
      console.error('Failed to retrieve alerts with retention:', error);
      throw error;
    }
  }

  /**
   * Perform immediate retention cleanup
   */
  async performRetentionCleanup(): Promise<BulkDeletionResult> {
    try {
      console.log('Starting retention cleanup...');
      
      // Get all alerts for processing
      const allAlerts = await super.getAlerts();
      
      // Run purge operation through background worker
      const purgeResult = await this.backgroundWorker.runPurge(allAlerts);
      
      // Delete alerts that should be removed
      const deletionResults = await this.performBulkDeletion(purgeResult.alertsToDelete || []);
      
      const result: BulkDeletionResult = {
        requested: purgeResult.deletedCount,
        deleted: deletionResults.successful,
        skipped: purgeResult.alertsInGracePeriod + purgeResult.alertsOnLegalHold,
        failed: deletionResults.failed,
        errors: deletionResults.errors,
        auditLog: `Retention cleanup completed: ${deletionResults.successful} deleted, ${deletionResults.failed} failed, processing time: ${purgeResult.processingTime}ms`
      };

      console.log('Retention cleanup completed:', result);
      return result;
    } catch (error) {
      console.error('Retention cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Place legal hold on an alert
   */
  async placeLegalHold(
    alertId: string,
    placedBy: string,
    reason: string,
    reference?: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const alerts = await super.getAlerts();
      const alert = alerts.find(a => a.id === alertId);
      
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      const updatedAlert = this.retentionService.placeLegalHold(
        alert,
        placedBy,
        reason,
        reference,
        expiresAt
      );

      // Update the alert in storage
      await this.updateAlertMetadata(alertId, updatedAlert.metadata);
      
      console.log(`Legal hold placed on alert ${alertId} by ${placedBy}`);
    } catch (error) {
      console.error('Failed to place legal hold:', error);
      throw error;
    }
  }

  /**
   * Remove legal hold from an alert
   */
  async removeLegalHold(alertId: string, removedBy: string, reason?: string): Promise<void> {
    try {
      const alerts = await super.getAlerts();
      const alert = alerts.find(a => a.id === alertId);
      
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      const updatedAlert = this.retentionService.removeLegalHold(alert, removedBy, reason);

      // Update the alert in storage
      await this.updateAlertMetadata(alertId, updatedAlert.metadata);
      
      console.log(`Legal hold removed from alert ${alertId} by ${removedBy}`);
    } catch (error) {
      console.error('Failed to remove legal hold:', error);
      throw error;
    }
  }

  /**
   * Get retention statistics
   */
  async getRetentionStats(): Promise<any> {
    try {
      const alerts = await super.getAlerts();
      const stats = await this.backgroundWorker.getStats(alerts);
      
      return {
        ...stats.stats,
        workerStatus: this.backgroundWorker.getStatus(),
        lastCleanup: this.getLastCleanupTimestamp(),
        nextScheduledCleanup: this.getNextScheduledCleanup()
      };
    } catch (error) {
      console.error('Failed to get retention stats:', error);
      throw error;
    }
  }

  /**
   * Export alerts for GDPR compliance
   */
  async exportAlertsForCompliance(options?: {
    includeDeleted?: boolean;
    includeAuditLogs?: boolean;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    alerts: PersistedAlert[];
    auditLogs: any[];
    metadata: {
      exportTimestamp: Date;
      totalAlerts: number;
      retentionPolicyVersion: string;
    };
  }> {
    try {
      const alerts = await super.getAlerts();
      let auditLogs: any[] = [];

      if (options?.includeAuditLogs) {
        auditLogs = this.retentionService.exportAuditLogs(
          undefined,
          options.fromDate,
          options.toDate
        );
      }

      return {
        alerts,
        auditLogs,
        metadata: {
          exportTimestamp: new Date(),
          totalAlerts: alerts.length,
          retentionPolicyVersion: this.retentionPolicy.getCurrentPolicy().version
        }
      };
    } catch (error) {
      console.error('Failed to export alerts for compliance:', error);
      throw error;
    }
  }

  /**
   * Update retention configuration
   */
  updateRetentionConfiguration(config: Partial<RetentionConfiguration>): void {
    this.retentionConfig = { ...this.retentionConfig, ...config };
    
    // Save to localStorage
    localStorage.setItem('rover-retention-config', JSON.stringify(this.retentionConfig));
    
    console.log('Retention configuration updated:', this.retentionConfig);
  }

  /**
   * Get current retention configuration
   */
  getRetentionConfiguration(): RetentionConfiguration {
    return { ...this.retentionConfig };
  }

  /**
   * Perform bulk deletion with proper error handling
   */
  private async performBulkDeletion(alertIds: string[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ alertId: string; reason: string }>;
  }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ alertId: string; reason: string }>
    };

    for (const alertId of alertIds) {
      try {
        await super.removeAlert(alertId);
        result.successful++;
        
        // Log successful deletion
        console.log(`Alert ${alertId} deleted by retention policy`);
      } catch (error) {
        result.failed++;
        result.errors.push({
          alertId,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
        
        console.error(`Failed to delete alert ${alertId}:`, error);
      }
    }

    return result;
  }

  /**
   * Filter alerts by retention status
   */
  private filterByRetentionStatus(
    alerts: PersistedAlert[],
    filter?: Parameters<AlertPersistenceService['getAlerts']>[0]
  ): PersistedAlert[] {
    // If no specific filter, return all alerts
    if (!filter || !this.retentionConfig.enableAutomaticPurging) {
      return alerts;
    }

    // Filter out alerts that are pending deletion (unless explicitly requested)
    return alerts.filter(alert => {
      const retentionData = alert.metadata?.retention;
      if (!retentionData) return true;
      
      // Always show alerts on legal hold
      if (retentionData.legalHold?.enabled) return true;
      
      // Hide alerts pending deletion unless specifically requested
      return retentionData.retentionStatus !== 'pending_deletion';
    });
  }

  /**
   * Update alert metadata in storage
   */
  private async updateAlertMetadata(alertId: string, metadata: any): Promise<void> {
    try {
      await this.db.alerts.update(alertId, {
        metadata,
        lastModified: new Date(),
        syncStatus: 'pending'
      });
    } catch (error) {
      console.error(`Failed to update metadata for alert ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Migrate existing alerts to include retention metadata
   */
  private async migrateExistingAlerts(): Promise<void> {
    try {
      const alerts = await super.getAlerts();
      let migratedCount = 0;

      for (const alert of alerts) {
        // Skip alerts that already have retention metadata
        if (alert.metadata?.retention) continue;

        // Add retention metadata
        const enhancedAlert = this.retentionService.addRetentionMetadata(alert);
        
        // Update in storage
        await this.updateAlertMetadata(alert.id, enhancedAlert.metadata);
        migratedCount++;
      }

      if (migratedCount > 0) {
        console.log(`Migrated ${migratedCount} alerts to include retention metadata`);
      }
    } catch (error) {
      console.error('Failed to migrate existing alerts:', error);
      // Don't throw - migration failure shouldn't prevent service initialization
    }
  }

  /**
   * Setup listener for scheduled purge events from background worker
   */
  private setupScheduledPurgeListener(): void {
    this.scheduledPurgeListener = async (event: CustomEvent) => {
      try {
        console.log('Scheduled retention purge triggered');
        await this.performRetentionCleanup();
      } catch (error) {
        console.error('Scheduled purge failed:', error);
      }
    };

    window.addEventListener('retention-scheduled-purge', this.scheduledPurgeListener);
  }

  /**
   * Get last cleanup timestamp
   */
  private getLastCleanupTimestamp(): Date | null {
    const stored = localStorage.getItem('rover-last-retention-cleanup');
    return stored ? new Date(stored) : null;
  }

  /**
   * Get next scheduled cleanup time
   */
  private getNextScheduledCleanup(): Date {
    const lastCleanup = this.getLastCleanupTimestamp();
    const baseTime = lastCleanup || new Date();
    return new Date(baseTime.getTime() + this.retentionConfig.purgeInterval);
  }

  /**
   * Close the enhanced service
   */
  async close(): Promise<void> {
    try {
      // Remove event listener
      if (this.scheduledPurgeListener) {
        window.removeEventListener('retention-scheduled-purge', this.scheduledPurgeListener);
      }

      // Stop background worker
      await this.backgroundWorker.stop();

      // Close retention service
      await this.retentionService.close();

      // Close base service
      await super.close();

      console.log('Enhanced alert persistence service closed');
    } catch (error) {
      console.error('Error closing enhanced alert persistence service:', error);
    }
  }
}

// Create singleton instance
export const enhancedAlertPersistenceService = new EnhancedAlertPersistenceService();