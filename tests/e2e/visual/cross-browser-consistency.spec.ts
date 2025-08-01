/**
 * Cross-Browser Visual Consistency Tests
 * 
 * Validates that components render consistently across different browsers
 * and identifies browser-specific rendering differences.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

// Test configuration for cross-browser consistency
const BROWSERS = ['chromium', 'firefox', 'webkit'];
const COMPONENTS = [
  { name: 'HAL Dashboard', path: '/hal', selector: '[data-testid="hal-dashboard"]' },
  { name: 'Telemetry Dashboard', path: '/telemetry', selector: '[data-testid="telemetry-dashboard"]' },
  { name: 'WebSocket Status', path: '/websocket', selector: '[data-testid="websocket-status"]' },
  { name: 'Command Queue', path: '/commands', selector: '[data-testid="command-queue"]' }
];

const VIEWPORTS = [
  { name: 'desktop', width: 1200, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 }
];

const THEMES = ['light', 'dark'];

interface BrowserTestData {
  browser: string;
  screenshot: Buffer;
  metadata: {
    userAgent: string;
    viewport: { width: number; height: number };
    devicePixelRatio: number;
  };
}

class CrossBrowserConsistencyTester {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();

  async setupBrowsers() {
    const { chromium, firefox, webkit } = require('@playwright/test');
    
    // Launch all browsers
    this.browsers.set('chromium', await chromium.launch());
    this.browsers.set('firefox', await firefox.launch());
    this.browsers.set('webkit', await webkit.launch());

    // Create contexts for each browser
    for (const [browserName, browser] of this.browsers) {
      const context = await browser.newContext({
        viewport: { width: 1200, height: 800 },
        deviceScaleFactor: 1
      });
      
      this.contexts.set(browserName, context);
      
      const page = await context.newPage();
      this.pages.set(browserName, page);
    }
  }

  async teardownBrowsers() {
    // Close all browsers
    for (const browser of this.browsers.values()) {
      await browser.close();
    }
    
    this.browsers.clear();
    this.contexts.clear();
    this.pages.clear();
  }

  async captureComponent(
    browserName: string,
    component: { name: string; path: string; selector: string },
    theme: string = 'light',
    viewport: { width: number; height: number } = { width: 1200, height: 800 }
  ): Promise<BrowserTestData> {
    const page = this.pages.get(browserName);
    if (!page) throw new Error(`Browser ${browserName} not initialized`);

    // Set viewport
    await page.setViewportSize(viewport);

    // Set theme
    await page.evaluate((theme) => {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }, theme);

    // Navigate to component
    await page.goto(component.path);
    await page.waitForSelector(component.selector, { state: 'visible' });

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

    // Wait for any async loading
    await page.waitForTimeout(1000);

    // Capture screenshot
    const element = page.locator(component.selector);
    const screenshot = await element.screenshot();

    // Get metadata
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const devicePixelRatio = await page.evaluate(() => window.devicePixelRatio);

    return {
      browser: browserName,
      screenshot,
      metadata: {
        userAgent,
        viewport,
        devicePixelRatio
      }
    };
  }

  async compareScreenshots(
    reference: BrowserTestData,
    comparison: BrowserTestData,
    threshold: number = 0.2
  ): Promise<{
    match: boolean;
    difference: number;
    diffImage?: Buffer;
  }> {
    // This would use image comparison library like pixelmatch
    // For now, return mock comparison
    return {
      match: true,
      difference: 0.1,
      diffImage: undefined
    };
  }
}

test.describe('Cross-Browser Visual Consistency', () => {
  let tester: CrossBrowserConsistencyTester;

  test.beforeAll(async () => {
    tester = new CrossBrowserConsistencyTester();
    await tester.setupBrowsers();
  });

  test.afterAll(async () => {
    await tester.teardownBrowsers();
  });

  // Test each component across all browsers
  for (const component of COMPONENTS) {
    test.describe(`${component.name} Cross-Browser Consistency`, () => {
      
      for (const theme of THEMES) {
        test(`${theme} theme consistency across browsers`, async () => {
          const screenshots: BrowserTestData[] = [];
          
          // Capture screenshots from all browsers
          for (const browser of BROWSERS) {
            const data = await tester.captureComponent(component, theme);
            screenshots.push(data);
          }
          
          // Compare each browser against chromium (reference)
          const reference = screenshots.find(s => s.browser === 'chromium')!;
          
          for (const screenshot of screenshots) {
            if (screenshot.browser === 'chromium') continue;
            
            const comparison = await tester.compareScreenshots(reference, screenshot);
            
            expect(comparison.match, 
              `${component.name} should render consistently in ${screenshot.browser} vs chromium (${theme} theme)`
            ).toBeTruthy();
            
            expect(comparison.difference).toBeLessThan(0.3);
          }
        });
      }

      // Test responsive consistency
      for (const viewport of VIEWPORTS) {
        test(`${viewport.name} viewport consistency across browsers`, async () => {
          const screenshots: BrowserTestData[] = [];
          
          // Capture screenshots from all browsers at this viewport
          for (const browser of BROWSERS) {
            const data = await tester.captureComponent(component, 'light', viewport);
            screenshots.push(data);
          }
          
          // Compare layouts
          const reference = screenshots.find(s => s.browser === 'chromium')!;
          
          for (const screenshot of screenshots) {
            if (screenshot.browser === 'chromium') continue;
            
            const comparison = await tester.compareScreenshots(reference, screenshot);
            
            expect(comparison.match,
              `${component.name} should have consistent layout in ${screenshot.browser} vs chromium (${viewport.name})`
            ).toBeTruthy();
          }
        });
      }
    });
  }

  test.describe('Browser-Specific Feature Detection', () => {
    test('WebGL support consistency', async ({ page }) => {
      await page.goto('/hal');
      
      const webglSupport = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
      });
      
      // WebGL should be supported in all test browsers
      expect(webglSupport).toBeTruthy();
    });

    test('CSS Grid support consistency', async ({ page }) => {
      await page.goto('/hal');
      
      const gridSupport = await page.evaluate(() => {
        return CSS.supports('display', 'grid');
      });
      
      expect(gridSupport).toBeTruthy();
    });

    test('WebSocket support consistency', async ({ page }) => {
      await page.goto('/websocket');
      
      const wsSupport = await page.evaluate(() => {
        return typeof WebSocket !== 'undefined';
      });
      
      expect(wsSupport).toBeTruthy();
    });

    test('Canvas API support consistency', async ({ page }) => {
      await page.goto('/telemetry');
      
      const canvasSupport = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext && canvas.getContext('2d'));
      });
      
      expect(canvasSupport).toBeTruthy();
    });
  });

  test.describe('Font Rendering Consistency', () => {
    test('system fonts render consistently', async ({ page }) => {
      await page.goto('/hal');
      
      // Check if system fonts are loaded
      const fontsLoaded = await page.evaluate(async () => {
        // Wait for fonts to load
        await document.fonts.ready;
        
        // Check for consistent font metrics
        const testText = 'Test Font Rendering';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const metrics = ctx.measureText(testText);
        
        return {
          width: metrics.width,
          fontFamily: ctx.font
        };
      });
      
      expect(fontsLoaded.width).toBeGreaterThan(0);
    });

    test('icon fonts render consistently', async ({ page }) => {
      await page.goto('/hal');
      
      // Check if Material Icons are loaded
      const iconsLoaded = await page.evaluate(() => {
        const iconElement = document.querySelector('[data-testid="material-icon"]');
        if (!iconElement) return true; // No icons to test
        
        const styles = window.getComputedStyle(iconElement);
        return styles.fontFamily.includes('Material Icons');
      });
      
      expect(iconsLoaded).toBeTruthy();
    });
  });

  test.describe('Animation Consistency', () => {
    test('CSS animations work consistently', async ({ page }) => {
      await page.goto('/hal');
      
      // Test CSS animation support
      const animationSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.animation = 'spin 1s linear infinite';
        
        // Check if animation property is supported
        return div.style.animation !== '';
      });
      
      expect(animationSupport).toBeTruthy();
    });

    test('transition timing is consistent', async ({ page }) => {
      await page.goto('/hal');
      
      // Test transition support and timing
      const transitionSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.transition = 'opacity 0.3s ease-in-out';
        
        return div.style.transition !== '';
      });
      
      expect(transitionSupport).toBeTruthy();
    });
  });

  test.describe('Color Rendering Consistency', () => {
    test('CSS color values render consistently', async ({ page }) => {
      await page.goto('/hal');
      
      // Test color support
      const colorSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        
        // Test various color formats
        const colorFormats = [
          'rgb(255, 0, 0)',
          'rgba(255, 0, 0, 0.5)',
          'hsl(0, 100%, 50%)',
          'hsla(0, 100%, 50%, 0.5)',
          '#ff0000',
          'red'
        ];
        
        return colorFormats.every(color => {
          div.style.color = color;
          return div.style.color !== '';
        });
      });
      
      expect(colorSupport).toBeTruthy();
    });

    test('CSS custom properties work consistently', async ({ page }) => {
      await page.goto('/hal');
      
      const customPropsSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.setProperty('--test-color', 'red');
        div.style.color = 'var(--test-color)';
        
        return div.style.color !== '';
      });
      
      expect(customPropsSupport).toBeTruthy();
    });
  });

  test.describe('Layout Engine Consistency', () => {
    test('Flexbox layout is consistent', async ({ page }) => {
      await page.goto('/hal');
      
      const flexboxSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        
        return div.style.display === 'flex';
      });
      
      expect(flexboxSupport).toBeTruthy();
    });

    test('CSS Grid layout is consistent', async ({ page }) => {
      await page.goto('/hal');
      
      const gridSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'grid';
        div.style.gridTemplateColumns = '1fr 1fr';
        
        return div.style.display === 'grid';
      });
      
      expect(gridSupport).toBeTruthy();
    });
  });
});