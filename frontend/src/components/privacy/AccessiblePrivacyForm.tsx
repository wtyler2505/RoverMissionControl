/**
 * Accessible Privacy Form Component
 * WCAG 2.1 AA compliant form with comprehensive validation and error handling
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useTheme } from '@emotion/react';
import { Input } from '../ui/core/Input';
import { Button } from '../ui/core/Button';
import { FormError } from '../ui/core/FormError';
import { Checkbox } from '../ui/core/Checkbox';
import { useFocusManagement } from '../../contexts/FocusManagementContext';

interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'invalid' | 'custom';
}

interface AccessiblePrivacyFormProps {
  /** Form title */
  title?: string;
  /** Form description */
  description?: string;
  /** Initial form data */
  initialData?: Record<string, any>;
  /** Form fields configuration */
  fields: FormFieldConfig[];
  /** Submit handler */
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  /** Cancel handler */
  onCancel?: () => void;
  /** Loading state */
  loading?: boolean;
  /** High contrast mode */
  highContrastMode?: boolean;
  /** Verbose mode for screen readers */
  verboseMode?: boolean;
  /** CSS class */
  className?: string;
}

interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'checkbox' | 'select';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => string | null;
  };
  options?: { value: string; label: string }[]; // For select fields
  ariaDescribedBy?: string;
}

const FormContainer = styled.form<{ highContrast?: boolean }>`
  max-width: 600px;
  margin: 0 auto;
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 2px solid ${theme.colors.text.primary};
    border-radius: ${theme.borderRadius.lg};
    padding: 2rem;
    background: ${theme.colors.background.paper};
  `}
`;

const FormHeader = styled.header`
  margin-bottom: 2rem;
`;

const FormTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.75rem 0;
  line-height: 1.3;
  
  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary.main};
    outline-offset: 4px;
  }
`;

const FormDescription = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const FieldGroup = styled.div`
  margin-bottom: 2rem;
`;

const FieldLabel = styled.label<{ required?: boolean }>`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
  line-height: 1.4;
  
  ${({ required, theme }) => required && css`
    &::after {
      content: ' *';
      color: ${theme.colors.error.main};
      font-weight: 700;
    }
  `}
`;

const FieldHelpText = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-top: 0.5rem;
  line-height: 1.4;
`;

const CheckboxGroup = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const CheckboxLabel = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
  line-height: 1.5;
  cursor: pointer;
  flex: 1;
`;

const Select = styled.select<{ hasError?: boolean; highContrast?: boolean }>`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid ${props => props.hasError ? props.theme.colors.error.main : props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.md};
  background: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary.main}20;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: ${props => props.theme.colors.background.secondary};
  }
  
  ${({ highContrast, theme }) => highContrast && css`
    border-width: 3px;
    
    &:focus {
      border-color: ${theme.colors.primary.main};
      box-shadow: 0 0 0 3px ${theme.colors.primary.main}40;
    }
  `}
`;

const TextArea = styled.textarea<{ hasError?: boolean; highContrast?: boolean }>`
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  border: 2px solid ${props => props.hasError ? props.theme.colors.error.main : props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.md};
  background: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary.main}20;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: ${props => props.theme.colors.background.secondary};
  }
  
  ${({ highContrast, theme }) => highContrast && css`
    border-width: 3px;
    
    &:focus {
      border-color: ${theme.colors.primary.main};
      box-shadow: 0 0 0 3px ${theme.colors.primary.main}40;
    }
  `}
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid ${props => props.theme.colors.border.secondary};
`;

const ErrorSummary = styled.div<{ highContrast?: boolean }>`
  padding: 1.5rem;
  background: ${props => props.theme.colors.error.light};
  border: 2px solid ${props => props.theme.colors.error.main};
  border-radius: ${props => props.theme.borderRadius.md};
  margin-bottom: 2rem;
  
  ${({ highContrast, theme }) => highContrast && css`
    border-width: 3px;
    background: ${theme.colors.error.light};
  `}
`;

const ErrorSummaryTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.error.dark};
  margin: 0 0 1rem 0;
  
  &::before {
    content: '⚠ ';
    margin-right: 0.5rem;
  }
`;

const ErrorList = styled.ul`
  margin: 0;
  padding-left: 1.5rem;
  color: ${props => props.theme.colors.error.dark};
`;

const ErrorListItem = styled.li`
  margin-bottom: 0.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ErrorLink = styled.a`
  color: ${props => props.theme.colors.error.dark};
  text-decoration: underline;
  cursor: pointer;
  
  &:hover {
    text-decoration: none;
  }
  
  &:focus {
    outline: 2px solid ${props => props.theme.colors.error.main};
    outline-offset: 2px;
  }
`;

