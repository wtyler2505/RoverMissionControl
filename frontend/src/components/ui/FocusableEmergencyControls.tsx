/**
 * FocusableEmergencyControls Component
 * Critical emergency controls with enhanced focus management and accessibility
 * Designed for mission-critical situations with clear visual and audio feedback
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { useFocusManagement } from '../../contexts/FocusManagementContext';
import { emergencyFocusStyles } from '../../theme/focusStyles';
import { Theme } from '../../theme/themes';

interface EmergencyControlsProps {
  /**
   * Whether emergency stop is currently active
   */
  emergencyStop: boolean;
  /**
   * Callback when emergency stop is triggered
   */
  onEmergencyStop: () => void;
  /**
   * Callback when resume is triggered
   */
  onResume: () => void;
  /**
   * Additional emergency actions
   */
  onSafeShutdown?: () => void;
  onReboot?: () => void;
  /**
   * Whether controls are disabled
   */
  disabled?: boolean;
  /**
   * Test ID for testing
   */
  testId?: string;
  /**
   * Additional CSS class
   */
  className?: string;
}

const emergencyPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px rgba(220, 38, 38, 0.5);
    border-color: #dc2626;
  }
  50% {
    box-shadow: 0 0 20px rgba(220, 38, 38, 0.8), 0 0 30px rgba(220, 38, 38, 0.4);
    border-color: #ef4444;
  }
`;

const EmergencyContainer = styled.div<{
  theme: Theme;
  emergencyActive: boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[4]};
  border: 3px solid ${({ theme, emergencyActive }) => 
    emergencyActive ? theme.colors.error.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: ${({ theme, emergencyActive }) => 
    emergencyActive 
      ? `linear-gradient(135deg, ${theme.colors.error.main}10, ${theme.colors.error.main}05)`
      : theme.colors.background.paper};
  
  ${({ emergencyActive }) => emergencyActive && css`
    animation: ${emergencyPulse} 2s infinite;
  `}
  
  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
    border-color: ${({ theme }) => theme.colors.error.main};
  }
`;

const EmergencyButton = styled.button<{
  theme: Theme;
  variant: 'emergency' | 'resume' | 'shutdown' | 'reboot';
  size?: 'large' | 'medium';
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ size = 'large', theme }) => 
    size === 'large' 
      ? `${theme.spacing[4]} ${theme.spacing[6]}` 
      : `${theme.spacing[3]} ${theme.spacing[4]}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ size = 'large', theme }) => 
    size === 'large' 
      ? theme.typography.fontSize.lg 
      : theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 3px solid;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  min-height: ${({ size = 'large' }) => size === 'large' ? '60px' : '48px'};
  
  /* Variant styles */
  ${({ variant, theme }) => {
    switch (variant) {
      case 'emergency':
        return css`
          background: ${theme.colors.error.main};
          color: ${theme.colors.error.contrast};
          border-color: ${theme.colors.error.dark};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.error.dark};
            transform: scale(1.02);
          }
          
          &:active:not(:disabled) {
            transform: scale(0.98);
          }
          
          ${emergencyFocusStyles(theme)}
        `;
        
      case 'resume':
        return css`
          background: ${theme.colors.success.main};
          color: ${theme.colors.success.contrast};
          border-color: ${theme.colors.success.dark};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.success.dark};
            transform: scale(1.02);
          }
          
          &:active:not(:disabled) {
            transform: scale(0.98);
          }
          
          ${emergencyFocusStyles(theme)}
        `;
        
      case 'shutdown':
        return css`
          background: ${theme.colors.warning.main};
          color: ${theme.colors.warning.contrast};
          border-color: ${theme.colors.warning.dark};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.warning.dark};
            transform: scale(1.02);
          }
          
          ${emergencyFocusStyles(theme)}
        `;
        
      case 'reboot':
        return css`
          background: ${theme.colors.primary.main};
          color: ${theme.colors.primary.contrast};
          border-color: ${theme.colors.primary.dark};
          
          &:hover:not(:disabled) {
            background: ${theme.colors.primary.dark};
            transform: scale(1.02);
          }
          
          ${emergencyFocusStyles(theme)}
        `;
    }
  }}
  
  /* Disabled state */
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 4px;
    font-weight: 900;
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none !important;
    
    &:hover:not(:disabled) {
      transform: none !important;
    }
  }
`;

