import React, { forwardRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { ButtonProps, ButtonVariant } from '../types';
import { Theme } from '../../../../theme/themes';
import { useFocusManagement } from '../../../../contexts/FocusManagementContext';
import {
  focusStyles,
  disabledStyles,
  loadingStyles,
  transitionStyles,
  sizeMap,
  rippleEffect,
  inline,
} from '../utils';

const getVariantStyles = (theme: Theme, variant: ButtonVariant) => {
  const variants = {
    primary: css`
      background-color: ${theme.colors.primary.main};
      color: ${theme.colors.primary.contrast};
      border: 2px solid transparent;
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.primary.dark};
      }
      
      &:active:not(:disabled) {
        background-color: ${theme.colors.primary.dark};
        transform: scale(0.98);
      }
    `,
    
    secondary: css`
      background-color: ${theme.colors.secondary.main};
      color: ${theme.colors.secondary.contrast};
      border: 2px solid transparent;
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.secondary.dark};
      }
      
      &:active:not(:disabled) {
        background-color: ${theme.colors.secondary.dark};
        transform: scale(0.98);
      }
    `,
    
    tertiary: css`
      background-color: transparent;
      color: ${theme.colors.primary.main};
      border: 2px solid ${theme.colors.primary.main};
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.primary.main};
        color: ${theme.colors.primary.contrast};
      }
      
      &:active:not(:disabled) {
        transform: scale(0.98);
      }
    `,
    
    danger: css`
      background-color: ${theme.colors.error.main};
      color: ${theme.colors.error.contrast};
      border: 2px solid transparent;
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.error.dark};
      }
      
      &:active:not(:disabled) {
        background-color: ${theme.colors.error.dark};
        transform: scale(0.98);
      }
    `,
    
    ghost: css`
      background-color: transparent;
      color: ${theme.colors.text.primary};
      border: 2px solid transparent;
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.divider};
      }
      
      &:active:not(:disabled) {
        background-color: ${theme.colors.divider};
        transform: scale(0.98);
      }
    `,
  };
  
  return variants[variant];
};

const StyledButton = styled.button<{
  theme: Theme;
  variant: ButtonVariant;
  size: NonNullable<ButtonProps['size']>;
  fullWidth: boolean;
  hasIcon: boolean;
  iconOnly: boolean;
  isLoading: boolean;
}>`
  /* Base styles */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  
  /* Size styles */
  ${({ size }) => css`
    padding: ${sizeMap[size].padding};
    font-size: ${sizeMap[size].fontSize};
    min-height: ${sizeMap[size].height};
  `}
  
  /* Icon-only button adjustments */
  ${({ iconOnly, size }) => iconOnly && css`
    padding: 0;
    width: ${sizeMap[size].height};
    min-width: ${sizeMap[size].height};
  `}
  
  /* Full width */
  ${({ fullWidth }) => fullWidth && css`
    width: 100%;
  `}
  
  /* Variant styles */
  ${({ theme, variant }) => getVariantStyles(theme, variant)}
  
  /* Interactive states */
  ${({ theme }) => focusStyles(theme, 'button')}
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color', 'border-color', 'transform', 'box-shadow'])}
  ${rippleEffect}
  
  /* Disabled state */
  &:disabled {
    ${({ theme }) => disabledStyles(theme)}
  }
  
  /* Loading state */
  ${({ isLoading }) => isLoading && loadingStyles}
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border-width: 3px;
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transform: none !important;
  }
`;

const IconWrapper = styled.span<{ position: 'left' | 'right' }>`
  display: inline-flex;
  align-items: center;
  order: ${({ position }) => (position === 'left' ? -1 : 1)};
`;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      type = 'button',
      fullWidth = false,
      icon,
      iconPosition = 'left',
      loading = false,
      disabled = false,
      children,
      testId,
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    // Use focus management context for enhanced focus handling
    const { focusVisible } = useFocusManagement();
    
    const hasIcon = Boolean(icon);
    const iconOnly = hasIcon && !children;
    const isDisabled = disabled || loading;
    
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled && onClick) {
        onClick(event);
      }
    };
    
    return (
      <StyledButton
        ref={ref}
        type={type}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        hasIcon={hasIcon}
        iconOnly={iconOnly}
        isLoading={loading}
        disabled={isDisabled}
        className={className}
        onClick={handleClick}
        data-testid={testId}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...focusVisible.getFocusVisibleProps()}
        {...props}
      >
        {icon && (
          <IconWrapper position={iconPosition} aria-hidden="true">
            {icon}
          </IconWrapper>
        )}
        {children && <span>{children}</span>}
      </StyledButton>
    );
  }
);

Button.displayName = 'Button';