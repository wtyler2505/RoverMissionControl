/**
 * Playwright Visual Regression Tests for HAL Dashboard
 * 
 * End-to-end visual testing with cross-browser comparison,
 * responsive design validation, and theme consistency.
 */

import { test, expect } from '@playwright/test';

test.describe('HAL Dashboard Visual Regression', () => {
  // Setup authentication and base state
  test.beforeEach(async ({ page }) => {
    // Navigate to HAL dashboard
    await page.goto('/hal');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Wait for HAL components to initialize
    await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
    
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
    
    // Wait for any initial data loading
    await page.waitForTimeout(1000);
  });

  test.describe('Theme Consistency', () => {
    test('light theme renders consistently', async ({ page }) => {
      // Ensure light theme is active
      await page.evaluate(() => {
        localStorage.setItem('theme', 'light');
        document.documentElement.setAttribute('data-theme', 'light');
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('hal-dashboard-light-theme.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('dark theme renders consistently', async ({ page }) => {
      // Switch to dark theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('hal-dashboard-dark-theme.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('high contrast theme renders consistently', async ({ page }) => {
      // Switch to high contrast theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'high-contrast');
        document.documentElement.setAttribute('data-theme', 'high-contrast');
        document.documentElement.setAttribute('data-contrast', 'high');
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('hal-dashboard-high-contrast-theme.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Responsive Design', () => {
    test('mobile viewport (375x667)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-mobile.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('tablet viewport (768x1024)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-tablet.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('desktop viewport (1200x800)', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-desktop.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('ultrawide viewport (1920x1080)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-ultrawide.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Component States', () => {
    test('loading state', async ({ page }) => {
      // Intercept API calls to simulate loading
      await page.route('/api/hal/devices', async route => {
        await page.waitForTimeout(5000); // Delay response
        await route.continue();
      });
      
      await page.reload();
      
      // Capture loading state
      await expect(page.locator('[data-testid="hal-dashboard"]')).toHaveScreenshot('hal-dashboard-loading.png', {
        animations: 'disabled'
      });
    });

    test('error state', async ({ page }) => {
      // Mock API error
      await page.route('/api/hal/devices', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to connect to HAL devices' })
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="hal-error-state"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-error.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('empty state', async ({ page }) => {
      // Mock empty device list
      await page.route('/api/hal/devices', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ devices: [] })
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="hal-empty-state"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-empty.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('populated state with devices', async ({ page }) => {
      // Mock device data
      const mockDevices = [
        {
          id: 'device-1',
          name: 'Navigation Unit',
          type: 'navigation',
          status: 'connected',
          firmware: '2.1.3',
          batteryLevel: 85,
          signalStrength: 92
        },
        {
          id: 'device-2',
          name: 'Sensor Array',
          type: 'sensor',
          status: 'connected', 
          firmware: '1.8.2',
          batteryLevel: 67,
          signalStrength: 78
        },
        {
          id: 'device-3',
          name: 'Communication Module',
          type: 'communication',
          status: 'error',
          firmware: '3.0.1',
          batteryLevel: 45,
          signalStrength: 12,
          error: 'Connection timeout'
        }
      ];
      
      await page.route('/api/hal/devices', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ devices: mockDevices })
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="device-card"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-populated.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Interactive States', () => {
    test('device selection', async ({ page }) => {
      await page.waitForSelector('[data-testid="device-card"]');
      
      // Click on first device
      await page.click('[data-testid="device-card"]:first-child');
      await page.waitForTimeout(300); // Wait for selection animation
      
      await expect(page).toHaveScreenshot('hal-dashboard-device-selected.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('search active', async ({ page }) => {
      // Activate search
      await page.click('[data-testid="hal-search-input"]');
      await page.fill('[data-testid="hal-search-input"]', 'navigation');
      await page.waitForTimeout(300); // Wait for search results
      
      await expect(page).toHaveScreenshot('hal-dashboard-search-active.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('filters applied', async ({ page }) => {
      // Open filter menu
      await page.click('[data-testid="hal-filter-button"]');
      await page.waitForSelector('[data-testid="filter-menu"]', { state: 'visible' });
      
      // Apply status filter
      await page.click('[data-testid="filter-status-connected"]');
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot('hal-dashboard-filters-applied.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('settings dialog open', async ({ page }) => {
      // Open settings
      await page.click('[data-testid="hal-settings-button"]');
      await page.waitForSelector('[data-testid="hal-settings-dialog"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-settings-dialog.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Cross-Browser Consistency', () => {
    test('renders consistently across browsers', async ({ page, browserName }) => {
      // Take screenshot with browser name in filename
      await expect(page).toHaveScreenshot(`hal-dashboard-${browserName}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Accessibility Visual States', () => {
    test('high contrast mode', async ({ page }) => {
      // Enable high contrast
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            :root {
              --background: #000000;
              --surface: #ffffff;
              --text-primary: #ffffff;
              --text-secondary: #ffff00;
            }
          }
        `
      });
      
      await page.emulateMedia({ prefersContrast: 'high' });
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-high-contrast-a11y.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('reduced motion', async ({ page }) => {
      await page.emulateMedia({ prefersReducedMotion: 'reduce' });
      await page.reload();
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      await expect(page).toHaveScreenshot('hal-dashboard-reduced-motion.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('focus visible states', async ({ page }) => {
      // Navigate with keyboard to show focus states  
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      
      await expect(page).toHaveScreenshot('hal-dashboard-focus-visible.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Performance States', () => {
    test('renders correctly under slow network', async ({ page }) => {
      // Simulate slow 3G
      await page.route('/api/**', async route => {
        await page.waitForTimeout(2000); // 2 second delay
        await route.continue();
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('hal-dashboard-slow-network.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('renders correctly with many devices', async ({ page }) => {
      // Mock large device list
      const manyDevices = Array.from({ length: 50 }, (_, i) => ({
        id: `device-${i + 1}`,
        name: `Device ${i + 1}`,
        type: ['navigation', 'sensor', 'communication', 'actuator'][i % 4],
        status: ['connected', 'disconnected', 'error', 'warning'][i % 4],
        firmware: `1.${i % 10}.${(i * 2) % 10}`,
        batteryLevel: Math.floor(Math.random() * 100),
        signalStrength: Math.floor(Math.random() * 100)
      }));
      
      await page.route('/api/hal/devices', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ devices: manyDevices })
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="device-card"]', { state: 'visible' });
      
      // Wait for virtualization to render
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('hal-dashboard-many-devices.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });
});