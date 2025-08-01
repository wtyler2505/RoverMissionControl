/**
 * Device Discovery E2E Accessibility Tests
 * 
 * Tests accessibility compliance for device discovery flows including:
 * - Form accessibility
 * - Dynamic content updates
 * - Modal/dialog accessibility
 * - Loading states
 */

import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Device Discovery Accessibility Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to device discovery page
    await page.goto('/device-discovery');
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations on discovery page', async () => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have accessible discovery form', async () => {
    // Check form accessibility
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(['label', 'form-field-multiple-labels'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // All form inputs should have proper labels
    const formInputs = page.locator('input, select, textarea');
    const inputCount = await formInputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = formInputs.nth(i);
      const inputId = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (inputId) {
        // Check for associated label
        const label = page.locator(`label[for="${inputId}"]`);
        const hasLabel = await label.count() > 0;
        
        expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test('should handle device discovery form submission accessibly', async () => {
    // Fill out discovery form
    const deviceNameInput = page.locator('input[name="deviceName"], input[placeholder*="name"]').first();
    const deviceTypeSelect = page.locator('select[name="deviceType"]').first();
    const submitButton = page.locator('button[type="submit"], button[data-testid*="discover"]').first();
    
    if (await deviceNameInput.isVisible()) {
      await deviceNameInput.fill('Test Discovery Device');
    }
    
    if (await deviceTypeSelect.isVisible()) {
      await deviceTypeSelect.selectOption('sensor');
    }
    
    // Form should be submittable via keyboard
    if (await submitButton.isVisible()) {
      await submitButton.focus();
      await page.keyboard.press('Enter');
      
      // Should show loading or success state
      await page.waitForTimeout(1000);
      
      // Loading/success state should be accessible
      const statusElements = page.locator('[role="status"], [aria-live], [role="alert"]');
      await expect(statusElements.first()).toBeVisible();
    }
  });

  test('should provide accessible feedback for discovery results', async () => {
    // Mock discovery results
    await page.route('/api/hardware/discover', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discovered: [
            {
              id: 'discovered-1',
              name: 'Arduino Uno',
              type: 'microcontroller',
              port: 'COM3',
              status: 'available'
            },
            {
              id: 'discovered-2',
              name: 'Raspberry Pi',
              type: 'computer',
              address: '192.168.1.100',
              status: 'available'
            }
          ]
        })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"], button[data-testid*="scan"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Results should be accessible
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Results should be announced to screen readers
    const resultsContainer = page.locator('[data-testid*="results"], [data-testid*="discovered"]');
    if (await resultsContainer.isVisible()) {
      const ariaLive = await resultsContainer.getAttribute('aria-live');
      const role = await resultsContainer.getAttribute('role');
      
      expect(ariaLive || role === 'status').toBeTruthy();
    }
  });

  test('should support keyboard navigation in discovery results', async () => {
    // Mock discovery results
    await page.route('/api/hardware/discover', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discovered: [
            { id: 'dev-1', name: 'Device 1', type: 'sensor' },
            { id: 'dev-2', name: 'Device 2', type: 'actuator' },
            { id: 'dev-3', name: 'Device 3', type: 'sensor' }
          ]
        })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Navigate through discovered devices with Tab
    const deviceCards = page.locator('[data-testid*="device-card"], [role="article"]');
    const deviceCount = await deviceCards.count();
    
    if (deviceCount > 0) {
      // Focus first device
      const firstDevice = deviceCards.first();
      await firstDevice.focus();
      
      // Tab through devices
      for (let i = 1; i < Math.min(deviceCount, 3); i++) {
        await page.keyboard.press('Tab');
        
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      }
    }
  });

  test('should have accessible device registration dialog', async () => {
    // Mock discovery to get devices to register
    await page.route('/api/hardware/discover', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discovered: [
            { id: 'reg-device-1', name: 'Register Test Device', type: 'sensor' }
          ]
        })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Open registration dialog
    const registerButton = page.locator('button[data-testid*="register"], button[data-testid*="add"]').first();
    if (await registerButton.isVisible()) {
      await registerButton.click();
      
      // Wait for dialog to open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      
      // Dialog should be accessible
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
      
      // Dialog should have proper attributes
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      
      // Dialog should have accessible name
      const ariaLabel = await dialog.getAttribute('aria-label');
      const ariaLabelledBy = await dialog.getAttribute('aria-labelledby');
      const dialogTitle = dialog.locator('h1, h2, h3').first();
      
      expect(ariaLabel || ariaLabelledBy || await dialogTitle.isVisible()).toBeTruthy();
      
      // Focus should be trapped in dialog
      const focusableInDialog = dialog.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const focusableCount = await focusableInDialog.count();
      
      if (focusableCount > 0) {
        // Tab through dialog elements
        for (let i = 0; i < Math.min(focusableCount, 5); i++) {
          await page.keyboard.press('Tab');
          
          // Focus should remain within dialog
          const focusedElement = page.locator(':focus');
          const isInDialog = await dialog.locator(':focus').count() > 0;
          expect(isInDialog).toBeTruthy();
        }
      }
      
      // Escape should close dialog
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });

  test('should handle discovery errors accessibly', async () => {
    // Mock discovery error
    await page.route('/api/hardware/discover', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Discovery service unavailable' })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Error should be announced to screen readers
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    
    // Error message should be accessible
    const errorText = await errorAlert.textContent();
    expect(errorText).toBeTruthy();
    expect(errorText!.toLowerCase()).toContain('error');
  });

  test('should provide accessible loading states during discovery', async () => {
    // Mock slow discovery response
    await page.route('/api/hardware/discover', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ discovered: [] })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      
      // Loading state should be visible immediately
      const loadingIndicator = page.locator('[role="status"], [aria-live="polite"]');
      await expect(loadingIndicator.first()).toBeVisible();
      
      // Loading text should indicate what's happening
      const loadingText = await loadingIndicator.first().textContent();
      expect(loadingText?.toLowerCase()).toMatch(/(discovering|scanning|searching|loading)/);
      
      // Wait for discovery to complete
      await page.waitForTimeout(2500);
      
      // Loading should be gone
      await expect(loadingIndicator.first()).toHaveCount(0);
    }
  });

  test('should support manual device addition accessibly', async () => {
    // Look for manual add device button
    const manualAddButton = page.locator('button[data-testid*="manual"], button[data-testid*="add-device"]').first();
    
    if (await manualAddButton.isVisible()) {
      await manualAddButton.click();
      
      // Manual add form should open
      const manualForm = page.locator('form[data-testid*="manual"], [data-testid*="manual-form"]');
      if (await manualForm.isVisible()) {
        // Form should be accessible
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('[data-testid*="manual"]')
          .withRules(['label', 'form-field-multiple-labels'])
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
        
        // Test form completion
        const nameInput = manualForm.locator('input[name*="name"]').first();
        const typeSelect = manualForm.locator('select[name*="type"]').first();
        const portInput = manualForm.locator('input[name*="port"], input[name*="address"]').first();
        
        if (await nameInput.isVisible()) {
          await nameInput.fill('Manual Test Device');
        }
        
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption('sensor');
        }
        
        if (await portInput.isVisible()) {
          await portInput.fill('COM4');
        }
        
        // Submit form
        const submitButton = manualForm.locator('button[type="submit"]').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          
          // Should provide feedback
          const feedback = page.locator('[role="status"], [role="alert"]');
          await expect(feedback.first()).toBeVisible();
        }
      }
    }
  });

  test('should handle device connection testing accessibly', async () => {
    // Mock discovered device
    await page.route('/api/hardware/discover', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discovered: [
            { id: 'test-device', name: 'Connection Test Device', type: 'sensor', port: 'COM3' }
          ]
        })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Test connection button
    const testButton = page.locator('button[data-testid*="test"], button[data-testid*="connect"]').first();
    if (await testButton.isVisible()) {
      // Mock test connection response
      await page.route('/api/hardware/test-connection', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Connection successful' })
        });
      });
      
      await testButton.click();
      
      // Test result should be announced
      const testResult = page.locator('[role="status"], [role="alert"]');
      await expect(testResult.first()).toBeVisible();
      
      const resultText = await testResult.first().textContent();
      expect(resultText?.toLowerCase()).toMatch(/(success|fail|connect|error)/);
    }
  });

  test('should support bulk device operations accessibly', async () => {
    // Mock multiple discovered devices
    await page.route('/api/hardware/discover', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          discovered: [
            { id: 'bulk-1', name: 'Bulk Device 1', type: 'sensor' },
            { id: 'bulk-2', name: 'Bulk Device 2', type: 'actuator' },
            { id: 'bulk-3', name: 'Bulk Device 3', type: 'sensor' }
          ]
        })
      });
    });
    
    // Trigger discovery
    const discoverButton = page.locator('button[data-testid*="discover"]').first();
    if (await discoverButton.isVisible()) {
      await discoverButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Select multiple devices
    const deviceCheckboxes = page.locator('input[type="checkbox"][data-testid*="device"]');
    const checkboxCount = await deviceCheckboxes.count();
    
    if (checkboxCount > 1) {
      // Select first two devices
      await deviceCheckboxes.nth(0).check();
      await deviceCheckboxes.nth(1).check();
      
      // Bulk action buttons should appear
      const bulkActionButtons = page.locator('button[data-testid*="bulk"], button[aria-label*="selected"]');
      
      if (await bulkActionButtons.count() > 0) {
        const firstBulkAction = bulkActionButtons.first();
        
        // Bulk action should indicate count
        const buttonText = await firstBulkAction.textContent();
        const ariaLabel = await firstBulkAction.getAttribute('aria-label');
        
        const label = buttonText || ariaLabel || '';
        expect(label.toLowerCase()).toMatch(/(\d+|selected|all)/);
        
        // Should be keyboard accessible
        await firstBulkAction.focus();
        await page.keyboard.press('Enter');
        
        // Action should provide feedback
        const feedback = page.locator('[role="status"], [role="alert"]');
        await expect(feedback.first()).toBeVisible();
      }
    }
  });
});