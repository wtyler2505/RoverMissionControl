import React, { forwardRef, useMemo } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { AlertPriority, priorityAnimations, priorityIconStyles } from '../../../../theme/alertPriorities';
import { transitionStyles, focusStyles } from '../utils';
import { BaseComponentProps } from '../types';
import { AlertAction, AlertActionGroup } from './types/AlertActionTypes';
import { AlertActions } from './components/AlertActions';
import { RichContent, RichContentConfig } from './types/RichContentTypes';
import { RichContentContainer } from './components/RichContentContainer';

export interface PriorityAlertProps extends BaseComponentProps {
  priority: AlertPriority;
  title?: string;
  message: string;
  closable?: boolean;
  onClose?: () => void;
  icon?: React.ReactNode | boolean;
  action?: React.ReactNode;
  timestamp?: Date;
  persistent?: boolean;
  requiresAcknowledgment?: boolean;
  onAcknowledge?: () => void;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  
  // Enhanced Action System
  actions?: AlertAction[] | AlertActionGroup[];
  actionsLayout?: 'inline' | 'stacked' | 'dropdown';
  maxVisibleActions?: number;
  enableKeyboardNavigation?: boolean;
  enableActionConfirmations?: boolean;
  
  // Action Event Handlers
  onActionStart?: (actionId: string) => void;
  onActionComplete?: (actionId: string, result: any) => void;
  onActionError?: (actionId: string, error: Error) => void;
  
  // Rich Content Support
  richContent?: RichContent[];
  richContentConfig?: RichContentConfig;
  
  // Rich Content Event Handlers
  onRichContentLoad?: (contentId: string) => void;
  onRichContentError?: (contentId: string, error: Error) => void;
  onRichContentInteraction?: (contentId: string, action: string, data?: any) => void;
}

// Animation keyframes
const pulse = keyframes`
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

const slideInFromTop = keyframes`
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const slideInWithPulse = keyframes`
  0% {
    transform: translateY(-100%) scale(0.9);
    opacity: 0;
  }
  60% {
    transform: translateY(0) scale(1.02);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const getAnimationStyles = (priority: AlertPriority) => {
  const config = priorityAnimations[priority];
  const animations: Record<string, any> = {
    slideInWithPulse,
    slideInFromTop,
    fadeIn,
  };
  
  return css`
    animation: ${animations[config.entrance] || fadeIn} ${config.duration} ${config.easing} forwards;
  `;
};

const AlertContainer = styled.div<{
  theme: Theme;
  priority: AlertPriority;
}>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[4]};
  border: 2px solid;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  position: relative;
  overflow: hidden;
  
  ${({ theme, priority }) => {
    const priorityColors = theme.alertPriorities![priority];
    return css`
      background-color: ${priorityColors.background};
      border-color: ${priorityColors.border};
      color: ${priorityColors.text};
      
      &:hover {
        background-color: ${priorityColors.hover};
      }
    `;
  }}
  
  ${({ priority }) => getAnimationStyles(priority)}
  ${({ theme }) => transitionStyles(theme, ['background-color', 'border-color'])}
  
  /* Priority indicator bar */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background-color: ${({ theme, priority }) => theme.alertPriorities![priority].border};
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border-width: 3px;
    
    &::before {
      width: 6px;
    }
  }
`;

const IconWrapper = styled.span<{ 
  theme: Theme;
  priority: AlertPriority;
}>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ priority }) => priorityIconStyles[priority].size};
  height: ${({ priority }) => priorityIconStyles[priority].size};
  color: ${({ theme, priority }) => theme.alertPriorities![priority].icon};
  
  ${({ priority }) => priority === 'critical' && css`
    animation: ${pulse} 1s infinite;
  `}
`;

const ContentWrapper = styled.div<{ theme: Theme }>`
  flex: 1;
  min-width: 0;
`;

const AlertHeader = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`;

