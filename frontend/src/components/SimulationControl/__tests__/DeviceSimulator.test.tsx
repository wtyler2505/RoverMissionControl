import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeviceSimulator } from '../DeviceSimulator';
import { SimulationProvider } from '../../../contexts/SimulationContext';
import { WebSocketProvider } from '../../../contexts/WebSocketContext';

// Mock the API service
jest.mock('../../../services/api', () => ({
  simulationAPI: {
    getDevices: jest.fn(),
    updateDevice: jest.fn(),
    sendCommand: jest.fn(),
  },
}));

// Mock WebSocket context
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

describe('DeviceSimulator', () => {
  const mockDevices = [
    {
      id: 'device1',
      profile: 'temperature_sensor',
      state: { temperature: 25.0, unit: 'celsius' },
      status: 'active',
      info: {
        name: 'Temperature Sensor 1',
        type: 'sensor',
        capabilities: ['read', 'calibrate'],
      },
    },
    {
      id: 'device2',
      profile: 'rover',
      state: { position: { x: 0, y: 0 }, battery: 100, status: 'idle' },
      status: 'active',
      info: {
        name: 'Rover 1',
        type: 'actuator',
        capabilities: ['move', 'rotate', 'scan'],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.getDevices.mockResolvedValue({
      profiles: ['temperature_sensor', 'rover', 'imu_sensor'],
      active_devices: mockDevices,
    });
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

  it('renders device list', async () => {
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Simulated Devices')).toBeInTheDocument();
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
      expect(screen.getByText('Rover 1')).toBeInTheDocument();
    });
  });

  it('displays device status indicators', async () => {
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      const activeChips = screen.getAllByText('Active');
      expect(activeChips).toHaveLength(2);
    });
  });

  it('shows device details when expanded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
    });

    // Expand first device
    const expandButton = screen.getAllByLabelText(/expand/i)[0];
    await user.click(expandButton);

    expect(screen.getByText(/temperature: 25/i)).toBeInTheDocument();
    expect(screen.getByText(/unit: celsius/i)).toBeInTheDocument();
  });

  it('allows editing device configuration', async () => {
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.updateDevice.mockResolvedValue({
      status: 'updated',
      device: { ...mockDevices[0], state: { temperature: 30.0 } },
    });

    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
    });

    // Expand and edit device
    const expandButton = screen.getAllByLabelText(/expand/i)[0];
    await user.click(expandButton);

    const editButton = screen.getByRole('button', { name: /edit configuration/i });
    await user.click(editButton);

    // Should show edit form
    const tempInput = screen.getByLabelText(/temperature/i);
    await user.clear(tempInput);
    await user.type(tempInput, '30');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(simulationAPI.updateDevice).toHaveBeenCalledWith('device1', {
        state: { temperature: 30, unit: 'celsius' },
      });
    });
  });

  it('sends commands to devices', async () => {
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.sendCommand.mockResolvedValue({
      status: 'sent',
      result: { command_id: 'cmd123', status: 'success' },
    });

    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Rover 1')).toBeInTheDocument();
    });

    // Expand rover device
    const expandButton = screen.getAllByLabelText(/expand/i)[1];
    await user.click(expandButton);

    // Send move command
    const moveButton = screen.getByRole('button', { name: /move/i });
    await user.click(moveButton);

    await waitFor(() => {
      expect(simulationAPI.sendCommand).toHaveBeenCalledWith('device2', {
        command: 'move',
        direction: 'forward',
        distance: 10,
      });
    });
  });

  it('updates device state from WebSocket messages', async () => {
    const { useWebSocket } = require('../../../contexts/WebSocketContext');
    
    let telemetryCallback: ((message: any) => void) | null = null;
    
    useWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: null,
      sendMessage: jest.fn(),
      subscribe: jest.fn((event: string, callback: (message: any) => void) => {
        if (event === 'simulation:telemetry') {
          telemetryCallback = callback;
        }
      }),
      unsubscribe: jest.fn(),
    });

    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
    });

    // Expand device
    const user = userEvent.setup();
    const expandButton = screen.getAllByLabelText(/expand/i)[0];
    await user.click(expandButton);

    // Simulate telemetry update
    if (telemetryCallback) {
      telemetryCallback({
        event: 'simulation:telemetry',
        data: {
          device1: { temperature: 26.5, timestamp: new Date().toISOString() },
        },
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/temperature: 26.5/i)).toBeInTheDocument();
    });
  });

  it('filters devices by type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
      expect(screen.getByText('Rover 1')).toBeInTheDocument();
    });

    // Filter by sensors
    const filterSelect = screen.getByLabelText(/filter by type/i);
    await user.selectOptions(filterSelect, 'sensor');

    expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
    expect(screen.queryByText('Rover 1')).not.toBeInTheDocument();
  });

  it('shows device capabilities', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
    });

    // Expand device
    const expandButton = screen.getAllByLabelText(/expand/i)[0];
    await user.click(expandButton);

    expect(screen.getByText(/Capabilities:/i)).toBeInTheDocument();
    expect(screen.getByText(/read/i)).toBeInTheDocument();
    expect(screen.getByText(/calibrate/i)).toBeInTheDocument();
  });

  it('handles device errors', async () => {
    const { simulationAPI } = require('../../../services/api');
    simulationAPI.sendCommand.mockRejectedValue(new Error('Device offline'));

    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Rover 1')).toBeInTheDocument();
    });

    // Expand and try to send command
    const expandButton = screen.getAllByLabelText(/expand/i)[1];
    await user.click(expandButton);

    const moveButton = screen.getByRole('button', { name: /move/i });
    await user.click(moveButton);

    await waitFor(() => {
      expect(screen.getByText(/Error: Device offline/i)).toBeInTheDocument();
    });
  });

  it('displays device telemetry history', async () => {
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
    });

    // Expand device
    const user = userEvent.setup();
    const expandButton = screen.getAllByLabelText(/expand/i)[0];
    await user.click(expandButton);

    // Check for telemetry chart/history
    expect(screen.getByText(/Telemetry/i)).toBeInTheDocument();
  });

  it('allows batch operations on multiple devices', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeviceSimulator />);

    await waitFor(() => {
      expect(screen.getByText('Temperature Sensor 1')).toBeInTheDocument();
      expect(screen.getByText('Rover 1')).toBeInTheDocument();
    });

    // Select multiple devices
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Batch action button should appear
    expect(screen.getByRole('button', { name: /batch actions/i })).toBeInTheDocument();
  });
});