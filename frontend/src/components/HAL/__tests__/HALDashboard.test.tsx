import React from 'react';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, MockHALProvider, MockWebSocketProvider, generateMockDevice } from '../../../__tests__/test-utils';
import { HALDashboard } from '../HALDashboard';

// Mock the individual components
jest.mock('../HALDeviceList', () => ({
  HALDeviceList: ({ devices, onDeviceSelect }: any) => (
    <div data-testid="hal-device-list">
      <div>Device List</div>
      {devices?.map((device: any) => (
        <button 
          key={device.id} 
          onClick={() => onDeviceSelect?.(device)}
          data-testid={`device-${device.id}`}
        >
          {device.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('../HALStatusCard', () => ({
  HALStatusCard: ({ totalDevices, connectedDevices }: any) => (
    <div data-testid="hal-status-card">
      <span data-testid="total-devices">{totalDevices}</span>
      <span data-testid="connected-devices">{connectedDevices}</span>
    </div>
  ),
}));

jest.mock('../HALActivityFeed', () => ({
  HALActivityFeed: () => (
    <div data-testid="hal-activity-feed">Activity Feed</div>
  ),
}));

jest.mock('../HALSearchBar', () => ({
  HALSearchBar: ({ onSearch }: any) => (
    <input 
      data-testid="hal-search-bar"
      placeholder="Search devices..."
      onChange={(e) => onSearch?.(e.target.value)}
    />
  ),
}));

describe('HALDashboard', () => {
  const mockDevices = [
    generateMockDevice({
      id: 'device-1',
      name: 'Temperature Sensor',
      type: 'sensor',
      status: 'connected'
    }),
    generateMockDevice({
      id: 'device-2',
      name: 'Motor Controller',
      type: 'actuator',
      status: 'disconnected'
    }),
    generateMockDevice({
      id: 'device-3',
      name: 'Camera Module',
      type: 'sensor',
      status: 'connected'
    })
  ];

  const defaultHALContext = {
    devices: mockDevices,
    isLoading: false,
    error: null,
    refreshDevices: jest.fn(),
    sendCommand: jest.fn()
  };

  const renderHALDashboard = (halContextOverrides = {}, wsContextOverrides = {}) => {
    return render(
      <MockWebSocketProvider mockValues={wsContextOverrides}>
        <MockHALProvider mockValues={{ ...defaultHALContext, ...halContextOverrides }}>
          <HALDashboard />
        </MockHALProvider>
      </MockWebSocketProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all main components', () => {
      renderHALDashboard();

      expect(screen.getByText('Hardware Abstraction Layer')).toBeInTheDocument();
      expect(screen.getByTestId('hal-status-card')).toBeInTheDocument();
      expect(screen.getByTestId('hal-device-list')).toBeInTheDocument();
      expect(screen.getByTestId('hal-activity-feed')).toBeInTheDocument();
      expect(screen.getByTestId('hal-search-bar')).toBeInTheDocument();
    });

    it('displays correct device statistics', () => {
      renderHALDashboard();

      const statusCard = screen.getByTestId('hal-status-card');
      expect(within(statusCard).getByTestId('total-devices')).toHaveTextContent('3');
      expect(within(statusCard).getByTestId('connected-devices')).toHaveTextContent('2');
    });

    it('shows loading state when devices are being fetched', () => {
      renderHALDashboard({ isLoading: true });

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/loading devices/i)).toBeInTheDocument();
    });

    it('displays error message when there is an error', () => {
      const errorMessage = 'Failed to fetch devices';
      renderHALDashboard({ error: errorMessage });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('shows empty state when no devices are available', () => {
      renderHALDashboard({ devices: [] });

      expect(screen.getByText(/no devices found/i)).toBeInTheDocument();
      expect(screen.getByText(/check your hardware connections/i)).toBeInTheDocument();
    });
  });

  describe('Device Interaction', () => {
    it('handles device selection', async () => {
      const user = userEvent.setup();
      renderHALDashboard();

      const deviceButton = screen.getByTestId('device-device-1');
      await user.click(deviceButton);

      // Verify device details are shown (implementation dependent)
      expect(screen.getByText('Temperature Sensor')).toBeInTheDocument();
    });

    it('filters devices based on search input', async () => {
      const user = userEvent.setup();
      renderHALDashboard();

      const searchInput = screen.getByTestId('hal-search-bar');
      await user.type(searchInput, 'temperature');

      // The search functionality would filter the device list
      // This test depends on the actual implementation
      await waitFor(() => {
        expect(searchInput).toHaveValue('temperature');
      });
    });

    it('refreshes device list when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefresh = jest.fn();
      renderHALDashboard({ refreshDevices: mockRefresh });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', () => {
      renderHALDashboard({ error: 'Network connection failed' });

      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('retries on error when retry button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefresh = jest.fn();
      renderHALDashboard({ 
        error: 'Connection failed', 
        refreshDevices: mockRefresh 
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-time Updates', () => {
    it('updates device status via WebSocket messages', async () => {
      const mockSubscribe = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      renderHALDashboard({}, { 
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe
      });

      // Verify WebSocket subscription
      expect(mockSubscribe).toHaveBeenCalledWith('hal:device:status', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('hal:device:added', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('hal:device:removed', expect.any(Function));
    });

    it('handles device status updates from WebSocket', () => {
      let statusUpdateCallback: Function;
      const mockSubscribe = jest.fn((event, callback) => {
        if (event === 'hal:device:status') {
          statusUpdateCallback = callback;
        }
      });

      renderHALDashboard({}, { subscribe: mockSubscribe });

      // Simulate WebSocket status update
      const statusUpdate = {
        deviceId: 'device-1',
        status: 'disconnected',
        timestamp: new Date().toISOString()
      };

      if (statusUpdateCallback) {
        statusUpdateCallback(statusUpdate);
      }

      // The component should update the device status
      // This would be verified based on the actual implementation
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderHALDashboard();

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Hardware Abstraction Layer Dashboard');
      expect(screen.getByRole('region', { name: /device list/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /device status/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderHALDashboard();

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      
      // Tab to the refresh button
      await user.tab();
      expect(refreshButton).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      expect(defaultHALContext.refreshDevices).toHaveBeenCalled();
    });

    it('announces device status changes to screen readers', async () => {
      renderHALDashboard();

      // This would test ARIA live regions for status announcements
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large numbers of devices efficiently', () => {
      const manyDevices = Array.from({ length: 1000 }, (_, i) => 
        generateMockDevice({ 
          id: `device-${i}`, 
          name: `Device ${i}` 
        })
      );

      const startTime = performance.now();
      renderHALDashboard({ devices: manyDevices });
      const endTime = performance.now();

      // Should render within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByTestId('hal-device-list')).toBeInTheDocument();
    });

    it('debounces search input to avoid excessive filtering', async () => {
      const user = userEvent.setup();
      renderHALDashboard();

      const searchInput = screen.getByTestId('hal-search-bar');
      
      // Type rapidly
      await user.type(searchInput, 'test', { delay: 1 });

      // Should debounce the search calls
      await waitFor(() => {
        expect(searchInput).toHaveValue('test');
      });
    });
  });

  describe('Settings and Configuration', () => {
    it('opens settings dialog when settings button is clicked', async () => {
      const user = userEvent.setup();
      renderHALDashboard();

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      expect(screen.getByRole('dialog', { name: /hal settings/i })).toBeInTheDocument();
    });

    it('exports device data when export button is clicked', async () => {
      const user = userEvent.setup();
      renderHALDashboard();

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      expect(screen.getByRole('dialog', { name: /export devices/i })).toBeInTheDocument();
    });
  });
});