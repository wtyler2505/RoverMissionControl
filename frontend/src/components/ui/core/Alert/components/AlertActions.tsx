/**
 * AlertActions Component
 * Main container for alert actions with keyboard navigation and focus management
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { 
  AlertAction, 
  AlertActionGroup, 
  AlertActionsProps, 
  ActionExecutionContext,
  ActionResult,
  ActionEvent
} from '../types/AlertActionTypes';
import { 
  canExecuteAction, 
  markActionExecuting, 
  markActionCompleted, 
  executeActionSafely,
  handleKeyboardNavigation,
  generateFocusOrder,
  validateAction
} from '../utils/actionUtils';
import { AlertActionButton } from './AlertActionButton';
import { AlertActionConfirmationModal } from './AlertActionConfirmationModal';

const ActionsContainer = styled.div<{ 
  theme: Theme; 
  layout: AlertActionsProps['layout'];
  maxVisible: number;
  totalActions: number;
}>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  
  ${({ layout }) => {
    switch (layout) {
      case 'stacked':
        return css`
          flex-direction: column;
          align-items: stretch;
        `;
      case 'dropdown':
        return css`
          position: relative;
        `;
      case 'inline':
      default:
        return css`
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
        `;
    }
  }}
  
  /* Responsive behavior */
  @media (max-width: 640px) {
    ${({ layout }) => layout !== 'stacked' && css`
      flex-direction: column;
      align-items: stretch;
      gap: ${({ theme }) => theme.spacing[2]};
    `}
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    gap: ${({ theme }) => theme.spacing[3]};
  }
`;

const ActionGroup = styled.div<{ 
  theme: Theme; 
  orientation: 'horizontal' | 'vertical';
  priority: 'primary' | 'secondary' | 'tertiary';
}>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  
  ${({ orientation }) => css`
    flex-direction: ${orientation === 'vertical' ? 'column' : 'row'};
  `}
  
  ${({ priority, theme }) => {
    if (priority === 'primary') {
      return css`
        order: -1;
      `;
    }
    return '';
  }}
`;

const GroupLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const OverflowMenu = styled.div<{ theme: Theme; open: boolean }>`
  position: relative;
  display: inline-block;
`;

const OverflowTrigger = styled.button<{ theme: Theme }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.background.elevated};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

const OverflowDropdown = styled.div<{ theme: Theme; open: boolean }>`
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 200px;
  margin-top: ${({ theme }) => theme.spacing[1]};
  background: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  z-index: 100;
  opacity: ${({ open }) => open ? 1 : 0};
  visibility: ${({ open }) => open ? 'visible' : 'hidden'};
  transform: ${({ open }) => open ? 'translateY(0)' : 'translateY(-10px)'};
  transition: all 0.2s ease-out;
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
`;

const DropdownAction = styled.button<{ theme: Theme }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${({ theme }) => theme.spacing[3]};
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.background.elevated};
  }
  
  &:first-of-type {
    border-top-left-radius: ${({ theme }) => theme.borderRadius.md};
    border-top-right-radius: ${({ theme }) => theme.borderRadius.md};
  }
  
  &:last-of-type {
    border-bottom-left-radius: ${({ theme }) => theme.borderRadius.md};
    border-bottom-right-radius: ${({ theme }) => theme.borderRadius.md};
  }
