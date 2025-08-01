/**
 * Tests for AccessibleForm component
 * Comprehensive testing of form functionality, accessibility, and integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { ThemeProvider } from '@emotion/react';
import { AccessibleForm, FormFieldWrapper } from '../AccessibleForm';
import { Input } from '../../Input/Input';
import { FocusManagementProvider } from '../../../../../contexts/FocusManagementContext';
import { FormConfig } from '../../../../../hooks/useAccessibleFormValidation';
import { lightTheme, missionCriticalTheme } from '../../../../../theme/themes';

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

describe('AccessibleForm', () => {
  const mockOnSubmit = jest.fn();
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    mockOnSubmit.mockClear();
  });

  const basicConfig: FormConfig = {
    email: {
      label: 'Email',
      type: 'email',
      rules: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
    },
    password: {
      label: 'Password',
      type: 'password',
      rules: {
        required: true,
        minLength: 8,
      },
    },
  };

  const BasicFormContent = () => (
    <>
      <Input name="email" label="Email" type="email" />
      <Input name="password" label="Password" type="password" />
    </>
  );

  describe('Basic functionality', () => {
    it('renders form with title and description', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          title="Test Form"
          description="This is a test form"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.getByText('Test Form')).toBeInTheDocument();
      expect(screen.getByText('This is a test form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('renders form without title or description', () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.queryByText('Test Form')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('applies custom class name', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          className="custom-form-class"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveClass('custom-form-class');
    });

    it('applies test ID', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          testId="test-form-id"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.getByTestId('test-form-id')).toBeInTheDocument();
    });

    it('shows reset button when enabled', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          showResetButton={true}
          resetText="Clear Form"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.getByRole('button', { name: 'Clear Form' })).toBeInTheDocument();
    });

    it('hides reset button by default', () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    });
  });

  describe('Form validation integration', () => {
    it('shows validation summary after submission attempt', async () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          showValidationSummary={true}
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/fields have errors/)).toBeInTheDocument();
      });
    });

    it('shows error list when enabled', async () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          showErrorList={true}
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please correct the following errors:')).toBeInTheDocument();
        expect(screen.getByText(/Email is required/)).toBeInTheDocument();
        expect(screen.getByText(/Password is required/)).toBeInTheDocument();
      });
    });

    it('hides validation components when disabled', async () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          showValidationSummary={false}
          showErrorList={false}
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Please correct the following errors:')).not.toBeInTheDocument();
        expect(screen.queryByText(/fields have errors/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form submission', () => {
    it('calls onSubmit with valid data', async () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('prevents submission with invalid data', async () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      const slowOnSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={slowOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Should show loading state
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('handles submission errors gracefully', async () => {
      const errorOnSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));

      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={errorOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('supports keyboard submission', async () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });
  });

  describe('Form reset functionality', () => {
    it('resets form when reset button is clicked', async () => {
      const initialValues = { email: 'initial@example.com', password: 'initialpass' };

      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          initialValues={initialValues}
          showResetButton={true}
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const resetButton = screen.getByRole('button', { name: 'Reset' });

      // Change values
      await user.clear(emailInput);
      await user.type(emailInput, 'changed@example.com');
      await user.clear(passwordInput);
      await user.type(passwordInput, 'changedpass');

      // Reset form
      await user.click(resetButton);

      expect(emailInput).toHaveValue('initial@example.com');
      expect(passwordInput).toHaveValue('initialpass');
    });
  });

  describe('Accessibility features', () => {
    it('has proper ARIA labelledby when title is provided', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          title="Test Form"
          formName="test-form"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-labelledby', 'test-form-title');
    });

    it('has proper ARIA describedby when description is provided', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          description="Form description"
          formName="test-form"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-describedby', 'test-form-description');
    });

    it('has novalidate attribute by default', () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('novalidate');
    });

    it('can disable novalidate attribute', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          noValidate={false}
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const form = screen.getByRole('form');
      expect(form).not.toHaveAttribute('novalidate');
    });

    it('provides proper heading structure', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          title="Test Form"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test Form');
    });
  });

  describe('Field integration', () => {
    it('passes field props to child components', async () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <Input name="email" label="Email" type="email" />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      
      // Should have ARIA attributes from form validation
      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      expect(emailInput).toHaveAttribute('aria-required', 'true');
    });

    it('updates ARIA attributes after validation', async () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <Input name="email" label="Email" type="email" />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby');
      });
    });
  });

  describe('Custom button text', () => {
    it('uses custom submit button text', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          submitText="Save Changes"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('uses custom reset button text', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          showResetButton={true}
          resetText="Clear All"
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
    });
  });

  describe('Theme support', () => {
    it('applies mission critical theme styling', () => {
      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={mockOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>,
        missionCriticalTheme
      );

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('disables all form elements when disabled', () => {
      renderWithProviders(
        <AccessibleForm
          config={basicConfig}
          onSubmit={mockOnSubmit}
          disabled={true}
          showResetButton={true}
        >
          <BasicFormContent />
        </AccessibleForm>
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      const resetButton = screen.getByRole('button', { name: 'Reset' });

      expect(submitButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
    });
  });

  describe('Loading overlay', () => {
    it('shows loading overlay during submission', async () => {
      const slowOnSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithProviders(
        <AccessibleForm config={basicConfig} onSubmit={slowOnSubmit}>
          <BasicFormContent />
        </AccessibleForm>
      );

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Loading overlay should be visible
      const loadingSpinner = screen.getByRole('form').parentElement?.querySelector('[aria-hidden="true"]');
      expect(loadingSpinner).toBeInTheDocument();

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});

describe('FormFieldWrapper', () => {
  it('renders children correctly', () => {
    render(
      <FormFieldWrapper>
        <input type="text" placeholder="Test input" />
      </FormFieldWrapper>
    );

    expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
  });

  it('applies custom class name', () => {
    render(
      <FormFieldWrapper className="custom-wrapper">
        <input type="text" />
      </FormFieldWrapper>
    );

    const wrapper = screen.getByRole('textbox').parentElement;
    expect(wrapper).toHaveClass('custom-wrapper');
  });

  it('applies test ID', () => {
    render(
      <FormFieldWrapper testId="field-wrapper-test">
        <input type="text" />
      </FormFieldWrapper>
    );

    expect(screen.getByTestId('field-wrapper-test')).toBeInTheDocument();
  });
});