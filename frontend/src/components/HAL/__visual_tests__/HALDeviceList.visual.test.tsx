/**
 * HAL Device List Visual Regression Tests
 * 
 * Visual testing for the HAL Device List component including
 * different device states, list configurations, and interactions.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { HALDeviceList } from '../HALDeviceList';
import { HALProvider } from '../HALContext';

// Mock data for different device states
const mockDevices = {
  connected: [
    {
      id: 'device-1',
      name: 'Primary Navigation Unit',
      type: 'navigation',
      status: 'connected',
      firmware: '2.1.3',
      lastSeen: new Date().toISOString(),
      capabilities: ['GPS', 'IMU', 'Compass'],
      batteryLevel: 85,
      signalStrength: 92
    },
    {
      id: 'device-2', 
      name: 'Sensor Array Alpha',
      type: 'sensor',
      status: 'connected',
      firmware: '1.8.2',
      lastSeen: new Date().toISOString(),
      capabilities: ['Temperature', 'Humidity', 'Pressure'],
      batteryLevel: 67,
      signalStrength: 78
    }
  ],
  mixed: [
    {
      id: 'device-1',
      name: 'Primary Navigation Unit',
      type: 'navigation',
      status: 'connected',
      firmware: '2.1.3',
      lastSeen: new Date().toISOString(),
      capabilities: ['GPS', 'IMU', 'Compass'],
      batteryLevel: 85,
      signalStrength: 92
    },
    {
      id: 'device-2',
      name: 'Sensor Array Alpha',
      type: 'sensor', 
      status: 'disconnected',
      firmware: '1.8.2',
      lastSeen: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      capabilities: ['Temperature', 'Humidity', 'Pressure'],
      batteryLevel: 23,
      signalStrength: 0
    },
    {
      id: 'device-3',
      name: 'Communication Module',
      type: 'communication',
      status: 'error',
      firmware: '3.0.1',
      lastSeen: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      capabilities: ['WiFi', 'Bluetooth', 'Radio'],
      batteryLevel: 45,
      signalStrength: 12,
      error: 'Communication timeout'
    },
    {
      id: 'device-4',
      name: 'Motor Controller Beta',
      type: 'actuator',
      status: 'warning',
      firmware: '1.5.7',
      lastSeen: new Date().toISOString(),
      capabilities: ['Servo Control', 'PWM Output'],
      batteryLevel: 91,
      signalStrength: 88,
      warning: 'High temperature detected'
    }
  ],
  empty: []
};

const TestWrapper: React.FC<{ 
  children: React.ReactNode;
  theme?: 'light' | 'dark';
  devices?: any[];
}> = ({ children, theme = 'light', devices = [] }) => {
  const muiTheme = createTheme({
    palette: {
      mode: theme
    }
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <HALProvider value={{ devices, isLoading: false, error: null, isConnected: true }}>
        {children}
      </HALProvider>
    </ThemeProvider>
  );
};

describe('HAL Device List Visual Tests', () => {
  beforeEach(async () => {
    global.visualTestUtils.setupHALMocks();
    await global.visualTestUtils.waitForRender(200);
  });

  afterEach(() => {
    global.visualTestUtils.cleanup();
  });

  describe('Device States', () => {
    test('renders empty list correctly', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.empty}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-empty'
      });
    });

    test('renders connected devices correctly', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.connected}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-connected'
      });
    });

    test('renders mixed device states correctly', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-mixed-states'
      });
    });
  });

  describe('List Layouts', () => {
    test('renders in grid layout', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList layout="grid" />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-grid-layout'
      });
    });

    test('renders in list layout', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList layout="list" />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-list-layout'
      });
    });

    test('renders in compact mode', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList compact={true} />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-compact-mode'
      });
    });
  });

  describe('Interactive States', () => {
    test('renders with device selected', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      // Simulate device selection
      await waitFor(() => {
        const deviceCard = container.querySelector('[data-testid="device-card-device-1"]');
        if (deviceCard) {
          fireEvent.click(deviceCard);
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-device-selected'
      });
    });

    test('renders with hover state', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      // Simulate hover on first device
      await waitFor(() => {
        const deviceCard = container.querySelector('[data-testid="device-card-device-1"]');
        if (deviceCard) {
          fireEvent.mouseEnter(deviceCard);
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-hover-state'
      });
    });

    test('renders with context menu open', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      // Simulate right-click to open context menu
      await waitFor(() => {
        const deviceCard = container.querySelector('[data-testid="device-card-device-1"]');
        if (deviceCard) {
          fireEvent.contextMenu(deviceCard);
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-context-menu'
      });
    });
  });

  describe('Theme Variations', () => {
    test('renders correctly in dark theme', async () => {
      const { container } = render(
        <TestWrapper theme="dark" devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-dark-theme'
      });
    });

    test('renders correctly in light theme', async () => {
      const { container } = render(
        <TestWrapper theme="light" devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-light-theme'
      });
    });
  });

  describe('Responsive Behavior', () => {
    test('renders correctly on mobile', async () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-mobile'
      });
    });

    test('renders correctly on tablet', async () => {
      // Set tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-tablet'
      });
    });
  });

  describe('Loading and Error States', () => {
    test('renders loading state correctly', async () => {
      const { container } = render(
        <TestWrapper>
          <HALDeviceList />
        </TestWrapper>
      );

      // Mock loading state
      const loadingElement = container.querySelector('[data-testid="device-list-loading"]');
      if (loadingElement) {
        loadingElement.setAttribute('data-loading', 'true');
      }

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-loading'
      });
    });

    test('renders with device errors', async () => {
      const devicesWithErrors = mockDevices.mixed.map(device => ({
        ...device,
        status: 'error',
        error: 'Connection failed'
      }));

      const { container } = render(
        <TestWrapper devices={devicesWithErrors}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-with-errors'
      });
    });
  });

  describe('Sorting and Filtering', () => {
    test('renders with alphabetical sorting', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList sortBy="name" />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-sorted-name'
      });
    });

    test('renders with status filtering', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList filterBy="status" filterValue="connected" />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-filtered-status'
      });
    });

    test('renders with search active', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList searchTerm="sensor" />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-search-active'
      });
    });
  });

  describe('Accessibility Focus States', () => {
    test('renders with keyboard focus', async () => {
      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      // Simulate keyboard navigation
      await waitFor(() => {
        const firstDevice = container.querySelector('[data-testid="device-card-device-1"]');
        if (firstDevice) {
          (firstDevice as HTMLElement).focus();
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-keyboard-focus'
      });
    });

    test('renders with high contrast mode', async () => {
      // Enable high contrast
      document.documentElement.setAttribute('data-contrast', 'high');

      const { container } = render(
        <TestWrapper devices={mockDevices.mixed}>
          <HALDeviceList />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-device-list-high-contrast'
      });

      // Clean up
      document.documentElement.removeAttribute('data-contrast');
    });
  });
});