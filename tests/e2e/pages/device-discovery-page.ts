import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  connectionType: string;
  lastSeen: string;
  firmwareVersion?: string;
}

/**
 * Device Discovery Page Object Model
 * 
 * Handles device discovery, registration, and management functionality.
 */
export class DeviceDiscoveryPage extends BasePage {

  // Main elements
  readonly scanButton: Locator;
  readonly refreshButton: Locator;
  readonly deviceList: Locator;
  readonly discoveryStatus: Locator;
  readonly scanProgress: Locator;

  // Device management
  readonly registerDeviceButton: Locator;
  readonly manualAddButton: Locator;
  readonly removeDeviceButton: Locator;
  readonly deviceDetailsButton: Locator;

  // Filters and search
  readonly deviceTypeFilter: Locator;
  readonly connectionTypeFilter: Locator;
  readonly statusFilter: Locator;
  readonly searchInput: Locator;

  // Device details dialog
  readonly deviceDetailsDialog: Locator;
  readonly deviceNameInput: Locator;
  readonly deviceTypeSelect: Locator;
  readonly connectionParamsInput: Locator;
  readonly saveDeviceButton: Locator;
  readonly cancelDeviceButton: Locator;

  // Settings
  readonly discoverySettings: Locator;
  readonly autoDiscoveryToggle: Locator;
  readonly scanIntervalInput: Locator;

  constructor(page: Page) {
    super(page);

    // Main elements
    this.scanButton = page.locator('[data-testid="scan-devices-button"], .scan-button').first();
    this.refreshButton = page.locator('[data-testid="refresh-devices-button"], .refresh-button').first();
    this.deviceList = page.locator('[data-testid="device-list"], .device-list').first();
    this.discoveryStatus = page.locator('[data-testid="discovery-status"], .discovery-status').first();
    this.scanProgress = page.locator('[data-testid="scan-progress"], .scan-progress').first();

    // Device management
    this.registerDeviceButton = page.locator('[data-testid="register-device-button"]').first();
    this.manualAddButton = page.locator('[data-testid="manual-add-button"], .add-device-button').first();
    this.removeDeviceButton = page.locator('[data-testid="remove-device-button"]').first();
    this.deviceDetailsButton = page.locator('[data-testid="device-details-button"]').first();

    // Filters and search
    this.deviceTypeFilter = page.locator('[data-testid="device-type-filter"]').first();
    this.connectionTypeFilter = page.locator('[data-testid="connection-type-filter"]').first();
    this.statusFilter = page.locator('[data-testid="status-filter"]').first();
    this.searchInput = page.locator('[data-testid="device-search"], input[placeholder*="Search"]').first();

    // Device details dialog
    this.deviceDetailsDialog = page.locator('[data-testid="device-details-dialog"], [role="dialog"]').first();
    this.deviceNameInput = page.locator('[data-testid="device-name-input"], input[name="deviceName"]').first();
    this.deviceTypeSelect = page.locator('[data-testid="device-type-select"], select[name="deviceType"]').first();
    this.connectionParamsInput = page.locator('[data-testid="connection-params-input"]').first();
    this.saveDeviceButton = page.locator('[data-testid="save-device-button"], .save-button').first();
    this.cancelDeviceButton = page.locator('[data-testid="cancel-device-button"], .cancel-button').first();

    // Settings
    this.discoverySettings = page.locator('[data-testid="discovery-settings"]').first();
    this.autoDiscoveryToggle = page.locator('[data-testid="auto-discovery-toggle"]').first();
    this.scanIntervalInput = page.locator('[data-testid="scan-interval-input"]').first();
  }

  /**
   * Navigate to device discovery page
   */
  async goto(): Promise<void> {
    await this.page.goto('/hal-dashboard');
    await this.waitForLoad();
    
    // Navigate to device discovery tab
    await this.safeClick('[data-testid="device-discovery-tab"], [role="tab"]:has-text("Device Discovery")');
    await this.waitForLoadingToComplete();
  }

  /**
   * Check if the device discovery page is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.waitForElement('[data-testid="device-discovery-panel"], .device-discovery', 5000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start device scan
   */
  async startDeviceScan(): Promise<void> {
    await this.scanButton.click();
    
    // Wait for scan to start
    await expect(this.scanProgress).toBeVisible({ timeout: 5000 });
    
    console.log('Device scan started');
  }

  /**
   * Wait for device scan to complete
   */
  async waitForScanComplete(timeout = 30000): Promise<void> {
    // Wait for progress indicator to disappear
    await this.waitForElementToDisappear('[data-testid="scan-progress"], .scan-progress', timeout);
    
    // Wait for discovery status to show completion
    await expect(this.discoveryStatus).toContainText(/complete|finished|done/i, { timeout });
    
    console.log('Device scan completed');
  }

