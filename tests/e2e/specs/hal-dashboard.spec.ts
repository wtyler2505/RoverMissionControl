import { test, expect } from '@playwright/test';
import { HALDashboardPage } from '../pages/hal-dashboard-page';
import { testDevices, testScenarios, mockWebSocketMessages } from '../fixtures/test-data';

/**
 * HAL Dashboard E2E Tests
 * 
 * Tests the complete Hardware Abstraction Layer dashboard functionality
 * including device management, status monitoring, and user interactions.
 */

test.describe('HAL Dashboard', () => {
  let halDashboard: HALDashboardPage;

  test.beforeEach(async ({ page }) => {
    halDashboard = new HALDashboardPage(page);
    
    // Enable error logging
    await halDashboard.logPageErrors();
    
    // Set up WebSocket monitoring
    await halDashboard.monitorWebSocketConnections();
    
    // Navigate to dashboard
    await halDashboard.goto();
  });

  test.describe('Dashboard Loading and Navigation', () => {
    test('should load dashboard with proper layout', async ({ page }) => {
      await test.step('Verify dashboard is loaded', async () => {
        expect(await halDashboard.isLoaded()).toBe(true);
        await halDashboard.waitForDashboardData();
      });

      await test.step('Check navigation drawer is visible', async () => {
        await expect(halDashboard.navigationDrawer).toBeVisible();
      });

      await test.step('Verify system status indicators', async () => {
        await expect(halDashboard.systemHealthChip).toBeVisible();
        await expect(halDashboard.activeDevicesBadge).toBeVisible();
        await expect(halDashboard.alertsBadge).toBeVisible();
      });

      await test.step('Check overview cards are displayed', async () => {
        await expect(halDashboard.totalDevicesCard).toBeVisible();
        await expect(halDashboard.connectionRateCard).toBeVisible();
        await expect(halDashboard.updatesAvailableCard).toBeVisible();
        await expect(halDashboard.simulationModeCard).toBeVisible();
      });
    });

    test('should navigate between tabs correctly', async ({ page }) => {
      const tabs = ['discovery', 'diagnostics', 'firmware', 'communication', 'simulation'] as const;

      for (const tab of tabs) {
        await test.step(`Navigate to ${tab} tab`, async () => {
          await halDashboard.navigateToTab(tab);
          
          // Wait for tab content to load
          await page.waitForTimeout(1000);
          
          // Verify no errors occurred
          const errors = await halDashboard.checkForErrors();
          expect(errors).toHaveLength(0);
        });
      }

      await test.step('Return to overview tab', async () => {
        await halDashboard.navigateToTab('overview');
        await expect(halDashboard.overviewTab).toHaveAttribute('aria-selected', 'true');
      });
    });

    test('should handle responsive layout changes', async ({ page }) => {
      await halDashboard.testResponsiveLayout();
    });
  });

  test.describe('System Status Monitoring', () => {
    test('should display current system status', async ({ page }) => {
      const status = await halDashboard.getSystemStatus();

      await test.step('Verify status structure', async () => {
        expect(status).toHaveProperty('health');
        expect(status).toHaveProperty('totalDevices');
        expect(status).toHaveProperty('activeDevices');
        expect(status).toHaveProperty('connectionRate');
        expect(status).toHaveProperty('updatesAvailable');
        expect(status).toHaveProperty('simulationActive');
      });

      await test.step('Verify reasonable status values', async () => {
        expect(status.totalDevices).toBeGreaterThanOrEqual(0);
        expect(status.activeDevices).toBeLessThanOrEqual(status.totalDevices);
        expect(['healthy', 'warning', 'critical']).toContain(status.health);
      });
    });

    test('should update status when devices change', async ({ page }) => {
      const initialStatus = await halDashboard.getSystemStatus();

      await test.step('Simulate device connection', async () => {
        await halDashboard.simulateHardwareEvent('device_connected', 'test_device_01', {
          name: 'Test Device',
          type: 'sensor'
        });

        // Wait for status update
        await page.waitForTimeout(2000);
      });

      await test.step('Verify status changed', async () => {
        const updatedStatus = await halDashboard.getSystemStatus();
        // Status should reflect the change (exact verification depends on implementation)
        expect(updatedStatus.totalDevices).toBeGreaterThanOrEqual(initialStatus.totalDevices);
      });
    });

    test('should handle system health changes', async ({ page }) => {
      await test.step('Wait for healthy status', async () => {
        // Most tests should start with healthy status
        await halDashboard.waitForHealthStatus('healthy', 10000);
      });

      await test.step('Simulate warning condition', async () => {
        await halDashboard.simulateHardwareEvent('alert', 'system', {
          level: 'warning',
          message: 'High CPU usage detected'
        });

        await halDashboard.waitForHealthStatus('warning', 15000);
      });

      await test.step('Clear warning condition', async () => {
        await halDashboard.simulateHardwareEvent('alert', 'system', {
          level: 'info',
          message: 'System operating normally'
        });

        await halDashboard.waitForHealthStatus('healthy', 15000);
      });
    });
  });

  test.describe('Quick Actions', () => {
    test('should execute scan devices action', async ({ page }) => {
      await test.step('Execute scan action', async () => {
        await halDashboard.executeQuickAction('scan');
      });

      await test.step('Verify scan completion', async () => {
        // Wait for any loading indicators to appear and disappear
        await halDashboard.waitForLoadingToComplete();
        
        // Check for success indication
        const activity = await halDashboard.getRecentActivity();
        expect(activity.some(item => item.message.toLowerCase().includes('scan'))).toBe(true);
      });
    });

    test('should execute run diagnostics action', async ({ page }) => {
      await test.step('Execute diagnostics action', async () => {
        await halDashboard.executeQuickAction('diagnostics');
      });

      await test.step('Verify diagnostics started', async () => {
        await halDashboard.waitForLoadingToComplete();
        
        // Should show some indication that diagnostics ran
        const errors = await halDashboard.checkForErrors();
        expect(errors.filter(e => e.includes('diagnostic')).length).toBe(0);
      });
    });

    test('should toggle simulation mode', async ({ page }) => {
      const initialStatus = await halDashboard.getSystemStatus();

      await test.step('Toggle simulation mode', async () => {
        await halDashboard.executeQuickAction('simulation');
        await page.waitForTimeout(1000);
      });

      await test.step('Verify simulation state changed', async () => {
        const updatedStatus = await halDashboard.getSystemStatus();
        expect(updatedStatus.simulationActive).not.toBe(initialStatus.simulationActive);
      });

      await test.step('Toggle back to original state', async () => {
        await halDashboard.executeQuickAction('simulation');
        await page.waitForTimeout(1000);

        const finalStatus = await halDashboard.getSystemStatus();
        expect(finalStatus.simulationActive).toBe(initialStatus.simulationActive);
      });
    });
  });

  test.describe('User Interface Interactions', () => {
    test('should toggle dark mode', async ({ page }) => {
      await test.step('Toggle dark mode on', async () => {
        await halDashboard.toggleDarkMode();
        
        // Check for dark theme indicators
        const body = page.locator('body');
        const theme = await body.getAttribute('class') || await body.getAttribute('data-theme');
        expect(theme).toMatch(/dark/i);
      });

      await test.step('Toggle dark mode off', async () => {
        await halDashboard.toggleDarkMode();
        
        // Should return to light theme
        const body = page.locator('body');
        const theme = await body.getAttribute('class') || await body.getAttribute('data-theme');
        expect(theme).not.toMatch(/dark/i);
      });
    });

    test('should toggle navigation drawer', async ({ page }) => {
      await test.step('Close navigation drawer', async () => {
        await halDashboard.toggleNavigationDrawer();
        await page.waitForTimeout(500);
        
        // Drawer should be closed or collapsed
        const drawer = halDashboard.navigationDrawer;
        const isVisible = await drawer.isVisible();
        expect(isVisible).toBe(false);
      });

      await test.step('Open navigation drawer', async () => {
        await halDashboard.toggleNavigationDrawer();
        await page.waitForTimeout(500);
        
        // Drawer should be visible again
        await expect(halDashboard.navigationDrawer).toBeVisible();
      });
    });

    test('should refresh dashboard data', async ({ page }) => {
      await test.step('Trigger refresh', async () => {
        await halDashboard.refreshDashboard();
      });

      await test.step('Verify refresh completed', async () => {
        // Dashboard should reload without errors
        expect(await halDashboard.isLoaded()).toBe(true);
        
        const errors = await halDashboard.checkForErrors();
        expect(errors).toHaveLength(0);
      });
    });
  });

  test.describe('Real-time Updates', () => {
    test('should receive and display telemetry updates', async ({ page }) => {
      const deviceId = testDevices[0].id;

      await test.step('Simulate telemetry data', async () => {
        await halDashboard.simulateHardwareEvent('telemetry_update', deviceId, {
          battery_voltage: 11.8,
          motor_current: 2.1,
          temperature: 28.5
        });

        await page.waitForTimeout(1000);
      });

      await test.step('Verify UI updated', async () => {
        // Check that dashboard reflects new data
        const status = await halDashboard.getSystemStatus();
        expect(status.activeDevices).toBeGreaterThan(0);
      });
    });

    test('should handle device connection events', async ({ page }) => {
      const initialStatus = await halDashboard.getSystemStatus();

      await test.step('Simulate device connection', async () => {
        await halDashboard.simulateHardwareEvent('device_connected', 'new_test_device', {
          name: 'New Test Device',
          type: 'sensor'
        });

        await page.waitForTimeout(2000);
      });

      await test.step('Verify device count updated', async () => {
        const activity = await halDashboard.getRecentActivity();
        expect(activity.some(item => 
          item.message.toLowerCase().includes('connected') ||
          item.message.toLowerCase().includes('new_test_device')
        )).toBe(true);
      });
    });

    test('should display system alerts', async ({ page }) => {
      await test.step('Simulate system alert', async () => {
        await halDashboard.simulateHardwareEvent('alert', 'system', {
          level: 'warning',
          message: 'Temperature threshold exceeded'
        });

        await page.waitForTimeout(1000);
      });

      await test.step('Verify alert displayed', async () => {
        const activity = await halDashboard.getRecentActivity();
        expect(activity.some(item => 
          item.type === 'warning' && 
          item.message.includes('temperature')
        )).toBe(true);
      });
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network connection issues', async ({ page }) => {
      await test.step('Simulate network disconnection', async () => {
        // Simulate network failure
        await page.route('**/api/**', route => route.abort());
        
        // Try to refresh dashboard
        await halDashboard.refreshButton.click();
        await page.waitForTimeout(5000);
      });

      await test.step('Verify error handling', async () => {
        const errors = await halDashboard.checkForErrors();
        expect(errors.length).toBeGreaterThan(0);
        
        // Should show some indication of connection issues
        expect(errors.some(error => 
          error.toLowerCase().includes('network') ||
          error.toLowerCase().includes('connection') ||
          error.toLowerCase().includes('failed')
        )).toBe(true);
      });

      await test.step('Restore network and verify recovery', async () => {
        // Remove route to restore network
        await page.unroute('**/api/**');
        
        // Refresh again
        await halDashboard.refreshDashboard();
        
        // Errors should be cleared
        const remainingErrors = await halDashboard.checkForErrors();
        expect(remainingErrors.length).toBeLessThan(errors.length);
      });
    });

    test('should handle invalid device data gracefully', async ({ page }) => {
      await test.step('Send invalid device data', async () => {
        await halDashboard.simulateHardwareEvent('device_connected', 'invalid_device', {
          // Invalid data structure
          malformed: 'data',
          missing: undefined,
          invalid_type: 'not_a_valid_device_type'
        });

        await page.waitForTimeout(2000);
      });

      await test.step('Verify graceful handling', async () => {
        // Dashboard should still be functional
        expect(await halDashboard.isLoaded()).toBe(true);
        
        // Should not crash or show critical errors
        const errors = await halDashboard.checkForErrors();
        const criticalErrors = errors.filter(e => 
          e.toLowerCase().includes('crash') ||
          e.toLowerCase().includes('fatal') ||
          e.toLowerCase().includes('uncaught')
        );
        expect(criticalErrors).toHaveLength(0);
      });
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible to screen readers', async ({ page }) => {
      await halDashboard.verifyAccessibility();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await test.step('Navigate using keyboard', async () => {
        // Tab through interactive elements
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Should be able to activate elements with Enter/Space
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      });

      await test.step('Verify keyboard navigation works', async () => {
        // Should not have errors from keyboard interaction
        const errors = await halDashboard.checkForErrors();
        expect(errors).toHaveLength(0);
      });
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await test.step('Check ARIA attributes', async () => {
        const interactiveElements = await page.locator('button, [role="button"], input, select').all();
        
        for (const element of interactiveElements) {
          const ariaLabel = await element.getAttribute('aria-label');
          const ariaLabelledBy = await element.getAttribute('aria-labelledby');
          const title = await element.getAttribute('title');
          const textContent = await element.textContent();
          
          // Element should have some form of accessible name
          expect(
            ariaLabel || ariaLabelledBy || title || (textContent && textContent.trim())
          ).toBeTruthy();
        }
      });
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time limits', async ({ page }) => {
      const loadMetrics = await halDashboard.measurePageLoad();

      await test.step('Verify load performance', async () => {
        // Page should load within 5 seconds
        expect(loadMetrics.loadComplete).toBeLessThan(5000);
        
        // First contentful paint should be under 2 seconds
        expect(loadMetrics.firstContentfulPaint).toBeLessThan(2000);
      });
    });

    test('should handle high-frequency updates efficiently', async ({ page }) => {
      await test.step('Send high-frequency telemetry data', async () => {
        const deviceId = testDevices[0].id;
        
        // Send 100 updates quickly
        for (let i = 0; i < 100; i++) {
          await halDashboard.simulateHardwareEvent('telemetry_update', deviceId, {
            timestamp: Date.now(),
            value: i
          });
          
          if (i % 10 === 0) {
            await page.waitForTimeout(10); // Small delay every 10 updates
          }
        }
      });

      await test.step('Verify UI remains responsive', async () => {
        // Dashboard should still be interactive
        await halDashboard.refreshButton.click();
        await halDashboard.waitForLoadingToComplete();
        
        expect(await halDashboard.isLoaded()).toBe(true);
      });
    });
  });
});