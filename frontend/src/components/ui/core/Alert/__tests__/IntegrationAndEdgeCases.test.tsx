/**
 * Comprehensive Tests for Integration with Existing Alert Components and Edge Cases
 * Tests component integration, error scenarios, edge cases, and system resilience
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { themes } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { 
  EnhancedAlertGroupingManager, 
  DismissalType,
  AlertGroup 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import { useAlertStore } from '../../../../../stores/alertStore';
import { EnhancedAlertContainer } from '../EnhancedAlertContainer';
import { PriorityAlert } from '../PriorityAlert';
import { AlertDismissalControls } from '../components/AlertDismissalControls';
import BulkDismissalManager from '../components/BulkDismissalManager';
import AlertUndoManager from '../components/AlertUndoManager';

// Mock WebSocket for integration testing
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
};

(global as any).WebSocket = jest.fn(() => mockWebSocket);

// Mock performance APIs
global.performance.mark = jest.fn();
global.performance.measure = jest.fn();
global.performance.getEntriesByType = jest.fn().mockReturnValue([]);

// Mock console methods to test error handling
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Setup fake timers
jest.useFakeTimers();

interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ children }) => (
  <ThemeProvider theme={themes.default}>
    <div data-testid="test-wrapper">
      {children}
    </div>
  </ThemeProvider>
);

// Helper to create mock alerts
const createMockAlert = (
  id: string,
  priority: AlertPriority,
  message: string,
  options?: {
    title?: string;
    persistent?: boolean;
    metadata?: Record<string, any>; 
    data?: Record<string, any>;
  }
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: new Date(),
  processAfter: new Date(),
  metadata: { 
    source: 'test',
    ...options?.metadata 
  },
  data: {
    message,
    title: options?.title || `Alert ${id}`,
    persistent: options?.persistent,
    closable: true,
    ...options?.data,
  },
});

describe('Integration with Existing Alert Components and Edge Cases', () => {
  let groupingManager: EnhancedAlertGroupingManager;
  let mockOnDismiss: jest.Mock;

  beforeEach(() => {
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    mockOnDismiss = jest.fn().mockResolvedValue(true);

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

    jest.clearAllMocks();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('Integration with Alert Store', () => {
    it('should integrate seamlessly with useAlertStore', async () => {
      const { addAlert, removeAlert } = useAlertStore.getState();

      render(
        <TestWrapper>
          <EnhancedAlertContainer
            enableBulkActions={true}
            enableUndo={true}
          />
        </TestWrapper>
      );

      // Add alert through store
      await act(async () => {
        await addAlert({
          priority: 'high',
          message: 'Store integration test',
          title: 'Integration Test',
        });
      });

      expect(screen.getByText('Store integration test')).toBeInTheDocument();

      // Dismiss through UI should update store
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText('Store integration test')).not.toBeInTheDocument();
      });
    });

    it('should handle store state changes reactively', async () => {
      const { addAlert, clearAlerts } = useAlertStore.getState();

      render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Add multiple alerts
      await act(async () => {
        await addAlert({ priority: 'critical', message: 'Alert 1' });
        await addAlert({ priority: 'high', message: 'Alert 2' });
        await addAlert({ priority: 'medium', message: 'Alert 3' });
      });

      expect(screen.getAllByRole('alert')).toHaveLength(3);

      // Clear all through store
      act(() => {
        clearAlerts();
      });

      await waitFor(() => {
        expect(screen.queryAllByRole('alert')).toHaveLength(0);
      });
    });

    it('should maintain store consistency during complex operations', async () => {
      const { addAlert } = useAlertStore.getState();

      render(
        <TestWrapper>
          <EnhancedAlertContainer
            enableBulkActions={true}
            maxVisible={2}
          />
        </TestWrapper>
      );

      // Add more alerts than maxVisible
      await act(async () => {
        for (let i = 1; i <= 5; i++) {
          await addAlert({
            priority: 'medium',
            message: `Alert ${i}`,
            groupId: 'test-group',
          });
        }
      });

      // Should show maxVisible alerts plus overflow indicator
      const visibleAlerts = screen.getAllByRole('alertdialog', { hidden: false });
      expect(visibleAlerts.length).toBeLessThanOrEqual(2);
      expect(screen.getByText(/more alerts/)).toBeInTheDocument();

      // Store should still contain all alerts
      const storeState = useAlertStore.getState();
      expect(storeState.alerts).toHaveLength(5);
    });
  });

  describe('Component Integration Scenarios', () => {
    it('should integrate PriorityAlert with AlertDismissalControls', async () => {
      const alert = createMockAlert('integration-1', 'critical', 'Integration test');

      render(
        <TestWrapper>
          <div>
            <PriorityAlert
              priority={alert.priority}
              message={alert.data?.message || ''}
              title={alert.data?.title}
              onClose={() => mockOnDismiss(alert.id)}
              persistent={true}
            />
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
            />
          </div>
        </TestWrapper>
      );

      // Both components should work together
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Requires Acknowledgment')).toBeInTheDocument();

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(alert.id);
    });

    it('should integrate with AlertUndoManager after dismissals', async () => {
      const alert = createMockAlert('undo-integration', 'medium', 'Undo integration test');

      render(
        <TestWrapper>
          <div>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
            />
            <AlertUndoManager
              groupingManager={groupingManager}
              position="top-left"
              onUndo={jest.fn()}
            />
          </div>
        </TestWrapper>
      );

      // Initially no undo available
      expect(screen.queryByText('Undo Available')).not.toBeInTheDocument();

      // Dismiss alert
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);

      // Add dismissal action to manager for undo
      await act(async () => {
        await groupingManager.dismissAlert(alert.id, 'manual', {
          reason: 'Test dismissal',
        });
      });

      // Should show undo option
      await waitFor(() => {
        expect(screen.getByText('Undo Available')).toBeInTheDocument();
      });
    });

    it('should integrate with BulkDismissalManager', async () => {
      const alerts = [
        createMockAlert('bulk-int-1', 'medium', 'Bulk integration 1'),
        createMockAlert('bulk-int-2', 'medium', 'Bulk integration 2'),
        createMockAlert('bulk-int-3', 'high', 'Bulk integration 3'),
      ];

      const { rerender } = render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={alerts}
            availableGroups={[]}
            onBulkDismiss={mockOnDismiss}
            onClose={() => {}}
          />
        </TestWrapper>
      );

      // Select some alerts
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]); // First alert
      await userEvent.click(checkboxes[2]); // Third alert

      // Should show selection count
      expect(screen.getByText(/2 alerts selected/)).toBeInTheDocument();

      // Perform bulk dismissal
      const dismissButton = screen.getByRole('button', { name: /dismiss selected/i });
      await userEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(
        expect.objectContaining({
          alertIds: expect.arrayContaining(['bulk-int-1', 'bulk-int-3']),
        }),
        'manual',
        expect.any(Object)
      );
    });

    it('should handle component mounting and unmounting gracefully', () => {
      const alert = createMockAlert('mount-test', 'high', 'Mount test');

      const { unmount, rerender } = render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();

      // Unmount and remount
      unmount();
      
      rerender(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should work correctly after remount
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle null or undefined alert data', () => {
      const malformedAlert = {
        id: 'malformed',
        priority: 'medium' as AlertPriority,
        queuedAt: new Date(),
        processAfter: new Date(),
        metadata: null,
        data: null,
      } as ProcessedAlert;

      expect(() => {
        render(
          <TestWrapper>
            <AlertDismissalControls
              alertId={malformedAlert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
            />
          </TestWrapper>
        );
      }).not.toThrow();

      // Should still render with fallback behavior
      expect(screen.getByTestId('dismissal-controls-container')).toBeInTheDocument();
    });

    it('should handle extremely long alert messages', () => {
      const longMessage = 'A'.repeat(10000); // 10KB message
      const alert = createMockAlert('long-message', 'high', longMessage);

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should handle without crashing
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      // Message should be truncated or scrollable
      const messageElement = screen.getByText(longMessage, { exact: false });
      expect(messageElement).toBeInTheDocument();
    });

    it('should handle rapid component state changes', async () => {
      const alert = createMockAlert('rapid-changes', 'medium', 'Rapid changes test');

      const { rerender } = render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
            disabled={false}
          />
        </TestWrapper>
      );

      // Rapidly change props
      for (let i = 0; i < 50; i++) {
        rerender(
          <TestWrapper>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
              disabled={i % 2 === 0}
              compact={i % 3 === 0}
            />
          </TestWrapper>
        );
      }

      // Should remain stable
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should handle memory constraints with large datasets', async () => {
      const largeAlertSet = Array.from({ length: 5000 }, (_, i) =>
        createMockAlert(`large-${i}`, 'info', `Large dataset alert ${i}`)
      );

      const startTime = performance.now();

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={largeAlertSet}
            availableGroups={[]}
            onBulkDismiss={mockOnDismiss}
            onClose={() => {}}
          />
        </TestWrapper>
      );

      const endTime = performance.now();

      // Should render efficiently
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds threshold

      // Should use virtualization or pagination
      const renderedItems = screen.getAllByTestId(/alert-item-/);
      expect(renderedItems.length).toBeLessThan(100); // Should not render all 5000
    });

    it('should handle circular references in alert data', () => {
      const circularData: any = { message: 'Circular test' };
      circularData.self = circularData; // Create circular reference

      const alert = createMockAlert('circular', 'medium', 'Circular test', {
        data: circularData,
      });

      expect(() => {
        render(
          <TestWrapper>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
            />
          </TestWrapper>
        );
      }).not.toThrow();
    });

    it('should handle invalid priority values', () => {
      const invalidAlert = createMockAlert('invalid-priority', 'invalid' as AlertPriority, 'Invalid priority test');

      expect(() => {
        render(
          <TestWrapper>
            <PriorityAlert
              priority={invalidAlert.priority}
              message={invalidAlert.data?.message || ''}
              onClose={mockOnDismiss}
            />
          </TestWrapper>
        );
      }).not.toThrow();

      // Should fall back to default priority
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should handle network interruptions during dismissal', async () => {
      const networkError = new Error('Network error');
      const failingDismiss = jest.fn().mockRejectedValue(networkError);
      const alert = createMockAlert('network-fail', 'medium', 'Network failure test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={failingDismiss}
          />
        </TestWrapper>
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await userEvent.click(dismissButton);

      await waitFor(() => {
        expect(failingDismiss).toHaveBeenCalled();
      });

      // Should show retry option
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

      // Should not crash the component
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should handle missing grouping manager gracefully', () => {
      const alert = createMockAlert('no-manager', 'high', 'No manager test');

      expect(() => {
        render(
          <TestWrapper>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={null as any}
              onDismiss={mockOnDismiss}
            />
          </TestWrapper>
        );
      }).not.toThrow();

      // Should show fallback UI
      expect(screen.getByText(/dismissal controls unavailable/i)).toBeInTheDocument();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle high-frequency timer events', () => {
      const alert = createMockAlert('timer-stress', 'low', 'Timer stress test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Rapidly advance timers
      for (let i = 0; i < 1000; i++) {
        act(() => {
          jest.advanceTimersByTime(10); // 10ms increments
        });
      }

      // Should remain stable
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should handle memory leaks in long-running scenarios', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and destroy many alert controls
      for (let i = 0; i < 100; i++) {
        const alert = createMockAlert(`memory-${i}`, 'info', `Memory test ${i}`);
        
        const { unmount } = render(
          <TestWrapper>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
            />
          </TestWrapper>
        );

        unmount();
      }

      // Memory usage should not grow excessively
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
      }
    });

    it('should handle concurrent async operations', async () => {
      const alerts = Array.from({ length: 10 }, (_, i) =>
        createMockAlert(`concurrent-${i}`, 'medium', `Concurrent test ${i}`)
      );

      const concurrentDismissals = alerts.map(async (alert) => {
        return groupingManager.dismissAlert(alert.id, 'manual', {
          reason: `Concurrent dismissal ${alert.id}`,
        });
      });

      // All should complete without interference
      await act(async () => {
        const results = await Promise.allSettled(concurrentDismissals);
        
        results.forEach((result, index) => {
          expect(result.status).toBe('fulfilled');
        });
      });
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle older browsers without modern APIs', () => {
      // Mock missing APIs
      const originalIntersectionObserver = global.IntersectionObserver;
      const originalResizeObserver = global.ResizeObserver;
      const originalBroadcastChannel = (global as any).BroadcastChannel;

      delete (global as any).IntersectionObserver;
      delete (global as any).ResizeObserver;
      delete (global as any).BroadcastChannel;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const alert = createMockAlert('compat-test', 'high', 'Compatibility test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should still work with fallbacks
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();

      // Restore APIs
      global.IntersectionObserver = originalIntersectionObserver;
      global.ResizeObserver = originalResizeObserver;
      (global as any).BroadcastChannel = originalBroadcastChannel;

      consoleSpy.mockRestore();
    });

    it('should handle touch devices without mouse events', async () => {
      // Mock touch-only environment
      Object.defineProperty(window, 'ontouchstart', { value: () => {} });
      Object.defineProperty(window, 'onmouseenter', { value: undefined });

      const alert = createMockAlert('touch-only', 'medium', 'Touch only test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      
      // Should work with touch events
      fireEvent.touchStart(dismissButton);
      fireEvent.touchEnd(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('should handle high DPI displays', () => {
      // Mock high DPI
      Object.defineProperty(window, 'devicePixelRatio', { value: 3 });

      const alert = createMockAlert('hidpi', 'critical', 'High DPI test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveClass('high-dpi');
    });
  });

  describe('Internationalization Edge Cases', () => {
    it('should handle right-to-left languages', () => {
      // Mock RTL environment
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';

      const alert = createMockAlert('rtl-test', 'high', 'اختبار اللغة العربية');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const container = screen.getByTestId('dismissal-controls-container');
      expect(container).toHaveClass('rtl');

      // Reset
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    });

    it('should handle very long translated text', () => {
      const germanText = 'Donaudampfschiffahrtselektrizitätenhauptbetriebswerkbauunterbeamtengesellschaft';
      const alert = createMockAlert('long-text', 'medium', germanText);

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            title={germanText}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should handle without layout breaking
      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement).toHaveClass('text-overflow-handled');
    });

    it('should handle Unicode and emoji content', () => {
      const emojiMessage = '🚨 Critical: Database connection failed! 💥 Error code: ∞';
      const alert = createMockAlert('emoji-test', 'critical', emojiMessage);

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      expect(screen.getByText(emojiMessage)).toBeInTheDocument();
    });
  });

  describe('Security Edge Cases', () => {
    it('should sanitize HTML content in alert messages', () => {
      const maliciousContent = '<script>alert("XSS")</script><img src="x" onerror="alert(\'XSS\')">';
      const alert = createMockAlert('xss-test', 'high', maliciousContent);

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should not execute scripts
      expect(screen.queryByText('<script>')).not.toBeInTheDocument();
      
      // Should show sanitized content
      const alertElement = screen.getByRole('alert');
      expect(alertElement.innerHTML).not.toContain('<script>');
    });

    it('should handle CSP violations gracefully', () => {
      // Mock CSP violation
      const cspError = new Error('Content Security Policy violation');
      const originalCreateElement = document.createElement;
      
      document.createElement = jest.fn().mockImplementation((tagName) => {
        if (tagName === 'style') {
          throw cspError;
        }
        return originalCreateElement.call(document, tagName);
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const alert = createMockAlert('csp-test', 'medium', 'CSP test');

      expect(() => {
        render(
          <TestWrapper>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
            />
          </TestWrapper>
        );
      }).not.toThrow();

      // Restore
      document.createElement = originalCreateElement;
      consoleSpy.mockRestore();
    });
  });

  describe('System Resource Edge Cases', () => {
    it('should handle low memory conditions', () => {
      // Mock low memory
      Object.defineProperty(navigator, 'deviceMemory', { value: 0.5 }); // 512MB

      const alert = createMockAlert('low-memory', 'info', 'Low memory test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should use reduced-feature mode
      const container = screen.getByTestId('dismissal-controls-container');
      expect(container).toHaveClass('low-memory-mode');
    });

    it('should handle slow CPUs gracefully', () => {
      // Mock slow CPU
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 1 });

      const alerts = Array.from({ length: 50 }, (_, i) =>
        createMockAlert(`slow-cpu-${i}`, 'medium', `Slow CPU test ${i}`)
      );

      const startTime = performance.now();

      render(
        <TestWrapper>
          <BulkDismissalManager
            groupingManager={groupingManager}
            availableAlerts={alerts}
            availableGroups={[]}
            onBulkDismiss={mockOnDismiss}
            onClose={() => {}}
          />
        </TestWrapper>
      );

      const endTime = performance.now();

      // Should still complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for slow CPU
    });

    it('should handle offline scenarios', () => {
      // Mock offline
      Object.defineProperty(navigator, 'onLine', { value: false });

      const alert = createMockAlert('offline-test', 'high', 'Offline test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show offline indicator
      expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
      
      // Should queue dismissals for later sync
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveAttribute('data-queue-offline', 'true');
    });
  });

  describe('Stress Testing Scenarios', () => {
    it('should handle component stress test', async () => {
      const stressTest = async () => {
        const alerts = Array.from({ length: 20 }, (_, i) =>
          createMockAlert(`stress-${i}`, 'medium', `Stress test ${i}`)
        );

        const { unmount } = render(
          <TestWrapper>
            {alerts.map(alert => (
              <AlertDismissalControls
                key={alert.id}
                alertId={alert.id}
                groupingManager={groupingManager}
                onDismiss={mockOnDismiss}
              />
            ))}
          </TestWrapper>
        );

        // Rapid interactions
        const buttons = screen.getAllByRole('button', { name: /dismiss/i });
        await Promise.all(buttons.map(button => userEvent.click(button)));

        unmount();
      };

      // Run stress test multiple times
      await act(async () => {
        const stressPromises = Array.from({ length: 5 }, () => stressTest());
        await Promise.all(stressPromises);
      });

      // Should not cause memory leaks or crashes
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should handle extreme data volumes', () => {
      const extremeData = {
        message: 'X'.repeat(1000000), // 1MB message
        metadata: Array.from({ length: 10000 }, (_, i) => ({ [`key${i}`]: `value${i}` })),
      };

      const alert = createMockAlert('extreme-data', 'low', extremeData.message, {
        metadata: extremeData.metadata,
      });

      const startTime = performance.now();

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const endTime = performance.now();

      // Should handle large data efficiently
      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });
  });
});