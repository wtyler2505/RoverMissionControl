/**
 * Tests for FocusManagementContext
 * Testing focus management hooks, context integration, and accessibility features
 */

import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusManagementProvider, useFocusManagement } from '../FocusManagementContext';

// Test component that uses the focus management context
const TestFocusComponent: React.FC<{ testId?: string }> = ({ testId = 'test-component' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { focusTrap, focusRestore, focusVisible, routerFocus, utils } = useFocusManagement();

  const handleActivateTrap = () => {
    if (containerRef.current) {
      focusTrap.activateGlobalTrap(containerRef.current);
    }
  };

  const handleDeactivateTrap = () => {
    focusTrap.deactivateGlobalTrap();
  };

  const handleCaptureFocus = () => {
    focusRestore.captureFocus();
  };

  const handleRestoreFocus = () => {
    focusRestore.restoreFocus();
  };

  const handleAnnounce = () => {
    routerFocus.announceToScreenReader('Test announcement');
  };

  return (
    <div ref={containerRef} data-testid={testId}>
      <button data-testid="first-button">First Button</button>
      <button data-testid="activate-trap" onClick={handleActivateTrap}>
        Activate Trap
      </button>
      <button data-testid="deactivate-trap" onClick={handleDeactivateTrap}>
        Deactivate Trap
      </button>
      <button data-testid="capture-focus" onClick={handleCaptureFocus}>
        Capture Focus
      </button>
      <button data-testid="restore-focus" onClick={handleRestoreFocus}>
        Restore Focus
      </button>
      <button data-testid="announce" onClick={handleAnnounce}>
        Announce
      </button>
      <input data-testid="test-input" placeholder="Test input" />
      
      <div data-testid="focus-info">
        <span data-testid="focus-visible">
          Focus Visible: {focusVisible.isFocusVisible ? 'true' : 'false'}
        </span>
        <span data-testid="interaction-mode">
          Mode: {focusVisible.lastInteractionMode || 'none'}
        </span>
        <span data-testid="trap-active">
          Trap Active: {focusTrap.isGlobalTrapActive ? 'true' : 'false'}
        </span>
      </div>
    </div>
  );
};

describe('FocusManagementContext', () => {
  describe('Provider Setup', () => {
    it('provides context without crashing', () => {
      render(
        <FocusManagementProvider>
          <TestFocusComponent />
        </FocusManagementProvider>
      );
      
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });

    it('throws error when used outside provider', () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestFocusComponent />);
      }).toThrow('useFocusManagement must be used within a FocusManagementProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Focus Trap Management', () => {
    it('activates and deactivates global focus trap', async () => {
      const user = userEvent.setup();
      
      render(
        <FocusManagementProvider>
          <TestFocusComponent />
        </FocusManagementProvider>
      );
      
      // Initially no trap active
      expect(screen.getByTestId('trap-active')).toHaveTextContent('Trap Active: false');
      
      // Activate trap
      await user.click(screen.getByTestId('activate-trap'));
      expect(screen.getByTestId('trap-active')).toHaveTextContent('Trap Active: true');
      
      // Deactivate trap
      await user.click(screen.getByTestId('deactivate-trap'));
      expect(screen.getByTestId('trap-active')).toHaveTextContent('Trap Active: false');
    });
  });

  describe('Focus Restoration', () => {
    it('captures and restores focus', async () => {
      const user = userEvent.setup();
      
      render(
        <FocusManagementProvider>
          <TestFocusComponent />
        </FocusManagementProvider>
      );
      
      const firstButton = screen.getByTestId('first-button');
      const testInput = screen.getByTestId('test-input');
      
      // Focus first button and capture
      await user.click(firstButton);
      await user.click(screen.getByTestId('capture-focus'));
      
      // Focus something else
      await user.click(testInput);
      expect(testInput).toHaveFocus();
      
      // Restore focus
      await user.click(screen.getByTestId('restore-focus'));
      
      // Focus should be restored to first button
      expect(firstButton).toHaveFocus();
    });
  });

  describe('Utility Functions', () => {
    it('provides utility functions through context', () => {
      const TestUtilsComponent: React.FC = () => {
        const { utils } = useFocusManagement();
        
        return (
          <div data-testid="utils-test">
            <button
              data-testid="focusable-test"
              onClick={() => {
                const element = document.querySelector('[data-testid="focusable-test"]') as HTMLElement;
                if (element) {
                  const isFocusable = utils.isFocusable(element);
                  element.setAttribute('data-is-focusable', String(isFocusable));
                }
              }}
            >
              Test Focusable
            </button>
          </div>
        );
      };

      render(
        <FocusManagementProvider>
          <TestUtilsComponent />
        </FocusManagementProvider>
      );
      
      const button = screen.getByTestId('focusable-test');
      fireEvent.click(button);
      
      expect(button).toHaveAttribute('data-is-focusable', 'true');
    });
  });

  describe('Cleanup', () => {
    it('cleans up on unmount', () => {
      const { unmount } = render(
        <FocusManagementProvider>
          <TestFocusComponent />
        </FocusManagementProvider>
      );
      
      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });
});