const ConfirmationDialog = styled.div<{
  theme: Theme;
  visible: boolean;
}>`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background.tooltip};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 2px solid ${({ theme }) => theme.colors.warning.main};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  white-space: nowrap;
  opacity: ${({ visible }) => visible ? 1 : 0};
  visibility: ${({ visible }) => visible ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 100;
  box-shadow: ${({ theme }) => theme.shadows.lg};
  
  &::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid ${({ theme }) => theme.colors.background.tooltip};
  }
`;

const StatusIndicator = styled.div<{
  theme: Theme;
  status: 'normal' | 'emergency' | 'shutdown';
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme, status }) => {
    switch (status) {
      case 'emergency': return theme.colors.error.main + '20';
      case 'shutdown': return theme.colors.warning.main + '20';
      default: return theme.colors.success.main + '20';
    }
  }};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  
  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ theme, status }) => {
      switch (status) {
        case 'emergency': return theme.colors.error.main;
        case 'shutdown': return theme.colors.warning.main;
        default: return theme.colors.success.main;
      }
    }};
    
    ${({ status }) => status === 'emergency' && css`
      animation: ${emergencyPulse} 1s infinite;
    `}
  }
  
  @media (prefers-reduced-motion: reduce) {
    .status-dot {
      animation: none !important;
    }
  }
