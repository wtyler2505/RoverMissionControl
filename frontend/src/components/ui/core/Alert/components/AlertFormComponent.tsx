/**
 * AlertFormComponent
 * Form component for alert interactions with validation and accessibility
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { FormContent, FormField, RichContentConfig } from '../types/RichContentTypes';

interface AlertFormComponentProps {
  content: FormContent;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}

const FormContainer = styled.form<{ 
  theme: Theme;
  constraints?: FormContent['constraints'];
}>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[4]};
  background: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  
  /* Apply constraints */
  ${({ constraints }) => constraints && css`
    max-width: ${constraints.maxWidth || '100%'};
    max-height: ${constraints.maxHeight || 'none'};
    ${constraints.maxHeight && css`
      overflow-y: auto;
    `}
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      padding: ${({ theme }) => theme.spacing[3]};
      gap: ${({ theme }) => theme.spacing[3]};
      
      ${constraints.mobile?.maxWidth && css`
        max-width: ${constraints.mobile.maxWidth};
      `}
      ${constraints.mobile?.maxHeight && css`
        max-height: ${constraints.mobile.maxHeight};
      `}
      ${constraints.mobile?.hide && css`
        display: none;
      `}
    }
  `}
`;

const FieldGroup = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const Label = styled.label<{ theme: Theme; required: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  
  ${({ required, theme }) => required && css`
    &::after {
      content: " *";
      color: ${theme.colors.error.main};
    }
  `}
`;

const Input = styled.input<{ theme: Theme; hasError: boolean }>`
  padding: ${({ theme }) => theme.spacing[3]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main}20;
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.background.elevated};
    color: ${({ theme }) => theme.colors.text.disabled};
    cursor: not-allowed;
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.secondary};
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
    
    &:focus {
      box-shadow: 0 0 0 4px ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main}40;
    }
  }
`;

const TextArea = styled.textarea<{ theme: Theme; hasError: boolean }>`
  padding: ${({ theme }) => theme.spacing[3]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all 0.2s ease;
  resize: vertical;
  min-height: 80px;
  
  &:focus {
    outline: none;
    border-color: ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main}20;
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.background.elevated};
    color: ${({ theme }) => theme.colors.text.disabled};
    cursor: not-allowed;
    resize: none;
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.secondary};
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
    
    &:focus {
      box-shadow: 0 0 0 4px ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main}40;
    }
  }
`;

const Select = styled.select<{ theme: Theme; hasError: boolean }>`
  padding: ${({ theme }) => theme.spacing[3]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.background.paper};
  border: 2px solid ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.primary.main}20;
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.background.elevated};
    color: ${({ theme }) => theme.colors.text.disabled};
    cursor: not-allowed;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
  }
`;

const CheckboxContainer = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const Checkbox = styled.input<{ theme: Theme }>`
  width: 18px;
  height: 18px;
  cursor: pointer;
  
  &:disabled {
    cursor: not-allowed;
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

const RadioContainer = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const RadioOption = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const Radio = styled.input<{ theme: Theme }>`
  width: 18px;
  height: 18px;
  cursor: pointer;
  
  &:disabled {
    cursor: not-allowed;
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

const ErrorMessage = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.error.main};
  margin-top: ${({ theme }) => theme.spacing[1]};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  
  .error-icon {
    width: 14px;
    height: 14px;
    fill: currentColor;
    flex-shrink: 0;
  }
`;

const HelpText = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-top: ${({ theme }) => theme.spacing[1]};
`;

const ButtonGroup = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  justify-content: flex-end;
  margin-top: ${({ theme }) => theme.spacing[4]};
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`;

const Button = styled.button<{ 
  theme: Theme; 
  variant: 'primary' | 'secondary';
  loading: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  border: 2px solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: ${({ loading }) => loading ? 'wait' : 'pointer'};
  transition: all 0.2s ease;
  min-height: 44px;
  min-width: 80px;
  
  ${({ theme, variant }) => {
    switch (variant) {
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
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
      border: 2px solid currentColor;
    }
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border-width: 3px;
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`;

