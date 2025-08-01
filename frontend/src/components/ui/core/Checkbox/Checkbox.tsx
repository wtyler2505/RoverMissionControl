import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { CheckboxProps, ValidationState } from '../types';
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
      border-color: ${theme.colors.error.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.error.dark};
      }
    `,
    success: css`
      border-color: ${theme.colors.success.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.success.dark};
      }
    `,
    warning: css`
      border-color: ${theme.colors.warning.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.warning.dark};
      }
    `,
  };
  
  return states[state];
};

const CheckboxWrapper = styled.label<{ theme: Theme; disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  position: relative;
  
  &:hover {
    .checkbox-input:not(:disabled) + .checkbox-box {
      border-color: ${({ theme }) => theme.colors.primary.main};
    }
  }
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
`;

const CheckboxBox = styled.span<{
  theme: Theme;
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  validationState: ValidationState;
  size: NonNullable<CheckboxProps['size']>;
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
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
  
  background-color: ${({ theme, checked, indeterminate }) => 
    checked || indeterminate ? theme.colors.primary.main : theme.colors.background.paper
  };
  
  border: 2px solid ${({ theme, checked, indeterminate }) => 
    checked || indeterminate ? theme.colors.primary.main : theme.colors.divider
  };
  
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'border-color', 'transform'])}
  
  /* Validation styles */
  ${({ theme, validationState }) => getValidationStyles(theme, validationState)}
  
  /* Focus styles - shown when input is focused */
  .checkbox-input:focus-visible + & {
    ${({ theme }) => focusStyles(theme)}
  }
  
  /* Active state */
  .checkbox-input:active:not(:disabled) + & {
    transform: scale(0.95);
  }
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    background-color: ${theme.colors.background.default};
    border-color: ${theme.colors.divider};
  `}
  
  /* Checkmark icon */
  &::after {
    content: '';
    position: absolute;
    display: block;
    width: 100%;
    height: 100%;
    background-color: ${({ theme }) => theme.colors.primary.contrast};
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: 80%;
    
    ${({ checked, indeterminate }) => {
      if (indeterminate) {
        return css`
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='currentColor' d='M4 8a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 014 8z'/%3E%3C/svg%3E");
          opacity: 1;
          transform: scale(1);
        `;
      } else if (checked) {
        return css`
          mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='currentColor' d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E");
          opacity: 1;
          transform: scale(1);
        `;
      } else {
        return css`
          opacity: 0;
          transform: scale(0.5);
        `;
      }
    }}
    
    ${({ theme }) => transitionStyles(theme, ['opacity', 'transform'])}
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border-width: 3px;
    
    &::after {
      background-color: ${({ theme, checked, indeterminate }) => 
        checked || indeterminate ? theme.colors.primary.contrast : 'transparent'
      };
    }
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

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      size = 'medium',
      label,
      indeterminate = false,
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
    const inputRef = useRef<HTMLInputElement>(null);
    const id = providedId || generateId('checkbox');
    
    useImperativeHandle(ref, () => inputRef.current!);
    
    // Set indeterminate state
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);
    
    const isChecked = checked ?? defaultChecked ?? false;
    
    return (
      <div className={className} data-testid={testId}>
        <CheckboxWrapper disabled={disabled}>
          <HiddenInput
            ref={inputRef}
            type="checkbox"
            id={id}
            className="checkbox-input"
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            disabled={disabled}
            aria-invalid={validationState === 'error'}
            aria-describedby={validationMessage ? `${id}-validation` : undefined}
            {...props}
          />
          
          <CheckboxBox
            className="checkbox-box"
            checked={isChecked}
            indeterminate={indeterminate}
            disabled={disabled}
            validationState={validationState}
            size={size}
            aria-hidden="true"
          />
          
          {label && (
            <Label disabled={disabled}>
              {label}
            </Label>
          )}
        </CheckboxWrapper>
        
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

Checkbox.displayName = 'Checkbox';