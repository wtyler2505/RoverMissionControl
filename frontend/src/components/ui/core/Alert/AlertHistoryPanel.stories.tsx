/**
 * AlertHistoryPanel Storybook Stories
 * Demonstrates the enhanced alert history panel functionality
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { AlertHistoryPanel } from './AlertHistoryPanel';
import { alertPersistenceService } from '../../../../services/persistence/AlertPersistenceService';
import { ThemeProvider } from '../../../../theme/ThemeProvider';
import { defaultTheme } from '../../../../theme/themes';

// Mock persistence service for stories
const mockPersistenceService = {
  ...alertPersistenceService,
  getAlerts: async (filter?: any) => {
    // Mock data for demonstration
    const mockAlerts = [
      {
        id: '1',
        title: 'Critical System Alert',
        message: 'Primary navigation system offline. Immediate attention required.',
        priority: 'critical' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        closable: true,
        persistent: true,
        acknowledged: false,
        dismissedAt: undefined,
        expiresAt: undefined,
        source: 'Navigation System',
        deviceId: 'rover-001',
        sessionId: 'session-001',
        metadata: { category: 'navigation', isRead: false },
        syncStatus: 'synced' as const,
        version: 1,
        lastModified: new Date()
      },
      {
        id: '2',
        title: 'Hardware Warning',
        message: 'Temperature sensor readings approaching critical levels.',
        priority: 'high' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        closable: true,
        persistent: false,
        acknowledged: true,
        acknowledgedBy: 'operator-1',
        acknowledgedAt: new Date(Date.now() - 1000 * 60 * 10),
        dismissedAt: undefined,
        expiresAt: undefined,
        source: 'Thermal Management',
        deviceId: 'rover-001',
        sessionId: 'session-001',
        metadata: { category: 'thermal', isRead: true },
        syncStatus: 'synced' as const,
        version: 1,
        lastModified: new Date()
      },
      {
        id: '3',
        title: 'Communication Status',
        message: 'Satellite link established successfully.',
        priority: 'info' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        closable: true,
        persistent: false,
        acknowledged: false,
        dismissedAt: new Date(Date.now() - 1000 * 60 * 20),
        expiresAt: undefined,
        source: 'Communication Hub',
        deviceId: 'rover-001',
        sessionId: 'session-001',
        metadata: { category: 'communication', isRead: true, archived: true },
        syncStatus: 'synced' as const,
        version: 1,
        lastModified: new Date()
      },
      {
        id: '4',
        title: 'Power System Update',
        message: 'Battery levels stable at 85%. Solar panel efficiency optimal.',
        priority: 'low' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
        closable: true,
        persistent: false,
        acknowledged: false,
        dismissedAt: undefined,
        expiresAt: undefined,
        source: 'Power Management',
        deviceId: 'rover-001',
        sessionId: 'session-001',
        metadata: { category: 'power', isRead: false },
        syncStatus: 'synced' as const,
        version: 1,
        lastModified: new Date()
      },
      {
        id: '5',
        title: 'System Performance',
        message: 'All systems operating within normal parameters.',
        priority: 'medium' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        closable: true,
        persistent: false,
        acknowledged: false,
        dismissedAt: undefined,
        expiresAt: undefined,
        source: 'System Monitor',
        deviceId: 'rover-001',
        sessionId: 'session-001',
        metadata: { category: 'system', isRead: true },
        syncStatus: 'synced' as const,
        version: 1,
        lastModified: new Date()
      }
    ];

    // Apply basic filtering for demo
    let filtered = mockAlerts;
    if (filter?.priority) {
      filtered = filtered.filter(alert => filter.priority.includes(alert.priority));
    }
    if (filter?.acknowledged !== undefined) {
      filtered = filtered.filter(alert => alert.acknowledged === filter.acknowledged);
    }
    if (filter?.dismissed !== undefined) {
      const isDismissed = !!alert => alert.dismissedAt;
      filtered = filtered.filter(alert => isDismissed === filter.dismissed);
    }

    return filtered;
  },
  currentDeviceId: 'rover-001'
};

const meta: Meta<typeof AlertHistoryPanel> = {
  title: 'UI/Alert/AlertHistoryPanel',
  component: AlertHistoryPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Enhanced Alert History Panel with pagination, sorting, filtering, bulk actions, and accessibility features.'
      }
    }
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={defaultTheme}>
        <div style={{ position: 'relative', height: '100vh', backgroundColor: '#f8fafc' }}>
          <Story />
        </div>
      </ThemeProvider>
    )
  ],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls panel visibility'
    },
    enableKeyboardShortcuts: {
      control: 'boolean',
      description: 'Enable keyboard shortcuts for power users'
    },
    enableBulkActions: {
      control: 'boolean',
      description: 'Enable bulk selection and actions'
    },
    enableExport: {
      control: 'boolean',
      description: 'Enable CSV/JSON export functionality'
    },
    maxHeight: {
      control: 'text',
      description: 'Maximum height of the panel'
    }
  }
};

export default meta;
type Story = StoryObj<typeof AlertHistoryPanel>;

// Default story
export const Default: Story = {
  args: {
    persistenceService: mockPersistenceService as any,
    isOpen: true,
    onClose: action('onClose'),
    onAlertSelect: action('onAlertSelect'),
    onBulkAction: action('onBulkAction'),
    enableKeyboardShortcuts: true,
    enableBulkActions: true,
    enableExport: true
  }
};

// Mobile responsive view
export const Mobile: Story = {
  args: {
    ...Default.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
};

// Tablet responsive view
export const Tablet: Story = {
  args: {
    ...Default.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    }
  }
};

// With limited features
export const BasicFeatures: Story = {
  args: {
    ...Default.args,
    enableKeyboardShortcuts: false,
    enableBulkActions: false,
    enableExport: false
  }
};

// With custom height
export const CustomHeight: Story = {
  args: {
    ...Default.args,
    maxHeight: '600px'
  }
};

// Closed panel (for testing open/close behavior)
export const Closed: Story = {
  args: {
    ...Default.args,
    isOpen: false
  }
};

// With limited categories
export const LimitedCategories: Story = {
  args: {
    ...Default.args,
    categories: ['system', 'hardware', 'communication']
  }
};