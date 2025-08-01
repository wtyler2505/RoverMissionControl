/**
 * AlertActions Comprehensive Test Suite
 * Master test file that ensures all aspects of the alert action system are thoroughly tested
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@emotion/react';
import { AlertActions } from './AlertActions';
import { AlertAction, ActionResult, AlertActionGroup } from '../types/AlertActionTypes';
import { defaultTheme } from '../../../../../theme/themes';
import { TestUtils, TestActionSets, TestConfig, BrowserMocks } from './AlertActions.test.config';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);

describe('AlertActions - Comprehensive Test Suite', () => {
  beforeEach(() => {
    TestUtils.mockDOMFeatures();
    TestUtils.cleanup();
  });

  afterEach(() => {
    TestUtils.cleanup();
  });

  describe('🔍 Core Functionality Tests', () => {
    it('should render all action types correctly', () => {
      const allActionTypes: AlertAction[] = [
        TestUtils.createMockAction({
          id: 'retry',
          type: 'retry',
          label: 'Retry',
          retryOperation: jest.fn(() => Promise.resolve({ success: true }))
        }),
        TestUtils.createMockAction({
          id: 'undo',
          type: 'undo',
          label: 'Undo',
          undoOperation: jest.fn(() => Promise.resolve({ success: true }))
        }),
        TestUtils.createMockAction({
          id: 'details',
          type: 'view-details',
          label: 'View Details',
          detailsUrl: '/details'
        }),
        TestUtils.createMockAction({
          id: 'navigate',
          type: 'navigate',
          label: 'Navigate',
          url: '/dashboard'
        }),
        TestUtils.createMockAction({
          id: 'dismiss',
          type: 'dismiss',
          label: 'Dismiss',
          dismissOperation: jest.fn(() => Promise.resolve({ success: true }))
        }),
        TestUtils.createMockAction({
          id: 'acknowledge',
          type: 'acknowledge',
          label: 'Acknowledge',
          acknowledgeOperation: jest.fn(() => Promise.resolve({ success: true }))
        }),
        TestUtils.createMockAction({
          id: 'custom',
          type: 'custom',
          label: 'Custom',
          execute: jest.fn(() => Promise.resolve({ success: true }))
        })
      ];

      render(
        <TestWrapper>
          <AlertActions
            actions={allActionTypes}
            alertId="all-types-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      // All action types should be rendered
      allActionTypes.forEach(action => {
        expect(screen.getByRole('button', { name: new RegExp(action.label, 'i') }))
          .toBeInTheDocument();
      });
    });

    it('should handle action execution lifecycle correctly', async () => {
      const onActionStart = jest.fn();
      const onActionComplete = jest.fn();
      const onActionError = jest.fn();
      const onActionEvent = jest.fn();

      const lifecycleAction = TestUtils.createMockAction({
        id: 'lifecycle',
        label: 'Lifecycle Test',
        execute: jest.fn(() => Promise.resolve({ success: true, message: 'Completed successfully' }))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[lifecycleAction]}
            alertId="lifecycle-test"
            alertPriority="high"
            onActionStart={onActionStart}
            onActionComplete={onActionComplete}
            onActionError={onActionError}
            onActionEvent={onActionEvent}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /lifecycle test/i });
      
      // Execute action
      await userEvent.click(button);

      // Verify complete lifecycle
      await waitFor(() => {
        expect(onActionStart).toHaveBeenCalledWith('lifecycle', expect.any(Object));
        expect(onActionComplete).toHaveBeenCalledWith('lifecycle', expect.objectContaining({
          success: true,
          message: 'Completed successfully'
        }));
        expect(onActionEvent).toHaveBeenCalled();
      });

      // Should not call error handler for successful action
      expect(onActionError).not.toHaveBeenCalled();
    });
  });

  describe('♿ Accessibility Compliance Tests', () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      const { container } = render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.accessible}
            alertId="wcag-test"
            alertPriority="high"
            ariaLabel="Alert actions"
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.accessible}
            alertId="aria-test"
            alertPriority="high"
            ariaLabel="Test actions"
            ariaDescription="Actions for the alert"
          />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      expect(container).toHaveAttribute('aria-label', 'Test actions');
      expect(container).toHaveAttribute('aria-describedby', 'Actions for the alert');

      // All buttons should have proper labels
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('should meet touch target size requirements', () => {
      BrowserMocks.mockScreenSize('mobile');

      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.basic}
            alertId="touch-target-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(TestConfig.expectations.minTouchTarget);
        expect(parseInt(computedStyle.minWidth)).toBeGreaterThanOrEqual(TestConfig.expectations.minTouchTarget);
      });
    });
  });

  describe('⌨️ Keyboard Navigation Tests', () => {
    it('should support all keyboard navigation patterns', async () => {
      const actions = TestActionSets.basic.map(action => ({
        ...action,
        shortcut: action.id === 'retry' ? 'r' : 'Escape'
      }));

      render(
        <TestWrapper>
          <AlertActions
            actions={actions}
            alertId="keyboard-test"
            alertPriority="high"
            keyboard={{
              enabled: true,
              shortcuts: { r: 'retry', Escape: 'dismiss' },
              wrapAround: true,
              announceNavigation: true
            }}
          />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });

      // Test arrow key navigation
      retryButton.focus();
      fireEvent.keyDown(retryButton, { key: 'ArrowRight' });
      expect(dismissButton).toHaveFocus();

      // Test keyboard shortcuts
      fireEvent.keyDown(document, { key: 'r' });
      await waitFor(() => {
        expect(actions[0].execute).toHaveBeenCalled();
      });
    });

    it('should handle Tab and Shift+Tab navigation', async () => {
      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.basic}
            alertId="tab-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      
      // Tab through all buttons
      buttons[0].focus();
      for (let i = 0; i < buttons.length - 1; i++) {
        await userEvent.tab();
        expect(buttons[i + 1]).toHaveFocus();
      }

      // Shift+Tab back through buttons
      for (let i = buttons.length - 1; i > 0; i--) {
        await userEvent.tab({ shift: true });
        expect(buttons[i - 1]).toHaveFocus();
      }
    });
  });

  describe('🔄 Idempotency and State Management Tests', () => {
    it('should prevent duplicate executions of idempotent actions', async () => {
      const idempotentAction = TestUtils.createMockAction({
        id: 'idempotent',
        label: 'Idempotent Action',
        idempotent: true,
        execute: jest.fn(() => new Promise(resolve => 
          setTimeout(() => resolve({ success: true }), 100)
        ))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[idempotentAction]}
            alertId="idempotent-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /idempotent action/i });
      
      // Rapid clicks should only execute once
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      await waitFor(() => {
        expect(idempotentAction.execute).toHaveBeenCalledTimes(1);
      });
    });

    it('should manage async action states correctly', async () => {
      let resolveAction: (result: ActionResult) => void;
      const asyncAction = TestUtils.createMockAction({
        id: 'async',
        label: 'Async Action',
        execute: jest.fn(() => new Promise(resolve => {
          resolveAction = resolve;
        }))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[asyncAction]}
            alertId="async-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /async action/i });
      
      // Start execution
      await userEvent.click(button);
      
      // Should show loading state
      expect(button).toHaveAttribute('data-state', 'loading');
      expect(button).toBeDisabled();

      // Complete execution
      resolveAction!({ success: true });
      
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'success');
      });
    });

    it('should respect execution limits', async () => {
      const limitedAction = TestUtils.createMockAction({
        id: 'limited',
        label: 'Limited Action',
        executionLimit: 2,
        execute: jest.fn(() => Promise.resolve({ success: true }))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[limitedAction]}
            alertId="limit-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /limited action/i });
      
      // Execute up to limit
      await userEvent.click(button);
      await waitFor(() => expect(limitedAction.execute).toHaveBeenCalledTimes(1));
      
      await userEvent.click(button);
      await waitFor(() => expect(limitedAction.execute).toHaveBeenCalledTimes(2));
      
      // Further executions should be prevented
      await userEvent.click(button);
      expect(limitedAction.execute).toHaveBeenCalledTimes(2);
      expect(button).toBeDisabled();
    });
  });

  describe('🔗 Integration Tests', () => {
    it('should integrate properly with confirmation modals', async () => {
      const destructiveAction = TestUtils.createMockAction({
        id: 'destructive',
        label: 'Delete Item',
        variant: 'danger',
        confirmation: 'destructive',
        confirmationTitle: 'Confirm Deletion',
        confirmationMessage: 'This action cannot be undone.',
        execute: jest.fn(() => Promise.resolve({ success: true }))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[destructiveAction]}
            alertId="confirmation-test"
            alertPriority="high"
            confirmations={true}
          />
        </TestWrapper>
      );

      // Click delete action
      await userEvent.click(screen.getByRole('button', { name: /delete item/i }));

      // Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
        expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
      });

      // Confirm the action
      await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(destructiveAction.execute).toHaveBeenCalled();
      });
    });

    it('should handle action groups correctly', () => {
      const actionGroups: AlertActionGroup[] = [
        TestUtils.createMockActionGroup(
          TestActionSets.basic.slice(0, 1),
          {
            id: 'primary-group',
            label: 'Primary Actions',
            priority: 'primary'
          }
        ),
        TestUtils.createMockActionGroup(
          TestActionSets.basic.slice(1),
          {
            id: 'secondary-group',
            label: 'Secondary Actions',
            priority: 'secondary'
          }
        )
      ];

      render(
        <TestWrapper>
          <AlertActions
            actions={actionGroups}
            alertId="groups-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      // Group labels should be present
      expect(screen.getByText('Primary Actions')).toBeInTheDocument();
      expect(screen.getByText('Secondary Actions')).toBeInTheDocument();

      // All actions should be present
      TestActionSets.basic.forEach(action => {
        expect(screen.getByRole('button', { name: new RegExp(action.label, 'i') }))
          .toBeInTheDocument();
      });
    });

    it('should handle overflow menu correctly', async () => {
      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.many}
            alertId="overflow-test"
            alertPriority="high"
            maxVisible={3}
          />
        </TestWrapper>
      );

      // Should show overflow menu button
      const overflowButton = screen.getByLabelText(/Show \d+ more actions/);
      expect(overflowButton).toBeInTheDocument();

      // Open overflow menu
      await userEvent.click(overflowButton);

      // Should show additional actions
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      });
    });
  });

  describe('🌐 Cross-Browser Compatibility Tests', () => {
    it('should work consistently across different browsers', async () => {
      const browsers = ['chrome', 'firefox', 'safari', 'edge'] as const;

      for (const browser of browsers) {
        BrowserMocks.mockUserAgent(browser);

        const { unmount } = render(
          <TestWrapper>
            <AlertActions
              actions={TestActionSets.basic}
              alertId={`${browser}-test`}
              alertPriority="high"
            />
          </TestWrapper>
        );

        // Should render consistently
        expect(screen.getAllByRole('button')).toHaveLength(2);

        // Should handle interactions
        const button = screen.getByRole('button', { name: /retry/i });
        await userEvent.click(button);

        await waitFor(() => {
          expect(TestActionSets.basic[0].execute).toHaveBeenCalled();
        });

        unmount();
        jest.clearAllMocks();
      }
    });

    it('should adapt to different screen sizes', () => {
      const screenSizes = ['mobile', 'tablet', 'desktop'] as const;

      screenSizes.forEach(size => {
        BrowserMocks.mockScreenSize(size);

        const { unmount } = render(
          <TestWrapper>
            <AlertActions
              actions={TestActionSets.basic}
              alertId={`${size}-test`}
              alertPriority="high"
            />
          </TestWrapper>
        );

        // Should render appropriately for screen size
        const container = screen.getByRole('group');
        expect(container).toBeInTheDocument();

        // Touch targets should be appropriate for mobile
        if (size === 'mobile') {
          const buttons = screen.getAllByRole('button');
          buttons.forEach(button => {
            const style = window.getComputedStyle(button);
            expect(parseInt(style.minHeight)).toBeGreaterThanOrEqual(44);
          });
        }

        unmount();
      });
    });

    it('should handle high contrast mode', () => {
      BrowserMocks.mockMediaQuery({
        '(prefers-contrast: high)': true
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.basic}
            alertId="high-contrast-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const style = window.getComputedStyle(button);
        expect(style.borderWidth).toBe('3px');
      });
    });

    it('should respect reduced motion preferences', () => {
      BrowserMocks.mockMediaQuery({
        '(prefers-reduced-motion: reduce)': true
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.basic}
            alertId="reduced-motion-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const style = window.getComputedStyle(button);
        expect(style.transition).toBe('none');
      });
    });
  });

  describe('⚡ Performance Tests', () => {
    it('should render efficiently with many actions', () => {
      const startTime = performance.now();

      render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.many}
            alertId="performance-test"
            alertPriority="high"
            maxVisible={5}
          />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(TestConfig.expectations.maxRenderTime);
    });

    it('should handle rapid interactions without performance degradation', async () => {
      const rapidAction = TestUtils.createMockAction({
        id: 'rapid',
        label: 'Rapid Action',
        execute: jest.fn(() => Promise.resolve({ success: true }))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[rapidAction]}
            alertId="rapid-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /rapid action/i });
      const startTime = performance.now();

      // Perform rapid interactions
      for (let i = 0; i < 10; i++) {
        await userEvent.click(button);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(TestConfig.expectations.maxActionExecutionTime);
    });

    it('should optimize re-renders', () => {
      const { rerender } = render(
        <TestWrapper>
          <AlertActions
            actions={TestActionSets.basic}
            alertId="rerender-test-1"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const startTime = performance.now();

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <AlertActions
              actions={TestActionSets.basic}
              alertId={`rerender-test-${i}`}
              alertPriority="high"
            />
          </TestWrapper>
        );
      }

      const endTime = performance.now();
      const rerenderTime = endTime - startTime;

      expect(rerenderTime).toBeLessThan(TestConfig.expectations.maxRerenderTime * 10);
    });
  });

  describe('🔧 Error Handling Tests', () => {
    it('should handle action execution errors gracefully', async () => {
      const errorAction = TestUtils.createMockAction({
        id: 'error',
        label: 'Error Action',
        execute: jest.fn(() => Promise.reject(new Error('Test error')))
      });

      const onActionError = jest.fn();

      render(
        <TestWrapper>
          <AlertActions
            actions={[errorAction]}
            alertId="error-test"
            alertPriority="high"
            onActionError={onActionError}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /error action/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith('error', expect.any(Error));
        expect(button).toHaveAttribute('data-state', 'error');
      });
    });

    it('should handle malformed actions gracefully', () => {
      const malformedActions = [
        TestUtils.createMockAction({ id: '', label: 'No ID' }), // Invalid: no ID
        TestUtils.createMockAction({ id: 'no-label', label: '' }), // Invalid: no label
        TestUtils.createMockAction({ id: 'valid', label: 'Valid Action' }) // Valid
      ];

      render(
        <TestWrapper>
          <AlertActions
            actions={malformedActions}
            alertId="malformed-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      // Should only render valid actions
      expect(screen.getByRole('button', { name: /valid action/i })).toBeInTheDocument();
      // Invalid actions should not be rendered (depending on validation logic)
    });

    it('should handle network failures', async () => {
      const networkAction = TestUtils.createMockAction({
        id: 'network',
        label: 'Network Action',
        execute: jest.fn(() => Promise.reject(new Error('Network error')))
      });

      render(
        <TestWrapper>
          <AlertActions
            actions={[networkAction]}
            alertId="network-test"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /network action/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'error');
      });
    });
  });
});