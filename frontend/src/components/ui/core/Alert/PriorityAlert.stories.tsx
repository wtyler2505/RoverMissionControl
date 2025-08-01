import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PriorityAlert } from './PriorityAlert';
import { PriorityAlertDemo } from './PriorityAlertDemo';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import styled from '@emotion/styled';

const meta: Meta<typeof PriorityAlert> = {
  title: 'UI/Core/PriorityAlert',
  component: PriorityAlert,
  decorators: [
    (Story, context) => (
      <ThemeProvider initialTheme={context.globals.theme || 'default'}>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Priority-based alert system with theme integration supporting 5 priority levels across 4 themes.',
      },
    },
  },
  argTypes: {
    priority: {
      control: 'select',
      options: ['critical', 'high', 'medium', 'low', 'info'],
      description: 'Alert priority level',
    },
    title: {
      control: 'text',
      description: 'Optional alert title',
    },
    message: {
      control: 'text',
      description: 'Alert message content',
    },
    closable: {
      control: 'boolean',
      description: 'Whether the alert can be closed',
    },
    persistent: {
      control: 'boolean',
      description: 'Whether the alert persists across sessions',
    },
    timestamp: {
      control: 'date',
      description: 'Alert timestamp',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

// Basic Examples
export const Critical: Story = {
  args: {
    priority: 'critical',
    title: 'Critical System Failure',
    message: 'Multiple subsystems are offline. Immediate intervention required to prevent data loss.',
    closable: true,
    timestamp: new Date(),
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const High: Story = {
  args: {
    priority: 'high',
    title: 'High Priority Warning',
    message: 'CPU usage has exceeded 90% for the last 5 minutes.',
    closable: true,
    timestamp: new Date(),
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const Medium: Story = {
  args: {
    priority: 'medium',
    title: 'System Update Available',
    message: 'A new version of the rover control software is available for installation.',
    closable: true,
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const Low: Story = {
  args: {
    priority: 'low',
    title: 'Scheduled Maintenance',
    message: 'Routine system maintenance is scheduled for Sunday at 2:00 AM.',
    closable: true,
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const Info: Story = {
  args: {
    priority: 'info',
    message: 'System backup completed successfully.',
    closable: true,
    timestamp: new Date(),
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

// Variants
export const WithoutTitle: Story = {
  args: {
    priority: 'medium',
    message: 'This alert has no title, only a message.',
    closable: true,
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const WithAction: Story = {
  args: {
    priority: 'high',
    title: 'Action Required',
    message: 'Your session will expire in 5 minutes.',
    closable: true,
    action: (
      <>
        <button style={{ marginRight: 8 }}>Extend Session</button>
        <button>Log Out</button>
      </>
    ),
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const Persistent: Story = {
  args: {
    priority: 'high',
    title: 'Persistent Alert',
    message: 'This alert will persist across page reloads and sessions.',
    closable: true,
    persistent: true,
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const CustomIcon: Story = {
  args: {
    priority: 'medium',
    title: 'Custom Icon Alert',
    message: 'This alert uses a custom icon instead of the default.',
    icon: <span style={{ fontSize: '20px' }}>🚀</span>,
    closable: true,
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

export const NoIcon: Story = {
  args: {
    priority: 'info',
    title: 'No Icon Alert',
    message: 'This alert is displayed without any icon.',
    icon: false,
    closable: true,
  },
  render: (args) => (
    <Container>
      <PriorityAlert {...args} />
    </Container>
  ),
};

// All Priorities
export const AllPriorities: Story = {
  render: () => (
    <Container>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PriorityAlert
          priority="critical"
          title="Critical Alert"
          message="This is a critical priority alert with the highest urgency."
          closable
          timestamp={new Date()}
        />
        <PriorityAlert
          priority="high"
          title="High Priority"
          message="This is a high priority alert requiring prompt attention."
          closable
          timestamp={new Date()}
        />
        <PriorityAlert
          priority="medium"
          title="Medium Priority"
          message="This is a medium priority alert for general notifications."
          closable
        />
        <PriorityAlert
          priority="low"
          title="Low Priority"
          message="This is a low priority alert for non-urgent information."
          closable
        />
        <PriorityAlert
          priority="info"
          message="This is an informational alert for general updates."
          closable
        />
      </div>
    </Container>
  ),
};

// Interactive Demo
export const InteractiveDemo: Story = {
  render: () => <PriorityAlertDemo />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Interactive demo showing priority alerts with theme switching capabilities.',
      },
    },
  },
};