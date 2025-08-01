import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model
 * 
 * Provides common functionality and patterns for all page objects.
 * Includes navigation, waiting, error handling, and accessibility helpers.
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL || 'http://localhost:3000';
  }

  /**
   * Navigate to the page
   */
  abstract goto(): Promise<void>;

  /**
   * Check if the page is loaded
   */
  abstract isLoaded(): Promise<boolean>;

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for element to be visible with retry logic
   */
  async waitForElement(selector: string, timeout = 10000): Promise<Locator> {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible({ timeout });
    return element;
  }

  /**
   * Wait for element to disappear
   */
  async waitForElementToDisappear(selector: string, timeout = 10000): Promise<void> {
    await expect(this.page.locator(selector)).not.toBeVisible({ timeout });
  }

  /**
   * Safe click with wait and visibility check
   */
  async safeClick(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    const element = await this.waitForElement(selector, options?.timeout);
    await element.click({ force: options?.force });
  }

  /**
   * Safe fill with wait and clear
   */
  async safeFill(selector: string, value: string, options?: { timeout?: number }): Promise<void> {
    const element = await this.waitForElement(selector, options?.timeout);
    await element.clear();
    await element.fill(value);
  }

  /**
   * Safe select option
   */
  async safeSelect(selector: string, value: string, options?: { timeout?: number }): Promise<void> {
    const element = await this.waitForElement(selector, options?.timeout);
    await element.selectOption(value);
  }

  /**
   * Check if element exists (without waiting)
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.count() > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if element is visible (without waiting)
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Get element text content safely
   */
  async getTextContent(selector: string, timeout = 5000): Promise<string> {
    const element = await this.waitForElement(selector, timeout);
    return await element.textContent() || '';
  }

  /**
   * Get element attribute safely
   */
  async getAttribute(selector: string, attribute: string, timeout = 5000): Promise<string | null> {
    const element = await this.waitForElement(selector, timeout);
    return await element.getAttribute(attribute);
  }

  /**
   * Wait for page title to contain text
   */
  async waitForTitle(expectedTitle: string, timeout = 10000): Promise<void> {
    await expect(this.page).toHaveTitle(new RegExp(expectedTitle, 'i'), { timeout });
  }

  /**
   * Wait for URL to match pattern
   */
  async waitForURL(pattern: string | RegExp, timeout = 10000): Promise<void> {
    await expect(this.page).toHaveURL(pattern, { timeout });
  }

  /**
   * Handle common loading states
   */
  async waitForLoadingToComplete(): Promise<void> {
    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '.circular-progress',
      '[role="progressbar"]'
    ];

    for (const selector of loadingSelectors) {
      try {
        await this.waitForElementToDisappear(selector, 30000);
      } catch {
        // Loading indicator might not exist, which is fine
      }
    }
  }

  /**
   * Handle error dialogs and notifications
   */
  async checkForErrors(): Promise<string[]> {
    const errors: string[] = [];

    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '.alert-error',
      '[role="alert"][data-severity="error"]',
      '.snackbar-error'
    ];

    for (const selector of errorSelectors) {
      try {
        const errorElements = await this.page.locator(selector).all();
        for (const element of errorElements) {
          if (await element.isVisible()) {
            const errorText = await element.textContent();
            if (errorText) {
              errors.push(errorText.trim());
            }
          }
        }
      } catch {
        // Error element might not exist
      }
    }

    return errors;
  }

  /**
   * Dismiss notifications and alerts
   */
  async dismissNotifications(): Promise<void> {
    const dismissSelectors = [
      '[data-testid="notification-close"]',
      '.notification-close',
      '.alert-close',
      '.snackbar-close',
      '[aria-label="Close"]'
    ];

    for (const selector of dismissSelectors) {
      try {
        const elements = await this.page.locator(selector).all();
        for (const element of elements) {
          if (await element.isVisible()) {
            await element.click();
            await this.page.waitForTimeout(500); // Wait for animation
          }
        }
      } catch {
        // Dismiss element might not exist
      }
    }
  }

  /**
   * Take screenshot with descriptive name
   */
  async takeScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Accessibility helpers
   */
  async checkAccessibility(): Promise<void> {
    // This would integrate with axe-core or similar accessibility testing tools
    // For now, we'll check basic accessibility patterns
    
    // Check for proper heading hierarchy
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    if (headings.length === 0) {
      console.warn('No headings found on page - may impact accessibility');
    }

    // Check for alt text on images
    const images = await this.page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      if (!alt && !ariaLabel) {
        console.warn('Image without alt text found - impacts accessibility');
      }
    }

    // Check for proper form labels
    const inputs = await this.page.locator('input, select, textarea').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (id) {
        const label = await this.page.locator(`label[for="${id}"]`).count();
        if (label === 0 && !ariaLabel && !ariaLabelledBy) {
          console.warn('Form input without proper label found - impacts accessibility');
        }
      }
    }
  }

  /**
   * Wait for network requests to complete
   */
  async waitForNetworkIdle(timeout = 10000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Mock API responses for testing
   */
  async mockAPIResponse(url: string | RegExp, response: any): Promise<void> {
    await this.page.route(url, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Intercept and verify API calls
   */
  async interceptAPICall(url: string | RegExp): Promise<any[]> {
    const interceptedRequests: any[] = [];

    await this.page.route(url, route => {
      interceptedRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        headers: route.request().headers(),
        postData: route.request().postData()
      });
      route.continue();
    });

    return interceptedRequests;
  }

  /**
   * Debug helpers
   */
  async logPageErrors(): Promise<void> {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Page error:', msg.text());
      }
    });

    this.page.on('pageerror', error => {
      console.error('Page exception:', error.message);
    });

    this.page.on('requestfailed', request => {
      console.error('Request failed:', request.url(), request.failure()?.errorText);
    });
  }

  /**
   * Performance monitoring
   */
  async measurePageLoad(): Promise<{ [key: string]: number }> {
    const navigationTiming = await this.page.evaluate(() => {
      const perfData = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    return navigationTiming;
  }

  /**
   * Wait for animations to complete
   */
  async waitForAnimations(): Promise<void> {
    await this.page.waitForFunction(() => {
      const elements = document.querySelectorAll('*');
      for (let element of elements) {
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.animationPlayState === 'running' || 
            computedStyle.transitionProperty !== 'none') {
          return false;
        }
      }
      return true;
    }, { timeout: 10000 });
  }
}