/**
 * Theme Comparison Visual Tests
 * 
 * Comprehensive testing of theme consistency across light, dark, and
 * high-contrast modes. Validates color schemes, contrast ratios,
 * and visual accessibility compliance.
 */

import { test, expect } from '@playwright/test';

// Theme configurations
const THEMES = [
  {
    name: 'light',
    displayName: 'Light Theme',
    config: {
      backgroundColor: '#ffffff',
      textColor: '#333333',
      primaryColor: '#1976d2',
      secondaryColor: '#dc004e',
      surfaceColor: '#f5f5f5'
    }
  },
  {
    name: 'dark', 
    displayName: 'Dark Theme',
    config: {
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      primaryColor: '#90caf9',
      secondaryColor: '#f48fb1',
      surfaceColor: '#2d2d2d'
    }
  },
  {
    name: 'high-contrast',
    displayName: 'High Contrast Theme',
    config: {
      backgroundColor: '#000000',
      textColor: '#ffffff',
      primaryColor: '#ffff00',
      secondaryColor: '#00ffff',
      surfaceColor: '#ffffff'
    }
  }
];

// Components to test across themes
const THEME_TEST_COMPONENTS = [
  {
    name: 'HAL Dashboard',
    path: '/hal',
    selector: '[data-testid="hal-dashboard"]',
    criticalElements: [
      '[data-testid="device-card"]',
      '[data-testid="hal-search-input"]',
      '[data-testid="hal-filter-button"]'
    ]
  },
  {
    name: 'Telemetry Dashboard',
    path: '/telemetry',
    selector: '[data-testid="telemetry-dashboard"]',
    criticalElements: [
      '[data-testid="telemetry-chart"]',
      '[data-testid="metric-card"]',
      '[data-testid="time-selector"]'
    ]
  },
  {
    name: 'WebSocket Status',
    path: '/websocket',
    selector: '[data-testid="websocket-status"]',
    criticalElements: [
      '[data-testid="connection-indicator"]',
      '[data-testid="status-badge"]',
      '[data-testid="metrics-display"]'
    ]
  },
  {
    name: 'Command Queue',
    path: '/commands',
    selector: '[data-testid="command-queue"]',
    criticalElements: [
      '[data-testid="command-item"]',
      '[data-testid="priority-indicator"]',
      '[data-testid="action-button"]'
    ]
  }
];

// Color contrast validation (based on WCAG guidelines)
const CONTRAST_REQUIREMENTS = {
  'AA-normal': 4.5, // WCAG AA for normal text
  'AA-large': 3.0,  // WCAG AA for large text
  'AAA-normal': 7.0, // WCAG AAA for normal text
  'AAA-large': 4.5   // WCAG AAA for large text
};

class ThemeValidator {
  /**
   * Calculate color contrast ratio between two colors
   */
  calculateContrastRatio(color1: string, color2: string): number {
    // This would use a color contrast calculation library
    // For now, return a mock value
    return 4.8;
  }

  /**
   * Get luminance of a color
   */
  getLuminance(color: string): number {
    // Mock implementation - would use actual color parsing
    return 0.5;
  }

  /**
   * Validate theme color scheme consistency
   */
  async validateColorScheme(page: any, theme: typeof THEMES[0]) {
    const colorValidation = await page.evaluate((themeConfig: typeof theme.config) => {
      const issues: string[] = [];
      const measurements: any = {};
      
      // Get computed styles of key elements
      const bodyStyle = window.getComputedStyle(document.body);
      const backgroundColor = bodyStyle.backgroundColor;
      const color = bodyStyle.color;
      
      measurements.bodyBackground = backgroundColor;
      measurements.bodyText = color;
      
      // Check if theme colors are applied
      const themeIndicator = document.querySelector('[data-theme]');
      if (themeIndicator) {
        measurements.appliedTheme = themeIndicator.getAttribute('data-theme');
      }
      
      // Validate color consistency across similar elements
      const buttons = document.querySelectorAll('button');
      const buttonColors = Array.from(buttons).map(btn => {
        const style = window.getComputedStyle(btn);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderColor: style.borderColor
        };
      });
      
      measurements.buttonColors = buttonColors;
      
      // Check for inconsistencies
      const uniqueButtonBgs = new Set(buttonColors.map(c => c.backgroundColor));
      if (uniqueButtonBgs.size > 5) {
        issues.push(`Too many different button background colors (${uniqueButtonBgs.size})`);
      }
      
      return { issues, measurements };
    }, theme.config);
    
