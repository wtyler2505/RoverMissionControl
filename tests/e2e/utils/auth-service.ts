import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import path from 'path';

export interface AuthCredentials {
  username: string;
  password: string;
  role: string;
  outputPath: string;
}

/**
 * Authentication Service for E2E Tests
 * 
 * Handles authentication setup, state management, and user role verification
 * for the Rover Mission Control system.
 */
export class AuthService {
  private browser: Browser | null = null;

  /**
   * Create an authenticated browser context and save the state
   */
  async createAuthState(credentials: AuthCredentials): Promise<void> {
    console.log(`🔐 Creating auth state for ${credentials.role}: ${credentials.username}`);

    this.browser = await chromium.launch();
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      // Navigation with retry logic
      await this.navigateWithRetry(page, 'http://localhost:3000/login');

      // Perform login
      await this.performLogin(page, credentials.username, credentials.password);

      // Verify authentication based on role
      await this.verifyRoleAccess(page, credentials.role);

      // Save authentication state
      await context.storageState({ path: credentials.outputPath });

      console.log(`✅ Auth state saved for ${credentials.role}: ${credentials.outputPath}`);
    } finally {
      await context.close();
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Navigate to a URL with retry logic
   */
  private async navigateWithRetry(page: Page, url: string, maxRetries = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        if (response && response.ok()) {
          return;
        }
      } catch (error) {
        console.warn(`Navigation attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) {
          throw new Error(`Failed to navigate to ${url} after ${maxRetries} attempts`);
        }
        await page.waitForTimeout(2000);
      }
    }
  }

  /**
   * Perform login with the given credentials
   */
  private async performLogin(page: Page, username: string, password: string): Promise<void> {
    // Wait for login form
    await page.waitForSelector('[data-testid="login-form"], form, #login-form', {
      timeout: 10000
    });

    // Try different input selectors
    const usernameSelectors = [
      '[data-testid="username-input"]',
      'input[name="username"]',
      'input[type="text"]',
      '#username'
    ];

    const passwordSelectors = [
      '[data-testid="password-input"]',
      'input[name="password"]',
      'input[type="password"]',
      '#password'
    ];

    const loginButtonSelectors = [
      '[data-testid="login-button"]',
      'button[type="submit"]',
      'input[type="submit"]',
      '.login-button',
      '#login-button'
    ];

    // Fill username
    for (const selector of usernameSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.fill(selector, username);
        break;
      } catch (error) {
        continue;
      }
    }

    // Fill password
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.fill(selector, password);
        break;
      } catch (error) {
        continue;
      }
    }

    // Click login button
    for (const selector of loginButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.click(selector);
        break;
      } catch (error) {
        continue;
      }
    }

    // Wait for navigation or success indicator
    try {
      await page.waitForURL(/dashboard|home|main/, { timeout: 15000 });
    } catch (error) {
      // Try alternative success indicators
      await page.waitForSelector('[data-testid="user-menu"], .user-menu, .logout-button', {
        timeout: 15000
      });
    }
  }

  /**
   * Verify role-based access after login
   */
  private async verifyRoleAccess(page: Page, role: string): Promise<void> {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    switch (role) {
      case 'admin':
        await this.verifyAdminAccess(page);
        break;
      case 'operator':
        await this.verifyOperatorAccess(page);
        break;
      case 'viewer':
        await this.verifyViewerAccess(page);
        break;
      default:
        console.warn(`Unknown role: ${role}. Skipping role verification.`);
    }
  }

  /**
   * Verify admin role access
   */
  private async verifyAdminAccess(page: Page): Promise<void> {
    // Admin should have access to all features
    const adminIndicators = [
      '[data-testid="admin-menu"]',
      '.admin-panel',
      '[role="admin"]',
      '.admin-controls'
    ];

    // At least one admin indicator should be present
    for (const selector of adminIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✅ Admin access verified with selector: ${selector}`);
        return;
      } catch (error) {
        continue;
      }
    }

    console.warn('⚠️  Could not verify admin access - no admin indicators found');
  }

  /**
   * Verify operator role access
   */
  private async verifyOperatorAccess(page: Page): Promise<void> {
    // Operator should have control access but no admin features
    const operatorIndicators = [
      '[data-testid="operator-controls"]',
      '.operator-panel',
      '.control-panel'
    ];

    const restrictedElements = [
      '[data-testid="admin-menu"]',
      '.admin-panel'
    ];

    // Check for operator indicators
    for (const selector of operatorIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✅ Operator access verified with selector: ${selector}`);
        break;
      } catch (error) {
        continue;
      }
    }

    // Verify admin elements are not accessible
    for (const selector of restrictedElements) {
      const element = await page.locator(selector).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        console.warn(`⚠️  Operator can see admin element: ${selector}`);
      }
    }
  }

  /**
   * Verify viewer role access (read-only)
   */
  private async verifyViewerAccess(page: Page): Promise<void> {
    // Viewer should have read-only access
    const viewerIndicators = [
      '[data-testid="viewer-dashboard"]',
      '.viewer-panel',
      '.read-only'
    ];

    const restrictedElements = [
      '[data-testid="admin-menu"]',
      '[data-testid="operator-controls"]',
      '.admin-panel',
      '.control-panel'
    ];

    // Check for viewer indicators
    for (const selector of viewerIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`✅ Viewer access verified with selector: ${selector}`);
        break;
      } catch (error) {
        continue;
      }
    }

    // Verify restricted elements are not accessible
    for (const selector of restrictedElements) {
      const element = await page.locator(selector).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        console.warn(`⚠️  Viewer can see restricted element: ${selector}`);
      }
    }
  }

  /**
   * Cleanup method to close browser if still open
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}