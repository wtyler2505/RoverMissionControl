/**
 * AlertActions Idempotency and Action State Tests
 * Tests for preventing duplicate executions and managing async action states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { AlertActions } from './AlertActions';
import { AlertAction, ActionResult, ActionState } from '../types/AlertActionTypes';
import { defaultTheme } from '../../../../../theme/themes';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);

// Mock action utils to control execution behavior
jest.mock('../utils/actionUtils', () => ({
  ...jest.requireActual('../utils/actionUtils'),
  canExecuteAction: jest.fn(),
  markActionExecuting: jest.fn(),
  markActionCompleted: jest.fn(),
  executeActionSafely: jest.fn(),
  clearActionRegistry: jest.fn(),
}));

describe('AlertActions - Idempotency and Action State Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    const { canExecuteAction, executeActionSafely } = require('../utils/actionUtils');
    canExecuteAction.mockReturnValue({ canExecute: true });
    executeActionSafely.mockImplementation((action, context, onEvent) => {
      if (action.execute) {
        return action.execute(context);
      }
      if (action.retryOperation) {
        return action.retryOperation();
      }
      if (action.undoOperation) {
        return action.undoOperation();
      }
      return Promise.resolve({ success: true });
    });
  });

  describe('Idempotent Action Handling', () => {
    it('should prevent duplicate execution of idempotent actions', async () => {
      const executeFunction = jest.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );
      
      const idempotentAction: AlertAction = {
        id: 'idempotent',
        type: 'custom',
        label: 'Idempotent Action',
        priority: 'primary',
        idempotent: true,
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[idempotentAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /idempotent action/i });
      
      // Click multiple times rapidly
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      // Wait for any executions to complete
      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalledTimes(1);
      });
    });

    it('should respect execution limits', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      
      const limitedAction: AlertAction = {
        id: 'limited',
        type: 'custom',
        label: 'Limited Action',
        priority: 'primary',
        executionLimit: 2,
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[limitedAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /limited action/i });
      
      // Execute up to the limit
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(1));
      
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(2));
      
      // Third execution should be prevented
      await userEvent.click(button);
      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalledTimes(2);
      });

      // Button should be disabled after reaching limit
      expect(button).toBeDisabled();
    });

    it('should track execution count across rerenders', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      
      const trackingAction: AlertAction = {
        id: 'tracking',
        type: 'custom',
        label: 'Tracking Action',
        priority: 'primary',
        executionLimit: 3,
        executionCount: 1, // Already executed once
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[trackingAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /tracking action/i });
      
      // Should allow 2 more executions (1 already done + 2 = 3 limit)
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(1));
      
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(2));
      
      // Third execution should be prevented
      await userEvent.click(button);
      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle concurrent action attempts', async () => {
      let resolveExecution: (result: ActionResult) => void;
      const executeFunction = jest.fn(() => 
        new Promise(resolve => {
          resolveExecution = resolve;
        })
      );
      
      const concurrentAction: AlertAction = {
        id: 'concurrent',
        type: 'custom',
        label: 'Concurrent Action',
        priority: 'primary',
        idempotent: true,
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[concurrentAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /concurrent action/i });
      
      // Start multiple executions concurrently
      const promise1 = userEvent.click(button);
      const promise2 = userEvent.click(button);
      const promise3 = userEvent.click(button);

      await Promise.all([promise1, promise2, promise3]);

      // Only one execution should start
      expect(executeFunction).toHaveBeenCalledTimes(1);

      // Complete the execution
      resolveExecution!({ success: true });
      
      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset execution tracking for non-idempotent actions', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      
      const nonIdempotentAction: AlertAction = {
        id: 'non-idempotent',
        type: 'custom',
        label: 'Non-Idempotent Action',
        priority: 'primary',
        idempotent: false,
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[nonIdempotentAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /non-idempotent action/i });
      
      // Should allow multiple executions
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(1));
      
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(2));
      
      await userEvent.click(button);
      await waitFor(() => expect(executeFunction).toHaveBeenCalledTimes(3));
    });
  });

  describe('Async Action States', () => {
    it('should show loading state during execution', async () => {
      let resolveExecution: (result: ActionResult) => void;
      const executeFunction = jest.fn(() => 
        new Promise(resolve => {
          resolveExecution = resolve;
        })
      );
      
      const asyncAction: AlertAction = {
        id: 'async',
        type: 'custom',
        label: 'Async Action',
        priority: 'primary',
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[asyncAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /async action/i });
      
      await userEvent.click(button);

      // Should show loading state
      expect(button).toHaveAttribute('data-state', 'loading');
      expect(button).toBeDisabled();

      // Complete the execution
      resolveExecution!({ success: true });
      
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'success');
      });
    });

    it('should show success state after successful execution', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      
      const successAction: AlertAction = {
        id: 'success',
        type: 'custom',
        label: 'Success Action',
        priority: 'primary',
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[successAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /success action/i });
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'success');
      });

      // Should reset to idle after success animation
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'idle');
      }, { timeout: 500 });
    });

    it('should show error state after failed execution', async () => {
      const executeFunction = jest.fn(() => Promise.reject(new Error('Test error')));
      
      const errorAction: AlertAction = {
        id: 'error',
        type: 'custom',
        label: 'Error Action',
        priority: 'primary',
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[errorAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /error action/i });
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'error');
      });

      // Should reset to idle after error display
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'idle');
      }, { timeout: 2500 });
    });

    it('should handle action timeouts', async () => {
      const executeFunction = jest.fn(() => 
        new Promise(resolve => {
          // Never resolve - simulate timeout
        })
      );
      
      const timeoutAction: AlertAction = {
        id: 'timeout',
        type: 'custom',
        label: 'Timeout Action',
        priority: 'primary',
        timeout: 100, // 100ms timeout
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[timeoutAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /timeout action/i });
      
      await userEvent.click(button);

      // Should show loading initially
      expect(button).toHaveAttribute('data-state', 'loading');

      // Should show error state after timeout
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'error');
      }, { timeout: 200 });
    });

    it('should handle state transitions correctly', async () => {
      const states: ActionState[] = [];
      let resolveExecution: (result: ActionResult) => void;
      
      const executeFunction = jest.fn(() => 
        new Promise(resolve => {
          resolveExecution = resolve;
        })
      );
      
      const stateTrackingAction: AlertAction = {
        id: 'state-tracking',
        type: 'custom',
        label: 'State Tracking Action',
        priority: 'primary',
        execute: executeFunction
      };

      const onStateChange = jest.fn((actionId: string, state: ActionState) => {
        states.push(state);
      });

      render(
        <TestWrapper>
          <AlertActions 
            actions={[stateTrackingAction]}
            alertId="test-alert"
            alertPriority="high"
            onStateChange={onStateChange}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /state tracking action/i });
      
      // Initial state should be idle
      expect(button).toHaveAttribute('data-state', 'idle');
      
      await userEvent.click(button);

      // Should transition to loading
      expect(button).toHaveAttribute('data-state', 'loading');

      // Complete execution
      resolveExecution!({ success: true });
      
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'success');
      });

      // Should eventually return to idle
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'idle');
      }, { timeout: 500 });
    });

    it('should prevent execution during loading state', async () => {
      let resolveExecution: (result: ActionResult) => void;
      const executeFunction = jest.fn(() => 
        new Promise(resolve => {
          resolveExecution = resolve;
        })
      );
      
      const loadingAction: AlertAction = {
        id: 'loading',
        type: 'custom',
        label: 'Loading Action',
        priority: 'primary',
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[loadingAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /loading action/i });
      
      // Start execution
      await userEvent.click(button);
      expect(button).toHaveAttribute('data-state', 'loading');

      // Try to execute again while loading
      await userEvent.click(button);
      
      // Should only have been called once
      expect(executeFunction).toHaveBeenCalledTimes(1);

      // Complete execution
      resolveExecution!({ success: true });
      
      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'success');
      });
    });
  });

  describe('Action Result Handling', () => {
    it('should handle shouldCloseAlert result flag', async () => {
      const executeFunction = jest.fn(() => 
        Promise.resolve({ 
          success: true, 
          shouldCloseAlert: true 
        })
      );
      
      const closingAction: AlertAction = {
        id: 'closing',
        type: 'custom',
        label: 'Closing Action',
        priority: 'primary',
        execute: executeFunction
      };

      const onActionComplete = jest.fn();

      render(
        <TestWrapper>
          <AlertActions 
            actions={[closingAction]}
            alertId="test-alert"
            alertPriority="high"
            onActionComplete={onActionComplete}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /closing action/i });
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(onActionComplete).toHaveBeenCalledWith(
          'closing',
          expect.objectContaining({
            success: true,
            shouldCloseAlert: true
          })
        );
      });
    });

    it('should handle shouldDismissAction result flag', async () => {
      const executeFunction = jest.fn(() => 
        Promise.resolve({ 
          success: true, 
          shouldDismissAction: true 
        })
      );
      
      const dismissingAction: AlertAction = {
        id: 'dismissing',
        type: 'custom',
        label: 'Dismissing Action',
        priority: 'primary',
        execute: executeFunction
      };

      const onActionComplete = jest.fn();

      render(
        <TestWrapper>
          <AlertActions 
            actions={[dismissingAction]}
            alertId="test-alert"
            alertPriority="high"
            onActionComplete={onActionComplete}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /dismissing action/i });
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(onActionComplete).toHaveBeenCalledWith(
          'dismissing',
          expect.objectContaining({
            success: true,
            shouldDismissAction: true
          })
        );
      });
    });

    it('should handle custom result messages', async () => {
      const executeFunction = jest.fn(() => 
        Promise.resolve({ 
          success: true, 
          message: 'Custom success message',
          data: { customField: 'value' }
        })
      );
      
      const messageAction: AlertAction = {
        id: 'message',
        type: 'custom',
        label: 'Message Action',
        priority: 'primary',
        execute: executeFunction
      };

      const onActionComplete = jest.fn();

      render(
        <TestWrapper>
          <AlertActions 
            actions={[messageAction]}
            alertId="test-alert"
            alertPriority="high"
            onActionComplete={onActionComplete}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /message action/i });
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(onActionComplete).toHaveBeenCalledWith(
          'message',
          expect.objectContaining({
            success: true,
            message: 'Custom success message',
            data: { customField: 'value' }
          })
        );
      });
    });
  });

  describe('Action Registry Management', () => {
    it('should track action executions globally', async () => {
      const { canExecuteAction, markActionExecuting, markActionCompleted } = require('../utils/actionUtils');
      
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      
      const trackedAction: AlertAction = {
        id: 'tracked',
        type: 'custom',
        label: 'Tracked Action',
        priority: 'primary',
        idempotent: true,
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[trackedAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /tracked action/i });
      
      await userEvent.click(button);

      expect(canExecuteAction).toHaveBeenCalledWith(trackedAction, 'test-alert');
      expect(markActionExecuting).toHaveBeenCalledWith('tracked', 'test-alert');
      
      await waitFor(() => {
        expect(markActionCompleted).toHaveBeenCalledWith(
          'tracked', 
          'test-alert', 
          expect.objectContaining({ success: true })
        );
      });
    });

    it('should respect global execution limits', async () => {
      const { canExecuteAction } = require('../utils/actionUtils');
      
      // Mock registry to prevent execution
      canExecuteAction.mockReturnValue({
        canExecute: false,
        reason: 'Action already executing'
      });
      
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      
      const blockedAction: AlertAction = {
        id: 'blocked',
        type: 'custom',
        label: 'Blocked Action',
        priority: 'primary',
        execute: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            actions={[blockedAction]}
            alertId="test-alert"
            alertPriority="high"
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /blocked action/i });
      
      await userEvent.click(button);

      // Should not execute due to registry blocking
      expect(executeFunction).not.toHaveBeenCalled();
    });
  });
});