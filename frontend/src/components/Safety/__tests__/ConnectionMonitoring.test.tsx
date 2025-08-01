/**
 * Connection Monitoring Integration Tests
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ConnectionMonitoringPanel from '../ConnectionMonitoringPanel';
import { ConnectionHealthMonitor, ConnectionType, ConnectionHealthLevel } from '../../../services/websocket/ConnectionHealthMonitor';
import '@testing-library/jest-dom';

// Mock chart.js
jest.mock('react-chartjs-2', () => ({
  Line: () => <div>Mock Chart</div>,
}));

jest.mock('chart.js', () => ({
  Chart: jest.fn(),
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  PointElement: jest.fn(),
  LineElement: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn(),
}));

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('ConnectionMonitoringPanel', () => {
  let monitor: ConnectionHealthMonitor;

  beforeEach(() => {
    // Create a new monitor for each test
    monitor = new ConnectionHealthMonitor({
      monitoringInterval: 100, // Fast for testing
      enableAutoStop: false,   // Disable for testing
    });

    // Register test connections
    monitor.registerConnection('test-websocket', ConnectionType.WEBSOCKET);
    monitor.registerConnection('test-hardware', ConnectionType.HARDWARE_SERIAL);
  });

  afterEach(() => {
    monitor.destroy();
  });

  it('renders connection monitoring panel', () => {
    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    expect(screen.getByText('Connection Monitor')).toBeInTheDocument();
  });

  it('displays registered connections', async () => {
    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('WebSocket')).toBeInTheDocument();
      expect(screen.getByText('Serial Port')).toBeInTheDocument();
    });
  });

  it('shows connection health levels', async () => {
    // Update connection metrics
    monitor.updateMetrics('test-websocket', 45, true); // Excellent
    monitor.updateMetrics('test-hardware', 250, true); // Fair

    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('excellent')).toBeInTheDocument();
      expect(screen.getByText('fair')).toBeInTheDocument();
    });
  });

  it('shows critical alert for disconnected connections', async () => {
    // Report connection loss
    monitor.reportConnectionLoss('test-hardware', new Error('Connection timeout'));

    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Critical Connection Failure')).toBeInTheDocument();
      expect(screen.getByText(/1 connection\(s\) in critical state/)).toBeInTheDocument();
    });
  });

  it('expands connection details on click', async () => {
    monitor.updateMetrics('test-websocket', 75, true);

    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    const connectionCard = screen.getByText('WebSocket').closest('div[role="presentation"]');
    fireEvent.click(connectionCard!);

    await waitFor(() => {
      expect(screen.getByText('Avg Latency')).toBeInTheDocument();
      expect(screen.getByText('Packet Loss')).toBeInTheDocument();
      expect(screen.getByText('Jitter')).toBeInTheDocument();
    });
  });

  it('handles monitoring pause/resume', async () => {
    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    const pauseButton = screen.getByLabelText('Pause monitoring');
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Resume monitoring')).toBeInTheDocument();
    });
  });

  it('triggers emergency stop callback on critical connections', async () => {
    const mockEmergencyStop = jest.fn();

    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
        onEmergencyStop={mockEmergencyStop}
      />
    );

    // Enable auto-stop
    monitor.config.enableAutoStop = true;
    
    // Report hardware connection loss
    monitor.reportConnectionLoss('test-hardware', new Error('Hardware failure'));

    // Wait for grace period
    await waitFor(
      () => {
        expect(mockEmergencyStop).toHaveBeenCalled();
      },
      { timeout: 4000 }
    );
  });

  it('exports metrics report', async () => {
    // Mock create/click element
    const mockClick = jest.fn();
    const mockCreateElement = jest.spyOn(document, 'createElement');
    mockCreateElement.mockImplementation((tagName) => {
      if (tagName === 'a') {
        return { click: mockClick } as any;
      }
      return document.createElement(tagName);
    });

    renderWithTheme(
      <ConnectionMonitoringPanel
        monitor={monitor}
        showDetails={true}
        enableSoundAlerts={false}
      />
    );

    const exportButton = screen.getByLabelText('Export metrics');
    fireEvent.click(exportButton);

    expect(mockClick).toHaveBeenCalled();
    mockCreateElement.mockRestore();
  });
});

describe('ConnectionHealthMonitor', () => {
  let monitor: ConnectionHealthMonitor;

  beforeEach(() => {
    monitor = new ConnectionHealthMonitor();
  });

  afterEach(() => {
    monitor.destroy();
  });

  it('calculates health levels correctly', () => {
    monitor.registerConnection('test', ConnectionType.WEBSOCKET);

    // Test excellent health
    monitor.updateMetrics('test', 30, true);
    const status1 = monitor.getConnectionStatus('test');
    expect(status1?.health).toBe(ConnectionHealthLevel.EXCELLENT);

    // Test good health
    monitor.updateMetrics('test', 80, true);
    const status2 = monitor.getConnectionStatus('test');
    expect(status2?.health).toBe(ConnectionHealthLevel.GOOD);

    // Test fair health
    monitor.updateMetrics('test', 150, true);
    const status3 = monitor.getConnectionStatus('test');
    expect(status3?.health).toBe(ConnectionHealthLevel.FAIR);

    // Test poor health
    monitor.updateMetrics('test', 400, true);
    const status4 = monitor.getConnectionStatus('test');
    expect(status4?.health).toBe(ConnectionHealthLevel.POOR);
  });

  it('tracks connection metrics over time', () => {
    monitor.registerConnection('test', ConnectionType.REST_API);

    // Update metrics multiple times
    monitor.updateMetrics('test', 50, true);
    monitor.updateMetrics('test', 60, true);
    monitor.updateMetrics('test', 55, true);

    const status = monitor.getConnectionStatus('test');
    expect(status?.metrics.minLatency).toBe(50);
    expect(status?.metrics.maxLatency).toBe(60);
    expect(status?.metrics.averageLatency).toBeCloseTo(55, 1);
  });

  it('detects critical connections', () => {
    monitor.registerConnection('ws', ConnectionType.WEBSOCKET);
    monitor.registerConnection('hw1', ConnectionType.HARDWARE_SERIAL);
    monitor.registerConnection('hw2', ConnectionType.HARDWARE_USB);

    // All healthy
    expect(monitor.getCriticalConnections()).toHaveLength(0);

    // Hardware critical
    monitor.reportConnectionLoss('hw1');
    expect(monitor.getCriticalConnections()).toContain('hw1');

    // Multiple critical
    monitor.reportConnectionLoss('ws');
    monitor.reportConnectionLoss('hw2');
    expect(monitor.getCriticalConnections()).toHaveLength(3);
  });

  it('maintains event log', () => {
    monitor.registerConnection('test', ConnectionType.WEBSOCKET);
    
    monitor.reportConnectionLoss('test');
    monitor.reportConnectionRestored('test');

    const events = monitor.exportEventLog();
    expect(events).toHaveLength(3); // register, loss, restored
    expect(events[1].type).toBe('connection_lost');
    expect(events[2].type).toBe('connection_restored');
  });

  it('calculates overall health correctly', () => {
    monitor.registerConnection('c1', ConnectionType.WEBSOCKET);
    monitor.registerConnection('c2', ConnectionType.REST_API);
    monitor.registerConnection('c3', ConnectionType.HARDWARE_SERIAL);

    // All excellent
    monitor.updateMetrics('c1', 30, true);
    monitor.updateMetrics('c2', 40, true);
    monitor.updateMetrics('c3', 25, true);
    expect(monitor.getOverallHealth()).toBe(ConnectionHealthLevel.EXCELLENT);

    // One poor - overall should be poor
    monitor.updateMetrics('c2', 450, true);
    expect(monitor.getOverallHealth()).toBe(ConnectionHealthLevel.POOR);

    // One disconnected - overall should be disconnected
    monitor.reportConnectionLoss('c3');
    expect(monitor.getOverallHealth()).toBe(ConnectionHealthLevel.DISCONNECTED);
  });
});