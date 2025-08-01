/**
 * Comprehensive Tests for Accessibility Compliance of Dismissal Controls
 * Tests WCAG 2.1 compliance, screen reader support, keyboard navigation, and focus management
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@emotion/react';
import { themes } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { EnhancedAlertGroupingManager } from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import { AlertDismissalControls } from '../components/AlertDismissalControls';
import { PriorityAlert } from '../PriorityAlert';
import { EnhancedAlertContainer } from '../EnhancedAlertContainer';
import BulkDismissalManager from '../components/BulkDismissalManager';
import AlertUndoManager from '../components/AlertUndoManager';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock matchMedia for reduced motion and high contrast testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

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
  },
});

describe('Accessibility Compliance for Alert Dismissal Controls', () => {
  let mockOnDismiss: jest.Mock;
  let groupingManager: EnhancedAlertGroupingManager;

  beforeEach(() => {
    mockOnDismiss = jest.fn().mockResolvedValue(true);
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('WCAG 2.1 Level AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const alert = createMockAlert('a11y-test', 'medium', 'Accessibility test alert');

      const { container } = render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility with multiple alert types', async () => {
      const alerts = [
        createMockAlert('critical-a11y', 'critical', 'Critical accessibility test'),
        createMockAlert('high-a11y', 'high', 'High priority accessibility test'),
        createMockAlert('medium-a11y', 'medium', 'Medium priority accessibility test'),
        createMockAlert('low-a11y', 'low', 'Low priority accessibility test'),
        createMockAlert('info-a11y', 'info', 'Info accessibility test'),
      ];

      const { container } = render(
        <TestWrapper>
          <div role="region" aria-label="Alert dismissal controls">
            {alerts.map(alert => (
              <AlertDismissalControls
                key={alert.id}
                alertId={alert.id}
                groupingManager={groupingManager}
                onDismiss={mockOnDismiss}
              />
            ))}
          </div>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility in compact mode', async () => {
      const alert = createMockAlert('compact-a11y', 'high', 'Compact mode test');

      const { container } = render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
            compact={true}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility in bulk dismissal manager', async () => {
      const alerts = [
        createMockAlert('bulk-1', 'medium', 'Bulk test 1'),
        createMockAlert('bulk-2', 'medium', 'Bulk test 2'),
      ];

      const { container } = render(
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

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML and ARIA Labels', () => {
    it('should use proper semantic roles for alert containers', () => {
      const alert = createMockAlert('semantic-test', 'critical', 'Semantic test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            title={alert.data?.title}
          />
        </TestWrapper>
      );

      const alertElement = screen.getByRole('alert');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should provide descriptive aria-labels for dismissal buttons', () => {
      const alert = createMockAlert('aria-label-test', 'high', 'ARIA label test');

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
      expect(dismissButton).toHaveAttribute('aria-label', 
        expect.stringMatching(/dismiss.*alert/i)
      );

      const optionsButton = screen.getByRole('button', { name: /options/i });
      expect(optionsButton).toHaveAttribute('aria-label',
        expect.stringMatching(/advanced.*dismissal.*options/i)
      );
    });

    it('should provide aria-describedby for dismissal behavior descriptions', () => {
      const alert = createMockAlert('describedby-test', 'critical', 'Description test');

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
      expect(dismissButton).toHaveAttribute('aria-describedby');

      const descriptionId = dismissButton.getAttribute('aria-describedby');
      const descriptionElement = document.getElementById(descriptionId!);
      expect(descriptionElement).toBeInTheDocument();
      expect(descriptionElement).toHaveTextContent(/requires acknowledgment/i);
    });

    it('should use proper heading hierarchy', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('heading-test', 'medium', 'Heading hierarchy test');

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

      // Modal should have proper heading hierarchy
      const modalHeading = screen.getByRole('heading', { level: 2 });
      expect(modalHeading).toHaveTextContent('Dismiss Alert');

      // Sub-sections should use h3
      const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(sectionHeadings.length).toBeGreaterThan(0);
    });

    it('should provide proper form labels and fieldsets', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('form-test', 'high', 'Form accessibility test');

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

      // Dismissal type selection should be in a fieldset
      const fieldset = screen.getByRole('group', { name: /dismissal type/i });
      expect(fieldset).toBeInTheDocument();

      // Form inputs should have labels
      const reasonInput = screen.getByLabelText(/reason/i);
      expect(reasonInput).toBeInTheDocument();

      // Radio buttons should have proper labels
      const manualOption = screen.getByLabelText(/manual dismissal/i);
      expect(manualOption).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation Support', () => {
    it('should support tab navigation through dismissal controls', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('tab-nav-test', 'medium', 'Tab navigation test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Tab to first button
      await user.tab();
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveFocus();

      // Tab to second button
      await user.tab();
      const optionsButton = screen.getByRole('button', { name: /options/i });
      expect(optionsButton).toHaveFocus();
    });

    it('should support keyboard activation with Enter and Space', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('keyboard-activate', 'medium', 'Keyboard activation test');

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
      dismissButton.focus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);

      mockOnDismiss.mockClear();

      // Activate with Space
      await user.keyboard(' ');
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should support arrow key navigation in radio groups', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('arrow-nav-test', 'high', 'Arrow navigation test');

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

      // Focus first radio button
      const manualOption = screen.getByRole('radio', { name: /manual dismissal/i });
      manualOption.focus();

      // Arrow down to next option
      await user.keyboard('{ArrowDown}');
      const timedOption = screen.getByRole('radio', { name: /timed dismissal/i });
      expect(timedOption).toHaveFocus();
      expect(timedOption).toBeChecked();

      // Arrow down to next option
      await user.keyboard('{ArrowDown}');
      const conditionalOption = screen.getByRole('radio', { name: /conditional dismissal/i });
      expect(conditionalOption).toHaveFocus();
      expect(conditionalOption).toBeChecked();
    });

    it('should trap focus within modal dialogs', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('focus-trap-test', 'critical', 'Focus trap test');

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

      // Tab through all modal elements
      const modalElements = screen.getAllByRole('button').concat(
        screen.getAllByRole('radio'),
        screen.getAllByRole('textbox')
      );

      // Tab to last element
      for (let i = 0; i < modalElements.length; i++) {
        await user.tab();
      }

      // Next tab should return to first element
      await user.tab();
      const firstModalElement = modalElements[0];
      expect(firstModalElement).toHaveFocus();

      // Shift+Tab should go to last element
      await user.tab({ shift: true });
      const lastModalElement = modalElements[modalElements.length - 1];
      expect(lastModalElement).toHaveFocus();
    });

    it('should support Escape key to close modals', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('escape-test', 'high', 'Escape key test');

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

      expect(screen.getByText('Dismiss Alert')).toBeInTheDocument();

      // Press Escape to close modal
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Dismiss Alert')).not.toBeInTheDocument();
      });

      // Focus should return to options button
      expect(optionsButton).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce dismissal status changes', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('sr-announce-test', 'medium', 'Screen reader test');

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

      // Should have live region announcing the dismissal
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent(/alert dismissed/i);
    });

    it('should provide countdown announcements for auto-dismissing alerts', async () => {
      const alert = createMockAlert('countdown-sr', 'low', 'Countdown screen reader test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should announce countdown milestones
      act(() => {
        jest.advanceTimersByTime(50000); // 50 seconds elapsed, 10 remaining
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/10 seconds remaining/i);
      });
    });

    it('should announce bulk selection changes', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alerts = [
        createMockAlert('bulk-sr-1', 'medium', 'Bulk screen reader 1'),
        createMockAlert('bulk-sr-2', 'medium', 'Bulk screen reader 2'),
      ];

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

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      // Should announce selection change
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent(/2 alerts selected/i);
    });

    it('should provide contextual help text', () => {
      const alert = createMockAlert('help-text-test', 'critical', 'Help text test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should have help text for critical alert behavior
      const helpText = screen.getByText(/critical alerts require explicit acknowledgment/i);
      expect(helpText).toBeInTheDocument();

      // Help text should be associated with controls
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      const describedBy = dismissButton.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(/critical alerts/i);
    });
  });

  describe('High Contrast and Visual Accessibility', () => {
    it('should maintain visibility in high contrast mode', () => {
      // Mock high contrast media query
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const alert = createMockAlert('high-contrast-test', 'critical', 'High contrast test');

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
      expect(container).toHaveClass('high-contrast');

      // Buttons should have high contrast styling
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveClass('high-contrast-button');
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      (window.matchMedia as jest.Mock).mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }));

      const alert = createMockAlert('reduced-motion-test', 'high', 'Reduced motion test');

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
      expect(alertElement).toHaveClass('reduced-motion');
      expect(alertElement).not.toHaveClass('animate-pulse');
    });

    it('should maintain sufficient color contrast ratios', () => {
      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];

      priorities.forEach(priority => {
        const alert = createMockAlert(`contrast-${priority}`, priority, `${priority} test`);
        
        const { unmount } = render(
          <TestWrapper>
            <PriorityAlert
              priority={alert.priority}
              message={alert.data?.message || ''}
              onClose={mockOnDismiss}
            />
          </TestWrapper>
        );

        const alertElement = screen.getByRole('alert');
        
        // Should have contrast-compliant class
        expect(alertElement).toHaveAttribute('data-contrast-ratio', 
          expect.stringMatching(/^[4-9]\.[0-9]+:1$/)); // WCAG AA requires 4.5:1

        unmount();
      });
    });

    it('should provide alternative indicators for color-blind users', () => {
      const alert = createMockAlert('colorblind-test', 'critical', 'Color blind test');

      render(
        <TestWrapper>
          <PriorityAlert
            priority={alert.priority}
            message={alert.data?.message || ''}
            onClose={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should have pattern/shape indicators in addition to color
      expect(screen.getByTestId('priority-icon')).toBeInTheDocument();
      expect(screen.getByTestId('priority-pattern')).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly when alerts are dismissed', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alerts = [
        createMockAlert('focus-1', 'medium', 'Focus test 1'),
        createMockAlert('focus-2', 'medium', 'Focus test 2'),
      ];

      render(
        <TestWrapper>
          {alerts.map(alert => (
            <div key={alert.id}>
              <PriorityAlert
                priority={alert.priority}
                message={alert.data?.message || ''}
                onClose={() => mockOnDismiss(alert.id)}
              />
              <AlertDismissalControls
                alertId={alert.id}
                groupingManager={groupingManager}
                onDismiss={mockOnDismiss}
              />
            </div>
          ))}
        </TestWrapper>
      );

      // Focus first dismiss button
      const firstDismissButton = screen.getAllByRole('button', { name: /dismiss/i })[0];
      firstDismissButton.focus();

      await user.click(firstDismissButton);

      // Focus should move to next available alert or reasonable fallback
      await waitFor(() => {
        const secondDismissButton = screen.getAllByRole('button', { name: /dismiss/i })[0];
        expect(secondDismissButton).toHaveFocus();
      });
    });

    it('should restore focus after modal interactions', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('focus-restore-test', 'high', 'Focus restore test');

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
      optionsButton.focus();
      await user.click(optionsButton);

      // Cancel modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Focus should return to options button
      await waitFor(() => {
        expect(optionsButton).toHaveFocus();
      });
    });

    it('should provide skip links for bulk operations', () => {
      const alerts = Array.from({ length: 20 }, (_, i) =>
        createMockAlert(`skip-${i}`, 'medium', `Skip test ${i}`)
      );

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

      // Should have skip link to bulk actions
      const skipLink = screen.getByRole('link', { name: /skip to bulk actions/i });
      expect(skipLink).toBeInTheDocument();
    });
  });

  describe('Error Handling and User Feedback', () => {
    it('should provide accessible error messages', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const failingDismiss = jest.fn().mockRejectedValue(new Error('Dismissal failed'));
      const alert = createMockAlert('error-a11y-test', 'medium', 'Error accessibility test');

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
        // Error should be announced to screen readers
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/dismissal failed/i);

        // Error should be associated with the button
        expect(dismissButton).toHaveAttribute('aria-describedby', 
          expect.stringContaining(errorAlert.id));
      });
    });

    it('should provide accessible form validation feedback', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('validation-test', 'critical', 'Validation test');

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

      // Try to submit without required acknowledgment
      const submitButton = screen.getByRole('button', { name: /dismiss alert/i });
      await user.click(submitButton);

      // Should show validation error
      const validationError = screen.getByRole('alert');
      expect(validationError).toHaveTextContent(/acknowledgment required/i);

      // Error should be associated with checkbox
      const ackCheckbox = screen.getByRole('checkbox', { name: /acknowledge/i });
      expect(ackCheckbox).toHaveAttribute('aria-describedby',
        expect.stringContaining(validationError.id));
      expect(ackCheckbox).toHaveAttribute('aria-invalid', 'true');
    });

    it('should handle timeout announcements accessibly', async () => {
      const alert = createMockAlert('timeout-a11y', 'low', 'Timeout accessibility test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Advance to near timeout
      act(() => {
        jest.advanceTimersByTime(55000); // 55 of 60 seconds
      });

      // Should announce impending timeout
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/will be dismissed in 5 seconds/i);
      });
    });
  });

  describe('Mobile and Touch Accessibility', () => {
    it('should provide adequate touch targets', () => {
      const alert = createMockAlert('touch-test', 'medium', 'Touch target test');

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

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      const computedStyle = window.getComputedStyle(dismissButton);
      
      // Should meet WCAG AA minimum touch target size (44x44px)
      expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(computedStyle.minWidth)).toBeGreaterThanOrEqual(44);
    });

    it('should support voice control commands', () => {
      const alert = createMockAlert('voice-test', 'high', 'Voice control test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Buttons should have voice-friendly names
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveAttribute('data-voice-command', 'dismiss alert');

      const optionsButton = screen.getByRole('button', { name: /options/i });
      expect(optionsButton).toHaveAttribute('data-voice-command', 'alert options');
    });

    it('should work with screen reader gestures', async () => {
      const user = userEvent.setup({ 
        advanceTimers: jest.advanceTimersByTime,
        pointerEventsCheck: 0, // Disable pointer events check for screen reader simulation
      });

      const alert = createMockAlert('gesture-test', 'medium', 'Screen reader gesture test');

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
      
      // Simulate swipe gesture (right swipe to dismiss)
      await user.pointer([
        { keys: '[TouchA>]', target: alertElement, coords: { x: 10, y: 50 } },
        { keys: '[TouchA>]', target: alertElement, coords: { x: 200, y: 50 } },
        { keys: '[/TouchA]', target: alertElement },
      ]);

      // Should support gesture-based dismissal
      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });

  describe('Performance and Accessibility', () => {
    it('should maintain accessibility during high-frequency updates', async () => {
      const alerts = Array.from({ length: 100 }, (_, i) =>
        createMockAlert(`perf-a11y-${i}`, 'info', `Performance test ${i}`)
      );

      const { container } = render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Should maintain accessibility even with many alerts
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Should not create excessive announcement spam
      const liveRegions = screen.getAllByRole('status');
      expect(liveRegions.length).toBeLessThanOrEqual(3); // Reasonable limit
    });

    it('should debounce screen reader announcements', async () => {
      const alert = createMockAlert('debounce-test', 'medium', 'Debounce test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Rapidly update countdown
      for (let i = 0; i < 10; i++) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }

      // Should not create 10 separate announcements
      const liveRegions = screen.getAllByRole('status');
      const announcements = liveRegions.map(region => region.textContent).filter(Boolean);
      expect(announcements.length).toBeLessThanOrEqual(2); // Only final state should be announced
    });
  });

  describe('Integration with Assistive Technologies', () => {
    it('should work with Dragon NaturallySpeaking voice commands', () => {
      const alert = createMockAlert('dragon-test', 'critical', 'Dragon speech test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should have speech recognition friendly attributes
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveAttribute('data-speech-command', 'dismiss');
      expect(dismissButton).toHaveAttribute('data-speech-context', 'alert');
    });

    it('should support switch navigation', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const alert = createMockAlert('switch-test', 'high', 'Switch navigation test');

      render(
        <TestWrapper>
          <AlertDismissalControls
            alertId={alert.id}
            groupingManager={groupingManager}
            onDismiss={mockOnDismiss}
          />
        </TestWrapper>
      );

      // Should work with single-switch scanning
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      
      // Focus and activate with Space (common switch input)
      dismissButton.focus();
      await user.keyboard(' ');

      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('should provide landmark navigation', () => {
      const alerts = [
        createMockAlert('landmark-1', 'critical', 'Landmark test 1'),
        createMockAlert('landmark-2', 'high', 'Landmark test 2'),
      ];

      render(
        <TestWrapper>
          <EnhancedAlertContainer />
        </TestWrapper>
      );

      // Should have proper landmark structure
      const alertRegion = screen.getByRole('region', { name: /alerts/i });
      expect(alertRegion).toBeInTheDocument();

      const navigation = screen.getByRole('navigation', { name: /alert controls/i });
      expect(navigation).toBeInTheDocument();
    });
  });
});