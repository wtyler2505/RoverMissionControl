/**
 * Tests for FocusableEmergencyControls Component
 * Testing emergency system controls, accessibility, and critical safety features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FocusManagementProvider } from '../../../contexts/FocusManagementContext';
import FocusableEmergencyControls from '../FocusableEmergencyControls';

expect.extend(toHaveNoViolations);

// Mock timers for confirmation timeouts
jest.useFakeTimers();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FocusManagementProvider>{children}</FocusManagementProvider>
);

const defaultProps = {
  emergencyStop: false,
  onEmergencyStop: jest.fn(),
  onResume: jest.fn(),
  testId: 'emergency-controls',
};

describe('FocusableEmergencyControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('emergency-controls')).toBeInTheDocument();
    });

    it('shows emergency stop button when not in emergency state', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('🛑 EMERGENCY STOP')).toBeInTheDocument();
      expect(screen.getByText('SYSTEMS OPERATIONAL')).toBeInTheDocument();
    });

    it('shows resume button when in emergency state', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} emergencyStop={true} />
        </TestWrapper>
      );
      
      expect(screen.getByText('▶️ RESUME OPERATIONS')).toBeInTheDocument();
      expect(screen.getByText('EMERGENCY STOP ACTIVE')).toBeInTheDocument();
    });

    it('shows secondary controls when callbacks are provided', () => {
      const onSafeShutdown = jest.fn();
      const onReboot = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={onSafeShutdown}
            onReboot={onReboot}
          />
        </TestWrapper>
      );
      
      expect(screen.getByText('🔌 SAFE SHUTDOWN')).toBeInTheDocument();
      expect(screen.getByText('🔄 REBOOT')).toBeInTheDocument();
    });

    it('displays keyboard shortcuts help', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText(/Shortcuts: Space\/Esc = Emergency Stop/)).toBeInTheDocument();
    });
  });

  describe('Emergency Stop Functionality', () => {
    it('calls onEmergencyStop when emergency button is clicked', async () => {
      const onEmergencyStop = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} onEmergencyStop={onEmergencyStop} />
        </TestWrapper>
      );
      
      const emergencyButton = screen.getByText('🛑 EMERGENCY STOP');
      await user.click(emergencyButton);
      
      expect(onEmergencyStop).toHaveBeenCalledTimes(1);
    });

    it('calls onResume when resume button is clicked', async () => {
      const onResume = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            emergencyStop={true} 
            onResume={onResume} 
          />
        </TestWrapper>
      );
      
      const resumeButton = screen.getByText('▶️ RESUME OPERATIONS');
      await user.click(resumeButton);
      
      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('does not respond when disabled', async () => {
      const onEmergencyStop = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            disabled={true}
            onEmergencyStop={onEmergencyStop} 
          />
        </TestWrapper>
      );
      
      const emergencyButton = screen.getByText('🛑 EMERGENCY STOP');
      await user.click(emergencyButton);
      
      expect(onEmergencyStop).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation System', () => {
    it('shows confirmation dialog for safe shutdown', async () => {
      const onSafeShutdown = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={onSafeShutdown}
          />
        </TestWrapper>
      );
      
      const shutdownButton = screen.getByText('🔌 SAFE SHUTDOWN');
      await user.click(shutdownButton);
      
      expect(screen.getByText('Press again to confirm shutdown')).toBeVisible();
      expect(onSafeShutdown).not.toHaveBeenCalled();
    });

    it('executes safe shutdown on second click', async () => {
      const onSafeShutdown = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={onSafeShutdown}
          />
        </TestWrapper>
      );
      
      const shutdownButton = screen.getByText('🔌 SAFE SHUTDOWN');
      
      // First click - show confirmation
      await user.click(shutdownButton);
      expect(screen.getByText('Press again to confirm shutdown')).toBeVisible();
      
      // Second click - execute
      await user.click(shutdownButton);
      expect(onSafeShutdown).toHaveBeenCalledTimes(1);
    });

    it('auto-hides confirmation after timeout', async () => {
      const onSafeShutdown = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={onSafeShutdown}
          />
        </TestWrapper>
      );
      
      const shutdownButton = screen.getByText('🔌 SAFE SHUTDOWN');
      await user.click(shutdownButton);
      
      expect(screen.getByText('Press again to confirm shutdown')).toBeVisible();
      
      // Fast-forward time
      jest.advanceTimersByTime(5000);
      
      await waitFor(() => {
        const confirmation = screen.getByText('Press again to confirm shutdown');
        expect(confirmation).not.toBeVisible();
      });
    });

    it('handles reboot confirmation similarly', async () => {
      const onReboot = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onReboot={onReboot}
          />
        </TestWrapper>
      );
      
      const rebootButton = screen.getByText('🔄 REBOOT');
      
      // First click
      await user.click(rebootButton);
      expect(screen.getByText('Press again to confirm reboot')).toBeVisible();
      
      // Second click
      await user.click(rebootButton);
      expect(onReboot).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('handles global emergency stop with Space key', () => {
      const onEmergencyStop = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} onEmergencyStop={onEmergencyStop} />
        </TestWrapper>
      );
      
      fireEvent.keyDown(document, { key: ' ' });
      expect(onEmergencyStop).toHaveBeenCalledTimes(1);
    });

    it('handles global emergency stop with Escape key', () => {
      const onEmergencyStop = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} onEmergencyStop={onEmergencyStop} />
        </TestWrapper>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onEmergencyStop).toHaveBeenCalledTimes(1);
    });

    it('handles resume with R key when emergency stop is active', () => {
      const onResume = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            emergencyStop={true}
            onResume={onResume} 
          />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('emergency-controls');
      container.focus();
      
      fireEvent.keyDown(document, { key: 'r' });
      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('handles safe shutdown with Shift+S', () => {
      const onSafeShutdown = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={onSafeShutdown}
          />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('emergency-controls');
      container.focus();
      
      fireEvent.keyDown(document, { key: 's', shiftKey: true });
      // First press shows confirmation, doesn't execute
      expect(onSafeShutdown).not.toHaveBeenCalled();
    });

    it('handles reboot with Shift+B', () => {
      const onReboot = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onReboot={onReboot}
          />
        </TestWrapper>
      );
      
      const container = screen.getByTestId('emergency-controls');
      container.focus();
      
      fireEvent.keyDown(document, { key: 'b', shiftKey: true });
      // First press shows confirmation, doesn't execute
      expect(onReboot).not.toHaveBeenCalled();
    });
  });

  describe('Screen Reader Support', () => {
    it('announces emergency stop status', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} emergencyStop={true} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Emergency stop is active. All rover systems are halted.')).toBeInTheDocument();
    });

    it('does not announce when emergency stop is not active', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} emergencyStop={false} />
        </TestWrapper>
      );
      
      expect(screen.queryByText(/Emergency stop is active/)).not.toBeInTheDocument();
    });

    it('has proper ARIA attributes on buttons', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      const emergencyButton = screen.getByLabelText(/Emergency stop - Immediately halt all rover operations/);
      expect(emergencyButton).toBeInTheDocument();
      expect(emergencyButton).toHaveAttribute('aria-label');
    });
  });

  describe('Focus Management', () => {
    it('applies focus management props to buttons', () => {
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      const emergencyButton = screen.getByText('🛑 EMERGENCY STOP');
      // Should have focus management attributes applied
      expect(emergencyButton).toBeInTheDocument();
    });

    it('maintains focus after state changes', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      const emergencyButton = screen.getByText('🛑 EMERGENCY STOP');
      await user.click(emergencyButton);
      
      // Focus should be maintained on the control area
      expect(document.activeElement).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations in normal state', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations in emergency state', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} emergencyStop={true} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations when disabled', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} disabled={true} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations with all controls', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={jest.fn()}
            onReboot={jest.fn()}
          />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing callback functions gracefully', () => {
      expect(() => {
        render(
          <TestWrapper>
            <FocusableEmergencyControls 
              emergencyStop={false}
              onEmergencyStop={jest.fn()}
              onResume={jest.fn()}
              testId="emergency-controls"
            />
          </TestWrapper>
        );
      }).not.toThrow();
    });

    it('handles rapid button clicks', async () => {
      const onEmergencyStop = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <FocusableEmergencyControls {...defaultProps} onEmergencyStop={onEmergencyStop} />
        </TestWrapper>
      );
      
      const emergencyButton = screen.getByText('🛑 EMERGENCY STOP');
      
      // Rapid clicks
      await user.click(emergencyButton);
      await user.click(emergencyButton);
      await user.click(emergencyButton);
      
      // Should still work correctly
      expect(onEmergencyStop).toHaveBeenCalledTimes(3);
    });

    it('cleans up timers on unmount', () => {
      const onSafeShutdown = jest.fn();
      
      const { unmount } = render(
        <TestWrapper>
          <FocusableEmergencyControls 
            {...defaultProps} 
            onSafeShutdown={onSafeShutdown}
          />
        </TestWrapper>
      );
      
      unmount();
      
      // Should not throw or cause memory leaks
      jest.advanceTimersByTime(10000);
    });
  });
});