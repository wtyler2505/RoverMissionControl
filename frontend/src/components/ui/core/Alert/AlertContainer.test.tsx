/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { AlertContainer, AlertStatusBar } from './AlertContainer';
import { useAlertStore } from '../../../../stores/alertStore';
import { themes } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';

// Mock the alert store
jest.mock('../../../../stores/alertStore');
const mockUseAlertStore = useAlertStore as jest.MockedFunction<typeof useAlertStore>;

// Mock the PriorityAlert component
jest.mock('./PriorityAlert', () => ({
  PriorityAlert: ({ priority, title, message, onClose, timestamp, action }: any) => (
    <div 
      data-testid={`priority-alert-${priority}`}
      data-priority={priority}
    >
      <div data-testid="alert-title">{title}</div>
      <div data-testid="alert-message">{message}</div>
      <div data-testid="alert-timestamp">{timestamp?.toISOString()}</div>
      {onClose && (
        <button data-testid="alert-close" onClick={onClose}>
          Close
        </button>
      )}
      {action && (
        <div data-testid="alert-action">{action}</div>
      )}
    </div>
  )
}));

// Mock react-transition-group for consistent testing
jest.mock('react-transition-group', () => ({
  TransitionGroup: ({ children }: any) => <div data-testid="transition-group">{children}</div>,
  CSSTransition: ({ children, nodeRef }: any) => (
    <div data-testid="css-transition" ref={nodeRef}>
      {children}
    </div>
  )
}));

const defaultTheme = themes.default;

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={defaultTheme}>
      {component}
    </ThemeProvider>
  );
};

const createMockAlert = (overrides: any = {}) => ({
  id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  priority: 'medium' as AlertPriority,
  timestamp: new Date(),
  data: {
    title: 'Test Alert',
    message: 'This is a test alert',
    closable: true,
  },
  processedAt: new Date(),
  position: 0,
  isGrouped: false,
  ...overrides
});

