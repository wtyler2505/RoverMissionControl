/**
 * AlertActions Integration Tests
 * Tests for integration with PriorityAlert component and other alert system components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { AlertActions } from './AlertActions';
import { AlertActionConfirmationModal } from './AlertActionConfirmationModal';
import { AlertAction, ActionResult, AlertActionGroup } from '../types/AlertActionTypes';
import { defaultTheme } from '../../../../../theme/themes';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);

// Mock PriorityAlert component for integration testing
const MockPriorityAlert: React.FC<{
  actions?: AlertAction[] | AlertActionGroup[];
  onActionComplete?: (actionId: string, result: ActionResult) => void;
  onActionError?: (actionId: string, error: Error) => void;
  onDismiss?: () => void;
}> = ({ actions = [], onActionComplete, onActionError, onDismiss }) => {
  return (
    <div role="alert" aria-live="assertive">
      <div>Priority Alert Content</div>
      <AlertActions
        actions={actions}
        alertId="priority-alert"
        alertPriority="critical"
        onActionComplete={onActionComplete}
        onActionError={onActionError}
        keyboard={{ enabled: true }}
      />
    </div>
  );
};

describe('AlertActions - Integration Tests', () => {
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
      id: 'dismiss',
      type: 'dismiss',
      label: 'Dismiss',
      priority: 'tertiary',
      variant: 'ghost',
      dismissOperation: jest.fn(() => Promise.resolve({ success: true, shouldCloseAlert: true })),
      shortcut: 'Escape'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Integration with PriorityAlert', () => {
    it('should integrate seamlessly with PriorityAlert component', async () => {
      const onActionComplete = jest.fn();
      const onDismiss = jest.fn();

      render(
        <TestWrapper>
          <MockPriorityAlert
            actions={mockActions}
            onActionComplete={onActionComplete}
            onDismiss={onDismiss}
          />
        </TestWrapper>
      );

      // Alert should be present
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Priority Alert Content')).toBeInTheDocument();

      // Actions should be present
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();

      // Execute retry action
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(onActionComplete).toHaveBeenCalledWith(
          'retry',
          expect.objectContaining({ success: true })
        );
      });
    });

    it('should handle alert dismissal through actions', async () => {
      const onActionComplete = jest.fn();
      const onDismiss = jest.fn();

      render(
        <TestWrapper>
          <MockPriorityAlert
            actions={mockActions}
            onActionComplete={onActionComplete}
            onDismiss={onDismiss}
          />
        </TestWrapper>
      );

      // Execute dismiss action
      await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));

      await waitFor(() => {
        expect(onActionComplete).toHaveBeenCalledWith(
          'dismiss',
          expect.objectContaining({ 
            success: true, 
            shouldCloseAlert: true 
          })
        );
      });
    });

    it('should maintain alert accessibility with actions', async () => {
      render(
        <TestWrapper>
          <MockPriorityAlert actions={mockActions} />
        </TestWrapper>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');

      // Actions should be accessible
      const actions = screen.getAllByRole('button');
      actions.forEach(action => {
        expect(action).toHaveAttribute('aria-label');
      });
    });

    it('should handle dynamic action updates', async () => {
      const { rerender } = render(
        <TestWrapper>
          <MockPriorityAlert actions={[mockActions[0]]} />
        </TestWrapper>
      );

      // Initially only retry action
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();

      // Update to include dismiss action
      rerender(
        <TestWrapper>
          <MockPriorityAlert actions={mockActions} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });
  });

  describe('Integration with Confirmation Modal', () => {
    it('should integrate with AlertActionConfirmationModal', async () => {
      const destructiveAction: AlertAction = {
        id: 'delete',
        type: 'custom',
        label: 'Delete',
        priority: 'primary',
        variant: 'danger',
        confirmation: 'destructive',
        confirmationTitle: 'Confirm Deletion',
        confirmationMessage: 'Are you sure you want to delete this item?',
        confirmationDanger: true,
        execute: jest.fn(() => Promise.resolve({ success: true }))
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[destructiveAction]}
            alertId="test-alert"
            alertPriority="high"
            confirmations={true}
          />
        </TestWrapper>
      );

      // Click delete action
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));

      // Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
      });

      // Confirm the action
      await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

      await waitFor(() => {
        expect(destructiveAction.execute).toHaveBeenCalled();
      });
    });

    it('should handle confirmation cancellation', async () => {
      const destructiveAction: AlertAction = {
        id: 'delete',
        type: 'custom',
        label: 'Delete',
        priority: 'primary',
        variant: 'danger',
        confirmation: 'destructive',
        execute: jest.fn(() => Promise.resolve({ success: true }))
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[destructiveAction]}
            alertId="test-alert"
            alertPriority="high"
            confirmations={true}
          />
        </TestWrapper>
      );

      // Click delete action
      await userEvent.click(screen.getByRole('button', { name: /delete/i }));

      // Cancel the confirmation
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText(/confirm/i)).not.toBeInTheDocument();
      });

      expect(destructiveAction.execute).not.toHaveBeenCalled();
    });

    it('should handle complex confirmation workflows', async () => {
      const complexAction: AlertAction = {
        id: 'complex',
        type: 'custom',
        label: 'Complex Action',
        priority: 'primary',
        confirmation: 'complex',
        confirmationTitle: 'Complex Confirmation',
        confirmationMessage: 'This action requires additional verification.',
        execute: jest.fn(() => Promise.resolve({ success: true }))
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[complexAction]}
            alertId="test-alert"
            alertPriority="high"
            confirmations={true}
          />
        </TestWrapper>
      );

      // Click complex action
      await userEvent.click(screen.getByRole('button', { name: /complex action/i }));

      // Complex confirmation should appear
      await waitFor(() => {
        expect(screen.getByText('Complex Confirmation')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Action Groups', () => {
    it('should handle grouped actions properly', async () => {
      const actionGroups: AlertActionGroup[] = [
        {
          id: 'primary-group',
          label: 'Primary Actions',
          priority: 'primary',
          orientation: 'horizontal',
          actions: [
            {
              id: 'save',
              type: 'custom',
              label: 'Save',
              priority: 'primary',
              execute: jest.fn(() => Promise.resolve({ success: true }))
            },
            {
              id: 'cancel',
              type: 'custom',
              label: 'Cancel',
              priority: 'secondary',
              execute: jest.fn(() => Promise.resolve({ success: true }))
            }
          ]
        },
        {
          id: 'secondary-group',
          label: 'Secondary Actions',
          priority: 'secondary',
          orientation: 'vertical',
          actions: [
            {
              id: 'info',
              type: 'view-details',
              label: 'More Info',
              priority: 'tertiary',
              detailsUrl: '/info'
            }
          ]
        }
      ];

      render(
        <TestWrapper>
          <MockPriorityAlert actions={actionGroups} />
        </TestWrapper>
      );

      // Group labels should be present
      expect(screen.getByText('Primary Actions')).toBeInTheDocument();
      expect(screen.getByText('Secondary Actions')).toBeInTheDocument();

      // All actions should be present
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /more info/i })).toBeInTheDocument();
    });

    it('should maintain group structure with overflow', async () => {
      const manyGroupedActions: AlertActionGroup[] = [
        {
          id: 'large-group',
          label: 'Many Actions',
          priority: 'primary',
          actions: Array.from({ length: 8 }, (_, i) => ({
            id: `action-${i}`,
            type: 'custom' as const,
            label: `Action ${i}`,
            priority: 'secondary' as const,
            execute: jest.fn(() => Promise.resolve({ success: true }))
          }))
        }
      ];

      render(
        <TestWrapper>
          <AlertActions
            actions={manyGroupedActions}
            alertId="test-alert"
            alertPriority="high"
            maxVisible={4}
          />
        </TestWrapper>
      );

      // Some actions should be visible
      expect(screen.getByRole('button', { name: /action 0/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /action 1/i })).toBeInTheDocument();

      // Overflow menu should be present
      expect(screen.getByLabelText(/Show \d+ more actions/)).toBeInTheDocument();
    });
  });

  describe('Integration with Theme System', () => {
    it('should apply theme colors based on alert priority', () => {
      const criticalActions: AlertAction[] = [
        {
          id: 'critical-action',
          type: 'custom',
          label: 'Critical Action',
          priority: 'primary',
          variant: 'primary',
          execute: jest.fn(() => Promise.resolve({ success: true }))
        }
      ];

      render(
        <TestWrapper>
          <AlertActions
            actions={criticalActions}
            alertId="critical-alert"
            alertPriority="critical"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /critical action/i });
      expect(button).toHaveAttribute('data-action-priority', 'primary');
    });

    it('should handle theme changes dynamically', () => {
      const CustomThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ThemeProvider theme={{
          ...defaultTheme,
          colors: {
            ...defaultTheme.colors,
            primary: {
              ...defaultTheme.colors.primary,
              main: '#ff0000'
            }
          }
        }}>
          {children}
        </ThemeProvider>
      );

      render(
        <CustomThemeWrapper>
          <AlertActions
            actions={mockActions}
            alertId="themed-alert"
            alertPriority="high"
          />
        </CustomThemeWrapper>
      );

      // Actions should render with custom theme
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Event System', () => {
    it('should integrate with global event handling', async () => {
      const onActionStart = jest.fn();
      const onActionComplete = jest.fn();
      const onActionError = jest.fn();
      const onActionEvent = jest.fn();

      const eventAction: AlertAction = {
        id: 'event-action',
        type: 'custom',
        label: 'Event Action',
        priority: 'primary',
        execute: jest.fn(() => Promise.resolve({ success: true }))
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[eventAction]}
            alertId="event-alert"
            alertPriority="high"
            onActionStart={onActionStart}
            onActionComplete={onActionComplete}
            onActionError={onActionError}
            onActionEvent={onActionEvent}
          />
        </TestWrapper>
      );

      await userEvent.click(screen.getByRole('button', { name: /event action/i }));

      await waitFor(() => {
        expect(onActionStart).toHaveBeenCalledWith('event-action', expect.any(Object));
        expect(onActionComplete).toHaveBeenCalledWith('event-action', expect.any(Object));
        expect(onActionEvent).toHaveBeenCalled();
      });
    });

    it('should handle action events with metadata', async () => {
      const onActionEvent = jest.fn();

      const metadataAction: AlertAction = {
        id: 'metadata-action',
        type: 'custom',
        label: 'Metadata Action',
        priority: 'primary',
        metadata: { 
          source: 'test',
          category: 'integration'
        },
        execute: jest.fn(() => Promise.resolve({ success: true }))
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[metadataAction]}
            alertId="metadata-alert"
            alertPriority="high"
            context={{
              userId: 'test-user',
              sessionId: 'test-session'
            }}
            onActionEvent={onActionEvent}
          />
        </TestWrapper>
      );

      await userEvent.click(screen.getByRole('button', { name: /metadata action/i }));

      await waitFor(() => {
        expect(onActionEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            actionId: 'metadata-action',
            alertId: 'metadata-alert',
            type: expect.any(String),
            metadata: expect.any(Object)
          })
        );
      });
    });
  });

  describe('Integration with Async Operations', () => {
    it('should handle retry operations with exponential backoff', async () => {
      let attempts = 0;
      const retryOperation = jest.fn(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error(`Attempt ${attempts} failed`));
        }
        return Promise.resolve({ success: true });
      });

      const retryAction: AlertAction = {
        id: 'retry-backoff',
        type: 'retry',
        label: 'Retry with Backoff',
        priority: 'primary',
        retryOperation,
        maxRetries: 3,
        retryDelay: 100,
        exponentialBackoff: true
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[retryAction]}
            alertId="retry-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      await userEvent.click(screen.getByRole('button', { name: /retry with backoff/i }));

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(retryOperation).toHaveBeenCalledTimes(3);
      }, { timeout: 2000 });
    });

    it('should handle undo operations with time limits', async () => {
      const undoOperation = jest.fn(() => Promise.resolve({ success: true }));

      const undoAction: AlertAction = {
        id: 'timed-undo',
        type: 'undo',
        label: 'Timed Undo',
        priority: 'secondary',
        undoOperation,
        undoTimeout: 500, // 500ms to undo
        undoData: { originalValue: 'test' }
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[undoAction]}
            alertId="undo-alert"
            alertPriority="medium"
          />
        </TestWrapper>
      );

      const undoButton = screen.getByRole('button', { name: /timed undo/i });
      
      // Should be available initially
      expect(undoButton).not.toBeDisabled();

      // Wait for timeout
      await waitFor(() => {
        expect(undoButton).toBeDisabled();
      }, { timeout: 600 });
    });
  });

  describe('Cross-browser Compatibility', () => {
    it('should handle focus management across different browsers', async () => {
      // Mock different focus behaviors
      const originalFocus = HTMLElement.prototype.focus;
      HTMLElement.prototype.focus = jest.fn();

      render(
        <TestWrapper>
          <AlertActions
            actions={mockActions}
            alertId="focus-test"
            alertPriority="high"
            focus={{ autoFocus: 'retry' }}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(HTMLElement.prototype.focus).toHaveBeenCalled();
      });

      // Restore original focus
      HTMLElement.prototype.focus = originalFocus;
    });

    it('should handle keyboard events consistently', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const keyboardAction: AlertAction = {
        id: 'keyboard-test',
        type: 'custom',
        label: 'Keyboard Test',
        priority: 'primary',
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions
            actions={[keyboardAction]}
            alertId="keyboard-alert"
            alertPriority="high"
            keyboard={{ enabled: true }}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /keyboard test/i });

      // Test different key event types
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyUp(button, { key: 'Enter' });

      fireEvent.keyDown(button, { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalledTimes(2);
      });
    });
  });
});