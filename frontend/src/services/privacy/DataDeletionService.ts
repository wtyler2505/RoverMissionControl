/**
 * Data Deletion Service
 * Handles secure deletion of user data for GDPR compliance (Right to Erasure)
 */

import Dexie from 'dexie';
import { ConsentManager } from './ConsentManager';
import { AlertPersistenceService, PersistedAlert } from '../persistence/AlertPersistenceService';
import { RetentionService } from '../retention/RetentionService';

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  requestedBy: string;
  deletionType: 'specific_alerts' | 'category_data' | 'complete_erasure' | 'consent_withdrawal';
  scope: DataDeletionScope;
  status: 'pending' | 'verification_required' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  completedAt?: Date;
  errorMessage?: string;
  verificationRequired: boolean;
  verifiedAt?: Date;
  verificationMethod?: 'password' | 'email' | 'sms' | 'biometric' | 'admin_override';
  confirmationCode?: string;
  receipt?: DeletionReceipt;
  cascade: boolean; // Whether to delete related data
  dryRun: boolean; // Preview what would be deleted
  legalBasis: 'gdpr_art17' | 'consent_withdrawal' | 'user_request';
}

export interface DataDeletionScope {
  deleteAlerts: boolean;
  deleteConsents: boolean;
  deleteRetentionData: boolean;
  deleteAuditLogs: boolean;
  deleteDeviceData: boolean;
  deleteAllUserData: boolean;
  specificAlertIds?: string[];
  alertCriteria?: {
    priorities?: string[];
    dateRange?: { from: Date; to: Date };
    acknowledgedOnly?: boolean;
    dismissedOnly?: boolean;
  };
  consentCategories?: string[];
  preserveRequired?: boolean; // Keep legally required data
}

export interface DeletionReceipt {
  receiptId: string;
  requestId: string;
  userId: string;
  deletedAt: Date;
  deletedBy: string;
  scope: DataDeletionScope;
  summary: {
    alertsDeleted: number;
    consentsDeleted: number;
    auditLogsDeleted: number;
    devicesDeleted: number;
    totalRecordsDeleted: number;
    retainedRecords: {
      alerts: number;
      consents: number;
      auditLogs: number;
      reason: string;
    };
  };
  verification: {
    method: string;
    timestamp: Date;
    ipAddress?: string;
  };
  legalCompliance: {
    basis: string;
    retentionOverrides: string[];
    dataSubjectRights: string[];
  };
  integrity: {
    checksum: string;
    algorithm: 'SHA-256';
  };
}

export interface DeletionAuditLog {
  id: string;
  deletionRequestId: string;
  action: 'deletion_requested' | 'verification_completed' | 'data_deleted' | 'deletion_completed' | 'deletion_failed';
  timestamp: Date;
  userId: string;
  details: {
    recordType?: string;
    recordId?: string;
    recordCount?: number;
    reason?: string;
    error?: string;
    cascade?: boolean;
  };
  ipAddress?: string;
  userAgent?: string;
}

export interface DeletionPreview {
  requestId: string;
  scope: DataDeletionScope;
  estimatedDeletion: {
    alerts: {
      count: number;
      byPriority: Record<string, number>;
      dateRange: { earliest: Date; latest: Date };
      retainedCount: number;
      retentionReasons: string[];
    };
    consents: {
      count: number;
      categories: string[];
      retainedCount: number;
      retentionReasons: string[];
    };
    auditLogs: {
      count: number;
      dateRange: { earliest: Date; latest: Date };
      retainedCount: number;
      retentionReasons: string[];
    };
    devices: {
      count: number;
      deviceIds: string[];
    };
  };
  warnings: string[];
  legalRestrictions: string[];
  confirmationRequired: boolean;
}

class DataDeletionDatabase extends Dexie {
  deletionRequests!: Dexie.Table<DataDeletionRequest>;
  deletionReceipts!: Dexie.Table<DeletionReceipt>;
  deletionAuditLog!: Dexie.Table<DeletionAuditLog>;

  constructor() {
    super('DataDeletionDB');
    
    this.version(1).stores({
      deletionRequests: '++id, userId, requestedAt, status, deletionType, completedAt',
      deletionReceipts: '++receiptId, requestId, userId, deletedAt',
      deletionAuditLog: '++id, deletionRequestId, timestamp, userId, action'
    });
  }
}

export class DataDeletionService {
  private db: DataDeletionDatabase;
  private consentManager: ConsentManager;
  private alertPersistence: AlertPersistenceService;
  private retentionService: RetentionService;
  private currentUserId: string;

