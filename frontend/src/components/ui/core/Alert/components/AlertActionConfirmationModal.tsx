/**
 * AlertActionConfirmationModal Component
 * Provides confirmation dialogs for destructive or complex actions
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { AlertAction, ConfirmationType } from '../types/AlertActionTypes';
import { focusStyles, transitionStyles } from '../../utils';

interface AlertActionConfirmationModalProps {
  action: AlertAction;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
}

const Backdrop = styled.div<{ theme: Theme; open: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: ${({ open }) => open ? 1 : 0};
  visibility: ${({ open }) => open ? 'visible' : 'hidden'};
  
  ${({ theme }) => transitionStyles(theme, ['opacity', 'visibility'])}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    background-color: rgba(0, 0, 0, 0.8);
  }
`;

const Modal = styled.div<{ theme: Theme; confirmationType: ConfirmationType }>`
  position: relative;
  background: ${({ theme }) => theme.colors.background.paper};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  max-width: 500px;
  max-height: 90vh;
  width: 90%;
  margin: ${({ theme }) => theme.spacing[4]};
  overflow: hidden;
  
  ${({ theme, confirmationType }) => {
    if (confirmationType === 'destructive') {
      return css`
        border: 2px solid ${theme.colors.error.main};
      `;
    }
    return '';
  }}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border: 3px solid ${({ theme }) => theme.colors.text.primary};
  }
  
  /* Animation */
  transform: scale(0.95);
  opacity: 0;
  animation: modalEnter 0.2s ease-out forwards;
  
  @keyframes modalEnter {
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: none;
    opacity: 1;
  }
`;

const Header = styled.div<{ theme: Theme; confirmationType: ConfirmationType }>`
  padding: ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[4]};
  text-align: center;
  
  ${({ theme, confirmationType }) => {
    if (confirmationType === 'destructive') {
      return css`
        background: linear-gradient(135deg, 
          ${theme.colors.error.main}10, 
          ${theme.colors.error.main}05
        );
        border-bottom: 1px solid ${theme.colors.error.main}20;
      `;
    }
    return css`
      border-bottom: 1px solid ${theme.colors.divider};
    `;
  }}
`;

const IconWrapper = styled.div<{ theme: Theme; confirmationType: ConfirmationType }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto ${({ theme }) => theme.spacing[4]};
  border-radius: 50%;
  
  ${({ theme, confirmationType }) => {
    switch (confirmationType) {
      case 'destructive':
        return css`
          background-color: ${theme.colors.error.main}20;
          color: ${theme.colors.error.main};
        `;
      case 'complex':
        return css`
          background-color: ${theme.colors.warning.main}20;
          color: ${theme.colors.warning.main};
        `;
      default:
        return css`
          background-color: ${theme.colors.info.main}20;
          color: ${theme.colors.info.main};
        `;
    }
  }}
`;

const Title = styled.h2<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const Description = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const Content = styled.div<{ theme: Theme }>`
  padding: 0 ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[4]};
`;

const ActionDetails = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.elevated};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
  margin: ${({ theme }) => theme.spacing[4]} 0;
`;

const ActionLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const ActionDescription = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const Footer = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[6]} ${({ theme }) => theme.spacing[6]};
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  justify-content: flex-end;
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;

const Button = styled.button<{ 
  theme: Theme; 
  variant: 'primary' | 'secondary' | 'danger';
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  border: 2px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  user-select: none;
  min-height: 40px;
  min-width: 80px;
  
  ${({ theme, variant }) => {
    switch (variant) {
      case 'danger':
        return css`
          background-color: ${theme.colors.error.main};
          color: ${theme.colors.error.contrast};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.error.dark};
          }
        `;
      case 'primary':
        return css`
          background-color: ${theme.colors.primary.main};
          color: ${theme.colors.primary.contrast};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.primary.dark};
          }
        `;
      case 'secondary':
      default:
        return css`
          background-color: transparent;
          color: ${theme.colors.text.primary};
          border-color: ${theme.colors.divider};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.background.elevated};
            border-color: ${theme.colors.text.secondary};
          }
        `;
    }
  }}
  
  ${({ theme }) => focusStyles(theme)}
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color', 'border-color'])}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`;

const CloseButton = styled.button<{ theme: Theme }>`
  position: absolute;
  top: ${({ theme }) => theme.spacing[4]};
  right: ${({ theme }) => theme.spacing[4]};
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  
  ${({ theme }) => focusStyles(theme)}
  ${({ theme }) => transitionStyles(theme, ['color', 'background-color'])}
  
  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.background.elevated};
  }
`;

const getConfirmationIcon = (type: ConfirmationType) => {
  switch (type) {
    case 'destructive':
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      );
    case 'complex':
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
        </svg>
      );
    default:
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      );
  }
};

export const AlertActionConfirmationModal: React.FC<AlertActionConfirmationModalProps> = ({
  action,
  open,
  onConfirm,
  onCancel,
  onClose
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  
  // Focus management
  useEffect(() => {
    if (open) {
      // Focus the cancel button by default for safety
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 100);
    }
  }, [open]);
  
  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirm]);
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }, [onCancel]);
  
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }, [onCancel]);
  
  if (!open) return null;
  
  const confirmationType = action.confirmation || 'simple';
  const title = action.confirmationTitle || `Confirm ${action.label}`;
  const message = action.confirmationMessage || 
    `Are you sure you want to ${action.label.toLowerCase()}? This action cannot be undone.`;
  
  return (
    <Backdrop 
      open={open} 
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
    >
      <Modal 
        confirmationType={confirmationType}
        onKeyDown={handleKeyDown}
      >
        <CloseButton onClick={onClose} aria-label="Close confirmation dialog">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </CloseButton>
        
        <Header confirmationType={confirmationType}>
          <IconWrapper confirmationType={confirmationType}>
            {getConfirmationIcon(confirmationType)}
          </IconWrapper>
          <Title id="confirmation-title">{title}</Title>
          <Description id="confirmation-description">{message}</Description>
        </Header>
        
        {(action.description || confirmationType === 'complex') && (
          <Content>
            <ActionDetails>
              <ActionLabel>Action: {action.label}</ActionLabel>
              {action.description && (
                <ActionDescription>{action.description}</ActionDescription>
              )}
            </ActionDetails>
          </Content>
        )}
        
        <Footer>
          <Button
            ref={cancelButtonRef}
            variant="secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={confirmationType === 'destructive' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'Processing...' : action.label}
          </Button>
        </Footer>
      </Modal>
    </Backdrop>
  );
};