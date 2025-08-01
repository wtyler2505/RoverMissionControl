/**
 * HAL Dashboard Visual Regression Tests
 * 
 * Comprehensive visual testing for the HAL Dashboard component across
 * different themes, viewports, and states.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { HALDashboard } from '../HALDashboard';
import { HALProvider } from '../HALContext';

// Mock context provider wrapper
const TestWrapper: React.FC<{ 
  children: React.ReactNode;
  theme?: 'light' | 'dark' | 'highContrast';
}> = ({ children, theme = 'light' }) => {
  const muiTheme = createTheme({
    palette: {
      mode: theme === 'dark' ? 'dark' : 'light',
      ...(theme === 'highContrast' && {
        background: {
          default: '#000000',
          paper: '#ffffff'
        },
        text: {
          primary: '#ffffff',
          secondary: '#ffff00'
        }
      })
    }
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <HALProvider>
        {children}
      </HALProvider>
    </ThemeProvider>
  );
};

describe('HAL Dashboard Visual Tests', () => {
  beforeEach(async () => {
    // Setup visual test environment
    global.visualTestUtils.setupHALMocks();
    await global.visualTestUtils.waitForRender(200);
  });

  afterEach(() => {
    global.visualTestUtils.cleanup();
  });

  describe('Theme Variations', () => {
    test('renders correctly in light theme', async () => {
      const { container } = render(
        <TestWrapper theme="light">
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-light-theme'
      });
    });

    test('renders correctly in dark theme', async () => {
      const { container } = render(
        <TestWrapper theme="dark">
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-dark-theme'
      });
    });

    test('renders correctly in high contrast theme', async () => {
      const { container } = render(
        <TestWrapper theme="highContrast">
          <HALDashboard />  
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-high-contrast-theme'
      });
    });
  });

  describe('Responsive Design', () => {
    test('renders correctly on mobile viewport', async () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.mobile.width
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.mobile.height
      });

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-mobile-viewport'
      });
    });

    test('renders correctly on tablet viewport', async () => {
      // Set tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.tablet.width
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.tablet.height
      });

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-tablet-viewport'
      });
    });

    test('renders correctly on desktop viewport', async () => {
      // Set desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.desktop.width
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.desktop.height
      });

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-desktop-viewport'
      });
    });

    test('renders correctly on ultrawide viewport', async () => {
      // Set ultrawide viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.ultrawide.width
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: global.visualTestConfig.viewports.ultrawide.height
      });

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-ultrawide-viewport'
      });
    });
  });

  describe('Component States', () => {
    test('renders loading state correctly', async () => {
      // Mock loading state
      const mockHALContext = {
        devices: [],
        isLoading: true,
        error: null,
        isConnected: false
      };

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-loading-state'
      });
    });

    test('renders error state correctly', async () => {
      // Mock error state
      const mockHALContext = {
        devices: [],
        isLoading: false,
        error: 'Failed to connect to HAL devices',
        isConnected: false
      };

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-error-state'
      });
    });

    test('renders empty state correctly', async () => {
      // Mock empty state
      const mockHALContext = {
        devices: [],
        isLoading: false,
        error: null,
        isConnected: true
      };

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-empty-state'
      });
    });

    test('renders populated state correctly', async () => {
      // Mock populated state with devices
      const mockHALContext = {
        devices: global.mockHALDevices,
        isLoading: false,
        error: null,
        isConnected: true
      };

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();
      await global.visualTestUtils.waitForImages();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-populated-state'
      });
    });
  });

  describe('Interactive States', () => {
    test('renders with device selected', async () => {
      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      // Simulate device selection
      await waitFor(() => {
        const deviceCard = container.querySelector('[data-testid="device-card-hal-device-1"]');
        if (deviceCard) {
          deviceCard.click();
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-device-selected'
      });
    });

    test('renders with search active', async () => {
      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      // Simulate search activation
      await waitFor(() => {
        const searchInput = container.querySelector('[data-testid="hal-search-input"]');
        if (searchInput) {
          (searchInput as HTMLInputElement).focus();
          (searchInput as HTMLInputElement).value = 'sensor';
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-search-active'
      });
    });

    test('renders with filters applied', async () => {
      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      // Simulate filter application
      await waitFor(() => {
        const filterButton = container.querySelector('[data-testid="hal-filter-button"]');
        if (filterButton) {
          filterButton.click();
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-filters-applied'
      });
    });
  });

  describe('Accessibility States', () => {
    test('renders with high contrast mode', async () => {
      // Enable high contrast mode
      document.documentElement.setAttribute('data-contrast', 'high');

      const { container } = render(
        <TestWrapper theme="highContrast">
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-high-contrast-accessibility'
      });

      // Clean up
      document.documentElement.removeAttribute('data-contrast');
    });

    test('renders with reduced motion', async () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-reduced-motion'
      });
    });

    test('renders with focus visible', async () => {
      const { container } = render(
        <TestWrapper>
          <HALDashboard />
        </TestWrapper>
      );

      // Simulate focus on first interactive element
      await waitFor(() => {
        const firstButton = container.querySelector('button');
        if (firstButton) {
          firstButton.focus();
        }
      });

      await global.visualTestUtils.waitForAnimations();

      expect(container.firstChild).toMatchImageSnapshot({
        customSnapshotIdentifier: 'hal-dashboard-focus-visible'
      });
    });
  });
});