import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { TelemetrySidebar } from './TelemetrySidebar';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test data
const mockSystemStatus = [
  {
    id: 'power',
    system: 'Power Systems',
    status: 'online' as const,
    message: 'Battery: 87%, Solar: Active',
  },
  {
    id: 'navigation',
    system: 'Navigation',
    status: 'warning' as const,
    message: 'GPS accuracy reduced',
    alerts: 1,
  },
];

const mockTelemetryData = [
  {
    id: 'temp',
    label: 'Temperature',
    value: 23.5,
    unit: '°C',
    status: 'normal' as const,
    timestamp: new Date(),
  },
  {
    id: 'battery',
    label: 'Battery',
    value: 87,
    unit: '%',
    status: 'warning' as const,
    timestamp: new Date(),
  },
];

const mockQuickActions = [
  {
    id: 'start',
    label: 'Start Mission',
    icon: <span>Start</span>,
    action: jest.fn(),
  },
  {
    id: 'stop',
    label: 'Emergency Stop',
    icon: <span>Stop</span>,
    action: jest.fn(),
    disabled: true,
  },
];

// Wrapper component with theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider themeName="default">
    {children}
  </ThemeProvider>
);

describe('TelemetrySidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('Basic Rendering', () => {
    it('renders the sidebar in expanded state by default', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar />
        </TestWrapper>
      );

      expect(screen.getByRole('complementary')).toBeInTheDocument();
      expect(screen.getByText('Telemetry')).toBeVisible();
      expect(screen.getByText('System Status')).toBeVisible();
      expect(screen.getByText('Telemetry Data')).toBeVisible();
      expect(screen.getByText('Settings')).toBeVisible();
    });

    it('renders with custom test ID', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar testId="custom-sidebar" />
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-sidebar')).toBeInTheDocument();
    });

    it('renders system status items', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar systemStatus={mockSystemStatus} />
        </TestWrapper>
      );

      expect(screen.getByText('Power Systems')).toBeInTheDocument();
      expect(screen.getByText('Battery: 87%, Solar: Active')).toBeInTheDocument();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('GPS accuracy reduced')).toBeInTheDocument();
    });

    it('renders telemetry data', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar telemetryData={mockTelemetryData} />
        </TestWrapper>
      );

      expect(screen.getByText('Temperature')).toBeInTheDocument();
      expect(screen.getByText('23.5')).toBeInTheDocument();
      expect(screen.getByText('°C')).toBeInTheDocument();
      expect(screen.getByText('Battery')).toBeInTheDocument();
      expect(screen.getByText('87')).toBeInTheDocument();
      expect(screen.getByText('%')).toBeInTheDocument();
    });

    it('renders quick actions', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar quickActions={mockQuickActions} />
        </TestWrapper>
      );

      expect(screen.getByText('Start Mission')).toBeInTheDocument();
      expect(screen.getByText('Emergency Stop')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start mission/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /emergency stop/i })).toBeDisabled();
    });
  });

  describe('Collapse/Expand Functionality', () => {
    it('starts collapsed when defaultCollapsed is true', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar defaultCollapsed={true} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggles collapse state when collapse button is clicked', async () => {
      const user = userEvent.setup();
      const onCollapseChange = jest.fn();

      render(
        <TestWrapper>
          <TelemetrySidebar onCollapseChange={onCollapseChange} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      
      await user.click(collapseButton);
      
      expect(onCollapseChange).toHaveBeenCalledWith(true);
      
      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows expand button when collapsed', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TelemetrySidebar defaultCollapsed={true} />
        </TestWrapper>
      );

      const expandButton = screen.getByRole('button', { name: /expand telemetry sidebar/i });
      expect(expandButton).toBeInTheDocument();
      
      await user.click(expandButton);
      
      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      expect(collapseButton).toBeInTheDocument();
    });

    it('hides text content when collapsed', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar 
            defaultCollapsed={true} 
            systemStatus={mockSystemStatus}
            telemetryData={mockTelemetryData}
          />
        </TestWrapper>
      );

      // Title should not be visible when collapsed
      expect(screen.queryByText('Telemetry')).not.toBeInTheDocument();
      
      // Section headers should not be visible when collapsed
      expect(screen.queryByText('System Status')).not.toBeInTheDocument();
      expect(screen.queryByText('Telemetry Data')).not.toBeInTheDocument();
    });
  });

  describe('State Persistence', () => {
    it('loads initial state from localStorage when persistState is true', () => {
      mockLocalStorage.getItem.mockReturnValue('true');

      render(
        <TestWrapper>
          <TelemetrySidebar persistState={true} />
        </TestWrapper>
      );

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('rover-telemetry-sidebar-collapsed');
      
      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    });

    it('saves state to localStorage when persistState is true', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TelemetrySidebar persistState={true} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      await user.click(collapseButton);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('rover-telemetry-sidebar-collapsed', 'true');
    });

    it('does not use localStorage when persistState is false', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TelemetrySidebar persistState={false} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      await user.click(collapseButton);

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        render(
          <TestWrapper>
            <TelemetrySidebar persistState={true} />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Badge Indicators', () => {
    it('shows total alerts badge in header', () => {
      const statusWithAlerts = [
        { id: '1', system: 'System 1', status: 'warning' as const, alerts: 2 },
        { id: '2', system: 'System 2', status: 'critical' as const, alerts: 3 },
      ];

      render(
        <TestWrapper>
          <TelemetrySidebar systemStatus={statusWithAlerts} />
        </TestWrapper>
      );

      expect(screen.getByTestId('telemetry-sidebar-alerts-badge')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // 2 + 3 alerts
    });

    it('shows individual system alert badges', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar systemStatus={mockSystemStatus} />
        </TestWrapper>
      );

      // Only navigation system has alerts in mock data
      const alertBadges = screen.getAllByText('1');
      expect(alertBadges.length).toBeGreaterThan(0);
    });

    it('does not show badges when no alerts', () => {
      const statusWithoutAlerts = [
        { id: '1', system: 'System 1', status: 'online' as const },
      ];

      render(
        <TestWrapper>
          <TelemetrySidebar systemStatus={statusWithoutAlerts} />
        </TestWrapper>
      );

      expect(screen.queryByTestId('telemetry-sidebar-alerts-badge')).not.toBeInTheDocument();
    });
  });

  describe('Quick Actions', () => {
    it('executes action when button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TelemetrySidebar quickActions={mockQuickActions} />
        </TestWrapper>
      );

      const startButton = screen.getByRole('button', { name: /start mission/i });
      await user.click(startButton);

      expect(mockQuickActions[0].action).toHaveBeenCalled();
    });

    it('does not execute action for disabled buttons', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TelemetrySidebar quickActions={mockQuickActions} />
        </TestWrapper>
      );

      const stopButton = screen.getByRole('button', { name: /emergency stop/i });
      expect(stopButton).toBeDisabled();
      
      await user.click(stopButton);
      expect(mockQuickActions[1].action).not.toHaveBeenCalled();
    });

    it('shows tooltips for actions when collapsed', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar 
            defaultCollapsed={true} 
            quickActions={mockQuickActions} 
          />
        </TestWrapper>
      );

      const startButton = screen.getByRole('button', { name: /start mission/i });
      expect(startButton).toHaveAttribute('title', 'Start Mission');
    });
  });

  describe('Keyboard Navigation', () => {
    it('toggles collapse on Enter key', async () => {
      const user = userEvent.setup();
      const onCollapseChange = jest.fn();

      render(
        <TestWrapper>
          <TelemetrySidebar onCollapseChange={onCollapseChange} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      collapseButton.focus();
      
      await user.keyboard('{Enter}');
      
      expect(onCollapseChange).toHaveBeenCalledWith(true);
    });

    it('toggles collapse on Space key', async () => {
      const user = userEvent.setup();
      const onCollapseChange = jest.fn();

      render(
        <TestWrapper>
          <TelemetrySidebar onCollapseChange={onCollapseChange} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      collapseButton.focus();
      
      await user.keyboard(' ');
      
      expect(onCollapseChange).toHaveBeenCalledWith(true);
    });

    it('handles Escape key when expanded', async () => {
      const user = userEvent.setup();
      const onCollapseChange = jest.fn();

      render(
        <TestWrapper>
          <TelemetrySidebar onCollapseChange={onCollapseChange} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      
      // Focus the sidebar and press Escape
      act(() => {
        sidebar.focus();
      });
      
      await user.keyboard('{Escape}');
      
      expect(onCollapseChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveAttribute('aria-label', 'Telemetry sidebar');
      expect(sidebar).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper button labels', () => {
      render(
        <TestWrapper>
          <TelemetrySidebar />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /collapse telemetry sidebar/i })).toBeInTheDocument();
    });

    it('properly manages focus', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <TelemetrySidebar quickActions={mockQuickActions} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse telemetry sidebar/i });
      const startButton = screen.getByRole('button', { name: /start mission/i });

      // Test tab navigation
      await user.tab();
      expect(collapseButton).toHaveAttribute('tabindex', '0');
      
      await user.tab();
      expect(startButton).toHaveFocus();
    });
  });

  describe('Responsive Behavior', () => {
    it('applies custom dimensions', () => {
      const { container } = render(
        <TestWrapper>
          <TelemetrySidebar 
            expandedWidth={400}
            collapsedWidth={80}
          />
        </TestWrapper>
      );

      const sidebar = container.querySelector('[data-testid="telemetry-sidebar"]');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles missing data gracefully', () => {
      expect(() => {
        render(
          <TestWrapper>
            <TelemetrySidebar 
              systemStatus={[]}
              telemetryData={[]}
              quickActions={[]}
            />
          </TestWrapper>
        );
      }).not.toThrow();
    });

    it('handles null/undefined props gracefully', () => {
      expect(() => {
        render(
          <TestWrapper>
            <TelemetrySidebar 
              systemStatus={undefined}
              telemetryData={undefined}
              quickActions={undefined}
            />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });
});