/**
 * Alert System - Public API
 * Exports all components and utilities for the comprehensive alert action system
 */

// Main Components
export { Alert } from './Alert';
export { PriorityAlert } from './PriorityAlert';
export type { AlertProps } from '../types';
export type { PriorityAlertProps } from './PriorityAlert';
export type { AlertPriority } from '../../../../theme/alertPriorities';

export { AlertContainer } from './AlertContainer';
export { AlertAcknowledgmentModal } from './AlertAcknowledgmentModal';
export { AlertHistoryPanel } from './AlertHistoryPanel';

// Action System Components
export { AlertActions } from './components/AlertActions';
export { AlertActionButton } from './components/AlertActionButton';
export { AlertActionConfirmationModal } from './components/AlertActionConfirmationModal';

// Action System Types
export type {
  AlertAction,
  AlertActionGroup,
  AlertActionsProps,
  AlertActionType,
  ActionPriority,
  ActionState,
  ActionResult,
  ActionEvent,
  ActionExecutionContext,
  ConfirmationType,
  RetryAlertAction,
  UndoAlertAction,
  ViewDetailsAlertAction,
  NavigateAlertAction,
  DismissAlertAction,
  AcknowledgeAlertAction,
  CustomAlertAction,
  KeyboardNavigation,
  FocusManagement,
  ActionThemeConfig
} from './types/AlertActionTypes';

// Action System Utilities
export {
  canExecuteAction,
  markActionExecuting,
  markActionCompleted,
  clearActionRegistry,
  executeActionSafely,
  createExecutionKey,
  generateFocusOrder,
  handleKeyboardNavigation,
  createActionAriaLabel,
  validateAction,
  mergeActionDefaults,
  defaultKeyboardShortcuts
} from './utils/actionUtils';

// Helper Functions for Creating Actions
export const createRetryAction = (
  id: string,
  operation: () => Promise<ActionResult>,
  options?: Partial<RetryAlertAction>
): RetryAlertAction => ({
  id,
  type: 'retry',
  label: 'Retry',
  priority: 'primary',
  variant: 'primary',
  retryOperation: operation,
  idempotent: false,
  shortcut: 'r',
  ...options
});

export const createUndoAction = (
  id: string,
  operation: () => Promise<ActionResult>,
  options?: Partial<UndoAlertAction>
): UndoAlertAction => ({
  id,
  type: 'undo',
  label: 'Undo',
  priority: 'secondary',
  variant: 'tertiary',
  undoOperation: operation,
  confirmation: 'simple',
  shortcut: 'u',
  ...options
});

export const createViewDetailsAction = (
  id: string,
  url: string,
  options?: Partial<ViewDetailsAlertAction>
): ViewDetailsAlertAction => ({
  id,
  type: 'view-details',
  label: 'View Details',
  priority: 'tertiary',
  variant: 'ghost',
  detailsUrl: url,
  shortcut: 'd',
  ...options
});

export const createNavigateAction = (
  id: string,
  url: string,
  options?: Partial<NavigateAlertAction>
): NavigateAlertAction => ({
  id,
  type: 'navigate',
  label: 'Navigate',
  priority: 'secondary',
  variant: 'secondary',
  url,
  external: false,
  ...options
});

export const createDismissAction = (
  id: string = 'dismiss',
  operation?: () => Promise<ActionResult>,
  options?: Partial<DismissAlertAction>
): DismissAlertAction => ({
  id,
  type: 'dismiss',
  label: 'Dismiss',
  priority: 'tertiary',
  variant: 'ghost',
  dismissOperation: operation,
  shortcut: 'escape',
  ...options
});

export const createAcknowledgeAction = (
  id: string,
  operation: () => Promise<ActionResult>,
  options?: Partial<AcknowledgeAlertAction>
): AcknowledgeAlertAction => ({
  id,
  type: 'acknowledge',
  label: 'Acknowledge',
  priority: 'primary',
  variant: 'primary',
  acknowledgeOperation: operation,
  shortcut: 'enter',
  ...options
});

export const createCustomAction = (
  id: string,
  label: string,
  execute: (context?: any) => Promise<ActionResult>,
  options?: Partial<CustomAlertAction>
): CustomAlertAction => ({
  id,
  type: 'custom',
  label,
  priority: 'secondary',
  variant: 'tertiary',
  execute,
  ...options
});

// Action Group Helper
export const createActionGroup = (
  id: string,
  actions: AlertAction[],
  options?: Partial<AlertActionGroup>
): AlertActionGroup => ({
  id,
  actions,
  orientation: 'horizontal',
  priority: 'secondary',
  ...options
});

// Common Action Patterns
export const createStandardErrorActions = (
  retryOperation: () => Promise<ActionResult>,
  detailsUrl?: string
): AlertAction[] => {
  const actions: AlertAction[] = [
    createRetryAction('retry', retryOperation),
    createDismissAction()
  ];
  
  if (detailsUrl) {
    actions.splice(1, 0, createViewDetailsAction('details', detailsUrl));
  }
  
  return actions;
};

export const createCriticalMissionActions = (
  acknowledgeOperation: () => Promise<ActionResult>,
  emergencyOperation?: () => Promise<ActionResult>
): AlertAction[] => {
  const actions: AlertAction[] = [
    createAcknowledgeAction('acknowledge', acknowledgeOperation, {
      confirmation: 'complex',
      confirmationTitle: 'Acknowledge Critical Alert',
      confirmationMessage: 'This is a critical mission alert that requires your immediate acknowledgment.'
    })
  ];
  
  if (emergencyOperation) {
    actions.push(createCustomAction(
      'emergency-stop',
      'Emergency Stop',
      emergencyOperation,
      {
        variant: 'danger',
        priority: 'primary',
        confirmation: 'destructive',
        confirmationTitle: 'Emergency Stop',
        confirmationMessage: 'This will immediately stop all rover operations. Use only in emergency situations.',
        confirmationDanger: true
      }
    ));
  }
  
  return actions;
};

export const createDataOperationActions = (
  saveOperation: () => Promise<ActionResult>,
  undoOperation?: () => Promise<ActionResult>
): AlertAction[] => {
  const actions: AlertAction[] = [
    createCustomAction('save', 'Save Changes', saveOperation, {
      variant: 'primary',
      priority: 'primary'
    })
  ];
  
  if (undoOperation) {
    actions.push(createUndoAction('undo', undoOperation));
  }
  
  actions.push(createDismissAction('cancel', undefined, {
    label: 'Cancel'
  }));
  
  return actions;
};