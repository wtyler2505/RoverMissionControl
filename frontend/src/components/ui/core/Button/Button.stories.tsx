import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { action } from '@storybook/addon-actions';
import { within, userEvent, expect } from '@storybook/test';
import React from 'react';

// Example icons for stories
const RocketIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C8 0 4 2 4 8C4 10 5 11 5 11L6 14L7 15H9L10 14L11 11C11 11 12 10 12 8C12 2 8 0 8 0ZM8 10C7.448 10 7 9.552 7 9C7 8.448 7.448 8 8 8C8.552 8 9 8.448 9 9C9 9.552 8.552 10 8 10Z"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10ZM14 8.7V7.3L12.8 6.9C12.7 6.5 12.5 6.1 12.3 5.8L12.9 4.6L11.9 3.6L10.7 4.2C10.4 4 10 3.8 9.6 3.7L9.2 2.5H7.8L7.4 3.7C7 3.8 6.6 4 6.3 4.2L5.1 3.6L4.1 4.6L4.7 5.8C4.5 6.1 4.3 6.5 4.2 6.9L3 7.3V8.7L4.2 9.1C4.3 9.5 4.5 9.9 4.7 10.2L4.1 11.4L5.1 12.4L6.3 11.8C6.6 12 7 12.2 7.4 12.3L7.8 13.5H9.2L9.6 12.3C10 12.2 10.4 12 10.7 11.8L11.9 12.4L12.9 11.4L12.3 10.2C12.5 9.9 12.7 9.5 12.8 9.1L14 8.7Z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.5 3.5L6 11L2.5 7.5L3.9 6.1L6 8.2L12.1 2.1L13.5 3.5Z"/>
  </svg>
);