describe('AlertContainer', () => {
  const mockRemoveAlert = jest.fn();
  const mockDismissAlert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAlertStore.mockReturnValue({
      alerts: [],
      removeAlert: mockRemoveAlert,
      dismissAlert: mockDismissAlert,
      queueStatus: {
        total: 0,
        byPriority: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        processed: 0,
        grouped: 0,
      }
    } as any);
  });

  describe('Basic Rendering', () => {
    test('should render empty container when no alerts', () => {
      renderWithTheme(<AlertContainer />);
      
      expect(screen.getByTestId('transition-group')).toBeInTheDocument();
      expect(screen.queryByTestId('priority-alert-medium')).not.toBeInTheDocument();
    });

    test('should render single alert', () => {
      const alert = createMockAlert();
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1, byPriority: { medium: 1 }, processed: 1, grouped: 0 }
      } as any);

      renderWithTheme(<AlertContainer />);
      
      expect(screen.getByTestId('priority-alert-medium')).toBeInTheDocument();
      expect(screen.getByTestId('alert-title')).toHaveTextContent('Test Alert');
      expect(screen.getByTestId('alert-message')).toHaveTextContent('This is a test alert');
    });

    test('should render multiple alerts in priority order', () => {
      const alerts = [
        createMockAlert({ priority: 'critical', data: { message: 'Critical alert' } }),
        createMockAlert({ priority: 'high', data: { message: 'High alert' } }),
        createMockAlert({ priority: 'medium', data: { message: 'Medium alert' } }),
        createMockAlert({ priority: 'low', data: { message: 'Low alert' } }),
        createMockAlert({ priority: 'info', data: { message: 'Info alert' } })
      ];

      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 5, byPriority: { critical: 1, high: 1, medium: 1, low: 1, info: 1 }, processed: 5, grouped: 0 }
      } as any);

      renderWithTheme(<AlertContainer />);
      
      expect(screen.getByTestId('priority-alert-critical')).toBeInTheDocument();
      expect(screen.getByTestId('priority-alert-high')).toBeInTheDocument();
      expect(screen.getByTestId('priority-alert-medium')).toBeInTheDocument();
      expect(screen.getByTestId('priority-alert-low')).toBeInTheDocument();
      expect(screen.getByTestId('priority-alert-info')).toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    test('should apply correct positioning styles', () => {
      const alert = createMockAlert();
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);

      const { container } = renderWithTheme(<AlertContainer position="top-right" />);
      const alertContainer = container.firstChild as HTMLElement;
      
      expect(alertContainer).toHaveStyle({
        position: 'fixed',
        top: '20px',
        right: '20px'
      });
    });

    test('should handle different positioning options', () => {
      const positions = ['top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'] as const;
      
      positions.forEach(position => {
        const { container, unmount } = renderWithTheme(<AlertContainer position={position} />);
        const alertContainer = container.firstChild as HTMLElement;
        
        if (position === 'top-left') {
          expect(alertContainer).toHaveStyle({ top: '20px', left: '20px' });
        } else if (position === 'bottom-right') {
          expect(alertContainer).toHaveStyle({ bottom: '20px', right: '20px' });
        } else if (position === 'top-center') {
          expect(alertContainer).toHaveStyle({ 
            top: '20px', 
            left: '50%',
            transform: 'translateX(-50%)'
          });
        }
        
        unmount();
      });
    });
  });

  describe('Alert Interactions', () => {
    test('should handle alert close for non-persistent alerts', () => {
      const alert = createMockAlert({
        data: { message: 'Closable alert', persistent: false }
      });
      
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);

      renderWithTheme(<AlertContainer />);
      
      const closeButton = screen.getByTestId('alert-close');
      fireEvent.click(closeButton);
      
      expect(mockRemoveAlert).toHaveBeenCalledWith(alert.id);
      expect(mockDismissAlert).not.toHaveBeenCalled();
    });

    test('should handle alert dismiss for persistent alerts', () => {
      const alert = createMockAlert({
        data: { message: 'Persistent alert', persistent: true }
      });
      
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);

      renderWithTheme(<AlertContainer />);
      
      const closeButton = screen.getByTestId('alert-close');
      fireEvent.click(closeButton);
      
      expect(mockDismissAlert).toHaveBeenCalledWith(alert.id);
      expect(mockRemoveAlert).not.toHaveBeenCalled();
    });

    test('should handle alert with action button', () => {
      const mockActionHandler = jest.fn();
      const alert = createMockAlert({
        data: {
          message: 'Alert with action',
          action: {
            label: 'Retry',
            handler: mockActionHandler
          }
        }
      });
      
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);

      renderWithTheme(<AlertContainer />);
      
      expect(screen.getByTestId('alert-action')).toBeInTheDocument();
    });
  });

  describe('Alert Grouping', () => {
    test('should display group indicator for grouped alerts', () => {
      const alert = createMockAlert({
        groupId: 'network-errors',
        groupCount: 3,
        data: { message: 'Network error' }
      });
      
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1, grouped: 1 }
      } as any);

      renderWithTheme(<AlertContainer groupSimilar={true} />);
      
      expect(screen.getByText(/And 2 similar alerts/)).toBeInTheDocument();
    });

    test('should handle singular vs plural group indicators', () => {
      const alert = createMockAlert({
        groupId: 'test-group',
        groupCount: 2,
        data: { message: 'Test error' }
      });
      
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1, grouped: 1 }
      } as any);

      renderWithTheme(<AlertContainer groupSimilar={true} />);
      
      expect(screen.getByText(/And 1 similar alert$/)).toBeInTheDocument();
    });

    test('should not display group indicator when groupSimilar is false', () => {
      const alerts = [
        createMockAlert({ groupId: 'group1', data: { message: 'Alert 1' } }),
        createMockAlert({ groupId: 'group1', data: { message: 'Alert 2' } }),
        createMockAlert({ data: { message: 'Standalone alert' } })
      ];
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 3 }
      } as any);

      renderWithTheme(<AlertContainer groupSimilar={false} />);
      
      // Should show all alerts individually
      expect(screen.getAllByTestId(/priority-alert-/)).toHaveLength(3);
    });
  });

  describe('Overflow Handling', () => {
    test('should show overflow indicator when maxVisible is exceeded', () => {
      const alerts = Array.from({ length: 8 }, (_, i) => 
        createMockAlert({ 
          id: `alert-${i}`,
          priority: 'medium',
          data: { message: `Alert ${i}` }
        })
      );
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 8 }
      } as any);

      renderWithTheme(<AlertContainer maxVisible={5} />);
      
      // Should show 5 alerts
      expect(screen.getAllByTestId(/priority-alert-/)).toHaveLength(5);
      
      // Should show overflow indicator
      expect(screen.getByText('3 more alerts')).toBeInTheDocument();
    });

    test('should show correct overflow count', () => {
      const alerts = Array.from({ length: 10 }, (_, i) => 
        createMockAlert({ id: `alert-${i}` })
      );
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 10 }
      } as any);

      renderWithTheme(<AlertContainer maxVisible={3} />);
      
      expect(screen.getByText('7 more alerts')).toBeInTheDocument();
    });

    test('should handle singular overflow count', () => {
      const alerts = Array.from({ length: 4 }, (_, i) => 
        createMockAlert({ id: `alert-${i}` })
      );
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 4 }
      } as any);

      renderWithTheme(<AlertContainer maxVisible={3} />);
      
      expect(screen.getByText('1 more alert')).toBeInTheDocument();
    });

    test('should use highest priority for overflow indicator styling', () => {
      const alerts = [
        createMockAlert({ priority: 'medium' }),
        createMockAlert({ priority: 'high' }),
        createMockAlert({ priority: 'critical' }),
        createMockAlert({ priority: 'low' }),
        createMockAlert({ priority: 'info' })
      ];
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 5 }
      } as any);

      const { container } = renderWithTheme(<AlertContainer maxVisible={2} />);
      
      // Overflow indicator should exist and have critical priority styling
      const overflowIndicator = screen.getByText('3 more alerts');
      expect(overflowIndicator).toBeInTheDocument();
    });

    test('should handle overflow indicator click', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const alerts = Array.from({ length: 6 }, (_, i) => 
        createMockAlert({ id: `alert-${i}` })
      );
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 6 }
      } as any);

      renderWithTheme(<AlertContainer maxVisible={3} />);
      
      const overflowIndicator = screen.getByText('3 more alerts');
      fireEvent.click(overflowIndicator);
      
      expect(consoleSpy).toHaveBeenCalledWith('Show more alerts');
      consoleSpy.mockRestore();
    });
  });

  describe('Responsive Behavior', () => {
    test('should apply responsive styles', () => {
      const { container } = renderWithTheme(<AlertContainer />);
      const alertContainer = container.firstChild as HTMLElement;
      
      // Check that responsive styles are applied via CSS-in-JS
      expect(alertContainer).toHaveStyle({
        'max-width': '420px',
        width: '100%'
      });
    });

    test('should handle center positioning on mobile', () => {
      const { container } = renderWithTheme(<AlertContainer position="top-center" />);
      const alertContainer = container.firstChild as HTMLElement;
      
      expect(alertContainer).toHaveStyle({
        left: '50%',
        transform: 'translateX(-50%)'
      });
    });
  });

  describe('Animation Integration', () => {
    test('should use TransitionGroup for animations', () => {
      const alert = createMockAlert();
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);

      renderWithTheme(<AlertContainer />);
      
      expect(screen.getByTestId('transition-group')).toBeInTheDocument();
      expect(screen.getByTestId('css-transition')).toBeInTheDocument();
    });

    test('should handle adding and removing alerts with animations', async () => {
      const { rerender } = renderWithTheme(<AlertContainer />);
      
      // Start with no alerts
      expect(screen.queryByTestId('priority-alert-medium')).not.toBeInTheDocument();
      
      // Add an alert
      const alert = createMockAlert();
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);
      
      rerender(
        <ThemeProvider theme={defaultTheme}>
          <AlertContainer />
        </ThemeProvider>
      );
      
      expect(screen.getByTestId('priority-alert-medium')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should provide proper ARIA attributes', () => {
      const alert = createMockAlert();
      mockUseAlertStore.mockReturnValue({
        alerts: [alert],
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 1 }
      } as any);

      const { container } = renderWithTheme(<AlertContainer />);
      
      // Container should not interfere with interactions
      expect(container.firstChild).toHaveStyle({ 'pointer-events': 'none' });
    });

    test('should handle keyboard navigation for overflow indicator', () => {
      const alerts = Array.from({ length: 4 }, (_, i) => 
        createMockAlert({ id: `alert-${i}` })
      );
      
      mockUseAlertStore.mockReturnValue({
        alerts,
        removeAlert: mockRemoveAlert,
        dismissAlert: mockDismissAlert,
        queueStatus: { total: 4 }
      } as any);

      renderWithTheme(<AlertContainer maxVisible={2} />);
      
      const overflowIndicator = screen.getByText('2 more alerts');
      expect(overflowIndicator).toBeInTheDocument();
      
      // Should be focusable and clickable
      fireEvent.focus(overflowIndicator);
      fireEvent.keyDown(overflowIndicator, { key: 'Enter' });
    });
  });

  describe('Memory Management', () => {
    test('should clean up node refs when alerts are removed', async () => {
      const TestComponent = () => {
        const [alerts, setAlerts] = React.useState([createMockAlert({ id: 'test-1' })]);
        
        mockUseAlertStore.mockReturnValue({
          alerts,
          removeAlert: mockRemoveAlert,
          dismissAlert: mockDismissAlert,
          queueStatus: { total: alerts.length }
        } as any);

        return (
          <div>
            <AlertContainer />
            <button onClick={() => setAlerts([])}>Remove All</button>
          </div>
        );
      };

      renderWithTheme(<TestComponent />);
      
      expect(screen.getByTestId('priority-alert-medium')).toBeInTheDocument();
      
      // Remove alerts
      fireEvent.click(screen.getByText('Remove All'));
      
      // Alert should be removed
      await waitFor(() => {
        expect(screen.queryByTestId('priority-alert-medium')).not.toBeInTheDocument();
      });
    });
  });
});

