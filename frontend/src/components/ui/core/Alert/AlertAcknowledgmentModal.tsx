/**
 * Alert Acknowledgment Modal
 * Modal component for acknowledging critical and high priority alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { transitionStyles, focusStyles } from '../utils';
import { BaseComponentProps } from '../types';
import { PersistedAlert } from '../../../../services/persistence/AlertPersistenceService';

export interface AlertAcknowledgmentModalProps extends BaseComponentProps {
  alert: PersistedAlert | null;
  isOpen: boolean;
  onAcknowledge: (alertId: string, acknowledgedBy: string, reason?: string) => Promise<void>;
  onCancel: () => void;
  onClose: () => void;
  requireReason?: boolean;
  currentUser?: string;
}

// Animation keyframes
const modalEnter = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
`;

const overlayEnter = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
`;

const Overlay = styled.div<{ theme: Theme }>`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: ${({ theme }) => theme.spacing[4]};
  
  animation: ${overlayEnter} 0.2s ease-out;
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    background-color: rgba(0, 0, 0, 0.9);
  }
`;

const ModalContainer = styled.div<{ 
  theme: Theme;
  priority: AlertPriority;
  shake?: boolean;
}>`
  background: ${({ theme }) => theme.colors.surface};
  border: 2px solid ${({ theme, priority }) => theme.alertPriorities![priority].border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.boxShadow.xl};
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: auto;
  position: relative;
  
  animation: ${modalEnter} 0.3s ease-out;
  
  ${({ shake }) => shake && css`
    animation: ${shake} 0.5s ease-in-out;
  `}
  
  /* Glass effect */
  backdrop-filter: blur(16px);
  background: ${({ theme }) => `${theme.colors.surface}cc`};
  
  /* Priority glow effect */
  ${({ theme, priority }) => {
    const color = theme.alertPriorities![priority].border;
    return css`
      box-shadow: 
        0 0 0 1px ${color}33,
        0 8px 32px rgba(0, 0, 0, 0.32),
        0 0 24px ${color}22;
    `;
  }}
  
  @media (max-width: 768px) {
    margin: ${({ theme }) => theme.spacing[2]};
    max-height: calc(100vh - ${({ theme }) => theme.spacing[4]});
  }
`;

const ModalHeader = styled.header<{ 
  theme: Theme;
  priority: AlertPriority;
}>`
  padding: ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, priority }) => `${theme.alertPriorities![priority].background}22`};
  position: relative;
  
  /* Priority indicator stripe */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${({ theme, priority }) => theme.alertPriorities![priority].border};
  }
`;

const ModalTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const PriorityBadge = styled.span<{ 
  theme: Theme;
  priority: AlertPriority;
}>`
  background: ${({ theme, priority }) => theme.alertPriorities![priority].border};
  color: ${({ theme }) => theme.colors.surface};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const AlertInfo = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
  margin: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[6]};
`;

const AlertTitle = styled.h3<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
`;

const AlertMessage = styled.p<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0 0 ${({ theme }) => theme.spacing[3]} 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const AlertMeta = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.tertiary};
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`;

const MetaItem = styled.span<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const FormSection = styled.div<{ theme: Theme }>`
  padding: 0 ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[4]};
`;

const FormGroup = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const Label = styled.label<{ theme: Theme }>`
  display: block;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`;

const Input = styled.input<{ theme: Theme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  
  ${({ theme }) => transitionStyles(theme, ['border-color', 'box-shadow'])}
  ${({ theme }) => focusStyles(theme)}
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.tertiary};
  }
`;

const TextArea = styled.textarea<{ theme: Theme }>`
  width: 100%;
  min-height: 80px;
  padding: ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  resize: vertical;
  
  ${({ theme }) => transitionStyles(theme, ['border-color', 'box-shadow'])}
  ${({ theme }) => focusStyles(theme)}
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.tertiary};
  }
`;

const ModalFooter = styled.footer<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[6]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  justify-content: flex-end;
  
  @media (max-width: 768px) {
    flex-direction: column-reverse;
  }