`;

export const FocusableEmergencyControls: React.FC<EmergencyControlsProps> = ({
  emergencyStop,
  onEmergencyStop,
  onResume,
  onSafeShutdown,
  onReboot,
  disabled = false,
  testId,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  const [confirmationTimer, setConfirmationTimer] = useState<NodeJS.Timeout | null>(null);
  const { focusVisible, routerFocus } = useFocusManagement();

  // Auto-hide confirmation after 5 seconds
  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => {
        setShowConfirmation(null);
      }, 5000);
      setConfirmationTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [showConfirmation]);

  // Emergency stop handler with immediate action
  const handleEmergencyStop = useCallback(() => {
    if (disabled) return;
    
    // Immediate action - no confirmation needed for emergency stop
    onEmergencyStop();
    
    // Announce to screen readers
    routerFocus.announceToScreenReader('Emergency stop activated! All rover systems halted immediately.');
  }, [disabled, onEmergencyStop, routerFocus]);

  // Resume handler
  const handleResume = useCallback(() => {
    if (disabled) return;
    
    onResume();
    
    // Announce to screen readers
    routerFocus.announceToScreenReader('Rover operations resumed. Systems are now active.');
  }, [disabled, onResume, routerFocus]);

  // Safe shutdown with confirmation
  const handleSafeShutdown = useCallback(() => {
    if (disabled || !onSafeShutdown) return;
    
    if (showConfirmation === 'shutdown') {
      // Execute shutdown
      onSafeShutdown();
      setShowConfirmation(null);
      routerFocus.announceToScreenReader('Safe shutdown initiated. All systems powering down.');
    } else {
      // Show confirmation
      setShowConfirmation('shutdown');
      routerFocus.announceToScreenReader('Safe shutdown requested. Press again to confirm or wait 5 seconds to cancel.');
    }
  }, [disabled, onSafeShutdown, showConfirmation, routerFocus]);

  // Reboot with confirmation
  const handleReboot = useCallback(() => {
    if (disabled || !onReboot) return;
    
    if (showConfirmation === 'reboot') {
      // Execute reboot
      onReboot();
      setShowConfirmation(null);
      routerFocus.announceToScreenReader('System reboot initiated. Rover will restart momentarily.');
    } else {
      // Show confirmation
      setShowConfirmation('reboot');
      routerFocus.announceToScreenReader('Reboot requested. Press again to confirm or wait 5 seconds to cancel.');
    }
  }, [disabled, onReboot, showConfirmation, routerFocus]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global emergency stop (Space or Escape)
      if ((e.key === ' ' || e.key === 'Escape') && !e.target || 
          (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        handleEmergencyStop();
        return;
      }
      
      // Other shortcuts only if container is focused
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      switch (e.key.toLowerCase()) {
        case 'r':
          if (emergencyStop) {
            e.preventDefault();
            handleResume();
          }
          break;
          
        case 's':
          if (e.shiftKey && onSafeShutdown) {
            e.preventDefault();
            handleSafeShutdown();
          }
          break;
          
        case 'b':
          if (e.shiftKey && onReboot) {
            e.preventDefault();
            handleReboot();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [emergencyStop, handleEmergencyStop, handleResume, handleSafeShutdown, handleReboot, onSafeShutdown, onReboot]);

  const getSystemStatus = (): 'normal' | 'emergency' | 'shutdown' => {
    if (emergencyStop) return 'emergency';
    if (disabled) return 'shutdown';
    return 'normal';
  };

  const getStatusText = () => {
    switch (getSystemStatus()) {
      case 'emergency': return 'EMERGENCY STOP ACTIVE';
      case 'shutdown': return 'SYSTEMS OFFLINE';
      default: return 'SYSTEMS OPERATIONAL';
    }
  };

  return (
    <EmergencyContainer
      ref={containerRef}
      emergencyActive={emergencyStop}
      className={className}
      data-testid={testId}
      role="group"
      aria-labelledby="emergency-controls-title"
    >
      <h2 id="emergency-controls-title" className="sr-only">
        Emergency Controls
      </h2>
      
      <StatusIndicator status={getSystemStatus()}>
        <div className="status-dot" aria-hidden="true" />
        <span>{getStatusText()}</span>
      </StatusIndicator>

      <div style={{ position: 'relative' }}>
        {!emergencyStop ? (
          <EmergencyButton
            variant="emergency"
            size="large"
            onClick={handleEmergencyStop}
            disabled={disabled}
            aria-label="Emergency stop - Immediately halt all rover operations"
            {...focusVisible.getFocusVisibleProps()}
          >
            🛑 EMERGENCY STOP
          </EmergencyButton>
        ) : (
          <EmergencyButton
            variant="resume"
            size="large"
            onClick={handleResume}
            disabled={disabled}
            aria-label="Resume operations - Restart rover systems"
            {...focusVisible.getFocusVisibleProps()}
          >
            ▶️ RESUME OPERATIONS
          </EmergencyButton>
        )}
      </div>

      {/* Secondary controls */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {onSafeShutdown && (
          <div style={{ position: 'relative' }}>
            <EmergencyButton
              variant="shutdown"
              size="medium"
              onClick={handleSafeShutdown}
              disabled={disabled}
              aria-label="Safe shutdown - Power down all rover systems safely"
              {...focusVisible.getFocusVisibleProps()}
            >
              🔌 SAFE SHUTDOWN
            </EmergencyButton>
            
            <ConfirmationDialog visible={showConfirmation === 'shutdown'}>
              Press again to confirm shutdown
            </ConfirmationDialog>
          </div>
        )}

        {onReboot && (
          <div style={{ position: 'relative' }}>
            <EmergencyButton
              variant="reboot"
              size="medium"
              onClick={handleReboot}
              disabled={disabled}
              aria-label="Reboot system - Restart all rover systems"
              {...focusVisible.getFocusVisibleProps()}
            >
              🔄 REBOOT
            </EmergencyButton>
            
            <ConfirmationDialog visible={showConfirmation === 'reboot'}>
              Press again to confirm reboot
            </ConfirmationDialog>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts help */}
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
        Shortcuts: Space/Esc = Emergency Stop{emergencyStop ? ' • R = Resume' : ''}
        {onSafeShutdown ? ' • Shift+S = Shutdown' : ''}
        {onReboot ? ' • Shift+B = Reboot' : ''}
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {emergencyStop ? 'Emergency stop is active. All rover systems are halted.' : ''}
      </div>
    </EmergencyContainer>
  );
};

export default FocusableEmergencyControls;