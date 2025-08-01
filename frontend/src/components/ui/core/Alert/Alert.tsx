import React, { forwardRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { AlertProps, AlertVariant } from '../types';
import { Theme } from '../../../../theme/themes';
import { transitionStyles, focusStyles } from '../utils';

const getVariantStyles = (theme: Theme, variant: AlertVariant) => {
  const variants = {
    info: css`
      background-color: ${theme.colors.info.light}15;
      border-color: ${theme.colors.info.main};
      color: ${theme.colors.info.dark};
      
      .alert-icon {
        color: ${theme.colors.info.main};
      }
    `,
    success: css`
      background-color: ${theme.colors.success.light}15;
      border-color: ${theme.colors.success.main};
      color: ${theme.colors.success.dark};
      
      .alert-icon {
        color: ${theme.colors.success.main};
      }
    `,
    warning: css`
      background-color: ${theme.colors.warning.light}15;
      border-color: ${theme.colors.warning.main};
      color: ${theme.colors.warning.dark};
      
      .alert-icon {
        color: ${theme.colors.warning.main};
      }
    `,
    error: css`
      background-color: ${theme.colors.error.light}15;
      border-color: ${theme.colors.error.main};
      color: ${theme.colors.error.dark};
      
      .alert-icon {
        color: ${theme.colors.error.main};
      }
    `,
  };
  
  return variants[variant];
};

const getDefaultIcon = (variant: AlertVariant) => {
  const icons = {
    info: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    success: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  };
  
  return icons[variant];
};

const AlertContainer = styled.div<{
  theme: Theme;
  variant: AlertVariant;
}>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[4]};
  border: 2px solid;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  
  ${({ theme, variant }) => getVariantStyles(theme, variant)}
  ${({ theme }) => transitionStyles(theme, ['opacity', 'transform'])}
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border-width: 3px;
  }
`;

const IconWrapper = styled.span<{ theme: Theme }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
`;

const ContentWrapper = styled.div<{ theme: Theme }>`
  flex: 1;
  min-width: 0;
`;

const AlertTitle = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
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

const CloseButton = styled.button<{ theme: Theme }>`
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
  color: inherit;
  opacity: 0.7;
  
  ${({ theme }) => transitionStyles(theme, ['opacity', 'background-color'])}
  
  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  ${({ theme }) => focusStyles(theme)}
`;

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant,
      title,
      children,
      closable = false,
      onClose,
      icon,
      action,
      testId,
      className,
      ...props
    },
    ref
  ) => {
    const showIcon = icon !== false;
    const iconElement = icon === true || icon === undefined ? getDefaultIcon(variant) : icon;
    
    return (
      <AlertContainer
        ref={ref}
        variant={variant}
        className={className}
        role="alert"
        data-testid={testId}
        {...props}
      >
        {showIcon && iconElement && (
          <IconWrapper className="alert-icon" aria-hidden="true">
            {iconElement}
          </IconWrapper>
        )}
        
        <ContentWrapper>
          {title && (
            <AlertTitle>
              {title}
            </AlertTitle>
          )}
          
          <AlertMessage>
            {children}
          </AlertMessage>
          
          {action && (
            <ActionWrapper>
              {action}
            </ActionWrapper>
          )}
        </ContentWrapper>
        
        {closable && (
          <CloseButton
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

Alert.displayName = 'Alert';