  constructor(
    consentManager: ConsentManager,
    alertPersistence: AlertPersistenceService,
    retentionService: RetentionService,
    userId: string = 'anonymous'
  ) {
    this.db = new DataDeletionDatabase();
    this.consentManager = consentManager;
    this.alertPersistence = alertPersistence;
    this.retentionService = retentionService;
    this.currentUserId = userId;
  }

  /**
   * Initialize the deletion service
   */
  async initialize(): Promise<void> {
    try {
      await this.db.open();
      console.log('Data Deletion Service initialized');
    } catch (error) {
      console.error('Failed to initialize Data Deletion Service:', error);
      throw error;
    }
  }

  /**
   * Request data deletion with preview
   */
  async requestDataDeletion(
    scope: DataDeletionScope,
    requestedBy: string,
    deletionType: DataDeletionRequest['deletionType'] = 'specific_alerts',
    legalBasis: 'gdpr_art17' | 'consent_withdrawal' | 'user_request' = 'user_request',
    cascade: boolean = false
  ): Promise<{ request: DataDeletionRequest; preview: DeletionPreview }> {
    try {
      const now = new Date();
      const requestId = this.generateRequestId();
      
      const request: DataDeletionRequest = {
        id: requestId,
        userId: this.currentUserId,
        requestedAt: now,
        requestedBy,
        deletionType,
        scope,
        status: 'pending',
        progress: 0,
        verificationRequired: this.requiresVerification(deletionType, scope),
        cascade,
        dryRun: false,
        legalBasis,
        confirmationCode: this.generateConfirmationCode()
      };

      // Generate preview
      const preview = await this.generateDeletionPreview(requestId, scope);

      // Update status based on preview
      if (preview.confirmationRequired || request.verificationRequired) {
        request.status = 'verification_required';
      }

      await this.db.deletionRequests.add(request);

      // Log the request
      await this.addAuditLog(requestId, 'deletion_requested', {
        deletionType,
        cascade,
        recordCount: this.calculateTotalRecordsInPreview(preview)
      });

      console.log(`Data deletion requested: ${requestId}`);
      return { request, preview };
    } catch (error) {
      console.error('Failed to request data deletion:', error);
      throw error;
    }
  }

  /**
   * Generate deletion preview
   */
  async generateDeletionPreview(requestId: string, scope: DataDeletionScope): Promise<DeletionPreview> {
    try {
      const alerts = await this.alertPersistence.getAllAlerts();
      const consents = await this.consentManager.getAllConsents();
      const auditLogs = this.retentionService.getAuditLogs();
      const devices = await this.alertPersistence.getDevices();

      // Calculate what would be deleted
      const alertsToDelete = this.filterAlertsForDeletion(alerts, scope);
      const consentsToDelete = this.filterConsentsForDeletion(consents, scope);
      const auditLogsToDelete = this.filterAuditLogsForDeletion(auditLogs, scope);
      const devicesToDelete = scope.deleteDeviceData ? devices : [];

      // Calculate retention restrictions
      const alertRetentionReasons = this.getAlertRetentionReasons(alertsToDelete);
      const consentRetentionReasons = this.getConsentRetentionReasons(consentsToDelete, scope);
      const auditRetentionReasons = this.getAuditLogRetentionReasons(auditLogsToDelete);

      const retainedAlerts = alertsToDelete.filter(alert => 
        this.hasRetentionRestriction(alert)
      );
      const retainedConsents = scope.preserveRequired ? 
        consentsToDelete.filter(consent => this.isConsentRequired(consent)) : [];
      const retainedAuditLogs = auditLogsToDelete.filter(log => 
        this.hasAuditLogRetentionRestriction(log)
      );

      const warnings = this.generateDeletionWarnings(scope, {
        alertsToDelete: alertsToDelete.length,
        retainedAlerts: retainedAlerts.length
      });

      const legalRestrictions = this.getLegalRestrictions(scope);

      return {
        requestId,
        scope,
        estimatedDeletion: {
          alerts: {
            count: alertsToDelete.length - retainedAlerts.length,
            byPriority: this.countByPriority(alertsToDelete.filter(a => !this.hasRetentionRestriction(a))),
            dateRange: this.getDateRange(alertsToDelete),
            retainedCount: retainedAlerts.length,
            retentionReasons: alertRetentionReasons
          },
          consents: {
            count: consentsToDelete.length - retainedConsents.length,
            categories: Object.keys(consentsToDelete),
            retainedCount: retainedConsents.length,
            retentionReasons: consentRetentionReasons
          },
          auditLogs: {
            count: auditLogsToDelete.length - retainedAuditLogs.length,
            dateRange: this.getAuditLogDateRange(auditLogsToDelete),
            retainedCount: retainedAuditLogs.length,
            retentionReasons: auditRetentionReasons
          },
          devices: {
            count: devicesToDelete.length,
            deviceIds: devicesToDelete.map(d => d.deviceId)
          }
        },
        warnings,
        legalRestrictions,
        confirmationRequired: this.requiresConfirmation(scope)
      };
    } catch (error) {
      console.error('Failed to generate deletion preview:', error);
      throw error;
    }
  }

