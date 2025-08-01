/**
 * Comprehensive Tests for Undo Functionality with Expiration Timers
 * Tests AlertUndoManager, expiration handling, and undo workflows
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
  DismissalAction,
  UndoManager 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';
import AlertUndoManager from '../components/AlertUndoManager';

// Mock timers for controlled testing
jest.useFakeTimers();

// Mock performance.now for consistent timing
global.performance.now = jest.fn(() => Date.now());

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
    source?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  }
): ProcessedAlert => ({
  id,
  priority,
  queuedAt: options?.timestamp || new Date(),
  processAfter: new Date(),
  metadata: { 
    source: options?.source || 'test',
    ...options?.metadata 
  },
  data: {
    message,
    title: options?.title || `Alert ${id}`,
    closable: true,
  },
});

// Helper to create mock dismissal actions
const createMockDismissalAction = (
  type: DismissalType,
  alertIds: string[],
  options?: {
    groupIds?: string[];
    user?: string;
    reason?: string;
    undoable?: boolean;
    undoExpiresAt?: Date;
  }
): DismissalAction => ({
  type,
  alertIds,
  groupIds: options?.groupIds,
  timestamp: new Date(),
  user: options?.user || 'test-user',
  reason: options?.reason,
  undoable: options?.undoable !== false,
  undoExpiresAt: options?.undoExpiresAt || new Date(Date.now() + 5 * 60 * 1000), // 5 minutes default
});

describe('Undo Functionality', () => {
  let mockOnUndo: jest.Mock;
  let groupingManager: EnhancedAlertGroupingManager;
  let testAlerts: ProcessedAlert[];

  beforeEach(() => {
    mockOnUndo = jest.fn().mockResolvedValue(true);
    groupingManager = new EnhancedAlertGroupingManager({
      maxGroups: 10,
      undoHistorySize: 50,
    });

    testAlerts = [
      createMockAlert('1', 'critical', 'Critical error'),
      createMockAlert('2', 'high', 'High priority warning'),
      createMockAlert('3', 'medium', 'Medium notification'),
      createMockAlert('4', 'low', 'Low priority info'),
    ];

    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Basic Undo Manager Interface', () => {
    it('should render undo manager when there are undoable actions', async () => {
      // Add some dismissal actions to the manager
      const action = createMockDismissalAction('manual', ['1', '2']);
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Undo Available')).toBeInTheDocument();
      expect(screen.getByText(/dismissed 2 alerts/)).toBeInTheDocument();
    });

    it('should not render when there are no undoable actions', () => {
      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.queryByText('Undo Available')).not.toBeInTheDocument();
    });

    it('should show multiple undoable actions', async () => {
      const actions = [
        createMockDismissalAction('manual', ['1'], { reason: 'Manual dismissal' }),
        createMockDismissalAction('bulk', ['2', '3'], { reason: 'Bulk cleanup' }),
        createMockDismissalAction('timed', ['4'], { reason: 'Scheduled dismissal' }),
      ];

      actions.forEach(action => {
        groupingManager['undoManager'].actions.push(action);
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="bottom-right"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText('3 actions available')).toBeInTheDocument();
    });

    it('should display action details in tooltip or expanded view', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const action = createMockDismissalAction('manual', ['1', '2'], {
        reason: 'Resolved by admin',
        user: 'admin-user',
      });
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoCard = screen.getByTestId('undo-card');
      await user.hover(undoCard);

      await waitFor(() => {
        expect(screen.getByText(/resolved by admin/i)).toBeInTheDocument();
        expect(screen.getByText(/admin-user/i)).toBeInTheDocument();
      });
    });
  });

  describe('Expiration Timer Display', () => {
    it('should show countdown timer for actions approaching expiration', async () => {
      const expirationTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
      const action = createMockDismissalAction('manual', ['1'], {
        undoExpiresAt: expirationTime,
      });
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/expires in 2m/)).toBeInTheDocument();
    });

    it('should update countdown timer in real-time', async () => {
      const expirationTime = new Date(Date.now() + 90 * 1000); // 90 seconds
      const action = createMockDismissalAction('manual', ['1'], {
        undoExpiresAt: expirationTime,
      });
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/expires in 1m 30s/)).toBeInTheDocument();

      // Advance time by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(screen.getByText(/expires in 1m/)).toBeInTheDocument();
      });

      // Advance another 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(screen.getByText(/expires in 30s/)).toBeInTheDocument();
      });
    });

    it('should show urgency indicators as expiration approaches', async () => {
      const expirationTime = new Date(Date.now() + 15 * 1000); // 15 seconds
      const action = createMockDismissalAction('manual', ['1'], {
        undoExpiresAt: expirationTime,
      });
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoCard = screen.getByTestId('undo-card');
      
      // Should show urgent styling (red color, pulsing animation)
      expect(undoCard).toHaveClass('urgent');
      expect(screen.getByText(/expires in 15s/)).toBeInTheDocument();
    });

    it('should remove expired actions automatically', async () => {
      const expiredTime = new Date(Date.now() - 1000); // Already expired
      const validTime = new Date(Date.now() + 60000); // 1 minute from now

      const expiredAction = createMockDismissalAction('manual', ['1'], {
        undoExpiresAt: expiredTime,
      });
      const validAction = createMockDismissalAction('manual', ['2'], {
        undoExpiresAt: validTime,
      });

      groupingManager['undoManager'].actions.push(expiredAction, validAction);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Should only show the valid action
      expect(screen.getByText(/dismissed 1 alert/)).toBeInTheDocument();
      expect(screen.queryByText(/dismissed 2 alerts/)).not.toBeInTheDocument();
    });

    it('should handle actions with no expiration time', async () => {
      const permanentAction = createMockDismissalAction('manual', ['1'], {
        undoExpiresAt: undefined,
      });
      groupingManager['undoManager'].actions.push(permanentAction);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText('No expiration')).toBeInTheDocument();
    });
  });

  describe('Undo Execution', () => {
    it('should execute undo for single action', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const action = createMockDismissalAction('manual', ['1', '2']);
      const actionId = action.timestamp.getTime().toString();
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      expect(mockOnUndo).toHaveBeenCalledWith(actionId);
    });

    it('should show confirmation dialog for bulk undos', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const bulkAction = createMockDismissalAction('bulk', ['1', '2', '3', '4'], {
        groupIds: ['group1', 'group2'],
        reason: 'Bulk cleanup',
      });
      groupingManager['undoManager'].actions.push(bulkAction);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      // Should show confirmation dialog
      expect(screen.getByText('Confirm Undo')).toBeInTheDocument();
      expect(screen.getByText(/4 alerts and 2 groups/)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm undo/i });
      await user.click(confirmButton);

      const actionId = bulkAction.timestamp.getTime().toString();
      expect(mockOnUndo).toHaveBeenCalledWith(actionId);
    });

    it('should handle undo failures gracefully', async () => {
      const failingUndo = jest.fn().mockRejectedValue(new Error('Undo failed'));
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const action = createMockDismissalAction('manual', ['1']);
      groupingManager['undoManager'].actions.push(action);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={failingUndo}
          />
        </TestWrapper>
      );

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(failingUndo).toHaveBeenCalled();
      });

      // Should show error message
      expect(screen.getByText(/undo failed/i)).toBeInTheDocument();

      // Action should remain in the list for retry
      expect(screen.getByText(/dismissed 1 alert/)).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should remove action from list after successful undo', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const action = createMockDismissalAction('manual', ['1']);
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      await waitFor(() => {
        expect(mockOnUndo).toHaveBeenCalled();
      });

      // Manager should be hidden after successful undo
      expect(screen.queryByText('Undo Available')).not.toBeInTheDocument();
    });
  });

  describe('Multiple Actions Management', () => {
    it('should display actions in chronological order (newest first)', async () => {
      const oldAction = createMockDismissalAction('manual', ['1'], {
        reason: 'Old action',
      });
      // Set older timestamp
      oldAction.timestamp = new Date(Date.now() - 60000); // 1 minute ago

      const newAction = createMockDismissalAction('manual', ['2'], {
        reason: 'New action',
      });

      groupingManager['undoManager'].actions.push(oldAction, newAction);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const actionCards = screen.getAllByTestId(/undo-card/);
      expect(actionCards).toHaveLength(2);

      // First card should be the newer action
      expect(actionCards[0]).toHaveTextContent('New action');
      expect(actionCards[1]).toHaveTextContent('Old action');
    });

    it('should support expanding/collapsing multiple actions view', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const actions = Array.from({ length: 5 }, (_, i) =>
        createMockDismissalAction('manual', [`${i + 1}`], {
          reason: `Action ${i + 1}`,
        })
      );

      actions.forEach(action => {
        groupingManager['undoManager'].actions.push(action);
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText('5 actions available')).toBeInTheDocument();

      // Should show only the most recent action by default
      expect(screen.getAllByTestId(/undo-card/)).toHaveLength(1);

      // Expand to show all actions
      const expandButton = screen.getByRole('button', { name: /show all/i });
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getAllByTestId(/undo-card/)).toHaveLength(5);
      });

      // Collapse back
      const collapseButton = screen.getByRole('button', { name: /show recent/i });
      await user.click(collapseButton);

      await waitFor(() => {
        expect(screen.getAllByTestId(/undo-card/)).toHaveLength(1);
      });
    });

    it('should allow undoing specific actions from the list', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const actions = [
        createMockDismissalAction('manual', ['1'], { reason: 'First action' }),
        createMockDismissalAction('bulk', ['2', '3'], { reason: 'Second action' }),
        createMockDismissalAction('timed', ['4'], { reason: 'Third action' }),
      ];

      actions.forEach(action => {
        groupingManager['undoManager'].actions.push(action);
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Expand to show all actions
      const expandButton = screen.getByRole('button', { name: /show all/i });
      await user.click(expandButton);

      // Undo the second action specifically
      const secondActionCard = screen.getByText('Second action').closest('[data-testid="undo-card"]');
      const undoButton = secondActionCard?.querySelector('button[aria-label*="undo"]');
      
      await user.click(undoButton!);

      const actionId = actions[1].timestamp.getTime().toString();
      expect(mockOnUndo).toHaveBeenCalledWith(actionId);
    });

    it('should handle undo history size limits', async () => {
      const limitedManager = new EnhancedAlertGroupingManager({
        undoHistorySize: 3,
      });

      // Add more actions than the limit
      const actions = Array.from({ length: 5 }, (_, i) =>
        createMockDismissalAction('manual', [`${i + 1}`])
      );

      actions.forEach(action => {
        limitedManager['undoManager'].actions.push(action);
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={limitedManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Should only show the limit number of actions
      expect(screen.getByText('3 actions available')).toBeInTheDocument();
    });
  });

  describe('Position and Layout', () => {
    it('should render in different positions correctly', () => {
      const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

      positions.forEach(position => {
        const action = createMockDismissalAction('manual', ['1']);
        const manager = new EnhancedAlertGroupingManager();
        manager['undoManager'].actions.push(action);

        const { unmount } = render(
          <TestWrapper>
            <AlertUndoManager
              groupingManager={manager}
              position={position}
              onUndo={mockOnUndo}
            />
          </TestWrapper>
        );

        const undoContainer = screen.getByTestId('undo-manager');
        expect(undoContainer).toHaveClass(`position-${position}`);

        unmount();
      });
    });

    it('should handle responsive layout on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 320 });
      Object.defineProperty(window, 'innerHeight', { value: 568 });

      const action = createMockDismissalAction('manual', ['1']);
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="bottom-center"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoContainer = screen.getByTestId('undo-manager');
      expect(undoContainer).toHaveClass('mobile-layout');
    });

    it('should avoid overlapping with other UI elements', () => {
      const action = createMockDismissalAction('manual', ['1']);
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <div data-testid="other-element" style={{ position: 'fixed', bottom: '20px', right: '20px' }}>
            Other Element
          </div>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="bottom-right"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoContainer = screen.getByTestId('undo-manager');
      const otherElement = screen.getByTestId('other-element');

      // Should have higher z-index or different positioning to avoid overlap
      const undoZIndex = window.getComputedStyle(undoContainer).zIndex;
      expect(parseInt(undoZIndex)).toBeGreaterThan(1000);
    });
  });

  describe('Integration with Grouping Manager', () => {
    it('should sync with grouping manager undo operations', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Dismiss an alert through the grouping manager
      await act(async () => {
        await groupingManager.dismissAlert('test-alert', 'manual', { 
          reason: 'Test dismissal',
          user: 'test-user',
        });
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Undo Available')).toBeInTheDocument();
      expect(screen.getByText(/test dismissal/i)).toBeInTheDocument();
    });

    it('should handle bulk dismissal undos correctly', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      // Perform bulk dismissal through the grouping manager
      await act(async () => {
        await groupingManager.bulkDismiss(
          { alertIds: ['1', '2', '3'], groupIds: ['group1'] },
          'bulk',
          { reason: 'Bulk cleanup', user: 'admin' }
        );
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/dismissed 3 alerts/)).toBeInTheDocument();
      expect(screen.getByText(/1 group/)).toBeInTheDocument();
    });

    it('should clean up expired actions through manager integration', () => {
      const expiredAction = createMockDismissalAction('manual', ['1'], {
        undoExpiresAt: new Date(Date.now() - 1000), // Expired
      });
      groupingManager['undoManager'].actions.push(expiredAction);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Trigger cleanup through the manager
      act(() => {
        groupingManager['undoManager'].clearExpired();
      });

      // Should not show any actions
      expect(screen.queryByText('Undo Available')).not.toBeInTheDocument();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of undo actions efficiently', () => {
      const largeActionSet = Array.from({ length: 100 }, (_, i) =>
        createMockDismissalAction('manual', [`alert-${i}`])
      );

      largeActionSet.forEach(action => {
        groupingManager['undoManager'].actions.push(action);
      });

      const startTime = Date.now();

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const endTime = Date.now();

      // Should render efficiently
      expect(endTime - startTime).toBeLessThan(1000);
      expect(screen.getByText('100 actions available')).toBeInTheDocument();
    });

    it('should handle rapid undo operations without race conditions', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const actions = Array.from({ length: 3 }, (_, i) =>
        createMockDismissalAction('manual', [`alert-${i}`])
      );

      actions.forEach(action => {
        groupingManager['undoManager'].actions.push(action);
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Expand to show all actions
      const expandButton = screen.getByRole('button', { name: /show all/i });
      await user.click(expandButton);

      // Rapidly click multiple undo buttons
      const undoButtons = screen.getAllByRole('button', { name: /undo/i });
      
      await Promise.all(
        undoButtons.map(async button => {
          await user.click(button);
        })
      );

      // Should handle all requests without issues
      expect(mockOnUndo).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed undo actions gracefully', () => {
      const malformedAction = {
        type: 'invalid' as DismissalType,
        alertIds: null as any,
        timestamp: new Date(),
        undoable: true,
      } as DismissalAction;

      groupingManager['undoManager'].actions.push(malformedAction);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Should not crash and should handle gracefully
      expect(screen.getByTestId('test-wrapper')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should provide proper ARIA labels and roles', () => {
      const action = createMockDismissalAction('manual', ['1']);
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('region', { name: /undo manager/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const actions = Array.from({ length: 3 }, (_, i) =>
        createMockDismissalAction('manual', [`alert-${i}`])
      );

      actions.forEach(action => {
        groupingManager['undoManager'].actions.push(action);
      });

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      // Should be able to navigate with Tab and activate with Enter/Space
      const undoButton = screen.getByRole('button', { name: /undo/i });
      undoButton.focus();

      await user.keyboard('{Enter}');
      expect(mockOnUndo).toHaveBeenCalled();
    });

    it('should announce undo status to screen readers', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const action = createMockDismissalAction('manual', ['1']);
      groupingManager['undoManager'].actions.push(action);

      render(
        <TestWrapper>
          <AlertUndoManager
            groupingManager={groupingManager}
            position="top-left"
            onUndo={mockOnUndo}
          />
        </TestWrapper>
      );

      const undoButton = screen.getByRole('button', { name: /undo/i });
      await user.click(undoButton);

      // Should have live region announcing the undo
      expect(screen.getByRole('status')).toHaveTextContent(/undo completed/i);
    });
  });
});