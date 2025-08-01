/**
 * Visual Implementation Guide for Priority-Based Alert System
 * 
 * This file provides concrete TypeScript interfaces, styled components examples,
 * and implementation patterns for the priority-based alert system design.
 * 
 * @author Mission Control UI Team
 * @version 1.0.0
 */

import React from 'react';
import styled, { css, keyframes } from '@emotion/styled';
import { Theme } from '../../../../theme/themes';

// ========== Priority System Types ==========

export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface PriorityAlert {
  id: string;
  priority: AlertPriority;
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  category: 'SAFETY' | 'HARDWARE' | 'MISSION' | 'COMMUNICATION' | 'SYSTEM' | 'USER';
  acknowledged?: boolean;
  dismissed?: boolean;
  actions?: AlertAction[];
  metadata?: {
    escalationTime?: number;
    maxDisplayTime?: number;
    soundEnabled?: boolean;
    persistsAcrossSessions?: boolean;
  };
}

export interface AlertAction {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'tertiary';
  handler: () => void | Promise<void>;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// ========== Priority Configuration ==========

export const PRIORITY_CONFIG: Record<AlertPriority, {
  level: number;
  label: string;
  duration: number | null; // null = persistent
  canAutoEscalate: boolean;
  escalationTime: number; // minutes
  soundEnabled: boolean;
  blockingBehavior: 'modal' | 'toast' | 'subtle';
  zIndex: number;
}> = {
  CRITICAL: {
    level: 1,
    label: 'Critical',
    duration: null, // Persistent until acknowledged
    canAutoEscalate: true,
    escalationTime: 2,
    soundEnabled: true,
    blockingBehavior: 'modal',
    zIndex: 1090
  },
  HIGH: {
    level: 2,
    label: 'High Priority',
    duration: 300000, // 5 minutes
    canAutoEscalate: true,
    escalationTime: 10,
    soundEnabled: false,
    blockingBehavior: 'toast',
    zIndex: 1080
  },
  MEDIUM: {
    level: 3,
    label: 'Medium Priority',
    duration: 30000, // 30 seconds
    canAutoEscalate: false,
    escalationTime: 0,
    soundEnabled: false,
    blockingBehavior: 'toast',
    zIndex: 1070
  },
  LOW: {
    level: 4,
    label: 'Low Priority',
    duration: 15000, // 15 seconds
    canAutoEscalate: false,
    escalationTime: 0,
    soundEnabled: false,
    blockingBehavior: 'toast',
    zIndex: 1060
  },
  INFO: {
    level: 5,
    label: 'Information',
    duration: 10000, // 10 seconds
    canAutoEscalate: false,
    escalationTime: 0,
    soundEnabled: false,
    blockingBehavior: 'subtle',
    zIndex: 1050
  }
};

// ========== Animation Keyframes ==========

const pulseAnimation = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
`;

const borderPulseAnimation = keyframes`
  0% { border-color: currentColor; border-width: 2px; }
  50% { border-color: rgba(255, 82, 82, 0.8); border-width: 3px; }
  100% { border-color: currentColor; border-width: 2px; }
`;

const slideInFromRight = keyframes`
  0% {
    transform: translateX(100%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideInFromTop = keyframes`
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

const scaleInModal = keyframes`
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

// ========== Priority Styling Functions ==========

const getPriorityColors = (theme: Theme, priority: AlertPriority) => {
  const colorMap = {
    CRITICAL: {
      background: `rgba(244, 67, 54, 0.95)`,
      border: theme.colors.error.dark,
      text: theme.colors.error.contrast,
      icon: theme.colors.error.contrast,
      glow: `0 0 16px rgba(244, 67, 54, 0.6)`
    },
    HIGH: {
      background: `${theme.colors.warning.light}20`,
      border: theme.colors.warning.main,
      text: theme.colors.warning.dark,
      icon: theme.colors.warning.main,
      glow: `0 0 12px rgba(237, 108, 2, 0.4)`
    },
    MEDIUM: {
      background: `${theme.colors.info.light}15`,
      border: theme.colors.info.main,
      text: theme.colors.info.dark,
      icon: theme.colors.info.main,
      glow: theme.shadows.md
    },
    LOW: {
      background: `${theme.colors.success.light}10`,
      border: theme.colors.success.main,
      text: theme.colors.success.dark,
      icon: theme.colors.success.main,
      glow: theme.shadows.sm
    },
    INFO: {
      background: `${theme.colors.neutral[600]}05`,
      border: theme.colors.neutral[300],
      text: theme.colors.neutral[700],
      icon: theme.colors.neutral[500],
      glow: 'none'
    }
  };

  return colorMap[priority];
};

const getPriorityAnimation = (priority: AlertPriority) => {
  const animationMap = {
    CRITICAL: css`
      animation: ${scaleInModal} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      
      &::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border: 2px solid;
        border-radius: inherit;
        animation: ${borderPulseAnimation} 1.5s ease-in-out infinite;
        pointer-events: none;
      }
    `,
    HIGH: css`
      animation: ${slideInFromTop} 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border: inherit;
        border-radius: inherit;
        animation: ${pulseAnimation} 2s ease-in-out 3;
        pointer-events: none;
      }
    `,
    MEDIUM: css`
      animation: ${slideInFromRight} 0.25s ease-out;
    `,
    LOW: css`
      animation: ${slideInFromRight} 0.25s ease-out;
    `,
    INFO: css`
      animation: fadeIn 0.2s ease-out;
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `
  };

  return animationMap[priority];
};

const getPriorityDimensions = (priority: AlertPriority) => {
  const dimensionMap = {
    CRITICAL: css`
      min-height: 120px;
      max-width: 500px;
      width: 90vw;
      padding: 24px;
      border-width: 4px;
      
      @media (max-width: 768px) {
        width: 95vw;
        padding: 20px;
      }
    `,
    HIGH: css`
      min-height: 80px;
      width: 360px;
      padding: 20px;
      border-width: 3px;
      
      @media (max-width: 768px) {
        width: calc(100vw - 32px);
        padding: 16px;
      }
    `,
    MEDIUM: css`
      min-height: 60px;
      width: 300px;
      padding: 16px;
      border-width: 2px;
      
      @media (max-width: 768px) {
        width: calc(100vw - 32px);
        padding: 16px;
      }
    `,
    LOW: css`
      min-height: 50px;
      width: 280px;
      padding: 12px;
      border-width: 1px;
      
      @media (max-width: 768px) {
        width: calc(100vw - 32px);
        padding: 12px;
      }
    `,
    INFO: css`
      min-height: 40px;
      width: 260px;
      padding: 8px 12px;
      border-width: 1px;
      border-style: dashed;
      
      @media (max-width: 768px) {
        width: calc(100vw - 32px);
        padding: 8px 12px;
      }
    `
  };

  return dimensionMap[priority];
};

// ========== Styled Components ==========

export const AlertContainer = styled.div<{
  priority: AlertPriority;
  theme: Theme;
}>`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[3]};
  border: solid;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  z-index: ${({ priority }) => PRIORITY_CONFIG[priority].zIndex};
  
  /* Priority-specific styling */
  ${({ theme, priority }) => {
    const colors = getPriorityColors(theme, priority);
    return css`
      background-color: ${colors.background};
      border-color: ${colors.border};
      color: ${colors.text};
      box-shadow: ${colors.glow};
    `;
  }}
  
  /* Dimensions */
  ${({ priority }) => getPriorityDimensions(priority)}
  
  /* Animation */
  ${({ priority }) => getPriorityAnimation(priority)}
  
  /* Accessibility */
  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: ${({ priority }) => 
      priority === 'CRITICAL' ? '4px' : 
      priority === 'HIGH' ? '3px' : '2px'};
    background-color: ${({ theme, priority }) => 
      priority === 'CRITICAL' ? theme.colors.error.main : 'transparent'};
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    
    &::before,
    &::after {
      animation: none;
    }
  }
`;

export const AlertIcon = styled.div<{
  priority: AlertPriority;
  theme: Theme;
}>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ priority }) => {
    const sizeMap = {
      CRITICAL: '28px',
      HIGH: '24px',
      MEDIUM: '20px',
      LOW: '18px',
      INFO: '16px'
    };
    return sizeMap[priority];
  }};
  height: ${({ priority }) => {
    const sizeMap = {
      CRITICAL: '28px',
      HIGH: '24px',
      MEDIUM: '20px',
      LOW: '18px',
      INFO: '16px'
    };
    return sizeMap[priority];
  }};
  
  color: ${({ theme, priority }) => getPriorityColors(theme, priority).icon};
  
  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  
  /* Critical icon animation */
  ${({ priority }) => priority === 'CRITICAL' && css`
    animation: ${pulseAnimation} 1s ease-in-out infinite;
    
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `}
`;

export const AlertContent = styled.div<{ theme: Theme }>`
  flex: 1;
  min-width: 0;
