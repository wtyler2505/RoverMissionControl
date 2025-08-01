import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimulationControlPanel } from '../SimulationControlPanel';
import { SimulationProvider } from '../../../contexts/SimulationContext';
import { act } from 'react-dom/test-utils';

// Mock the API service
jest.mock('../../../services/api', () => ({
  simulationAPI: {
    start: jest.fn(),
    stop: jest.fn(),
    getStatus: jest.fn(),
  },
}));

// Mock the notification service
jest.mock('../../../services/notification', () => ({
  showNotification: jest.fn(),
}));

describe('SimulationControlPanel', () => {
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProvider = (props = {}) => {
    return render(
      <SimulationProvider>
        <SimulationControlPanel onStatusChange={mockOnStatusChange} {...props} />
      </SimulationProvider>
    );
  };

  it('renders control panel with start button when simulation is stopped', () => {
    renderWithProvider();

    expect(screen.getByText('Simulation Control')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop simulation/i })).not.toBeInTheDocument();
  });

  it('shows configuration form when starting simulation', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    expect(screen.getByText('Simulation Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText(/simulation name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/network profile/i)).toBeInTheDocument();
  });

  it('starts simulation with configuration', async () => {
    const { simulationAPI } = require('../../../services/api');
    const { showNotification } = require('../../../services/notification');
    
    simulationAPI.start.mockResolvedValue({
      status: 'started',
      session_id: 'test-session-123',
    });

    const user = userEvent.setup();
    renderWithProvider();

    // Open configuration
    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    // Fill configuration
    const nameInput = screen.getByLabelText(/simulation name/i);
    await user.type(nameInput, 'Test Simulation');

    const networkSelect = screen.getByLabelText(/network profile/i);
    await user.selectOptions(networkSelect, 'satellite');

    // Add device
    const addDeviceButton = screen.getByRole('button', { name: /add device/i });
    await user.click(addDeviceButton);

    // Start simulation
    const confirmStartButton = screen.getByRole('button', { name: /start$/i });
    await user.click(confirmStartButton);

    await waitFor(() => {
      expect(simulationAPI.start).toHaveBeenCalledWith({
        name: 'Test Simulation',
        description: '',
        devices: expect.any(Array),
        network_profile: 'satellite',
        environment: expect.any(Object),
      });
      expect(showNotification).toHaveBeenCalledWith('success', expect.stringContaining('started'));
      expect(mockOnStatusChange).toHaveBeenCalledWith(true);
    });
  });

  it('stops running simulation', async () => {
    const { simulationAPI } = require('../../../services/api');
    const { showNotification } = require('../../../services/notification');
    
    simulationAPI.stop.mockResolvedValue({
      status: 'stopped',
      metrics: { total_messages: 100 },
    });

    const user = userEvent.setup();
    renderWithProvider({ isRunning: true });

    const stopButton = screen.getByRole('button', { name: /stop simulation/i });
    await user.click(stopButton);

    // Confirm stop
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(simulationAPI.stop).toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith('info', expect.stringContaining('stopped'));
      expect(mockOnStatusChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles API errors gracefully', async () => {
    const { simulationAPI } = require('../../../services/api');
    const { showNotification } = require('../../../services/notification');
    
    simulationAPI.start.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    renderWithProvider();

    // Open configuration and start
    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    const nameInput = screen.getByLabelText(/simulation name/i);
    await user.type(nameInput, 'Test Simulation');

    const confirmStartButton = screen.getByRole('button', { name: /start$/i });
    await user.click(confirmStartButton);

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith('error', expect.stringContaining('Failed'));
    });
  });

  it('validates configuration before starting', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    // Try to start without name
    const confirmStartButton = screen.getByRole('button', { name: /start$/i });
    await user.click(confirmStartButton);

    expect(screen.getByText(/simulation name is required/i)).toBeInTheDocument();
  });

  it('allows adding and removing devices', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    // Add device
    const addDeviceButton = screen.getByRole('button', { name: /add device/i });
    await user.click(addDeviceButton);

    expect(screen.getByText(/Device 1/i)).toBeInTheDocument();

    // Add another device
    await user.click(addDeviceButton);
    expect(screen.getByText(/Device 2/i)).toBeInTheDocument();

    // Remove first device
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(screen.queryByText(/Device 1/i)).not.toBeInTheDocument();
  });

  it('loads device profiles', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    const addDeviceButton = screen.getByRole('button', { name: /add device/i });
    await user.click(addDeviceButton);

    const deviceProfileSelect = screen.getByLabelText(/device profile/i);
    
    expect(deviceProfileSelect).toHaveTextContent('temperature_sensor');
    expect(deviceProfileSelect).toHaveTextContent('rover');
    expect(deviceProfileSelect).toHaveTextContent('imu_sensor');
  });

  it('shows quick start presets', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    const startButton = screen.getByRole('button', { name: /start simulation/i });
    await user.click(startButton);

    expect(screen.getByText(/Quick Start/i)).toBeInTheDocument();
    
    const basicTestButton = screen.getByRole('button', { name: /basic test/i });
    await user.click(basicTestButton);

    // Should populate configuration
    expect(screen.getByLabelText(/simulation name/i)).toHaveValue('Basic Test Simulation');
  });

  it('displays simulation status when running', () => {
    renderWithProvider({ 
      isRunning: true,
      status: {
        start_time: new Date().toISOString(),
        session_id: 'test-123',
        devices: ['device1', 'device2'],
      },
    });

    expect(screen.getByText(/Status: Running/i)).toBeInTheDocument();
    expect(screen.getByText(/Session ID:/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Devices: 2/i)).toBeInTheDocument();
  });
});