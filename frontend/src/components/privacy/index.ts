/**
 * Enhanced Privacy Components - Export Index
 * Centralized exports for all privacy and consent management components
 */

// Core Privacy Components
export { PrivacySettings } from './PrivacySettings';
export { InitialConsentDialog } from './InitialConsentDialog';
export { PrivacyDemo } from './PrivacyDemo';
export { 
  PrivacyProvider, 
  usePrivacyContext, 
  withPrivacyConsent, 
  ConditionalPrivacy,
  PrivacyStatus 
} from './PrivacyProvider';

// Enhanced Consent Management Components (Task 55.4)
export { EnhancedConsentSettings } from './EnhancedConsentSettings';
export { ContextualConsentDialog } from './ContextualConsentDialog';
export { ConsentReviewReminder } from './ConsentReviewReminder';
export { EnhancedPrivacyDemo } from './EnhancedPrivacyDemo';

// Accessible Privacy Components (Task 55.7)
export { AccessiblePrivacyControls } from './AccessiblePrivacyControls';
export { AccessibleConsentDialog } from './AccessibleConsentDialog';
export { AccessiblePrivacyForm } from './AccessiblePrivacyForm';
export { AccessibilityTestHelper } from './AccessibilityTestHelper';
export { AccessiblePrivacyDemo } from './AccessiblePrivacyDemo';

// Compliance Validation Components (Task 55.8)
export { ComplianceValidationDashboard } from './ComplianceValidationDashboard';
export { PrivacyRequestTracker } from './PrivacyRequestTracker';

// Privacy Services
export { 
  ConsentManager, 
  consentManager,
  type ConsentCategory,
  type ConsentConfiguration,
  type ConsentPreference,
  type ConsentRecord,
  type ConsentVersioning,
  type ConsentReviewSchedule
} from '../../services/privacy/ConsentManager';

export { 
  consentVersioningService,
  type PolicyChange,
  type PolicyUpdateNotification
} from '../../services/privacy/ConsentVersioningService';

export {
  PrivacyAwareAlertService,
  privacyAwareAlertService,
  type PrivacyAwareAlertOptions
} from '../../services/privacy/PrivacyAwareAlertService';

// Privacy Hooks
export { 
  usePrivacyConsent, 
  useAlertPrivacyConsent,
  type PrivacyConsentState,
  type PrivacyConsentActions
} from '../../hooks/usePrivacyConsent';

// Store
export { 
  usePrivacyAwareAlertStore,
  type PrivacyAwareAlertState
} from '../../stores/privacyAwareAlertStore';