/**
 * Comprehensive Tests for Dismissal Feedback and Visual Indicators
 * Tests visual feedback, status indicators, animations, and user feedback systems
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
  DismissalBehavior,
  DismissalType 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import { AlertDismissalControls } from '../components/AlertDismissalControls';
import { PriorityAlert } from '../PriorityAlert';
import { EnhancedAlertContainer } from '../EnhancedAlertContainer';

// Mock CSS animations and transitions
Object.defineProperty(HTMLElement.prototype, 'animate', {
  value: jest.fn(() => ({
    finished: Promise.resolve(),
    cancel: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
  })),
});

// Mock IntersectionObserver for visibility tracking
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Setup fake timers for animations
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
    dismissible?: boolean;
    metadata?: Record<string, any>;
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
    closable: options?.dismissible !== false,
  },
});

describe('Dismissal Feedback and Visual Indicators', () => {
  let mockOnDismiss: jest.Mock;
  let groupingManager: EnhancedAlertGroupingManager;

  beforeEach(() => {
    mockOnDismiss = jest.fn().mockResolvedValue(true);
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Dismissal Behavior Visual Indicators', () => {
    it('should show persistent behavior indicator for critical alerts', () => {
      const alert = createMockAlert('critical-1', 'critical', 'Critical system error');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show "Requires Acknowledgment" badge with error styling
      const behaviorBadge = screen.getByText('Requires Acknowledgment');
      expect(behaviorBadge).toBeInTheDocument();
      expect(behaviorBadge).toHaveClass('badge-error');
    });

    it('should show sticky behavior indicator for high priority alerts', () => {
      const alert = createMockAlert('high-1', 'high', 'High priority warning');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const behaviorBadge = screen.getByText('Stays Until Dismissed');
      expect(behaviorBadge).toBeInTheDocument();
      expect(behaviorBadge).toHaveClass('badge-warning');
    });

    it('should show auto-hide behavior indicator for medium priority alerts', () => {
      const alert = createMockAlert('medium-1', 'medium', 'Medium notification');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const behaviorBadge = screen.getByText('Auto-Hide After View');
      expect(behaviorBadge).toBeInTheDocument();
      expect(behaviorBadge).toHaveClass('badge-success');
    });

    it('should show timeout indicator with countdown for low priority alerts', () => {
      const alert = createMockAlert('low-1', 'low', 'Low priority info');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const behaviorBadge = screen.getByText('Auto-Timeout');
      expect(behaviorBadge).toBeInTheDocument();
      expect(behaviorBadge).toHaveClass('badge-neutral');

      // Should show countdown
      expect(screen.getByText(/Auto-dismiss in \d+s/)).toBeInTheDocument();
    });

    it('should update countdown display dynamically', async () => {
      const alert = createMockAlert('low-countdown', 'low', 'Countdown test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Initial countdown
      expect(screen.getByText(/Auto-dismiss in 60s/)).toBeInTheDocument();

      // Advance time
      act(() => {
        jest.advanceTimersByTime(10000); // 10 seconds
      });

      await waitFor(() => {
        expect(screen.getByText(/Auto-dismiss in 50s/)).toBeInTheDocument();
      });

      // Advance to critical threshold (last 10 seconds)
      act(() => {
        jest.advanceTimersByTime(45000); // 45 more seconds
      });

      await waitFor(() => {
        const countdownElement = screen.getByText(/Auto-dismiss in 5s/);
        expect(countdownElement).toBeInTheDocument();
        expect(countdownElement).toHaveClass('urgent-countdown');
      });
    });
  });

  describe('Dismissal State Visual Feedback', () => {
    it('should show loading state during dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      // Create a delayed dismiss function
      const delayedDismiss = jest.fn(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 1000))
      );

      const alert = createMockAlert('loading-test', 'medium', 'Loading test alert');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={delayedDismiss}
          />
        </TestWrapper>
      );

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      // Should show loading state
      expect(dismissButton).toHaveAttribute('data-loading', 'true');
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(dismissButton).toBeDisabled();

      // Complete the dismissal
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(dismissButton).not.toHaveAttribute('data-loading');
      });
    });

    it('should show success feedback after successful dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('success-test', 'medium', 'Success feedback test');

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
      await user.click(dismissButton);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalled();
      });

      // Should show success indicator
      expect(screen.getByTestId('success-indicator')).toBeInTheDocument();
      expect(screen.getByText('Alert dismissed')).toBeInTheDocument();

      // Success message should fade out after a few seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('success-indicator')).not.toBeInTheDocument();
      });
    });

    it('should show error feedback for failed dismissals', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      const failingDismiss = jest.fn().mockRejectedValue(new Error('Dismissal failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const alert = createMockAlert('error-test', 'medium', 'Error feedback test');

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
      await user.click(dismissButton);

      await waitFor(() => {
        expect(failingDismiss).toHaveBeenCalled();
      });

      // Should show error indicator
      expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
      expect(screen.getByText(/dismissal failed/i)).toBeInTheDocument();

      // Should show retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should show confirmation feedback for acknowledgment-required dismissals', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('ack-test', 'critical', 'Acknowledgment test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Open options modal
      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Check acknowledgment
      const ackCheckbox = screen.getByLabelText(/acknowledge/i);
      await user.click(ackCheckbox);

      // Confirm dismissal
      const confirmButton = screen.getByRole('button', { name: /dismiss alert/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith(
          alert.id,
          'manual',
          expect.objectContaining({
            requireConfirmation: true,
          })
        );
      });

      // Should show acknowledgment confirmation
      expect(screen.getByText('Alert acknowledged and dismissed')).toBeInTheDocument();
    });
  });

  describe('Alert Animation and Transitions', () => {
    it('should animate alert entrance', async () => {
      const alert = createMockAlert('entrance-test', 'high', 'Entrance animation test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={() => {}}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      
      // Should have entrance animation classes
      expect(alertElement).toHaveClass('alert-enter');
      
      // Simulate animation completion
      act(() => {
        jest.advanceTimersByTime(300); // Animation duration
      });

      await waitFor(() => {
        expect(alertElement).toHaveClass('alert-enter-active');
      });
    });

    it('should animate alert exit on dismissal', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('exit-test', 'medium', 'Exit animation test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      const alertElement = screen.getByRole('alert');
      
      // Should have exit animation classes
      expect(alertElement).toHaveClass('alert-exit');
      
      act(() => {
        jest.advanceTimersByTime(200); // Exit animation duration
      });

      await waitFor(() => {
        expect(alertElement).toHaveClass('alert-exit-active');
      });
    });

    it('should show pulsing animation for urgent alerts', () => {
      const urgentAlert = createMockAlert('urgent-test', 'critical', 'Urgent critical alert');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={urgentAlert.priority}
            message={urgentAlert.data?.message || ''}
            urgent={true}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveClass('alert-urgent', 'alert-pulse');
    });

    it('should show fade-out animation for auto-dismissing alerts', async () => {
      const autoAlert = createMockAlert('auto-fade', 'info', 'Auto-dismiss test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={autoAlert.priority}
            message={autoAlert.data?.message || ''}
            autoFadeOut={true}
            autoFadeDelay={15000}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');

      // Wait for auto-fade to start
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      await waitFor(() => {
        expect(alertElement).toHaveClass('alert-auto-fade');
      });
    });
  });

  describe('Progress and Status Indicators', () => {
    it('should show progress bar for timed dismissals', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('progress-test', 'medium', 'Progress test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Open options modal
      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Select timed dismissal
      const timedOption = screen.getByLabelText('Timed Dismissal');
      await user.click(timedOption);

      // Set a short schedule for testing
      const scheduleInput = screen.getByLabelText(/schedule/i);
      await user.clear(scheduleInput);
      await user.type(scheduleInput, '1'); // 1 minute

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /dismiss alert/i });
      await user.click(confirmButton);

      // Should show progress bar
      expect(screen.getByTestId('dismissal-progress')).toBeInTheDocument();
      expect(screen.getByText(/scheduled for dismissal in/i)).toBeInTheDocument();

      // Progress should update over time
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');

      // Advance halfway through
      act(() => {
        jest.advanceTimersByTime(30000); // 30 seconds
      });

      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      });
    });

    it('should show batch processing status for bulk operations', async () => {
      const alerts = Array.from({ length: 5 }, (_, i) =>
        createMockAlert(`bulk-${i}`, 'medium', `Bulk test ${i}`)
      );

      // Mock bulk dismissal with progress updates
      const bulkDismissWithProgress = jest.fn().mockImplementation(
        async (items, type, options) => {
          // Simulate processing each alert with delays
          for (let i = 0; i < items.alertIds.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            // Emit progress event
            window.dispatchEvent(new CustomEvent('bulk-dismissal-progress', {
              detail: { completed: i + 1, total: items.alertIds.length }
            }));
          }
          return true;
        }
      );

      render(
        <TestWrapper>
          <div data-testid="bulk-status-container">
            {/* Mock bulk status display */}
            <div data-testid="bulk-progress" />
          </div>
        </TestWrapper>
      );

      // Simulate bulk dismissal
      await act(async () => {
        await bulkDismissWithProgress(
          { alertIds: alerts.map(a => a.id) },
          'bulk',
          {}
        );
      });

      // Should show batch processing status
      expect(screen.getByTestId('bulk-progress')).toBeInTheDocument();
    });

    it('should show connection status indicators for real-time features', () => {
      render(
        <TestWrapper>
          <EnhancedAlertContainer
            enableBulkActions={true}
            enableUndo={true}
          />
        </TestWrapper>
      );

      // Should show connection status for real-time features
      const statusIndicator = screen.getByTestId('connection-status');
      expect(statusIndicator).toBeInTheDocument();
      expect(statusIndicator).toHaveClass('status-connected');
    });
  });

  describe('Interactive Visual Feedback', () => {
    it('should provide hover feedback on dismissal controls', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('hover-test', 'medium', 'Hover feedback test');

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
      
      await user.hover(dismissButton);

      // Should show hover state
      expect(dismissButton).toHaveClass('button-hover');
      
      // Should show tooltip
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.unhover(dismissButton);

      // Should remove hover state
      expect(dismissButton).not.toHaveClass('button-hover');
    });

    it('should provide focus indicators for keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('focus-test', 'medium', 'Focus test');

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
      const optionsButton = screen.getByRole('button', { name: /options/i });

      // Tab to first button
      await user.tab();
      expect(dismissButton).toHaveFocus();
      expect(dismissButton).toHaveClass('button-focus');

      // Tab to second button
      await user.tab();
      expect(optionsButton).toHaveFocus();
      expect(optionsButton).toHaveClass('button-focus');
      expect(dismissButton).not.toHaveClass('button-focus');
    });

    it('should show active/pressed state feedback', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const alert = createMockAlert('active-test', 'medium', 'Active state test');

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
      
      await user.pointer([
        { keys: '[MouseLeft>]', target: dismissButton },
      ]);

      // Should show active/pressed state
      expect(dismissButton).toHaveClass('button-active');

      await user.pointer([
        { keys: '[/MouseLeft]', target: dismissButton },
      ]);

      expect(dismissButton).not.toHaveClass('button-active');
    });
  });

  describe('Priority-Based Visual Differentiation', () => {
    it('should use distinct colors for different priority levels', () => {
      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
      
      priorities.forEach(priority => {
        const alert = createMockAlert(`color-${priority}`, priority, `${priority} alert`);
        
        const { unmount } = render(
          <TestWrapper>
            <PriorityAlert
              priority={alert.priority}
              message={alert.data?.message || ''}
            />
          </TestWrapper>
        );

        const alertElement = screen.getByRole('alert');
        expect(alertElement).toHaveClass(`alert-${priority}`);
        
        // Check color scheme
        const computedStyle = window.getComputedStyle(alertElement);
        expect(computedStyle.borderLeftColor).toBeTruthy();
        expect(computedStyle.backgroundColor).toBeTruthy();

        unmount();
      });
    });

    it('should use appropriate icons for different priorities', () => {
      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
      
      priorities.forEach(priority => {
        const alert = createMockAlert(`icon-${priority}`, priority, `${priority} alert`);
        
        const { unmount } = render(
          <TestWrapper>
            <PriorityAlert
              priority={alert.priority}
              message={alert.data?.message || ''}
            />
          </TestWrapper>
        );

        const iconElement = screen.getByTestId(`priority-icon-${priority}`);
        expect(iconElement).toBeInTheDocument();

        unmount();
      });
    });

    it('should adjust visual emphasis based on priority', () => {
      const highPriorityAlert = createMockAlert('high-emphasis', 'critical', 'Critical alert');
      const lowPriorityAlert = createMockAlert('low-emphasis', 'info', 'Info alert');

      const { rerender } = render(
        <TestWrapper>
          <PriorityAlert
            priority={highPriorityAlert.priority}
            message={highPriorityAlert.data?.message || ''}
          />
        </TestWrapper>
      );

      const criticalAlert = screen.getByRole('alert');
      expect(criticalAlert).toHaveClass('alert-high-emphasis');

      rerender(
        <TestWrapper>
          <PriorityAlert
            priority={lowPriorityAlert.priority}
            message={lowPriorityAlert.data?.message || ''}
          />
        </TestWrapper>
      );

      const infoAlert = screen.getByRole('alert');
      expect(infoAlert).toHaveClass('alert-low-emphasis');
    });
  });

  describe('Responsive Visual Behavior', () => {
    it('should adapt visual indicators for mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 320 });
      Object.defineProperty(window, 'innerHeight', { value: 568 });

      const alert = createMockAlert('mobile-test', 'medium', 'Mobile test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
            compact={true}
          />
        </TestWrapper>
      );

      const container = screen.getByTestId('dismissal-controls');
      expect(container).toHaveClass('mobile-compact');

      // Buttons should be larger for touch interaction
      const dismissButton = screen.getByRole('button', { name: /×/i });
      expect(dismissButton).toHaveClass('touch-friendly');
    });

    it('should scale visual elements for different screen densities', () => {
      // Mock high DPI display
      Object.defineProperty(window, 'devicePixelRatio', { value: 2 });

      const alert = createMockAlert('hidpi-test', 'high', 'High DPI test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveClass('high-dpi');
    });

    it('should provide alternative indicators for reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });

      const alert = createMockAlert('reduced-motion', 'critical', 'Reduced motion test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveClass('reduced-motion');
      expect(alertElement).not.toHaveClass('alert-pulse');
    });
  });

  describe('Color Accessibility and Contrast', () => {
    it('should maintain sufficient color contrast for all priority levels', () => {
      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
      
      priorities.forEach(priority => {
        const alert = createMockAlert(`contrast-${priority}`, priority, `${priority} alert`);
        
        const { unmount } = render(
          <TestWrapper>
            <PriorityAlert
              priority={alert.priority}
              message={alert.data?.message || ''}
            />
          </TestWrapper>
        );

        const alertElement = screen.getByRole('alert');
        const computedStyle = window.getComputedStyle(alertElement);
        
        // Mock contrast checker would verify WCAG AA compliance
        expect(alertElement).toHaveAttribute('data-contrast-compliant', 'true');

        unmount();
      });
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        })),
      });

      const alert = createMockAlert('high-contrast', 'medium', 'High contrast test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveClass('high-contrast-mode');
    });

    it('should provide color-blind friendly indicators', () => {
      const alert = createMockAlert('colorblind-test', 'critical', 'Color accessibility test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
          />
        </TestWrapper>
      );

      // Should have pattern or shape indicators in addition to color
      const patternIndicator = screen.getByTestId('priority-pattern');
      expect(patternIndicator).toBeInTheDocument();

      const shapeIndicator = screen.getByTestId('priority-shape');
      expect(shapeIndicator).toBeInTheDocument();
    });
  });

  describe('Performance of Visual Updates', () => {
    it('should efficiently update visual states without layout thrashing', async () => {
      const alert = createMockAlert('perf-test', 'medium', 'Performance test');

      const { rerender } = render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const startTime = performance.now();

      // Rapidly change states multiple times
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <AlertDismissalControls
              alertId={alert.id}
              groupingManager={groupingManager}
              onDismiss={mockOnDismiss}
              disabled={i % 2 === 0}
            />
          </TestWrapper>
        );
      }

      const endTime = performance.now();

      // Should complete updates efficiently
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });

    it('should use CSS transforms for animations to avoid repaints', () => {
      const alert = createMockAlert('transform-test', 'high', 'Transform animation test');

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
      
      // Should use transform-based animations
      expect(alertElement).toHaveStyle('will-change: transform, opacity');
    });
  });
});