`;

export const AlertActions: React.FC<AlertActionsProps> = ({
  actions,
  alertId,
  alertPriority,
  context = {},
  layout = 'inline',
  maxVisible = 3,
  theme: themeOverride,
  keyboard = {},
  focus = {},
  confirmations = true,
  onActionStart,
  onActionComplete,
  onActionError,
  onActionEvent,
  ariaLabel = 'Alert actions',
  ariaDescription,
  role = 'group'
}) => {
  const [focusedActionIndex, setFocusedActionIndex] = useState(-1);
  const [confirmingAction, setConfirmingAction] = useState<AlertAction | null>(null);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, any>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const actionRefs = useRef<Record<string, HTMLButtonElement>>({});
  
  // Flatten actions from groups
  const flatActions = useMemo(() => {
    const flat: AlertAction[] = [];
    actions.forEach(item => {
      if ('actions' in item) {
        // It's a group
        flat.push(...item.actions);
      } else {
        // It's a single action
        flat.push(item);
      }
    });
    return flat;
  }, [actions]);
  
  // Validate actions
  const validActions = useMemo(() => {
    return flatActions.filter(action => {
      const validation = validateAction(action);
      if (!validation.valid) {
        console.warn(`Invalid action ${action.id}:`, validation.errors);
        return false;
      }
      return true;
    });
  }, [flatActions]);
  
  // Split visible and overflow actions
  const { visibleActions, overflowActions } = useMemo(() => {
    if (layout === 'dropdown' || validActions.length <= maxVisible) {
      return { visibleActions: validActions, overflowActions: [] };
    }
    
    return {
      visibleActions: validActions.slice(0, maxVisible - 1),
      overflowActions: validActions.slice(maxVisible - 1)
    };
  }, [validActions, maxVisible, layout]);
  
  // Generate focus order
  const focusOrder = useMemo(() => {
    return generateFocusOrder(visibleActions);
  }, [visibleActions]);
  
  // Create execution context
  const executionContext: ActionExecutionContext = useMemo(() => ({
    alertId,
    alertPriority,
    ...context
  }), [alertId, alertPriority, context]);
  
  // Handle action execution
  const executeAction = useCallback(async (actionId: string): Promise<ActionResult> => {
    const action = validActions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }
    
    // Check if action can be executed
    const canExecute = canExecuteAction(action, alertId);
    if (!canExecute.canExecute) {
      throw new Error(canExecute.reason);
    }
    
    // Fire start event
    onActionStart?.(actionId, executionContext);
    
    // Mark as executing
    markActionExecuting(actionId, alertId);
    
    try {
      // Execute the action
      const result = await executeActionSafely(action, executionContext, onActionEvent);
      
      // Mark as completed
      markActionCompleted(actionId, alertId, result);
      
      // Fire complete event
      onActionComplete?.(actionId, result);
      
      return result;
    } catch (error) {
      const errorResult: ActionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      
      // Mark as completed with error
      markActionCompleted(actionId, alertId, errorResult);
      
      // Fire error event
      onActionError?.(actionId, error instanceof Error ? error : new Error(String(error)));
      
      return errorResult;
    }
  }, [validActions, alertId, executionContext, onActionStart, onActionComplete, onActionError, onActionEvent]);
  
  // Handle action click with confirmation
  const handleActionClick = useCallback(async (actionId: string): Promise<ActionResult> => {
    const action = validActions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }
    
    // Check if confirmation is needed
    if (confirmations && action.confirmation && action.confirmation !== 'none') {
      setConfirmingAction(action);
      return new Promise((resolve) => {
        // Store the resolve function for when confirmation completes
        setActionStates(prev => ({
          ...prev,
          [actionId]: { resolve }
        }));
      });
    }
    
    return executeAction(actionId);
  }, [validActions, confirmations, executeAction]);
  
  // Handle confirmation
  const handleConfirmAction = useCallback(async () => {
    if (!confirmingAction) return;
    
    try {
      const result = await executeAction(confirmingAction.id);
      
      // Resolve the pending promise
      const actionState = actionStates[confirmingAction.id];
      if (actionState?.resolve) {
        actionState.resolve(result);
      }
    } finally {
      setConfirmingAction(null);
      setActionStates(prev => {
        const newState = { ...prev };
        delete newState[confirmingAction.id];
        return newState;
      });
    }
  }, [confirmingAction, executeAction, actionStates]);
  
  // Handle confirmation cancel
  const handleCancelConfirmation = useCallback(() => {
    if (!confirmingAction) return;
    
    const result: ActionResult = { success: false, error: 'Cancelled by user' };
    
    // Resolve the pending promise
    const actionState = actionStates[confirmingAction.id];
    if (actionState?.resolve) {
      actionState.resolve(result);
    }
    
    setConfirmingAction(null);
    setActionStates(prev => {
      const newState = { ...prev };
      delete newState[confirmingAction.id];
      return newState;
    });
  }, [confirmingAction, actionStates]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!keyboard.enabled) return;
      
      const handled = handleKeyboardNavigation(
        event,
        visibleActions,
        focusedActionIndex,
        setFocusedActionIndex,
        handleActionClick
      );
      
      if (handled && keyboard.announceNavigation) {
        // Announce the focused action for screen readers
        const focusedAction = visibleActions[focusedActionIndex];
        if (focusedAction) {
          // Create a temporary element for announcement
          const announcement = document.createElement('div');
          announcement.setAttribute('aria-live', 'polite');
          announcement.setAttribute('aria-atomic', 'true');
          announcement.style.position = 'absolute';
          announcement.style.left = '-10000px';
          announcement.textContent = `Focused on ${focusedAction.label} button`;
          document.body.appendChild(announcement);
          
          setTimeout(() => {
            document.body.removeChild(announcement);
          }, 1000);
        }
      }
    };
    
    if (keyboard.enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [keyboard, visibleActions, focusedActionIndex, handleActionClick]);
  
  // Auto-focus management
  useEffect(() => {
    if (focus.autoFocus && actionRefs.current[focus.autoFocus]) {
      actionRefs.current[focus.autoFocus].focus();
    }
  }, [focus.autoFocus]);
  
  const renderAction = (action: AlertAction, index: number) => (
    <AlertActionButton
      key={action.id}
      ref={(ref) => {
        if (ref) actionRefs.current[action.id] = ref;
      }}
      action={action}
      alertPriority={alertPriority}
      focused={focusedActionIndex === index}
      onExecute={handleActionClick}
      onFocus={() => setFocusedActionIndex(index)}
      onBlur={() => setFocusedActionIndex(-1)}
    />
  );
  
  const renderActionGroup = (group: AlertActionGroup) => (
    <ActionGroup
      key={group.id}
      orientation={group.orientation || 'horizontal'}
      priority={group.priority || 'secondary'}
    >
      {group.label && <GroupLabel>{group.label}</GroupLabel>}
      {group.actions.map((action, index) => renderAction(action, index))}
    </ActionGroup>
  );
  
  if (validActions.length === 0) {
    return null;
  }
  
  return (
    <>
      <ActionsContainer
        ref={containerRef}
        layout={layout}
        maxVisible={maxVisible}
        totalActions={validActions.length}
        role={role}
        aria-label={ariaLabel}
        aria-describedby={ariaDescription}
      >
        {/* Render visible actions */}
        {actions.map((item, index) => {
          if ('actions' in item) {
            return renderActionGroup(item);
          } else {
            return renderAction(item, index);
          }
        })}
        
        {/* Render overflow menu if needed */}
        {overflowActions.length > 0 && (
          <OverflowMenu open={overflowMenuOpen}>
            <OverflowTrigger
              onClick={() => setOverflowMenuOpen(!overflowMenuOpen)}
              aria-label={`Show ${overflowActions.length} more actions`}
              aria-expanded={overflowMenuOpen}
              aria-haspopup="menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </OverflowTrigger>
            <OverflowDropdown open={overflowMenuOpen} role="menu">
              {overflowActions.map(action => (
                <DropdownAction
                  key={action.id}
                  onClick={() => {
                    handleActionClick(action.id);
                    setOverflowMenuOpen(false);
                  }}
                  disabled={action.disabled}
                  role="menuitem"
                >
                  {action.icon && <span style={{ marginRight: '8px' }}>{action.icon}</span>}
                  {action.label}
                </DropdownAction>
              ))}
            </OverflowDropdown>
          </OverflowMenu>
        )}
      </ActionsContainer>
      
      {/* Confirmation modal */}
      {confirmingAction && (
        <AlertActionConfirmationModal
          action={confirmingAction}
          open={true}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelConfirmation}
          onClose={handleCancelConfirmation}
        />
      )}
    </>
  );
};