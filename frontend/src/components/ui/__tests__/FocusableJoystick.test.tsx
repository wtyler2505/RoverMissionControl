/**
 * Tests for FocusableJoystick Component
 * Comprehensive testing for keyboard navigation, accessibility, and focus management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FocusManagementProvider } from '../../../contexts/FocusManagementContext';
import FocusableJoystick from '../FocusableJoystick';

expect.extend(toHaveNoViolations);

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FocusManagementProvider>{children}</FocusManagementProvider>
);

const defaultProps = {
  forward: 0,
  turn: 0,
  disabled: false,
  onMove: jest.fn(),
  size: 150,
  testId: 'test-joystick',
};

describe('FocusableJoystick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('test-joystick')).toBeInTheDocument();
    });

    it('renders with correct ARIA attributes', () => {
      render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} />
        </TestWrapper>
      );
      
      const joystick = screen.getByTestId('test-joystick');
      expect(joystick).toHaveAttribute('role', 'slider');
      expect(joystick).toHaveAttribute('aria-label', 'Rover joystick control');
      expect(joystick).toHaveAttribute('aria-valuemin', '-100');
      expect(joystick).toHaveAttribute('aria-valuemax', '100');
      expect(joystick).toHaveAttribute('aria-valuenow', '0');
      expect(joystick).toHaveAttribute('tabIndex', '0');
    });

    it('renders as disabled when disabled prop is true', () => {
      render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} disabled={true} />
        </TestWrapper>
      );
      
      const joystick = screen.getByTestId('test-joystick');
      expect(joystick).toHaveAttribute('aria-disabled', 'true');
      expect(joystick).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles arrow key navigation', async () => {
      const onMove = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} onMove={onMove} />
        </TestWrapper>
      );
      
      const joystick = screen.getByTestId('test-joystick');
      await user.click(joystick);
      
      // Test forward movement
      await user.keyboard('{ArrowUp}');
      expect(onMove).toHaveBeenCalledWith(0.1, 0);
      
      // Test backward movement
      await user.keyboard('{ArrowDown}');
      expect(onMove).toHaveBeenCalledWith(-0.1, 0);
      
      // Test left turn
      await user.keyboard('{ArrowLeft}');
      expect(onMove).toHaveBeenCalledWith(0, -0.1);
      
      // Test right turn
      await user.keyboard('{ArrowRight}');
      expect(onMove).toHaveBeenCalledWith(0, 0.1);
    });

    it('centers joystick on Enter or Space', async () => {
      const onMove = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} forward={0.5} turn={0.3} onMove={onMove} />
        </TestWrapper>
      );
      
      const joystick = screen.getByTestId('test-joystick');
      await user.click(joystick);
      
      await user.keyboard('{Enter}');
      expect(onMove).toHaveBeenCalledWith(0, 0);
      
      onMove.mockClear();
      
      await user.keyboard(' ');
      expect(onMove).toHaveBeenCalledWith(0, 0);
    });

    it('does not respond to keyboard when disabled', async () => {
      const onMove = jest.fn();
      
      render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} disabled={true} onMove={onMove} />
        </TestWrapper>
      );
      
      const joystick = screen.getByTestId('test-joystick');
      
      // Should not be focusable when disabled
      expect(joystick).toHaveAttribute('tabIndex', '-1');
      
      // Try to trigger keyboard events (shouldn't work)
      fireEvent.keyDown(joystick, { key: 'ArrowUp' });
      expect(onMove).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains accessibility when disabled', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableJoystick {...defaultProps} disabled={true} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});