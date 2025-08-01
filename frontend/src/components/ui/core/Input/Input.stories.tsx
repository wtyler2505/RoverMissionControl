import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';
import { action } from '@storybook/addon-actions';
import { within, userEvent, expect } from '@storybook/test';
import React from 'react';

// Example icons for stories
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.758 2.855L15 11.114v-5.73zm-.034 6.878L9.271 8.82 8 9.583 6.728 8.82l-5.694 3.44A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.739zM1 11.114l4.758-2.876L1 5.383v5.73z"/>
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
  </svg>
);

const meta: Meta<typeof Input> = {
  title: 'Core Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Input component is a versatile text input field with support for various types, validation states, icons, and more.

## Features

- **Multiple input types**: text, password, email, number, tel, url, search
- **Validation states**: error, success, warning with appropriate styling
- **Icon support**: flexible positioning (left/right)
- **Clearable**: optional clear button for quick content removal
- **Loading state**: visual feedback during async operations
- **Full accessibility**: WCAG 2.1 AA compliant with proper ARIA attributes
- **Keyboard navigation**: full support including clear button interaction
- **Theme support**: works with all theme variants

## Usage

\`\`\`tsx
import { Input } from '@/components/ui/core/Input';

// Basic usage
<Input
  label="Email"
  placeholder="Enter your email"
  onChange={handleChange}
/>

// With validation
<Input
  label="Password"
  type="password"
  validationState="error"
  validationMessage="Password must be at least 8 characters"
/>

// With icon and clearable
<Input
  icon={<SearchIcon />}
  clearable
  placeholder="Search..."
/>

// Loading state
<Input
  loading
  placeholder="Checking availability..."
/>
\`\`\`

## Accessibility

- Proper label association with for/id attributes
- ARIA attributes for validation states
- Keyboard navigation support
- Screen reader announcements for errors
- Clear button excluded from tab order
- Descriptive ARIA labels

## Best Practices

### Do's
- Always provide labels for form inputs
- Use appropriate input types (email, tel, etc.)
- Provide clear validation messages
- Use helper text for additional guidance
- Test with keyboard navigation

### Don'ts
- Don't rely on placeholder text as labels
- Avoid removing focus indicators
- Don't use color alone for validation feedback
- Avoid very long validation messages
- Don't disable inputs without clear reason
        `,
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Size of the input field',
      table: {
        type: { summary: 'ComponentSize' },
        defaultValue: { summary: 'medium' },
      },
    },
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'tel', 'url', 'search'],
      description: 'HTML input type',
      table: {
        type: { summary: 'InputType' },
        defaultValue: { summary: 'text' },
      },
    },
    label: {
      control: 'text',
      description: 'Label for the input field',
      table: {
        type: { summary: 'string' },
      },
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
      table: {
        type: { summary: 'string' },
      },
    },
    helperText: {
      control: 'text',
      description: 'Helper text displayed below the input',
      table: {
        type: { summary: 'string' },
      },
    },
    validationState: {
      control: 'select',
      options: ['default', 'error', 'success', 'warning'],
      description: 'Visual validation state',
      table: {
        type: { summary: 'ValidationState' },
        defaultValue: { summary: 'default' },
      },
    },
    validationMessage: {
      control: 'text',
      description: 'Validation message (overrides helper text)',
      table: {
        type: { summary: 'string' },
      },
    },
    icon: {
      control: false,
      description: 'Icon element to display',
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    iconPosition: {
      control: 'select',
      options: ['left', 'right'],
      description: 'Position of the icon',
      table: {
        type: { summary: "'left' | 'right'" },
        defaultValue: { summary: 'left' },
      },
    },
    clearable: {
      control: 'boolean',
      description: 'Show clear button when input has value',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Whether the input is in loading state',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    required: {
      control: 'boolean',
      description: 'Whether the input is required',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    value: {
      control: 'text',
      description: 'Input value (for controlled component)',
      table: {
        type: { summary: 'string' },
      },
    },
    onChange: {
      action: 'changed',
      description: 'Change event handler',
      table: {
        type: { summary: '(event: ChangeEvent) => void' },
      },
    },
    onClear: {
      action: 'cleared',
      description: 'Clear button click handler',
      table: {
        type: { summary: '() => void' },
      },
    },
  },
  args: {
    size: 'medium',
    type: 'text',
    validationState: 'default',
    iconPosition: 'left',
    clearable: false,
    disabled: false,
    loading: false,
    required: false,
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// Basic input
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

// With label
export const WithLabel: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter your username',
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Input size="small" label="Small" placeholder="Small input" />
      <Input size="medium" label="Medium" placeholder="Medium input" />
      <Input size="large" label="Large" placeholder="Large input" />
    </div>
  ),
};

