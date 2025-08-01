/**
 * AlertActions Cross-Browser Compatibility Tests
 * Tests for ensuring consistent behavior across different browsers and devices
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { AlertActions } from './AlertActions';
import { AlertAction, ActionResult } from '../types/AlertActionTypes';
import { defaultTheme } from '../../../../../theme/themes';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
);

// Mock different browser environments
const mockUserAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
  ie11: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; rv:11.0) like Gecko'
};

// Mock different screen sizes
const mockScreenSizes = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  ultrawide: { width: 3440, height: 1440 }
};

describe('AlertActions - Cross-Browser Compatibility Tests', () => {
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

  describe('Browser-Specific Behavior', () => {
    it('should handle Chrome-specific focus behavior', async () => {
      // Mock Chrome environment
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.chrome,
        configurable: true
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} focus={{ autoFocus: 'retry' }} />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      
      await waitFor(() => {
        expect(retryButton).toHaveFocus();
      });
    });

    it('should handle Firefox-specific keyboard events', async () => {
      // Mock Firefox environment
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.firefox,
        configurable: true
      });

      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const firefoxAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[firefoxAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });

      // Firefox specific key handling
      fireEvent.keyDown(button, { key: 'Enter', which: 13 });

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalled();
      });
    });

    it('should handle Safari-specific touch events', async () => {
      // Mock Safari environment
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.safari,
        configurable: true
      });

      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const safariAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[safariAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });

      // Safari touch events
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalled();
      });
    });

    it('should handle Edge-specific styling', () => {
      // Mock Edge environment
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.edge,
        configurable: true
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Edge should render buttons with proper styling
        expect(button).toHaveStyle('cursor: pointer');
        expect(button).toHaveStyle('user-select: none');
      });
    });

    it('should provide IE11 compatibility fallbacks', () => {
      // Mock IE11 environment
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.ie11,
        configurable: true
      });

      // Mock IE11 lack of Promise support
      const originalPromise = global.Promise;
      delete (global as any).Promise;

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      // Should still render buttons
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

      // Restore Promise
      global.Promise = originalPromise;
    });
  });

  describe('Responsive Design Across Devices', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.mobile.width,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.mobile.height,
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      
      // Should use mobile layout
      expect(container).toHaveStyle('flex-direction: column');
    });

    it('should maintain touch targets on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.mobile.width,
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(44);
        expect(parseInt(computedStyle.minWidth)).toBeGreaterThanOrEqual(44);
      });
    });

    it('should handle tablet orientation changes', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.tablet.width,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.tablet.height,
      });

      const { rerender } = render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      // Simulate orientation change
      Object.defineProperty(window, 'innerWidth', {
        value: mockScreenSizes.tablet.height,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: mockScreenSizes.tablet.width,
      });

      rerender(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      // Should still render properly
      expect(screen.getAllByRole('button')).toHaveLength(3);
    });

    it('should optimize for desktop displays', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.desktop.width,
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      
      // Should use horizontal layout on desktop
      expect(container).toHaveStyle('flex-direction: row');
    });

    it('should handle ultrawide displays', () => {
      // Mock ultrawide viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: mockScreenSizes.ultrawide.width,
      });

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      // Should not stretch buttons excessively
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const computedStyle = window.getComputedStyle(button);
        expect(parseInt(computedStyle.maxWidth)).toBeLessThan(400);
      });
    });
  });

  describe('Input Method Compatibility', () => {
    it('should handle mouse interactions consistently', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const mouseAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[mouseAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });

      // Test different mouse events
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle touch interactions on mobile', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const touchAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[touchAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });

      // Simulate touch sequence
      fireEvent.touchStart(button, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchEnd(button, {
        changedTouches: [{ clientX: 100, clientY: 100 }]
      });

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalled();
      });
    });

    it('should handle pen/stylus input', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const penAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[penAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });

      // Simulate pen input
      fireEvent.pointerDown(button, { pointerType: 'pen' });
      fireEvent.pointerUp(button, { pointerType: 'pen' });
      fireEvent.click(button);

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalled();
      });
    });

    it('should handle gamepad/controller input', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const gamepadAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={[gamepadAction]}
            keyboard={{ enabled: true }}
          />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });
      button.focus();

      // Simulate gamepad button press (Space)
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });

      await waitFor(() => {
        expect(executeFunction).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Across Browsers', () => {
    it('should handle rapid interactions without performance degradation', async () => {
      const executeFunction = jest.fn(() => Promise.resolve({ success: true }));
      const performanceAction: AlertAction = {
        ...mockActions[0],
        retryOperation: executeFunction
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[performanceAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /retry/i });

      const startTime = performance.now();

      // Rapid clicks
      for (let i = 0; i < 10; i++) {
        await userEvent.click(button);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete rapidly (less than 1 second for 10 interactions)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large numbers of actions efficiently', () => {
      const manyActions = Array.from({ length: 50 }, (_, i) => ({
        id: `action-${i}`,
        type: 'custom' as const,
        label: `Action ${i}`,
        priority: 'secondary' as const,
        execute: jest.fn(() => Promise.resolve({ success: true }))
      }));

      const startTime = performance.now();

      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps} 
            actions={manyActions}
            maxVisible={5}
          />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with many actions
      expect(renderTime).toBeLessThan(100);

      // Should show overflow menu
      expect(screen.getByLabelText(/Show \d+ more actions/)).toBeInTheDocument();
    });

    it('should optimize re-renders efficiently', () => {
      const { rerender } = render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const startTime = performance.now();

      // Multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <AlertActions {...defaultProps} alertId={`alert-${i}`} />
          </TestWrapper>
        );
      }

      const endTime = performance.now();
      const rerenderTime = endTime - startTime;

      // Should handle re-renders efficiently
      expect(rerenderTime).toBeLessThan(200);
    });
  });

  describe('Accessibility Across Browsers', () => {
    it('should announce actions consistently in different screen readers', async () => {
      render(
        <TestWrapper>
          <AlertActions 
            {...defaultProps}
            keyboard={{ enabled: true, announceNavigation: true }}
          />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.focus();

      act(() => {
        fireEvent.keyDown(retryButton, { key: 'ArrowRight' });
      });

      await waitFor(() => {
        const announcement = document.querySelector('[aria-live="polite"]');
        expect(announcement).toBeInTheDocument();
      });
    });

    it('should maintain focus behavior across browsers', async () => {
      render(
        <TestWrapper>
          <AlertActions {...defaultProps} focus={{ autoFocus: 'retry' }} />
        </TestWrapper>
      );

      const retryButton = screen.getByRole('button', { name: /retry/i });
      
      await waitFor(() => {
        expect(retryButton).toHaveFocus();
      });

      // Test focus persistence
      fireEvent.blur(retryButton);
      retryButton.focus();
      
      expect(retryButton).toHaveFocus();
    });

    it('should handle high contrast mode across browsers', () => {
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

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
  });

  describe('Error Handling Across Browsers', () => {
    it('should handle promise rejections consistently', async () => {
      const errorAction: AlertAction = {
        id: 'error',
        type: 'custom',
        label: 'Error Action',
        priority: 'primary',
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

      const button = screen.getByRole('button', { name: /error action/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(onActionError).toHaveBeenCalledWith('error', expect.any(Error));
      });
    });

    it('should handle network failures gracefully', async () => {
      const networkAction: AlertAction = {
        id: 'network',
        type: 'custom',
        label: 'Network Action',
        priority: 'primary',
        execute: jest.fn(() => Promise.reject(new Error('Network error')))
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[networkAction]} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /network action/i });
      await userEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('data-state', 'error');
      });
    });

    it('should handle script errors without breaking', () => {
      const originalError = console.error;
      console.error = jest.fn();

      const problematicAction: AlertAction = {
        id: 'problematic',
        type: 'custom',
        label: 'Problematic Action',
        priority: 'primary',
        execute: jest.fn(() => {
          throw new Error('Script error');
        })
      };

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={[problematicAction]} />
        </TestWrapper>
      );

      // Should still render despite problematic action
      expect(screen.getByRole('button', { name: /problematic action/i })).toBeInTheDocument();

      console.error = originalError;
    });
  });

  describe('Internationalization Support', () => {
    it('should handle RTL languages', () => {
      // Mock RTL environment
      document.dir = 'rtl';

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} />
        </TestWrapper>
      );

      const container = screen.getByRole('group');
      
      // Should adapt layout for RTL
      expect(container).toBeInTheDocument();

      // Cleanup
      document.dir = 'ltr';
    });

    it('should handle long action labels in different languages', () => {
      const longLabelActions: AlertAction[] = [
        {
          id: 'long-german',
          type: 'custom',
          label: 'Wiederverwendungsfreundlichkeitsprüfung',
          priority: 'primary',
          execute: jest.fn(() => Promise.resolve({ success: true }))
        },
        {
          id: 'long-japanese',
          type: 'custom',
          label: 'アクションの実行を確認してください',
          priority: 'secondary',
          execute: jest.fn(() => Promise.resolve({ success: true }))
        }
      ];

      render(
        <TestWrapper>
          <AlertActions {...defaultProps} actions={longLabelActions} />
        </TestWrapper>
      );

      // Should render long labels without breaking layout
      expect(screen.getByRole('button', { name: /wiederverwendungsfreundlichkeitsprüfung/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /アクションの実行を確認してください/i })).toBeInTheDocument();
    });
  });
});