`;

export const AlertTitle = styled.h3<{
  priority: AlertPriority;
  theme: Theme;
}>`
  margin: 0 0 ${({ theme }) => theme.spacing[1]} 0;
  font-size: ${({ priority, theme }) => {
    const sizeMap = {
      CRITICAL: theme.typography.fontSize.lg,
      HIGH: theme.typography.fontSize.base,
      MEDIUM: theme.typography.fontSize.base,
      LOW: theme.typography.fontSize.sm,
      INFO: theme.typography.fontSize.xs
    };
    return sizeMap[priority];
  }};
  font-weight: ${({ priority, theme }) => {
    const weightMap = {
      CRITICAL: theme.typography.fontWeight.bold,
      HIGH: theme.typography.fontWeight.semibold,
      MEDIUM: theme.typography.fontWeight.medium,
      LOW: theme.typography.fontWeight.regular,
      INFO: theme.typography.fontWeight.light
    };
    return weightMap[priority];
  }};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  color: inherit;
`;

export const AlertMessage = styled.div<{
  priority: AlertPriority;
  theme: Theme;
}>`
  font-size: ${({ priority, theme }) => {
    const sizeMap = {
      CRITICAL: theme.typography.fontSize.base,
      HIGH: theme.typography.fontSize.sm,
      MEDIUM: theme.typography.fontSize.sm,
      LOW: theme.typography.fontSize.xs,
      INFO: theme.typography.fontSize.xs
    };
    return sizeMap[priority];
  }};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  color: inherit;
  
  /* Ensure text wraps properly */
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

