/**
 * Accessible Form Error Component
 * Provides WCAG 2.1 AA compliant error messaging with proper ARIA support
 */

import React from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { useFocusManagement } from '../../../../contexts/FocusManagementContext';

export interface FormErrorProps {
  id?: string;
  children: React.ReactNode;
  fieldName?: string;
  visible?: boolean;
  live?: boolean;
  testId?: string;
  className?: string;
}

const ErrorContainer = styled.div<{ theme: Theme; visible: boolean }>`
  margin-top: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  color: ${({ theme }) => theme.colors.error.main};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  
  ${({ visible }) => css`
    opacity: ${visible ? 1 : 0};
    max-height: ${visible ? '200px' : '0'};
    overflow: hidden;
    transition: opacity 0.2s ease-in-out, max-height 0.2s ease-in-out;
  `}

  /* Ensure sufficient color contrast */
  @media (prefers-contrast: high) {
    color: ${({ theme }) => theme.colors.error.dark};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  }

  /* Ensure readability in reduced motion mode */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  /* High contrast theme support */
  ${({ theme }) => theme.name === 'highContrast' && css`
    color: ${theme.colors.error.dark};
    font-weight: ${theme.typography.fontWeight.bold};
    border-left: 3px solid ${theme.colors.error.main};
    padding-left: ${theme.spacing[2]};
  `}

  /* Mission Critical theme support */
  ${({ theme }) => theme.name === 'missionCritical' && css`
    background-color: ${theme.colors.error.light}20;
    border: 1px solid ${theme.colors.error.main};
    border-radius: ${theme.borderRadius.sm};
    padding: ${theme.spacing[2]};
    position: relative;

    &::before {
      content: '⚠';
      margin-right: ${theme.spacing[1]};
      font-weight: bold;
    }
  `}
`;

const ErrorIcon = styled.span<{ theme: Theme }>`
  display: inline-flex;
  align-items: center;
  margin-right: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  
  /* Only show icon if not in mission critical theme (which has its own icon) */
  ${({ theme }) => theme.name === 'missionCritical' && css`
    display: none;
  `}
`;

const ErrorText = styled.span`
  display: inline;
`;

export const FormError: React.FC<FormErrorProps> = ({
  id,
  children,
  fieldName,
  visible = true,
  live = false,
  testId,
  className,
}) => {
  const { focusVisible } = useFocusManagement();

  // Generate ID if not provided
  const errorId = id || (fieldName ? `${fieldName}-error` : undefined);

  // Determine ARIA attributes
  const ariaAttributes = {
    id: errorId,
    role: live ? 'alert' : 'status',
    'aria-live': live ? 'assertive' : 'polite',
    'aria-atomic': 'true',
    'data-testid': testId,
  };

  return (
    <ErrorContainer
      visible={visible}
      className={className}
      {...ariaAttributes}
      {...focusVisible.getFocusVisibleProps()}
    >
      <ErrorIcon aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.89 0 1.439-.99.982-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
          />
        </svg>
      </ErrorIcon>
      <ErrorText>{children}</ErrorText>
    </ErrorContainer>
  );
};

FormError.displayName = 'FormError';

/**
 * FormErrorList - Component for displaying multiple validation errors
 */
export interface FormErrorListProps {
  errors: Record<string, string>;
  fieldLabels?: Record<string, string>;
  visible?: boolean;
  title?: string;
  testId?: string;
  className?: string;
}

const ErrorListContainer = styled.div<{ theme: Theme; visible: boolean }>`
  margin-top: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme }) => theme.colors.error.light}10;
  border: 1px solid ${({ theme }) => theme.colors.error.main};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  
  ${({ visible }) => css`
    opacity: ${visible ? 1 : 0};
    max-height: ${visible ? 'none' : '0'};
    overflow: hidden;
    transition: opacity 0.3s ease-in-out, max-height 0.3s ease-in-out;
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ErrorListTitle = styled.h3<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.error.dark};
  display: flex;
  align-items: center;

  &::before {
    content: '⚠';
    margin-right: ${({ theme }) => theme.spacing[2]};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
  }
