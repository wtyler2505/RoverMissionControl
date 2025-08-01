import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimulationDashboard } from '../SimulationDashboard';
import { SimulationProvider } from '../../../contexts/SimulationContext';
import { WebSocketProvider } from '../../../contexts/WebSocketContext';
import { act } from 'react-dom/test-utils';

// Mock the WebSocket context
jest.mock('../../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWebSocket: () => ({
    isConnected: true,
    lastMessage: null,
    sendMessage: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  }),
}));

// Mock the API service
jest.mock('../../../services/api', () => ({
  simulationAPI: {
    getStatus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    getDevices: jest.fn(),
    getScenarios: jest.fn(),
    runScenario: jest.fn(),
  },
}));

// Mock child components to simplify testing
jest.mock('../SimulationControlPanel', () => ({
  SimulationControlPanel: () => <div data-testid="simulation-control-panel">Control Panel</div>,
}));

jest.mock('../DeviceSimulator', () => ({
  DeviceSimulator: () => <div data-testid="device-simulator">Device Simulator</div>,
}));

jest.mock('../NetworkConditionPanel', () => ({
  NetworkConditionPanel: () => <div data-testid="network-condition-panel">Network Panel</div>,
}));

jest.mock('../EnvironmentControls', () => ({
  EnvironmentControls: () => <div data-testid="environment-controls">Environment Controls</div>,
}));

jest.mock('../ScenarioPlayer', () => ({
  ScenarioPlayer: () => <div data-testid="scenario-player">Scenario Player</div>,
}));

jest.mock('../SimulationMetrics', () => ({
  SimulationMetrics: () => <div data-testid="simulation-metrics">Metrics</div>,
}));

describe('SimulationDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <WebSocketProvider>
        <SimulationProvider>
          {component}
        </SimulationProvider>
      </WebSocketProvider>
    );
  };

  it('renders all simulation components', () => {
    renderWithProviders(<SimulationDashboard />);

    expect(screen.getByText('Simulation Control Center')).toBeInTheDocument();
    expect(screen.getByTestId('simulation-control-panel')).toBeInTheDocument();
    expect(screen.getByTestId('device-simulator')).toBeInTheDocument();
    expect(screen.getByTestId('network-condition-panel')).toBeInTheDocument();
    expect(screen.getByTestId('environment-controls')).toBeInTheDocument();
    expect(screen.getByTestId('scenario-player')).toBeInTheDocument();
    expect(screen.getByTestId('simulation-metrics')).toBeInTheDocument();
  });

  it('displays simulation status indicator', async () => {
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.getStatus.mockResolvedValue({
      is_running: true,
      start_time: '2024-01-01T00:00:00Z',
      metrics: {
        total_messages: 100,
        error_count: 2,
        uptime: 3600,
        active_devices: 5,
      },
    });

    renderWithProviders(<SimulationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });
  });

  it('handles tab navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SimulationDashboard />);

    // Click on different tabs
    const tabList = screen.getByRole('tablist');
    const scenariosTab = within(tabList).getByText('Scenarios');
    
    await user.click(scenariosTab);

    expect(screen.getByTestId('scenario-player')).toBeInTheDocument();
  });

  it('shows loading state while fetching data', () => {
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.getStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithProviders(<SimulationDashboard />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error states gracefully', async () => {
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.getStatus.mockRejectedValue(new Error('Failed to fetch status'));

    renderWithProviders(<SimulationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading simulation status/i)).toBeInTheDocument();
    });
  });

  it('updates on WebSocket messages', async () => {
    const { useWebSocket } = require('../../../contexts/WebSocketContext');
    
    let messageCallback: ((message: any) => void) | null = null;
    
    useWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: null,
      sendMessage: jest.fn(),
      subscribe: jest.fn((event: string, callback: (message: any) => void) => {
        if (event === 'simulation:status') {
          messageCallback = callback;
        }
      }),
      unsubscribe: jest.fn(),
    });

    renderWithProviders(<SimulationDashboard />);

    // Simulate WebSocket message
    act(() => {
      if (messageCallback) {
        messageCallback({
          event: 'simulation:status',
          data: {
            is_running: true,
            metrics: {
              active_devices: 10,
            },
          },
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/Running/i)).toBeInTheDocument();
    });
  });

  it('handles fullscreen mode toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SimulationDashboard />);

    const fullscreenButton = screen.getByLabelText(/fullscreen/i);
    await user.click(fullscreenButton);

    // Check if fullscreen API was called
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
  });

  it('displays connection status', () => {
    const { useWebSocket } = require('../../../contexts/WebSocketContext');
    
    useWebSocket.mockReturnValue({
      isConnected: false,
      lastMessage: null,
      sendMessage: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    });

    renderWithProviders(<SimulationDashboard />);

    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
  });
});