const LiveRegion = styled.div`
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;

export const AccessiblePrivacyForm: React.FC<AccessiblePrivacyFormProps> = ({
  title = 'Privacy Information Form',
  description,
  initialData = {},
  fields,
  onSubmit,
  onCancel,
  loading = false,
  highContrastMode = false,
  verboseMode = false,
  className
}) => {
  const theme = useTheme();
  const { routerFocus } = useFocusManagement();
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [announcement, setAnnouncement] = useState<string>('');

  // Accessibility announcements
  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncement(message);
    routerFocus.announceToScreenReader(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, [routerFocus]);

  // Focus error summary when errors appear
  useEffect(() => {
    if (errors.length > 0 && errorSummaryRef.current) {
      errorSummaryRef.current.focus();
      announceToScreenReader(`Form has ${errors.length} error${errors.length === 1 ? '' : 's'}. Please review and correct.`);
    }
  }, [errors.length, announceToScreenReader]);

  // Validate field
  const validateField = useCallback((field: FormFieldConfig, value: any): string | null => {
    const { required, validation } = field;
    
    // Required validation
    if (required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${field.label} is required.`;
    }
    
    if (!validation || !value) return null;
    
    // Pattern validation
    if (validation.pattern && typeof value === 'string' && !validation.pattern.test(value)) {
      if (field.type === 'email') {
        return 'Please enter a valid email address.';
      }
      if (field.type === 'tel') {
        return 'Please enter a valid phone number.';
      }
      return `${field.label} format is invalid.`;
    }
    
    // Length validation
    if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
      return `${field.label} must be at least ${validation.minLength} characters long.`;
    }
    
    if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
      return `${field.label} must be no more than ${validation.maxLength} characters long.`;
    }
    
    // Custom validation
    if (validation.custom) {
      return validation.custom(value);
    }
    
    return null;
  }, []);

  // Validate all fields
  const validateForm = useCallback((): ValidationError[] => {
    const newErrors: ValidationError[] = [];
    
    fields.forEach(field => {
      const value = formData[field.name];
      const error = validateField(field, value);
      
      if (error) {
        newErrors.push({
          field: field.name,
          message: error,
          type: field.required && !value ? 'required' : 'invalid'
        });
      }
    });
    
    return newErrors;
  }, [fields, formData, validateField]);

  // Handle field change
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear field error when user starts typing
    if (errors.some(error => error.field === fieldName)) {
      setErrors(prev => prev.filter(error => error.field !== fieldName));
    }
  }, [errors]);

  // Handle field blur
  const handleFieldBlur = useCallback((fieldName: string) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
    
    // Validate field on blur
    const field = fields.find(f => f.name === fieldName);
    if (field) {
      const value = formData[fieldName];
      const error = validateField(field, value);
      
      if (error) {
        setErrors(prev => [
          ...prev.filter(e => e.field !== fieldName),
          {
            field: fieldName,
            message: error,
            type: field.required && !value ? 'required' : 'invalid'
          }
        ]);
      }
    }
  }, [fields, formData, validateField]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      announceToScreenReader(`Form submission failed. ${validationErrors.length} error${validationErrors.length === 1 ? '' : 's'} found.`);
      return;
    }
    
    try {
      announceToScreenReader('Submitting form...');
      await onSubmit(formData);
      announceToScreenReader('Form submitted successfully.');
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors([{
        field: 'form',
        message: 'An error occurred while submitting the form. Please try again.',
        type: 'custom'
      }]);
      announceToScreenReader('Form submission failed. Please try again.');
    }
  }, [formData, validateForm, onSubmit, announceToScreenReader]);

  // Focus error field
  const focusErrorField = useCallback((fieldName: string) => {
    const field = formRef.current?.querySelector(`[name="${fieldName}"]`) as HTMLElement;
    if (field) {
      field.focus();
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Get field error
  const getFieldError = useCallback((fieldName: string): string | null => {
    const error = errors.find(e => e.field === fieldName);
    return error ? error.message : null;
  }, [errors]);

  // Generate field ID
  const getFieldId = useCallback((fieldName: string): string => {
    return `privacy-form-${fieldName}`;
  }, []);

  // Generate help text ID
  const getHelpTextId = useCallback((fieldName: string): string => {
    return `privacy-form-${fieldName}-help`;
  }, []);

  // Generate error ID
  const getErrorId = useCallback((fieldName: string): string => {
    return `privacy-form-${fieldName}-error`;
  }, []);

  return (
    <FormContainer 
      ref={formRef}
      onSubmit={handleSubmit}
      highContrast={highContrastMode}
      className={className}
      noValidate
      role="form"
      aria-label={title}
    >
      {/* Live region for announcements */}
      <LiveRegion role="alert" aria-live="assertive" aria-atomic="true">
        {announcement}
      </LiveRegion>
      
      <FormHeader>
        <FormTitle tabIndex={0}>{title}</FormTitle>
        {description && (
          <FormDescription>
            {description}
            {verboseMode && ' Use Tab to navigate between fields and arrow keys within dropdown menus.'}
          </FormDescription>
        )}
      </FormHeader>

      {/* Error Summary */}
      {errors.length > 0 && (
        <ErrorSummary 
          ref={errorSummaryRef}
          highContrast={highContrastMode}
          role="alert"
          aria-labelledby="error-summary-title"
          tabIndex={-1}
        >
          <ErrorSummaryTitle id="error-summary-title">
            There {errors.length === 1 ? 'is' : 'are'} {errors.length} error{errors.length === 1 ? '' : 's'} in this form
          </ErrorSummaryTitle>
          <ErrorList>
            {errors.map((error, index) => (
              <ErrorListItem key={`${error.field}-${index}`}>
                <ErrorLink 
                  onClick={() => focusErrorField(error.field)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      focusErrorField(error.field);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {error.message}
                </ErrorLink>
              </ErrorListItem>
            ))}
          </ErrorList>
        </ErrorSummary>
      )}

      {/* Form Fields */}
      {fields.map((field) => (
        <FieldGroup key={field.name}>
          <FieldLabel 
            htmlFor={getFieldId(field.name)}
            required={field.required}
          >
            {field.label}
          </FieldLabel>
          
          {field.type === 'textarea' ? (
            <TextArea
              id={getFieldId(field.name)}
              name={field.name}
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              placeholder={field.placeholder}
              disabled={loading}
              hasError={!!getFieldError(field.name)}
              highContrast={highContrastMode}
              aria-required={field.required}
              aria-invalid={!!getFieldError(field.name)}
              aria-describedby={[
                field.helpText ? getHelpTextId(field.name) : null,
                getFieldError(field.name) ? getErrorId(field.name) : null,
                field.ariaDescribedBy
              ].filter(Boolean).join(' ') || undefined}
            />
          ) : field.type === 'select' ? (
            <Select
              id={getFieldId(field.name)}
              name={field.name}
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              disabled={loading}
              hasError={!!getFieldError(field.name)}
              highContrast={highContrastMode}
              aria-required={field.required}
              aria-invalid={!!getFieldError(field.name)}
              aria-describedby={[
                field.helpText ? getHelpTextId(field.name) : null,
                getFieldError(field.name) ? getErrorId(field.name) : null,
                field.ariaDescribedBy
              ].filter(Boolean).join(' ') || undefined}
            >
              <option value="">Select an option...</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : field.type === 'checkbox' ? (
            <CheckboxGroup>
              <Checkbox
                id={getFieldId(field.name)}
                name={field.name}
                checked={formData[field.name] || false}
                onChange={(checked) => handleFieldChange(field.name, checked)}
                onBlur={() => handleFieldBlur(field.name)}
                disabled={loading}
                aria-required={field.required}
                aria-invalid={!!getFieldError(field.name)}
                aria-describedby={[
                  field.helpText ? getHelpTextId(field.name) : null,
                  getFieldError(field.name) ? getErrorId(field.name) : null,
                  field.ariaDescribedBy
                ].filter(Boolean).join(' ') || undefined}
              />
              <CheckboxLabel htmlFor={getFieldId(field.name)}>
                {field.label}
              </CheckboxLabel>
            </CheckboxGroup>
          ) : (
            <Input
              id={getFieldId(field.name)}
              name={field.name}
              type={field.type}
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              placeholder={field.placeholder}
              disabled={loading}
              validationState={getFieldError(field.name) ? 'error' : 'default'}
              aria-required={field.required}
              aria-invalid={!!getFieldError(field.name)}
              aria-describedby={[
                field.helpText ? getHelpTextId(field.name) : null,
                getFieldError(field.name) ? getErrorId(field.name) : null,
                field.ariaDescribedBy
              ].filter(Boolean).join(' ') || undefined}
            />
          )}
          
          {field.helpText && (
            <FieldHelpText id={getHelpTextId(field.name)}>
              {field.helpText}
            </FieldHelpText>
          )}
          
          {getFieldError(field.name) && (
            <FormError 
              id={getErrorId(field.name)}
              message={getFieldError(field.name)!}
            />
          )}
        </FieldGroup>
      ))}

      <ButtonGroup>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
          aria-describedby={errors.length > 0 ? 'error-summary-title' : undefined}
        >
          Submit
        </Button>
      </ButtonGroup>
    </FormContainer>
  );
};