`;

const ErrorList = styled.ul<{ theme: Theme }>`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing[4]};
  list-style: none;
`;

const ErrorListItem = styled.li<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.error.main};
  position: relative;

  &::before {
    content: '•';
    position: absolute;
    left: -${({ theme }) => theme.spacing[3]};
    color: ${({ theme }) => theme.colors.error.main};
    font-weight: bold;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

export const FormErrorList: React.FC<FormErrorListProps> = ({
  errors,
  fieldLabels = {},
  visible = true,
  title = 'Please correct the following errors:',
  testId,
  className,
}) => {
  const { focusVisible } = useFocusManagement();
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) {
    return null;
  }

  return (
    <ErrorListContainer
      visible={visible}
      className={className}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      data-testid={testId}
      {...focusVisible.getFocusVisibleProps()}
    >
      <ErrorListTitle>{title}</ErrorListTitle>
      <ErrorList>
        {errorEntries.map(([fieldName, errorMessage]) => (
          <ErrorListItem key={fieldName}>
            <strong>{fieldLabels[fieldName] || fieldName}:</strong> {errorMessage}
          </ErrorListItem>
        ))}
      </ErrorList>
    </ErrorListContainer>
  );
};

FormErrorList.displayName = 'FormErrorList';

/**
 * FormValidationSummary - Component for displaying form validation status
 */
export interface FormValidationSummaryProps {
  isValid: boolean;
  isValidating: boolean;
  errorCount: number;
  fieldCount: number;
  successMessage?: string;
  testId?: string;
  className?: string;
}

const SummaryContainer = styled.div<{ theme: Theme; variant: 'success' | 'error' | 'validating' }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  display: flex;
  align-items: center;
  
  ${({ theme, variant }) => {
    switch (variant) {
      case 'success':
        return css`
          background-color: ${theme.colors.success.light}20;
          border: 1px solid ${theme.colors.success.main};
          color: ${theme.colors.success.dark};
        `;
      case 'error':
        return css`
          background-color: ${theme.colors.error.light}20;
          border: 1px solid ${theme.colors.error.main};
          color: ${theme.colors.error.dark};
        `;
      case 'validating':
        return css`
          background-color: ${theme.colors.info.light}20;
          border: 1px solid ${theme.colors.info.main};
          color: ${theme.colors.info.dark};
        `;
    }
  }}
`;

const SummaryIcon = styled.span<{ theme: Theme }>`
  margin-right: ${({ theme }) => theme.spacing[2]};
  display: flex;
  align-items: center;
`;

const SummaryText = styled.span`
  flex: 1;
`;

export const FormValidationSummary: React.FC<FormValidationSummaryProps> = ({
  isValid,
  isValidating,
  errorCount,
  fieldCount,
  successMessage = 'All fields are valid',
  testId,
  className,
}) => {
  const { focusVisible } = useFocusManagement();

  const getVariant = (): 'success' | 'error' | 'validating' => {
    if (isValidating) return 'validating';
    if (errorCount > 0) return 'error';
    return 'success';
  };

  const getSummaryText = (): string => {
    if (isValidating) return 'Validating form...';
    if (errorCount > 0) {
      return `${errorCount} of ${fieldCount} fields have errors`;
    }
    return successMessage;
  };

  const getIcon = () => {
    const variant = getVariant();
    const iconSize = 16;
    
    switch (variant) {
      case 'success':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
          </svg>
        );
      case 'error':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.706c.89 0 1.439-.99.982-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
        );
      case 'validating':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM8 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm.5-8a.5.5 0 0 0-1 0v3a.5.5 0 0 0 1 0V5z"/>
          </svg>
        );
    }
  };

  const variant = getVariant();

  return (
    <SummaryContainer
      variant={variant}
      className={className}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'validating' ? 'polite' : 'assertive'}
      aria-atomic="true"
      data-testid={testId}
      {...focusVisible.getFocusVisibleProps()}
    >
      <SummaryIcon aria-hidden="true">
        {getIcon()}
      </SummaryIcon>
      <SummaryText>{getSummaryText()}</SummaryText>
    </SummaryContainer>
  );
};

FormValidationSummary.displayName = 'FormValidationSummary';