`;

const Button = styled.button<{ 
  theme: Theme;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[6]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  border: none;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color', 'opacity'])}
  ${({ theme }) => focusStyles(theme)}
  
  ${({ theme, variant, disabled }) => {
    if (disabled) {
      return css`
        background: ${theme.colors.gray[300]};
        color: ${theme.colors.gray[500]};
        cursor: not-allowed;
      `;
    }
    
    switch (variant) {
      case 'primary':
        return css`
          background: ${theme.colors.primary};
          color: ${theme.colors.surface};
          
          &:hover {
            background: ${theme.colors.primaryHover};
          }
        `;
      case 'danger':
        return css`
          background: ${theme.colors.error};
          color: ${theme.colors.surface};
          
          &:hover {
            background: ${theme.colors.errorHover};
          }
        `;
      case 'secondary':
      default:
        return css`
          background: ${theme.colors.surface};
          color: ${theme.colors.text.primary};
          border: 1px solid ${theme.colors.border};
          
          &:hover {
            background: ${theme.colors.background};
          }
        `;
    }
  }}
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const CloseButton = styled.button<{ theme: Theme }>`
  position: absolute;
  top: ${({ theme }) => theme.spacing[4]};
  right: ${({ theme }) => theme.spacing[4]};
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.text.tertiary};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${({ theme }) => transitionStyles(theme, ['color', 'background-color'])}
  ${({ theme }) => focusStyles(theme)}
  
  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme }) => theme.colors.background};
  }
`;

export const AlertAcknowledgmentModal: React.FC<AlertAcknowledgmentModalProps> = ({
  alert,
  isOpen,
  onAcknowledge,
  onCancel,
  onClose,
  requireReason = false,
  currentUser = 'Unknown User',
  testId,
  className
}) => {
  const [acknowledgedBy, setAcknowledgedBy] = useState(currentUser);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showShake, setShowShake] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAcknowledgedBy(currentUser);
      setReason('');
      setIsSubmitting(false);
      setShowShake(false);
    }
  }, [isOpen, currentUser]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!alert || !acknowledgedBy.trim()) {
      setShowShake(true);
      setTimeout(() => setShowShake(false), 500);
      return;
    }

    if (requireReason && !reason.trim()) {
      setShowShake(true);
      setTimeout(() => setShowShake(false), 500);
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onAcknowledge(alert.id, acknowledgedBy.trim(), reason.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      setShowShake(true);
      setTimeout(() => setShowShake(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  }, [alert, acknowledgedBy, reason, requireReason, onAcknowledge, onClose]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  const formatTimestamp = useCallback((timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(timestamp);
  }, []);

  if (!isOpen || !alert) {
    return null;
  }

  return (
    <Overlay onClick={handleOverlayClick} data-testid={testId}>
      <ModalContainer
        priority={alert.priority}
        shake={showShake}
        className={className}
        role="dialog"
        aria-labelledby="acknowledgment-title"
        aria-describedby="acknowledgment-description"
        aria-modal="true"
      >
        <CloseButton
          onClick={onClose}
          aria-label="Close acknowledgment modal"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </CloseButton>

        <ModalHeader priority={alert.priority}>
          <ModalTitle id="acknowledgment-title">
            Alert Acknowledgment Required
            <PriorityBadge priority={alert.priority}>
              {alert.priority}
            </PriorityBadge>
          </ModalTitle>
        </ModalHeader>

        <AlertInfo>
          {alert.title && <AlertTitle>{alert.title}</AlertTitle>}
          <AlertMessage id="acknowledgment-description">
            {alert.message}
          </AlertMessage>
          <AlertMeta>
            <MetaItem>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zM8 3.5a.5.5 0 01.5.5v4a.5.5 0 01-1 0V4a.5.5 0 01.5-.5zM8 10a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
              {formatTimestamp(alert.timestamp)}
            </MetaItem>
            {alert.source && (
              <MetaItem>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zm1.5-.5a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-9z" clipRule="evenodd" />
                </svg>
                Source: {alert.source}
              </MetaItem>
            )}
          </AlertMeta>
        </AlertInfo>

        <form onSubmit={handleSubmit}>
          <FormSection>
            <FormGroup>
              <Label htmlFor="acknowledged-by">
                Acknowledged By *
              </Label>
              <Input
                id="acknowledged-by"
                type="text"
                value={acknowledgedBy}
                onChange={(e) => setAcknowledgedBy(e.target.value)}
                placeholder="Enter your name or identifier"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </FormGroup>

            {requireReason && (
              <FormGroup>
                <Label htmlFor="acknowledgment-reason">
                  Acknowledgment Reason *
                </Label>
                <TextArea
                  id="acknowledgment-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason for acknowledging this alert..."
                  required={requireReason}
                  disabled={isSubmitting}
                />
              </FormGroup>
            )}
          </FormSection>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isSubmitting || !acknowledgedBy.trim() || (requireReason && !reason.trim())}
            >
              {isSubmitting ? 'Acknowledging...' : 'Acknowledge Alert'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContainer>
    </Overlay>
  );
};