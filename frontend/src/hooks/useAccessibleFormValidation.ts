/**
 * Accessible Form Validation Hook
 * Provides WCAG 2.1 AA compliant form validation with comprehensive screen reader support
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { accessibility } from '../utils/accessibility';
import { useFocusManagement } from '../contexts/FocusManagementContext';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  asyncValidator?: (value: any) => Promise<string | null>;
}

export interface FieldConfig {
  rules?: ValidationRule;
  label: string;
  type?: 'text' | 'email' | 'number' | 'tel' | 'password' | 'url';
  formatError?: (error: string, value: any) => string;
  ariaDescribedBy?: string[];
  liveValidation?: boolean;
}

export interface FormConfig {
  [fieldName: string]: FieldConfig;
}

export interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom' | 'async';
  timestamp: number;
}

export interface FormState {
  values: Record<string, any>;
  errors: Record<string, ValidationError>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValidating: boolean;
  submitCount: number;
  fieldValidationStatus: Record<string, 'validating' | 'valid' | 'invalid' | 'idle'>;
}

export interface AccessibleFormValidationOptions {
  config: FormConfig;
  onSubmit?: (values: Record<string, any>) => Promise<void> | void;
  initialValues?: Record<string, any>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  announceErrors?: boolean;
  announceSuccess?: boolean;
  formName?: string;
  debounceValidation?: number;
}

export const useAccessibleFormValidation = (options: AccessibleFormValidationOptions) => {
  const {
    config,
    onSubmit,
    initialValues = {},
    validateOnChange = true,
    validateOnBlur = true,
    announceErrors = true,
    announceSuccess = true,
    formName = 'form',
    debounceValidation = 300,
  } = options;

  const { focusVisible } = useFocusManagement();
  const validationTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const lastAnnouncedErrors = useRef<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const [formState, setFormState] = useState<FormState>(() => ({
    values: { ...initialValues },
    errors: {},
    touched: {},
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
    fieldValidationStatus: {},
  }));

  // Validate individual field
  const validateField = useCallback(async (
    fieldName: string,
    value: any
  ): Promise<ValidationError | null> => {
    const fieldConfig = config[fieldName];
    if (!fieldConfig?.rules) return null;

    const { rules } = fieldConfig;

    // Required validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      return {
        field: fieldName,
        message: `${fieldConfig.label} is required`,
        type: 'required',
        timestamp: Date.now(),
      };
    }

    // Skip other validations if value is empty and not required
    if (!value || value.toString().trim() === '') return null;

    const stringValue = value.toString();

    // Length validations
    if (rules.minLength && stringValue.length < rules.minLength) {
      return {
        field: fieldName,
        message: `${fieldConfig.label} must be at least ${rules.minLength} characters`,
        type: 'minLength',
        timestamp: Date.now(),
      };
    }

    if (rules.maxLength && stringValue.length > rules.maxLength) {
      return {
        field: fieldName,
        message: `${fieldConfig.label} must be no more than ${rules.maxLength} characters`,
        type: 'maxLength',
        timestamp: Date.now(),
      };
    }

    // Numeric validations
    if (fieldConfig.type === 'number') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (rules.min !== undefined && numValue < rules.min) {
          return {
            field: fieldName,
            message: `${fieldConfig.label} must be at least ${rules.min}`,
            type: 'min',
            timestamp: Date.now(),
          };
        }

        if (rules.max !== undefined && numValue > rules.max) {
          return {
            field: fieldName,
            message: `${fieldConfig.label} must be no more than ${rules.max}`,
            type: 'max',
            timestamp: Date.now(),
          };
        }
      }
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      let message = `${fieldConfig.label} format is invalid`;
      
      // Provide specific messages for common patterns
      if (fieldConfig.type === 'email') {
        message = `${fieldConfig.label} must be a valid email address`;
      } else if (fieldConfig.type === 'tel') {
        message = `${fieldConfig.label} must be a valid phone number`;
      } else if (fieldConfig.type === 'url') {
        message = `${fieldConfig.label} must be a valid URL`;
      }

      return {
        field: fieldName,
        message,
        type: 'pattern',
        timestamp: Date.now(),
      };
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(value);
      if (customError) {
        return {
          field: fieldName,
          message: fieldConfig.formatError ? fieldConfig.formatError(customError, value) : customError,
          type: 'custom',
          timestamp: Date.now(),
        };
      }
    }

    // Async validation
    if (rules.asyncValidator) {
      try {
        const asyncError = await rules.asyncValidator(value);
        if (asyncError) {
          return {
            field: fieldName,
            message: fieldConfig.formatError ? fieldConfig.formatError(asyncError, value) : asyncError,
            type: 'async',
            timestamp: Date.now(),
          };
        }
      } catch (error) {
        return {
          field: fieldName,
          message: `${fieldConfig.label} validation failed`,
          type: 'async',
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }, [config]);

  // Validate all fields
  const validateForm = useCallback(async (): Promise<Record<string, ValidationError>> => {
    const errors: Record<string, ValidationError> = {};
    
    setFormState(prev => ({ ...prev, isValidating: true }));

    for (const [fieldName, value] of Object.entries(formState.values)) {
      const error = await validateField(fieldName, value);
      if (error) {
        errors[fieldName] = error;
      }
    }

    setFormState(prev => ({ ...prev, isValidating: false }));
    return errors;
  }, [formState.values, validateField]);

  // Handle field value change
  const handleFieldChange = useCallback(async (fieldName: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [fieldName]: value },
      fieldValidationStatus: { ...prev.fieldValidationStatus, [fieldName]: 'idle' },
    }));

    if (validateOnChange && config[fieldName]?.liveValidation !== false) {
      // Clear existing timeout
      if (validationTimeouts.current[fieldName]) {
        clearTimeout(validationTimeouts.current[fieldName]);
      }

      // Set new timeout for debounced validation
      validationTimeouts.current[fieldName] = setTimeout(async () => {
        setFormState(prev => ({
          ...prev,
          fieldValidationStatus: { ...prev.fieldValidationStatus, [fieldName]: 'validating' },
        }));

        const error = await validateField(fieldName, value);
        
        setFormState(prev => {
          const newErrors = { ...prev.errors };
          const newStatus = { ...prev.fieldValidationStatus };

          if (error) {
            newErrors[fieldName] = error;
            newStatus[fieldName] = 'invalid';
            
            // Announce error if it's different from the last one
            if (announceErrors && lastAnnouncedErrors.current[fieldName] !== error.message) {
              accessibility.announce(error.message, true);
              lastAnnouncedErrors.current[fieldName] = error.message;
            }
          } else {
            delete newErrors[fieldName];
            newStatus[fieldName] = 'valid';
            
            // Clear last announced error
            delete lastAnnouncedErrors.current[fieldName];
          }

          return {
            ...prev,
            errors: newErrors,
            fieldValidationStatus: newStatus,
          };
        });
      }, debounceValidation);
    }
  }, [validateOnChange, config, validateField, announceErrors, debounceValidation]);

  // Handle field blur
  const handleFieldBlur = useCallback(async (fieldName: string) => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, [fieldName]: true },
    }));

    if (validateOnBlur) {
      const value = formState.values[fieldName];
      const error = await validateField(fieldName, value);
      
      setFormState(prev => {
        const newErrors = { ...prev.errors };
        const newStatus = { ...prev.fieldValidationStatus };

        if (error) {
          newErrors[fieldName] = error;
          newStatus[fieldName] = 'invalid';
          
          // Announce error on blur
          if (announceErrors) {
            accessibility.announce(error.message, true);
            lastAnnouncedErrors.current[fieldName] = error.message;
          }
        } else {
          delete newErrors[fieldName];
          newStatus[fieldName] = 'valid';
          delete lastAnnouncedErrors.current[fieldName];
        }

        return {
          ...prev,
          errors: newErrors,
          fieldValidationStatus: newStatus,
        };
      });
    }
  }, [validateOnBlur, formState.values, validateField, announceErrors]);

  // Handle form submission
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    setFormState(prev => ({
      ...prev,
      isSubmitting: true,
      submitCount: prev.submitCount + 1,
      touched: Object.keys(config).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    }));

    try {
      const errors = await validateForm();
      
      if (Object.keys(errors).length > 0) {
        setFormState(prev => ({ ...prev, errors, isSubmitting: false }));
        
        // Announce validation errors
        if (announceErrors) {
          accessibility.announceValidationErrors(
            Object.fromEntries(Object.entries(errors).map(([key, error]) => [key, error.message])),
            formName
          );
        }

        // Focus first error field
        const firstErrorField = Object.keys(errors)[0];
        const firstErrorElement = formRef.current?.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
        if (firstErrorElement) {
          firstErrorElement.focus();
        }

        return;
      }

      // Form is valid, call onSubmit
      if (onSubmit) {
        await onSubmit(formState.values);
      }

      // Announce success
      if (announceSuccess) {
        accessibility.announceFormSuccess(formName);
      }

      setFormState(prev => ({ ...prev, isSubmitting: false }));

    } catch (error) {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
      
      if (announceErrors) {
        accessibility.announce(`${formName} submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    }
  }, [validateForm, onSubmit, config, announceErrors, announceSuccess, formName, formState.values]);

  // Get field props for integration with form components
  const getFieldProps = useCallback((fieldName: string) => {
    const fieldConfig = config[fieldName];
    const error = formState.errors[fieldName];
    const isTouched = formState.touched[fieldName];
    const value = formState.values[fieldName] || '';
    const validationStatus = formState.fieldValidationStatus[fieldName] || 'idle';

    const describedByIds: string[] = [];
    
    // Add error message ID if there's an error
    if (error && isTouched) {
      describedByIds.push(`${fieldName}-error`);
    }

    // Add field help text ID if configured
    if (fieldConfig.ariaDescribedBy) {
      describedByIds.push(...fieldConfig.ariaDescribedBy);
    }

    return {
      name: fieldName,
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        handleFieldChange(fieldName, event.target.value);
      },
      onBlur: () => handleFieldBlur(fieldName),
      'aria-invalid': error && isTouched ? 'true' : 'false',
      'aria-describedby': describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
      'aria-required': fieldConfig.rules?.required ? 'true' : undefined,
      required: fieldConfig.rules?.required,
      validationState: error && isTouched ? 'error' : validationStatus === 'valid' ? 'success' : 'default',
      validationMessage: error && isTouched ? error.message : undefined,
      ...focusVisible.getFocusVisibleProps(),
    };
  }, [config, formState, handleFieldChange, handleFieldBlur, focusVisible]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormState({
      values: { ...initialValues },
      errors: {},
      touched: {},
      isSubmitting: false,
      isValidating: false,
      submitCount: 0,
      fieldValidationStatus: {},
    });
    
    // Clear validation timeouts
    Object.values(validationTimeouts.current).forEach(timeout => clearTimeout(timeout));
    validationTimeouts.current = {};
    lastAnnouncedErrors.current = {};
  }, [initialValues]);

  // Set field value programmatically
  const setFieldValue = useCallback((fieldName: string, value: any) => {
    handleFieldChange(fieldName, value);
  }, [handleFieldChange]);

  // Check if form is valid
  const isValid = Object.keys(formState.errors).length === 0;
  const hasErrors = Object.keys(formState.errors).length > 0;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(validationTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return {
    // Form state
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isSubmitting: formState.isSubmitting,
    isValidating: formState.isValidating,
    submitCount: formState.submitCount,
    fieldValidationStatus: formState.fieldValidationStatus,
    isValid,
    hasErrors,

    // Form methods
    handleSubmit,
    getFieldProps,
    resetForm,
    setFieldValue,
    validateField,
    validateForm,

    // Refs
    formRef,
  };
};