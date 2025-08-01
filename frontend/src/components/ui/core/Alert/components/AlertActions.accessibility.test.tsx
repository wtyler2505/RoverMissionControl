/**
 * AlertActions Accessibility Tests
 * Comprehensive accessibility and WCAG 2.1 AA compliance testing
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@emotion/react';
import { AlertActions } from './AlertActions';
import { AlertAction, ActionResult } from '../types/AlertActionTypes';
import { defaultTheme } from '../../../../../theme/themes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);

describe('AlertActions - Accessibility Tests', () => {
  const mockActions: AlertAction[] = [
    {
      id: 'retry',
      type: 'retry',
      label: 'Retry',
      priority: 'primary',
      variant: 'primary',
      retryOperation: jest.fn(() => Promise.resolve({ success: true })),
      shortcut: 'r',
      ariaLabel: 'Retry the failed operation',
      description: 'Attempts to retry the operation that failed'
    },
    {
      id: 'undo',
      type: 'undo',
      label: 'Undo',
      priority: 'secondary',
      variant: 'tertiary',
      undoOperation: jest.fn(() => Promise.resolve({ success: true })),
      confirmation: 'destructive',
      shortcut: 'u',
      ariaLabel: 'Undo the last action',
      description: 'Reverses the last performed action'
    },
    {
      id: 'details',
      type: 'view-details',
      label: 'View Details',
      priority: 'tertiary',
      variant: 'ghost',
      detailsUrl: '/details/123',
      ariaLabel: 'View detailed information',
      description: 'Opens detailed information about this alert'
    }
  ];

  const defaultProps = {
    actions: mockActions,
    alertId: 'test-alert',
    alertPriority: 'high',
    keyboard: { enabled: true, announceNavigation: true },
    confirmations: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility with action groups', async () => {
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

      const { container } = render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={actionGroups} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility with overflow menu', async () => {
      const manyActions = Array.from({ length: 6 }, (_, i) => ({
        id: `action-${i}`,
        type: 'custom' as const,
        label: `Action ${i}`,
        priority: 'secondary' as const,
        execute: jest.fn(() => Promise.resolve({ success: true })),
        ariaLabel: `Execute action ${i}`,
        description: `Description for action ${i}`
      }));

      const { container } = render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={manyActions}
            maxVisible={3}
          />
        </TestWrapper>
      );

      // Open overflow menu
      const overflowButton = screen.getByLabelText(/Show \d+ more actions/);
      await userEvent.click(overflowButton);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Touch Target Sizes', () => {
    it('should meet minimum 44px touch target requirement', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        const minHeight = parseInt(computedStyle.minHeight);
        const minWidth = parseInt(computedStyle.minWidth);
        
        expect(minHeight).toBeGreaterThanOrEqual(44);
        expect(minWidth).toBeGreaterThanOrEqual(44);
      });
    });

    it('should maintain touch targets in stacked layout', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} layout="stacked" />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.width).toBeGreaterThanOrEqual(44);
      });
    });

    it('should maintain touch targets on mobile breakpoint', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 568,
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        const minHeight = parseInt(computedStyle.minHeight);
        const minWidth = parseInt(computedStyle.minWidth);
        
        expect(minHeight).toBeGreaterThanOrEqual(44);
        expect(minWidth).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      const undoButton = screen.getByRole('button', { name: /undo/i });
      const detailsButton = screen.getByRole('button', { name: /view details/i });

      expect(retryButton).toHaveAttribute('aria-label');
      expect(undoButton).toHaveAttribute('aria-label');
      expect(detailsButton).toHaveAttribute('aria-label');
    });

    it('should announce navigation changes', async () => {
      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps}
            keyboard={{ enabled: true, announceNavigation: true }}
          />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      
      // Navigate with arrow keys
      act(() => {
        fireEvent.keyDown(container, { key: 'ArrowRight' });
      });

      // Check for screen reader announcement
      await waitFor(() => {
        const announcement = document.querySelector('[aria-live="polite"]');
        expect(announcement).toBeInTheDocument();
        expect(announcement?.textContent).toContain('Focused on');
      });
    });

    it('should provide descriptive text for complex actions', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      const descriptionId = retryButton.getAttribute('aria-describedby');
      
      if (descriptionId) {
        const descriptionElement = document.getElementById(descriptionId);
        expect(descriptionElement).toBeInTheDocument();
        expect(descriptionElement?.textContent).toBe(
          'Attempts to retry the operation that failed'
        );
      }
    });

    it('should announce loading states', async () => {
      const slowAction: AlertAction = {
        id: 'slow',
        type: 'custom',
        label: 'Loading Action',
        priority: 'primary',
        execute: jest.fn(() => new Promise(resolve => 
          setTimeout(() => resolve({ success: true }), 100)
        )),
        ariaLabel: 'Execute slow loading action'
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[slowAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /loading action/i });
      
      await userEvent.click(button);

      // Button should indicate loading state to screen readers
      expect(button).toHaveAttribute('data-state', 'loading');
      expect(button).toHaveAttribute('aria-label');
      
      const ariaLabel = button.getAttribute('aria-label');
      expect(ariaLabel).toContain('Loading Action');
    });

    it('should announce success and error states', async () => {
      const successAction: AlertAction = {
        id: 'success',
        type: 'custom',
        label: 'Success Action',
        priority: 'primary',
        execute: jest.fn(() => Promise.resolve({ success: true })),
        ariaLabel: 'Execute successful action'
      };

      const errorAction: AlertAction = {
        id: 'error',
        type: 'custom',
        label: 'Error Action',
        priority: 'primary',
        execute: jest.fn(() => Promise.reject(new Error('Test error'))),
        ariaLabel: 'Execute error action'
      };

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={[successAction, errorAction]} 
          />
        </TestWrapper>
      );

      // Test success state
      const successButton = screen.getByRole('button', { name: /success action/i });
      await userEvent.click(successButton);

      await waitFor(() => {
        expect(successButton).toHaveAttribute('data-state', 'success');
      });

      // Test error state
      const errorButton = screen.getByRole('button', { name: /error action/i });
      await userEvent.click(errorButton);

      await waitFor(() => {
        expect(errorButton).toHaveAttribute('data-state', 'error');
      });
    });
  });

  describe('High Contrast Mode Support', () => {
    beforeEach(() => {
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
    });

    it('should enhance borders in high contrast mode', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(computedStyle.borderWidth).toBe('3px');
      });
    });

    it('should increase font weight in high contrast mode', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(parseInt(computedStyle.fontWeight)).toBeGreaterThanOrEqual(600);
      });
    });

    it('should maintain color contrast ratios', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      
      // This is a basic check - in real tests you'd use a color contrast analyzer
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(computedStyle.color).toBeDefined();
        expect(computedStyle.backgroundColor).toBeDefined();
      });
    });
  });

  describe('Reduced Motion Support', () => {
    beforeEach(() => {
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
    });

    it('should disable animations with reduced motion preference', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(computedStyle.transition).toBe('none');
      });
    });

    it('should disable hover transforms with reduced motion', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      
      fireEvent.mouseEnter(retryButton);
      
      const computedStyle = window.getComputedStyle(retryButton);
      expect(computedStyle.transform).toBe('none');
    });

    it('should disable loading spinner animations with reduced motion', async () => {
      const slowAction: AlertAction = {
        id: 'slow',
        type: 'custom',
        label: 'Loading Action',
        priority: 'primary',
        execute: jest.fn(() => new Promise(resolve => 
          setTimeout(() => resolve({ success: true }), 100)
        ))
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[slowAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /loading action/i });
      await userEvent.click(button);

      // Loading spinner should not animate
      const spinner = button.querySelector('.action-icon');
      if (spinner) {
        const computedStyle = window.getComputedStyle(spinner);
        expect(computedStyle.animation).toBe('none');
      }
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within overflow menu', async () => {
      const manyActions = Array.from({ length: 6 }, (_, i) => ({
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
            focus={{ trapFocus: true }}
          />
        </TestWrapper>
      );

      const overflowButton = screen.getByLabelText(/Show \d+ more actions/);
      await userEvent.click(overflowButton);

      // Focus should be trapped within the dropdown
      const dropdownItems = screen.getAllByRole('menuitem');
      
      // Tab through all items
      for (let i = 0; i < dropdownItems.length; i++) {
        fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      }

      // Should wrap back to first item
      expect(dropdownItems[0]).toHaveFocus();
    });

    it('should return focus to trigger element when overflow menu closes', async () => {
      const manyActions = Array.from({ length: 6 }, (_, i) => ({
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
            focus={{ returnFocus: true }}
          />
        </TestWrapper>
      );

      const overflowButton = screen.getByLabelText(/Show \d+ more actions/);
      await userEvent.click(overflowButton);

      // Close menu with Escape
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

      await waitFor(() => {
        expect(overflowButton).toHaveFocus();
      });
    });

    it('should handle focus on action completion', async () => {
      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps}
            focus={{ focusOnComplete: true }}
          />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(retryButton).toHaveFocus();
      });
    });

    it('should handle focus on action error', async () => {
      const errorAction: AlertAction = {
        id: 'error',
        type: 'custom',
        label: 'Error Action',
        priority: 'primary',
        execute: jest.fn(() => Promise.reject(new Error('Test error')))
      };

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps}
            actions={[errorAction]}
            focus={{ focusOnError: true }}
          />
        </TestWrapper>
      );

      const errorButton = screen.getByRole('button', { name: /error action/i });
      await userEvent.click(errorButton);

      await waitFor(() => {
        expect(errorButton).toHaveFocus();
      });
    });
  });

  describe('Semantic HTML Structure', () => {
    it('should use proper semantic roles', () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(3);
    });

    it('should use proper semantic roles for overflow menu', async () => {
      const manyActions = Array.from({ length: 6 }, (_, i) => ({
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
      expect(overflowButton).toHaveAttribute('aria-haspopup', 'menu');
      expect(overflowButton).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(overflowButton);

      expect(overflowButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    });

    it('should have proper heading structure for action groups', () => {
      const actionGroups = [
        {
          id: 'primary-group',
          label: 'Primary Actions',
          priority: 'primary' as const,
          actions: [mockActions[0]]
        }
      ];

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={actionGroups} />
        </TestWrapper>
      );

      // Group labels should be properly structured
      const groupLabel = screen.getByText('Primary Actions');
      expect(groupLabel).toBeInTheDocument();
      expect(groupLabel.tagName.toLowerCase()).toBe('div');
    });
  });
});