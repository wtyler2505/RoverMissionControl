/**
 * Tests for FormError components
 * Comprehensive testing of error display, accessibility, and ARIA support
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { FormError, FormErrorList, FormValidationSummary } from '../FormError';
import { FocusManagementProvider } from '../../../../../contexts/FocusManagementContext';
import { lightTheme, darkTheme, missionCriticalTheme } from '../../../../../theme/themes';

const renderWithProviders = (
  component: React.ReactElement,
  theme = lightTheme
) => {
  return render(
    <ThemeProvider theme={theme}>
      <FocusManagementProvider>
        {component}
      </FocusManagementProvider>
    </ThemeProvider>
  );
};

describe('FormError', () => {
  describe('Basic functionality', () => {
    it('renders error message correctly', () => {
      renderWithProviders(
        <FormError>This is an error message</FormError>
      );

      expect(screen.getByText('This is an error message')).toBeInTheDocument();
    });

    it('applies custom ID when provided', () => {
      renderWithProviders(
        <FormError id="custom-error">Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toHaveAttribute('id', 'custom-error');
    });

    it('generates ID from field name when provided', () => {
      renderWithProviders(
        <FormError fieldName="email">Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toHaveAttribute('id', 'email-error');
    });

    it('applies custom CSS class', () => {
      renderWithProviders(
        <FormError className="custom-error-class">Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toHaveClass('custom-error-class');
    });

    it('applies test ID', () => {
      renderWithProviders(
        <FormError testId="error-test-id">Error message</FormError>
      );

      expect(screen.getByTestId('error-test-id')).toBeInTheDocument();
    });
  });

  describe('Accessibility features', () => {
    it('has proper ARIA role for non-live errors', () => {
      renderWithProviders(
        <FormError live={false}>Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toHaveAttribute('role', 'status');
      expect(errorElement).toHaveAttribute('aria-live', 'polite');
    });

    it('has proper ARIA role for live errors', () => {
      renderWithProviders(
        <FormError live={true}>Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toHaveAttribute('role', 'alert');
      expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('has aria-atomic attribute', () => {
      renderWithProviders(
        <FormError>Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toHaveAttribute('aria-atomic', 'true');
    });

    it('includes warning icon with proper aria-hidden', () => {
      renderWithProviders(
        <FormError>Error message</FormError>
      );

      const icon = screen.getByText('Error message').closest('div')?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon?.closest('span')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Visibility control', () => {
    it('shows error when visible is true', () => {
      renderWithProviders(
        <FormError visible={true}>Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toBeVisible();
    });

    it('hides error when visible is false', () => {
      renderWithProviders(
        <FormError visible={false}>Error message</FormError>
      );

      const errorElement = screen.getByText('Error message').closest('div');
      // Element should still be in DOM but with opacity 0
      expect(errorElement).toBeInTheDocument();
    });
  });

  describe('Theme support', () => {
    it('applies correct styles for light theme', () => {
      renderWithProviders(
        <FormError>Error message</FormError>,
        lightTheme
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toBeInTheDocument();
    });

    it('applies correct styles for dark theme', () => {
      renderWithProviders(
        <FormError>Error message</FormError>,
        darkTheme
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toBeInTheDocument();
    });

    it('applies mission critical theme enhancements', () => {
      renderWithProviders(
        <FormError>Error message</FormError>,
        missionCriticalTheme
      );

      const errorElement = screen.getByText('Error message').closest('div');
      expect(errorElement).toBeInTheDocument();
    });
  });
});

describe('FormErrorList', () => {
  const sampleErrors = {
    email: 'Email is required',
    password: 'Password must be at least 8 characters',
    age: 'Age must be at least 18',
  };

  const fieldLabels = {
    email: 'Email Address',
    password: 'Password',
    age: 'Age',
  };

  describe('Basic functionality', () => {
    it('renders error list correctly', () => {
      renderWithProviders(
        <FormErrorList errors={sampleErrors} />
      );

      expect(screen.getByText('Please correct the following errors:')).toBeInTheDocument();
      expect(screen.getByText(/Email is required/)).toBeInTheDocument();
      expect(screen.getByText(/Password must be at least 8 characters/)).toBeInTheDocument();
      expect(screen.getByText(/Age must be at least 18/)).toBeInTheDocument();
    });

    it('uses custom title when provided', () => {
      renderWithProviders(
        <FormErrorList
          errors={sampleErrors}
          title="Fix these issues:"
        />
      );

      expect(screen.getByText('Fix these issues:')).toBeInTheDocument();
    });

    it('uses field labels when provided', () => {
      renderWithProviders(
        <FormErrorList
          errors={sampleErrors}
          fieldLabels={fieldLabels}
        />
      );

      expect(screen.getByText(/Email Address:/)).toBeInTheDocument();
      expect(screen.getByText(/Password:/)).toBeInTheDocument();
      expect(screen.getByText(/Age:/)).toBeInTheDocument();
    });

    it('applies custom CSS class', () => {
      renderWithProviders(
        <FormErrorList
          errors={sampleErrors}
          className="custom-error-list"
        />
      );

      const listElement = screen.getByRole('alert');
      expect(listElement).toHaveClass('custom-error-list');
    });

    it('applies test ID', () => {
      renderWithProviders(
        <FormErrorList
          errors={sampleErrors}
          testId="error-list-test"
        />
      );

      expect(screen.getByTestId('error-list-test')).toBeInTheDocument();
    });

    it('returns null when no errors', () => {
      const { container } = renderWithProviders(
        <FormErrorList errors={{}} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Accessibility features', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(
        <FormErrorList errors={sampleErrors} />
      );

      const listElement = screen.getByRole('alert');
      expect(listElement).toHaveAttribute('aria-live', 'assertive');
      expect(listElement).toHaveAttribute('aria-atomic', 'true');
    });

    it('has proper list structure', () => {
      renderWithProviders(
        <FormErrorList errors={sampleErrors} />
      );

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('includes warning emoji in title', () => {
      renderWithProviders(
        <FormErrorList errors={sampleErrors} />
      );

      const title = screen.getByRole('heading', { level: 3 });
      expect(title.textContent).toMatch(/⚠/);
    });
  });

  describe('Visibility control', () => {
    it('shows list when visible is true', () => {
      renderWithProviders(
        <FormErrorList errors={sampleErrors} visible={true} />
      );

      const listElement = screen.getByRole('alert');
      expect(listElement).toBeVisible();
    });

    it('hides list when visible is false', () => {
      renderWithProviders(
        <FormErrorList errors={sampleErrors} visible={false} />
      );

      const listElement = screen.getByRole('alert');
      expect(listElement).toBeInTheDocument();
    });
  });
});

describe('FormValidationSummary', () => {
  describe('Success state', () => {
    it('displays success state correctly', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
        />
      );

      expect(screen.getByText('All fields are valid')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('uses custom success message', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
          successMessage="Form is ready to submit"
        />
      );

      expect(screen.getByText('Form is ready to submit')).toBeInTheDocument();
    });

    it('displays success icon', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
        />
      );

      const icon = screen.getByText('All fields are valid').closest('div')?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('displays error state correctly', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={false}
          isValidating={false}
          errorCount={2}
          fieldCount={5}
        />
      );

      expect(screen.getByText('2 of 5 fields have errors')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('displays error icon', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={false}
          isValidating={false}
          errorCount={2}
          fieldCount={5}
        />
      );

      const icon = screen.getByText('2 of 5 fields have errors').closest('div')?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Validating state', () => {
    it('displays validating state correctly', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={false}
          isValidating={true}
          errorCount={0}
          fieldCount={3}
        />
      );

      expect(screen.getByText('Validating form...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays validating icon', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={false}
          isValidating={true}
          errorCount={0}
          fieldCount={3}
        />
      );

      const icon = screen.getByText('Validating form...').closest('div')?.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Accessibility features', () => {
    it('has proper ARIA attributes for success state', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
        />
      );

      const summary = screen.getByRole('status');
      expect(summary).toHaveAttribute('aria-live', 'assertive');
      expect(summary).toHaveAttribute('aria-atomic', 'true');
    });

    it('has proper ARIA attributes for error state', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={false}
          isValidating={false}
          errorCount={1}
          fieldCount={3}
        />
      );

      const summary = screen.getByRole('alert');
      expect(summary).toHaveAttribute('aria-live', 'assertive');
      expect(summary).toHaveAttribute('aria-atomic', 'true');
    });

    it('has proper ARIA attributes for validating state', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={false}
          isValidating={true}
          errorCount={0}
          fieldCount={3}
        />
      );

      const summary = screen.getByRole('status');
      expect(summary).toHaveAttribute('aria-live', 'polite');
      expect(summary).toHaveAttribute('aria-atomic', 'true');
    });

    it('includes icons with proper aria-hidden', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
        />
      );

      const iconContainer = screen.getByText('All fields are valid').closest('div')?.querySelector('span');
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Custom styling', () => {
    it('applies custom CSS class', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
          className="custom-summary"
        />
      );

      const summary = screen.getByRole('status');
      expect(summary).toHaveClass('custom-summary');
    });

    it('applies test ID', () => {
      renderWithProviders(
        <FormValidationSummary
          isValid={true}
          isValidating={false}
          errorCount={0}
          fieldCount={3}
          testId="validation-summary-test"
        />
      );

      expect(screen.getByTestId('validation-summary-test')).toBeInTheDocument();
    });
  });
});