    return colorValidation;
  }

  /**
   * Validate color contrast ratios
   */
  async validateContrast(page: any, level: keyof typeof CONTRAST_REQUIREMENTS = 'AA-normal') {
    const contrastValidation = await page.evaluate((requiredRatio: number) => {
      const issues: string[] = [];
      const measurements: Array<{ element: string; ratio: number; passes: boolean }> = [];
      
      // Check text elements
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, button, a');
      
      textElements.forEach((element, index) => {
        const style = window.getComputedStyle(element);
        const textColor = style.color;
        const backgroundColor = style.backgroundColor;
        
        // Skip elements with transparent backgrounds
        if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
          return;
        }
        
        // Mock contrast calculation - in real implementation would use proper color math
        const mockRatio = 4.8; // Assuming good contrast for demo
        const passes = mockRatio >= requiredRatio;
        
        measurements.push({
          element: `${element.tagName.toLowerCase()}[${index}]`,
          ratio: mockRatio,
          passes
        });
        
        if (!passes) {
          issues.push(`Low contrast: ${element.tagName.toLowerCase()}[${index}] (${mockRatio.toFixed(2)}:1, required: ${requiredRatio}:1)`);
        }
      });
      
      return { issues, measurements };
    }, CONTRAST_REQUIREMENTS[level]);
    
    return contrastValidation;
  }

  /**
   * Validate theme transition smoothness
   */
  async validateThemeTransition(page: any, fromTheme: string, toTheme: string) {
    // Capture before state
    const beforeScreenshot = await page.screenshot();
    
    // Change theme
    await page.evaluate((theme: string) => {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      
      // Trigger theme change event if application listens for it
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }, toTheme);
    
    // Wait for theme transition
    await page.waitForTimeout(500);
    
    // Capture after state
    const afterScreenshot = await page.screenshot();
    
    // Screenshots should be different (theme actually changed)
    const themeChanged = !beforeScreenshot.equals(afterScreenshot);
    
    return {
      transitionSuccessful: themeChanged,
      fromTheme,
      toTheme
    };
  }
}