  /**
   * Get list of discovered devices
   */
  async getDiscoveredDevices(): Promise<DeviceInfo[]> {
    await this.waitForElement('[data-testid="device-list"], .device-list');
    
    const deviceItems = await this.page.locator('[data-testid="device-item"], .device-item').all();
    const devices: DeviceInfo[] = [];

    for (const item of deviceItems) {
      try {
        const id = await item.getAttribute('data-device-id') || 
                  await item.locator('[data-testid="device-id"]').textContent() || '';
        
        const name = await item.locator('[data-testid="device-name"], .device-name').textContent() || '';
        const type = await item.locator('[data-testid="device-type"], .device-type').textContent() || '';
        const statusElement = item.locator('[data-testid="device-status"], .device-status');
        const status = await statusElement.textContent() || '';
        const connectionType = await item.locator('[data-testid="connection-type"], .connection-type').textContent() || '';
        const lastSeen = await item.locator('[data-testid="last-seen"], .last-seen').textContent() || '';
        const firmwareVersion = await item.locator('[data-testid="firmware-version"], .firmware-version').textContent() || undefined;

        devices.push({
          id: id.trim(),
          name: name.trim(),
          type: type.trim(),
          status: this.parseDeviceStatus(status),
          connectionType: connectionType.trim(),
          lastSeen: lastSeen.trim(),
          firmwareVersion: firmwareVersion?.trim()
        });
      } catch (error) {
        console.warn('Failed to parse device item:', error);
      }
    }

    return devices;
  }

  /**
   * Search for devices by name or ID
   */
  async searchDevices(query: string): Promise<void> {
    await this.safeFill('[data-testid="device-search"], input[placeholder*="Search"]', query);
    
    // Wait for search results to update
    await this.page.waitForTimeout(1000);
  }

