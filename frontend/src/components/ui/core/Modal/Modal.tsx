import React, { forwardRef, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { ModalProps, ModalSize, ModalVariant } from '../types';
import { Theme } from '../../../../theme/themes';
import { Button } from '../Button/Button';
import { useFocusManagement } from '../../../../contexts/FocusManagementContext';
import { useFocusTrap } from '../../../../hooks/useFocusTrap';
import {
  focusStyles,
  transitionStyles,
  generateId,
} from '../utils';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const slideIn = keyframes`
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const Backdrop = styled.div<{
  theme: Theme;
}>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: ${({ theme }) => theme.zIndex.modalBackdrop};
  animation: ${fadeIn} ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const getSizeStyles = (size: ModalSize) => {
  const sizes = {
    small: css`
      max-width: 400px;
    `,
    medium: css`
      max-width: 600px;
    `,
    large: css`
      max-width: 800px;
    `,
    fullscreen: css`
      width: 100vw;
      height: 100vh;
      max-width: 100%;
      max-height: 100%;
      margin: 0;
      border-radius: 0;
    `,
  };
  
  return sizes[size];
};

const ModalContainer = styled.div<{
  theme: Theme;
  size: ModalSize;
}>`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  z-index: ${({ theme }) => theme.zIndex.modal};
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 90%;
  
  ${({ size }) => getSizeStyles(size)}
  
  animation: ${slideIn} ${({ theme }) => theme.transitions.duration.slow} ${({ theme }) => theme.transitions.timing.ease};
  
  @media (prefers-reduced-motion: reduce) {
    animation: ${fadeIn} ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  }
  
  /* Focus trap styles */
  &:focus {
    outline: none;
  }
`;

const ModalHeader = styled.div<{
  theme: Theme;
  variant: ModalVariant;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[6]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  
  ${({ variant, theme }) => variant === 'alert' && css`
    background-color: ${theme.colors.error.main}10;
    color: ${theme.colors.error.main};
  `}
`;

const ModalTitle = styled.h2<{
  theme: Theme;
}>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const CloseButton = styled.button<{
  theme: Theme;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color'])}
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.divider};
    color: ${({ theme }) => theme.colors.text.primary};
  }
  
  ${({ theme }) => focusStyles(theme)}
`;

const ModalContent = styled.div<{
  theme: Theme;
  hasFooter: boolean;
}>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing[6]};
  overflow-y: auto;
  
  ${({ hasFooter, theme }) => !hasFooter && css`
    padding-bottom: ${theme.spacing[8]};
  `}
`;

const ModalFooter = styled.div<{
  theme: Theme;
}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[6]};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;

// Focus trap will be handled by the new focus management system

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      size = 'medium',
      variant = 'standard',
      title,
      children,
      footer,
      closeOnBackdropClick = true,
      closeOnEsc = true,
      showCloseButton = true,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      onConfirm,
      onCancel,
      danger = false,
      loading = false,
      testId,
      className,
      ...props
    },
    ref
  ) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const id = generateId('modal');
    
    // Use focus management context
    const { focusRestore, routerFocus } = useFocusManagement();
    
    // Use new focus trap hook
    const focusTrap = useFocusTrap(modalRef, {
      active: open,
      initialFocus: 'first-focusable',
      restoreFocus: true,
      allowOutsideClick: closeOnBackdropClick,
      escapeDeactivates: closeOnEsc,
      onActivate: () => {
        // Capture focus before trapping
        focusRestore.captureFocus();
        
        // Announce modal opening to screen readers
        routerFocus.announceToScreenReader(
          `${variant === 'alert' ? 'Alert' : 'Dialog'} opened${title ? `: ${title}` : ''}`
        );
      },
      onDeactivate: () => {
        // Restore focus when closing
        focusRestore.restoreFocus();
        
        // Announce modal closing to screen readers
        routerFocus.announceToScreenReader('Dialog closed');
      },
    });
    
    // Escape key handling is now managed by the focus trap
    
    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        // Deactivate focus trap before closing
        focusTrap.deactivate();
        onClose();
      }
    }, [closeOnBackdropClick, onClose, focusTrap]);
    
    // Prevent body scroll when modal is open
    useEffect(() => {
      if (open) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }, [open]);
    
    const handleConfirm = async () => {
      if (onConfirm) {
        await onConfirm();
      }
      // Deactivate focus trap before closing
      focusTrap.deactivate();
      onClose();
    };
    
    const handleCancel = () => {
      if (onCancel) {
        onCancel();
      }
      // Deactivate focus trap before closing
      focusTrap.deactivate();
      onClose();
    };
    
    if (!open) return null;
    
    const modalContent = (
      <>
        <Backdrop onClick={handleBackdropClick} aria-hidden="true" />
        <ModalContainer
          ref={modalRef}
          size={size}
          className={className}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? `${id}-title` : undefined}
          data-testid={testId}
          tabIndex={-1}
          {...props}
        >
          {(title || showCloseButton) && (
            <ModalHeader variant={variant}>
              {title && (
                <ModalTitle id={`${id}-title`}>
                  {title}
                </ModalTitle>
              )}
              {showCloseButton && (
                <CloseButton
                  onClick={() => {
                    // Deactivate focus trap before closing
                    focusTrap.deactivate();
                    onClose();
                  }}
                  aria-label="Close modal"
                  disabled={loading}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </CloseButton>
              )}
            </ModalHeader>
          )}
          
          <ModalContent hasFooter={Boolean(footer) || variant === 'confirmation'}>
            {children}
          </ModalContent>
          
          {footer && (
            <ModalFooter>
              {footer}
            </ModalFooter>
          )}
          
          {variant === 'confirmation' && (
            <ModalFooter>
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={loading}
              >
                {cancelText}
              </Button>
              <Button
                variant={danger || variant === 'alert' ? 'danger' : 'primary'}
                onClick={handleConfirm}
                loading={loading}
              >
                {confirmText}
              </Button>
            </ModalFooter>
          )}
        </ModalContainer>
      </>
    );
    
    // Portal to render modal at document root
    return createPortal(modalContent, document.body);
  }
);

Modal.displayName = 'Modal';