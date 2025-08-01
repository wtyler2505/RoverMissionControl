import React, { forwardRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { ToggleProps, ValidationState } from '../types';
import { Theme } from '../../../../theme/themes';
import {
  focusStyles,
  disabledStyles,
  transitionStyles,
  generateId,
} from '../utils';

const getValidationStyles = (theme: Theme, state: ValidationState) => {
  const states = {
    default: css``,
    error: css`
      background-color: ${theme.colors.error.main};
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.error.dark};
      }
    `,
    success: css`
      background-color: ${theme.colors.success.main};
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.success.dark};
      }
    `,
    warning: css`
      background-color: ${theme.colors.warning.main};
      
      &:hover:not(:disabled) {
        background-color: ${theme.colors.warning.dark};
      }
    `,
  };
  
  return states[state];
};

const ToggleWrapper = styled.label<{
  theme: Theme;
  disabled?: boolean;
  labelPosition: 'left' | 'right';
}>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  position: relative;
  flex-direction: ${({ labelPosition }) => labelPosition === 'left' ? 'row-reverse' : 'row'};
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
`;

const ToggleTrack = styled.span<{
  theme: Theme;
  checked: boolean;
  disabled?: boolean;
  validationState: ValidationState;
  size: NonNullable<ToggleProps['size']>;
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  
  /* Size styles */
  ${({ size }) => {
    const sizes = {
      small: css`
        width: 36px;
        height: 20px;
      `,
      medium: css`
        width: 44px;
        height: 24px;
      `,
      large: css`
        width: 52px;
        height: 28px;
      `,
    };
    return sizes[size];
  }}
  
  background-color: ${({ theme, checked, validationState }) => {
    if (validationState !== 'default' && checked) {
      return getValidationStyles(theme, validationState);
    }
    return checked ? theme.colors.primary.main : theme.colors.divider;
  }};
  
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'box-shadow'])}
  
  /* Hover state */
  &:hover:not(:disabled) {
    background-color: ${({ theme, checked }) => 
      checked ? theme.colors.primary.dark : theme.colors.neutral[400]
    };
  }
  
  /* Focus styles - shown when input is focused */
  .toggle-input:focus-visible + & {
    ${({ theme }) => focusStyles(theme)}
  }
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    background-color: ${theme.colors.neutral[300]};
  `}
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border: 2px solid ${({ theme, checked }) => 
      checked ? theme.colors.primary.main : theme.colors.text.primary
    };
  }
`;

const ToggleThumb = styled.span<{
  theme: Theme;
  checked: boolean;
  size: NonNullable<ToggleProps['size']>;
}>`
  position: absolute;
  top: 2px;
  left: ${({ checked, size }) => {
    const positions = {
      small: checked ? '18px' : '2px',
      medium: checked ? '22px' : '2px',
      large: checked ? '26px' : '2px',
    };
    return positions[size];
  }};
  
  /* Size styles */
  ${({ size }) => {
    const sizes = {
      small: css`
        width: 16px;
        height: 16px;
      `,
      medium: css`
        width: 20px;
        height: 20px;
      `,
      large: css`
        width: 24px;
        height: 24px;
      `,
    };
    return sizes[size];
  }}
  
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-radius: 50%;
  box-shadow: ${({ theme }) => theme.shadows.sm};
  
  ${({ theme }) => transitionStyles(theme, ['left', 'transform'])}
  
  /* Active state */
  .toggle-input:active:not(:disabled) + .toggle-track & {
    transform: scale(1.1);
  }
  
  /* Icons for on/off states */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    height: 60%;
    background-color: ${({ theme, checked }) => 
      checked ? theme.colors.primary.main : theme.colors.text.secondary
    };
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
    mask-image: ${({ checked }) => 
      checked 
        ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='currentColor' d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E")`
        : `url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='currentColor' d='M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z'/%3E%3C/svg%3E")`
    };
    opacity: 0.8;
    
    ${({ theme }) => transitionStyles(theme, ['opacity'])}
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border: 1px solid ${({ theme }) => theme.colors.text.primary};
  }
`;

const Label = styled.span<{ theme: Theme; disabled?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  color: ${({ theme, disabled }) => 
    disabled ? theme.colors.text.disabled : theme.colors.text.primary
  };
`;

const ValidationMessage = styled.div<{
  theme: Theme;
  validationState: ValidationState;
}>`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: ${({ theme, validationState }) => {
    switch (validationState) {
      case 'error':
        return theme.colors.error.main;
      case 'success':
        return theme.colors.success.main;
      case 'warning':
        return theme.colors.warning.main;
      default:
        return theme.colors.text.secondary;
    }
  }};
`;

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      size = 'medium',
      label,
      labelPosition = 'right',
      validationState = 'default',
      validationMessage,
      disabled = false,
      checked,
      defaultChecked,
      onChange,
      testId,
      className,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const id = providedId || generateId('toggle');
    const isChecked = checked ?? defaultChecked ?? false;
    
    return (
      <div className={className} data-testid={testId}>
        <ToggleWrapper disabled={disabled} labelPosition={labelPosition}>
          <HiddenInput
            ref={ref}
            type="checkbox"
            id={id}
            className="toggle-input"
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            disabled={disabled}
            role="switch"
            aria-checked={isChecked}
            aria-invalid={validationState === 'error'}
            aria-describedby={validationMessage ? `${id}-validation` : undefined}
            {...props}
          />
          
          <ToggleTrack
            className="toggle-track"
            checked={isChecked}
            disabled={disabled}
            validationState={validationState}
            size={size}
            aria-hidden="true"
          >
            <ToggleThumb
              checked={isChecked}
              size={size}
            />
          </ToggleTrack>
          
          {label && (
            <Label disabled={disabled}>
              {label}
            </Label>
          )}
        </ToggleWrapper>
        
        {validationMessage && (
          <ValidationMessage
            id={`${id}-validation`}
            validationState={validationState}
            role={validationState === 'error' ? 'alert' : undefined}
          >
            {validationMessage}
          </ValidationMessage>
        )}
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';