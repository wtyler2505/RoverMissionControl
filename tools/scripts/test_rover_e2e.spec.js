const { test, expect } = require('@playwright/test');

test.describe('RoverMissionControl E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
  });

  test('basic navigation and page load', async ({ page }) => {
    // Check if the page loads successfully
    await expect(page).toHaveTitle(/Rover/i);
    
    // Take a screenshot of the initial state
    await page.screenshot({ path: 'screenshots/initial-load.png' });
    
    // Check for main components
    const mainContent = await page.locator('main').isVisible();
    expect(mainContent).toBeTruthy();
  });

  test('rover control interface', async ({ page }) => {
    // Look for control elements
    const controlSection = page.locator('[data-testid="rover-controls"], .controls, #controls');
    
    // Take screenshot of controls
    await page.screenshot({ path: 'screenshots/rover-controls.png' });
    
    // Check if canvas for 3D visualization exists
    const canvas = await page.locator('canvas').isVisible();
    expect(canvas).toBeTruthy();
  });

  test('WebSocket telemetry connection', async ({ page }) => {
    // Monitor console for WebSocket messages
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));
    
    // Wait for potential WebSocket connection
    await page.waitForTimeout(3000);
    
    // Check network requests
    const wsConnected = await page.evaluate(() => {
      // Check if WebSocket is connected
      return window.ws && window.ws.readyState === 1;
    });
    
    console.log('WebSocket connected:', wsConnected);
    console.log('Console messages:', consoleMessages);
  });

  test('3D visualization', async ({ page }) => {
    // Wait for Three.js to load
    await page.waitForTimeout(2000);
    
    // Check if Three.js is loaded
    const hasThreeJS = await page.evaluate(() => {
      return typeof window.THREE !== 'undefined';
    });
    
    expect(hasThreeJS).toBeTruthy();
    
    // Take screenshot of 3D visualization
    await page.screenshot({ path: 'screenshots/3d-visualization.png', fullPage: true });
  });

  test('responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/mobile-view.png' });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/tablet-view.png' });
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/desktop-view.png' });
  });

  test('interactive controls', async ({ page }) => {
    // Try to find and interact with buttons
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons`);
    
    // Click first button if exists
    if (buttons.length > 0) {
      await buttons[0].click();
      await page.waitForTimeout(1000);
    }
    
    // Check for input fields
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input fields`);
  });

  test('accessibility check', async ({ page }) => {
    // Get accessibility tree
    const snapshot = await page.accessibility.snapshot();
    console.log('Accessibility tree available:', !!snapshot);
    
    // Check for ARIA labels
    const ariaElements = await page.locator('[aria-label]').count();
    console.log(`Found ${ariaElements} elements with ARIA labels`);
    
    // Check for proper heading structure
    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    console.log(`Heading structure: ${h1Count} h1s, ${h2Count} h2s`);
  });
});