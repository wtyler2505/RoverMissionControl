/**
 * HAL Dashboard E2E Accessibility Tests
 * 
 * Comprehensive accessibility testing using Playwright and axe-core
 * Tests WCAG 2.1 AA compliance across different browsers and viewports
 */

import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Test data and utilities
const testDevices = [
  {
    id: 'test-device-1',
    name: 'Temperature Sensor Alpha',
    type: 'sensor',
    status: 'connected',
    capabilities: ['read', 'configure']
  },
  {
    id: 'test-device-2', 
    name: 'Motor Controller Beta',
    type: 'actuator',
    status: 'disconnected',
    capabilities: ['write', 'control']
  }
];

test.describe('HAL Dashboard Accessibility Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to HAL Dashboard
    await page.goto('/hal-dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Mock HAL devices for consistent testing
    await page.route('/api/hal/devices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: testDevices,
          total: testDevices.length,
          connected: testDevices.filter(d => d.status === 'connected').length
        })
      });
    });
    
    // Refresh to apply mocked data
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations on initial load', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should meet WCAG 2.1 AA color contrast requirements', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async () => {
    // Test Tab navigation through dashboard
    await page.keyboard.press('Tab');
    
    // Get currently focused element
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interactive elements
    const tabCount = 10; // Test first 10 tab stops
    for (let i = 0; i < tabCount; i++) {
      await page.keyboard.press('Tab');
      
      const currentFocused = await page.locator(':focus').first();
      await expect(currentFocused).toBeVisible();
      
      // Element should be within viewport
      const boundingBox = await currentFocused.boundingBox();
      expect(boundingBox).toBeTruthy();
    }
  });

  test('should handle keyboard shortcuts appropriately', async () => {
    // Test common keyboard shortcuts
    
    // Escape key should close any open modals/dialogs
    await page.keyboard.press('Escape');
    
    // Check no modal is open
    const modals = page.locator('[role="dialog"]');
    await expect(modals).toHaveCount(0);
    
    // Enter key on focusable elements should activate them
    const firstButton = page.locator('button').first();
    if (await firstButton.isVisible()) {
      await firstButton.focus();
      await page.keyboard.press('Enter');
      
      // Should have some visual or state change (this is context-dependent)
      // For now, just ensure no errors occurred
      await expect(firstButton).toBeVisible();
    }
  });

  test('should have proper heading structure', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['heading-order'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Verify heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    if (headings.length > 0) {
      const headingLevels = await Promise.all(
        headings.map(async heading => {
          const tagName = await heading.evaluate(el => el.tagName);
          return parseInt(tagName.charAt(1));
        })
      );
      
      // First heading should be h1
      expect(headingLevels[0]).toBe(1);
      
      // Check no levels are skipped
      for (let i = 1; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i];
        const prevLevel = headingLevels[i - 1];
        
        if (currentLevel > prevLevel) {
          expect(currentLevel - prevLevel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test('should have proper landmark structure', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['landmark-one-main', 'landmark-no-duplicate-banner'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Should have main landmark
    const mainLandmark = page.locator('[role="main"], main');
    await expect(mainLandmark).toHaveCount(1);
  });

  test('should provide proper focus management', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['focus-order-semantics', 'tabindex'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Test focus trap in modals (if any exist)
    const modalTriggers = await page.locator('[aria-haspopup="dialog"], [data-testid*="modal-trigger"]').all();
    
    for (const trigger of modalTriggers) {
      if (await trigger.isVisible()) {
        await trigger.click();
        
        // Wait for modal to open
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
        
        const modal = page.locator('[role="dialog"]').first();
        await expect(modal).toBeVisible();
        
        // Focus should be trapped in modal
        const focusableInModal = modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const focusableCount = await focusableInModal.count();
        
        if (focusableCount > 0) {
          // Tab through modal elements
          for (let i = 0; i < focusableCount; i++) {
            await page.keyboard.press('Tab');
            const focused = page.locator(':focus');
            
            // Focused element should be within modal
            await expect(modal.locator(':focus')).toHaveCount(1);
          }
        }
        
        // Close modal for next iteration
        await page.keyboard.press('Escape');
        await expect(modal).toHaveCount(0);
      }
    }
  });

  test('should announce dynamic content changes', async () => {
    // Look for live regions
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const liveRegionCount = await liveRegions.count();
    
    expect(liveRegionCount).toBeGreaterThan(0);
    
    // Test that updates are announced (simulate device status change)
    await page.route('/api/hal/devices', async route => {
      const updatedDevices = testDevices.map(device => ({
        ...device,
        status: device.status === 'connected' ? 'disconnected' : 'connected'
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: updatedDevices,
          total: updatedDevices.length,
          connected: updatedDevices.filter(d => d.status === 'connected').length
        })
      });
    });
    
    // Trigger refresh
    const refreshButton = page.locator('button[data-testid*="refresh"]').first();
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Live regions should still be present
    await expect(liveRegions.first()).toBeVisible();
  });

  test('should support screen reader navigation', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['aria-allowed-attr', 'aria-required-attr', 'aria-valid-attr'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Check for proper ARIA labeling
    const interactiveElements = page.locator('button, [role="button"], a[href], input, select, textarea');
    const count = await interactiveElements.count();
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = interactiveElements.nth(i);
      
      // Each interactive element should have accessible name
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      const textContent = await element.textContent();
      
      const hasAccessibleName = ariaLabel || ariaLabelledBy || (textContent && textContent.trim().length > 0);
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('should work with different zoom levels', async () => {
    // Test at 200% zoom
    await page.setViewportSize({ width: 640, height: 360 }); // Simulate 200% zoom
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('should support high contrast mode', async () => {
    // Simulate high contrast mode by adding CSS
    await page.addStyleTag({
      content: `
        * {
          filter: contrast(150%) !important;
        }
      `
    });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should handle reduced motion preferences', async () => {
    // Mock reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Reload page with reduced motion
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should still be accessible
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should be accessible on mobile devices', async () => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Touch targets should be appropriate size (44x44px minimum)
    const touchTargets = page.locator('button, [role="button"], a[href]');
    const count = await touchTargets.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const target = touchTargets.nth(i);
      
      if (await target.isVisible()) {
        const boundingBox = await target.boundingBox();
        if (boundingBox) {
          // Note: This is a guideline check - actual implementation may vary
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test('should provide error feedback accessibly', async () => {
    // Simulate error state
    await page.route('/api/hal/devices', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to load devices' })
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Error should be announced via alert or live region
    const errorElements = page.locator('[role="alert"], [aria-live="assertive"]');
    await expect(errorElements.first()).toBeVisible();
    
    // Error message should be accessible
    const errorText = await errorElements.first().textContent();
    expect(errorText).toBeTruthy();
    expect(errorText!.trim().length).toBeGreaterThan(0);
  });

  test('should maintain accessibility when filtering devices', async () => {
    // Look for filter controls
    const filterInput = page.locator('input[type="search"], input[placeholder*="filter"], input[placeholder*="search"]').first();
    
    if (await filterInput.isVisible()) {
      // Filter input should be properly labeled
      const label = await filterInput.getAttribute('aria-label') || 
                   await page.locator(`label[for="${await filterInput.getAttribute('id')}"]`).textContent();
      expect(label).toBeTruthy();
      
      // Type in filter
      await filterInput.fill('sensor');
      await page.waitForTimeout(500); // Allow for filtering
      
      // Results should still be accessible
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
      
      // Screen reader should be informed of results
      const resultsInfo = page.locator('[aria-live], [role="status"]');
      await expect(resultsInfo.first()).toBeVisible();
    }
  });

  test('should handle device selection accessibly', async () => {
    // Look for device selection controls
    const deviceCheckboxes = page.locator('input[type="checkbox"][data-testid*="device"], [role="checkbox"]');
    const checkboxCount = await deviceCheckboxes.count();
    
    if (checkboxCount > 0) {
      const firstCheckbox = deviceCheckboxes.first();
      
      // Checkbox should be properly labeled
      const ariaLabel = await firstCheckbox.getAttribute('aria-label');
      const ariaLabelledBy = await firstCheckbox.getAttribute('aria-labelledby');
      expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      
      // Select device
      await firstCheckbox.check();
      
      // Selection should be announced
      const selectionFeedback = page.locator('[aria-live], [role="status"]');
      await expect(selectionFeedback.first()).toBeVisible();
      
      // Should still be accessible after selection
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});