// Input types
export const InputTypes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Input type="text" label="Text" placeholder="Enter text" />
      <Input type="email" label="Email" placeholder="user@example.com" />
      <Input type="password" label="Password" placeholder="Enter password" />
      <Input type="number" label="Number" placeholder="Enter number" />
      <Input type="tel" label="Phone" placeholder="+1 (555) 123-4567" />
      <Input type="url" label="Website" placeholder="https://example.com" />
      <Input type="search" label="Search" placeholder="Search..." icon={<SearchIcon />} />
    </div>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Input
        icon={<SearchIcon />}
        iconPosition="left"
        placeholder="Search..."
      />
      <Input
        icon={<EmailIcon />}
        iconPosition="left"
        type="email"
        placeholder="Email address"
      />
      <Input
        icon={<LockIcon />}
        iconPosition="right"
        type="password"
        placeholder="Password"
      />
      <Input
        icon={<UserIcon />}
        clearable
        placeholder="Username"
      />
    </div>
  ),
};

// Validation states
export const ValidationStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Input
        label="Default"
        validationState="default"
        helperText="This is helper text"
        defaultValue="Normal input"
      />
      <Input
        label="Success"
        validationState="success"
        validationMessage="Username is available!"
        defaultValue="valid_username"
        icon={<>✓</>}
        iconPosition="right"
      />
      <Input
        label="Warning"
        validationState="warning"
        validationMessage="This password is weak"
        type="password"
        defaultValue="password123"
      />
      <Input
        label="Error"
        validationState="error"
        validationMessage="This field is required"
        required
      />
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
      <Input label="Normal" placeholder="Normal input" />
      <Input label="Disabled" placeholder="Disabled input" disabled />
      <Input label="Loading" placeholder="Loading..." loading />
      <Input label="Required" placeholder="Required field" required />
    </div>
  ),
};

// Clearable inputs
export const Clearable: Story = {
  render: () => {
    const [value1, setValue1] = React.useState('Clear me!');
    const [value2, setValue2] = React.useState('');
    
    return (
      <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
        <Input
          label="Clearable with value"
          clearable
          value={value1}
          onChange={(e) => setValue1(e.target.value)}
          onClear={() => setValue1('')}
        />
        <Input
          label="Clearable empty"
          clearable
          value={value2}
          onChange={(e) => setValue2(e.target.value)}
          placeholder="Type to see clear button"
        />
        <Input
          label="With icon and clearable"
          icon={<SearchIcon />}
          clearable
          placeholder="Search..."
        />
      </div>
    );
  },
};