  /**
   * Verify deletion request
   */
  async verifyDeletionRequest(
    requestId: string,
    verificationData: {
      method: 'password' | 'email' | 'sms' | 'biometric' | 'admin_override';
      credential: string;
      confirmationCode?: string;
    }
  ): Promise<boolean> {
    try {
      const request = await this.db.deletionRequests.get(requestId);
      if (!request) {
        throw new Error('Deletion request not found');
      }

      if (request.status !== 'verification_required') {
        throw new Error('Request does not require verification');
      }

      // Verify confirmation code if required
      if (request.confirmationCode && verificationData.confirmationCode !== request.confirmationCode) {
        await this.addAuditLog(requestId, 'verification_completed', {
          success: false,
          reason: 'Invalid confirmation code'
        });
        return false;
      }

      // Validate credentials
      const isValid = await this.validateCredential(verificationData);
      
      if (isValid) {
        await this.db.deletionRequests.update(requestId, {
          verifiedAt: new Date(),
          verificationMethod: verificationData.method,
          status: 'processing'
        });

        await this.addAuditLog(requestId, 'verification_completed', {
          method: verificationData.method,
          success: true
        });

        // Start the deletion process
        this.processDeletion(requestId);
        return true;
      } else {
        await this.addAuditLog(requestId, 'verification_completed', {
          method: verificationData.method,
          success: false,
          reason: 'Invalid credentials'
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to verify deletion request:', error);
      throw error;
    }
  }

  /**
   * Process data deletion
   */
  private async processDeletion(requestId: string): Promise<void> {
    try {
      const request = await this.db.deletionRequests.get(requestId);
      if (!request) {
        throw new Error('Deletion request not found');
      }

      await this.updateProgress(requestId, 10, 'Initializing deletion...');

      let deletedCounts = {
        alerts: 0,
        consents: 0,
        auditLogs: 0,
        devices: 0
      };

      let retainedCounts = {
        alerts: 0,
        consents: 0,
        auditLogs: 0
      };

      let retentionReason = '';

      // Delete alerts
      if (request.scope.deleteAlerts || request.scope.deleteAllUserData) {
        await this.updateProgress(requestId, 20, 'Deleting alert data...');
        const result = await this.deleteAlerts(requestId, request.scope);
        deletedCounts.alerts = result.deleted;
        retainedCounts.alerts = result.retained;
        if (result.retained > 0) {
          retentionReason = 'Legal retention requirements';
        }
      }

      // Delete consents
      if (request.scope.deleteConsents || request.scope.deleteAllUserData) {
        await this.updateProgress(requestId, 40, 'Deleting consent data...');
        const result = await this.deleteConsents(requestId, request.scope);
        deletedCounts.consents = result.deleted;
        retainedCounts.consents = result.retained;
      }

      // Delete audit logs
      if (request.scope.deleteAuditLogs || request.scope.deleteAllUserData) {
        await this.updateProgress(requestId, 60, 'Deleting audit logs...');
        const result = await this.deleteAuditLogs(requestId, request.scope);
        deletedCounts.auditLogs = result.deleted;
        retainedCounts.auditLogs = result.retained;
      }

      // Delete device data
      if (request.scope.deleteDeviceData || request.scope.deleteAllUserData) {
        await this.updateProgress(requestId, 80, 'Deleting device data...');
        deletedCounts.devices = await this.deleteDeviceData(requestId);
      }

      await this.updateProgress(requestId, 90, 'Generating receipt...');

      // Generate deletion receipt
      const receipt = await this.generateDeletionReceipt(request, deletedCounts, retainedCounts, retentionReason);

      await this.db.deletionRequests.update(requestId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        receipt
      });

      await this.db.deletionReceipts.add(receipt);

      await this.addAuditLog(requestId, 'deletion_completed', {
        totalDeleted: Object.values(deletedCounts).reduce((sum, count) => sum + count, 0),
        totalRetained: Object.values(retainedCounts).reduce((sum, count) => sum + count, 0)
      });

      await this.updateProgress(requestId, 100, 'Deletion completed successfully');

    } catch (error) {
      console.error('Failed to process deletion:', error);
      
      await this.db.deletionRequests.update(requestId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.addAuditLog(requestId, 'deletion_failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete alerts based on scope
   */
  private async deleteAlerts(requestId: string, scope: DataDeletionScope): Promise<{ deleted: number; retained: number }> {
    try {
      const alerts = await this.alertPersistence.getAllAlerts();
      const alertsToDelete = this.filterAlertsForDeletion(alerts, scope);
      
      let deleted = 0;
      let retained = 0;

      for (const alert of alertsToDelete) {
        if (this.hasRetentionRestriction(alert)) {
          retained++;
          continue;
        }

        await this.alertPersistence.deleteAlert(alert.id);
        
        await this.addAuditLog(requestId, 'data_deleted', {
          recordType: 'alert',
          recordId: alert.id,
          cascade: scope.deleteAllUserData
        });

        deleted++;
      }

      return { deleted, retained };
    } catch (error) {
      console.error('Failed to delete alerts:', error);
      throw error;
    }
  }

  /**
   * Delete consent data
   */
  private async deleteConsents(requestId: string, scope: DataDeletionScope): Promise<{ deleted: number; retained: number }> {
    try {
      if (scope.deleteAllUserData && !scope.preserveRequired) {
        // Complete consent data deletion
        await this.consentManager.deleteAllConsentData();
        
        await this.addAuditLog(requestId, 'data_deleted', {
          recordType: 'consent',
          recordId: 'all',
          recordCount: 1
        });

        return { deleted: 1, retained: 0 };
      } else {
        // Selective consent withdrawal
        const consents = await this.consentManager.getAllConsents();
        const categoriesToDelete = scope.consentCategories || [];
        
        let deleted = 0;
        let retained = 0;

        for (const category of categoriesToDelete) {
          if (this.isConsentRequired(category) && scope.preserveRequired) {
            retained++;
            continue;
          }

          await this.consentManager.updateConsent(category as any, false, 'withdrawal');
          deleted++;
        }

        return { deleted, retained };
      }
    } catch (error) {
      console.error('Failed to delete consents:', error);
      throw error;
    }
  }

  /**
   * Delete audit logs
   */
  private async deleteAuditLogs(requestId: string, scope: DataDeletionScope): Promise<{ deleted: number; retained: number }> {
    try {
      // Note: In real implementation, audit logs may have legal retention requirements
      // that prevent deletion. This is a simplified implementation.
      
      if (scope.deleteAllUserData) {
        // This would typically not be allowed for audit logs
        return { deleted: 0, retained: 1 };
      }

      return { deleted: 0, retained: 0 };
    } catch (error) {
      console.error('Failed to delete audit logs:', error);
      throw error;
    }
  }

  /**
   * Delete device data
   */
  private async deleteDeviceData(requestId: string): Promise<number> {
    try {
      const devices = await this.alertPersistence.getDevices();
      
      for (const device of devices) {
        await this.alertPersistence.removeDevice(device.deviceId);
        
        await this.addAuditLog(requestId, 'data_deleted', {
          recordType: 'device',
          recordId: device.deviceId
        });
      }

      return devices.length;
    } catch (error) {
      console.error('Failed to delete device data:', error);
      throw error;
    }
  }

  /**
   * Generate deletion receipt
   */
  private async generateDeletionReceipt(
    request: DataDeletionRequest,
    deletedCounts: any,
    retainedCounts: any,
    retentionReason: string
  ): Promise<DeletionReceipt> {
    const now = new Date();
    const totalDeleted = Object.values(deletedCounts).reduce((sum: number, count) => sum + (count as number), 0);
    
    const receipt: DeletionReceipt = {
      receiptId: this.generateReceiptId(),
      requestId: request.id,
      userId: this.currentUserId,
      deletedAt: now,
      deletedBy: request.requestedBy,
      scope: request.scope,
      summary: {
        alertsDeleted: deletedCounts.alerts,
        consentsDeleted: deletedCounts.consents,
        auditLogsDeleted: deletedCounts.auditLogs,
        devicesDeleted: deletedCounts.devices,
        totalRecordsDeleted: totalDeleted,
        retainedRecords: {
          alerts: retainedCounts.alerts,
          consents: retainedCounts.consents,
          auditLogs: retainedCounts.auditLogs,
          reason: retentionReason
        }
      },
      verification: {
        method: request.verificationMethod || 'none',
        timestamp: request.verifiedAt || now
      },
      legalCompliance: {
        basis: request.legalBasis,
        retentionOverrides: retentionReason ? [retentionReason] : [],
        dataSubjectRights: ['right_to_erasure']
      },
      integrity: {
        checksum: '',
        algorithm: 'SHA-256'
      }
    };

    // Calculate integrity checksum
    const receiptString = JSON.stringify({ ...receipt, integrity: undefined });
    receipt.integrity.checksum = await this.calculateChecksum(receiptString);

    return receipt;
  }

  /**
   * Get deletion request status
   */
  async getDeletionStatus(requestId: string): Promise<DataDeletionRequest | null> {
    try {
      return await this.db.deletionRequests.get(requestId) || null;
    } catch (error) {
      console.error('Failed to get deletion status:', error);
      return null;
    }
  }

  /**
   * Get deletion receipt
   */
  async getDeletionReceipt(receiptId: string): Promise<DeletionReceipt | null> {
    try {
      return await this.db.deletionReceipts.get(receiptId) || null;
    } catch (error) {
      console.error('Failed to get deletion receipt:', error);
      return null;
    }
  }

  /**
   * Get user's deletion history
   */
  async getUserDeletionHistory(limit: number = 10): Promise<DataDeletionRequest[]> {
    try {
      return await this.db.deletionRequests
        .where('userId')
        .equals(this.currentUserId)
        .orderBy('requestedAt')
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Failed to get deletion history:', error);
      return [];
    }
  }

  /**
   * Cancel deletion request
   */
  async cancelDeletionRequest(requestId: string): Promise<void> {
    try {
      const request = await this.db.deletionRequests.get(requestId);
      if (!request) {
        throw new Error('Deletion request not found');
      }

      if (request.status === 'completed') {
        throw new Error('Cannot cancel completed deletion');
      }

      if (request.status === 'processing') {
        throw new Error('Cannot cancel deletion in progress');
      }

      await this.db.deletionRequests.update(requestId, {
        status: 'cancelled'
      });

      await this.addAuditLog(requestId, 'deletion_completed', {
        cancelled: true
      });
    } catch (error) {
      console.error('Failed to cancel deletion request:', error);
      throw error;
    }
  }

  // Utility methods for filtering and validation
  
  private filterAlertsForDeletion(alerts: PersistedAlert[], scope: DataDeletionScope): PersistedAlert[] {
    if (scope.deleteAllUserData) {
      return alerts;
    }

    let filtered = alerts;

    if (scope.specificAlertIds) {
      filtered = filtered.filter(alert => scope.specificAlertIds!.includes(alert.id));
    }

    if (scope.alertCriteria) {
      const { priorities, dateRange, acknowledgedOnly, dismissedOnly } = scope.alertCriteria;
      
      if (priorities) {
        filtered = filtered.filter(alert => priorities.includes(alert.priority));
      }
      
      if (dateRange) {
        filtered = filtered.filter(alert => 
          alert.timestamp >= dateRange.from && alert.timestamp <= dateRange.to
        );
      }
      
      if (acknowledgedOnly) {
        filtered = filtered.filter(alert => alert.acknowledged);
      }
      
      if (dismissedOnly) {
        filtered = filtered.filter(alert => alert.dismissedAt !== undefined);
      }
    }

    return filtered;
  }

  private filterConsentsForDeletion(consents: Record<string, boolean>, scope: DataDeletionScope): string[] {
    if (scope.deleteAllUserData) {
      return Object.keys(consents);
    }

    return scope.consentCategories || [];
  }

  private filterAuditLogsForDeletion(auditLogs: any[], scope: DataDeletionScope): any[] {
    if (scope.deleteAllUserData) {
      return auditLogs;
    }

    return [];
  }

  private hasRetentionRestriction(alert: PersistedAlert): boolean {
    // Check for legal holds or critical priority retention requirements
    const retentionData = alert.metadata?.retention;
    
    if (retentionData?.legalHold?.enabled) {
      return true;
    }

    if (alert.priority === 'critical') {
      return true; // Critical alerts may have legal retention requirements
    }

    return false;
  }

  private isConsentRequired(consent: string): boolean {
    const config = this.consentManager.getConsentConfiguration(consent as any);
    return config?.required || false;
  }

  private hasAuditLogRetentionRestriction(log: any): boolean {
    // Audit logs typically have mandatory retention periods
    return true;
  }

  private requiresVerification(deletionType: DataDeletionRequest['deletionType'], scope: DataDeletionScope): boolean {
    return deletionType === 'complete_erasure' || scope.deleteAllUserData;
  }

  private requiresConfirmation(scope: DataDeletionScope): boolean {
    return scope.deleteAllUserData || scope.deleteAuditLogs;
  }

  private generateDeletionWarnings(scope: DataDeletionScope, stats: any): string[] {
    const warnings: string[] = [];

    if (scope.deleteAllUserData) {
      warnings.push('This will permanently delete ALL your data and cannot be undone.');
    }

    if (stats.retainedAlerts > 0) {
      warnings.push(`${stats.retainedAlerts} alerts will be retained due to legal requirements.`);
    }

    if (scope.deleteAuditLogs) {
      warnings.push('Deleting audit logs may not be permitted for compliance reasons.');
    }

    return warnings;
  }

  private getLegalRestrictions(scope: DataDeletionScope): string[] {
    const restrictions: string[] = [];

    if (scope.deleteAuditLogs) {
      restrictions.push('Audit logs must be retained for 7 years for compliance.');
    }

    if (scope.deleteAllUserData) {
      restrictions.push('Some data may be retained for legal or safety requirements.');
    }

    return restrictions;
  }

  private getAlertRetentionReasons(alerts: PersistedAlert[]): string[] {
    const reasons = new Set<string>();
    
    alerts.forEach(alert => {
      if (alert.metadata?.retention?.legalHold?.enabled) {
        reasons.add('Legal hold');
      }
      if (alert.priority === 'critical') {
        reasons.add('Safety-critical data retention');
      }
    });

    return Array.from(reasons);
  }

  private getConsentRetentionReasons(consents: string[], scope: DataDeletionScope): string[] {
    const reasons: string[] = [];
    
    if (scope.preserveRequired) {
      reasons.push('Required consents for app functionality');
    }

    return reasons;
  }

  private getAuditLogRetentionReasons(logs: any[]): string[] {
    return ['Regulatory compliance', 'Legal audit requirements'];
  }

  private countByPriority(alerts: PersistedAlert[]): Record<string, number> {
    const counts: Record<string, number> = {};
    alerts.forEach(alert => {
      counts[alert.priority] = (counts[alert.priority] || 0) + 1;
    });
    return counts;
  }

  private getDateRange(alerts: PersistedAlert[]): { earliest: Date; latest: Date } {
    if (alerts.length === 0) {
      const now = new Date();
      return { earliest: now, latest: now };
    }

    const timestamps = alerts.map(a => a.timestamp.getTime());
    return {
      earliest: new Date(Math.min(...timestamps)),
      latest: new Date(Math.max(...timestamps))
    };
  }

  private getAuditLogDateRange(logs: any[]): { earliest: Date; latest: Date } {
    if (logs.length === 0) {
      const now = new Date();
      return { earliest: now, latest: now };
    }

    const timestamps = logs.map(l => l.timestamp.getTime());
    return {
      earliest: new Date(Math.min(...timestamps)),
      latest: new Date(Math.max(...timestamps))
    };
  }

  private calculateTotalRecordsInPreview(preview: DeletionPreview): number {
    return preview.estimatedDeletion.alerts.count +
           preview.estimatedDeletion.consents.count +
           preview.estimatedDeletion.auditLogs.count +
           preview.estimatedDeletion.devices.count;
  }

  private async updateProgress(requestId: string, progress: number, message?: string): Promise<void> {
    await this.db.deletionRequests.update(requestId, { progress });
    console.log(`Deletion ${requestId}: ${progress}% - ${message || ''}`);
  }

  private async validateCredential(verificationData: any): Promise<boolean> {
    // In real implementation, would validate against actual user credentials
    return verificationData.credential.length > 0;
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async addAuditLog(requestId: string, action: DeletionAuditLog['action'], details: any): Promise<void> {
    await this.db.deletionAuditLog.add({
      id: this.generateId(),
      deletionRequestId: requestId,
      action,
      timestamp: new Date(),
      userId: this.currentUserId,
      details,
      userAgent: navigator.userAgent
    });
  }

  private generateRequestId(): string {
    return `deletion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReceiptId(): string {
    return `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConfirmationCode(): string {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}