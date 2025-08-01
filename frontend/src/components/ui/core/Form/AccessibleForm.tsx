/**
 * Accessible Form Component
 * Provides WCAG 2.1 AA compliant form with comprehensive validation and screen reader support
 */

import React, { forwardRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { useFocusManagement } from '../../../../contexts/FocusManagementContext';
import { useAccessibleFormValidation, FormConfig } from '../../../../hooks/useAccessibleFormValidation';
import { FormError, FormErrorList, FormValidationSummary } from '../FormError/FormError';
import { Button } from '../Button/Button';
import { focusStyles } from '../utils';

export interface AccessibleFormProps {
  config: FormConfig;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  initialValues?: Record<string, any>;
  title?: string;
  description?: string;
  children: React.ReactNode;
  submitText?: string;
  resetText?: string;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  announceErrors?: boolean;
  announceSuccess?: boolean;
  showValidationSummary?: boolean;
  showErrorList?: boolean;
  showResetButton?: boolean;
  disabled?: boolean;
  formName?: string;
  testId?: string;
  className?: string;
  noValidate?: boolean;
}

const FormContainer = styled.form<{ theme: Theme }>`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
  
  /* Focus management for the form container */
  &:focus-within {
    ${({ theme }) => focusStyles(theme, 'form')}
  }

  /* Ensure proper spacing for nested components */
  > * + * {
    margin-top: ${({ theme }) => theme.spacing[3]};
  }

  /* Mission Critical theme enhancements */
  ${({ theme }) => theme.name === 'missionCritical' && css`
    border: 2px solid ${theme.colors.primary.main}40;
    border-radius: ${theme.borderRadius.lg};
    padding: ${theme.spacing[6]};
    background-color: ${theme.colors.background.paper};
    
    /* Enhanced focus indication for mission critical */
    &:focus-within {
      border-color: ${theme.colors.primary.main};
      box-shadow: 0 0 0 3px ${theme.colors.primary.main}40;
    }
  `}
`;

const FormHeader = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const FormTitle = styled.h2<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const FormDescription = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const FormFields = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const FormActions = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-top: ${({ theme }) => theme.spacing[6]};
  padding-top: ${({ theme }) => theme.spacing[4]};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};

  /* Stack buttons on small screens */
  @media (max-width: 480px) {
    flex-direction: column-reverse;
    align-items: stretch;
  }
`;

const LoadingOverlay = styled.div<{ theme: Theme; visible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.colors.background.paper}80;
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  opacity: ${({ visible }) => visible ? 1 : 0};
  visibility: ${({ visible }) => visible ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
  z-index: 10;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const LoadingSpinner = styled.div<{ theme: Theme }>`
  width: 40px;
  height: 40px;
  border: 3px solid ${({ theme }) => theme.colors.primary.light};
  border-top: 3px solid ${({ theme }) => theme.colors.primary.main};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    /* Show a static loading indicator instead */
    &::after {
      content: '⟳';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 24px;
      color: ${({ theme }) => theme.colors.primary.main};
    }
  }
`;

const FormWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const AccessibleForm = forwardRef<HTMLFormElement, AccessibleFormProps>(
  (
    {
      config,
      onSubmit,
      initialValues,
      title,
      description,
      children,
      submitText = 'Submit',
      resetText = 'Reset',
      validateOnChange = true,
      validateOnBlur = true,
      announceErrors = true,
      announceSuccess = true,
      showValidationSummary = true,
      showErrorList = true,
      showResetButton = false,
      disabled = false,
      formName = 'form',
      testId,
      className,
      noValidate = true,
      ...props
    },
    ref
  ) => {
    const { focusVisible } = useFocusManagement();

    const {
      values,
      errors,
      touched,
      isSubmitting,
      isValidating,
      submitCount,
      isValid,
      hasErrors,
      handleSubmit,
      getFieldProps,
      resetForm,
      formRef,
    } = useAccessibleFormValidation({
      config,
      onSubmit,
      initialValues,
      validateOnChange,
      validateOnBlur,
      announceErrors,
      announceSuccess,
      formName,
    });

    // Combine refs
    const combinedRef = (node: HTMLFormElement) => {
      if (formRef.current !== node) {
        formRef.current = node;
      }
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          ref.current = node;
        }
      }
    };

    // Get field labels for error list
    const fieldLabels = Object.fromEntries(
      Object.entries(config).map(([fieldName, fieldConfig]) => [
        fieldName,
        fieldConfig.label,
      ])
    );

    // Calculate validation summary props
    const errorCount = Object.keys(errors).length;
    const fieldCount = Object.keys(config).length;

    // Get only errors for touched fields (for error list display)
    const touchedErrors = Object.fromEntries(
      Object.entries(errors).filter(([fieldName]) => touched[fieldName])
    );

    const touchedErrorMessages = Object.fromEntries(
      Object.entries(touchedErrors).map(([fieldName, error]) => [
        fieldName,
        error.message,
      ])
    );

    return (
      <FormWrapper>
        <FormContainer
          ref={combinedRef}
          className={className}
          onSubmit={handleSubmit}
          noValidate={noValidate}
          aria-labelledby={title ? `${formName}-title` : undefined}
          aria-describedby={description ? `${formName}-description` : undefined}
          data-testid={testId}
          {...focusVisible.getFocusVisibleProps()}
          {...props}
        >
          {(title || description) && (
            <FormHeader>
              {title && (
                <FormTitle id={`${formName}-title`}>
                  {title}
                </FormTitle>
              )}
              {description && (
                <FormDescription id={`${formName}-description`}>
                  {description}
                </FormDescription>
              )}
            </FormHeader>
          )}

          {showValidationSummary && submitCount > 0 && (
            <FormValidationSummary
              isValid={isValid}
              isValidating={isValidating}
              errorCount={errorCount}
              fieldCount={fieldCount}
              testId={`${formName}-validation-summary`}
            />
          )}

          {showErrorList && Object.keys(touchedErrorMessages).length > 0 && (
            <FormErrorList
              errors={touchedErrorMessages}
              fieldLabels={fieldLabels}
              testId={`${formName}-error-list`}
            />
          )}

          <FormFields>
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child) && child.props.name) {
                const fieldName = child.props.name;
                const fieldProps = getFieldProps(fieldName);
                
                return React.cloneElement(child, {
                  ...fieldProps,
                  ...child.props, // Child props override field props
                });
              }
              return child;
            })}
          </FormFields>

          <FormActions>
            {showResetButton && (
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={disabled || isSubmitting}
                testId={`${formName}-reset-button`}
              >
                {resetText}
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={disabled || isSubmitting || (submitCount > 0 && hasErrors)}
              loading={isSubmitting}
              testId={`${formName}-submit-button`}
            >
              {submitText}
            </Button>
          </FormActions>
        </FormContainer>

        <LoadingOverlay
          visible={isSubmitting}
          aria-hidden="true"
        >
          <LoadingSpinner />
        </LoadingOverlay>
      </FormWrapper>
    );
  }
);

AccessibleForm.displayName = 'AccessibleForm';

/**
 * FormFieldWrapper - Helper component for consistent field styling
 */
interface FormFieldWrapperProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

const FieldWrapper = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
`;

export const FormFieldWrapper: React.FC<FormFieldWrapperProps> = ({
  children,
  className,
  testId,
}) => {
  return (
    <FieldWrapper
      className={className}
      data-testid={testId}
    >
      {children}
    </FieldWrapper>
  );
};

FormFieldWrapper.displayName = 'FormFieldWrapper';