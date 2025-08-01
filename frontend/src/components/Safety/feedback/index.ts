/**
 * Feedback System Components
 * 
 * Comprehensive multi-modal feedback system for safety-critical operations.
 * 
 * @module FeedbackSystem
 * @version 1.0.0
 */

// Main components
export { FeedbackSystem, feedbackSystem } from './FeedbackSystem';
export { StatusBanner } from './StatusBanner';
export { ConfirmationModal } from './ConfirmationModal';
export { LocalizationProvider, useLocalization, getTranslation } from './LocalizationProvider';
export { FeedbackHistory } from './FeedbackHistory';

// Types
export type {
  FeedbackMessage,
  FeedbackAction,
  FeedbackSystemProps,
} from './FeedbackSystem';

export {
  FeedbackSeverity,
  FeedbackChannel,
  SoundPattern,
  HapticPattern,
} from './FeedbackSystem';

export type {
  SystemStatus,
  StatusMetric,
  StatusSection,
  StatusAction,
  StatusBannerProps,
} from './StatusBanner';

export { SystemStatus } from './StatusBanner';

export type {
  ConfirmationRequirement,
  ConfirmationModalProps,
} from './ConfirmationModal';

export {
  ConfirmationSeverity,
  ConfirmationMethod,
} from './ConfirmationModal';

export type {
  Locale,
  LocalizedMessage,
  LocalizationContextType,
  LocaleInfo,
} from './LocalizationProvider';

export type {
  FeedbackHistoryEntry,
  FeedbackFilter,
  FeedbackHistoryProps,
} from './FeedbackHistory';

// Re-export SystemStatus with consistent naming
export { SystemStatus as EmergencySystemStatus } from './StatusBanner';