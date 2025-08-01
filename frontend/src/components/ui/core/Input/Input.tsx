import React, { forwardRef, useState, useRef, useImperativeHandle } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { InputProps, ValidationState } from '../types';
import { Theme } from '../../../../theme/themes';
import { useFocusManagement } from '../../../../contexts/FocusManagementContext';
import {
  focusStyles,
  disabledStyles,
  loadingStyles,
  transitionStyles,
  sizeMap,
  errorStyles,
  successStyles,
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
      
      &:focus-within {
        outline-color: ${theme.colors.error.main};
        border-color: ${theme.colors.error.main};
      }
    `,
    success: css`
      border-color: ${theme.colors.success.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.success.dark};
      }
      
      &:focus-within {
        outline-color: ${theme.colors.success.main};
        border-color: ${theme.colors.success.main};
      }
    `,
    warning: css`
      border-color: ${theme.colors.warning.main};
      
      &:hover:not(:disabled) {
        border-color: ${theme.colors.warning.dark};
      }
      
      &:focus-within {
        outline-color: ${theme.colors.warning.main};
        border-color: ${theme.colors.warning.main};
      }
    `,
  };
  
  return states[state];
};

const InputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Label = styled.label<{ theme: Theme; required?: boolean }>`
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  
  ${({ required }) => required && css`
    &::after {
      content: ' *';
      color: currentColor;
    }
  `}
`;

const InputContainer = styled.div<{
  theme: Theme;
  size: NonNullable<InputProps['size']>;
  validationState: ValidationState;
  hasIcon: boolean;
  hasRightIcon: boolean;
  disabled?: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  
  ${({ theme }) => transitionStyles(theme, ['border-color', 'box-shadow', 'background-color'])}
  
  /* Size styles */
  ${({ size }) => css`
    min-height: ${sizeMap[size].height};
    font-size: ${sizeMap[size].fontSize};
  `}
  
  /* Validation styles */
  ${({ theme, validationState }) => getValidationStyles(theme, validationState)}
  
  /* Hover state */
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary.main};
  }
  
  /* Focus state */
  &:focus-within {
    ${({ theme }) => focusStyles(theme, 'input')}
    border-color: ${({ theme }) => theme.colors.primary.main};
  }
  
  /* Disabled state */
  ${({ disabled, theme }) => disabled && css`
    ${disabledStyles(theme)}
    background-color: ${theme.colors.background.default};
  `}
`;

const StyledInput = styled.input<{
  theme: Theme;
  hasIcon: boolean;
  hasRightIcon: boolean;
}>`
  flex: 1;
  width: 100%;
  height: 100%;
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  padding-left: ${({ hasIcon, theme }) => hasIcon ? theme.spacing[10] : theme.spacing[3]};
  padding-right: ${({ hasRightIcon, theme }) => hasRightIcon ? theme.spacing[10] : theme.spacing[3]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: inherit;
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
  color: ${({ theme }) => theme.colors.text.primary};
  background-color: transparent;
  border: none;
  outline: none;
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.disabled};
  }
  
  &:disabled {
    cursor: not-allowed;
    color: ${({ theme }) => theme.colors.text.disabled};
  }
  
  /* Remove number input spinners */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  &[type=number] {
    -moz-appearance: textfield;
  }
`;

const IconWrapper = styled.span<{
  theme: Theme;
  position: 'left' | 'right';
  clickable?: boolean;
}>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.spacing[10]};
  height: 100%;
  color: ${({ theme }) => theme.colors.text.secondary};
  
  ${({ position, theme }) => position === 'left' ? css`
    left: 0;
  ` : css`
    right: 0;
  `}
  
  ${({ clickable }) => clickable && css`
    cursor: pointer;
    
    &:hover {
      color: ${({ theme }) => theme.colors.text.primary};
    }
  `}
`;

const HelperText = styled.div<{
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

const ClearButton = styled.button<{ theme: Theme }>`
  position: absolute;
  right: ${({ theme }) => theme.spacing[2]};
  top: 50%;
  transform: translateY(-50%);
  padding: ${({ theme }) => theme.spacing[1]};
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  
  ${({ theme }) => transitionStyles(theme, ['color', 'background-color'])}
  
  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.divider};
  }
  
  ${({ theme }) => focusStyles(theme, 'button')}
`;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'medium',
      type = 'text',
      label,
      helperText,
      validationState = 'default',
      validationMessage,
      icon,
      iconPosition = 'left',
      clearable = false,
      onClear,
      loading = false,
      disabled = false,
      required = false,
      testId,
      className,
      id: providedId,
      onChange,
      value,
      ...props
    },
    ref
  ) => {
    // Use focus management context for enhanced focus handling
    const { focusVisible } = useFocusManagement();
    
    const [internalValue, setInternalValue] = useState(value || '');
    const inputRef = useRef<HTMLInputElement>(null);
    const id = providedId || generateId('input');
    
    useImperativeHandle(ref, () => inputRef.current!);
    
    const hasIcon = Boolean(icon);
    const hasRightIcon = iconPosition === 'right' && hasIcon;
    const showClearButton = clearable && internalValue && !disabled && !loading;
    const displayHelperText = validationMessage || helperText;
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInternalValue(newValue);
      if (onChange) {
        onChange(event);
      }
    };
    
    const handleClear = () => {
      setInternalValue('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
      if (onClear) {
        onClear();
      }
      if (onChange) {
        const event = new Event('change', { bubbles: true });
        Object.defineProperty(event, 'target', {
          value: { value: '' },
          enumerable: true,
        });
        onChange(event as any);
      }
    };
    
    return (
      <InputWrapper className={className} data-testid={testId}>
        {label && (
          <Label htmlFor={id} required={required}>
            {label}
          </Label>
        )}
        
        <InputContainer
          size={size}
          validationState={validationState}
          hasIcon={hasIcon && iconPosition === 'left'}
          hasRightIcon={showClearButton || (hasIcon && iconPosition === 'right')}
          disabled={disabled}
          {...focusVisible.getFocusVisibleProps()}
        >
          {icon && (
            <IconWrapper position={iconPosition} aria-hidden="true">
              {icon}
            </IconWrapper>
          )}
          
          <StyledInput
            ref={inputRef}
            id={id}
            type={type}
            value={internalValue}
            onChange={handleChange}
            disabled={disabled || loading}
            required={required}
            hasIcon={hasIcon && iconPosition === 'left'}
            hasRightIcon={showClearButton || (hasIcon && iconPosition === 'right')}
            aria-invalid={validationState === 'error'}
            aria-describedby={displayHelperText ? `${id}-helper` : undefined}
            {...props}
          />
          
          {showClearButton && (
            <ClearButton
              type="button"
              onClick={handleClear}
              aria-label="Clear input"
              tabIndex={-1}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
              </svg>
            </ClearButton>
          )}
          
          {loading && (
            <IconWrapper position="right" aria-label="Loading">
              <span className="loading-spinner" />
            </IconWrapper>
          )}
        </InputContainer>
        
        {displayHelperText && (
          <HelperText
            id={`${id}-helper`}
            validationState={validationState}
            role={validationState === 'error' ? 'alert' : undefined}
          >
            {displayHelperText}
          </HelperText>
        )}
      </InputWrapper>
    );
  }
);

Input.displayName = 'Input';