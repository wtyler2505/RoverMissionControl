import React, { forwardRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { RadioProps, RadioGroupProps, ValidationState } from '../types';
import { Theme } from '../../../../theme/themes';
import {
  focusStyles,
  disabledStyles,
  transitionStyles,
  generateId,
  stack,
  inline,
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

const RadioWrapper = styled.label<{ theme: Theme; disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  position: relative;
  
  &:hover {
    .radio-input:not(:disabled) + .radio-circle {
      border-color: ${({ theme }) => theme.colors.primary.main};
    }
  }
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  pointer-events: none;
`;

const RadioCircle = styled.span<{
  theme: Theme;
  checked: boolean;
  disabled?: boolean;
  validationState: ValidationState;
  size: NonNullable<RadioProps['size']>;
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  
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
  
  background-color: ${({ theme, checked }) => 
    checked ? theme.colors.primary.main : theme.colors.background.paper
  };
  
  border: 2px solid ${({ theme, checked }) => 
    checked ? theme.colors.primary.main : theme.colors.divider
  };
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'border-color', 'transform'])}
  
  /* Validation styles */
  ${({ theme, validationState }) => getValidationStyles(theme, validationState)}
  
  /* Focus styles - shown when input is focused */
  .radio-input:focus-visible + & {
    ${({ theme }) => focusStyles(theme)}
  }
  
  /* Active state */
  .radio-input:active:not(:disabled) + & {
    transform: scale(0.95);
  }
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    background-color: ${theme.colors.background.default};
    border-color: ${theme.colors.divider};
  `}
  
  /* Inner dot */
  &::after {
    content: '';
    position: absolute;
    width: 40%;
    height: 40%;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.primary.contrast};
    opacity: ${({ checked }) => checked ? 1 : 0};
    transform: scale(${({ checked }) => checked ? 1 : 0.5});
    
    ${({ theme }) => transitionStyles(theme, ['opacity', 'transform'])}
  }
  
  /* High contrast mode adjustments */
  @media (prefers-contrast: high) {
    border-width: 3px;
    
    &::after {
      width: 50%;
      height: 50%;
      background-color: ${({ theme, checked }) => 
        checked ? theme.colors.primary.contrast : 'transparent'
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

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      size = 'medium',
      label,
      value,
      validationState = 'default',
      disabled = false,
      checked,
      onChange,
      testId,
      className,
      id: providedId,
      name,
      ...props
    },
    ref
  ) => {
    const id = providedId || generateId('radio');
    
    return (
      <RadioWrapper className={className} data-testid={testId} disabled={disabled}>
        <HiddenInput
          ref={ref}
          type="radio"
          id={id}
          className="radio-input"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={validationState === 'error'}
          {...props}
        />
        
        <RadioCircle
          className="radio-circle"
          checked={checked || false}
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
      </RadioWrapper>
    );
  }
);

Radio.displayName = 'Radio';

// Radio Group Component
const RadioGroupWrapper = styled.div`
  width: 100%;
`;

const GroupLabel = styled.legend<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[3]};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const RadioGroupContainer = styled.fieldset<{
  theme: Theme;
  direction: 'horizontal' | 'vertical';
}>`
  border: none;
  margin: 0;
  padding: 0;
  
  ${({ direction, theme }) => direction === 'horizontal' 
    ? inline(theme.spacing[6])
    : stack(theme.spacing[3])
  }
`;

const HelperText = styled.div<{
  theme: Theme;
  validationState: ValidationState;
}>`
  margin-top: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
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

export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  (
    {
      name,
      value,
      onChange,
      options,
      direction = 'vertical',
      label,
      helperText,
      validationState = 'default',
      validationMessage,
      disabled = false,
      size = 'medium',
      testId,
      className,
      ...props
    },
    ref
  ) => {
    const groupId = generateId('radio-group');
    const displayHelperText = validationMessage || helperText;
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      // Convert to number if the original value was a number
      const convertedValue = options.find(opt => String(opt.value) === newValue)?.value;
      onChange?.(convertedValue || newValue);
    };
    
    return (
      <RadioGroupWrapper className={className} data-testid={testId}>
        <RadioGroupContainer
          ref={ref}
          direction={direction}
          role="radiogroup"
          aria-labelledby={label ? `${groupId}-label` : undefined}
          aria-describedby={displayHelperText ? `${groupId}-helper` : undefined}
          aria-invalid={validationState === 'error'}
          {...props}
        >
          {label && (
            <GroupLabel id={`${groupId}-label`}>
              {label}
            </GroupLabel>
          )}
          
          {options.map((option) => (
            <Radio
              key={String(option.value)}
              name={name}
              value={option.value}
              label={option.label}
              checked={value === option.value}
              onChange={handleChange}
              disabled={disabled || option.disabled}
              validationState={validationState}
              size={size}
            />
          ))}
        </RadioGroupContainer>
        
        {displayHelperText && (
          <HelperText
            id={`${groupId}-helper`}
            validationState={validationState}
            role={validationState === 'error' ? 'alert' : undefined}
          >
            {displayHelperText}
          </HelperText>
        )}
      </RadioGroupWrapper>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';