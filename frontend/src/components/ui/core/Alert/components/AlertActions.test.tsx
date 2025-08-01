/**
 * AlertActions Component Tests
 * Comprehensive testing for action system functionality, accessibility, and edge cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { AlertActions } from './AlertActions';
import { AlertAction, ActionResult } from '../types/AlertActionTypes';
import { defaultTheme } from '../../../../../theme/themes';

// Mock the action utils
jest.mock('../utils/actionUtils', () => ({
  ...jest.requireActual('../utils/actionUtils'),
  canExecuteAction: jest.fn(() => ({ canExecute: true })),
  markActionExecuting: jest.fn(),
  markActionCompleted: jest.fn(),
  executeActionSafely: jest.fn(),
  clearActionRegistry: jest.fn(),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);

describe('AlertActions', () => {
  const mockActions: AlertAction[] = [
    {
      id: 'retry',
      type: 'retry',
      label: 'Retry',
      priority: 'primary',
      variant: 'primary',
      retryOperation: jest.fn(() => Promise.resolve({ success: true })),
      shortcut: 'r'
    },
    {
      id: 'undo',
      type: 'undo',
      label: 'Undo',
      priority: 'secondary',
      variant: 'tertiary',
      undoOperation: jest.fn(() => Promise.resolve({ success: true })),
      confirmation: 'destructive',
      shortcut: 'u'
    },
    {
      id: 'details',
      type: 'view-details',
      label: 'View Details',
      priority: 'tertiary',
      variant: 'ghost',
      detailsUrl: '/details/123'
    }
  ];

  const defaultProps = {
    actions: mockActions,
    alertId: 'test-alert',
    alertPriority: 'high',
    keyboard: { enabled: true },
    confirmations: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all actions', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });

    it('should render with proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} ariaLabel="Test actions" />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      expect(container).toHaveAttribute('aria-label', 'Test actions');
    });

    it('should not render when no actions provided', () => {
      const { container } = render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[]} />
        </TestWrapper>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render actions in stacked layout', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} layout="stacked" />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      expect(container).toHaveStyle('flex-direction: column');
    });
  });

  describe('Action Execution', () => {
    it('should execute action when clicked', async () => {
      const onActionComplete = jest.fn();
      
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} onActionComplete={onActionComplete} />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(mockActions[0].retryOperation).toHaveBeenCalled();
      });
    });

    it('should show confirmation modal for destructive actions', async () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const undoButton = screen.getByText('Undo');
      await userEvent.click(undoButton);

      // Check if confirmation modal appears
      await waitFor(() => {
        expect(screen.getByText('Confirm Undo')).toBeInTheDocument();
      });
    });

    it('should handle action execution errors', async () => {
      const errorAction: AlertAction = {
        id: 'error',
        type: 'custom',
        label: 'Error Action',
        priority: 'secondary',
        execute: jest.fn(() => Promise.reject(new Error('Test error')))
      };

      const onActionError = jest.fn();

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={[errorAction]} 
            onActionError={onActionError}
          />
        </TestWrapper>
      );

      const errorButton = screen.getByText('Error Action');
      await userEvent.click(errorButton);

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith('error', expect.any(Error));
      });
    });

    it('should prevent duplicate execution of idempotent actions', async () => {
      const idempotentAction: AlertAction = {
        id: 'idempotent',
        type: 'custom',
        label: 'Idempotent Action',
        priority: 'primary',
        idempotent: true,
        execute: jest.fn(() => Promise.resolve({ success: true }))
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[idempotentAction]} />
        </TestWrapper>
      );

      const button = screen.getByText('Idempotent Action');
      
      // Click multiple times rapidly
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      // Should only execute once due to idempotency
      await waitFor(() => {
        expect(idempotentAction.execute).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate between actions with arrow keys', async () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      
      // Focus the container
      container.focus();

      // Navigate with arrow keys
      fireEvent.keyDown(container, { key: 'ArrowRight' });
      fireEvent.keyDown(container, { key: 'ArrowRight' });

      // Should focus on the third action
      const detailsButton = screen.getByText('View Details');
      expect(detailsButton).toHaveFocus();
    });

    it('should execute action with Enter key', async () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      retryButton.focus();

      fireEvent.keyDown(retryButton, { key: 'Enter' });

      await waitFor(() => {
        expect(mockActions[0].retryOperation).toHaveBeenCalled();
      });
    });

    it('should execute action with keyboard shortcuts', async () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      container.focus();

      // Press 'r' for retry
      fireEvent.keyDown(container, { key: 'r' });

      await waitFor(() => {
        expect(mockActions[0].retryOperation).toHaveBeenCalled();
      });
    });

    it('should handle Tab navigation properly', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      const undoButton = screen.getByText('Undo');

      // Tab should move to next action
      retryButton.focus();
      fireEvent.keyDown(retryButton, { key: 'Tab' });

      expect(undoButton).toHaveFocus();
    });
  });

  describe('Focus Management', () => {
    it('should auto-focus specified action', () => {
      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            focus={{ autoFocus: 'retry' }}
          />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toHaveFocus();
    });

    it('should announce navigation for screen readers', () => {
      const announceNavigation = jest.fn();
      
      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            keyboard={{ 
              enabled: true, 
              announceNavigation: true 
            }}
          />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      fireEvent.keyDown(container, { key: 'ArrowRight' });

      // Check if announcement element is created
      expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    });
  });

  describe('Overflow Menu', () => {
    it('should show overflow menu when actions exceed maxVisible', () => {
      const manyActions = Array.from({ length: 5 }, (_, i) => ({
        id: `action-${i}`,
        type: 'custom' as const,
        label: `Action ${i}`,
        priority: 'secondary' as const,
        execute: jest.fn(() => Promise.resolve({ success: true }))
      }));

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={manyActions}
            maxVisible={3}
          />
        </TestWrapper>
      );

      // Should show first 2 actions and overflow button
      expect(screen.getByText('Action 0')).toBeInTheDocument();
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByLabelText(/Show \d+ more actions/)).toBeInTheDocument();
    });

    it('should open overflow menu when clicked', async () => {
      const manyActions = Array.from({ length: 5 }, (_, i) => ({
        id: `action-${i}`,
        type: 'custom' as const,
        label: `Action ${i}`,
        priority: 'secondary' as const,
        execute: jest.fn(() => Promise.resolve({ success: true }))
      }));

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={manyActions}
            maxVisible={3}
          />
        </TestWrapper>
      );

      const overflowButton = screen.getByLabelText(/Show \d+ more actions/);
      await userEvent.click(overflowButton);

      // Should show overflow actions
      await waitFor(() => {
        expect(screen.getByText('Action 2')).toBeInTheDocument();
        expect(screen.getByText('Action 3')).toBeInTheDocument();
        expect(screen.getByText('Action 4')).toBeInTheDocument();
      });
    });
  });

  describe('Action Groups', () => {
    it('should render action groups correctly', () => {
      const actionGroups = [
        {
          id: 'primary-group',
          label: 'Primary Actions',
          priority: 'primary' as const,
          actions: [mockActions[0]]
        },
        {
          id: 'secondary-group',
          label: 'Secondary Actions',
          priority: 'secondary' as const,
          actions: [mockActions[1], mockActions[2]]
        }
      ];

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={actionGroups} />
        </TestWrapper>
      );

      expect(screen.getByText('Primary Actions')).toBeInTheDocument();
      expect(screen.getByText('Secondary Actions')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('View Details')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during action execution', async () => {
      const slowAction: AlertAction = {
        id: 'slow',
        type: 'custom',
        label: 'Slow Action',
        priority: 'primary',
        execute: jest.fn(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[slowAction]} />
        </TestWrapper>
      );

      const button = screen.getByText('Slow Action');
      await userEvent.click(button);

      // Should show loading state
      expect(button).toHaveAttribute('data-state', 'loading');
      expect(button).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toHaveAttribute('aria-label', 'Retry (r)');
    });

    it('should have minimum touch target sizes', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = getComputedStyle(button);
        expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(40);
        expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(40);
      });
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveStyle('border-width: 3px');
      });
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion media query
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

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      // Buttons should not have transform animations
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        fireEvent.mouseEnter(button);
        expect(button).toHaveStyle('transform: none');
      });
    });
  });

  describe('Event Handling', () => {
    it('should call event handlers at appropriate times', async () => {
      const onActionStart = jest.fn();
      const onActionComplete = jest.fn();
      const onActionEvent = jest.fn();

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps}
            onActionStart={onActionStart}
            onActionComplete={onActionComplete}
            onActionEvent={onActionEvent}
          />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(onActionStart).toHaveBeenCalledWith('retry', expect.any(Object));
        expect(onActionComplete).toHaveBeenCalledWith('retry', expect.any(Object));
        expect(onActionEvent).toHaveBeenCalled();
      });
    });
  });
});