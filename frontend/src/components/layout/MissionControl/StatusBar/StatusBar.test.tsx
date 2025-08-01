/**
 * Status Bar Component Tests
 * Comprehensive testing for status calculations and component behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { StatusBar, StatusBarProvider, useStatusBar } from './StatusBar';
import { defaultTheme } from '../../../../theme/themes';
import {
  StatusBarData,
  StatusBarConfiguration,
  SystemHealthData,
  ConnectionStatusData,
  CommandQueueData,
  MissionData,
  PowerStatusData,
  NotificationData,
  DEFAULT_CONFIGURATION,
  formatBytes,
  formatDuration,
  formatLatency,
  getStatusLevel,
  getSignalStrengthValue
} from './types';
import { ConnectionState } from '../../../../services/websocket/types';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>
    <StatusBarProvider>
      {children}
    </StatusBarProvider>
  </ThemeProvider>
);

// Mock data helpers
const createMockSystemHealth = (overrides: Partial<SystemHealthData> = {}): SystemHealthData => ({
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
  uptime: 3600,
  ...overrides
});

const createMockConnectionData = (overrides: Partial<ConnectionStatusData> = {}): ConnectionStatusData => ({
  state: ConnectionState.AUTHENTICATED,
  isConnected: true,
  signalStrength: 'excellent',
  latency: 25,
  reconnectAttempts: 0,
  metrics: {
    connectionCount: 1,
    reconnectionCount: 0,
    messagesReceived: 1000,
    messagesSent: 800,
    bytesReceived: 2 * 1024 * 1024,
    bytesSent: 1.5 * 1024 * 1024,
    averageLatency: 22,
    currentLatency: 25,
    lastHeartbeat: Date.now() - 2000,
    uptime: 3600,
    errorCount: 0,
    queuedMessages: 0
  },
  ...overrides
});

const createMockStatusBarData = (overrides: Partial<StatusBarData> = {}): StatusBarData => ({
  systemHealth: createMockSystemHealth(),
  connection: createMockConnectionData(),
  commandQueue: {
    length: 0,
    processing: false,
    successCount: 100,
    errorCount: 2,
    avgProcessingTime: 150,
    status: 'normal'
  } as CommandQueueData,
  mission: {
    status: 'active',
    name: 'Test Mission',
    startTime: Date.now() - 3600000,
    elapsedTime: 3600,
    progress: 50
  } as MissionData,
  power: {
    battery: {
      level: 85,
      voltage: 48.2,
      current: 12.5,
      temperature: 35,
      charging: false,
      timeRemaining: 240,
      status: 'healthy'
    },
    overall: 'healthy',
    powerConsumption: 250,
    estimatedRuntime: 340
  } as PowerStatusData,
  notifications: [],
  timestamp: Date.now(),
  ...overrides
});

// Mock WebSocket client for testing
const mockWebSocketClient = {
  connectionStatus: {
    state: ConnectionState.AUTHENTICATED,
    connected: true,
    authenticated: true,
    metrics: {
      connectionCount: 1,
      messagesReceived: 1000,
      messagesSent: 800,
      uptime: 3600
    }
  }
};

// Utility type checking tests
describe('StatusBar Utility Functions', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3600)).toBe('1:00:00');
      expect(formatDuration(3665)).toBe('1:01:05');
    });
  });

  describe('formatLatency', () => {
    it('should format latency correctly', () => {
      expect(formatLatency(50)).toBe('50ms');
      expect(formatLatency(999)).toBe('999ms');
      expect(formatLatency(1000)).toBe('1.0s');
      expect(formatLatency(2500)).toBe('2.5s');
    });
  });

  describe('getStatusLevel', () => {
    it('should return correct status levels', () => {
      expect(getStatusLevel('healthy')).toBe('normal');
      expect(getStatusLevel('degraded')).toBe('warning');
      expect(getStatusLevel('critical')).toBe('error');
      expect(getStatusLevel('offline')).toBe('critical');
    });
  });

  describe('getSignalStrengthValue', () => {
    it('should return correct signal strength values', () => {
      expect(getSignalStrengthValue('excellent')).toBe(5);
      expect(getSignalStrengthValue('good')).toBe(4);
      expect(getSignalStrengthValue('fair')).toBe(3);
      expect(getSignalStrengthValue('poor')).toBe(2);
      expect(getSignalStrengthValue('none')).toBe(1);
    });
  });
});

describe('StatusBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <StatusBar data-testid="status-bar" />
      </TestWrapper>
    );
    
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('displays default widgets correctly', () => {
    const mockData = createMockStatusBarData();
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    // Check if main widgets are present
    expect(screen.getByTestId('status-bar-connection')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-system-health')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-mission')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-command-queue')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar-notifications')).toBeInTheDocument();
  });

  it('shows emergency mode styling when enabled', () => {
    const mockData = createMockStatusBarData();
    const emergencyConfig: StatusBarConfiguration = {
      ...DEFAULT_CONFIGURATION,
      emergencyMode: true
    };
    
    render(
      <TestWrapper>
        <StatusBar 
          data={mockData} 
          config={emergencyConfig}
          data-testid="status-bar" 
        />
      </TestWrapper>
    );

    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar).toHaveAttribute('data-testid', 'status-bar');
    
    // Check for emergency banner
    expect(screen.getByText(/EMERGENCY MODE ACTIVE/i)).toBeInTheDocument();
  });

  it('displays system health status correctly', () => {
    const mockData = createMockStatusBarData({
      systemHealth: createMockSystemHealth({
        cpu: { usage: 85, temperature: 75, status: 'degraded' },
        overall: 'degraded'
      })
    });
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const healthWidget = screen.getByTestId('status-bar-system-health');
    expect(healthWidget).toBeInTheDocument();
    expect(healthWidget).toHaveAttribute('aria-label', expect.stringContaining('Degraded'));
  });

  it('shows connection status with signal strength', async () => {
    const user = userEvent.setup();
    const mockData = createMockStatusBarData({
      connection: createMockConnectionData({
        signalStrength: 'poor',
        latency: 500
      })
    });
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const connectionWidget = screen.getByTestId('status-bar-connection');
    expect(connectionWidget).toBeInTheDocument();
    
    // Hover to show tooltip
    await user.hover(connectionWidget);
    
    await waitFor(() => {
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
    });
  });

  it('displays mission progress correctly', () => {
    const mockData = createMockStatusBarData({
      mission: {
        status: 'active',
        name: 'Mars Survey Mission',
        startTime: Date.now() - 7200000, // 2 hours ago
        elapsedTime: 7200,
        progress: 75,
        waypoints: {
          total: 10,
          completed: 7,
          current: 'Site Alpha'
        }
      } as MissionData
    });
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const missionWidget = screen.getByTestId('status-bar-mission');
    expect(missionWidget).toBeInTheDocument();
    expect(missionWidget).toHaveAttribute('aria-label', expect.stringContaining('Mars Survey Mission'));
  });

  it('handles command queue processing state', () => {
    const mockData = createMockStatusBarData({
      commandQueue: {
        length: 5,
        processing: true,
        processingCommand: 'navigate_to_waypoint',
        successCount: 100,
        errorCount: 2,
        avgProcessingTime: 250,
        status: 'warning'
      } as CommandQueueData
    });
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const queueWidget = screen.getByTestId('status-bar-command-queue');
    expect(queueWidget).toBeInTheDocument();
    expect(queueWidget).toHaveAttribute('aria-label', expect.stringContaining('5 commands'));
  });

  it('displays notifications with correct count', async () => {
    const user = userEvent.setup();
    const mockNotifications: NotificationData[] = [
      {
        id: 'notif-1',
        type: 'warning',
        title: 'High CPU Usage',
        message: 'CPU usage is above 80%',
        timestamp: Date.now() - 300000,
        source: 'system'
      },
      {
        id: 'notif-2',
        type: 'info',
        title: 'Data Sync',
        message: 'Syncing telemetry data',
        timestamp: Date.now() - 600000,
        source: 'mission'
      }
    ];
    
    const mockData = createMockStatusBarData({
      notifications: mockNotifications
    });
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const notificationWidget = screen.getByTestId('status-bar-notifications');
    expect(notificationWidget).toBeInTheDocument();
    expect(notificationWidget).toHaveAttribute('aria-label', expect.stringContaining('2 total'));
  });

  it('responds to widget clicks', async () => {
    const user = userEvent.setup();
    const onStatusClick = jest.fn();
    const mockData = createMockStatusBarData();
    
    render(
      <TestWrapper>
        <StatusBar 
          data={mockData}
          onStatusClick={onStatusClick}
          data-testid="status-bar" 
        />
      </TestWrapper>
    );

    const healthWidget = screen.getByTestId('status-bar-system-health');
    await user.click(healthWidget);
    
    expect(onStatusClick).toHaveBeenCalledWith('system-health');
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    const mockData = createMockStatusBarData();
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const connectionWidget = screen.getByTestId('status-bar-connection');
    
    // Focus and press Enter
    connectionWidget.focus();
    await user.keyboard('{Enter}');
    
    // Should be focusable and respond to keyboard
    expect(connectionWidget).toHaveFocus();
  });

  it('updates time display automatically', async () => {
    const mockData = createMockStatusBarData();
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    // Initial time should be displayed
    expect(screen.getByText(/12:00:00/)).toBeInTheDocument();
    
    // Advance time by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Time should update
    await waitFor(() => {
      expect(screen.getByText(/12:00:01/)).toBeInTheDocument();
    });
  });

  it('shows compact mode correctly', () => {
    const mockData = createMockStatusBarData();
    const compactConfig: StatusBarConfiguration = {
      ...DEFAULT_CONFIGURATION,
      compact: true
    };
    
    render(
      <TestWrapper>
        <StatusBar 
          data={mockData}
          config={compactConfig}
          data-testid="status-bar" 
        />
      </TestWrapper>
    );

    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar).toBeInTheDocument();
    
    // In compact mode, some text elements should be hidden or smaller
    const connectionWidget = screen.getByTestId('status-bar-connection');
    expect(connectionWidget).toBeInTheDocument();
  });

  it('positions at bottom when configured', () => {
    const mockData = createMockStatusBarData();
    const bottomConfig: StatusBarConfiguration = {
      ...DEFAULT_CONFIGURATION,
      position: 'bottom'
    };
    
    render(
      <TestWrapper>
        <StatusBar 
          data={mockData}
          config={bottomConfig}
          data-testid="status-bar" 
        />
      </TestWrapper>
    );

    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar).toBeInTheDocument();
    // The positioning is handled by CSS, so we just verify the component renders
  });
});

describe('StatusBar Context', () => {
  it('provides context methods correctly', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useStatusBar();
      return <div>Test</div>;
    };
    
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    expect(contextValue).toBeDefined();
    expect(typeof contextValue.updateData).toBe('function');
    expect(typeof contextValue.addNotification).toBe('function');
    expect(typeof contextValue.removeNotification).toBe('function');
    expect(typeof contextValue.clearNotifications).toBe('function');
  });

  it('handles notification management', () => {
    let contextValue: any;
    
    const TestComponent = () => {
      contextValue = useStatusBar();
      return <div>Test</div>;
    };
    
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Add notification
    act(() => {
      contextValue.addNotification({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
        source: 'system'
      });
    });

    expect(contextValue.data.notifications).toHaveLength(1);
    expect(contextValue.data.notifications[0].title).toBe('Test Notification');

    // Remove notification
    const notificationId = contextValue.data.notifications[0].id;
    act(() => {
      contextValue.removeNotification(notificationId);
    });

    expect(contextValue.data.notifications).toHaveLength(0);
  });

  it('throws error when used outside provider', () => {
    const TestComponent = () => {
      useStatusBar();
      return <div>Test</div>;
    };
    
    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useStatusBar must be used within a StatusBarProvider');
    
    consoleSpy.mockRestore();
  });
});

describe('StatusBar Accessibility', () => {
  it('has proper ARIA labels', () => {
    const mockData = createMockStatusBarData();
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    const statusBar = screen.getByTestId('status-bar');
    expect(statusBar).toHaveAttribute('role', 'banner');
    expect(statusBar).toHaveAttribute('aria-label', 'Mission Control Status Bar');
    
    // Check individual widgets have aria-labels
    const connectionWidget = screen.getByTestId('status-bar-connection');
    expect(connectionWidget).toHaveAttribute('aria-label', expect.stringContaining('Connection status'));
  });

  it('supports keyboard navigation for all interactive elements', () => {
    const mockData = createMockStatusBarData();
    
    render(
      <TestWrapper>
        <StatusBar data={mockData} data-testid="status-bar" />
      </TestWrapper>
    );

    // All clickable widgets should be focusable
    const widgets = [
      screen.getByTestId('status-bar-connection'),
      screen.getByTestId('status-bar-system-health'),
      screen.getByTestId('status-bar-mission'),
      screen.getByTestId('status-bar-command-queue'),
      screen.getByTestId('status-bar-notifications')
    ];

    widgets.forEach(widget => {
      expect(widget).toHaveAttribute('tabIndex', '0');
      expect(widget).toHaveAttribute('role', 'button');
    });
  });
});