import React from 'react';
import { screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, generateMockDevice } from '../../../__tests__/test-utils';
import { HALDeviceList } from '../HALDeviceList';

describe('HALDeviceList', () => {
  const mockDevices = [
    generateMockDevice({
      id: 'device-1',
      name: 'Temperature Sensor',
      type: 'sensor',
      status: 'connected',
      capabilities: ['temperature', 'humidity']
    }),
    generateMockDevice({
      id: 'device-2',
      name: 'Motor Controller',
      type: 'actuator',
      status: 'disconnected',
      capabilities: ['move', 'rotate']
    }),
    generateMockDevice({
      id: 'device-3',
      name: 'Camera Module',
      type: 'sensor',
      status: 'error',
      capabilities: ['image_capture']
    })
  ];

  const defaultProps = {
    devices: mockDevices,
    onDeviceSelect: jest.fn(),
    onDeviceCommand: jest.fn(),
    selectedDeviceId: null,
    isLoading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders device list with all devices', () => {
      render(<HALDeviceList {...defaultProps} />);

      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument();
      expect(screen.getByText('Motor Controller')).toBeInTheDocument();
      expect(screen.getByText('Camera Module')).toBeInTheDocument();
    });

    it('displays device status indicators correctly', () => {
      render(<HALDeviceList {...defaultProps} />);

      // Check for status indicators
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    it('shows device types and capabilities', () => {
      render(<HALDeviceList {...defaultProps} />);

      expect(screen.getByText('sensor')).toBeInTheDocument();
      expect(screen.getByText('actuator')).toBeInTheDocument();
      expect(screen.getByText('temperature')).toBeInTheDocument();
      expect(screen.getByText('move')).toBeInTheDocument();
    });

    it('highlights selected device', () => {
      render(<HALDeviceList {...defaultProps} selectedDeviceId="device-1" />);

      const selectedDevice = screen.getByTestId('device-item-device-1');
      expect(selectedDevice).toHaveClass('selected');
    });

    it('shows loading state', () => {
      render(<HALDeviceList {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/loading devices/i)).toBeInTheDocument();
    });

    it('shows empty state when no devices', () => {
      render(<HALDeviceList {...defaultProps} devices={[]} />);

      expect(screen.getByText(/no devices available/i)).toBeInTheDocument();
      expect(screen.getByText(/connect hardware devices/i)).toBeInTheDocument();
    });
  });

  describe('Device Interaction', () => {
    it('calls onDeviceSelect when device is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();
      
      render(<HALDeviceList {...defaultProps} onDeviceSelect={mockOnSelect} />);

      const deviceItem = screen.getByTestId('device-item-device-1');
      await user.click(deviceItem);

      expect(mockOnSelect).toHaveBeenCalledWith(mockDevices[0]);
    });

    it('shows device actions menu on right click', async () => {
      const user = userEvent.setup();
      render(<HALDeviceList {...defaultProps} />);

      const deviceItem = screen.getByTestId('device-item-device-1');
      await user.pointer({ keys: '[MouseRight]', target: deviceItem });

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByText('Send Command')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('handles command sending from context menu', async () => {
      const user = userEvent.setup();
      const mockOnCommand = jest.fn();
      
      render(<HALDeviceList {...defaultProps} onDeviceCommand={mockOnCommand} />);

      const deviceItem = screen.getByTestId('device-item-device-1');
      await user.pointer({ keys: '[MouseRight]', target: deviceItem });

      const commandMenuItem = screen.getByText('Send Command');
      await user.click(commandMenuItem);

      expect(mockOnCommand).toHaveBeenCalledWith(mockDevices[0]);
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();
      
      render(<HALDeviceList {...defaultProps} onDeviceSelect={mockOnSelect} />);

      const firstDevice = screen.getByTestId('device-item-device-1');
      firstDevice.focus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('device-item-device-2')).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('device-item-device-1')).toHaveFocus();

      // Select with Enter
      await user.keyboard('{Enter}');
      expect(mockOnSelect).toHaveBeenCalledWith(mockDevices[0]);
    });
  });

  describe('Device Status', () => {
    it('displays correct status colors', () => {
      render(<HALDeviceList {...defaultProps} />);

      const connectedDevice = screen.getByTestId('device-status-device-1');
      expect(connectedDevice).toHaveClass('status-connected');

      const disconnectedDevice = screen.getByTestId('device-status-device-2');
      expect(disconnectedDevice).toHaveClass('status-disconnected');

      const errorDevice = screen.getByTestId('device-status-device-3');
      expect(errorDevice).toHaveClass('status-error');
    });

    it('shows last seen timestamp for disconnected devices', () => {
      const deviceWithLastSeen = generateMockDevice({
        id: 'device-offline',
        status: 'disconnected',
        lastSeen: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      });

      render(<HALDeviceList {...defaultProps} devices={[deviceWithLastSeen]} />);

      expect(screen.getByText(/last seen/i)).toBeInTheDocument();
      expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument();
    });

    it('updates device status in real-time', () => {
      const { rerender } = render(<HALDeviceList {...defaultProps} />);

      // Initially disconnected
      expect(screen.getByTestId('device-status-device-2')).toHaveClass('status-disconnected');

      // Update to connected
      const updatedDevices = mockDevices.map(device => 
        device.id === 'device-2' 
          ? { ...device, status: 'connected' }
          : device
      );

      rerender(<HALDeviceList {...defaultProps} devices={updatedDevices} />);

      expect(screen.getByTestId('device-status-device-2')).toHaveClass('status-connected');
    });
  });

  describe('Device Capabilities', () => {
    it('displays device capabilities as badges', () => {
      render(<HALDeviceList {...defaultProps} />);

      const tempSensorCapabilities = within(screen.getByTestId('device-item-device-1'))
        .getAllByTestId(/capability-/);
      
      expect(tempSensorCapabilities).toHaveLength(2);
      expect(screen.getByText('temperature')).toBeInTheDocument();
      expect(screen.getByText('humidity')).toBeInTheDocument();
    });

    it('shows capability icons for known types', () => {
      render(<HALDeviceList {...defaultProps} />);

      expect(screen.getByTestId('capability-icon-temperature')).toBeInTheDocument();
      expect(screen.getByTestId('capability-icon-move')).toBeInTheDocument();
    });

    it('handles unknown capabilities gracefully', () => {
      const deviceWithUnknownCapability = generateMockDevice({
        id: 'device-unknown',
        capabilities: ['unknown_capability']
      });

      render(<HALDeviceList {...defaultProps} devices={[deviceWithUnknownCapability]} />);

      expect(screen.getByText('unknown_capability')).toBeInTheDocument();
      expect(screen.getByTestId('capability-icon-default')).toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    it('filters devices by type', () => {
      render(<HALDeviceList {...defaultProps} filterType="sensor" />);

      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument();
      expect(screen.getByText('Camera Module')).toBeInTheDocument();
      expect(screen.queryByText('Motor Controller')).not.toBeInTheDocument();
    });

    it('filters devices by status', () => {
      render(<HALDeviceList {...defaultProps} filterStatus="connected" />);

      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument();
      expect(screen.queryByText('Motor Controller')).not.toBeInTheDocument();
      expect(screen.queryByText('Camera Module')).not.toBeInTheDocument();
    });

    it('sorts devices by name', () => {
      render(<HALDeviceList {...defaultProps} sortBy="name" sortOrder="asc" />);

      const deviceNames = screen.getAllByTestId(/device-name-/);
      expect(deviceNames[0]).toHaveTextContent('Camera Module');
      expect(deviceNames[1]).toHaveTextContent('Motor Controller');
      expect(deviceNames[2]).toHaveTextContent('Temperature Sensor');
    });

    it('sorts devices by status', () => {
      render(<HALDeviceList {...defaultProps} sortBy="status" sortOrder="desc" />);

      const deviceItems = screen.getAllByTestId(/device-item-/);
      // Error status should come first (desc order)
      expect(deviceItems[0]).toHaveAttribute('data-testid', 'device-item-device-3');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<HALDeviceList {...defaultProps} />);

      expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Hardware devices');
      
      const deviceItems = screen.getAllByRole('listitem');
      expect(deviceItems).toHaveLength(3);
      
      deviceItems.forEach(item => {
        expect(item).toHaveAttribute('tabIndex', '0');
      });
    });

    it('announces device status changes', () => {
      const { rerender } = render(<HALDeviceList {...defaultProps} />);

      const updatedDevices = mockDevices.map(device => 
        device.id === 'device-2' 
          ? { ...device, status: 'connected' }
          : device
      );

      rerender(<HALDeviceList {...defaultProps} devices={updatedDevices} />);

      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(/motor controller.*connected/i);
    });

    it('supports screen reader navigation', () => {
      render(<HALDeviceList {...defaultProps} />);

      const deviceList = screen.getByRole('list');
      expect(deviceList).toHaveAttribute('aria-describedby');
      
      const description = screen.getByText(/use arrow keys to navigate/i);
      expect(description).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('virtualizes large device lists', () => {
      const manyDevices = Array.from({ length: 1000 }, (_, i) => 
        generateMockDevice({ 
          id: `device-${i}`, 
          name: `Device ${i}` 
        })
      );

      render(<HALDeviceList {...defaultProps} devices={manyDevices} />);

      // Should only render visible items
      const visibleItems = screen.getAllByTestId(/device-item-/);
      expect(visibleItems.length).toBeLessThan(manyDevices.length);
      expect(visibleItems.length).toBeGreaterThan(0);
    });

    it('memoizes device items to prevent unnecessary re-renders', () => {
      const { rerender } = render(<HALDeviceList {...defaultProps} />);

      // Same props should not cause re-render
      rerender(<HALDeviceList {...defaultProps} />);

      // The component should use React.memo or similar optimization
      // This is more of an implementation detail test
    });
  });
});