/**
 * Integration Tests for Alert Queuing System
 * Tests the full flow from alert creation to display
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { AlertContainer } from './AlertContainer';
import { useAlertStore, AlertData } from '../../../../stores/alertStore';
import { themes } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';

// Mock WebSocket for integration testing
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
};

(global as any).WebSocket = jest.fn(() => mockWebSocket);

// Mock the PriorityAlert component for integration testing
jest.mock('./PriorityAlert', () => ({
  PriorityAlert: ({ priority, title, message, onClose, timestamp, persistent, action }: any) => (
    <div 
      data-testid={`alert-${priority}`}
      data-priority={priority}
      data-persistent={persistent}
    >
      <h4 data-testid="alert-title">{title}</h4>
      <p data-testid="alert-message">{message}</p>
      <time data-testid="alert-timestamp">{timestamp?.toISOString()}</time>
      {onClose && (
        <button data-testid="close-button" onClick={onClose}>
          {persistent ? 'Dismiss' : 'Close'}
        </button>
      )}
      {action && (
        <button data-testid="action-button" onClick={action.props.onClick}>
          {action.props.children}
        </button>
      )}
    </div>
  )
}));

// Use fake timers for precise timing control
jest.useFakeTimers();

const TestApp: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={themes.default}>
    <div data-testid="test-app">
      {children || <AlertContainer />}
    </div>
  </ThemeProvider>
);

describe('Alert System Integration', () => {
  let addAlert: (alert: AlertData) => Promise<string>;
  let removeAlert: (id: string) => void;
  let dismissAlert: (id: string) => void;
  let clearAlerts: (priority?: AlertPriority) => void;

  beforeEach(() => {
    // Reset store state
    const store = useAlertStore.getState();
    store._queueManager?.clear();
    useAlertStore.setState({ 
      alerts: [], 
      dismissedAlerts: [],
      queueStatus: {
        total: 0,
        byPriority: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        processed: 0,
        grouped: 0,
      },
      _queueManager: null 
    });

    // Get fresh store methods
    addAlert = useAlertStore.getState().addAlert;
    removeAlert = useAlertStore.getState().removeAlert;
    dismissAlert = useAlertStore.getState().dismissAlert;
    clearAlerts = useAlertStore.getState().clearAlerts;

    jest.clearAllTimers();
  });

  describe('End-to-End Alert Flow', () => {
    test('should display critical alert immediately', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'critical',
          message: 'System failure detected',
          title: 'Critical Error',
          persistent: true
        });
      });

      // Critical alerts should appear immediately
      expect(screen.getByTestId('alert-critical')).toBeInTheDocument();
      expect(screen.getByTestId('alert-title')).toHaveTextContent('Critical Error');
      expect(screen.getByTestId('alert-message')).toHaveTextContent('System failure detected');
      expect(screen.getByTestId('close-button')).toHaveTextContent('Dismiss');
    });

    test('should handle high priority alert processing delay', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'high',
          message: 'High priority issue',
          title: 'Warning'
        });
      });

      // Should not be visible immediately due to 5-second processing delay
      expect(screen.queryByTestId('alert-high')).not.toBeInTheDocument();

      // Advance timers by 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Now should be visible
      await waitFor(() => {
        expect(screen.getByTestId('alert-high')).toBeInTheDocument();
      });
    });

    test('should handle medium priority alert processing delay', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'medium',
          message: 'Medium priority issue',
          title: 'Notice'
        });
      });

      // Should not be visible immediately
      expect(screen.queryByTestId('alert-medium')).not.toBeInTheDocument();

      // Advance timers by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Now should be visible
      await waitFor(() => {
        expect(screen.getByTestId('alert-medium')).toBeInTheDocument();
      });
    });

    test('should handle low and info priority alerts with 5-minute delay', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'low',
          message: 'Low priority info',
          title: 'Info'
        });
        
        await addAlert({
          priority: 'info',
          message: 'General information',
          title: 'Note'
        });
      });

      // Should not be visible immediately
      expect(screen.queryByTestId('alert-low')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-info')).not.toBeInTheDocument();

      // Advance timers by 5 minutes
      act(() => {
        jest.advanceTimersByTime(300000);
      });

      // Both should be visible now
      await waitFor(() => {
        expect(screen.getByTestId('alert-low')).toBeInTheDocument();
        expect(screen.getByTestId('alert-info')).toBeInTheDocument();
      });
    });
  });

  describe('Priority Ordering and Queue Management', () => {
    test('should display alerts in priority order', async () => {
      render(<TestApp />);

      // Add alerts in reverse priority order
      await act(async () => {
        await addAlert({ priority: 'info', message: 'Info alert' });
        await addAlert({ priority: 'critical', message: 'Critical alert' });
        await addAlert({ priority: 'medium', message: 'Medium alert' });
        await addAlert({ priority: 'high', message: 'High alert' });
        await addAlert({ priority: 'low', message: 'Low alert' });
      });

      // Process all alerts
      act(() => {
        jest.advanceTimersByTime(300000);
      });

      await waitFor(() => {
        const alerts = screen.getAllByTestId(/^alert-/);
        expect(alerts).toHaveLength(5);
      });

      // Check order by getting all alerts and their priorities
      const alertElements = screen.getAllByTestId(/^alert-/);
      const priorities = alertElements.map(el => el.getAttribute('data-priority'));
      
      expect(priorities).toEqual(['critical', 'high', 'medium', 'low', 'info']);
    });

    test('should handle mixed processing timing', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({ priority: 'medium', message: 'Medium first' }); // 30s
        await addAlert({ priority: 'critical', message: 'Critical second' }); // immediate
        await addAlert({ priority: 'high', message: 'High third' }); // 5s
      });

      // Critical should appear immediately
      expect(screen.getByTestId('alert-critical')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-high')).not.toBeInTheDocument();
      expect(screen.queryByTestId('alert-medium')).not.toBeInTheDocument();

      // After 5 seconds, high should appear
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('alert-high')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('alert-medium')).not.toBeInTheDocument();

      // After 30 seconds total, medium should appear
      act(() => {
        jest.advanceTimersByTime(25000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('alert-medium')).toBeInTheDocument();
      });

      // All should be in priority order
      const alertElements = screen.getAllByTestId(/^alert-/);
      const priorities = alertElements.map(el => el.getAttribute('data-priority'));
      expect(priorities).toEqual(['critical', 'high', 'medium']);
    });
  });

  describe('Alert Grouping Integration', () => {
    test('should group similar alerts correctly', async () => {
      render(<TestApp />);

      const groupId = 'network-errors';

      await act(async () => {
        await addAlert({
          priority: 'medium',
          message: 'Connection timeout',
          groupId
        });
        
        await addAlert({
          priority: 'medium',
          message: 'Network unreachable',
          groupId
        });
        
        await addAlert({
          priority: 'medium',
          message: 'DNS resolution failed',
          groupId
        });
      });

      // Process the alerts
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        // Should only show one alert (the group representative)
        const alerts = screen.getAllByTestId(/^alert-/);
        expect(alerts).toHaveLength(1);
      });

      // Should show group indicator
      expect(screen.getByText(/And 2 similar alerts/)).toBeInTheDocument();
    });

    test('should handle mixed grouped and ungrouped alerts', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'critical',
          message: 'Standalone critical alert'
        });
        
        await addAlert({
          priority: 'medium',
          message: 'Grouped alert 1',
          groupId: 'test-group'
        });
        
        await addAlert({
          priority: 'medium',
          message: 'Grouped alert 2',
          groupId: 'test-group'
        });
        
        await addAlert({
          priority: 'high',
          message: 'Another standalone alert'
        });
      });

      // Process all alerts
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        const alerts = screen.getAllByTestId(/^alert-/);
        expect(alerts).toHaveLength(3); // critical + high + grouped medium
      });

      // Check for group indicator
      expect(screen.getByText(/And 1 similar alert/)).toBeInTheDocument();
    });
  });

  describe('Alert Actions and Interactions', () => {
    test('should handle alert actions properly', async () => {
      const mockActionHandler = jest.fn();
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'critical',
          message: 'Action required',
          title: 'System Error',
          action: {
            label: 'Retry Connection',
            handler: mockActionHandler
          }
        });
      });

      const actionButton = screen.getByTestId('action-button');
      expect(actionButton).toHaveTextContent('Retry Connection');

      fireEvent.click(actionButton);
      expect(mockActionHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle persistent alert dismissal', async () => {
      render(<TestApp />);

      let alertId: string;
      await act(async () => {
        alertId = await addAlert({
          priority: 'critical',
          message: 'Persistent alert',
          persistent: true
        });
      });

      const alert = screen.getByTestId('alert-critical');
      expect(alert).toHaveAttribute('data-persistent', 'true');

      const dismissButton = screen.getByTestId('close-button');
      expect(dismissButton).toHaveTextContent('Dismiss');

      fireEvent.click(dismissButton);

      // Alert should be dismissed (hidden but not removed from queue)
      await waitFor(() => {
        expect(screen.queryByTestId('alert-critical')).not.toBeInTheDocument();
      });

      // Check that it was dismissed, not removed
      const store = useAlertStore.getState();
      expect(store.dismissedAlerts).toContain(alertId!);
    });

    test('should handle non-persistent alert removal', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'medium',
          message: 'Non-persistent alert',
          persistent: false
        });
      });

      // Process the alert
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('alert-medium')).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId('close-button');
      expect(closeButton).toHaveTextContent('Close');

      fireEvent.click(closeButton);

      // Alert should be completely removed
      await waitFor(() => {
        expect(screen.queryByTestId('alert-medium')).not.toBeInTheDocument();
      });
    });
  });

  describe('Overflow and Limits Integration', () => {
    test('should handle maxVisible overflow correctly', async () => {
      render(<TestApp><AlertContainer maxVisible={3} /></TestApp>);

      // Add more alerts than maxVisible
      await act(async () => {
        for (let i = 0; i < 6; i++) {
          await addAlert({
            priority: 'critical',
            message: `Alert ${i + 1}`,
            title: `Critical ${i + 1}`
          });
        }
      });

      // Should show only 3 alerts
      await waitFor(() => {
        const alerts = screen.getAllByTestId(/^alert-/);
        expect(alerts).toHaveLength(3);
      });

      // Should show overflow indicator
      expect(screen.getByText('3 more alerts')).toBeInTheDocument();
    });

    test('should update overflow count dynamically', async () => {
      render(<TestApp><AlertContainer maxVisible={2} /></TestApp>);

      // Start with 4 alerts
      await act(async () => {
        for (let i = 0; i < 4; i++) {
          await addAlert({
            priority: 'critical',
            message: `Alert ${i + 1}`
          });
        }
      });

      expect(screen.getByText('2 more alerts')).toBeInTheDocument();

      // Add one more
      await act(async () => {
        await addAlert({
          priority: 'critical',
          message: 'Alert 5'
        });
      });

      expect(screen.getByText('3 more alerts')).toBeInTheDocument();

      // Remove one by clicking close
      const closeButton = screen.getAllByTestId('close-button')[0];
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.getByText('2 more alerts')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates Integration', () => {
    test('should handle rapid alert additions', async () => {
      render(<TestApp />);

      // Rapidly add multiple alerts
      await act(async () => {
        const promises = Array.from({ length: 10 }, (_, i) =>
          addAlert({
            priority: 'critical',
            message: `Rapid alert ${i + 1}`,
            title: `Critical ${i + 1}`
          })
        );
        await Promise.all(promises);
      });

      // All critical alerts should appear immediately
      await waitFor(() => {
        const alerts = screen.getAllByTestId('alert-critical');
        expect(alerts).toHaveLength(10);
      });
    });

    test('should handle mixed priority rapid additions', async () => {
      render(<TestApp />);

      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];

      await act(async () => {
        const promises = Array.from({ length: 20 }, (_, i) =>
          addAlert({
            priority: priorities[i % priorities.length],
            message: `Mixed alert ${i + 1}`,
            title: `Alert ${i + 1}`
          })
        );
        await Promise.all(promises);
      });

      // Only critical alerts should be visible immediately
      expect(screen.getAllByTestId('alert-critical')).toHaveLength(4);
      expect(screen.queryByTestId('alert-high')).not.toBeInTheDocument();

      // Process all alerts
      act(() => {
        jest.advanceTimersByTime(300000);
      });

      await waitFor(() => {
        const allAlerts = screen.getAllByTestId(/^alert-/);
        expect(allAlerts).toHaveLength(20);
      });

      // Check priority ordering
      const alertElements = screen.getAllByTestId(/^alert-/);
      const priorities = alertElements.map(el => el.getAttribute('data-priority'));
      
      // Should be ordered: all criticals, then all highs, then all mediums, etc.
      const criticalCount = priorities.filter(p => p === 'critical').length;
      const highCount = priorities.filter(p => p === 'high').length;
      const mediumCount = priorities.filter(p => p === 'medium').length;
      
      expect(criticalCount).toBe(4);
      expect(highCount).toBe(4);
      expect(mediumCount).toBe(4);
      
      // First 4 should be critical
      expect(priorities.slice(0, 4)).toEqual(['critical', 'critical', 'critical', 'critical']);
    });
  });

  describe('State Persistence Integration', () => {
    test('should maintain state across component remounts', async () => {
      const { rerender } = render(<TestApp />);

      // Add alerts
      await act(async () => {
        await addAlert({ priority: 'critical', message: 'Persistent critical' });
        await addAlert({ priority: 'high', message: 'Persistent high' });
      });

      // Advance time to process high priority
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('alert-critical')).toBeInTheDocument();
        expect(screen.getByTestId('alert-high')).toBeInTheDocument();
      });

      // Remount component
      rerender(<TestApp />);

      // Alerts should still be there
      expect(screen.getByTestId('alert-critical')).toBeInTheDocument();
      expect(screen.getByTestId('alert-high')).toBeInTheDocument();
    });

    test('should remember dismissed alerts across remounts', async () => {
      const { rerender } = render(<TestApp />);

      let alertId: string;
      await act(async () => {
        alertId = await addAlert({
          priority: 'critical',
          message: 'To be dismissed',
          persistent: true
        });
      });

      // Dismiss the alert
      const dismissButton = screen.getByTestId('close-button');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByTestId('alert-critical')).not.toBeInTheDocument();
      });

      // Remount component
      rerender(<TestApp />);

      // Alert should remain dismissed
      expect(screen.queryByTestId('alert-critical')).not.toBeInTheDocument();
      
      // Check store state
      const store = useAlertStore.getState();
      expect(store.dismissedAlerts).toContain(alertId!);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle processing errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      render(<TestApp />);

      // Add alert that might cause processing issues
      await act(async () => {
        await addAlert({
          priority: 'critical',
          message: 'Error-prone alert',
          action: {
            label: 'Broken Action',
            handler: () => {
              throw new Error('Action failed');
            }
          }
        });
      });

      const alert = screen.getByTestId('alert-critical');
      expect(alert).toBeInTheDocument();

      // Action should still be clickable despite potential errors
      const actionButton = screen.getByTestId('action-button');
      fireEvent.click(actionButton);

      // Alert should still be manageable
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('alert-critical')).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    test('should handle empty or invalid alert data', async () => {
      render(<TestApp />);

      await act(async () => {
        await addAlert({
          priority: 'medium',
          message: '', // Empty message
          title: undefined // Undefined title
        });
      });

      // Process the alert
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        const alert = screen.getByTestId('alert-medium');
        expect(alert).toBeInTheDocument();
        
        // Should handle empty/undefined values gracefully
        expect(screen.getByTestId('alert-message')).toHaveTextContent('');
      });
    });

    test('should handle queue overflow gracefully', async () => {
      render(<TestApp />);

      // Add a large number of alerts
      await act(async () => {
        const promises = Array.from({ length: 150 }, (_, i) =>
          addAlert({
            priority: 'medium',
            message: `Overflow test ${i + 1}`
          })
        );
        await Promise.all(promises);
      });

      // System should remain stable despite overflow
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        // Should show some alerts (depends on overflow strategy)
        const alerts = screen.getAllByTestId(/^alert-/);
        expect(alerts.length).toBeGreaterThan(0);
      });

      // UI should remain responsive
      const firstAlert = screen.getAllByTestId(/^alert-/)[0];
      expect(firstAlert).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    test('should handle high-frequency updates efficiently', async () => {
      render(<TestApp />);

      const startTime = performance.now();

      // Rapidly add and process many alerts
      await act(async () => {
        for (let i = 0; i < 50; i++) {
          await addAlert({
            priority: 'critical',
            message: `Performance test ${i}`
          });
        }
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second

      // All should be visible (critical priority)
      await waitFor(() => {
        const alerts = screen.getAllByTestId('alert-critical');
        expect(alerts).toHaveLength(50);
      });
    });

    test('should handle large number of simultaneous timer operations', async () => {
      render(<TestApp />);

      // Add alerts with different processing delays
      await act(async () => {
        // Mix of priorities to create multiple timers
        for (let i = 0; i < 20; i++) {
          const priorities: AlertPriority[] = ['high', 'medium', 'low'];
          await addAlert({
            priority: priorities[i % 3],
            message: `Timer test ${i}`
          });
        }
      });

      // Process all alerts by advancing timers
      act(() => {
        jest.advanceTimersByTime(300000);
      });

      await waitFor(() => {
        const alerts = screen.getAllByTestId(/^alert-/);
        expect(alerts).toHaveLength(20);
      });

      // System should remain stable with many simultaneous timers
      expect(screen.getAllByTestId('alert-high')).toHaveLength(7);
      expect(screen.getAllByTestId('alert-medium')).toHaveLength(7);
      expect(screen.getAllByTestId('alert-low')).toHaveLength(6);
    });
  });
});