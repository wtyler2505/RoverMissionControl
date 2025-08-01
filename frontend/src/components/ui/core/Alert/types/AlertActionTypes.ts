/**
 * Alert Action System - Comprehensive Type Definitions
 * Provides flexible, accessible, and idempotent action handling for alerts
 */

import { ReactNode } from 'react';
import { ButtonVariant } from '../../types';

// Core Action Types
export type AlertActionType = 
  | 'retry' 
  | 'undo' 
  | 'view-details' 
  | 'navigate' 
  | 'dismiss' 
  | 'acknowledge'
  | 'custom';

// Action Priority Levels
export type ActionPriority = 'primary' | 'secondary' | 'tertiary';

// Action Confirmation Types
export type ConfirmationType = 'none' | 'simple' | 'destructive' | 'complex';

// Async Action States
export type ActionState = 'idle' | 'loading' | 'success' | 'error';

// Action Result Interface
export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  shouldCloseAlert?: boolean;
  shouldDismissAction?: boolean;
  message?: string;
}

// Base Action Configuration
export interface BaseAlertAction {
  id: string;
  type: AlertActionType;
  label: string;
  priority: ActionPriority;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  state?: ActionState;
  
  // Accessibility
  ariaLabel?: string;
  description?: string;
  shortcut?: string; // Keyboard shortcut (e.g., 'ctrl+r', 'escape')
  
  // Confirmation
  confirmation?: ConfirmationType;
  confirmationTitle?: string;
  confirmationMessage?: string;
  confirmationDanger?: boolean;
  
  // Behavior
  closeOnSuccess?: boolean;
  idempotent?: boolean; // Prevent duplicate executions
  executionLimit?: number; // Max times action can be executed
  executionCount?: number; // Current execution count
  timeout?: number; // Action timeout in ms
  
  // Metadata
  metadata?: Record<string, any>;
  timestamp?: Date;
  trackingId?: string;
}

// Retry Action
export interface RetryAlertAction extends BaseAlertAction {
  type: 'retry';
  retryOperation: () => Promise<ActionResult>;
  maxRetries?: number;
  currentRetry?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
}

// Undo Action
export interface UndoAlertAction extends BaseAlertAction {
  type: 'undo';
  undoOperation: () => Promise<ActionResult>;
  undoData?: any;
  undoTimeout?: number; // Time limit for undo availability
}

// View Details Action
export interface ViewDetailsAlertAction extends BaseAlertAction {
  type: 'view-details';
  detailsUrl?: string;
  detailsData?: any;
  detailsComponent?: ReactNode;
  openInModal?: boolean;
  modalSize?: 'small' | 'medium' | 'large';
}

// Navigate Action
export interface NavigateAlertAction extends BaseAlertAction {
  type: 'navigate';
  url: string;
  external?: boolean;
  target?: '_blank' | '_self' | '_parent' | '_top';
  preserveAlert?: boolean;
}

// Dismiss Action
export interface DismissAlertAction extends BaseAlertAction {
  type: 'dismiss';
  dismissOperation?: () => Promise<ActionResult>;
}

// Acknowledge Action
export interface AcknowledgeAlertAction extends BaseAlertAction {
  type: 'acknowledge';
  acknowledgeOperation: () => Promise<ActionResult>;
  requiresReason?: boolean;
  reasonOptions?: string[];
}

// Custom Action
export interface CustomAlertAction extends BaseAlertAction {
  type: 'custom';
  execute: (context?: any) => Promise<ActionResult>;
  customComponent?: ReactNode;
}

// Union type for all actions
export type AlertAction = 
  | RetryAlertAction
  | UndoAlertAction
  | ViewDetailsAlertAction
  | NavigateAlertAction
  | DismissAlertAction
  | AcknowledgeAlertAction
  | CustomAlertAction;

// Action Group for organizing related actions
export interface AlertActionGroup {
  id: string;
  label?: string;
  actions: AlertAction[];
  collapsed?: boolean;
  priority?: ActionPriority;
  orientation?: 'horizontal' | 'vertical';
}

// Action Context for execution
export interface ActionExecutionContext {
  alertId: string;
  alertPriority: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

// Action Event for tracking and logging
export interface ActionEvent {
  id: string;
  actionId: string;
  alertId: string;
  type: 'start' | 'success' | 'error' | 'timeout' | 'cancel';
  timestamp: Date;
  duration?: number;
  result?: ActionResult;
  error?: Error;
  metadata?: Record<string, any>;
}

// Action Handler Props
export interface ActionHandlerProps {
  action: AlertAction;
  context: ActionExecutionContext;
  onStateChange?: (actionId: string, state: ActionState) => void;
  onComplete?: (actionId: string, result: ActionResult) => void;
  onError?: (actionId: string, error: Error) => void;
  onEvent?: (event: ActionEvent) => void;
}

// Keyboard Navigation Configuration
export interface KeyboardNavigation {
  enabled: boolean;
  shortcuts: Record<string, string>; // shortcut -> actionId mapping
  focusOrder: string[]; // Ordered list of action IDs for tab navigation
  wrapAround?: boolean;
  announceNavigation?: boolean;
}

// Focus Management Configuration
export interface FocusManagement {
  autoFocus?: string; // Action ID to auto-focus
  focusOnOpen?: boolean;
  focusOnComplete?: boolean;
  focusOnError?: boolean;
  returnFocus?: boolean; // Return focus to trigger element
  trapFocus?: boolean;
}

// Action Theme Configuration
export interface ActionThemeConfig {
  spacing: {
    gap: string;
    padding: string;
    margin: string;
  };
  layout: {
    direction: 'row' | 'column';
    justify: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
    align: 'start' | 'center' | 'end' | 'stretch';
    wrap: boolean;
  };
  responsive: {
    stackOnMobile: boolean;
    hideSecondaryOnMobile: boolean;
    collapseThreshold: number;
  };
}

// Alert Actions Container Props
export interface AlertActionsProps {
  actions: AlertAction[] | AlertActionGroup[];
  alertId: string;
  alertPriority: string;
  context?: Partial<ActionExecutionContext>;
  
  // Layout & Appearance
  layout?: 'inline' | 'stacked' | 'dropdown';
  maxVisible?: number; // Max actions to show before collapsing
  theme?: Partial<ActionThemeConfig>;
  
  // Behavior
  keyboard?: Partial<KeyboardNavigation>;
  focus?: Partial<FocusManagement>;
  confirmations?: boolean;
  
  // Events
  onActionStart?: (actionId: string, context: ActionExecutionContext) => void;
  onActionComplete?: (actionId: string, result: ActionResult) => void;
  onActionError?: (actionId: string, error: Error) => void;
  onActionEvent?: (event: ActionEvent) => void;
  
  // Accessibility
  ariaLabel?: string;
  ariaDescription?: string;
  role?: string;
}