export const AlertActions = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-top: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
`;

export const AlertActionButton = styled.button<{
  variant: 'primary' | 'secondary' | 'tertiary';
  priority: AlertPriority;
  theme: Theme;
}>`
  padding: ${({ theme, priority }) => {
    const paddingMap = {
      CRITICAL: `${theme.spacing[3]} ${theme.spacing[4]}`,
      HIGH: `${theme.spacing[2]} ${theme.spacing[4]}`,
      MEDIUM: `${theme.spacing[2]} ${theme.spacing[3]}`,
      LOW: `${theme.spacing[1]} ${theme.spacing[3]}`,
      INFO: `${theme.spacing[1]} ${theme.spacing[2]}`
    };
    return paddingMap[priority];
  }};
  
  border: 1px solid;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  /* Variant styling */
  ${({ variant, theme, priority }) => {
    const colors = getPriorityColors(theme, priority);
    
    if (variant === 'primary') {
      return css`
        background-color: ${colors.border};
        border-color: ${colors.border};
        color: ${colors.background === 'transparent' ? theme.colors.neutral[0] : colors.text};
        
        &:hover {
          background-color: ${colors.icon};
          transform: translateY(-1px);
        }
        
        &:active {
          transform: translateY(0);
        }
      `;
    }
    
    if (variant === 'secondary') {
      return css`
        background-color: transparent;
        border-color: ${colors.border};
        color: ${colors.text};
        
        &:hover {
          background-color: ${colors.background};
        }
      `;
    }
    
    // Tertiary
    return css`
      background-color: transparent;
      border-color: transparent;
      color: ${colors.text};
      opacity: 0.8;
      
      &:hover {
        opacity: 1;
        text-decoration: underline;
      }
    `;
  }}
  
  /* Touch target optimization */
  min-height: 44px;
  min-width: 44px;
  
  @media (max-width: 768px) {
    min-height: 48px;
    padding: ${({ theme }) => `${theme.spacing[3]} ${theme.spacing[4]}`};
  }
  
  /* Focus styles */
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
  
  /* Disabled state */
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    
    &:hover {
      transform: none;
    }
  }
