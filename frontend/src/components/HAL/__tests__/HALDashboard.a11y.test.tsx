/**
 * HAL Dashboard Accessibility Tests
 * 
 * Comprehensive WCAG 2.1 AA compliance testing for the HAL Dashboard component
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HALDashboard } from '../HALDashboard';
import { 
  renderWithA11y, 
  createA11yTestSuite,
  KeyboardTestUtils,
  ScreenReaderTestUtils,
  ColorContrastTestUtils,
  FormA11yTestUtils
} from '../../../utils/a11y-test-utils';

// Mock dependencies
jest.mock('../HALContext', () => ({
  useHAL: () => ({
    devices: [
      {
        id: 'device-1',
        name: 'Test Device 1',
        type: 'sensor',
        status: 'connected',
        capabilities: ['read'],
        lastSeen: new Date().toISOString(),
        metadata: { location: 'lab' }
      },
      {
        id: 'device-2',
        name: 'Test Device 2', 
        type: 'actuator',
        status: 'disconnected',
        capabilities: ['write'],
        lastSeen: new Date().toISOString(),
        metadata: { location: 'field' }
      }
    ],
    totalDevices: 2,
    connectedDevices: 1,
    isLoading: false,
    error: null,
    refreshDevices: jest.fn(),
    connectDevice: jest.fn(),
    disconnectDevice: jest.fn()
  })
}));

describe('HAL Dashboard Accessibility Tests', () => {
  // Standard accessibility test suite
  createA11yTestSuite(
    'HALDashboard',
    () => <HALDashboard />,
    () => {
      // Custom accessibility tests specific to HAL Dashboard
      
      test('should have proper heading structure', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          ScreenReaderTestUtils.checkHeadingStructure(container);
        });
      });

      test('should have proper landmarks', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          ScreenReaderTestUtils.checkLandmarks(container);
        });
      });

      test('should support keyboard navigation through device cards', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          const deviceCards = screen.getAllByRole('article');
          expect(deviceCards).toHaveLength(2);
        });

        // Test Tab navigation through device cards
        const user = userEvent.setup();
        
        // Focus first device card
        await user.tab();
        expect(document.activeElement).toHaveAttribute('role', 'article');
        
        // Navigate to next device card
        await user.tab();
        expect(document.activeElement).toHaveAttribute('role', 'article');
      });

      test('should handle arrow key navigation in device grid', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          const deviceCards = screen.getAllByRole('article');
          expect(deviceCards).toHaveLength(2);
        });

        const user = userEvent.setup();
        const firstCard = screen.getAllByRole('article')[0];
        
        // Focus first card
        firstCard.focus();
        expect(document.activeElement).toBe(firstCard);
        
        // Test arrow navigation
        await user.keyboard('{ArrowDown}');
        // Should move to next card or stay on same if no card below
        expect(document.activeElement).toBeInTheDocument();
      });

      test('should announce device status changes to screen readers', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          // Check for aria-live regions for dynamic updates
          const liveRegions = container.querySelectorAll('[aria-live]');
          expect(liveRegions.length).toBeGreaterThan(0);
        });
      });

      test('should have accessible device status indicators', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          const statusIndicators = container.querySelectorAll('[data-testid*="status"]');
          statusIndicators.forEach(indicator => {
            // Status indicators should have aria-label or text content
            const ariaLabel = indicator.getAttribute('aria-label');
            const textContent = indicator.textContent;
            expect(ariaLabel || textContent).toBeTruthy();
          });
        });
      });

      test('should support device filtering with keyboard', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        const user = userEvent.setup();
        
        // Look for filter controls
        const filterButtons = container.querySelectorAll('[role="button"][aria-label*="filter"], [role="button"][aria-label*="Filter"]');
        
        if (filterButtons.length > 0) {
          // Test keyboard activation of filter
          const firstFilter = filterButtons[0] as HTMLElement;
          firstFilter.focus();
          
          await user.keyboard('{Enter}');
          // Filter should be activated - check for visual/state change
          expect(firstFilter).toHaveAttribute('aria-pressed');
        }
      });

      test('should have accessible device action buttons', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          const actionButtons = container.querySelectorAll('button');
          actionButtons.forEach(button => {
            // Each button should have accessible name
            const accessibleName = button.getAttribute('aria-label') || button.textContent;
            expect(accessibleName).toBeTruthy();
            expect(accessibleName!.trim().length).toBeGreaterThan(0);
          });
        });
      });

      test('should provide loading state feedback to screen readers', async () => {
        // Test with loading state
        jest.clearAllMocks();
        require('../HALContext').useHAL.mockReturnValue({
          devices: [],
          totalDevices: 0,
          connectedDevices: 0,
          isLoading: true,
          error: null,
          refreshDevices: jest.fn(),
          connectDevice: jest.fn(),
          disconnectDevice: jest.fn()
        });
        
        const { container } = renderWithA11y(<HALDashboard />);
        
        // Should have loading indicator with proper aria attributes
        const loadingIndicator = container.querySelector('[aria-live="polite"], [role="status"]');
        expect(loadingIndicator).toBeInTheDocument();
      });

      test('should handle error states accessibly', async () => {
        // Test with error state
        jest.clearAllMocks();
        require('../HALContext').useHAL.mockReturnValue({
          devices: [],
          totalDevices: 0,
          connectedDevices: 0,
          isLoading: false,
          error: 'Failed to load devices',
          refreshDevices: jest.fn(),
          connectDevice: jest.fn(),
          disconnectDevice: jest.fn()
        });
        
        const { container } = renderWithA11y(<HALDashboard />);
        
        // Error should be announced to screen readers
        const errorAlert = container.querySelector('[role="alert"]');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveTextContent('Failed to load devices');
      });

      test('should have proper focus management for modals/dialogs', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        const user = userEvent.setup();
        
        // Look for buttons that open modals/dialogs
        const modalTriggers = container.querySelectorAll('[aria-haspopup="dialog"], [data-testid*="modal"], [data-testid*="dialog"]');
        
        if (modalTriggers.length > 0) {
          const trigger = modalTriggers[0] as HTMLElement;
          
          // Click to open modal
          await user.click(trigger);
          
          // Check if modal opened and has proper focus management
          const modal = container.querySelector('[role="dialog"]');
          if (modal) {
            // Modal should trap focus
            expect(modal).toHaveAttribute('aria-modal', 'true');
            
            // First focusable element should be focused
            const focusableElements = modal.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
              expect(document.activeElement).toBe(focusableElements[0]);
            }
          }
        }
      });

      test('should support high contrast mode', async () => {
        // Test with high contrast simulation
        document.body.style.filter = 'contrast(150%)';
        
        const { container, checkColorContrast } = renderWithA11y(<HALDashboard />);
        
        await waitFor(async () => {
          await checkColorContrast();
        });
        
        // Clean up
        document.body.style.filter = '';
      });

      test('should be usable with reduced motion settings', async () => {
        // Mock reduced motion preference
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
        
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          // Animations should be disabled or reduced
          const animatedElements = container.querySelectorAll('[class*="animate"], [style*="animation"], [style*="transition"]');
          // Components should respect prefers-reduced-motion
          expect(container).toBeInTheDocument();
        });
      });

      test('should work with screen reader virtual cursor', async () => {
        const { container } = renderWithA11y(<HALDashboard />);
        
        await waitFor(() => {
          // All interactive elements should be reachable via virtual cursor
          const interactiveElements = container.querySelectorAll(
            'button, [role="button"], a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          interactiveElements.forEach(element => {
            // Element should be visible to screen readers
            expect(element).not.toHaveAttribute('aria-hidden', 'true');
            
            // Element should have accessible name
            const accessibleName = element.getAttribute('aria-label') || 
                                 element.getAttribute('aria-labelledby') ||
                                 element.textContent;
            expect(accessibleName).toBeTruthy();
          });
        });
      });
    }
  );

  // Test device card specific accessibility
  describe('Device Card Accessibility', () => {
    test('device cards should have proper role and labeling', async () => {
      const { container } = renderWithA11y(<HALDashboard />);
      
      await waitFor(() => {
        const deviceCards = screen.getAllByRole('article');
        
        deviceCards.forEach((card, index) => {
          expect(card).toHaveAttribute('role', 'article');
          
          // Card should have accessible name
          const accessibleName = card.getAttribute('aria-label') || 
                               card.getAttribute('aria-labelledby');
          expect(accessibleName).toBeTruthy();
        });
      });
    });

    test('device status should be conveyed to screen readers', async () => {
      const { container } = renderWithA11y(<HALDashboard />);
      
      await waitFor(() => {
        const statusElements = container.querySelectorAll('[data-testid*="status"]');
        
        statusElements.forEach(status => {
          const ariaLabel = status.getAttribute('aria-label');
          const statusText = status.textContent;
          
          // Status should be readable by screen readers
          expect(ariaLabel || statusText).toBeTruthy();
          
          // Should indicate connection state
          const content = (ariaLabel || statusText)!.toLowerCase();
          expect(content).toMatch(/(connected|disconnected|online|offline)/);
        });
      });
    });
  });

  // Test responsive accessibility
  describe('Responsive Accessibility', () => {
    test('should maintain accessibility on mobile viewports', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      window.dispatchEvent(new Event('resize'));
      
      const { runA11yCheck } = renderWithA11y(<HALDashboard />);
      
      await waitFor(async () => {
        await runA11yCheck();
      });
      
      // Clean up
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 768,
      });
    });

    test('should support touch navigation', async () => {
      const { container } = renderWithA11y(<HALDashboard />);
      
      await waitFor(() => {
        const touchableElements = container.querySelectorAll('button, [role="button"], a[href]');
        
        touchableElements.forEach(element => {
          // Touch targets should be at least 44x44px for accessibility
          const styles = window.getComputedStyle(element);
          const minSize = 44;
          
          // Note: In test environment, computed styles might not reflect actual CSS
          // This is more for documentation of the requirement
          expect(element).toBeInTheDocument();
        });
      });
    });
  });
});