/**
 * Tests for FocusableGauge Component
 * Testing gauge accessibility, focus management, and telemetry display
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FocusManagementProvider } from '../../../contexts/FocusManagementContext';
import FocusableGauge from '../FocusableGauge';

expect.extend(toHaveNoViolations);

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FocusManagementProvider>{children}</FocusManagementProvider>
);

const defaultProps = {
  value: 75,
  min: 0,
  max: 100,
  unit: '%',
  label: 'Test Battery',
  type: 'battery' as const,
  testId: 'test-gauge',
};

describe('FocusableGauge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('test-gauge')).toBeInTheDocument();
    });

    it('displays correct value and unit', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('75.0')).toBeInTheDocument();
      expect(screen.getByText('%')).toBeInTheDocument();
    });

    it('displays correct label', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Test Battery')).toBeInTheDocument();
    });

    it('renders with correct ARIA attributes', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('role', 'meter');
      expect(gauge).toHaveAttribute('aria-valuemin', '0');
      expect(gauge).toHaveAttribute('aria-valuemax', '100');
      expect(gauge).toHaveAttribute('aria-valuenow', '75');
      expect(gauge).toHaveAttribute('aria-label', 'Test Battery gauge');
    });
  });

  describe('Status Calculation', () => {
    it('shows good status for battery above 60%', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={80} type="battery" />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuetext', '80.0 % - good level');
    });

    it('shows warning status for battery between 30-60%', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={45} type="battery" />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuetext', '45.0 % - warning level');
    });

    it('shows critical status for battery below 30%', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={20} type="battery" />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuetext', '20.0 % - critical level');
    });

    it('handles temperature type correctly', () => {
      render(
        <TestWrapper>
          <FocusableGauge 
            {...defaultProps} 
            value={85} 
            max={100} 
            type="temperature" 
            unit="°C"
            label="CPU Temperature"
          />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuetext', '85.0 °C - critical level');
    });

    it('uses custom thresholds when provided', () => {
      const customThresholds = {
        good: 80,
        warning: 60,
        critical: 40,
      };
      
      render(
        <TestWrapper>
          <FocusableGauge 
            {...defaultProps} 
            value={70} 
            thresholds={customThresholds}
          />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuetext', '70.0 % - warning level');
    });
  });

  describe('Focus Management', () => {
    it('shows detailed info on focus when focusable', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} focusable={true} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      await user.click(gauge);
      
      await waitFor(() => {
        expect(screen.getByText(/Status: Good/)).toBeVisible();
        expect(screen.getByText(/Range: 0-100 %/)).toBeVisible();
        expect(screen.getByText(/75% of maximum/)).toBeVisible();
      });
    });

    it('hides detailed info on blur', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} focusable={true} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      await user.click(gauge);
      await user.tab();
      
      await waitFor(() => {
        const statusInfo = screen.getByText(/Status: Good/);
        expect(statusInfo).not.toBeVisible();
      });
    });

    it('handles keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} focusable={true} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      
      await user.keyboard('{Tab}');
      expect(gauge).toHaveFocus();
      
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByText(/Status: Good/)).toBeVisible();
      });
      
      await user.keyboard('{Escape}');
      await waitFor(() => {
        const statusInfo = screen.getByText(/Status: Good/);
        expect(statusInfo).not.toBeVisible();
      });
    });

    it('is not focusable when focusable prop is false', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} focusable={false} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('tabIndex', '-1');
    });

    it('calls onFocus callback when provided', async () => {
      const onFocus = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} onFocus={onFocus} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      await user.click(gauge);
      
      expect(onFocus).toHaveBeenCalled();
    });
  });

  describe('Screen Reader Support', () => {
    it('provides comprehensive description for screen readers', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={45} type="battery" />
        </TestWrapper>
      );
      
      expect(screen.getByText(/Test Battery reading indicates warning levels at moderate range/)).toBeInTheDocument();
    });

    it('announces critical status changes', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={15} type="battery" />
        </TestWrapper>
      );
      
      expect(screen.getByText('Critical Test Battery level detected')).toBeInTheDocument();
    });

    it('does not announce when status is not critical', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={80} type="battery" />
        </TestWrapper>
      );
      
      expect(screen.queryByText(/Critical.*level detected/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains accessibility when not focusable', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} focusable={false} />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains accessibility with different gauge types', async () => {
      const { container } = render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} type="temperature" />
        </TestWrapper>
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Edge Cases', () => {
    it('handles values at boundaries correctly', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={0} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuenow', '0');
      expect(screen.getByText('0.0')).toBeInTheDocument();
    });

    it('handles values above maximum correctly', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={150} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuenow', '150');
      expect(screen.getByText('150.0')).toBeInTheDocument();
    });

    it('handles negative values correctly', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={-10} min={-50} />
        </TestWrapper>
      );
      
      const gauge = screen.getByTestId('test-gauge');
      expect(gauge).toHaveAttribute('aria-valuenow', '-10');
      expect(screen.getByText('-10.0')).toBeInTheDocument();
    });

    it('handles non-numeric values gracefully', () => {
      render(
        <TestWrapper>
          <FocusableGauge {...defaultProps} value={NaN} />
        </TestWrapper>
      );
      
      // Should not crash and should display something reasonable
      expect(screen.getByTestId('test-gauge')).toBeInTheDocument();
    });
  });
});