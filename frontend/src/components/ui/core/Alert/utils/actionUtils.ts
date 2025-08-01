/**
 * Alert Action System - Utility Functions
 * Provides idempotent handling, keyboard navigation, and action management
 */

import { AlertAction, ActionResult, ActionEvent, ActionExecutionContext, ActionState } from '../types/AlertActionTypes';

// Action execution registry for idempotency
const executionRegistry = new Map<string, {
  executing: boolean;
  lastExecution: Date;
  executionCount: number;
  result?: ActionResult;
}>();

/**
 * Creates a unique execution key for idempotency checking
 */
export const createExecutionKey = (actionId: string, alertId: string): string => {
  return `${alertId}:${actionId}`;
};

/**
 * Checks if an action can be executed (idempotency and limits)
 */
export const canExecuteAction = (
  action: AlertAction, 
  alertId: string,
  force: boolean = false
): { canExecute: boolean; reason?: string } => {
  const key = createExecutionKey(action.id, alertId);
  const registry = executionRegistry.get(key);
  
  // Check if action is currently executing
  if (registry?.executing && !force) {
    return { canExecute: false, reason: 'Action is currently executing' };
  }
  
  // Check execution limits
  if (action.executionLimit && registry?.executionCount >= action.executionLimit) {
    return { canExecute: false, reason: 'Execution limit reached' };
  }
  
  // Check if action is disabled
  if (action.disabled) {
    return { canExecute: false, reason: 'Action is disabled' };
  }
  
  // Check idempotency
  if (action.idempotent && registry?.result?.success && !force) {
    return { canExecute: false, reason: 'Action already executed successfully' };
  }
  
  return { canExecute: true };
};

/**
 * Marks an action as executing
 */
export const markActionExecuting = (actionId: string, alertId: string): void => {
  const key = createExecutionKey(actionId, alertId);
  const registry = executionRegistry.get(key) || {
    executing: false,
    lastExecution: new Date(),
    executionCount: 0
  };
  
  registry.executing = true;
  registry.lastExecution = new Date();
  executionRegistry.set(key, registry);
};

/**
 * Marks an action as completed
 */
export const markActionCompleted = (
  actionId: string, 
  alertId: string, 
  result: ActionResult
): void => {
  const key = createExecutionKey(actionId, alertId);
  const registry = executionRegistry.get(key) || {
    executing: false,
    lastExecution: new Date(),
    executionCount: 0
  };
  
  registry.executing = false;
  registry.executionCount += 1;
  registry.result = result;
  executionRegistry.set(key, registry);
};

/**
 * Clears execution registry for an alert (cleanup)
 */
export const clearActionRegistry = (alertId: string): void => {
  const keysToDelete = Array.from(executionRegistry.keys())
    .filter(key => key.startsWith(`${alertId}:`));
  
  keysToDelete.forEach(key => executionRegistry.delete(key));
};

/**
 * Creates a timeout promise for action execution
 */
export const createActionTimeout = (timeoutMs: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Action timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
};

/**
 * Executes an action with proper error handling and timeout
 */
