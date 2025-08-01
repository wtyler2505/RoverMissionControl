/**
 * Retention Components Export Index
 * Central export point for all data retention components
 */

// Configuration Components
export { RetentionConfigurationPanel } from './RetentionConfigurationPanel';
export type { RetentionConfigurationPanelProps } from './RetentionConfigurationPanel';

// Dashboard Components
export { RetentionDashboard } from './RetentionDashboard';
export type { RetentionDashboardProps } from './RetentionDashboard';

// Services
export { RetentionPolicy, retentionPolicy, DEFAULT_RETENTION_POLICY } from '../services/retention/RetentionPolicy';
export type { 
  RetentionPeriod, 
  RetentionRule, 
  RetentionPolicyConfig 
} from '../services/retention/RetentionPolicy';

export { RetentionService, retentionService } from '../services/retention/RetentionService';
export type { 
  AlertRetentionMetadata, 
  RetentionAuditLog, 
  RetentionStats 
} from '../services/retention/RetentionService';

export { 
  BackgroundRetentionWorker, 
  getBackgroundRetentionWorker,
  cleanupBackgroundWorker 
} from '../services/retention/RetentionWorker';
export type { 
  RetentionWorkerMessage, 
  RetentionWorkerResponse, 
  PurgeResult 
} from '../services/retention/RetentionWorker';

export { 
  EnhancedAlertPersistenceService, 
  enhancedAlertPersistenceService 
} from '../services/retention/EnhancedAlertPersistenceService';
export type { 
  RetentionConfiguration, 
  BulkDeletionResult 
} from '../services/retention/EnhancedAlertPersistenceService';

// CSS Imports for bundlers that support CSS imports
import './RetentionConfigurationPanel.css';
import './RetentionDashboard.css';