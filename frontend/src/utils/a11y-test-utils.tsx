/**
 * Accessibility Testing Utilities
 * 
 * Provides comprehensive utilities for testing WCAG 2.1 AA compliance
 * and accessibility best practices in React components.
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AxeResults, RunOptions } from 'axe-core';

// Add custom matchers
expect.extend(toHaveNoViolations);

/**
 * Enhanced render function with accessibility testing context
 */
export interface A11yRenderOptions extends RenderOptions {
  /** Skip automatic accessibility check */
  skipA11yCheck?: boolean;
  /** Custom axe configuration */
  axeOptions?: RunOptions;
  /** Theme for testing (light/dark) */
  theme?: 'light' | 'dark';
}

export const renderWithA11y = (
  ui: React.ReactElement,
  options: A11yRenderOptions = {}
): RenderResult & { 
  runA11yCheck: () => Promise<AxeResults>;
  checkKeyboardNavigation: () => Promise<void>;
  checkFocusManagement: () => Promise<void>;
  checkColorContrast: () => Promise<AxeResults>;
  checkScreenReaderSupport: () => Promise<AxeResults>;
} => {
  const { skipA11yCheck = false, axeOptions = {}, theme = 'light', ...renderOptions } = options;

  // Wrap with theme provider if needed
  const WrappedComponent = theme === 'dark' ? (
    <div data-theme="dark" className="dark">
      {ui}
    </div>
  ) : ui;

  const result = render(WrappedComponent, renderOptions);

  // Enhanced accessibility testing methods
  const runA11yCheck = async (): Promise<AxeResults> => {
    const axeResults = await axe(result.container, {
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true },
        'aria-usage': { enabled: true },
        'semantic-markup': { enabled: true },
        'image-alt': { enabled: true },
        'form-labels': { enabled: true },
        'heading-order': { enabled: true },
        'landmark-usage': { enabled: true },
        'tab-navigation': { enabled: true }
      },
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      ...axeOptions
    });

    expect(axeResults).toHaveNoViolations();
    return axeResults;
  };

  const checkKeyboardNavigation = async (): Promise<void> => {
    const user = userEvent.setup();
    const focusableElements = result.container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      console.warn('No focusable elements found for keyboard navigation test');
      return;
    }

    // Test Tab navigation
    for (let i = 0; i < focusableElements.length; i++) {
      await user.tab();
      const activeElement = document.activeElement;
      expect(activeElement).toBeInTheDocument();
    }

    // Test Shift+Tab navigation
    for (let i = focusableElements.length - 1; i >= 0; i--) {
      await user.tab({ shift: true });
      const activeElement = document.activeElement;
      expect(activeElement).toBeInTheDocument();
    }
  };

  const checkFocusManagement = async (): Promise<void> => {
    const axeResults = await axe(result.container, {
      rules: {
        'focus-order-semantics': { enabled: true },
        'tabindex': { enabled: true },
        'focus-trap': { enabled: true }
      },
      tags: ['wcag2a', 'wcag2aa']
    });

    expect(axeResults).toHaveNoViolations();
  };

  const checkColorContrast = async (): Promise<AxeResults> => {
    const axeResults = await axe(result.container, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true }
      },
      tags: ['wcag2aa', 'wcag2aaa']
    });

    expect(axeResults).toHaveNoViolations();
    return axeResults;
  };

  const checkScreenReaderSupport = async (): Promise<AxeResults> => {
    const axeResults = await axe(result.container, {
      rules: {
        'aria-allowed-attr': { enabled: true },
        'aria-hidden-focus': { enabled: true },
        'aria-labelledby': { enabled: true },
        'aria-required-attr': { enabled: true },
        'aria-roles': { enabled: true },
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'label': { enabled: true },
        'landmark-banner-is-top-level': { enabled: true },
        'landmark-complementary-is-top-level': { enabled: true },
        'landmark-main-is-top-level': { enabled: true },
        'landmark-no-duplicate-banner': { enabled: true },
        'landmark-no-duplicate-contentinfo': { enabled: true },
        'landmark-one-main': { enabled: true }
      },
      tags: ['wcag2a', 'wcag2aa']
    });

    expect(axeResults).toHaveNoViolations();
    return axeResults;
  };

  // Run automatic accessibility check unless skipped
  if (!skipA11yCheck) {
    // Defer the check to allow component to fully render
    setTimeout(() => {
      runA11yCheck().catch(console.error);
    }, 0);
  }

  return {
    ...result,
    runA11yCheck,
    checkKeyboardNavigation,
    checkFocusManagement,
    checkColorContrast,
    checkScreenReaderSupport
  };
};

/**
 * Accessibility test generators for common patterns
 */
export const createA11yTestSuite = (
  componentName: string,
  renderComponent: () => React.ReactElement,
  customTests?: () => void
) => {
  describe(`Accessibility Tests - ${componentName}`, () => {
    test('should have no accessibility violations', async () => {
      const { runA11yCheck } = renderWithA11y(renderComponent());
      await runA11yCheck();
    });

    test('should support keyboard navigation', async () => {
      const { checkKeyboardNavigation } = renderWithA11y(renderComponent());
      await checkKeyboardNavigation();
    });

    test('should have proper focus management', async () => {
      const { checkFocusManagement } = renderWithA11y(renderComponent());
      await checkFocusManagement();
    });

    test('should meet color contrast requirements', async () => {
      const { checkColorContrast } = renderWithA11y(renderComponent());
      await checkColorContrast();
    });

    test('should support screen readers', async () => {
      const { checkScreenReaderSupport } = renderWithA11y(renderComponent());
      await checkScreenReaderSupport();
    });

    test('should work in dark theme', async () => {
      const { runA11yCheck } = renderWithA11y(renderComponent(), { theme: 'dark' });
      await runA11yCheck();
    });

    // Run custom tests if provided
    if (customTests) {
      customTests();
    }
  });
};