const AlertTitle = styled.h4<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  margin: 0;
`;

const AlertTimestamp = styled.time<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  opacity: 0.7;
  white-space: nowrap;
  margin-left: ${({ theme }) => theme.spacing[3]};
`;

const AlertMessage = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: inherit;
  
  & > *:last-child {
    margin-bottom: 0;
  }
`;

const ActionWrapper = styled.div<{ theme: Theme }>`
  margin-top: ${({ theme }) => theme.spacing[3]};
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const EnhancedActionWrapper = styled.div<{ theme: Theme }>`
  margin-top: ${({ theme }) => theme.spacing[4]};
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    padding-top: ${({ theme }) => theme.spacing[1]};
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

const CloseButton = styled.button<{ 
  theme: Theme;
  priority: AlertPriority;
}>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  color: ${({ theme, priority }) => theme.alertPriorities![priority].text};
  opacity: 0.7;
  
  ${({ theme }) => transitionStyles(theme, ['opacity', 'background-color'])}
  
  &:hover {
    opacity: 1;
    background-color: ${({ theme, priority }) => theme.alertPriorities![priority].hover};
  }
  
  ${({ theme }) => focusStyles(theme)}
`;

const AcknowledgmentSection = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-top: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

const AcknowledgmentBadge = styled.span<{ 
  theme: Theme;
  status: 'required' | 'acknowledged';
}>`
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  
  ${({ theme, status }) => {
    if (status === 'acknowledged') {
      return css`
        background: ${theme.colors.success}22;
        color: ${theme.colors.success};
      `;
    } else {
      return css`
        background: ${theme.colors.warning}22;
        color: ${theme.colors.warning};
        animation: ${pulse} 2s infinite;
      `;
    }
  }}
`;

