import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * HAL Dashboard Page Object Model
 * 
 * Encapsulates all interactions with the Hardware Abstraction Layer dashboard.
 * Provides methods for testing device management, diagnostics, and control workflows.
 */
export class HALDashboardPage extends BasePage {
  
  // Main navigation elements
  readonly drawerToggle: Locator;
  readonly navigationDrawer: Locator;
  readonly pageTitle: Locator;
  readonly refreshButton: Locator;
  readonly settingsButton: Locator;

  // Status indicators
  readonly systemHealthChip: Locator;
  readonly activeDevicesBadge: Locator;
  readonly alertsBadge: Locator;

  // Overview cards
  readonly totalDevicesCard: Locator;
  readonly connectionRateCard: Locator;
  readonly updatesAvailableCard: Locator;
  readonly simulationModeCard: Locator;

  // Quick actions
  readonly scanDevicesButton: Locator;
  readonly runDiagnosticsButton: Locator;
  readonly checkUpdatesButton: Locator;
  readonly toggleSimulationButton: Locator;

  // Navigation tabs
  readonly overviewTab: Locator;
  readonly deviceDiscoveryTab: Locator;
  readonly diagnosticsTab: Locator;
  readonly firmwareTab: Locator;
  readonly communicationTab: Locator;
  readonly simulationTab: Locator;

  // Recent activity
  readonly recentActivitySection: Locator;
  readonly activityAlerts: Locator;

  // Settings
  readonly darkModeToggle: Locator;

  constructor(page: Page) {
    super(page);

    // Initialize locators
    this.drawerToggle = page.locator('[data-testid="drawer-toggle"], .drawer-toggle').first();
    this.navigationDrawer = page.locator('[data-testid="navigation-drawer"], .MuiDrawer-root').first();
    this.pageTitle = page.locator('[data-testid="page-title"], h1, h2').first();
    this.refreshButton = page.locator('[data-testid="refresh-button"], [title="Refresh"]').first();
    this.settingsButton = page.locator('[data-testid="settings-button"], [title*="Settings"]').first();

    // Status indicators
    this.systemHealthChip = page.locator('[data-testid="system-health"], .system-health-chip').first();
    this.activeDevicesBadge = page.locator('[data-testid="active-devices-badge"]').first();
    this.alertsBadge = page.locator('[data-testid="alerts-badge"]').first();

    // Overview cards
    this.totalDevicesCard = page.locator('[data-testid="total-devices-card"]').first();
    this.connectionRateCard = page.locator('[data-testid="connection-rate-card"]').first();
    this.updatesAvailableCard = page.locator('[data-testid="updates-available-card"]').first();
    this.simulationModeCard = page.locator('[data-testid="simulation-mode-card"]').first();

    // Quick actions
    this.scanDevicesButton = page.locator('[data-testid="scan-devices-button"]').first();
    this.runDiagnosticsButton = page.locator('[data-testid="run-diagnostics-button"]').first();
    this.checkUpdatesButton = page.locator('[data-testid="check-updates-button"]').first();
    this.toggleSimulationButton = page.locator('[data-testid="toggle-simulation-button"]').first();

    // Navigation tabs
    this.overviewTab = page.locator('[data-testid="overview-tab"], [role="tab"]:has-text("Overview")').first();
    this.deviceDiscoveryTab = page.locator('[data-testid="device-discovery-tab"], [role="tab"]:has-text("Device Discovery")').first();
    this.diagnosticsTab = page.locator('[data-testid="diagnostics-tab"], [role="tab"]:has-text("Diagnostics")').first();
    this.firmwareTab = page.locator('[data-testid="firmware-tab"], [role="tab"]:has-text("Firmware")').first();
    this.communicationTab = page.locator('[data-testid="communication-tab"], [role="tab"]:has-text("Communication")').first();
    this.simulationTab = page.locator('[data-testid="simulation-tab"], [role="tab"]:has-text("Simulation")').first();

    // Recent activity
    this.recentActivitySection = page.locator('[data-testid="recent-activity"]').first();
    this.activityAlerts = page.locator('[data-testid="activity-alerts"] .MuiAlert-root, .alert');

    // Settings
    this.darkModeToggle = page.locator('[data-testid="dark-mode-toggle"], input[type="checkbox"]').last();
  }

  /**
   * Navigate to HAL Dashboard
   */
  async goto(): Promise<void> {
    await this.page.goto('/hal-dashboard');
    await this.waitForLoad();
    await this.waitForLoadingToComplete();
  }

