import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './Alert';
import { Button } from '../Button';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';

const meta: Meta<typeof Alert> = {
  title: 'Core Components/Alert',
  component: Alert,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
The Alert component provides contextual feedback messages for typical user actions with a handful of available alert variants.

## Features
- **Multiple Variants**: Info, success, warning, and error states
- **Customizable Icons**: Default icons or custom icon support
- **Closable**: Optional close functionality with callback
- **Actions**: Support for action buttons
- **Accessibility**: Full WCAG 2.1 AA compliance with proper ARIA attributes
- **Theming**: Supports all four application themes

## Mission Control Usage
Perfect for system status notifications, command confirmations, hardware alerts, and telemetry warnings in rover mission control interfaces.
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['info', 'success', 'warning', 'error'],
      description: 'Visual variant of the alert',
    },
    title: {
      control: 'text',
      description: 'Optional title for the alert',
    },
    children: {
      control: 'text',
      description: 'Alert message content',
    },
    closable: {
      control: 'boolean',
      description: 'Whether the alert can be closed',
    },
    icon: {
      control: { type: 'select' },
      options: [true, false, 'custom'],
      description: 'Icon display configuration',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when alert is closed',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Alert>;

// Basic variants
export const Info: Story = {
  args: {
    variant: 'info',
    children: 'This is an informational alert with important details about the current system state.',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    children: 'Operation completed successfully! The rover has executed the command.',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: 'Warning: Battery level is low. Consider returning to base station.',
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    children: 'Error: Communication lost with rover. Attempting reconnection...',
  },
};

// With titles
export const WithTitles: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Alert variant="info" title="System Information">
        Telemetry systems are operating normally. All sensors reporting nominal values.
      </Alert>
      <Alert variant="success" title="Mission Accomplished">
        Sample collection completed successfully. 15 samples collected and stored.
      </Alert>
      <Alert variant="warning" title="Environmental Alert">
        Dust storm detected 2km northeast. Recommend shelter protocol activation.
      </Alert>
      <Alert variant="error" title="Critical System Failure">
        Primary navigation system offline. Switching to backup navigation.
      </Alert>
    </div>
  ),
};

// Closable alerts
export const Closable: Story = {
  render: () => {
    const [alerts, setAlerts] = useState([
      { id: 1, variant: 'info' as const, message: 'New telemetry data available for review.' },
      { id: 2, variant: 'warning' as const, message: 'Scheduled maintenance window in 30 minutes.' },
      { id: 3, variant: 'success' as const, message: 'Backup systems synchronized successfully.' },
    ]);

    const closeAlert = (id: number) => {
      setAlerts(alerts.filter(alert => alert.id !== id));
      action('alert-closed')(id);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alerts.map(alert => (
          <Alert
            key={alert.id}
            variant={alert.variant}
            closable
            onClose={() => closeAlert(alert.id)}
          >
            {alert.message}
          </Alert>
        ))}
        {alerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            All alerts dismissed
          </div>
        )}
      </div>
    );
  },
};

// With actions
export const WithActions: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Alert
        variant="warning"
        title="Low Battery Warning"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="small" variant="tertiary" onClick={action('return-to-base')}>
              Return to Base
            </Button>
            <Button size="small" variant="primary" onClick={action('acknowledge')}>
              Acknowledge
            </Button>
          </div>
        }
      >
        Rover battery at 15%. Estimated 45 minutes of operation remaining.
      </Alert>
      
      <Alert
        variant="error"
        title="Connection Lost"
        action={
          <Button size="small" variant="primary" onClick={action('reconnect')}>
            Retry Connection
          </Button>
        }
      >
        Unable to establish communication with rover. Last contact: 2 minutes ago.
      </Alert>
      
      <Alert
        variant="success"
        title="Data Upload Complete"
        action={
          <Button size="small" variant="tertiary" onClick={action('view-data')}>
            View Data
          </Button>
        }
      >
        Successfully uploaded 2.4GB of telemetry data to mission control servers.
      </Alert>
    </div>
  ),
};

// Without icons
export const WithoutIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Alert variant="info" icon={false}>
        System notification without icon for clean, minimal appearance.
      </Alert>
      <Alert variant="success" icon={false} title="Clean Success">
        Operation completed with minimal visual clutter.
      </Alert>
    </div>
  ),
};

