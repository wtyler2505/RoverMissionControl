/**
 * AlertActionButton Component
 * Accessible, themeable action button with loading states and confirmations
 */

import React, { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { AlertAction, ActionState, ActionResult } from '../types/AlertActionTypes';
import { createActionAriaLabel } from '../utils/actionUtils';
import { focusStyles, transitionStyles } from '../../utils';

// Loading animation
const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Success pulse animation
const successPulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

interface AlertActionButtonProps {
  action: AlertAction;
  alertPriority: string;
  focused?: boolean;
  onExecute: (actionId: string) => Promise<ActionResult>;
  onFocus?: () => void;
  onBlur?: () => void;
  testId?: string;
}

const ActionButton = styled.button<{
  theme: Theme;
  priority: AlertAction['priority'];
  variant: AlertAction['variant'];
  state: ActionState;
  alertPriority: string;
  hasIcon: boolean;
}>`
  /* Base styles */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme, hasIcon }) => 
    hasIcon ? `${theme.spacing[2]} ${theme.spacing[3]}` : `${theme.spacing[2]} ${theme.spacing[4]}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 2px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 40px; /* WCAG 2.1 AA touch target minimum */
  min-width: 40px;
  
  /* Variant-based styling */
  ${({ theme, variant, priority, alertPriority }) => {
    const alertColors = theme.alertPriorities?.[alertPriority as keyof typeof theme.alertPriorities];
    
    switch (variant) {
      case 'primary':
        return css`
          background-color: ${alertColors?.border || theme.colors.primary.main};
          color: ${theme.colors.background.paper};
          
          &:hover:not(:disabled) {
            background-color: ${alertColors?.text || theme.colors.primary.dark};
            transform: translateY(-1px);
          }
          
          &:active:not(:disabled) {
            transform: translateY(0);
          }
        `;
        
      case 'secondary':
        return css`
          background-color: ${theme.colors.secondary.main};
          color: ${theme.colors.secondary.contrast};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.secondary.dark};
            transform: translateY(-1px);
          }
        `;
        
      case 'tertiary':
        return css`
          background-color: transparent;
          color: ${alertColors?.text || theme.colors.text.primary};
          border-color: ${alertColors?.border || theme.colors.divider};
          
          &:hover:not(:disabled) {
            background-color: ${alertColors?.hover || theme.colors.background.elevated};
            border-color: ${alertColors?.text || theme.colors.text.primary};
          }
        `;
        
      case 'danger':
        return css`
          background-color: ${theme.colors.error.main};
          color: ${theme.colors.error.contrast};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.error.dark};
            transform: translateY(-1px);
          }
        `;
        
      case 'ghost':
      default:
        return css`
          background-color: transparent;
          color: ${alertColors?.text || theme.colors.text.secondary};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.background.elevated};
            color: ${alertColors?.text || theme.colors.text.primary};
          }
        `;
    }
  }}
  
  /* State-based styling */
  ${({ state }) => {
    switch (state) {
      case 'loading':
        return css`
          cursor: wait;
          
          .action-icon {
            animation: ${spin} 1s linear infinite;
          }
        `;
        
      case 'success':
        return css`
          animation: ${successPulse} 0.3s ease-out;
        `;
        
      case 'error':
        return css`
          background-color: rgba(244, 67, 54, 0.1);
          border-color: rgba(244, 67, 54, 0.3);
          color: #d32f2f;
        `;
        
      default:
        return '';
    }
  }}
  
  /* Focus styles */
  ${({ theme }) => focusStyles(theme)}
  
  /* Disabled state */
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    
    &:hover {
      transform: none;
    }
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    
    &:hover {
      transform: none;
    }
    
    .action-icon {
      animation: none;
    }
  }
`;

const IconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
`;

const LoadingSpinner = styled.div<{ theme: Theme }>`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const StateIndicator = styled.span<{ theme: Theme; state: ActionState }>`
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colors.background.paper};
  
  ${({ state, theme }) => {
    switch (state) {
      case 'success':
        return css`
          background-color: ${theme.colors.success.main};
        `;
      case 'error':
        return css`
          background-color: ${theme.colors.error.main};
        `;
      case 'loading':
        return css`
          background-color: ${theme.colors.info.main};
          animation: ${spin} 1s linear infinite;
        `;
      default:
        return css`
          display: none;
        `;
    }
  }}
`;

export const AlertActionButton = forwardRef<HTMLButtonElement, AlertActionButtonProps>(
  (
    {
      action,
      alertPriority,
      focused = false,
      onExecute,
      onFocus,
      onBlur,
      testId,
    },
    ref
  ) => {
    const [internalState, setInternalState] = useState<ActionState>(action.state || 'idle');
    const [executionCount, setExecutionCount] = useState(action.executionCount || 0);
    const buttonRef = useRef<HTMLButtonElement>(null);
    
    // Auto-focus when focused prop changes
    useEffect(() => {
      if (focused && buttonRef.current) {
        buttonRef.current.focus();
      }
    }, [focused]);
    
    const handleClick = useCallback(async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (action.disabled || internalState === 'loading') {
        return;
      }
      
      // Check execution limits
      if (action.executionLimit && executionCount >= action.executionLimit) {
        return;
      }
      
      try {
        setInternalState('loading');
        const result = await onExecute(action.id);
        
        if (result.success) {
          setInternalState('success');
          setExecutionCount(prev => prev + 1);
          
          // Reset to idle after success animation
          setTimeout(() => {
            setInternalState('idle');
          }, 300);
        } else {
          setInternalState('error');
          
          // Reset to idle after error display
          setTimeout(() => {
            setInternalState('idle');
          }, 2000);
        }
      } catch (error) {
        setInternalState('error');
        
        // Reset to idle after error display
        setTimeout(() => {
          setInternalState('idle');
        }, 2000);
      }
    }, [action, internalState, executionCount, onExecute]);
    
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      // Handle Enter and Space as clicks
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick(event as any);
      }
    }, [handleClick]);
    
    const isDisabled = action.disabled || 
                      internalState === 'loading' || 
                      (action.executionLimit && executionCount >= action.executionLimit);
    
    const ariaLabel = createActionAriaLabel({
      ...action,
      loading: internalState === 'loading',
      disabled: isDisabled
    });
    
    const renderIcon = () => {
      if (internalState === 'loading') {
        return <LoadingSpinner />;
      }
      
      if (action.icon) {
        return (
          <IconWrapper className="action-icon" aria-hidden="true">
            {action.icon}
          </IconWrapper>
        );
      }
      
      return null;
    };
    
    return (
      <ActionButton
        ref={ref || buttonRef}
        type="button"
        priority={action.priority}
        variant={action.variant || 'tertiary'}
        state={internalState}
        alertPriority={alertPriority}
        hasIcon={Boolean(action.icon)}
        disabled={isDisabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-describedby={action.description ? `${action.id}-desc` : undefined}
        data-testid={testId || `alert-action-${action.id}`}
        data-action-type={action.type}
        data-action-priority={action.priority}
        data-state={internalState}
        title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
      >
        {renderIcon()}
        <span>{action.label}</span>
        
        {/* State indicator for non-idle states */}
        <StateIndicator state={internalState} />
        
        {/* Hidden description for screen readers */}
        {action.description && (
          <span 
            id={`${action.id}-desc`}
            style={{ 
              position: 'absolute', 
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden'
            }}
          >
            {action.description}
          </span>
        )}
      </ActionButton>
    );
  }
);

AlertActionButton.displayName = 'AlertActionButton';