const AcknowledgeButton = styled.button<{ 
  theme: Theme;
  priority: AlertPriority;
}>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme, priority }) => theme.alertPriorities![priority].border};
  color: ${({ theme }) => theme.colors.surface};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'transform'])}
  ${({ theme }) => focusStyles(theme)}
  
  &:hover {
    background: ${({ theme, priority }) => theme.alertPriorities![priority].text};
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const AckInfo = styled.div<{ theme: Theme }>`
  flex: 1;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const getDefaultIcon = (priority: AlertPriority) => {
  const icons = {
    critical: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    ),
    high: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
    ),
    medium: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    low: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
  };
  
  return icons[priority];
};

export const PriorityAlert = forwardRef<HTMLDivElement, PriorityAlertProps>(
  (
    {
      priority,
      title,
      message,
      closable = false,
      onClose,
      icon,
      action,
      timestamp,
      persistent = false,
      requiresAcknowledgment = false,
      onAcknowledge,
      acknowledged = false,
      acknowledgedBy,
      acknowledgedAt,
      
      // Enhanced Action System
      actions,
      actionsLayout = 'inline',
      maxVisibleActions = 3,
      enableKeyboardNavigation = true,
      enableActionConfirmations = true,
      onActionStart,
      onActionComplete,
      onActionError,
      
      // Rich Content Support
      richContent,
      richContentConfig,
      onRichContentLoad,
      onRichContentError,
      onRichContentInteraction,
      
      testId,
      className,
      ...props
    },
    ref
  ) => {
    const showIcon = icon !== false;
    const iconElement = icon === true || icon === undefined ? getDefaultIcon(priority) : icon;
    
    const formattedTime = useMemo(() => {
      if (!timestamp) return null;
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }).format(timestamp);
    }, [timestamp]);
    
    // Generate unique alert ID for action tracking
    const alertId = useMemo(() => {
      return testId || `alert-${priority}-${Date.now()}`;
    }, [priority, testId]);
    
    return (
      <AlertContainer
        ref={ref}
        priority={priority}
        className={className}
        role="alert"
        aria-live={priority === 'critical' ? 'assertive' : 'polite'}
        aria-atomic="true"
        data-testid={testId}
        data-priority={priority}
        data-persistent={persistent}
        {...props}
      >
        {showIcon && iconElement && (
          <IconWrapper 
            priority={priority}
            className="alert-icon" 
            aria-hidden="true"
          >
            {iconElement}
          </IconWrapper>
        )}
        
        <ContentWrapper>
          {(title || timestamp) && (
            <AlertHeader>
              {title && <AlertTitle>{title}</AlertTitle>}
              {formattedTime && (
                <AlertTimestamp dateTime={timestamp!.toISOString()}>
                  {formattedTime}
                </AlertTimestamp>
              )}
            </AlertHeader>
          )}
          
          <AlertMessage>
            {message}
          </AlertMessage>
          
          {/* Rich Content Support */}
          {richContent && richContent.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <RichContentContainer
                content={richContent}
                config={richContentConfig}
                alertId={alertId}
                alertPriority={priority}
                onContentLoad={onRichContentLoad}
                onContentError={onRichContentError}
                onInteraction={onRichContentInteraction}
              />
            </div>
          )}
          
          {/* Legacy action support */}
          {action && !actions && (
            <ActionWrapper>
              {action}
            </ActionWrapper>
          )}
          
          {/* Enhanced action system */}
          {actions && actions.length > 0 && (
            <EnhancedActionWrapper>
              <AlertActions
                actions={actions}
                alertId={alertId}
                alertPriority={priority}
                layout={actionsLayout}
                maxVisible={maxVisibleActions}
                keyboard={{ 
                  enabled: enableKeyboardNavigation,
                  announceNavigation: true
                }}
                focus={{ 
                  focusOnOpen: true,
                  returnFocus: true
                }}
                confirmations={enableActionConfirmations}
                onActionStart={onActionStart}
                onActionComplete={onActionComplete}
                onActionError={onActionError}
                ariaLabel={`Actions for ${priority} priority alert`}
                ariaDescription={title ? `Actions for alert: ${title}` : undefined}
              />
            </EnhancedActionWrapper>
          )}

          {/* Acknowledgment section */}
          {requiresAcknowledgment && (
            <AcknowledgmentSection>
              {acknowledged ? (
                <>
                  <AcknowledgmentBadge status="acknowledged">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path fillRule="evenodd" d="M10.97 4.97a.75.75 0 0 1 .011 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L2.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.75.75 0 0 1 1.02-.022z" clipRule="evenodd" />
                    </svg>
                    Acknowledged
                  </AcknowledgmentBadge>
                  <AckInfo>
                    {acknowledgedBy && `by ${acknowledgedBy}`}
                    {acknowledgedAt && ` at ${new Intl.DateTimeFormat('en-US', {
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                    }).format(acknowledgedAt)}`}
                  </AckInfo>
                </>
              ) : (
                <>
                  <AcknowledgmentBadge status="required">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path fillRule="evenodd" d="M6 12A6 6 0 1 0 6 0a6 6 0 0 0 0 12zM6 3a.75.75 0 0 1 .75.75V7.5a.75.75 0 0 1-1.5 0V3.75A.75.75 0 0 1 6 3zm0 6.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" clipRule="evenodd" />
                    </svg>
                    Acknowledgment Required
                  </AcknowledgmentBadge>
                  <AckInfo>
                    This {priority} priority alert requires acknowledgment
                  </AckInfo>
                  {onAcknowledge && (
                    <AcknowledgeButton
                      priority={priority}
                      onClick={onAcknowledge}
                      aria-label="Acknowledge alert"
                    >
                      Acknowledge
                    </AcknowledgeButton>
                  )}
                </>
              )}
            </AcknowledgmentSection>
          )}
        </ContentWrapper>
        
        {closable && !requiresAcknowledgment && (
          <CloseButton
            priority={priority}
            onClick={onClose}
            aria-label="Close alert"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </CloseButton>
        )}
      </AlertContainer>
    );
  }
);

PriorityAlert.displayName = 'PriorityAlert';