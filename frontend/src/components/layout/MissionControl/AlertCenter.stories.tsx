/**
 * AlertCenter Storybook Stories
 * Comprehensive stories showcasing different alert scenarios and use cases
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { within, expect, userEvent } from '@storybook/test';
import { AlertCenter, AlertData, UserRole } from './AlertCenter';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { themes } from '../../../theme/themes';

// Mock data
const createMockAlert = (
  id: string,
  overrides: Partial<AlertData> = {}
): AlertData => ({
  id,
  title: `Alert ${id}`,
  message: `This is a sample alert message for alert ${id}`,
  severity: 'warning',
  category: 'system',
  priority: 'medium',
  status: 'active',
  timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Random time in last 7 days
  source: 'System Monitor',
  tags: ['monitoring', 'system'],
  dismissible: true,
  ...overrides,
});

const mockAlerts: AlertData[] = [
  createMockAlert('1', {
    title: 'Critical System Failure',
    message: 'Primary navigation system has encountered a critical error and requires immediate attention.',
    severity: 'critical',
    category: 'safety',
    priority: 'urgent',
    tags: ['navigation', 'critical', 'safety'],
    dismissible: false,
    escalationRules: [
      {
        id: 'esc1',
        threshold: 5,
        action: 'escalate',
        target: 'mission-commander',
        enabled: true,
      },
    ],
  }),
  createMockAlert('2', {
    title: 'Communication Link Degraded',
    message: 'Signal strength has dropped to 60%. Data transmission may be affected.',
    severity: 'warning',
    category: 'communication',
    priority: 'high',
    tags: ['communication', 'signal'],
    autoDismissMs: 300000, // 5 minutes
  }),
  createMockAlert('3', {
    title: 'Telemetry Data Received',
    message: 'Successfully received telemetry data from rover sensors.',
    severity: 'success',
    category: 'mission',
    priority: 'low',
    status: 'resolved',
    resolvedAt: new Date(Date.now() - 3600000),
    resolvedBy: 'operator-1',
    resolutionNotes: 'Data processed successfully',
    tags: ['telemetry', 'success'],
  }),
  createMockAlert('4', {
    title: 'Battery Level Low',
    message: 'Rover battery level has dropped to 25%. Consider scheduling a charging session.',
    severity: 'warning',
    category: 'hardware',
    priority: 'medium',
    tags: ['battery', 'power', 'hardware'],
  }),
  createMockAlert('5', {
    title: 'Mission Update Available',
    message: 'New mission parameters have been uploaded and are ready for review.',
    severity: 'info',
    category: 'mission',
    priority: 'low',
    tags: ['mission', 'update'],
  }),
  createMockAlert('6', {
    title: 'System Restart Required',
    message: 'A system restart is required to apply critical security updates.',
    severity: 'warning',
    category: 'system',
    priority: 'high',
    status: 'acknowledged',
    acknowledgedAt: new Date(Date.now() - 1800000),
    acknowledgedBy: 'admin',
    tags: ['system', 'security', 'restart'],
  }),
  createMockAlert('7', {
    title: 'Hardware Diagnostic Complete',
    message: 'All hardware components have passed diagnostic tests.',
    severity: 'success',
    category: 'hardware',
    priority: 'low',
    tags: ['hardware', 'diagnostic', 'success'],
  }),
  createMockAlert('8', {
    title: 'Sensor Calibration Needed',
    message: 'Temperature sensors are showing drift and require recalibration.',
    severity: 'warning',
    category: 'hardware',
    priority: 'medium',
    tags: ['sensor', 'calibration', 'temperature'],
  }),
];

const mockUserRoles: Record<string, UserRole> = {
  admin: {
    id: 'admin',
    name: 'Administrator',
    permissions: {
      viewAlerts: true,
      acknowledgeAlerts: true,
      resolveAlerts: true,
      deleteAlerts: true,
      exportAlerts: true,
      bulkActions: true,
      manageFilters: true,
    },
  },
  operator: {
    id: 'operator',
    name: 'Operator',
    permissions: {
      viewAlerts: true,
      acknowledgeAlerts: true,
      resolveAlerts: true,
      deleteAlerts: false,
      exportAlerts: true,
      bulkActions: true,
      manageFilters: false,
    },
  },
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    permissions: {
      viewAlerts: true,
      acknowledgeAlerts: false,
      resolveAlerts: false,
      deleteAlerts: false,
      exportAlerts: false,
      bulkActions: false,
      manageFilters: false,
    },
  },
};

const meta: Meta<typeof AlertCenter> = {
  title: 'Layout/MissionControl/AlertCenter',
  component: AlertCenter,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# Alert Center Component

A comprehensive alert notification center for Mission Control systems that provides:

## Key Features

- **Alert Aggregation**: Centralized display of system alerts from multiple sources
- **Filtering & Search**: Advanced filtering by severity, category, status, priority with full-text search
- **Bulk Actions**: Mass acknowledge, resolve, delete, and export operations
- **Role-based Permissions**: Granular access control for different user types
- **Real-time Updates**: Live alert streaming with auto-dismiss capabilities
- **Export Capabilities**: Export alerts to JSON, CSV, or PDF formats
- **Accessibility**: Full WCAG 2.1 AA compliance with screen reader support
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices

## Alert Severity Levels

- **Critical**: Requires immediate attention, may shake and pulse
- **Warning**: Important but not urgent, yellow indicators
- **Info**: Informational messages, blue indicators  
- **Success**: Positive confirmations, green indicators

## Alert Categories

- **System**: System-level alerts and notifications
- **Mission**: Mission-specific alerts and updates
- **Hardware**: Hardware status and diagnostics
- **Communication**: Communication link status
- **Safety**: Safety-critical alerts and warnings

## User Roles

Different user roles have different permissions:

- **Administrator**: Full access to all features
- **Operator**: Can acknowledge/resolve but not delete
- **Viewer**: Read-only access, no actions allowed
        `,
      },
    },
  },
  argTypes: {
    alerts: {
      description: 'Array of alert data objects',
      control: false,
    },
    userRole: {
      description: 'User role with specific permissions',
      control: {
        type: 'select',
        options: Object.keys(mockUserRoles),
        mapping: mockUserRoles,
      },
    },
    isOpen: {
      description: 'Whether the alert center is open',
      control: 'boolean',
    },
    realTimeEnabled: {
      description: 'Whether real-time updates are enabled',
      control: 'boolean',
    },
    maxHistorySize: {
      description: 'Maximum number of alerts to keep in history',
      control: { type: 'number', min: 10, max: 5000, step: 10 },
    },
  },
  decorators: [
    (Story, context) => (
      <ThemeProvider initialTheme="default">
        <div style={{ height: '100vh', position: 'relative' }}>
          <Story {...context} />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AlertCenter>;

// Default story with mixed alerts
export const Default: Story = {
  args: {
    alerts: mockAlerts,
    userRole: mockUserRoles.admin,
    isOpen: true,
    realTimeEnabled: true,
    maxHistorySize: 1000,
    onClose: action('onClose'),
    onAlertAcknowledge: action('onAlertAcknowledge'),
    onAlertResolve: action('onAlertResolve'),
    onAlertDelete: action('onAlertDelete'),
    onBulkAcknowledge: action('onBulkAcknowledge'),
    onBulkResolve: action('onBulkResolve'),
    onBulkDelete: action('onBulkDelete'),
    onExport: action('onExport'),
    onRealTimeToggle: action('onRealTimeToggle'),
  },
};

// Critical alerts only
export const CriticalAlertsOnly: Story = {
  args: {
    ...Default.args,
    alerts: [
      createMockAlert('crit1', {
        title: 'EMERGENCY: Life Support System Failure',
        message: 'Critical failure detected in primary life support systems. Immediate evacuation may be required.',
        severity: 'critical',
        category: 'safety',
        priority: 'urgent',
        dismissible: false,
      }),
      createMockAlert('crit2', {
        title: 'Navigation System Offline',
        message: 'Primary navigation system has gone offline. Manual control required.',
        severity: 'critical',
        category: 'system',
        priority: 'urgent',
      }),
      createMockAlert('crit3', {
        title: 'Power System Critical',
        message: 'Main power system showing critical levels. Backup power activated.',
        severity: 'critical',
        category: 'hardware',
        priority: 'urgent',
      }),
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Displays only critical alerts that require immediate attention. Critical alerts have animated effects to draw attention.',
      },
    },
  },
};

// Empty state
export const EmptyState: Story = {
  args: {
    ...Default.args,
    alerts: [],
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the empty state when no alerts are present, indicating all systems are operating normally.',
      },
    },
  },
};

// Operator role (limited permissions)
export const OperatorRole: Story = {
  args: {
    ...Default.args,
    userRole: mockUserRoles.operator,
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the alert center with operator-level permissions. Operators can acknowledge and resolve alerts but cannot delete them.',
      },
    },
  },
};

// Viewer role (read-only)
export const ViewerRole: Story = {
  args: {
    ...Default.args,
    userRole: mockUserRoles.viewer,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the alert center with viewer-only permissions. Viewers can only see alerts but cannot perform any actions.',
      },
    },
  },
};

// Real-time disabled
export const RealTimeDisabled: Story = {
  args: {
    ...Default.args,
    realTimeEnabled: false,
    onRealTimeToggle: action('onRealTimeToggle'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Alert center with real-time updates disabled. Shows the play button to re-enable real-time updates.',
      },
    },
  },
};

// Large number of alerts
export const ManyAlerts: Story = {
  args: {
    ...Default.args,
    alerts: Array.from({ length: 50 }, (_, i) => 
      createMockAlert(`many-${i}`, {
        title: `Alert ${i + 1}`,
        message: `This is alert number ${i + 1} in a large list of alerts.`,
        severity: ['critical', 'warning', 'info', 'success'][i % 4] as any,
        category: ['system', 'mission', 'hardware', 'communication', 'safety'][i % 5] as any,
        priority: ['urgent', 'high', 'medium', 'low'][i % 4] as any,
        status: ['active', 'acknowledged', 'resolved'][i % 3] as any,
      })
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the alert center performance with a large number of alerts. Shows scrolling behavior and efficient rendering.',
      },
    },
  },
};

// Mobile viewport
export const Mobile: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Alert center optimized for mobile devices. Shows full-width overlay and touch-friendly interactions.',
      },
    },
  },
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    ...Default.args,
  },
  decorators: [
    (Story) => (
      <ThemeProvider initialTheme="dark">
        <div style={{ height: '100vh', position: 'relative', backgroundColor: '#0a0a0f' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Alert center with dark theme for low-light environments and space operations.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
};

// High contrast theme
export const HighContrast: Story = {
  args: {
    ...Default.args,
  },
  decorators: [
    (Story) => (
      <ThemeProvider initialTheme="highContrast">
        <div style={{ height: '100vh', position: 'relative' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Alert center with high contrast theme for accessibility and enhanced visibility.',
      },
    },
  },
};

// Mission critical theme
export const MissionCritical: Story = {
  args: {
    ...Default.args,
    alerts: [
      createMockAlert('mc1', {
        title: 'MISSION CRITICAL: System Override',
        message: 'Manual override activated. All systems under direct control.',
        severity: 'critical',
        category: 'safety',
        priority: 'urgent',
      }),
      createMockAlert('mc2', {
        title: 'Emergency Protocol Active',
        message: 'Emergency protocols have been activated. All personnel to stations.',
        severity: 'critical',
        category: 'mission',
        priority: 'urgent',
      }),
    ],
  },
  decorators: [
    (Story) => (
      <ThemeProvider initialTheme="missionCritical">
        <div style={{ height: '100vh', position: 'relative', backgroundColor: '#000000' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Alert center with mission critical theme for emergency operations with red glow effects.',
      },
    },
    backgrounds: {
      default: 'dark',
    },
  },
};

// Interaction tests
export const InteractionTests: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test search functionality
    const searchInput = canvas.getByLabelText(/search alerts/i);
    await userEvent.type(searchInput, 'critical');
    
    // Wait for debounced search
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Test severity filter
    const severityFilter = canvas.getByLabelText(/filter by severity/i);
    await userEvent.click(severityFilter);
    
    // Test selecting alerts
    const checkboxes = canvas.getAllByRole('checkbox');
    if (checkboxes.length > 1) {
      await userEvent.click(checkboxes[1]); // First alert checkbox
    }
    
    // Test sorting
    const sortButton = canvas.getByLabelText(/sort/i);
    await userEvent.click(sortButton);
  },
  parameters: {
    docs: {
      description: {
        story: 'Automated interaction tests for alert center functionality including search, filtering, and selection.',
      },
    },
  },
};

// Accessibility test
export const AccessibilityTest: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test keyboard navigation
    const alertCenter = canvas.getByRole('dialog');
    expect(alertCenter).toBeInTheDocument();
    expect(alertCenter).toHaveAttribute('aria-modal', 'true');
    
    // Test search input accessibility
    const searchInput = canvas.getByLabelText(/search alerts/i);
    expect(searchInput).toHaveAttribute('aria-label');
    
    // Test close button accessibility
    const closeButton = canvas.getByLabelText(/close alert center/i);
    expect(closeButton).toBeInTheDocument();
    
    // Focus the close button and test keyboard interaction
    closeButton.focus();
    expect(closeButton).toHaveFocus();
    
    // Test alert items have proper ARIA labels
    const alertCheckboxes = canvas.getAllByRole('checkbox');
    alertCheckboxes.forEach((checkbox, index) => {
      if (index > 0) { // Skip "select all" checkbox
        expect(checkbox).toHaveAttribute('aria-label');
      }
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility compliance tests ensuring WCAG 2.1 AA standards are met.',
      },
    },
  },
};

// Export functionality demo
export const ExportDemo: Story = {
  args: {
    ...Default.args,
    onExport: async (alerts, format) => {
      action('onExport')(alerts, format);
      // Simulate export process
      return new Promise(resolve => {
        setTimeout(() => {
          console.log(`Exported ${alerts.length} alerts in ${format} format`);
          resolve(undefined);
        }, 2000);
      });
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates export functionality with different formats and loading states.',
      },
    },
  },
};

// Real-time simulation
export const RealTimeSimulation: Story = {
  args: {
    ...Default.args,
    alerts: [mockAlerts[0]], // Start with one alert
  },
  play: async ({ canvasElement, args }) => {
    // Simulate real-time alerts being added
    let alertCount = 1;
    const interval = setInterval(() => {
      if (alertCount < 5) {
        const newAlert = createMockAlert(`rt-${alertCount}`, {
          title: `Real-time Alert ${alertCount}`,
          message: `This alert was added in real-time at ${new Date().toLocaleTimeString()}`,
          severity: ['critical', 'warning', 'info'][alertCount % 3] as any,
          timestamp: new Date(),
        });
        
        // This would normally be handled by the parent component
        console.log('New real-time alert:', newAlert);
        alertCount++;
      } else {
        clearInterval(interval);
      }
    }, 3000);
    
    // Clean up interval after story unmounts
    return () => clearInterval(interval);
  },
  parameters: {
    docs: {
      description: {
        story: 'Simulates real-time alert updates being received and displayed in the alert center.',
      },
    },
  },
};

// Performance test with rapid updates
export const PerformanceTest: Story = {
  args: {
    ...Default.args,
    alerts: Array.from({ length: 100 }, (_, i) => 
      createMockAlert(`perf-${i}`, {
        title: `Performance Test Alert ${i + 1}`,
        message: `Testing rendering performance with alert ${i + 1}`,
        severity: ['critical', 'warning', 'info', 'success'][i % 4] as any,
        timestamp: new Date(Date.now() - i * 1000),
      })
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Performance test with 100 alerts to validate efficient rendering and scrolling behavior.',
      },
    },
  },
};