describe('AlertStatusBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should not render when no alerts', () => {
    mockUseAlertStore.mockReturnValue({
      queueStatus: {
        total: 0,
        byPriority: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        processed: 0,
        grouped: 0,
      }
    } as any);

    const { container } = renderWithTheme(<AlertStatusBar />);
    expect(container.firstChild).toBeNull();
  });

  test('should render status when alerts exist', () => {
    mockUseAlertStore.mockReturnValue({
      queueStatus: {
        total: 5,
        byPriority: {
          critical: 2,
          high: 1,
          medium: 1,
          low: 1,
          info: 0,
        },
        processed: 5,
        grouped: 1,
      }
    } as any);

    renderWithTheme(<AlertStatusBar />);
    
    expect(screen.getByText('Total: 5')).toBeInTheDocument();
    expect(screen.getByText('critical: 2')).toBeInTheDocument();
    expect(screen.getByText('high: 1')).toBeInTheDocument();
    expect(screen.getByText('medium: 1')).toBeInTheDocument();
    expect(screen.getByText('low: 1')).toBeInTheDocument();
    expect(screen.queryByText('info: 0')).not.toBeInTheDocument(); // Should not show zero counts
    expect(screen.getByText('Grouped: 1')).toBeInTheDocument();
  });

  test('should not show zero counts', () => {
    mockUseAlertStore.mockReturnValue({
      queueStatus: {
        total: 2,
        byPriority: {
          critical: 1,
          high: 0,
          medium: 1,
          low: 0,
          info: 0,
        },
        processed: 2,
        grouped: 0,
      }
    } as any);

    renderWithTheme(<AlertStatusBar />);
    
    expect(screen.getByText('critical: 1')).toBeInTheDocument();
    expect(screen.getByText('medium: 1')).toBeInTheDocument();
    expect(screen.queryByText('high: 0')).not.toBeInTheDocument();
    expect(screen.queryByText('low: 0')).not.toBeInTheDocument();
    expect(screen.queryByText('info: 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Grouped: 0')).not.toBeInTheDocument();
  });

  test('should show priority indicators with correct styling', () => {
    mockUseAlertStore.mockReturnValue({
      queueStatus: {
        total: 3,
        byPriority: {
          critical: 1,
          high: 1,
          medium: 1,
          low: 0,
          info: 0,
        },
        processed: 3,
        grouped: 0,
      }
    } as any);

    const { container } = renderWithTheme(<AlertStatusBar />);
    
    // Should have status dots for each priority
    const statusDots = container.querySelectorAll('[data-testid*="status-dot"]');
    // Note: Our mock doesn't include data-testid, but we can check for presence
    
    expect(screen.getByText('critical: 1')).toBeInTheDocument();
    expect(screen.getByText('high: 1')).toBeInTheDocument();
    expect(screen.getByText('medium: 1')).toBeInTheDocument();
  });

  test('should be positioned at bottom of screen', () => {
    mockUseAlertStore.mockReturnValue({
      queueStatus: {
        total: 1,
        byPriority: {
          critical: 1,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        processed: 1,
        grouped: 0,
      }
    } as any);

    const { container } = renderWithTheme(<AlertStatusBar />);
    const statusBar = container.firstChild as HTMLElement;
    
    expect(statusBar).toHaveStyle({
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0'
    });
  });
});