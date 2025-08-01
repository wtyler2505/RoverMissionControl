/**
 * Data Export Service
 * Handles comprehensive data export for GDPR compliance (Right to Data Portability)
 */

import Dexie from 'dexie';
import { ConsentManager, ConsentRecord, ConsentPreference } from './ConsentManager';
import { AlertPersistenceService, PersistedAlert } from '../persistence/AlertPersistenceService';
import { RetentionService, RetentionAuditLog } from '../retention/RetentionService';

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  requestedBy: string;
  scope: DataExportScope;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date; // Export download link expiry
  fileSize?: number;
  errorMessage?: string;
  verificationRequired: boolean;
  verifiedAt?: Date;
  verificationMethod?: 'password' | 'email' | 'sms' | 'biometric';
  securityKey?: string; // For download authentication
}

export interface DataExportScope {
  includeAlerts: boolean;
  includeConsents: boolean;
  includeRetentionData: boolean;
  includeAuditLogs: boolean;
  includeMetadata: boolean;
  includeDeviceData: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  alertPriorities?: string[];
  consentCategories?: string[];
}

export interface ExportedData {
  metadata: {
    exportId: string;
    userId: string;
    exportedAt: Date;
    dataVersion: string;
    scope: DataExportScope;
    totalRecords: number;
    fileSize: number;
    integrity: {
      checksum: string;
      algorithm: 'SHA-256';
    };
    exportedBy: string;
    legalBasis: 'gdpr_art15' | 'gdpr_art20' | 'user_request';
  };
  personalData: {
    userId: string;
    deviceId: string;
    sessionIds: string[];
    createdAt: Date;
    lastActiveAt: Date;
  };
  alerts?: {
    records: PersistedAlert[];
    summary: {
      totalAlerts: number;
      byPriority: Record<string, number>;
      dateRange: { earliest: Date; latest: Date };
      acknowledgedCount: number;
      dismissedCount: number;
    };
  };
  consents?: {
    currentConsents: Record<string, boolean>;
    consentHistory: ConsentPreference[];
    policyVersions: string[];
    lastReviewDate?: Date;
    nextReviewDate?: Date;
  };
  retentionData?: {
    auditLogs: RetentionAuditLog[];
    retentionStats: any;
    legalHolds: any[];
  };
  deviceData?: {
    devices: any[];
    syncHistory: any[];
  };
  auditTrail: {
    dataAccess: any[];
    modifications: any[];
    deletions: any[];
  };
}

class DataExportDatabase extends Dexie {
  exportRequests!: Dexie.Table<DataExportRequest>;
  exportAuditLog!: Dexie.Table<{
    id: string;
    exportId: string;
    action: string;
    timestamp: Date;
    userId: string;
    details: any;
  }>;

  constructor() {
    super('DataExportDB');
    
    this.version(1).stores({
      exportRequests: '++id, userId, requestedAt, status, completedAt',
      exportAuditLog: '++id, exportId, timestamp, userId, action'
    });
  }
}

