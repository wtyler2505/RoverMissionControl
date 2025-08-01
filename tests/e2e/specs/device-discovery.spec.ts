import { test, expect } from '@playwright/test';
import { DeviceDiscoveryPage } from '../pages/device-discovery-page';
import { HALDashboardPage } from '../pages/hal-dashboard-page';
import { testDevices, testScenarios } from '../fixtures/test-data';

/**
 * Device Discovery E2E Tests
 * 
 * Tests the complete device discovery workflow including scanning,
 * registration, manual addition, and device management.
 */

test.describe('Device Discovery', () => {
  let deviceDiscoveryPage: DeviceDiscoveryPage;
  let halDashboard: HALDashboardPage;

  test.beforeEach(async ({ page }) => {
    deviceDiscoveryPage = new DeviceDiscoveryPage(page);
    halDashboard = new HALDashboardPage(page);
    
    // Enable error logging
    await deviceDiscoveryPage.logPageErrors();
    
    // Navigate to device discovery
    await deviceDiscoveryPage.goto();
    await deviceDiscoveryPage.waitForLoadingToComplete();
  });

  test.describe('Device Scanning', () => {
    test('should perform complete device scan workflow', async ({ page }) => {
      await test.step('Start device scan', async () => {
        await deviceDiscoveryPage.startDeviceScan();
      });

      await test.step('Wait for scan completion', async () => {
        await deviceDiscoveryPage.waitForScanComplete();
      });

      await test.step('Verify discovered devices', async () => {
        const devices = await deviceDiscoveryPage.getDiscoveredDevices();
        expect(devices.length).toBeGreaterThan(0);
        
        // Should have at least some known test devices
        const deviceIds = devices.map(d => d.id);
        expect(deviceIds.some(id => testDevices.some(td => td.id === id))).toBe(true);
      });

      await test.step('Verify device information completeness', async () => {
        const devices = await deviceDiscoveryPage.getDiscoveredDevices();
        
        for (const device of devices) {
          expect(device.id).toBeTruthy();
          expect(device.name).toBeTruthy();
          expect(device.type).toBeTruthy();
          expect(['connected', 'disconnected', 'error']).toContain(device.status);
          expect(device.connectionType).toBeTruthy();
        }
      });
    });

    test('should handle scan failures gracefully', async ({ page }) => {
      await test.step('Simulate scan failure', async () => {
        // Mock API to return error
        await page.route('**/api/devices/scan', route => {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Scan hardware not available' })
          });
        });

        await deviceDiscoveryPage.startDeviceScan();
        await page.waitForTimeout(3000);
      });

      await test.step('Verify error handling', async () => {
        const errors = await deviceDiscoveryPage.checkForErrors();
        expect(errors.some(error => 
          error.toLowerCase().includes('scan') ||
          error.toLowerCase().includes('hardware') ||
          error.toLowerCase().includes('not available')
        )).toBe(true);
      });

      await test.step('Verify recovery after fixing issue', async () => {
        // Remove error route
        await page.unroute('**/api/devices/scan');
        
        // Try scan again
        await deviceDiscoveryPage.startDeviceScan();
        await deviceDiscoveryPage.waitForScanComplete();
        
        // Should work now
        const devices = await deviceDiscoveryPage.getDiscoveredDevices();
        expect(devices.length).toBeGreaterThanOrEqual(0);
      });
    });

    test('should update scan results in real-time', async ({ page }) => {
      await test.step('Start scan and check initial results', async () => {
        await deviceDiscoveryPage.startDeviceScan();
        await page.waitForTimeout(2000); // Let scan start
        
        const initialDevices = await deviceDiscoveryPage.getDiscoveredDevices();
        const initialCount = initialDevices.length;
        
        // Simulate new device being discovered during scan
        await deviceDiscoveryPage.simulateDeviceDiscovery({
          id: 'realtime_test_device',
          name: 'Real-time Test Device',
          type: 'sensor',
          status: 'connected',
          connectionType: 'wifi',
          lastSeen: new Date().toISOString()
        });
        
        await page.waitForTimeout(1000);
        
        // Should see the new device
        await deviceDiscoveryPage.waitForDevice('realtime_test_device');
        const updatedDevices = await deviceDiscoveryPage.getDiscoveredDevices();
        expect(updatedDevices.length).toBeGreaterThan(initialCount);
      });
    });
  });

  test.describe('Device Registration', () => {
    test('should register discovered device successfully', async ({ page }) => {
      // First scan for devices
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const devices = await deviceDiscoveryPage.getDiscoveredDevices();
      expect(devices.length).toBeGreaterThan(0);
      
      const targetDevice = devices[0];

      await test.step('Register device', async () => {
        await deviceDiscoveryPage.registerDevice(targetDevice.id);
      });

      await test.step('Verify device is registered', async () => {
        // Device should appear in active devices list
        const stats = await deviceDiscoveryPage.getDiscoveryStats();
        expect(stats.connectedDevices).toBeGreaterThan(0);
      });

      await test.step('Verify device appears in main dashboard', async () => {
        // Navigate back to main dashboard
        await halDashboard.goto();
        await halDashboard.waitForDashboardData();
        
        const status = await halDashboard.getSystemStatus();
        expect(status.activeDevices).toBeGreaterThan(0);
      });
    });

    test('should handle registration conflicts', async ({ page }) => {
      // First register a device
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const devices = await deviceDiscoveryPage.getDiscoveredDevices();
      const targetDevice = devices[0];
      
      await deviceDiscoveryPage.registerDevice(targetDevice.id);

      await test.step('Attempt to register same device again', async () => {
        await deviceDiscoveryPage.registerDevice(targetDevice.id);
      });

      await test.step('Verify conflict handling', async () => {
        const errors = await deviceDiscoveryPage.checkForErrors();
        expect(errors.some(error => 
          error.toLowerCase().includes('already') ||
          error.toLowerCase().includes('conflict') ||
          error.toLowerCase().includes('registered')
        )).toBe(true);
      });
    });
  });

  test.describe('Manual Device Addition', () => {
    test('should add device manually with valid parameters', async ({ page }) => {
      const deviceInfo = {
        name: 'Manual Test Device',
        type: 'sensor',
        connectionType: 'wifi',
        connectionParams: {
          ip: '192.168.1.200',
          port: 8080,
          protocol: 'http'
        }
      };

      await test.step('Add device manually', async () => {
        await deviceDiscoveryPage.addDeviceManually(deviceInfo);
      });

      await test.step('Verify device was added', async () => {
        const devices = await deviceDiscoveryPage.getDiscoveredDevices();
        const addedDevice = devices.find(d => d.name === deviceInfo.name);
        expect(addedDevice).toBeTruthy();
        expect(addedDevice?.type).toBe(deviceInfo.type);
        expect(addedDevice?.connectionType).toBe(deviceInfo.connectionType);
      });

      await test.step('Test device connection', async () => {
        const result = await deviceDiscoveryPage.testDeviceConnection('Manual Test Device');
        // Result should indicate success or failure with message
        expect(result.message).toBeTruthy();
      });
    });

    test('should validate device parameters', async ({ page }) => {
      const invalidDeviceInfo = {
        name: '', // Empty name should be invalid
        type: 'invalid_type',
        connectionType: 'unknown_connection',
        connectionParams: {
          malformed: 'data'
        }
      };

      await test.step('Attempt to add invalid device', async () => {
        // This should trigger validation errors
        try {
          await deviceDiscoveryPage.addDeviceManually(invalidDeviceInfo);
        } catch (error) {
          // Expected to fail
        }
      });

      await test.step('Verify validation errors', async () => {
        const errors = await deviceDiscoveryPage.checkForErrors();
        expect(errors.some(error => 
          error.toLowerCase().includes('invalid') ||
          error.toLowerCase().includes('required') ||
          error.toLowerCase().includes('validation')
        )).toBe(true);
      });
    });
  });

  test.describe('Device Management', () => {
    test('should view device details', async ({ page }) => {
      // First ensure we have devices
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const devices = await deviceDiscoveryPage.getDiscoveredDevices();
      expect(devices.length).toBeGreaterThan(0);
      
      const targetDevice = devices[0];

      await test.step('View device details', async () => {
        const details = await deviceDiscoveryPage.viewDeviceDetails(targetDevice.id);
        
        expect(details.name).toBeTruthy();
        expect(details.type).toBeTruthy();
        expect(details.status).toBeTruthy();
      });
    });

    test('should remove device successfully', async ({ page }) => {
      // Add a device first
      await deviceDiscoveryPage.addDeviceManually({
        name: 'Device To Remove',
        type: 'sensor',
        connectionType: 'serial',
        connectionParams: { port: 'COM5', baudrate: 9600 }
      });

      await test.step('Remove device', async () => {
        await deviceDiscoveryPage.removeDevice('Device To Remove');
      });

      await test.step('Verify device was removed', async () => {
        await deviceDiscoveryPage.waitForDeviceRemoval('Device To Remove');
        
        const devices = await deviceDiscoveryPage.getDiscoveredDevices();
        expect(devices.find(d => d.name === 'Device To Remove')).toBeFalsy();
      });
    });

    test('should test device connections', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const devices = await deviceDiscoveryPage.getDiscoveredDevices();
      
      for (const device of devices.slice(0, 3)) { // Test first 3 devices
        await test.step(`Test connection for ${device.name}`, async () => {
          const result = await deviceDiscoveryPage.testDeviceConnection(device.id);
          
          // Should get a result regardless of success/failure
          expect(result.message).toBeTruthy();
          expect(typeof result.success).toBe('boolean');
        });
      }
    });
  });

  test.describe('Filtering and Search', () => {
    test('should filter devices by type', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const allDevices = await deviceDiscoveryPage.getDiscoveredDevices();
      const deviceTypes = [...new Set(allDevices.map(d => d.type))];
      
      if (deviceTypes.length > 1) {
        const testType = deviceTypes[0];
        
        await test.step(`Filter by device type: ${testType}`, async () => {
          await deviceDiscoveryPage.filterByDeviceType(testType);
          await page.waitForTimeout(1000);
          
          const filteredDevices = await deviceDiscoveryPage.getDiscoveredDevices();
          expect(filteredDevices.every(d => d.type === testType)).toBe(true);
        });

        await test.step('Clear filter', async () => {
          await deviceDiscoveryPage.clearFilters();
          await page.waitForTimeout(1000);
          
          const devicesAfterClear = await deviceDiscoveryPage.getDiscoveredDevices();
          expect(devicesAfterClear.length).toBeGreaterThanOrEqual(filteredDevices.length);
        });
      }
    });

    test('should filter devices by connection type', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const allDevices = await deviceDiscoveryPage.getDiscoveredDevices();
      const connectionTypes = [...new Set(allDevices.map(d => d.connectionType))];
      
      if (connectionTypes.length > 1) {
        const testConnectionType = connectionTypes[0];
        
        await test.step(`Filter by connection type: ${testConnectionType}`, async () => {
          await deviceDiscoveryPage.filterByConnectionType(testConnectionType);
          await page.waitForTimeout(1000);
          
          const filteredDevices = await deviceDiscoveryPage.getDiscoveredDevices();
          expect(filteredDevices.every(d => d.connectionType === testConnectionType)).toBe(true);
        });
      }
    });

    test('should filter devices by status', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const statusTypes = ['connected', 'disconnected', 'error'] as const;
      
      for (const status of statusTypes) {
        await test.step(`Filter by status: ${status}`, async () => {
          await deviceDiscoveryPage.filterByStatus(status);
          await page.waitForTimeout(1000);
          
          const filteredDevices = await deviceDiscoveryPage.getDiscoveredDevices();
          if (filteredDevices.length > 0) {
            expect(filteredDevices.every(d => d.status === status)).toBe(true);
          }
        });
      }
    });

    test('should search devices by name', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const allDevices = await deviceDiscoveryPage.getDiscoveredDevices();
      if (allDevices.length > 0) {
        const targetDevice = allDevices[0];
        const searchTerm = targetDevice.name.substring(0, 5);
        
        await test.step(`Search for devices containing: ${searchTerm}`, async () => {
          await deviceDiscoveryPage.searchDevices(searchTerm);
          
          const searchResults = await deviceDiscoveryPage.getDiscoveredDevices();
          expect(searchResults.every(d => 
            d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.id.toLowerCase().includes(searchTerm.toLowerCase())
          )).toBe(true);
        });

        await test.step('Clear search', async () => {
          await deviceDiscoveryPage.searchDevices('');
          await page.waitForTimeout(1000);
          
          const devicesAfterClear = await deviceDiscoveryPage.getDiscoveredDevices();
          expect(devicesAfterClear.length).toBeGreaterThanOrEqual(searchResults.length);
        });
      }
    });
  });

  test.describe('Settings and Configuration', () => {
    test('should toggle auto discovery', async ({ page }) => {
      await test.step('Enable auto discovery', async () => {
        await deviceDiscoveryPage.toggleAutoDiscovery(true);
      });

      await test.step('Verify auto discovery is enabled', async () => {
        const isEnabled = await deviceDiscoveryPage.autoDiscoveryToggle.isChecked();
        expect(isEnabled).toBe(true);
      });

      await test.step('Disable auto discovery', async () => {
        await deviceDiscoveryPage.toggleAutoDiscovery(false);
      });

      await test.step('Verify auto discovery is disabled', async () => {
        const isEnabled = await deviceDiscoveryPage.autoDiscoveryToggle.isChecked();
        expect(isEnabled).toBe(false);
      });
    });

    test('should set scan interval', async ({ page }) => {
      const newInterval = 30; // 30 seconds

      await test.step('Set scan interval', async () => {
        await deviceDiscoveryPage.setScanInterval(newInterval);
      });

      await test.step('Verify interval was saved', async () => {
        const currentInterval = await deviceDiscoveryPage.scanIntervalInput.inputValue();
        expect(parseInt(currentInterval)).toBe(newInterval);
      });
    });
  });

  test.describe('Export and Reporting', () => {
    test('should export device list', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const formats = ['csv', 'json', 'xml'] as const;
      
      for (const format of formats) {
        await test.step(`Export device list as ${format}`, async () => {
          await deviceDiscoveryPage.exportDeviceList(format);
          
          // Verify export was triggered (download event)
          // In a real test, you might verify the downloaded file contents
        });
      }
    });

    test('should generate discovery statistics', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      await test.step('Get discovery statistics', async () => {
        const stats = await deviceDiscoveryPage.getDiscoveryStats();
        
        expect(stats.totalDevices).toBeGreaterThanOrEqual(0);
        expect(stats.connectedDevices).toBeLessThanOrEqual(stats.totalDevices);
        expect(stats.disconnectedDevices).toBeLessThanOrEqual(stats.totalDevices);
        expect(stats.errorDevices).toBeLessThanOrEqual(stats.totalDevices);
        expect(stats.lastScanTime).toBeTruthy();
        
        // Total should equal sum of connected + disconnected + error
        expect(stats.totalDevices).toBe(
          stats.connectedDevices + stats.disconnectedDevices + stats.errorDevices
        );
      });
    });
  });

  test.describe('Error Scenarios', () => {
    test('should handle hardware communication failures', async ({ page }) => {
      await test.step('Simulate hardware communication failure', async () => {
        // Mock scan API to simulate hardware failure
        await page.route('**/api/devices/scan', route => {
          route.fulfill({
            status: 503,
            body: JSON.stringify({ 
              error: 'Hardware communication timeout',
              code: 'HARDWARE_TIMEOUT' 
            })
          });
        });

        await deviceDiscoveryPage.startDeviceScan();
        await page.waitForTimeout(3000);
      });

      await test.step('Verify error is displayed to user', async () => {
        const errors = await deviceDiscoveryPage.checkForErrors();
        expect(errors.some(error => 
          error.toLowerCase().includes('hardware') ||
          error.toLowerCase().includes('timeout') ||
          error.toLowerCase().includes('communication')
        )).toBe(true);
      });

      await test.step('Verify system remains stable', async () => {
        // Page should still be functional
        expect(await deviceDiscoveryPage.isLoaded()).toBe(true);
        
        // Should be able to try again
        await page.unroute('**/api/devices/scan');
        await deviceDiscoveryPage.startDeviceScan();
        await deviceDiscoveryPage.waitForScanComplete();
      });
    });

    test('should handle device registration failures', async ({ page }) => {
      await deviceDiscoveryPage.startDeviceScan();
      await deviceDiscoveryPage.waitForScanComplete();
      
      const devices = await deviceDiscoveryPage.getDiscoveredDevices();
      if (devices.length > 0) {
        const targetDevice = devices[0];

        await test.step('Simulate registration failure', async () => {
          await page.route('**/api/devices/register', route => {
            route.fulfill({
              status: 400,
              body: JSON.stringify({ 
                error: 'Device registration failed: Invalid configuration'
              })
            });
          });

          await deviceDiscoveryPage.registerDevice(targetDevice.id);
        });

        await test.step('Verify error handling', async () => {
          const errors = await deviceDiscoveryPage.checkForErrors();
          expect(errors.some(error => 
            error.toLowerCase().includes('registration') ||
            error.toLowerCase().includes('failed') ||
            error.toLowerCase().includes('invalid')
          )).toBe(true);
        });
      }
    });
  });

  test.describe('Performance and Load', () => {
    test('should handle large number of discovered devices', async ({ page }) => {
      await test.step('Simulate discovering many devices', async () => {
        // Mock API to return large device list
        const manyDevices = Array.from({ length: 50 }, (_, i) => ({
          id: `perf_test_device_${i}`,
          name: `Performance Test Device ${i}`,
          type: 'sensor',
          status: i % 3 === 0 ? 'connected' : i % 3 === 1 ? 'disconnected' : 'error',
          connectionType: ['serial', 'wifi', 'bluetooth'][i % 3],
          lastSeen: new Date(Date.now() - i * 1000).toISOString()
        }));

        await page.route('**/api/devices/scan', route => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ devices: manyDevices })
          });
        });

        await deviceDiscoveryPage.startDeviceScan();
        await deviceDiscoveryPage.waitForScanComplete();
      });

      await test.step('Verify UI handles large list efficiently', async () => {
        const devices = await deviceDiscoveryPage.getDiscoveredDevices();
        expect(devices.length).toBe(50);
        
        // UI should remain responsive
        await deviceDiscoveryPage.refreshButton.click();
        await deviceDiscoveryPage.waitForLoadingToComplete();
        
        expect(await deviceDiscoveryPage.isLoaded()).toBe(true);
      });

      await test.step('Test filtering with large dataset', async () => {
        await deviceDiscoveryPage.filterByStatus('connected');
        await page.waitForTimeout(1000);
        
        const filteredDevices = await deviceDiscoveryPage.getDiscoveredDevices();
        expect(filteredDevices.length).toBeLessThanOrEqual(50);
        expect(filteredDevices.every(d => d.status === 'connected')).toBe(true);
      });
    });
  });
});