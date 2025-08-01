/**
 * Status Bar Storybook Stories
 * Interactive documentation and testing for different status states
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { StatusBar, StatusBarProvider } from './StatusBar';
import {
  StatusBarData,
  StatusBarConfiguration,
  SystemHealthData,
  ConnectionStatusData,
  CommandQueueData,
  MissionData,
  PowerStatusData,
  NotificationData,
  DEFAULT_CONFIGURATION
} from './types';
import { ConnectionState } from '../../../../services/websocket/types';

const meta: Meta<typeof StatusBar> = {
  title: 'Layout/MissionControl/StatusBar',
  component: StatusBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# Mission Control Status Bar

A comprehensive status bar component for the Mission Control interface that displays real-time system feedback.

## Features

- **Real-time Updates**: Live system health, connection status, and mission progress
- **Configurable Widgets**: User-customizable widget arrangement and visibility
- **Emergency Mode**: Special styling and alerts for critical situations
- **Accessibility**: Full WCAG 2.1 AA compliance with screen reader support
- **Responsive**: Adapts to different screen sizes with intelligent widget hiding
- **Toast Integration**: Built-in notification system with actions
- **High Contrast**: Supports high contrast mode and theme switching

## Widget Types

- Connection Status with signal strength
- System Health (CPU, Memory, Network)
- Mission Status with progress tracking
- Command Queue with processing metrics
- Power Status and battery monitoring
- Notification Center with actions
- Mission Timer

## Usage

The StatusBar can be used standalone with external data or with the StatusBarProvider for full context management.
        `
      }
    }
  },
  argTypes: {
    onConfigChange: { action: 'config-changed' },
    onNotificationAction: { action: 'notification-action' },
    onStatusClick: { action: 'status-clicked' },
    onEmergencyToggle: { action: 'emergency-toggled' },
  }
};

export default meta;
type Story = StoryObj<typeof StatusBar>;

// Helper function to create sample data
const createSampleData = (overrides: Partial<StatusBarData> = {}): StatusBarData => ({
  systemHealth: {
    cpu: { usage: 45, temperature: 55, status: 'healthy' },
    memory: { 
      used: 8 * 1024 * 1024 * 1024, 
      total: 32 * 1024 * 1024 * 1024, 
      percentage: 25, 
      status: 'healthy' 
    },
    network: { 
      latency: 25, 
      bandwidth: 1000000, 
      packetsLost: 0, 
      status: 'healthy', 
      signalStrength: 'excellent' 
    },
    overall: 'healthy',
    lastUpdated: Date.now(),
    uptime: 86400
  } as SystemHealthData,
  
  connection: {
    state: ConnectionState.AUTHENTICATED,
    isConnected: true,
    signalStrength: 'excellent',
    latency: 25,
    reconnectAttempts: 0,
    metrics: {
      connectionCount: 1,
      reconnectionCount: 0,
      messagesReceived: 5420,
      messagesSent: 3210,
      bytesReceived: 12 * 1024 * 1024,
      bytesSent: 8 * 1024 * 1024,
      averageLatency: 22,
      currentLatency: 25,
      lastHeartbeat: Date.now() - 2000,
      uptime: 86400,
      errorCount: 2,
      queuedMessages: 0
    }
  } as ConnectionStatusData,
  
  commandQueue: {
    length: 0,
    processing: false,
    successCount: 3200,
    errorCount: 18,
    avgProcessingTime: 125,
    status: 'normal'
  } as CommandQueueData,
  
  mission: {
    status: 'active',
    name: 'Martian Geological Survey',
    startTime: Date.now() - 14400000, // 4 hours ago
    elapsedTime: 14400, // 4 hours in seconds
    estimatedDuration: 28800, // 8 hours
    progress: 50,
    waypoints: {
      total: 15,
      completed: 8,
      current: 'Olympus Mons Base Camp'
    }
  } as MissionData,
  
  power: {
    battery: {
      level: 78,
      voltage: 48.6,
      current: 15.2,
      temperature: 28,
      charging: false,
      timeRemaining: 320,
      status: 'healthy'
    },
    solar: {
      power: 850,
      efficiency: 92,
      status: 'healthy'
    },
    overall: 'healthy',
    powerConsumption: 420,
    estimatedRuntime: 280
  } as PowerStatusData,
  
  notifications: [
    {
      id: 'notif-1',
      type: 'info',
      title: 'System Update',
      message: 'Navigation software updated to version 3.2.1',
      timestamp: Date.now() - 300000, // 5 minutes ago
      source: 'system'
    },
    {
      id: 'notif-2',
      type: 'success',
      title: 'Waypoint Reached',
      message: 'Successfully reached Olympus Mons Base Camp',
      timestamp: Date.now() - 600000, // 10 minutes ago
      source: 'mission'
    }
  ] as NotificationData[],
  
  timestamp: Date.now(),
  ...overrides
});

const createSampleConfig = (overrides: Partial<StatusBarConfiguration> = {}): StatusBarConfiguration => ({
  ...DEFAULT_CONFIGURATION,
  ...overrides
});

// Default Story - Normal Operation
export const Default: Story = {
  render: (args) => (
    <StatusBarProvider>
      <div style={{ height: '100vh', backgroundColor: '#f5f5f5', position: 'relative' }}>
        <StatusBar {...args} />
        <div style={{ 
          paddingTop: '80px', 
          padding: '100px 20px 20px', 
          fontFamily: 'Inter, sans-serif' 
        }}>
          <h1>Mission Control Interface</h1>
          <p>The status bar is positioned at the top showing normal operational status.</p>
          <p>All systems are healthy and the mission is progressing normally.</p>
        </div>
      </div>
    </StatusBarProvider>
  ),
  args: {
    data: createSampleData(),
    config: createSampleConfig(),
    onConfigChange: action('config-changed'),
    onNotificationAction: action('notification-action'),
    onStatusClick: action('status-clicked'),
    onEmergencyToggle: action('emergency-toggled')
  }
};

// System Warning State
export const SystemWarning: Story = {
  render: Default.render,
  args: {
    ...Default.args,
    data: createSampleData({
      systemHealth: {
        cpu: { usage: 85, temperature: 75, status: 'degraded' },
        memory: { 
          used: 28 * 1024 * 1024 * 1024, 
          total: 32 * 1024 * 1024 * 1024, 
          percentage: 87, 
          status: 'degraded' 
        },
        network: { 
          latency: 150, 
          bandwidth: 500000, 
          packetsLost: 5, 
          status: 'degraded', 
          signalStrength: 'fair' 
        },
        overall: 'degraded',
        lastUpdated: Date.now(),
        uptime: 86400
      } as SystemHealthData,
      notifications: [
        {
          id: 'warn-1',
          type: 'warning',
          title: 'High CPU Usage',
          message: 'CPU usage has exceeded 85% for the last 10 minutes',
          timestamp: Date.now() - 120000,
          source: 'system',
          persistent: true
        },
        {
          id: 'warn-2',
          type: 'warning',
          title: 'Memory Warning',
          message: 'Available memory is running low (13% remaining)',
          timestamp: Date.now() - 180000,
          source: 'system'
        }
      ] as NotificationData[]
    })
  }
};

// Connection Issues
export const ConnectionIssues: Story = {
  render: Default.render,
  args: {
    ...Default.args,
    data: createSampleData({
      connection: {
        state: ConnectionState.RECONNECTING,
        isConnected: false,
        signalStrength: 'poor',
        latency: 2500,
        reconnectAttempts: 3,
        error: 'Connection timeout after 30 seconds',
        metrics: {
          connectionCount: 4,
          reconnectionCount: 3,
          messagesReceived: 3420,
          messagesSent: 2100,
          bytesReceived: 8 * 1024 * 1024,
          bytesSent: 5 * 1024 * 1024,
          averageLatency: 850,
          currentLatency: 2500,
          lastHeartbeat: Date.now() - 15000,
          uptime: 72000,
          errorCount: 12,
          queuedMessages: 5
        }
      } as ConnectionStatusData,
      commandQueue: {
        length: 8,
        processing: false,
        processingCommand: 'navigate_to_waypoint(lat: 14.5, lon: -175.2)',
        successCount: 2100,
        errorCount: 45,
        avgProcessingTime: 3500,
        status: 'warning'
      } as CommandQueueData,
      notifications: [
        {
          id: 'conn-1',
          type: 'error',
          title: 'Connection Lost',
          message: 'Lost connection to rover. Attempting to reconnect...',
          timestamp: Date.now() - 30000,
          source: 'system',
          persistent: true
        }
      ] as NotificationData[]
    })
  }
};

// Emergency Mode
export const EmergencyMode: Story = {
  render: Default.render,
  args: {
    ...Default.args,
    data: createSampleData({
      systemHealth: {
        cpu: { usage: 95, temperature: 85, status: 'critical' },
        memory: { 
          used: 31 * 1024 * 1024 * 1024, 
          total: 32 * 1024 * 1024 * 1024, 
          percentage: 97, 
          status: 'critical' 
        },
        network: { 
          latency: 5000, 
          bandwidth: 100000, 
          packetsLost: 25, 
          status: 'critical', 
          signalStrength: 'poor' 
        },
        overall: 'critical',
        lastUpdated: Date.now(),
        uptime: 86400
      } as SystemHealthData,
      mission: {
        status: 'error',
        name: 'Martian Geological Survey',
        startTime: Date.now() - 14400000,
        elapsedTime: 14400,
        estimatedDuration: 28800,
        progress: 35,
        emergencyLevel: 'emergency',
        waypoints: {
          total: 15,
          completed: 5,
          current: 'Emergency Safe Mode'
        }
      } as MissionData,
      notifications: [
        {
          id: 'emerg-1',
          type: 'error',
          title: 'CRITICAL SYSTEM FAILURE',
          message: 'Multiple system failures detected. Emergency protocols activated.',
          timestamp: Date.now() - 60000,
          source: 'system',
          persistent: true,
          actions: [
            { label: 'Emergency Stop', action: () => {}, primary: true },
            { label: 'Safe Mode', action: () => {} }
          ]
        },
        {
          id: 'emerg-2',
          type: 'error',
          title: 'Power System Alert',
          message: 'Battery temperature critical. Initiating emergency shutdown sequence.',
          timestamp: Date.now() - 120000,
          source: 'hardware',
          persistent: true
        }
      ] as NotificationData[]
    }),
    config: createSampleConfig({
      emergencyMode: true,
      theme: 'mission-critical'
    })
  }
};

// Compact Mode
export const CompactMode: Story = {
  render: Default.render,
  args: {
    ...Default.args,
    config: createSampleConfig({
      compact: true,
      showTimestamp: false
    })
  }
};

// Bottom Position
export const BottomPosition: Story = {
  render: (args) => (
    <StatusBarProvider>
      <div style={{ height: '100vh', backgroundColor: '#f5f5f5', position: 'relative' }}>
        <StatusBar {...args} />
        <div style={{ 
          padding: '20px 20px 100px', 
          fontFamily: 'Inter, sans-serif' 
        }}>
          <h1>Mission Control Interface</h1>
          <p>The status bar is positioned at the bottom, similar to a traditional taskbar.</p>
          <p>This configuration works well when the command bar is at the top.</p>
        </div>
      </div>
    </StatusBarProvider>
  ),
  args: {
    ...Default.args,
    config: createSampleConfig({
      position: 'bottom'
    })
  }
};

// Mission Complete
export const MissionComplete: Story = {
  render: Default.render,
  args: {
    ...Default.args,
    data: createSampleData({
      mission: {
        status: 'complete',
        name: 'Martian Geological Survey',
        startTime: Date.now() - 28800000, // 8 hours ago
        elapsedTime: 28800, // 8 hours
        estimatedDuration: 28800,
        progress: 100,
        waypoints: {
          total: 15,
          completed: 15,
          current: 'Mission Complete'
        }
      } as MissionData,
      notifications: [
        {
          id: 'complete-1',
          type: 'success',
          title: 'Mission Completed',
          message: 'All objectives completed successfully. Returning to base.',
          timestamp: Date.now() - 300000,
          source: 'mission',
          actions: [
            { label: 'View Report', action: () => {}, primary: true },
            { label: 'Start New Mission', action: () => {} }
          ]
        }
      ] as NotificationData[]
    })
  }
};

// High Activity
export const HighActivity: Story = {
  render: Default.render,
  args: {
    ...Default.args,
    data: createSampleData({
      commandQueue: {
        length: 12,
        processing: true,
        processingCommand: 'collect_sample(type: geological, location: crater_rim)',
        successCount: 8500,
        errorCount: 95,
        lastProcessed: Date.now() - 2000,
        avgProcessingTime: 850,
        status: 'normal'
      } as CommandQueueData,
      notifications: [
        {
          id: 'activity-1',
          type: 'info',
          title: 'Sample Collection Active',
          message: 'Collecting geological samples from crater rim site',
          timestamp: Date.now() - 30000,
          source: 'mission'
        },
        {
          id: 'activity-2',
          type: 'info',
          title: 'Data Transmission',
          message: 'Uploading 2.4 GB of sensor data to mission control',
          timestamp: Date.now() - 60000,
          source: 'system'
        },
        {
          id: 'activity-3',
          type: 'success',
          title: 'Navigation Update',
          message: 'GPS coordinates updated, position accuracy improved',
          timestamp: Date.now() - 90000,
          source: 'hardware'
        }
      ] as NotificationData[]
    })
  }
};

// Dark Theme Preview (would require theme provider in real app)
export const DarkMode: Story = {
  render: (args) => (
    <div style={{ 
      height: '100vh', 
      backgroundColor: '#0a0a0f', 
      color: '#ffffff',
      position: 'relative'
    }}>
      <StatusBarProvider>
        <StatusBar {...args} />
        <div style={{ 
          paddingTop: '80px', 
          padding: '100px 20px 20px', 
          fontFamily: 'Inter, sans-serif' 
        }}>
          <h1>Mission Control Interface - Dark Mode</h1>
          <p>Status bar optimized for dark environments and space operations.</p>
          <p>Enhanced visibility with glowing elements and high contrast indicators.</p>
        </div>
      </StatusBarProvider>
    </div>
  ),
  args: {
    ...Default.args,
    config: createSampleConfig({
      theme: 'dark'
    })
  }
};