export class DataExportService {
  private db: DataExportDatabase;
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
    this.db = new DataExportDatabase();
    this.consentManager = consentManager;
    this.alertPersistence = alertPersistence;
    this.retentionService = retentionService;
    this.currentUserId = userId;
  }

  /**
   * Initialize the export service
   */
  async initialize(): Promise<void> {
    try {
      await this.db.open();
      console.log('Data Export Service initialized');
    } catch (error) {
      console.error('Failed to initialize Data Export Service:', error);
      throw error;
    }
  }

  /**
   * Request a data export with security verification
   */
  async requestDataExport(
    scope: DataExportScope,
    requestedBy: string,
    legalBasis: 'gdpr_art15' | 'gdpr_art20' | 'user_request' = 'user_request'
  ): Promise<DataExportRequest> {
    try {
      const now = new Date();
      const exportId = this.generateExportId();
      
      const request: DataExportRequest = {
        id: exportId,
        userId: this.currentUserId,
        requestedAt: now,
        requestedBy,
        scope,
        status: 'pending',
        progress: 0,
        verificationRequired: true,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        securityKey: this.generateSecurityKey()
      };

      await this.db.exportRequests.add(request);

      // Log the request
      await this.addAuditLog(exportId, 'export_requested', {
        scope,
        legalBasis,
        requestedBy
      });

      console.log(`Data export requested: ${exportId}`);
      return request;
    } catch (error) {
      console.error('Failed to request data export:', error);
      throw error;
    }
  }

  /**
   * Verify export request with password/authentication
   */
  async verifyExportRequest(
    exportId: string,
    verificationData: {
      method: 'password' | 'email' | 'sms' | 'biometric';
      credential: string;
    }
  ): Promise<boolean> {
    try {
      const request = await this.db.exportRequests.get(exportId);
      if (!request) {
        throw new Error('Export request not found');
      }

      if (request.status !== 'pending') {
        throw new Error('Export request is not pending verification');
      }

      // In a real implementation, this would verify against actual credentials
      const isValid = await this.validateCredential(verificationData);
      
      if (isValid) {
        await this.db.exportRequests.update(exportId, {
          verifiedAt: new Date(),
          verificationMethod: verificationData.method,
          status: 'processing'
        });

        await this.addAuditLog(exportId, 'verification_successful', {
          method: verificationData.method
        });

        // Start the export process
        this.processDataExport(exportId);
        return true;
      } else {
        await this.addAuditLog(exportId, 'verification_failed', {
          method: verificationData.method,
          reason: 'Invalid credentials'
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to verify export request:', error);
      throw error;
    }
  }

  /**
   * Process the data export (async operation)
   */
  private async processDataExport(exportId: string): Promise<void> {
    try {
      const request = await this.db.exportRequests.get(exportId);
      if (!request) {
        throw new Error('Export request not found');
      }

      await this.updateProgress(exportId, 10, 'Initializing export...');

      // Collect all data based on scope
      const exportData: ExportedData = {
        metadata: {
          exportId,
          userId: this.currentUserId,
          exportedAt: new Date(),
          dataVersion: '1.0.0',
          scope: request.scope,
          totalRecords: 0,
          fileSize: 0,
          integrity: {
            checksum: '',
            algorithm: 'SHA-256'
          },
          exportedBy: request.requestedBy,
          legalBasis: 'user_request'
        },
        personalData: await this.collectPersonalData(),
        auditTrail: {
          dataAccess: [],
          modifications: [],
          deletions: []
        }
      };

      let totalRecords = 1; // Personal data

      await this.updateProgress(exportId, 20, 'Collecting alert data...');
      if (request.scope.includeAlerts) {
        exportData.alerts = await this.collectAlertData(request.scope);
        totalRecords += exportData.alerts.records.length;
      }

      await this.updateProgress(exportId, 40, 'Collecting consent data...');
      if (request.scope.includeConsents) {
        exportData.consents = await this.collectConsentData();
        totalRecords += exportData.consents.consentHistory.length;
      }

      await this.updateProgress(exportId, 60, 'Collecting retention data...');
      if (request.scope.includeRetentionData) {
        exportData.retentionData = await this.collectRetentionData(request.scope);
        totalRecords += exportData.retentionData.auditLogs.length;
      }

      await this.updateProgress(exportId, 80, 'Collecting device data...');
      if (request.scope.includeDeviceData) {
        exportData.deviceData = await this.collectDeviceData();
        totalRecords += exportData.deviceData.devices.length;
      }

      await this.updateProgress(exportId, 90, 'Finalizing export...');

      // Calculate integrity checksum
      const dataString = JSON.stringify(exportData);
      exportData.metadata.totalRecords = totalRecords;
      exportData.metadata.fileSize = dataString.length;
      exportData.metadata.integrity.checksum = await this.calculateChecksum(dataString);

      // Store the export data (in real implementation, would be a file)
      const downloadUrl = await this.storeExportData(exportId, exportData);

      await this.db.exportRequests.update(exportId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        downloadUrl,
        fileSize: dataString.length
      });

      await this.addAuditLog(exportId, 'export_completed', {
        totalRecords,
        fileSize: dataString.length
      });

      await this.updateProgress(exportId, 100, 'Export completed successfully');

    } catch (error) {
      console.error('Failed to process data export:', error);
      
      await this.db.exportRequests.update(exportId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.addAuditLog(exportId, 'export_failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get export request status
   */
  async getExportStatus(exportId: string): Promise<DataExportRequest | null> {
    try {
      return await this.db.exportRequests.get(exportId) || null;
    } catch (error) {
      console.error('Failed to get export status:', error);
      return null;
    }
  }

  /**
   * Get user's export history
   */
  async getUserExportHistory(limit: number = 10): Promise<DataExportRequest[]> {
    try {
      return await this.db.exportRequests
        .where('userId')
        .equals(this.currentUserId)
        .orderBy('requestedAt')
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('Failed to get export history:', error);
      return [];
    }
  }

  /**
   * Cancel export request
   */
  async cancelExportRequest(exportId: string): Promise<void> {
    try {
      const request = await this.db.exportRequests.get(exportId);
      if (!request) {
        throw new Error('Export request not found');
      }

      if (request.status === 'completed') {
        throw new Error('Cannot cancel completed export');
      }

      await this.db.exportRequests.update(exportId, {
        status: 'cancelled'
      });

      await this.addAuditLog(exportId, 'export_cancelled', {});
    } catch (error) {
      console.error('Failed to cancel export request:', error);
      throw error;
    }
  }

  /**
   * Download export data
   */
  async downloadExport(exportId: string, securityKey: string): Promise<Blob> {
    try {
      const request = await this.db.exportRequests.get(exportId);
      if (!request) {
        throw new Error('Export request not found');
      }

      if (request.status !== 'completed') {
        throw new Error('Export is not ready for download');
      }

      if (request.securityKey !== securityKey) {
        await this.addAuditLog(exportId, 'download_unauthorized', {
          providedKey: securityKey.substring(0, 8) + '...'
        });
        throw new Error('Invalid security key');
      }

      if (request.expiresAt && new Date() > request.expiresAt) {
        throw new Error('Export has expired');
      }

      // In real implementation, retrieve from secure storage
      const exportData = await this.retrieveExportData(exportId);
      
      await this.addAuditLog(exportId, 'export_downloaded', {});

      return new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
    } catch (error) {
      console.error('Failed to download export:', error);
      throw error;
    }
  }

  /**
   * Collect personal data
   */
  private async collectPersonalData(): Promise<ExportedData['personalData']> {
    const devices = await this.alertPersistence.getDevices();
    const sessions = await this.alertPersistence.getSessionIds();
    
    return {
      userId: this.currentUserId,
      deviceId: this.consentManager.deviceId,
      sessionIds: sessions,
      createdAt: new Date(), // Would be from user registration
      lastActiveAt: new Date()
    };
  }

  /**
   * Collect alert data
   */
  private async collectAlertData(scope: DataExportScope): Promise<NonNullable<ExportedData['alerts']>> {
    const alerts = await this.alertPersistence.getAllAlerts();
    
    // Filter by date range if specified
    let filteredAlerts = alerts;
    if (scope.dateRange) {
      filteredAlerts = alerts.filter(alert => 
        alert.timestamp >= scope.dateRange!.from && 
        alert.timestamp <= scope.dateRange!.to
      );
    }

    // Filter by priorities if specified
    if (scope.alertPriorities && scope.alertPriorities.length > 0) {
      filteredAlerts = filteredAlerts.filter(alert =>
        scope.alertPriorities!.includes(alert.priority)
      );
    }

    const summary = this.calculateAlertSummary(filteredAlerts);

    return {
      records: filteredAlerts,
      summary
    };
  }

  /**
   * Collect consent data
   */
  private async collectConsentData(): Promise<NonNullable<ExportedData['consents']>> {
    const [currentConsents, consentHistory, record] = await Promise.all([
      this.consentManager.getAllConsents(),
      this.consentManager.getConsentHistory(),
      this.consentManager.getCurrentConsentRecord()
    ]);

    const policyVersions = [...new Set(consentHistory.map(h => h.version))];

    return {
      currentConsents,
      consentHistory,
      policyVersions,
      lastReviewDate: record?.lastReviewDate,
      nextReviewDate: record?.nextReviewDate
    };
  }

  /**
   * Collect retention data
   */
  private async collectRetentionData(scope: DataExportScope): Promise<NonNullable<ExportedData['retentionData']>> {
    const auditLogs = this.retentionService.getAuditLogs();
    const alerts = await this.alertPersistence.getAllAlerts();
    const retentionStats = this.retentionService.calculateRetentionStats(alerts);
    const legalHolds = this.retentionService.getAlertsOnLegalHold(alerts);

    return {
      auditLogs,
      retentionStats,
      legalHolds: legalHolds.map(alert => ({
        alertId: alert.id,
        legalHold: alert.metadata?.retention?.legalHold
      }))
    };
  }

  /**
   * Collect device data
   */
  private async collectDeviceData(): Promise<NonNullable<ExportedData['deviceData']>> {
    const devices = await this.alertPersistence.getDevices();
    const syncHistory = await this.alertPersistence.getSyncHistory();

    return {
      devices,
      syncHistory
    };
  }

  /**
   * Calculate alert summary statistics
   */
  private calculateAlertSummary(alerts: PersistedAlert[]): NonNullable<ExportedData['alerts']>['summary'] {
    const byPriority: Record<string, number> = {};
    let acknowledgedCount = 0;
    let dismissedCount = 0;
    let earliest = new Date();
    let latest = new Date(0);

    alerts.forEach(alert => {
      byPriority[alert.priority] = (byPriority[alert.priority] || 0) + 1;
      
      if (alert.acknowledged) acknowledgedCount++;
      if (alert.dismissedAt) dismissedCount++;
      
      if (alert.timestamp < earliest) earliest = alert.timestamp;
      if (alert.timestamp > latest) latest = alert.timestamp;
    });

    return {
      totalAlerts: alerts.length,
      byPriority,
      dateRange: { earliest, latest },
      acknowledgedCount,
      dismissedCount
    };
  }

  /**
   * Update export progress
   */
  private async updateProgress(exportId: string, progress: number, message?: string): Promise<void> {
    await this.db.exportRequests.update(exportId, { progress });
    console.log(`Export ${exportId}: ${progress}% - ${message || ''}`);
  }

  /**
   * Store export data securely
   */
  private async storeExportData(exportId: string, data: ExportedData): Promise<string> {
    // In real implementation, would encrypt and store in secure location
    const dataString = JSON.stringify(data);
    localStorage.setItem(`export-data-${exportId}`, dataString);
    return `download://${exportId}`;
  }

  /**
   * Retrieve export data
   */
  private async retrieveExportData(exportId: string): Promise<ExportedData> {
    const dataString = localStorage.getItem(`export-data-${exportId}`);
    if (!dataString) {
      throw new Error('Export data not found');
    }
    return JSON.parse(dataString);
  }

  /**
   * Calculate SHA-256 checksum
   */
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate user credentials
   */
  private async validateCredential(verificationData: {
    method: 'password' | 'email' | 'sms' | 'biometric';
    credential: string;
  }): Promise<boolean> {
    // In real implementation, would validate against actual user credentials
    // For demo purposes, accept any non-empty credential
    return verificationData.credential.length > 0;
  }

  /**
   * Add audit log entry
   */
  private async addAuditLog(exportId: string, action: string, details: any): Promise<void> {
    await this.db.exportAuditLog.add({
      id: this.generateId(),
      exportId,
      action,
      timestamp: new Date(),
      userId: this.currentUserId,
      details
    });
  }

  /**
   * Generate export ID
   */
  private generateExportId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate security key for download
   */
  private generateSecurityKey(): string {
    return `key-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<void> {
    try {
      const now = new Date();
      const expiredExports = await this.db.exportRequests
        .where('expiresAt')
        .below(now)
        .toArray();

      for (const exportReq of expiredExports) {
        // Remove stored data
        localStorage.removeItem(`export-data-${exportReq.id}`);
        
        // Delete request record
        await this.db.exportRequests.delete(exportReq.id);
        
        await this.addAuditLog(exportReq.id, 'export_expired_cleanup', {});
      }

      console.log(`Cleaned up ${expiredExports.length} expired exports`);
    } catch (error) {
      console.error('Failed to cleanup expired exports:', error);
    }
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}