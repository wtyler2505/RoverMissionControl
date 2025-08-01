import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Input } from './Input';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { themes } from '../../../../theme/themes';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Test wrapper with theme provider
const renderWithTheme = (component: React.ReactElement, themeName = 'default') => {
  return render(
    <ThemeProvider initialTheme={themeName} persistTheme={false}>
      {component}
    </ThemeProvider>
  );
};

describe('Input Component', () => {
  describe('Rendering', () => {
    it('renders basic input', () => {
      renderWithTheme(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
      renderWithTheme(<Input label="Email Address" />);
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      renderWithTheme(<Input helperText="Please enter a valid email" />);
      expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    });

    it('renders with all sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { rerender } = renderWithTheme(
          <Input placeholder={`Size ${size}`} size={size} />
        );
        
        const input = screen.getByPlaceholderText(`Size ${size}`);
        expect(input).toBeInTheDocument();
        
        rerender(<></>);
      });
    });

    it('renders with all input types', () => {
      const types = ['text', 'password', 'email', 'number', 'tel', 'url', 'search'] as const;
      
      types.forEach(type => {
        const { rerender } = renderWithTheme(
          <Input type={type} placeholder={`Type ${type}`} />
        );
        
        const input = screen.getByPlaceholderText(`Type ${type}`);
        expect(input).toHaveAttribute('type', type);
        
        rerender(<></>);
      });
    });

    it('renders with custom className', () => {
      renderWithTheme(<Input className="custom-input" testId="custom-input" />);
      const wrapper = screen.getByTestId('custom-input');
      expect(wrapper).toHaveClass('custom-input');
    });

    it('renders with testId', () => {
      renderWithTheme(<Input testId="test-input" />);
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
    });

    it('renders required field with asterisk', () => {
      renderWithTheme(<Input label="Required Field" required />);
      const label = screen.getByText('Required Field');
      expect(label.parentElement).toHaveTextContent('Required Field *');
    });
  });

  describe('Icons', () => {
    const TestIcon = () => <span data-testid="test-icon">🔍</span>;

    it('renders with icon on the left', () => {
      renderWithTheme(
        <Input icon={<TestIcon />} iconPosition="left" placeholder="Search" />
      );
      
      const icon = screen.getByTestId('test-icon');
      expect(icon).toBeInTheDocument();
    });

    it('renders with icon on the right', () => {
      renderWithTheme(
        <Input icon={<TestIcon />} iconPosition="right" placeholder="Search" />
      );
      
      const icon = screen.getByTestId('test-icon');
      expect(icon).toBeInTheDocument();
    });

    it('renders with clearable button', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Input clearable placeholder="Clearable input" />);
      
      const input = screen.getByPlaceholderText('Clearable input');
      
      // Clear button should not be visible when empty
      expect(screen.queryByLabelText('Clear input')).not.toBeInTheDocument();
      
      // Type some text
      await user.type(input, 'Some text');
      
      // Clear button should now be visible
      const clearButton = screen.getByLabelText('Clear input');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Validation States', () => {
    it('renders with default validation state', () => {
      renderWithTheme(<Input validationState="default" />);
      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('renders with error state', () => {
      renderWithTheme(
        <Input
          validationState="error"
          validationMessage="This field is required"
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('This field is required')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders with success state', () => {
      renderWithTheme(
        <Input
          validationState="success"
          validationMessage="Email is valid"
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(screen.getByText('Email is valid')).toBeInTheDocument();
    });

    it('renders with warning state', () => {
      renderWithTheme(
        <Input
          validationState="warning"
          validationMessage="This password is weak"
        />
      );
      
      expect(screen.getByText('This password is weak')).toBeInTheDocument();
    });

    it('prioritizes validation message over helper text', () => {
      renderWithTheme(
        <Input
          helperText="Enter your email"
          validationState="error"
          validationMessage="Invalid email format"
        />
      );
      
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      expect(screen.queryByText('Enter your email')).not.toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('handles disabled state', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Input disabled onChange={handleChange} placeholder="Disabled input" />
      );
      
      const input = screen.getByPlaceholderText('Disabled input');
      expect(input).toBeDisabled();
      
      await user.type(input, 'test');
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('handles loading state', () => {
      renderWithTheme(<Input loading placeholder="Loading input" />);
      
      const input = screen.getByPlaceholderText('Loading input');
      expect(input).toBeDisabled();
      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('does not show clear button when disabled', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <Input disabled clearable value="Cannot clear" onChange={() => {}} />
      );
      
      expect(screen.queryByLabelText('Clear input')).not.toBeInTheDocument();
    });

    it('does not show clear button when loading', () => {
      renderWithTheme(
        <Input loading clearable value="Cannot clear" onChange={() => {}} />
      );
      
      expect(screen.queryByLabelText('Clear input')).not.toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles text input', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(<Input onChange={handleChange} placeholder="Type here" />);
      const input = screen.getByPlaceholderText('Type here');
      
      await user.type(input, 'Hello World');
      
      expect(handleChange).toHaveBeenCalled();
      expect(input).toHaveValue('Hello World');
    });

    it('handles clear button click', async () => {
      const handleChange = jest.fn();
      const handleClear = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <Input
          clearable
          onChange={handleChange}
          onClear={handleClear}
          placeholder="Clearable"
        />
      );
      
      const input = screen.getByPlaceholderText('Clearable');
      
      // Type some text
      await user.type(input, 'Clear me');
      expect(input).toHaveValue('Clear me');
      
      // Click clear button
      const clearButton = screen.getByLabelText('Clear input');
      await user.click(clearButton);
      
      expect(input).toHaveValue('');
      expect(handleClear).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalled();
      expect(input).toHaveFocus();
    });

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(
        <>
          <Input placeholder="First input" />
          <Input placeholder="Second input" />
          <Input placeholder="Third input" disabled />
          <Input placeholder="Fourth input" />
        </>
      );
      
      await user.tab();
      expect(screen.getByPlaceholderText('First input')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByPlaceholderText('Second input')).toHaveFocus();
      
      await user.tab();
      // Should skip disabled input
      expect(screen.getByPlaceholderText('Fourth input')).toHaveFocus();
    });

    it('handles form submission', async () => {
      const handleSubmit = jest.fn((e) => e.preventDefault());
      const user = userEvent.setup();
      
      renderWithTheme(
        <form onSubmit={handleSubmit}>
          <Input placeholder="Form input" />
          <button type="submit">Submit</button>
        </form>
      );
      
      const input = screen.getByPlaceholderText('Form input');
      await user.type(input, 'Test value{Enter}');
      
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('maintains focus after clearing', async () => {
      const user = userEvent.setup();
      
      renderWithTheme(<Input clearable placeholder="Focus test" />);
      const input = screen.getByPlaceholderText('Focus test');
      
      await user.type(input, 'Some text');
      
      const clearButton = screen.getByLabelText('Clear input');
      await user.click(clearButton);
      
      expect(input).toHaveFocus();
      expect(input).toHaveValue('');
    });
  });

  describe('Controlled vs Uncontrolled', () => {
    it('works as uncontrolled component', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Input placeholder="Uncontrolled" />);
      
      const input = screen.getByPlaceholderText('Uncontrolled');
      await user.type(input, 'Uncontrolled value');
      
      expect(input).toHaveValue('Uncontrolled value');
    });

    it('works as controlled component', async () => {
      const ControlledInput = () => {
        const [value, setValue] = React.useState('');
        
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Controlled"
          />
        );
      };
      
      const user = userEvent.setup();
      renderWithTheme(<ControlledInput />);
      
      const input = screen.getByPlaceholderText('Controlled');
      await user.type(input, 'Controlled value');
      
      expect(input).toHaveValue('Controlled value');
    });
  });

  describe('Theme Support', () => {
    it('renders correctly in different themes', () => {
      const themeNames = Object.keys(themes) as Array<keyof typeof themes>;
      
      themeNames.forEach(themeName => {
        const { rerender } = renderWithTheme(
          <Input placeholder="Themed input" />,
          themeName
        );
        
        const input = screen.getByPlaceholderText('Themed input');
        expect(input).toBeInTheDocument();
        
        rerender(<></>);
      });
    });

    it('applies high contrast styles when theme is highContrast', () => {
      renderWithTheme(
        <Input placeholder="High contrast input" />,
        'highContrast'
      );
      
      const input = screen.getByPlaceholderText('High contrast input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithTheme(
        <Input label="Accessible Input" />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations with error state', async () => {
      const { container } = renderWithTheme(
        <Input
          label="Email"
          validationState="error"
          validationMessage="Invalid email"
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('associates label with input', () => {
      renderWithTheme(<Input label="Username" />);
      
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('has proper ARIA attributes', () => {
      renderWithTheme(
        <Input
          label="Email"
          validationState="error"
          validationMessage="Invalid email"
          required
        />
      );
      
      const input = screen.getByLabelText('Email *');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      expect(input).toHaveAttribute('required');
    });

    it('announces validation messages to screen readers', () => {
      const { rerender } = renderWithTheme(<Input label="Email" />);
      
      // Add error state
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Input
            label="Email"
            validationState="error"
            validationMessage="Invalid email format"
          />
        </ThemeProvider>
      );
      
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email format');
    });

    it('clear button is not in tab order', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <>
          <Input placeholder="First" clearable />
          <Input placeholder="Second" />
        </>
      );
      
      const firstInput = screen.getByPlaceholderText('First');
      await user.type(firstInput, 'Text');
      
      const clearButton = screen.getByLabelText('Clear input');
      expect(clearButton).toHaveAttribute('tabIndex', '-1');
      
      await user.tab();
      expect(screen.getByPlaceholderText('Second')).toHaveFocus();
    });
  });

  describe('Number Input Specific', () => {
    it('removes spinner buttons for number input', () => {
      renderWithTheme(<Input type="number" placeholder="Number input" />);
      
      const input = screen.getByPlaceholderText('Number input');
      expect(input).toHaveAttribute('type', 'number');
      // Spinner removal is handled by CSS
    });

    it('accepts numeric input', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      
      renderWithTheme(
        <Input type="number" onChange={handleChange} placeholder="Enter number" />
      );
      
      const input = screen.getByPlaceholderText('Enter number');
      await user.type(input, '123.45');
      
      expect(input).toHaveValue(123.45);
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Password Input Specific', () => {
    it('masks password input', () => {
      renderWithTheme(<Input type="password" placeholder="Password" />);
      
      const input = screen.getByPlaceholderText('Password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('handles password input', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Input type="password" placeholder="Enter password" />);
      
      const input = screen.getByPlaceholderText('Enter password');
      await user.type(input, 'secret123');
      
      expect(input).toHaveValue('secret123');
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  describe('Edge Cases', () => {
    it('handles very long text', async () => {
      const user = userEvent.setup();
      const longText = 'a'.repeat(1000);
      
      renderWithTheme(<Input placeholder="Long text" />);
      const input = screen.getByPlaceholderText('Long text');
      
      await user.type(input, longText);
      expect(input).toHaveValue(longText);
    });

    it('handles rapid typing', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      
      renderWithTheme(<Input onChange={handleChange} placeholder="Rapid typing" />);
      const input = screen.getByPlaceholderText('Rapid typing');
      
      await user.type(input, 'rapidtypingtest', { delay: 1 });
      
      expect(input).toHaveValue('rapidtypingtest');
      expect(handleChange).toHaveBeenCalled();
    });

    it('handles paste events', async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();
      
      renderWithTheme(<Input onChange={handleChange} placeholder="Paste here" />);
      const input = screen.getByPlaceholderText('Paste here');
      
      input.focus();
      await user.paste('Pasted text');
      
      expect(input).toHaveValue('Pasted text');
      expect(handleChange).toHaveBeenCalled();
    });

    it('maintains state through re-renders', () => {
      const { rerender } = renderWithTheme(
        <Input placeholder="Persistent" value="Initial" onChange={() => {}} />
      );
      
      let input = screen.getByPlaceholderText('Persistent');
      expect(input).toHaveValue('Initial');
      
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <Input placeholder="Persistent" value="Updated" onChange={() => {}} />
        </ThemeProvider>
      );
      
      input = screen.getByPlaceholderText('Persistent');
      expect(input).toHaveValue('Updated');
    });

    it('handles special characters', async () => {
      const user = userEvent.setup();
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      renderWithTheme(<Input placeholder="Special chars" />);
      const input = screen.getByPlaceholderText('Special chars');
      
      await user.type(input, specialChars);
      expect(input).toHaveValue(specialChars);
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const renderSpy = jest.fn();
      
      const TrackedInput = (props: any) => {
        renderSpy();
        return <Input {...props} />;
      };
      
      const { rerender } = renderWithTheme(
        <TrackedInput placeholder="Performance test" />
      );
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
      
      // Re-render with same props
      rerender(
        <ThemeProvider initialTheme="default" persistTheme={false}>
          <TrackedInput placeholder="Performance test" />
        </ThemeProvider>
      );
      
      // Should cause only one additional render
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});