export const AlertFormComponent: React.FC<AlertFormComponentProps> = ({
  content,
  config,
  onLoad,
  onError,
  onInteraction
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(content.initialData || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);

  // Security check for restricted mode
  if (content.securityLevel === 'restricted') {
    return (
      <div data-testid={content.testId || `form-restricted-${content.id}`}>
        <em style={{ color: 'var(--text-secondary)' }}>
          [Form blocked in restricted mode]
        </em>
      </div>
    );
  }

  // Validate field
  const validateField = useCallback((field: FormField, value: any): string | null => {
    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${field.label} is required`;
    }
    
    if (field.validation) {
      const { pattern, minLength, maxLength, min, max, custom } = field.validation;
      
      if (pattern && typeof value === 'string' && !new RegExp(pattern).test(value)) {
        return `${field.label} format is invalid`;
      }
      
      if (minLength && typeof value === 'string' && value.length < minLength) {
        return `${field.label} must be at least ${minLength} characters`;
      }
      
      if (maxLength && typeof value === 'string' && value.length > maxLength) {
        return `${field.label} must be no more than ${maxLength} characters`;
      }
      
      if (min !== undefined && typeof value === 'number' && value < min) {
        return `${field.label} must be at least ${min}`;
      }
      
      if (max !== undefined && typeof value === 'number' && value > max) {
        return `${field.label} must be no more than ${max}`;
      }
      
      if (custom) {
        const customError = custom(value);
        if (customError) return customError;
      }
    }
    
    return null;
  }, []);

  // Handle field change
  const handleFieldChange = useCallback((field: FormField, value: any) => {
    setFormData(prev => ({ ...prev, [field.name]: value }));
    
    // Validate on change if validation mode is onChange
    if (content.validationMode === 'onChange') {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field.name]: error || '' }));
    }
  }, [content.validationMode, validateField]);

  // Handle field blur
  const handleFieldBlur = useCallback((field: FormField) => {
    setTouched(prev => ({ ...prev, [field.name]: true }));
    
    // Validate on blur if validation mode is onBlur or onChange
    if (content.validationMode === 'onBlur' || content.validationMode === 'onChange') {
      const value = formData[field.name];
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field.name]: error || '' }));
    }
  }, [content.validationMode, formData, validateField]);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;
    
    for (const field of content.fields) {
      const value = formData[field.name];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.name] = error;
        isValid = false;
      }
    }
    
    setErrors(newErrors);
    return isValid;
  }, [content.fields, formData, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (isSubmitting) return;
    
    // Validate form
    const isValid = validateForm();
    if (!isValid) {
      onError?.(new Error('Form validation failed'));
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      onInteraction?.('form-submit-start', { data: formData });
      
      const result = await content.onSubmit(formData);
      
      if (result.success) {
        onInteraction?.('form-submit-success', { data: formData, result });
      } else {
        onInteraction?.('form-submit-error', { data: formData, error: result.error });
        onError?.(new Error(result.error || 'Form submission failed'));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Form submission failed';
      onInteraction?.('form-submit-error', { data: formData, error: errorMsg });
      onError?.(new Error(errorMsg));
    } finally {
      setIsSubmitting(false);
    }
  }, [content, formData, isSubmitting, validateForm, onError, onInteraction]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onInteraction?.('form-cancel', { data: formData });
    content.onCancel?.();
  }, [content, formData, onInteraction]);

  // Load callback
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  // Render field
  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const hasError = Boolean(error && touched[field.name]);
    
    const commonProps = {
      id: field.id,
      name: field.name,
      disabled: field.disabled || isSubmitting,
      'aria-describedby': error ? `${field.id}-error` : field.ariaDescription ? `${field.id}-help` : undefined,
      'aria-invalid': hasError,
      onBlur: () => handleFieldBlur(field)
    };

    let fieldElement: React.ReactNode = null;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'tel':
      case 'url':
        if ('multiline' in field && field.multiline) {
          fieldElement = (
            <TextArea
              {...commonProps}
              type={field.type}
              value={value}
              placeholder={field.placeholder}
              rows={field.rows}
              hasError={hasError}
              onChange={(e) => handleFieldChange(field, e.target.value)}
            />
          );
        } else {
          fieldElement = (
            <Input
              {...commonProps}
              type={field.type}
              value={value}
              placeholder={field.placeholder}
              hasError={hasError}
              onChange={(e) => handleFieldChange(field, e.target.value)}
            />
          );
        }
        break;

      case 'select':
        fieldElement = (
          <Select
            {...commonProps}
            value={value}
            hasError={hasError}
            multiple={'multiple' in field ? field.multiple : false}
            onChange={(e) => {
              const newValue = 'multiple' in field && field.multiple 
                ? Array.from(e.target.selectedOptions, option => option.value)
                : e.target.value;
              handleFieldChange(field, newValue);
            }}
          >
            <option value="" disabled>
              {field.placeholder || `Select ${field.label}`}
            </option>
            {'options' in field && field.options.map(option => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </Select>
        );
        break;

      case 'checkbox':
        fieldElement = (
          <CheckboxContainer>
            <Checkbox
              {...commonProps}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field, e.target.checked)}
            />
            <Label htmlFor={field.id} required={field.required || false}>
              {field.label}
            </Label>
          </CheckboxContainer>
        );
        break;

      case 'radio':
        fieldElement = (
          <RadioContainer>
            {'options' in field && field.options.map(option => (
              <RadioOption key={option.value}>
                <Radio
                  {...commonProps}
                  type="radio"
                  value={option.value}
                  checked={value === option.value}
                  disabled={field.disabled || option.disabled || isSubmitting}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                />
                <Label htmlFor={`${field.id}-${option.value}`} required={false}>
                  {option.label}
                </Label>
              </RadioOption>
            ))}
          </RadioContainer>
        );
        break;
    }

    return (
      <FieldGroup key={field.id}>
        {field.type !== 'checkbox' && (
          <Label htmlFor={field.id} required={field.required || false}>
            {field.label}
          </Label>
        )}
        
        {fieldElement}
        
        {field.ariaDescription && (
          <HelpText id={`${field.id}-help`}>
            {field.ariaDescription}
          </HelpText>
        )}
        
        {hasError && (
          <ErrorMessage id={`${field.id}-error`} role="alert">
            <svg className="error-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {error}
          </ErrorMessage>
        )}
      </FieldGroup>
    );
  };

  return (
    <FormContainer
      ref={formRef}
      constraints={content.constraints}
      onSubmit={handleSubmit}
      className={content.className}
      data-testid={content.testId || `form-${content.id}`}
      noValidate
    >
      {content.fields.map(renderField)}
      
      <ButtonGroup>
        {content.onCancel && (
          <Button
            type="button"
            variant="secondary"
            loading={false}
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {content.cancelText || 'Cancel'}
          </Button>
        )}
        
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting && <div className="loading-spinner" />}
          {content.submitText || 'Submit'}
        </Button>
      </ButtonGroup>
    </FormContainer>
  );
};