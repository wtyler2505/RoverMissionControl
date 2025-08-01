/**
 * Privacy Services Index
 * Exports all GDPR compliance services and components
 */

// Core Services
export { ConsentManager, consentManager } from './ConsentManager';
export { DataExportService } from './DataExportService';
export { DataDeletionService } from './DataDeletionService';
export { SecurityTestUtils } from './SecurityTestUtils';

// Types and Interfaces
export type {
  ConsentPreference,
  ConsentRecord,
  ConsentCategory,
  ConsentConfiguration,
  ConsentVersioning,
  ConsentReviewSchedule
} from './ConsentManager';

export type {
  DataExportRequest,
  DataExportScope,
  ExportedData
} from './DataExportService';

export type {
  DataDeletionRequest,
  DataDeletionScope,
  DeletionPreview,
  DeletionReceipt,
  DeletionAuditLog
} from './DataDeletionService';

export type {
  SecurityTestResult,
  ComplianceReport
} from './SecurityTestUtils';

// Components
export { PrivacySettings } from '../../components/privacy/PrivacySettings';
export { DataExportComponent } from '../../components/privacy/DataExportComponent';
export { DataDeletionComponent } from '../../components/privacy/DataDeletionComponent';
export { PrivacyManagementComponent } from '../../components/privacy/PrivacyManagementComponent';

// Utility functions
export const createPrivacyServices = (userId: string = 'anonymous') => {
  const consentMgr = new ConsentManager(userId);
  const alertPersistence = new (require('../persistence/AlertPersistenceService').AlertPersistenceService)();
  const retentionSvc = new (require('../retention/RetentionService').RetentionService)();
  
  const exportService = new DataExportService(consentMgr, alertPersistence, retentionSvc, userId);
  const deletionService = new DataDeletionService(consentMgr, alertPersistence, retentionSvc, userId);
  const securityUtils = new SecurityTestUtils(consentMgr, exportService, deletionService, alertPersistence, retentionSvc);
  
  return {
    consentManager: consentMgr,
    exportService,
    deletionService,
    securityUtils,
    alertPersistence,
    retentionService: retentionSvc
  };
};

export const initializePrivacyServices = async (userId: string = 'anonymous') => {
  const services = createPrivacyServices(userId);
  
  await services.consentManager.initialize();
  await services.exportService.initialize();
  await services.deletionService.initialize();
  
  return services;
};