// Mission Control Scenarios
export const MissionControlScenarios: Story = {
  render: () => {
    const [systemStatus, setSystemStatus] = useState('operational');
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Rover Mission Control Dashboard</h3>
        
        {/* System Status */}
        <Alert
          variant="success"
          title="All Systems Operational"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          }
        >
          Primary rover systems online. Telemetry nominal. Ready for mission operations.
        </Alert>

        {/* Environmental Alert */}
        <Alert
          variant="warning"
          title="Environmental Conditions"
          closable
          onClose={action('weather-alert-dismissed')}
          action={
            <Button size="small" variant="primary" onClick={action('view-weather-details')}>
              View Details
            </Button>
          }
        >
          Wind speeds increasing to 45 km/h. Consider postponing EVA activities until conditions improve.
        </Alert>

        {/* Sample Collection Status */}
        <Alert
          variant="info"
          title="Sample Collection Progress"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          action={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="small" variant="tertiary" onClick={action('view-samples')}>
                View Samples
              </Button>
              <Button size="small" variant="primary" onClick={action('continue-collection')}>
                Continue
              </Button>
            </div>
          }
        >
          Sample collection 73% complete. 11 of 15 target samples collected. Estimated time remaining: 2.5 hours.
        </Alert>

        {/* Critical Hardware Alert */}
        <Alert
          variant="error"
          title="Hardware Malfunction Detected"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          }
          action={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="small" variant="danger" onClick={action('emergency-stop')}>
                Emergency Stop
              </Button>
              <Button size="small" variant="primary" onClick={action('run-diagnostics')}>
                Run Diagnostics
              </Button>
            </div>
          }
        >
          Drill assembly motor temperature exceeding safe operating limits (85°C). Immediate attention required.
        </Alert>
      </div>
    );
  },
};

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => {
    const [alertCount, setAlertCount] = useState(0);
    const [alerts, setAlerts] = useState<Array<{
      id: number;
      variant: 'info' | 'success' | 'warning' | 'error';
      title: string;
      message: string;
    }>>([]);

    const alertTypes = [
      { variant: 'info' as const, title: 'System Update', message: 'New telemetry data received from rover sensors.' },
      { variant: 'success' as const, title: 'Task Complete', message: 'Navigation waypoint reached successfully.' },
      { variant: 'warning' as const, title: 'Caution Required', message: 'Approaching geological hazard area.' },
      { variant: 'error' as const, title: 'System Error', message: 'Communication timeout with ground station.' },
    ];

    const addAlert = () => {
      const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const newAlert = {
        id: alertCount + 1,
        ...randomAlert,
      };
      setAlerts([newAlert, ...alerts]);
      setAlertCount(alertCount + 1);
    };

    const removeAlert = (id: number) => {
      setAlerts(alerts.filter(alert => alert.id !== id));
      action('alert-removed')(id);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <Button onClick={addAlert}>Add Random Alert</Button>
          <Button variant="tertiary" onClick={() => setAlerts([])}>Clear All</Button>
          <span style={{ color: '#666', fontSize: '14px' }}>
            {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
          {alerts.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: '#666',
              border: '2px dashed #ddd',
              borderRadius: '8px'
            }}>
              No active alerts. Click "Add Random Alert" to see alerts in action.
            </div>
          ) : (
            alerts.map(alert => (
              <Alert
                key={alert.id}
                variant={alert.variant}
                title={alert.title}
                closable
                onClose={() => removeAlert(alert.id)}
              >
                {alert.message}
              </Alert>
            ))
          )}
        </div>
      </div>
    );
  },
};

// Accessibility demonstration
export const AccessibilityFeatures: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ margin: '0 0 16px 0' }}>Accessibility Features</h3>
      
      <Alert variant="info" title="Screen Reader Support">
        This alert uses the proper <code>role="alert"</code> attribute and will be announced by screen readers.
      </Alert>
      
      <Alert
        variant="warning"
        title="Keyboard Navigation"
        closable
        onClose={action('keyboard-close')}
      >
        The close button is keyboard accessible. Try pressing Tab to focus it, then Enter or Space to close.
      </Alert>
      
      <Alert variant="success" title="High Contrast Support">
        Alert colors automatically adjust for high contrast mode accessibility preferences.
      </Alert>
      
      <Alert
        variant="error"
        title="Focus Management"
        action={
          <Button size="small" variant="primary" onClick={action('focus-action')}>
            Focusable Action
          </Button>
        }
      >
        Action buttons maintain proper focus order and can be navigated with keyboard.
      </Alert>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the accessibility features of the Alert component:

- **ARIA Attributes**: Uses \`role="alert"\` for screen reader announcements
- **Keyboard Navigation**: Close button and actions are keyboard accessible
- **Focus Management**: Proper tab order and focus indicators
- **High Contrast**: Colors adjust automatically for accessibility preferences
- **Screen Reader**: Clear, descriptive content and labels
        `,
      },
    },
  },
};