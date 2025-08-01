/**
 * Comprehensive Tests for Priority-Specific Alert Dismissal Behaviors
 * Tests all dismissal behaviors: Critical, High, Medium, Low, Info priorities
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { themes } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { EnhancedAlertGroupingManager, DismissalType } from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { AlertDismissalControls } from '../components/AlertDismissalControls';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';

// Mock performance.now for consistent timing in tests
global.performance.now = jest.fn(() => Date.now());

// Setup fake timers for controlling timeout behaviors
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
  priority: AlertPriority,
  id: string = `alert-${Date.now()}`,
  additionalData?: Partial<ProcessedAlert>
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: new Date(),
  processAfter: new Date(),
  metadata: { source: 'test' },
  data: {
    message: `${priority} priority alert`,
    title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Alert`,
    closable: true,
    ...additionalData?.data,
  },
  ...additionalData,
});

describe('Alert Dismissal Behaviors', () => {
  let mockOnDismiss: jest.Mock;
  let groupingManager: EnhancedAlertGroupingManager;

  beforeEach(() => {
    mockOnDismiss = jest.fn().mockResolvedValue(true);
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });
    
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Critical Priority Dismissal Behavior', () => {
    it('should require explicit acknowledgment for critical alerts', async () => {
      const alert = createMockAlert('critical', 'critical-1');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show "Requires Acknowledgment" badge
      expect(screen.getByText('Requires Acknowledgment')).toBeInTheDocument();

      // Quick dismiss button should be available but require acknowledgment
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();

      await user.click(dismissButton);

      // Should open acknowledgment modal or require confirmation
      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.any(Object)
      );
    });

    it('should persist critical alerts until explicitly dismissed', async () => {
      const alert = createMockAlert('critical', 'persistent-critical');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should not auto-dismiss even after long periods
      act(() => {
        jest.advanceTimersByTime(300000); // 5 minutes
      });

      // Should still be available for dismissal
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
      expect(mockOnDismiss).not.toHaveBeenCalled();
    });

    it('should not allow timed dismissal for critical alerts without acknowledgment', async () => {
      const alert = createMockAlert('critical', 'no-timed-critical');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Open advanced options
      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Timed dismissal should be disabled or require acknowledgment
      const timedOption = screen.getByText('Timed Dismissal');
      expect(timedOption.closest('[data-disabled="true"]')).toBeTruthy();
    });
  });

  describe('High Priority Dismissal Behavior', () => {
    it('should stay visible until user acknowledges', async () => {
      const alert = createMockAlert('high', 'high-sticky');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show "Stays Until Dismissed" behavior
      expect(screen.getByText('Stays Until Dismissed')).toBeInTheDocument();

      // Should not auto-dismiss
      act(() => {
        jest.advanceTimersByTime(120000); // 2 minutes
      });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });

    it('should require user interaction for high priority dismissal', async () => {
      const alert = createMockAlert('high', 'high-interaction');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

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

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.objectContaining({
          reason: expect.any(String),
        })
      );
    });

    it('should allow timed dismissal for high priority alerts', async () => {
      const alert = createMockAlert('high', 'high-timed');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Open advanced options
      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Should allow timed dismissal
      const timedOption = screen.getByText('Timed Dismissal');
      await user.click(timedOption);

      // Set schedule time
      const scheduleInput = screen.getByLabelText(/schedule/i);
      await user.clear(scheduleInput);
      await user.type(scheduleInput, '10');

      // Confirm dismissal
      const confirmButton = screen.getByRole('button', { name: /dismiss alert/i });
      await user.click(confirmButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'timed',
        expect.objectContaining({
          scheduleMs: 10 * 60 * 1000, // 10 minutes
        })
      );
    });
  });

  describe('Medium Priority Dismissal Behavior', () => {
    it('should auto-dismiss after minimum view time', async () => {
      const alert = createMockAlert('medium', 'medium-viewed');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show "Auto-Hide After View" behavior
      expect(screen.getByText('Auto-Hide After View')).toBeInTheDocument();

      // Should show timeout indicator
      expect(screen.getByText(/Auto-dismiss in/)).toBeInTheDocument();

      // Simulate viewing for required time (3 seconds)
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Then auto-dismiss after additional timeout
      act(() => {
        jest.advanceTimersByTime(30000); // 30 seconds total timeout
      });

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith(
          alert.id,
          'auto-priority',
          expect.any(Object)
        );
      });
    });

    it('should allow manual dismissal before auto-timeout', async () => {
      const alert = createMockAlert('medium', 'medium-manual');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Dismiss manually before auto-timeout
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.any(Object)
      );

      // Auto-dismiss should not fire after manual dismissal
      act(() => {
        jest.advanceTimersByTime(35000);
      });

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should reset auto-dismiss timer on user interaction', async () => {
      const alert = createMockAlert('medium', 'medium-reset');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Wait partway through timeout
      act(() => {
        jest.advanceTimersByTime(20000); // 20 seconds
      });

      // Interact with alert (hover or click options)
      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.hover(optionsButton);

      // Timer should reset - wait another full timeout period
      act(() => {
        jest.advanceTimersByTime(30000); // Another 30 seconds
      });

      // Should not have auto-dismissed yet due to reset
      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Low Priority Dismissal Behavior', () => {
    it('should auto-dismiss after 1-minute timeout', async () => {
      const alert = createMockAlert('low', 'low-timeout');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show "Auto-Timeout" behavior
      expect(screen.getByText('Auto-Timeout')).toBeInTheDocument();

      // Should show countdown
      expect(screen.getByText(/Auto-dismiss in \d+s/)).toBeInTheDocument();

      // Wait for timeout
      act(() => {
        jest.advanceTimersByTime(60000); // 1 minute
      });

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith(
          alert.id,
          'auto-priority',
          expect.any(Object)
        );
      });
    });

    it('should update countdown display in real-time', async () => {
      const alert = createMockAlert('low', 'low-countdown');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Initial countdown should show 60 seconds
      expect(screen.getByText(/Auto-dismiss in 60s/)).toBeInTheDocument();

      // Advance 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should update to 50 seconds
      expect(screen.getByText(/Auto-dismiss in 50s/)).toBeInTheDocument();

      // Advance another 25 seconds
      act(() => {
        jest.advanceTimersByTime(25000);
      });

      // Should update to 25 seconds
      expect(screen.getByText(/Auto-dismiss in 25s/)).toBeInTheDocument();
    });

    it('should allow manual dismissal before timeout', async () => {
      const alert = createMockAlert('low', 'low-manual-before-timeout');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Dismiss after 30 seconds, before timeout
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.any(Object)
      );

      // Auto-dismiss should not fire
      act(() => {
        jest.advanceTimersByTime(35000);
      });

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Info Priority Dismissal Behavior', () => {
    it('should auto-dismiss after 15 seconds', async () => {
      const alert = createMockAlert('info', 'info-quick');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should show "Auto-Hide After View" behavior
      expect(screen.getByText('Auto-Hide After View')).toBeInTheDocument();

      // Wait for timeout
      act(() => {
        jest.advanceTimersByTime(15000); // 15 seconds
      });

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith(
          alert.id,
          'auto-priority',
          expect.any(Object)
        );
      });
    });

    it('should be visible only in alert center', async () => {
      const alert = createMockAlert('info', 'info-center-only');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should indicate alert center visibility
      const dismissalFeedback = groupingManager.getDismissalFeedback(alert.id);
      expect(dismissalFeedback?.behavior).toBe('auto-hide');
      expect(dismissalFeedback?.timeoutMs).toBe(15000);
    });

    it('should allow immediate manual dismissal', async () => {
      const alert = createMockAlert('info', 'info-immediate');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

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

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.any(Object)
      );
    });
  });

  describe('Dismissal Options Modal', () => {
    it('should open advanced dismissal options', async () => {
      const alert = createMockAlert('high', 'options-modal');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Modal should open with dismissal options
      expect(screen.getByText('Dismiss Alert')).toBeInTheDocument();
      expect(screen.getByText('Manual Dismissal')).toBeInTheDocument();
      expect(screen.getByText('Timed Dismissal')).toBeInTheDocument();
      expect(screen.getByText('Conditional Dismissal')).toBeInTheDocument();
    });

    it('should handle reason input for dismissal', async () => {
      const alert = createMockAlert('critical', 'with-reason');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Enter dismissal reason
      const reasonInput = screen.getByLabelText(/reason/i);
      await user.type(reasonInput, 'Issue resolved manually');

      // Confirm dismissal
      const confirmButton = screen.getByRole('button', { name: /dismiss alert/i });
      await user.click(confirmButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.objectContaining({
          reason: 'Issue resolved manually',
        })
      );
    });

    it('should validate required acknowledgment for critical alerts', async () => {
      const alert = createMockAlert('critical', 'requires-ack');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const optionsButton = screen.getByRole('button', { name: /options/i });
      await user.click(optionsButton);

      // Should show acknowledgment checkbox
      const ackCheckbox = screen.getByLabelText(/acknowledge/i);
      expect(ackCheckbox).toBeInTheDocument();

      // Confirm button should be disabled without acknowledgment
      const confirmButton = screen.getByRole('button', { name: /dismiss alert/i });
      expect(confirmButton).toBeDisabled();

      // Check acknowledgment
      await user.click(ackCheckbox);

      // Now should be enabled
      expect(confirmButton).toBeEnabled();

      await user.click(confirmButton);

      expect(mockOnDismiss).toHaveBeenCalledWith(
        alert.id,
        'manual',
        expect.objectContaining({
          requireConfirmation: true,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle dismissal failures gracefully', async () => {
      const alert = createMockAlert('medium', 'dismissal-error');
      const failingDismiss = jest.fn().mockRejectedValue(new Error('Dismissal failed'));
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

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

      // Button should not be stuck in loading state
      expect(dismissButton).not.toHaveAttribute('disabled');

      consoleSpy.mockRestore();
    });

    it('should handle invalid alert IDs', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId="invalid-alert-id"
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should not crash and should handle gracefully
      expect(screen.getByTestId('test-wrapper')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should handle rapid dismissal requests efficiently', async () => {
      const alerts = Array.from({ length: 10 }, (_, i) => 
        createMockAlert('medium', `perf-test-${i}`)
      );
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const { rerender } = render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alerts[0].id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const startTime = performance.now();

      // Rapidly switch between different alerts and dismiss them
      for (const alert of alerts) {
        rerender(
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
      }

      const endTime = performance.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockOnDismiss).toHaveBeenCalledTimes(10);
    });
  });
});