  /**
   * Check if the HAL Dashboard is loaded
   */
  async isLoaded(): Promise<boolean> {
    try {
      await this.waitForElement('[data-testid="hal-dashboard"], .hal-dashboard', 5000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for dashboard data to load
   */
  async waitForDashboardData(): Promise<void> {
    // Wait for status cards to load
    await expect(this.totalDevicesCard).toBeVisible();
    await expect(this.connectionRateCard).toBeVisible();
    await expect(this.updatesAvailableCard).toBeVisible();
    await expect(this.simulationModeCard).toBeVisible();

    // Wait for navigation to be available
    await expect(this.navigationDrawer).toBeVisible();
    
    // Wait for system health indicator
    await expect(this.systemHealthChip).toBeVisible();
  }

  /**
   * Get system status information
   */
  async getSystemStatus(): Promise<{
    health: string;
    totalDevices: number;
    activeDevices: number;
    connectionRate: string;
    updatesAvailable: number;
    simulationActive: boolean;
    criticalAlerts: number;
    warningAlerts: number;
  }> {
    await this.waitForDashboardData();

    const health = await this.systemHealthChip.textContent() || '';
    const totalDevicesText = await this.totalDevicesCard.locator('[data-testid="device-count"], .metric-value').textContent() || '0';
    const connectionRateText = await this.connectionRateCard.locator('[data-testid="connection-rate"], .metric-value').textContent() || '0%';
    const updatesText = await this.updatesAvailableCard.locator('[data-testid="updates-count"], .metric-value').textContent() || '0';
    const simulationText = await this.simulationModeCard.locator('[data-testid="simulation-status"], .metric-value').textContent() || 'INACTIVE';
    
    // Parse active devices from badge or card
    let activeDevices = 0;
    try {
      const activeDevicesText = await this.activeDevicesBadge.textContent();
      activeDevices = parseInt(activeDevicesText || '0');
    } catch {
      // Try to get from card subtitle
      const activeText = await this.totalDevicesCard.locator('.metric-subtitle').textContent() || '0 active';
      activeDevices = parseInt(activeText.match(/(\d+)\s+active/)?.[1] || '0');
    }

    // Parse alerts
    let totalAlerts = 0;
    try {
      const alertsText = await this.alertsBadge.textContent();
      totalAlerts = parseInt(alertsText || '0');
    } catch {
      // Alerts might not be visible if count is 0
    }

    return {
      health: health.toLowerCase().replace(/[^a-z]/g, ''),
      totalDevices: parseInt(totalDevicesText.replace(/\D/g, '')),
      activeDevices,
      connectionRate: connectionRateText,
      updatesAvailable: parseInt(updatesText.replace(/\D/g, '')),
      simulationActive: simulationText.includes('ACTIVE'),
      criticalAlerts: 0, // Would need separate locators for critical vs warning
      warningAlerts: totalAlerts
    };
  }

  /**
   * Navigate to specific tab
   */
  async navigateToTab(tabName: 'overview' | 'discovery' | 'diagnostics' | 'firmware' | 'communication' | 'simulation'): Promise<void> {
    const tabMap = {
      overview: this.overviewTab,
      discovery: this.deviceDiscoveryTab,
      diagnostics: this.diagnosticsTab,
      firmware: this.firmwareTab,
      communication: this.communicationTab,
      simulation: this.simulationTab
    };

    const tab = tabMap[tabName];
    if (!tab) {
      throw new Error(`Unknown tab: ${tabName}`);
    }

    await tab.click();
    await this.page.waitForTimeout(1000); // Wait for tab transition
    
    // Verify tab is active
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * Execute quick action
   */
  async executeQuickAction(action: 'scan' | 'diagnostics' | 'updates' | 'simulation'): Promise<void> {
    const buttonMap = {
      scan: this.scanDevicesButton,
      diagnostics: this.runDiagnosticsButton,
      updates: this.checkUpdatesButton,
      simulation: this.toggleSimulationButton
    };

    const button = buttonMap[action];
    if (!button) {
      throw new Error(`Unknown action: ${action}`);
    }

    await button.click();
    
    // Wait for action to complete (look for success indicators)
    await this.page.waitForTimeout(1000);
  }

  /**
   * Toggle dark mode
   */
  async toggleDarkMode(): Promise<void> {
    await this.darkModeToggle.click();
    await this.page.waitForTimeout(500); // Wait for theme transition
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard(): Promise<void> {
    await this.refreshButton.click();
    
    // Wait for refresh to complete
    await this.waitForLoadingToComplete();
    await this.waitForDashboardData();
  }

  /**
   * Open/close navigation drawer
   */
  async toggleNavigationDrawer(): Promise<void> {
    await this.drawerToggle.click();
    await this.page.waitForTimeout(300); // Wait for drawer animation
  }

  /**
   * Get recent activity items
   */
  async getRecentActivity(): Promise<Array<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    timestamp?: string;
  }>> {
    const activities: Array<{
      type: 'info' | 'success' | 'warning' | 'error';
      message: string;
      timestamp?: string;
    }> = [];

    const alerts = await this.activityAlerts.all();
    
    for (const alert of alerts) {
      const severityClass = await alert.getAttribute('class') || '';
      let type: 'info' | 'success' | 'warning' | 'error' = 'info';
      
      if (severityClass.includes('error')) type = 'error';
      else if (severityClass.includes('warning')) type = 'warning';
      else if (severityClass.includes('success')) type = 'success';
      
      const message = await alert.textContent() || '';
      
      activities.push({
        type,
        message: message.trim(),
        timestamp: new Date().toISOString() // In real app, this would come from the alert
      });
    }

    return activities;
  }

  /**
   * Check for error states
   */
  async hasErrors(): Promise<boolean> {
    const errors = await this.checkForErrors();
    return errors.length > 0;
  }

  /**
   * Wait for specific system health status
   */
  async waitForHealthStatus(expectedStatus: 'healthy' | 'warning' | 'critical', timeout = 30000): Promise<void> {
    await expect(this.systemHealthChip).toContainText(expectedStatus, { timeout });
  }

  /**
   * Wait for device count to match expected value
   */
  async waitForDeviceCount(expectedCount: number, timeout = 30000): Promise<void> {
    await expect(this.totalDevicesCard.locator('[data-testid="device-count"], .metric-value')).toContainText(expectedCount.toString(), { timeout });
  }

  /**
   * Verify dashboard accessibility
   */
  async verifyAccessibility(): Promise<void> {
    await this.checkAccessibility();
    
    // Check specific HAL dashboard accessibility requirements
    await expect(this.navigationDrawer).toHaveAttribute('role', 'navigation');
    await expect(this.pageTitle).toBeVisible();
    
    // Check that all interactive elements are keyboard accessible
    const interactiveElements = [
      this.drawerToggle,
      this.refreshButton,
      this.settingsButton,
      this.scanDevicesButton,
      this.runDiagnosticsButton,
      this.checkUpdatesButton,
      this.toggleSimulationButton
    ];

    for (const element of interactiveElements) {
      await expect(element).toBeFocusable();
    }
  }

  /**
   * Test responsive behavior
   */
  async testResponsiveLayout(): Promise<void> {
    // Test mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.page.waitForTimeout(1000);
    
    // Navigation drawer should be closed on mobile
    await expect(this.navigationDrawer).not.toBeVisible();
    
    // Cards should stack vertically
    const cards = await this.page.locator('.MuiCard-root, .card').all();
    if (cards.length >= 2) {
      const firstCardBox = await cards[0].boundingBox();
      const secondCardBox = await cards[1].boundingBox();
      
      if (firstCardBox && secondCardBox) {
        expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height);
      }
    }

    // Test tablet viewport
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.page.waitForTimeout(1000);

    // Test desktop viewport
    await this.page.setViewportSize({ width: 1280, height: 720 });
    await this.page.waitForTimeout(1000);
    
    // Navigation drawer should be visible on desktop
    await expect(this.navigationDrawer).toBeVisible();
  }

  /**
   * Monitor WebSocket connections
   */
  async monitorWebSocketConnections(): Promise<void> {
    const wsMessages: any[] = [];

    // Listen for WebSocket frames
    this.page.on('websocket', ws => {
      console.log(`WebSocket opened: ${ws.url()}`);
      
      ws.on('framesent', event => {
        wsMessages.push({ type: 'sent', payload: event.payload });
      });
      
      ws.on('framereceived', event => {
        wsMessages.push({ type: 'received', payload: event.payload });
      });
      
      ws.on('close', () => {
        console.log(`WebSocket closed: ${ws.url()}`);
      });
    });

    // Store messages for later verification
    (this.page as any).wsMessages = wsMessages;
  }

  /**
   * Simulate hardware events
   */
  async simulateHardwareEvent(eventType: 'device_connected' | 'device_disconnected' | 'telemetry_update' | 'alert', deviceId: string, data?: any): Promise<void> {
    const event = {
      type: eventType,
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      data: data || {}
    };

    // Send event via WebSocket (if connected) or direct API call
    await this.page.evaluate((eventData) => {
      // Try WebSocket first
      if (window.ws && window.ws.readyState === WebSocket.OPEN) {
        window.ws.send(JSON.stringify(eventData));
      } else {
        // Fallback to API call
        fetch('/api/simulate-hardware-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
      }
    }, event);

    // Wait for UI to update
    await this.page.waitForTimeout(1000);
  }
}