/**
 * Alert Actions Demo - Storybook Stories
 * Comprehensive showcase of the alert action system with various configurations
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { PriorityAlert } from './PriorityAlert';
import { AlertAction, AlertActionGroup, ActionResult } from './types/AlertActionTypes';

const meta: Meta<typeof PriorityAlert> = {
  title: 'UI/Alert/Alert Actions System',
  component: PriorityAlert,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Alert Actions System

A comprehensive, accessible action system for alerts supporting:

- **Multiple Action Types**: retry, undo, view-details, navigate, custom actions
- **Idempotent Execution**: Prevents duplicate executions with configurable limits
- **Keyboard Navigation**: Full keyboard support with shortcuts and focus management
- **Confirmation Dialogs**: Configurable confirmations for destructive operations
- **Loading States**: Visual feedback during async operations
- **WCAG 2.1 AA Compliance**: Proper ARIA labels, focus management, and touch targets
- **Theme Integration**: Consistent styling with the existing design system
        `
      }
    }
  },
  argTypes: {
    priority: {
      control: { type: 'select' },
      options: ['critical', 'high', 'medium', 'low', 'info']
    },
    actionsLayout: {
      control: { type: 'select' },
      options: ['inline', 'stacked', 'dropdown']
    },
    maxVisibleActions: {
      control: { type: 'number', min: 1, max: 10 }
    },
    enableKeyboardNavigation: {
      control: { type: 'boolean' }
    },
    enableActionConfirmations: {
      control: { type: 'boolean' }
    }
  }
};

export default meta;
type Story = StoryObj<typeof PriorityAlert>;

// Helper function to create mock operations
const createMockOperation = (name: string, delay: number = 1000) => {
  return (): Promise<ActionResult> => {
    action(`${name} Operation Started`)();
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() > 0.2; // 80% success rate
        action(`${name} Operation ${success ? 'Completed' : 'Failed'}`)();
        resolve({
          success,
          message: success ? `${name} completed successfully` : `${name} failed`,
          error: success ? undefined : `Random ${name.toLowerCase()} error`
        });
      }, delay);
    });
  };
};

// Common action icons
const RetryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
  </svg>
);

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
  </svg>
);

const ViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);

const NavigateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
  </svg>
);

const DismissIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// Basic Actions Demo
export const BasicActions: Story = {
  args: {
    priority: 'high',
    title: 'Server Connection Lost',
    message: 'Unable to connect to the rover control server. Check your network connection and try again.',
    actions: [
      {
        id: 'retry',
        type: 'retry',
        label: 'Retry Connection',
        priority: 'primary',
        variant: 'primary',
        icon: <RetryIcon />,
        shortcut: 'r',
        retryOperation: createMockOperation('Retry', 2000),
        maxRetries: 3,
        description: 'Attempt to reconnect to the server'
      },
      {
        id: 'view-details',
        type: 'view-details',
        label: 'View Details',
        priority: 'secondary',
        variant: 'tertiary',
        icon: <ViewIcon />,
        shortcut: 'd',
        detailsUrl: '/network-diagnostics',
        description: 'View detailed network diagnostics'
      },
      {
        id: 'dismiss',
        type: 'dismiss',
        label: 'Dismiss',
        priority: 'tertiary',
        variant: 'ghost',
        icon: <DismissIcon />,
        shortcut: 'escape',
        description: 'Dismiss this alert'
      }
    ],
    enableKeyboardNavigation: true,
    enableActionConfirmations: true,
    onActionStart: action('Action Started'),
    onActionComplete: action('Action Completed'),
    onActionError: action('Action Error')
  }
};

// Destructive Actions with Confirmation
export const DestructiveActions: Story = {
  args: {
    priority: 'critical',
    title: 'Mission Data Corruption Detected',
    message: 'Critical mission data has been corrupted. Immediate action is required to prevent data loss.',
    actions: [
      {
        id: 'restore-backup',
        type: 'custom',
        label: 'Restore from Backup',
        priority: 'primary',
        variant: 'primary',
        icon: <RetryIcon />,
        confirmation: 'destructive',
        confirmationTitle: 'Restore from Backup',
        confirmationMessage: 'This will overwrite all current data with the last backup. Any changes since the backup will be lost permanently.',
        execute: createMockOperation('Backup Restore', 3000),
        description: 'Restore mission data from the last known good backup'
      },
      {
        id: 'force-reset',
        type: 'custom',
        label: 'Force System Reset',
        priority: 'secondary',
        variant: 'danger',
        confirmation: 'destructive',
        confirmationTitle: 'Force System Reset',
        confirmationMessage: 'This will completely reset the rover system. ALL unsaved data will be lost and the rover will need to be reconfigured.',
        confirmationDanger: true,
        execute: createMockOperation('System Reset', 5000),
        description: 'Perform a complete system reset (DANGEROUS)'
      },
      {
        id: 'undo-last-operation',
        type: 'undo',
        label: 'Undo Last Operation',
        priority: 'tertiary',
        variant: 'tertiary',
        icon: <UndoIcon />,
        confirmation: 'simple',
        undoOperation: createMockOperation('Undo', 1000),
        undoTimeout: 30000,
        description: 'Undo the last operation that may have caused the corruption'
      }
    ],
    enableActionConfirmations: true,
    onActionStart: action('Destructive Action Started'),
    onActionComplete: action('Destructive Action Completed'),
    onActionError: action('Destructive Action Error')
  }
};

// Action Groups
export const ActionGroups: Story = {
  args: {
    priority: 'medium',
    title: 'Rover Battery Low',
    message: 'Rover battery level is at 15%. Consider power management options.',
    actions: [
      {
        id: 'immediate-actions',
        label: 'Immediate Actions',
        priority: 'primary',
        orientation: 'horizontal',
        actions: [
          {
            id: 'enter-power-save',
            type: 'custom',
            label: 'Power Save Mode',
            priority: 'primary',
            variant: 'primary',
            execute: createMockOperation('Power Save', 1000),
            description: 'Enter power save mode to extend battery life'
          },
          {
            id: 'find-charging-station',
            type: 'navigate',
            label: 'Find Charging Station',
            priority: 'primary',
            variant: 'secondary',
            icon: <NavigateIcon />,
            url: '/charging-stations',
            description: 'Navigate to nearest charging station'
          }
        ]
      },
      {
        id: 'monitoring-actions',
        label: 'Monitoring & Analysis',
        priority: 'secondary',
        orientation: 'horizontal',
        actions: [
          {
            id: 'battery-details',
            type: 'view-details',
            label: 'Battery Details',
            priority: 'secondary',
            variant: 'tertiary',
            icon: <ViewIcon />,
            detailsUrl: '/battery-status',
            openInModal: true,
            modalSize: 'large',
            description: 'View detailed battery status and history'
          },
          {
            id: 'power-report',
            type: 'custom',
            label: 'Generate Power Report',
            priority: 'tertiary',
            variant: 'ghost',
            execute: createMockOperation('Power Report', 2000),
            description: 'Generate a comprehensive power usage report'
          }
        ]
      }
    ] as AlertActionGroup[],
    actionsLayout: 'inline',
    onActionStart: action('Group Action Started'),
    onActionComplete: action('Group Action Completed'),
    onActionError: action('Group Action Error')
  }
};

// Layout Variations
export const StackedLayout: Story = {
  args: {
    ...BasicActions.args,
    actionsLayout: 'stacked',
    title: 'Stacked Layout Demo',
    message: 'Actions are displayed in a vertical stack layout.'
  }
};

export const DropdownLayout: Story = {
  args: {
    ...BasicActions.args,
    actionsLayout: 'dropdown',
    title: 'Dropdown Layout Demo',
    message: 'All actions are contained within a dropdown menu.'
  }
};

// Overflow Menu Demo
export const OverflowMenu: Story = {
  args: {
    priority: 'info',
    title: 'Many Actions Demo',
    message: 'This alert has many actions to demonstrate the overflow menu functionality.',
    maxVisibleActions: 3,
    actions: [
      {
        id: 'action-1',
        type: 'custom',
        label: 'Primary Action',
        priority: 'primary',
        variant: 'primary',
        execute: createMockOperation('Action 1')
      },
      {
        id: 'action-2',
        type: 'custom',
        label: 'Secondary Action',
        priority: 'secondary',
        variant: 'secondary',
        execute: createMockOperation('Action 2')
      },
      {
        id: 'action-3',
        type: 'custom',
        label: 'Tertiary Action',
        priority: 'tertiary',
        variant: 'tertiary',
        execute: createMockOperation('Action 3')
      },
      {
        id: 'action-4',
        type: 'custom',
        label: 'Hidden Action 1',
        priority: 'tertiary',
        variant: 'ghost',
        execute: createMockOperation('Action 4')
      },
      {
        id: 'action-5',
        type: 'custom',
        label: 'Hidden Action 2',
        priority: 'tertiary',
        variant: 'ghost',
        execute: createMockOperation('Action 5')
      },
      {
        id: 'action-6',
        type: 'custom',
        label: 'Hidden Action 3',
        priority: 'tertiary',
        variant: 'ghost',
        execute: createMockOperation('Action 6')
      }
    ],
    onActionStart: action('Overflow Action Started'),
    onActionComplete: action('Overflow Action Completed')
  }
};

// Keyboard Navigation Demo
export const KeyboardNavigation: Story = {
  args: {
    ...BasicActions.args,
    title: 'Keyboard Navigation Demo',
    message: 'Use Tab/Shift+Tab to navigate, Enter/Space to activate, or keyboard shortcuts (r, d, esc).',
    enableKeyboardNavigation: true
  },
  parameters: {
    docs: {
      description: {
        story: `
### Keyboard Navigation Features:

- **Tab Navigation**: Use Tab/Shift+Tab to move between actions
- **Arrow Keys**: Use Left/Right arrows to navigate actions
- **Enter/Space**: Activate the focused action
- **Keyboard Shortcuts**: Each action can have a custom shortcut
- **Screen Reader Support**: Actions are properly announced with ARIA labels

**Try these shortcuts:**
- \`r\` - Retry Connection
- \`d\` - View Details  
- \`Escape\` - Dismiss
        `
      }
    }
  }
};

// Loading States Demo
export const LoadingStates: Story = {
  args: {
    priority: 'high',
    title: 'Loading States Demo',
    message: 'Click actions to see loading states and different completion results.',
    actions: [
      {
        id: 'quick-action',
        type: 'custom',
        label: 'Quick Action (1s)',
        priority: 'primary',
        variant: 'primary',
        execute: createMockOperation('Quick Action', 1000)
      },
      {
        id: 'slow-action',
        type: 'custom',
        label: 'Slow Action (3s)',
        priority: 'secondary',
        variant: 'secondary',
        execute: createMockOperation('Slow Action', 3000)
      },
      {
        id: 'failing-action',
        type: 'custom',
        label: 'Failing Action',
        priority: 'tertiary',
        variant: 'danger',
        execute: (): Promise<ActionResult> => {
          action('Failing Action Started')();
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: false,
                error: 'This action always fails for demo purposes'
              });
            }, 1500);
          });
        }
      }
    ],
    onActionStart: action('Loading Demo Action Started'),
    onActionComplete: action('Loading Demo Action Completed'),
    onActionError: action('Loading Demo Action Error')
  }
};

// Idempotent Actions Demo
export const IdempotentActions: Story = {
  args: {
    priority: 'medium',
    title: 'Idempotent Actions Demo',
    message: 'These actions can only be executed once or have execution limits.',
    actions: [
      {
        id: 'one-time-action',
        type: 'custom',
        label: 'One-Time Action',
        priority: 'primary',
        variant: 'primary',
        idempotent: true,
        executionLimit: 1,
        execute: createMockOperation('One-Time Action'),
        description: 'This action can only be executed once'
      },
      {
        id: 'limited-action',
        type: 'retry',
        label: 'Limited Retries (3x)',
        priority: 'secondary',
        variant: 'secondary',
        executionLimit: 3,
        retryOperation: createMockOperation('Limited Retry'),
        description: 'This action can be executed up to 3 times'
      },
      {
        id: 'unlimited-action',
        type: 'custom',
        label: 'Unlimited Action',
        priority: 'tertiary',
        variant: 'tertiary',
        idempotent: false,
        execute: createMockOperation('Unlimited Action'),
        description: 'This action can be executed multiple times'
      }
    ],
    onActionStart: action('Idempotent Action Started'),
    onActionComplete: action('Idempotent Action Completed')
  }
};

// Interactive Playground
export const InteractivePlayground: Story = {
  render: (args) => {
    const [actionResults, setActionResults] = useState<Record<string, ActionResult>>({});
    const [executionCounts, setExecutionCounts] = useState<Record<string, number>>({});

    const handleActionComplete = (actionId: string, result: ActionResult) => {
      setActionResults(prev => ({ ...prev, [actionId]: result }));
      setExecutionCounts(prev => ({ ...prev, [actionId]: (prev[actionId] || 0) + 1 }));
      action('Playground Action Completed')(actionId, result);
    };

    return (
      <div>
        <PriorityAlert
          {...args}
          onActionComplete={handleActionComplete}
        />
        
        {/* Results Display */}
        {Object.keys(actionResults).length > 0 && (
          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            <h4>Action Results:</h4>
            {Object.entries(actionResults).map(([actionId, result]) => (
              <div key={actionId} style={{ marginBottom: '8px' }}>
                <strong>{actionId}</strong> (executed {executionCounts[actionId]}x): 
                <span style={{ color: result.success ? 'green' : 'red' }}>
                  {result.success ? ' ✓ Success' : ` ✗ Failed: ${result.error}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
  args: {
    priority: 'info',
    title: 'Interactive Playground',
    message: 'Try different actions and see the results below. Actions have random success/failure rates.',
    actions: [
      {
        id: 'playground-retry',
        type: 'retry',
        label: 'Retry Operation',
        priority: 'primary',
        variant: 'primary',
        icon: <RetryIcon />,
        retryOperation: createMockOperation('Playground Retry', 1500),
        shortcut: 'r'
      },
      {
        id: 'playground-undo',
        type: 'undo',
        label: 'Undo Last Action',
        priority: 'secondary',
        variant: 'tertiary',
        icon: <UndoIcon />,
        confirmation: 'simple',
        undoOperation: createMockOperation('Playground Undo', 1000),
        shortcut: 'u'
      },
      {
        id: 'playground-custom',
        type: 'custom',
        label: 'Custom Action',
        priority: 'tertiary',
        variant: 'secondary',
        execute: createMockOperation('Playground Custom', 2000),
        shortcut: 'c'
      }
    ],
    enableKeyboardNavigation: true,
    enableActionConfirmations: true,
    onActionStart: action('Playground Action Started'),
    onActionError: action('Playground Action Error')
  }
};