// Interactive example
export const Interactive: Story = {
  args: {
    label: 'Interactive Input',
    placeholder: 'Type something...',
    clearable: true,
    onChange: action('input-changed'),
    onClear: action('input-cleared'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Type something...');

    // Focus the input
    await userEvent.click(input);
    await expect(input).toHaveFocus();

    // Type some text
    await userEvent.type(input, 'Hello Storybook!');
    await expect(input).toHaveValue('Hello Storybook!');

    // Clear button should appear
    const clearButton = await canvas.findByLabelText('Clear input');
    await expect(clearButton).toBeInTheDocument();

    // Click clear button
    await userEvent.click(clearButton);
    await expect(input).toHaveValue('');
    await expect(input).toHaveFocus();
  },
};

// Form example
export const FormExample: Story = {
  render: () => {
    const [formData, setFormData] = React.useState({
      email: '',
      password: '',
      confirmPassword: '',
    });
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    
    const validateEmail = (email: string) => {
      if (!email) return 'Email is required';
      if (!/\S+@\S+\.\S+/.test(email)) return 'Invalid email format';
      return '';
    };
    
    const validatePassword = (password: string) => {
      if (!password) return 'Password is required';
      if (password.length < 8) return 'Password must be at least 8 characters';
      return '';
    };
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const newErrors: Record<string, string> = {
        email: validateEmail(formData.email),
        password: validatePassword(formData.password),
        confirmPassword: formData.password !== formData.confirmPassword
          ? 'Passwords do not match'
          : '',
      };
      
      setErrors(newErrors);
      
      if (!Object.values(newErrors).some(error => error)) {
        alert('Form submitted successfully!');
      }
    };
    
    return (
      <form onSubmit={handleSubmit} style={{ width: '350px' }}>
        <div style={{ display: 'grid', gap: '16px' }}>
          <Input
            label="Email"
            type="email"
            icon={<EmailIcon />}
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            validationState={errors.email ? 'error' : 'default'}
            validationMessage={errors.email}
            placeholder="user@example.com"
          />
          
          <Input
            label="Password"
            type="password"
            icon={<LockIcon />}
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            validationState={errors.password ? 'error' : 'default'}
            validationMessage={errors.password}
            helperText="Must be at least 8 characters"
          />
          
          <Input
            label="Confirm Password"
            type="password"
            icon={<LockIcon />}
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            validationState={errors.confirmPassword ? 'error' : 'default'}
            validationMessage={errors.confirmPassword}
          />
          
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Register
          </button>
        </div>
      </form>
    );
  },
};

// Accessibility showcase
export const Accessibility: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '24px', width: '350px' }}>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Proper Labeling</h3>
        <Input
          label="Email Address"
          type="email"
          required
          helperText="We'll never share your email"
          placeholder="user@example.com"
        />
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Error Announcement</h3>
        <Input
          label="Username"
          validationState="error"
          validationMessage="Username already taken"
          defaultValue="john_doe"
        />
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Success Feedback</h3>
        <Input
          label="Verification Code"
          validationState="success"
          validationMessage="Code verified successfully!"
          defaultValue="123456"
        />
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Loading State</h3>
        <Input
          label="Check Availability"
          loading
          defaultValue="checking_username"
          helperText="Checking if username is available..."
        />
      </div>
    </div>
  ),
};

// Real-world examples
export const RealWorldExamples: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Search Bar</h3>
        <Input
          type="search"
          icon={<SearchIcon />}
          clearable
          placeholder="Search mission logs..."
          size="large"
        />
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Login Form</h3>
        <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
          <Input
            label="Username or Email"
            icon={<UserIcon />}
            required
            placeholder="Enter username or email"
          />
          <Input
            label="Password"
            type="password"
            icon={<LockIcon />}
            required
            placeholder="Enter password"
            helperText="Forgot password?"
          />
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Telemetry Input</h3>
        <div style={{ display: 'grid', gap: '16px', width: '300px' }}>
          <Input
            label="Rover Speed (km/h)"
            type="number"
            defaultValue="5.2"
            helperText="Current speed reading"
          />
          <Input
            label="Battery Level (%)"
            type="number"
            defaultValue="78"
            validationState="warning"
            validationMessage="Battery below 80%"
          />
        </div>
      </div>
    </div>
  ),
};

// Responsive behavior
export const ResponsiveBehavior: Story = {
  render: () => (
    <div style={{ width: '100%', maxWidth: '600px' }}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
          Inputs adapt to container width
        </p>
      </div>
      <div style={{ display: 'grid', gap: '16px' }}>
        <Input
          label="Full Width Input"
          placeholder="This input takes full container width"
          icon={<SearchIcon />}
          clearable
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input label="First Name" placeholder="John" />
          <Input label="Last Name" placeholder="Doe" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'responsive',
    },
  },
};