const meta: Meta<typeof Button> = {
  title: 'Core Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Button component is a versatile, accessible button implementation that supports various styles, states, and configurations.

## Features

- **5 variants**: primary, secondary, tertiary, danger, and ghost
- **3 sizes**: small, medium, and large
- **Icon support**: with flexible positioning
- **Loading state**: with proper ARIA attributes
- **Full accessibility**: WCAG 2.1 AA compliant
- **Keyboard navigation**: full support for keyboard users
- **Theme support**: works with all theme variants

## Usage

\`\`\`tsx
import { Button } from '@/components/ui/core/Button';

// Basic usage
<Button onClick={handleClick}>Click Me</Button>

// With variant
<Button variant="danger" onClick={handleDelete}>Delete</Button>

// With icon
<Button icon={<RocketIcon />} onClick={handleLaunch}>
  Launch
</Button>

// Loading state
<Button loading onClick={handleSubmit}>
  Submitting...
</Button>
\`\`\`

## Accessibility

- Proper ARIA attributes for all states
- Keyboard navigation support (Tab, Enter, Space)
- Focus indicators that meet WCAG contrast requirements
- Screen reader announcements for state changes
- Respects prefers-reduced-motion

## Best Practices

### Do's
- Use descriptive text that clearly indicates the action
- Provide loading states for async operations
- Use appropriate variants for different actions
- Include icons to enhance visual communication
- Test with keyboard navigation

### Don'ts
- Don't disable buttons without clear indication why
- Avoid using color alone to convey meaning
- Don't remove focus indicators
- Avoid very long button text
- Don't use buttons for navigation (use links instead)
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'danger', 'ghost'],
      description: 'Visual style variant of the button',
      table: {
        type: { summary: 'ButtonVariant' },
        defaultValue: { summary: 'primary' },
      },
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Size of the button',
      table: {
        type: { summary: 'ComponentSize' },
        defaultValue: { summary: 'medium' },
      },
    },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: 'HTML button type attribute',
      table: {
        type: { summary: 'ButtonType' },
        defaultValue: { summary: 'button' },
      },
    },
    fullWidth: {
      control: 'boolean',
      description: 'Whether the button should take full width of its container',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Whether the button is in loading state',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    icon: {
      control: false,
      description: 'Icon element to display in the button',
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    iconPosition: {
      control: 'select',
      options: ['left', 'right'],
      description: 'Position of the icon relative to text',
      table: {
        type: { summary: "'left' | 'right'" },
        defaultValue: { summary: 'left' },
      },
    },
    children: {
      control: 'text',
      description: 'Button text content',
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    onClick: {
      action: 'clicked',
      description: 'Click event handler',
      table: {
        type: { summary: '(event: MouseEvent) => void' },
      },
    },
  },
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'medium',
    type: 'button',
    fullWidth: false,
    disabled: false,
    loading: false,
    iconPosition: 'left',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Basic button story
export const Default: Story = {
  args: {
    children: 'Default Button',
  },
};

// All variants showcase
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

// All sizes showcase
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Button size="small">Small</Button>
      <Button size="medium">Medium</Button>
      <Button size="large">Large</Button>
    </div>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <Button icon={<RocketIcon />}>Launch</Button>
      <Button icon={<SettingsIcon />} iconPosition="right">
        Settings
      </Button>
      <Button variant="secondary" icon={<CheckIcon />}>
        Confirm
      </Button>
      <Button variant="danger" icon={<>🗑️</>}>
        Delete
      </Button>
    </div>
  ),
};

// Icon only buttons
export const IconOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Button size="small" icon={<SettingsIcon />} aria-label="Settings" />
      <Button size="medium" icon={<SettingsIcon />} aria-label="Settings" />
      <Button size="large" icon={<SettingsIcon />} aria-label="Settings" />
      <Button variant="ghost" icon={<>❌</>} aria-label="Close" />
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
      
      <Button variant="secondary">Normal</Button>
      <Button variant="secondary" disabled>Disabled</Button>
      <Button variant="secondary" loading>Loading</Button>
      
      <Button variant="tertiary">Normal</Button>
      <Button variant="tertiary" disabled>Disabled</Button>
      <Button variant="tertiary" loading>Loading</Button>
    </div>
  ),
};

// Full width
export const FullWidth: Story = {
  render: () => (
    <div style={{ width: '400px', display: 'grid', gap: '16px' }}>
      <Button fullWidth>Full Width Primary</Button>
      <Button fullWidth variant="secondary">Full Width Secondary</Button>
      <Button fullWidth variant="tertiary">Full Width Tertiary</Button>
    </div>
  ),
};

// Interactive story with click handling
export const Interactive: Story = {
  args: {
    children: 'Click Me!',
    onClick: action('button-clicked'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    // Test hover
    await userEvent.hover(button);
    
    // Test click
    await userEvent.click(button);
    
    // Test keyboard navigation
    await userEvent.tab();
    await expect(button).toHaveFocus();
    
    await userEvent.keyboard('{Enter}');
  },
};

// Form integration
export const FormIntegration: Story = {
  render: () => {
    const [submitted, setSubmitted] = React.useState(false);
    
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          setTimeout(() => setSubmitted(false), 2000);
        }}
        style={{ display: 'grid', gap: '16px', width: '300px' }}
      >
        <input
          type="text"
          placeholder="Enter your name"
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button type="submit" variant="primary">
            Submit
          </Button>
          <Button type="reset" variant="ghost">
            Reset
          </Button>
        </div>
        {submitted && (
          <div style={{ color: 'green', fontSize: '14px' }}>
            Form submitted successfully!
          </div>
        )}
      </form>
    );
  },
};

// Loading states with different variants
export const LoadingStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <Button loading>Loading...</Button>
      <Button loading variant="secondary">Processing</Button>
      <Button loading variant="tertiary">Please Wait</Button>
      <Button loading icon={<RocketIcon />}>Launching</Button>
    </div>
  ),
};

// Accessibility showcase
export const Accessibility: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div>
        <h3 style={{ marginBottom: '8px' }}>With ARIA Labels</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button icon={<SettingsIcon />} aria-label="Open settings" />
          <Button icon={<>🔍</>} aria-label="Search" />
          <Button icon={<>❤️</>} aria-label="Add to favorites" />
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '8px' }}>With ARIA Descriptions</h3>
        <Button aria-describedby="delete-description" variant="danger">
          Delete Account
        </Button>
        <p id="delete-description" style={{ fontSize: '12px', color: '#666' }}>
          This action cannot be undone. All data will be permanently deleted.
        </p>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '8px' }}>Toggle Button</h3>
        <Button aria-pressed="true" variant="secondary">
          <span aria-hidden="true">🔔</span> Notifications On
        </Button>
      </div>
    </div>
  ),
};

// Real-world examples
export const RealWorldExamples: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div>
        <h3 style={{ marginBottom: '16px' }}>Mission Control Actions</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="primary" icon={<RocketIcon />}>
            Launch Rover
          </Button>
          <Button variant="secondary" icon={<>📡</>}>
            Connect Telemetry
          </Button>
          <Button variant="tertiary" icon={<>📊</>}>
            View Analytics
          </Button>
          <Button variant="danger" icon={<>🛑</>}>
            Emergency Stop
          </Button>
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>File Operations</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="small" icon={<>📁</>}>Open</Button>
          <Button size="small" icon={<>💾</>}>Save</Button>
          <Button size="small" icon={<>📤</>}>Export</Button>
          <Button size="small" variant="ghost" icon={<>⚙️</>} />
        </div>
      </div>
      
      <div>
        <h3 style={{ marginBottom: '16px' }}>Dialog Actions</h3>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary">Save Changes</Button>
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
          Resize the viewport to see responsive behavior
        </p>
      </div>
      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button>Action 1</Button>
          <Button variant="secondary">Action 2</Button>
          <Button variant="tertiary">Action 3</Button>
        </div>
        <Button fullWidth variant="primary" icon={<RocketIcon />}>
          Primary Action
        </Button>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: 'responsive',
    },
  },
};