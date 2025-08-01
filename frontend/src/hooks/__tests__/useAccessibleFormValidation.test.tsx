/**
 * Tests for useAccessibleFormValidation hook
 * Comprehensive testing of form validation, accessibility, and screen reader integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { useAccessibleFormValidation, FormConfig } from '../useAccessibleFormValidation';
import { FocusManagementProvider } from '../../contexts/FocusManagementContext';
import { accessibility } from '../../utils/accessibility';

// Mock the accessibility utility
jest.mock('../../utils/accessibility', () => ({
  accessibility: {
    announce: jest.fn(),
    announceValidationErrors: jest.fn(),
    announceFormSuccess: jest.fn(),
  },
}));

// Test component that uses the hook
interface TestFormProps {
  config: FormConfig;
  onSubmit?: (values: Record<string, any>) => Promise<void> | void;
  initialValues?: Record<string, any>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  announceErrors?: boolean;
}

const TestForm: React.FC<TestFormProps> = ({
  config,
  onSubmit = jest.fn(),
  initialValues,
  validateOnChange = true,
  validateOnBlur = true,
  announceErrors = true,
}) => {
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    isValid,
    hasErrors,
    handleSubmit,
    getFieldProps,
    resetForm,
    setFieldValue,
    formRef,
  } = useAccessibleFormValidation({
    config,
    onSubmit,
    initialValues,
    validateOnChange,
    validateOnBlur,
    announceErrors,
    formName: 'test-form',
  });

  return (
    <form ref={formRef} onSubmit={handleSubmit} data-testid="test-form">
      <div data-testid="form-state">
        <span data-testid="is-valid">{isValid.toString()}</span>
        <span data-testid="has-errors">{hasErrors.toString()}</span>
        <span data-testid="is-submitting">{isSubmitting.toString()}</span>
        <span data-testid="is-validating">{isValidating.toString()}</span>
      </div>

      {Object.keys(config).map((fieldName) => {
        const fieldProps = getFieldProps(fieldName);
        const error = errors[fieldName];
        const isTouched = touched[fieldName];

        return (
          <div key={fieldName} data-testid={`field-${fieldName}`}>
            <input
              {...fieldProps}
              data-testid={`input-${fieldName}`}
              placeholder={config[fieldName].label}
            />
            {error && isTouched && (
              <div
                data-testid={`error-${fieldName}`}
                role="alert"
                aria-live="assertive"
              >
                {error.message}
              </div>
            )}
          </div>
        );
      })}

      <button type="submit" data-testid="submit-button">
        Submit
      </button>
      <button
        type="button"
        onClick={resetForm}
        data-testid="reset-button"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={() => setFieldValue('email', 'test@example.com')}
        data-testid="set-email-button"
      >
        Set Email
      </button>
    </form>
  );
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <FocusManagementProvider>
      {component}
    </FocusManagementProvider>
  );
};

describe('useAccessibleFormValidation', () => {
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
    age: {
      label: 'Age',
      type: 'number',
      rules: {
        min: 18,
        max: 120,
      },
    },
  };

  describe('Basic functionality', () => {
    it('initializes with empty values and no errors', () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      expect(screen.getByTestId('is-valid')).toHaveTextContent('true');
      expect(screen.getByTestId('has-errors')).toHaveTextContent('false');
      expect(screen.getByTestId('is-submitting')).toHaveTextContent('false');
      expect(screen.getByTestId('is-validating')).toHaveTextContent('false');
    });

    it('initializes with provided initial values', () => {
      const initialValues = { email: 'test@example.com', password: 'password123' };
      renderWithProvider(
        <TestForm config={basicConfig} initialValues={initialValues} />
      );

      expect(screen.getByTestId('input-email')).toHaveValue('test@example.com');
      expect(screen.getByTestId('input-password')).toHaveValue('password123');
    });

    it('updates field values on change', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });
  });

  describe('Validation rules', () => {
    it('validates required fields', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-email')).toBeInTheDocument();
        expect(screen.getByTestId('error-password')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-email')).toHaveTextContent('Email is required');
      expect(screen.getByTestId('error-password')).toHaveTextContent('Password is required');
      expect(screen.getByTestId('has-errors')).toHaveTextContent('true');
      expect(screen.getByTestId('is-valid')).toHaveTextContent('false');
    });

    it('validates minimum length', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const passwordInput = screen.getByTestId('input-password');
      await user.type(passwordInput, 'short');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByTestId('error-password')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-password')).toHaveTextContent(
        'Password must be at least 8 characters'
      );
    });

    it('validates email pattern', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid-email');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByTestId('error-email')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-email')).toHaveTextContent(
        'Email must be a valid email address'
      );
    });

    it('validates numeric ranges', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const ageInput = screen.getByTestId('input-age');
      await user.type(ageInput, '10');
      await user.tab(); // Trigger blur validation

      await waitFor(() => {
        expect(screen.getByTestId('error-age')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-age')).toHaveTextContent('Age must be at least 18');

      await user.clear(ageInput);
      await user.type(ageInput, '150');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('error-age')).toHaveTextContent('Age must be no more than 120');
      });
    });

    it('validates custom rules', async () => {
      const configWithCustomRule: FormConfig = {
        username: {
          label: 'Username',
          rules: {
            custom: (value) => {
              if (value && value.includes('admin')) {
                return 'Username cannot contain "admin"';
              }
              return null;
            },
          },
        },
      };

      renderWithProvider(<TestForm config={configWithCustomRule} />);

      const usernameInput = screen.getByTestId('input-username');
      await user.type(usernameInput, 'adminuser');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('error-username')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-username')).toHaveTextContent(
        'Username cannot contain "admin"'
      );
    });
  });

  describe('Validation timing', () => {
    it('validates on change when enabled', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} validateOnChange={true} />
      );

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');

      // Wait for debounced validation
      await waitFor(
        () => {
          expect(screen.getByTestId('error-email')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );
    });

    it('does not validate on change when disabled', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} validateOnChange={false} />
      );

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');

      // Wait and ensure no validation occurred
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      expect(screen.queryByTestId('error-email')).not.toBeInTheDocument();
    });

    it('validates on blur when enabled', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} validateOnBlur={true} />
      );

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByTestId('error-email')).toBeInTheDocument();
      });
    });

    it('does not validate on blur when disabled', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} validateOnBlur={false} />
      );

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');
      await user.tab(); // Trigger blur

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(screen.queryByTestId('error-email')).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('calls onSubmit with valid data', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} onSubmit={mockOnSubmit} />
      );

      const emailInput = screen.getByTestId('input-email');
      const passwordInput = screen.getByTestId('input-password');
      const submitButton = screen.getByTestId('submit-button');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          age: '',
        });
      });
    });

    it('does not call onSubmit with invalid data', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} onSubmit={mockOnSubmit} />
      );

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('has-errors')).toHaveTextContent('true');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('handles async submission errors', async () => {
      const errorOnSubmit = jest.fn().mockRejectedValue(new Error('Submission failed'));

      renderWithProvider(
        <TestForm config={basicConfig} onSubmit={errorOnSubmit} />
      );

      const emailInput = screen.getByTestId('input-email');
      const passwordInput = screen.getByTestId('input-password');
      const submitButton = screen.getByTestId('submit-button');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('is-submitting')).toHaveTextContent('false');
      });
    });
  });

  describe('Accessibility features', () => {
    it('announces validation errors when enabled', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} announceErrors={true} />
      );

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');
      await user.tab();

      await waitFor(() => {
        expect(accessibility.announce).toHaveBeenCalledWith(
          'Email must be a valid email address',
          true
        );
      });
    });

    it('does not announce errors when disabled', async () => {
      renderWithProvider(
        <TestForm config={basicConfig} announceErrors={false} />
      );

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('error-email')).toBeInTheDocument();
      });

      expect(accessibility.announce).not.toHaveBeenCalled();
    });

    it('provides proper ARIA attributes', () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const emailInput = screen.getByTestId('input-email');
      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      expect(emailInput).toHaveAttribute('aria-required', 'true');
    });

    it('updates ARIA attributes after validation', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const emailInput = screen.getByTestId('input-email');
      await user.type(emailInput, 'invalid');
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
      });
    });
  });

  describe('Form reset functionality', () => {
    it('resets form to initial values', async () => {
      const initialValues = { email: 'initial@example.com' };
      renderWithProvider(
        <TestForm config={basicConfig} initialValues={initialValues} />
      );

      const emailInput = screen.getByTestId('input-email');
      const resetButton = screen.getByTestId('reset-button');

      // Change the value
      await user.clear(emailInput);
      await user.type(emailInput, 'changed@example.com');
      expect(emailInput).toHaveValue('changed@example.com');

      // Reset the form
      await user.click(resetButton);

      expect(emailInput).toHaveValue('initial@example.com');
      expect(screen.getByTestId('has-errors')).toHaveTextContent('false');
    });
  });

  describe('Programmatic field value setting', () => {
    it('allows setting field values programmatically', async () => {
      renderWithProvider(<TestForm config={basicConfig} />);

      const emailInput = screen.getByTestId('input-email');
      const setEmailButton = screen.getByTestId('set-email-button');

      await user.click(setEmailButton);

      expect(emailInput).toHaveValue('test@example.com');
    });
  });

  describe('Field validation status', () => {
    it('tracks field validation status correctly', async () => {
      const configWithAsync: FormConfig = {
        username: {
          label: 'Username',
          rules: {
            asyncValidator: async (value) => {
              await new Promise(resolve => setTimeout(resolve, 100));
              if (value === 'taken') {
                return 'Username is already taken';
              }
              return null;
            },
          },
        },
      };

      renderWithProvider(<TestForm config={configWithAsync} />);

      const usernameInput = screen.getByTestId('input-username');
      await user.type(usernameInput, 'taken');

      // Should show validating state during async validation
      await waitFor(() => {
        expect(screen.getByTestId('is-validating')).toHaveTextContent('true');
      });

      // Should eventually show error
      await waitFor(() => {
        expect(screen.getByTestId('error-username')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error-username')).toHaveTextContent(
        'Username is already taken'
      );
    });
  });

  describe('Edge cases', () => {
    it('handles empty configuration', () => {
      renderWithProvider(<TestForm config={{}} />);

      expect(screen.getByTestId('is-valid')).toHaveTextContent('true');
      expect(screen.getByTestId('has-errors')).toHaveTextContent('false');
    });

    it('handles missing field configuration', () => {
      const partialConfig: FormConfig = {
        email: {
          label: 'Email',
        },
      };

      renderWithProvider(<TestForm config={partialConfig} />);

      const emailInput = screen.getByTestId('input-email');
      expect(emailInput).toBeInTheDocument();
    });

    it('handles validation with empty values', async () => {
      const optionalConfig: FormConfig = {
        optional: {
          label: 'Optional Field',
          rules: {
            minLength: 5,
          },
        },
      };

      renderWithProvider(<TestForm config={optionalConfig} />);

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should not show error for empty optional field
      expect(screen.queryByTestId('error-optional')).not.toBeInTheDocument();
      expect(screen.getByTestId('is-valid')).toHaveTextContent('true');
    });
  });
});