`;

export const AlertCloseButton = styled.button<{
  priority: AlertPriority;
  theme: Theme;
}>`
  position: absolute;
  top: ${({ theme }) => theme.spacing[2]};
  right: ${({ theme }) => theme.spacing[2]};
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  
  transition: all ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 1px;
    opacity: 1;
  }
  
  /* Critical alerts have larger close button */
  ${({ priority, theme }) => priority === 'CRITICAL' && css`
    width: 32px;
    height: 32px;
    top: ${theme.spacing[3]};
    right: ${theme.spacing[3]};
  `}
  
  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
`;

// ========== Modal Overlay for Critical Alerts ==========

export const CriticalAlertOverlay = styled.div<{ theme: Theme }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${PRIORITY_CONFIG.CRITICAL.zIndex};
  padding: ${({ theme }) => theme.spacing[4]};
  
  /* Backdrop animation */
  animation: backdropFadeIn 0.3s ease-out;
  
  @keyframes backdropFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// ========== Alert Queue Container ==========

export const AlertQueueContainer = styled.div<{ theme: Theme }>`
  position: fixed;
  top: ${({ theme }) => theme.spacing[4]};
  right: ${({ theme }) => theme.spacing[4]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  max-width: 400px;
  z-index: 1000;
  pointer-events: none;
  
  /* Allow interaction with alert content */
  > * {
    pointer-events: auto;
  }
  
  @media (max-width: 768px) {
    top: ${({ theme }) => theme.spacing[2]};
    right: ${({ theme }) => theme.spacing[2]};
    left: ${({ theme }) => theme.spacing[2]};
    max-width: none;
  }
`;

// ========== Priority Icons ==========

export const PriorityIcons = {
  CRITICAL: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"/>
    </svg>
  ),
  HIGH: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  ),
  MEDIUM: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  ),
  LOW: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
    </svg>
  ),
  INFO: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6h.01M12 10v6"/>
    </svg>
  )
};

// ========== Usage Example Component ==========

export const AlertSystemExample: React.FC = () => {
  const exampleAlerts: PriorityAlert[] = [
    {
      id: '1',
      priority: 'CRITICAL',
      title: 'Emergency Stop Activated',
      message: 'Rover has encountered an obstacle and emergency stop has been triggered. Immediate intervention required.',
      timestamp: new Date(),
      source: 'Safety System',
      category: 'SAFETY',
      actions: [
        {
          id: 'acknowledge',
          label: 'Acknowledge',
          variant: 'primary',
          handler: () => console.log('Critical alert acknowledged')
        },
        {
          id: 'details',
          label: 'View Details',
          variant: 'secondary',
          handler: () => console.log('Show details')
        }
      ]
    },
    {
      id: '2',
      priority: 'HIGH',
      title: 'Battery Level Low',
      message: 'Battery charge has dropped to 15%. Consider returning to charging station.',
      timestamp: new Date(),
      source: 'Power Management',
      category: 'HARDWARE',
      actions: [
        {
          id: 'return',
          label: 'Return to Base',
          variant: 'primary',
          handler: () => console.log('Returning to base')
        }
      ]
    },
    {
      id: '3',
      priority: 'MEDIUM',
      title: 'Mission Waypoint Reached',
      message: 'Successfully reached waypoint Alpha-7. Awaiting next instructions.',
      timestamp: new Date(),
      source: 'Navigation System',
      category: 'MISSION'
    }
  ];

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <h2>Priority-Based Alert System Examples</h2>
      
      <AlertQueueContainer>
        {exampleAlerts.map(alert => (
          <AlertContainer key={alert.id} priority={alert.priority}>
            <AlertIcon priority={alert.priority}>
              {React.createElement(PriorityIcons[alert.priority])}
            </AlertIcon>
            
            <AlertContent>
              <AlertTitle priority={alert.priority}>
                {alert.title}
              </AlertTitle>
              <AlertMessage priority={alert.priority}>
                {alert.message}
              </AlertMessage>
              
              {alert.actions && (
                <AlertActions>
                  {alert.actions.map(action => (
                    <AlertActionButton
                      key={action.id}
                      variant={action.variant}
                      priority={alert.priority}
                      onClick={action.handler}
                    >
                      {action.label}
                    </AlertActionButton>
                  ))}
                </AlertActions>
              )}
            </AlertContent>
            
            <AlertCloseButton priority={alert.priority}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </AlertCloseButton>
          </AlertContainer>
        ))}
      </AlertQueueContainer>
    </div>
  );
};

export default AlertSystemExample;