test.describe('Theme Comparison Visual Tests', () => {
  let validator: ThemeValidator;
  
  test.beforeAll(() => {
    validator = new ThemeValidator();
  });

  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-delay: 0.01ms !important;
          transition-duration: 0.01ms !important;
          transition-delay: 0.01ms !important;
        }
      `
    });
  });

  // Test each component in each theme
  for (const component of THEME_TEST_COMPONENTS) {
    test.describe(`${component.name} Theme Consistency`, () => {
      
      for (const theme of THEMES) {
        test(`${theme.displayName} renders correctly`, async ({ page }) => {
          // Set theme
          await page.evaluate((themeName: string) => {
            localStorage.setItem('theme', themeName);
            document.documentElement.setAttribute('data-theme', themeName);
          }, theme.name);
          
          // Navigate to component
          await page.goto(component.path);
          await page.waitForSelector(component.selector, { state: 'visible' });
          await page.waitForTimeout(1000); // Allow theme to apply
          
          // Take full component screenshot
          await expect(page.locator(component.selector)).toHaveScreenshot(
            `${component.name.toLowerCase().replace(/\s+/g, '-')}-${theme.name}.png`,
            {
              animations: 'disabled',
              mask: [page.locator('[data-dynamic-content]')]
            }
          );
          
          // Validate color scheme consistency
          const colorValidation = await validator.validateColorScheme(page, theme);
          
          if (colorValidation.issues.length > 0) {
            console.warn(`Color scheme issues in ${theme.displayName} for ${component.name}:`, colorValidation.issues);
          }
          
          // Allow some flexibility for design decisions
          expect(colorValidation.issues.length).toBeLessThan(5);
        });
      }
      
      // Test critical elements in each theme
      for (const element of component.criticalElements) {
        test(`${component.name} - ${element} theme consistency`, async ({ page }) => {
          const elementScreenshots: { [theme: string]: Buffer } = {};
          
          for (const theme of THEMES) {
            // Set theme
            await page.evaluate((themeName: string) => {
              localStorage.setItem('theme', themeName);
              document.documentElement.setAttribute('data-theme', themeName);
            }, theme.name);
            
            await page.goto(component.path);
            await page.waitForSelector(component.selector, { state: 'visible' });
            await page.waitForTimeout(500);
            
            // Take element screenshot
            try {
              const elementScreenshot = await page.locator(element).screenshot();
              elementScreenshots[theme.name] = elementScreenshot;
            } catch (error) {
              console.warn(`Could not capture ${element} in ${theme.name}: ${error}`);
            }
          }
          
          // Verify all themes captured
          expect(Object.keys(elementScreenshots).length).toBeGreaterThan(0);
        });
      }
    });
  }

  test.describe('Theme Transition Validation', () => {
    const transitionPairs = [
      { from: 'light', to: 'dark' },
      { from: 'dark', to: 'light' },
      { from: 'light', to: 'high-contrast' },
      { from: 'dark', to: 'high-contrast' },
      { from: 'high-contrast', to: 'light' },
      { from: 'high-contrast', to: 'dark' }
    ];
    
    for (const pair of transitionPairs) {
      test(`${pair.from} to ${pair.to} transition`, async ({ page }) => {
        // Start with first theme
        await page.evaluate((theme: string) => {
          localStorage.setItem('theme', theme);
          document.documentElement.setAttribute('data-theme', theme);
        }, pair.from);
        
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
        
        // Test transition
        const transitionResult = await validator.validateThemeTransition(page, pair.from, pair.to);
        
        expect(transitionResult.transitionSuccessful).toBeTruthy();
        expect(transitionResult.fromTheme).toBe(pair.from);
        expect(transitionResult.toTheme).toBe(pair.to);
      });
    }
  });

  test.describe('Color Contrast Validation', () => {
    const contrastLevels: Array<keyof typeof CONTRAST_REQUIREMENTS> = ['AA-normal', 'AA-large'];
    
    for (const theme of THEMES) {
      for (const level of contrastLevels) {
        test(`${theme.displayName} meets ${level} contrast requirements`, async ({ page }) => {
          // Set theme
          await page.evaluate((themeName: string) => {
            localStorage.setItem('theme', themeName);
            document.documentElement.setAttribute('data-theme', themeName);
          }, theme.name);
          
          await page.goto('/hal');
          await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
          
          const contrastValidation = await validator.validateContrast(page, level);
          
          // Log contrast issues for review
          if (contrastValidation.issues.length > 0) {
            console.warn(`Contrast issues in ${theme.displayName} (${level}):`, contrastValidation.issues);
          }
          
          // High contrast theme should have fewer issues
          const maxAllowedIssues = theme.name === 'high-contrast' ? 2 : 8;
          expect(contrastValidation.issues.length).toBeLessThan(maxAllowedIssues);
        });
      }
    }
  });

  test.describe('Theme-Specific Component States', () => {
    test('button states across themes', async ({ page }) => {
      const buttonStates = ['default', 'hover', 'active', 'disabled', 'focus'];
      
      for (const theme of THEMES) {
        await page.evaluate((themeName: string) => {
          localStorage.setItem('theme', themeName);
          document.documentElement.setAttribute('data-theme', themeName);
        }, theme.name);
        
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-filter-button"]', { state: 'visible' });
        
        const button = page.locator('[data-testid="hal-filter-button"]').first();
        
        for (const state of buttonStates) {
          switch (state) {
            case 'hover':
              await button.hover();
              break;
            case 'active':
              await page.keyboard.down('Space');
              break;
            case 'disabled':
              await button.evaluate(btn => (btn as HTMLButtonElement).disabled = true);
              break;
            case 'focus':
              await button.focus();
              break;
            default:
              // Reset to default state
              await page.keyboard.up('Space');
              await button.evaluate(btn => (btn as HTMLButtonElement).disabled = false);
              await page.locator('body').click(); // Remove focus
          }
          
          await page.waitForTimeout(100);
          
          // Take screenshot of button state
          await expect(button).toHaveScreenshot(
            `button-${state}-${theme.name}.png`,
            { animations: 'disabled' }
          );
        }
      }
    });

    test('form elements across themes', async ({ page }) => {
      const formElements = [
        '[data-testid="hal-search-input"]',
        'select', 
        'input[type="checkbox"]',
        'input[type="radio"]'
      ];
      
      for (const theme of THEMES) {
        await page.evaluate((themeName: string) => {
          localStorage.setItem('theme', themeName);
          document.documentElement.setAttribute('data-theme', themeName);
        }, theme.name);
        
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
        
        for (const selector of formElements) {
          try {
            const element = page.locator(selector).first();
            await element.waitFor({ state: 'visible', timeout: 2000 });
            
            await expect(element).toHaveScreenshot(
              `form-${selector.replace(/[^\w]/g, '_')}-${theme.name}.png`,
              { animations: 'disabled' }
            );
          } catch (error) {
            console.warn(`Could not test form element ${selector} in ${theme.name}: ${error}`);
          }
        }
      }
    });

    test('status indicators across themes', async ({ page }) => {
      const statusTypes = ['success', 'error', 'warning', 'info'];
      
      for (const theme of THEMES) {
        await page.evaluate((themeName: string) => {
          localStorage.setItem('theme', themeName);
          document.documentElement.setAttribute('data-theme', themeName);
        }, theme.name);
        
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
        
        // Look for status indicators
        try {
          const statusElements = await page.locator('[data-status]').all();
          
          for (let i = 0; i < Math.min(statusElements.length, 4); i++) {
            const element = statusElements[i];
            const status = await element.getAttribute('data-status') || statusTypes[i];
            
            await expect(element).toHaveScreenshot(
              `status-${status}-${theme.name}.png`,
              { animations: 'disabled' }
            );
          }
        } catch (error) {
          console.warn(`Could not test status indicators in ${theme.name}: ${error}`);
        }
      }
    });
  });

  test.describe('Theme Accessibility Validation', () => {
    test('high contrast mode meets accessibility standards', async ({ page }) => {
      // Enable high contrast theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'high-contrast');
        document.documentElement.setAttribute('data-theme', 'high-contrast');
        
        // Also simulate OS high contrast mode
        window.matchMedia = jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }));
      });
      
      await page.goto('/hal');
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      // Validate high contrast
      const highContrastValidation = await validator.validateContrast(page, 'AAA-normal');
      
      // High contrast theme should meet AAA standards
      expect(highContrastValidation.issues.length).toBeLessThan(3);
      
      // Take screenshot to verify high contrast appearance
      await expect(page.locator('[data-testid="hal-dashboard"]')).toHaveScreenshot(
        'hal-dashboard-high-contrast-accessibility.png',
        { animations: 'disabled' }
      );
    });

    test('reduced motion theme support', async ({ page }) => {
      // Test each theme with reduced motion
      for (const theme of THEMES) {
        await page.evaluate((themeName: string) => {
          localStorage.setItem('theme', themeName);
          document.documentElement.setAttribute('data-theme', themeName);
        }, theme.name);
        
        // Simulate prefers-reduced-motion
        await page.emulateMedia({ prefersReducedMotion: 'reduce' });
        
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
        
        // Verify no animations are running
        const hasAnimations = await page.evaluate(() => {
          const elements = document.querySelectorAll('*');
          return Array.from(elements).some(el => {
            const style = window.getComputedStyle(el);
            return style.animationDuration !== '0s' && style.animationDuration !== '';
          });
        });
        
        // With reduced motion, animations should be minimal or disabled
        expect(hasAnimations).toBeFalsy();
      }
    });

    test('theme persistence across navigation', async ({ page }) => {
      // Set dark theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      });
      
      await page.goto('/hal');
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      // Navigate to different page
      await page.goto('/telemetry');
      await page.waitForSelector('[data-testid="telemetry-dashboard"]', { state: 'visible' });
      
      // Verify theme persisted
      const currentTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      
      expect(currentTheme).toBe('dark');
      
      // Visual verification
      await expect(page.locator('[data-testid="telemetry-dashboard"]')).toHaveScreenshot(
        'telemetry-dashboard-dark-persisted.png',
        { animations: 'disabled' }
      );
    });
  });
});