export const executeActionSafely = async (
  action: AlertAction,
  context: ActionExecutionContext,
  onEvent?: (event: ActionEvent) => void
): Promise<ActionResult> => {
  const startTime = Date.now();
  
  // Create start event
  const startEvent: ActionEvent = {
    id: `${action.id}-${Date.now()}`,
    actionId: action.id,
    alertId: context.alertId,
    type: 'start',
    timestamp: new Date(),
    metadata: { ...action.metadata, ...context.metadata }
  };
  
  onEvent?.(startEvent);
  
  try {
    let actionPromise: Promise<ActionResult>;
    
    // Execute based on action type
    switch (action.type) {
      case 'retry':
        actionPromise = action.retryOperation();
        break;
      case 'undo':
        actionPromise = action.undoOperation();
        break;
      case 'dismiss':
        actionPromise = action.dismissOperation?.() || Promise.resolve({ success: true });
        break;
      case 'acknowledge':
        actionPromise = action.acknowledgeOperation();
        break;
      case 'custom':
        actionPromise = action.execute(context);
        break;
      case 'view-details':
        // Handle view details (navigate or open modal)
        if (action.detailsUrl) {
          window.open(action.detailsUrl, action.openInModal ? '_blank' : '_self');
        }
        actionPromise = Promise.resolve({ success: true });
        break;
      case 'navigate':
        // Handle navigation
        if (action.external) {
          window.open(action.url, action.target || '_blank');
        } else {
          window.location.href = action.url;
        }
        actionPromise = Promise.resolve({ success: true });
        break;
      default:
        actionPromise = Promise.resolve({ success: true });
    }
    
    // Apply timeout if specified
    const promises = [actionPromise];
    if (action.timeout) {
      promises.push(createActionTimeout(action.timeout));
    }
    
    const result = await Promise.race(promises);
    const duration = Date.now() - startTime;
    
    // Create success event
    const successEvent: ActionEvent = {
      id: `${action.id}-${Date.now()}`,
      actionId: action.id,
      alertId: context.alertId,
      type: 'success',
      timestamp: new Date(),
      duration,
      result,
      metadata: { ...action.metadata, ...context.metadata }
    };
    
    onEvent?.(successEvent);
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.message.includes('timed out');
    
    // Create error event
    const errorEvent: ActionEvent = {
      id: `${action.id}-${Date.now()}`,
      actionId: action.id,
      alertId: context.alertId,
      type: isTimeout ? 'timeout' : 'error',
      timestamp: new Date(),
      duration,
      error: error instanceof Error ? error : new Error(String(error)),
      metadata: { ...action.metadata, ...context.metadata }
    };
    
    onEvent?.(errorEvent);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Default keyboard shortcuts for action types
 */
export const defaultKeyboardShortcuts: Record<string, string> = {
  'r': 'retry',
  'u': 'undo',
  'd': 'view-details',
  'escape': 'dismiss',
  'enter': 'acknowledge',
  'space': 'primary-action'
};

/**
 * Generates focus order for actions based on priority
 */
export const generateFocusOrder = (actions: AlertAction[]): string[] => {
  return actions
    .sort((a, b) => {
      const priorityOrder = { primary: 0, secondary: 1, tertiary: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .map(action => action.id);
};

/**
 * Handles keyboard navigation between actions
 */
export const handleKeyboardNavigation = (
  event: KeyboardEvent,
  actions: AlertAction[],
  currentFocus: number,
  onFocusChange: (index: number) => void,
  onActionTrigger: (actionId: string) => void
): boolean => {
  const { key, ctrlKey, metaKey, shiftKey } = event;
  const modifierPressed = ctrlKey || metaKey;
  
  switch (key) {
    case 'ArrowRight':
    case 'Tab':
      if (!shiftKey) {
        const nextIndex = (currentFocus + 1) % actions.length;
        onFocusChange(nextIndex);
        event.preventDefault();
        return true;
      }
      break;
      
    case 'ArrowLeft':
      if (shiftKey && key === 'Tab') {
        const prevIndex = currentFocus === 0 ? actions.length - 1 : currentFocus - 1;
        onFocusChange(prevIndex);
        event.preventDefault();
        return true;
      }
      break;
      
    case 'Enter':
    case ' ':
      if (currentFocus >= 0 && currentFocus < actions.length) {
        onActionTrigger(actions[currentFocus].id);
        event.preventDefault();
        return true;
      }
      break;
      
    default:
      // Check for shortcut keys
      const shortcutKey = modifierPressed ? `${ctrlKey ? 'ctrl+' : 'cmd+'}${key.toLowerCase()}` : key.toLowerCase();
      const action = actions.find(a => a.shortcut === shortcutKey);
      if (action) {
        onActionTrigger(action.id);
        event.preventDefault();
        return true;
      }
  }
  
  return false;
};

/**
 * Creates ARIA labels for actions
 */
export const createActionAriaLabel = (action: AlertAction): string => {
  if (action.ariaLabel) return action.ariaLabel;
  
  let label = action.label;
  
  if (action.shortcut) {
    label += ` (${action.shortcut})`;
  }
  
  if (action.loading) {
    label += ' - Loading';
  }
  
  if (action.disabled) {
    label += ' - Disabled';
  }
  
  return label;
};

/**
 * Validates action configuration
 */
export const validateAction = (action: AlertAction): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!action.id) {
    errors.push('Action must have an id');
  }
  
  if (!action.label) {
    errors.push('Action must have a label');
  }
  
  if (!action.type) {
    errors.push('Action must have a type');
  }
  
  // Type-specific validations
  switch (action.type) {
    case 'retry':
      if (!action.retryOperation) {
        errors.push('Retry action must have a retryOperation function');
      }
      break;
    case 'undo':
      if (!action.undoOperation) {
        errors.push('Undo action must have an undoOperation function');
      }
      break;
    case 'navigate':
      if (!action.url) {
        errors.push('Navigate action must have a url');
      }
      break;
    case 'acknowledge':
      if (!action.acknowledgeOperation) {
        errors.push('Acknowledge action must have an acknowledgeOperation function');
      }
      break;
    case 'custom':
      if (!action.execute) {
        errors.push('Custom action must have an execute function');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Merges action configurations with defaults
 */
export const mergeActionDefaults = (action: Partial<AlertAction>): AlertAction => {
  const defaults = {
    priority: 'secondary' as const,
    variant: 'tertiary' as const,
    disabled: false,
    loading: false,
    state: 'idle' as ActionState,
    confirmation: 'none' as const,
    closeOnSuccess: false,
    idempotent: true,
    executionLimit: undefined,
    executionCount: 0,
    timestamp: new Date()
  };
  
  return { ...defaults, ...action } as AlertAction;
};