  /**
   * Filter devices by type
   */
  async filterByDeviceType(deviceType: string): Promise<void> {
    await this.safeSelect('[data-testid="device-type-filter"]', deviceType);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Filter devices by connection type
   */
  async filterByConnectionType(connectionType: string): Promise<void> {
    await this.safeSelect('[data-testid="connection-type-filter"]', connectionType);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Filter devices by status
   */
  async filterByStatus(status: 'connected' | 'disconnected' | 'error' | 'all'): Promise<void> {
    await this.safeSelect('[data-testid="status-filter"]', status);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Register a discovered device
   */
  async registerDevice(deviceId: string): Promise<void> {
    const deviceItem = this.page.locator(`[data-device-id="${deviceId}"], [data-testid="device-item"]:has-text("${deviceId}")`);
    
    await deviceItem.locator('[data-testid="register-device-button"], .register-button').click();
    
    // Wait for registration confirmation
    await expect(this.page.locator('[data-testid="registration-success"], .success-message')).toBeVisible({ timeout: 10000 });
    
    console.log(`Device ${deviceId} registered successfully`);
  }

  /**
   * Add device manually
   */
  async addDeviceManually(deviceInfo: {
    name: string;
    type: string;
    connectionType: string;
    connectionParams: any;
  }): Promise<void> {
    // Open manual add dialog
    await this.manualAddButton.click();
    await expect(this.deviceDetailsDialog).toBeVisible();

    // Fill device information
    await this.safeFill('[data-testid="device-name-input"]', deviceInfo.name);
    await this.safeSelect('[data-testid="device-type-select"]', deviceInfo.type);
    await this.safeSelect('[data-testid="connection-type-select"]', deviceInfo.connectionType);
    
    // Fill connection parameters (as JSON)
    await this.safeFill('[data-testid="connection-params-input"]', JSON.stringify(deviceInfo.connectionParams));

    // Save device
    await this.saveDeviceButton.click();

    // Wait for success confirmation
    await expect(this.page.locator('[data-testid="device-add-success"], .success-message')).toBeVisible({ timeout: 10000 });
    
    console.log(`Device ${deviceInfo.name} added manually`);
  }

  /**
   * View device details
   */
  async viewDeviceDetails(deviceId: string): Promise<any> {
    const deviceItem = this.page.locator(`[data-device-id="${deviceId}"], [data-testid="device-item"]:has-text("${deviceId}")`);
    
    await deviceItem.locator('[data-testid="device-details-button"], .details-button').click();
    await expect(this.deviceDetailsDialog).toBeVisible();

    // Extract device details from dialog
    const details = {
      name: await this.deviceNameInput.inputValue(),
      type: await this.deviceTypeSelect.inputValue(),
      connectionParams: await this.connectionParamsInput.inputValue(),
      status: await this.page.locator('[data-testid="device-status-detail"]').textContent(),
      lastSeen: await this.page.locator('[data-testid="last-seen-detail"]').textContent(),
      capabilities: await this.page.locator('[data-testid="device-capabilities"]').textContent()
    };

    // Close dialog
    await this.cancelDeviceButton.click();
    await expect(this.deviceDetailsDialog).not.toBeVisible();

    return details;
  }

  /**
   * Remove device
   */
  async removeDevice(deviceId: string): Promise<void> {
    const deviceItem = this.page.locator(`[data-device-id="${deviceId}"], [data-testid="device-item"]:has-text("${deviceId}")`);
    
    await deviceItem.locator('[data-testid="remove-device-button"], .remove-button').click();

    // Confirm removal in dialog
    await expect(this.page.locator('[data-testid="confirm-remove-dialog"], [role="dialog"]')).toBeVisible();
    await this.safeClick('[data-testid="confirm-remove-button"], .confirm-button');

    // Wait for removal confirmation
    await expect(this.page.locator('[data-testid="device-remove-success"], .success-message')).toBeVisible({ timeout: 10000 });
    
    console.log(`Device ${deviceId} removed successfully`);
  }

  /**
   * Test device connection
   */
  async testDeviceConnection(deviceId: string): Promise<{ success: boolean; message: string }> {
    const deviceItem = this.page.locator(`[data-device-id="${deviceId}"], [data-testid="device-item"]:has-text("${deviceId}")`);
    
    await deviceItem.locator('[data-testid="test-connection-button"], .test-button').click();

    // Wait for test result
    const resultElement = await this.page.locator('[data-testid="connection-test-result"], .test-result').first();
    await expect(resultElement).toBeVisible({ timeout: 15000 });

    const resultText = await resultElement.textContent() || '';
    const success = resultText.toLowerCase().includes('success') || resultText.toLowerCase().includes('connected');

    return {
      success,
      message: resultText.trim()
    };
  }

  /**
   * Enable/disable auto discovery
   */
  async toggleAutoDiscovery(enable: boolean): Promise<void> {
    const isCurrentlyEnabled = await this.autoDiscoveryToggle.isChecked();
    
    if (isCurrentlyEnabled !== enable) {
      await this.autoDiscoveryToggle.click();
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Set scan interval
   */
  async setScanInterval(intervalSeconds: number): Promise<void> {
    await this.safeFill('[data-testid="scan-interval-input"]', intervalSeconds.toString());
    
    // Save settings
    await this.safeClick('[data-testid="save-settings-button"], .save-button');
    
    // Wait for settings to be saved
    await expect(this.page.locator('[data-testid="settings-saved"], .success-message')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get discovery statistics
   */
  async getDiscoveryStats(): Promise<{
    totalDevices: number;
    connectedDevices: number;
    disconnectedDevices: number;
    errorDevices: number;
    lastScanTime: string;
  }> {
    const devices = await this.getDiscoveredDevices();
    
    const stats = {
      totalDevices: devices.length,
      connectedDevices: devices.filter(d => d.status === 'connected').length,
      disconnectedDevices: devices.filter(d => d.status === 'disconnected').length,
      errorDevices: devices.filter(d => d.status === 'error').length,
      lastScanTime: await this.page.locator('[data-testid="last-scan-time"], .last-scan').textContent() || ''
    };

    return stats;
  }

  /**
   * Wait for device to appear in list
   */
  async waitForDevice(deviceId: string, timeout = 30000): Promise<void> {
    await expect(this.page.locator(`[data-device-id="${deviceId}"], [data-testid="device-item"]:has-text("${deviceId}")`)).toBeVisible({ timeout });
  }

  /**
   * Wait for device to disappear from list
   */
  async waitForDeviceRemoval(deviceId: string, timeout = 10000): Promise<void> {
    await expect(this.page.locator(`[data-device-id="${deviceId}"], [data-testid="device-item"]:has-text("${deviceId}")`)).not.toBeVisible({ timeout });
  }

  /**
   * Simulate device discovery event
   */
  async simulateDeviceDiscovery(device: DeviceInfo): Promise<void> {
    await this.page.evaluate((deviceData) => {
      const event = new CustomEvent('device-discovered', { detail: deviceData });
      window.dispatchEvent(event);
    }, device);

    // Wait for UI to update
    await this.page.waitForTimeout(1000);
  }

  /**
   * Helper method to parse device status from UI text
   */
  private parseDeviceStatus(statusText: string): 'connected' | 'disconnected' | 'error' {
    const text = statusText.toLowerCase();
    if (text.includes('connected') || text.includes('online')) return 'connected';
    if (text.includes('error') || text.includes('failed')) return 'error';
    return 'disconnected';
  }

  /**
   * Clear all filters and search
   */
  async clearFilters(): Promise<void> {
    await this.safeFill('[data-testid="device-search"]', '');
    await this.safeSelect('[data-testid="device-type-filter"]', 'all');
    await this.safeSelect('[data-testid="connection-type-filter"]', 'all');
    await this.safeSelect('[data-testid="status-filter"]', 'all');
    
    await this.page.waitForTimeout(1000);
  }

  /**
   * Export device list
   */
  async exportDeviceList(format: 'csv' | 'json' | 'xml' = 'csv'): Promise<void> {
    await this.safeClick('[data-testid="export-devices-button"], .export-button');
    
    // Select format in dialog
    await expect(this.page.locator('[data-testid="export-format-dialog"], [role="dialog"]')).toBeVisible();
    await this.safeSelect('[data-testid="export-format-select"]', format);
    await this.safeClick('[data-testid="confirm-export-button"], .confirm-button');
    
    // Wait for download to start
    const downloadPromise = this.page.waitForEvent('download');
    await downloadPromise;
    
    console.log(`Device list exported in ${format} format`);
  }
}