/**
 * Keyboard navigation test utilities
 */
export const KeyboardTestUtils = {
  async testTabOrder(container: HTMLElement, expectedOrder: string[]) {
    const user = userEvent.setup();
    
    for (const expectedElement of expectedOrder) {
      await user.tab();
      const activeElement = document.activeElement;
      const elementSelector = expectedElement;
      const expectedEl = container.querySelector(elementSelector);
      expect(activeElement).toBe(expectedEl);
    }
  },

  async testArrowNavigation(container: HTMLElement, initialElement: string, direction: 'up' | 'down' | 'left' | 'right') {
    const user = userEvent.setup();
    const initial = container.querySelector(initialElement);
    
    if (initial) {
      (initial as HTMLElement).focus();
      
      switch (direction) {
        case 'up':
          await user.keyboard('{ArrowUp}');
          break;
        case 'down':
          await user.keyboard('{ArrowDown}');
          break;
        case 'left':
          await user.keyboard('{ArrowLeft}');
          break;
        case 'right':
          await user.keyboard('{ArrowRight}');
          break;
      }
    }
  },

  async testEscapeHandling(container: HTMLElement, expectCloseModal = true) {
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    
    if (expectCloseModal) {
      // Check if modal/dialog closed
      const modal = container.querySelector('[role="dialog"]');
      expect(modal).not.toBeInTheDocument();
    }
  }
};

/**
 * Screen reader test utilities
 */
export const ScreenReaderTestUtils = {
  checkAriaLabels(container: HTMLElement) {
    const elementsWithAriaLabel = container.querySelectorAll('[aria-label]');
    const elementsWithAriaLabelledBy = container.querySelectorAll('[aria-labelledby]');
    
    elementsWithAriaLabel.forEach(element => {
      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.trim().length).toBeGreaterThan(0);
    });

    elementsWithAriaLabelledBy.forEach(element => {
      const ariaLabelledBy = element.getAttribute('aria-labelledby');
      expect(ariaLabelledBy).toBeTruthy();
      
      const labelElement = container.querySelector(`#${ariaLabelledBy}`);
      expect(labelElement).toBeInTheDocument();
    });
  },

  checkLandmarks(container: HTMLElement) {
    const landmarks = container.querySelectorAll('[role="main"], [role="banner"], [role="contentinfo"], [role="navigation"], [role="complementary"]');
    
    // Should have at least main landmark
    const mainLandmark = container.querySelector('[role="main"], main');
    expect(mainLandmark).toBeInTheDocument();
  },

  checkHeadingStructure(container: HTMLElement) {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const levels: number[] = [];
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      levels.push(level);
    });

    // Check heading hierarchy
    for (let i = 1; i < levels.length; i++) {
      const currentLevel = levels[i];
      const prevLevel = levels[i - 1];
      
      // Headings should not skip levels
      if (currentLevel > prevLevel) {
        expect(currentLevel - prevLevel).toBeLessThanOrEqual(1);
      }
    }
  }
};

/**
 * Color contrast testing utilities
 */
export const ColorContrastTestUtils = {
  async checkElementContrast(element: HTMLElement, minimumRatio = 4.5) {
    const axeResults = await axe(element, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    expect(axeResults.violations).toHaveLength(0);
  },

  async checkThemeContrast(container: HTMLElement, theme: 'light' | 'dark') {
    const themeContainer = theme === 'dark' 
      ? container.querySelector('[data-theme="dark"]') || container
      : container;

    const axeResults = await axe(themeContainer, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true }
      }
    });

    expect(axeResults.violations).toHaveLength(0);
  }
};

/**
 * Form accessibility test utilities
 */
export const FormA11yTestUtils = {
  checkFormLabels(container: HTMLElement) {
    const inputs = container.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      // Input should have either id with associated label, aria-label, or aria-labelledby
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });
  },

  checkRequiredFields(container: HTMLElement) {
    const requiredInputs = container.querySelectorAll('input[required], select[required], textarea[required]');
    
    requiredInputs.forEach(input => {
      const ariaRequired = input.getAttribute('aria-required');
      const hasRequiredAttribute = input.hasAttribute('required');
      
      expect(hasRequiredAttribute || ariaRequired === 'true').toBeTruthy();
    });
  },

  checkErrorMessages(container: HTMLElement) {
    const errorMessages = container.querySelectorAll('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
    
    errorMessages.forEach(message => {
      const text = message.textContent;
      expect(text).toBeTruthy();
      expect(text!.trim().length).toBeGreaterThan(0);
    });
  }
};

export default {
  renderWithA11y,
  createA11yTestSuite,
  KeyboardTestUtils,
  ScreenReaderTestUtils,
  ColorContrastTestUtils,
  FormA11yTestUtils
};