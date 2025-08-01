import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive end-to-end tests for the Rover Mission Control simulation system.
 * Tests the complete flow from UI interactions to backend processing and real-time updates.
 */

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper functions
async function login(page: Page, username: string, password: string) {
  await page.goto(FRONTEND_URL);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="main-dashboard"]');
}

async function navigateToSimulation(page: Page) {
  await page.click('[data-testid="nav-simulation"]');
  await page.waitForSelector('[data-testid="simulation-dashboard"]');
}

test.describe('Simulation System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as operator
    await login(page, 'operator', 'operator123');
  });

  test('complete simulation workflow', async ({ page }) => {
    // Navigate to simulation dashboard
    await navigateToSimulation(page);

    // Verify simulation is not running initially
    await expect(page.locator('[data-testid="simulation-status"]')).toContainText('Stopped');

    // Start simulation configuration
    await page.click('[data-testid="start-simulation-btn"]');
    
    // Fill simulation configuration
    await page.fill('input[name="simulationName"]', 'E2E Test Simulation');
    await page.fill('textarea[name="description"]', 'Automated E2E test simulation');
    
    // Select network profile
    await page.selectOption('select[name="networkProfile"]', 'satellite');
    
    // Add devices
    await page.click('[data-testid="add-device-btn"]');
    await page.selectOption('[data-testid="device-profile-0"]', 'temperature_sensor');
    
    await page.click('[data-testid="add-device-btn"]');
    await page.selectOption('[data-testid="device-profile-1"]', 'rover');
    
    // Set environmental conditions
    await page.fill('input[name="environment.temperature"]', '25');
    await page.fill('input[name="environment.pressure"]', '101.3');
    await page.fill('input[name="environment.humidity"]', '45');
    
    // Start simulation
    await page.click('[data-testid="confirm-start-btn"]');
    
    // Wait for simulation to start
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Verify devices are active
    await expect(page.locator('[data-testid="active-devices-count"]')).toContainText('2');
    
    // Check telemetry is being received
    await page.waitForSelector('[data-testid="telemetry-update"]', { timeout: 5000 });
    
    // Test device interaction
    await page.click('[data-testid="device-rover"]');
    await page.click('[data-testid="send-command-btn"]');
    await page.selectOption('select[name="command"]', 'move');
    await page.fill('input[name="distance"]', '10');
    await page.click('[data-testid="execute-command-btn"]');
    
    // Verify command was sent
    await expect(page.locator('[data-testid="command-status"]')).toContainText('Success');
    
    // Stop simulation
    await page.click('[data-testid="stop-simulation-btn"]');
    await page.click('[data-testid="confirm-stop-btn"]');
    
    // Verify simulation stopped
    await expect(page.locator('[data-testid="simulation-status"]')).toContainText('Stopped');
  });

  test('scenario execution', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation first
    await page.click('[data-testid="start-simulation-btn"]');
    await page.fill('input[name="simulationName"]', 'Scenario Test');
    await page.click('[data-testid="quick-start-basic"]');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Navigate to scenarios tab
    await page.click('[data-testid="tab-scenarios"]');
    
    // Select and run a scenario
    await page.selectOption('select[data-testid="scenario-select"]', 'rover_patrol');
    await page.click('[data-testid="run-scenario-btn"]');
    
    // Monitor scenario progress
    await expect(page.locator('[data-testid="scenario-status"]')).toContainText('Running');
    
    // Wait for scenario completion
    await page.waitForSelector('[data-testid="scenario-status"]:has-text("Completed")', { timeout: 30000 });
    
    // Verify scenario results
    await expect(page.locator('[data-testid="scenario-steps-completed"]')).toContainText('4/4');
  });

  test('network condition simulation', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation
    await page.click('[data-testid="start-simulation-btn"]');
    await page.click('[data-testid="quick-start-network-test"]');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Navigate to network tab
    await page.click('[data-testid="tab-network"]');
    
    // Change network conditions
    await page.selectOption('select[data-testid="network-profile"]', 'cellular_3g');
    await page.click('[data-testid="apply-network-btn"]');
    
    // Verify network metrics update
    await expect(page.locator('[data-testid="network-latency"]')).toContainText(/\d+ms/);
    await expect(page.locator('[data-testid="network-bandwidth"]')).toContainText(/\d+\s*Mbps/);
    
    // Test custom conditions
    await page.click('[data-testid="custom-network-btn"]');
    await page.fill('input[name="latency"]', '1000');
    await page.fill('input[name="packetLoss"]', '0.1');
    await page.fill('input[name="bandwidth"]', '0.5');
    await page.click('[data-testid="apply-custom-network-btn"]');
    
    // Verify custom conditions applied
    await expect(page.locator('[data-testid="network-status"]')).toContainText('Custom');
  });

  test('real-time telemetry updates', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation with devices
    await page.click('[data-testid="start-simulation-btn"]');
    await page.click('[data-testid="quick-start-telemetry-test"]');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Navigate to metrics tab
    await page.click('[data-testid="tab-metrics"]');
    
    // Verify telemetry is updating
    const initialMessageCount = await page.locator('[data-testid="total-messages"]').textContent();
    
    // Wait for updates
    await page.waitForTimeout(3000);
    
    const updatedMessageCount = await page.locator('[data-testid="total-messages"]').textContent();
    expect(parseInt(updatedMessageCount || '0')).toBeGreaterThan(parseInt(initialMessageCount || '0'));
    
    // Check telemetry chart is rendering
    await expect(page.locator('[data-testid="telemetry-chart"]')).toBeVisible();
  });

  test('device management', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation
    await page.click('[data-testid="start-simulation-btn"]');
    await page.fill('input[name="simulationName"]', 'Device Management Test');
    
    // Add multiple devices
    for (const profile of ['temperature_sensor', 'imu_sensor', 'gps']) {
      await page.click('[data-testid="add-device-btn"]');
      const deviceIndex = await page.locator('[data-testid^="device-profile-"]').count() - 1;
      await page.selectOption(`[data-testid="device-profile-${deviceIndex}"]`, profile);
    }
    
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Navigate to devices tab
    await page.click('[data-testid="tab-devices"]');
    
    // Verify all devices are listed
    await expect(page.locator('[data-testid="device-list"] [data-testid^="device-"]')).toHaveCount(3);
    
    // Test device filtering
    await page.selectOption('select[data-testid="device-filter"]', 'sensor');
    await expect(page.locator('[data-testid="device-list"] [data-testid^="device-"]')).toHaveCount(3);
    
    // Edit device configuration
    await page.click('[data-testid="device-temperature_sensor"]');
    await page.click('[data-testid="edit-device-btn"]');
    await page.fill('input[name="temperature"]', '30');
    await page.click('[data-testid="save-device-btn"]');
    
    // Verify update
    await expect(page.locator('[data-testid="device-state"]')).toContainText('30');
  });

  test('scenario recording and playback', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation
    await page.click('[data-testid="start-simulation-btn"]');
    await page.click('[data-testid="quick-start-basic"]');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Start recording
    await page.click('[data-testid="tab-scenarios"]');
    await page.click('[data-testid="record-scenario-btn"]');
    await page.fill('input[name="scenarioName"]', 'Recorded Test Scenario');
    await page.fill('textarea[name="scenarioDescription"]', 'E2E recorded scenario');
    await page.click('[data-testid="start-recording-btn"]');
    
    // Perform some actions
    await page.click('[data-testid="tab-devices"]');
    await page.click('[data-testid="device-rover"]');
    await page.click('[data-testid="send-command-btn"]');
    await page.selectOption('select[name="command"]', 'move');
    await page.click('[data-testid="execute-command-btn"]');
    
    await page.waitForTimeout(1000);
    
    // Change network conditions
    await page.click('[data-testid="tab-network"]');
    await page.selectOption('select[data-testid="network-profile"]', 'wifi');
    await page.click('[data-testid="apply-network-btn"]');
    
    // Stop recording
    await page.click('[data-testid="tab-scenarios"]');
    await page.click('[data-testid="stop-recording-btn"]');
    
    // Verify scenario was saved
    await expect(page.locator('select[data-testid="scenario-select"]')).toContainText('Recorded Test Scenario');
  });

  test('environmental condition effects', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation with temperature sensor
    await page.click('[data-testid="start-simulation-btn"]');
    await page.fill('input[name="simulationName"]', 'Environment Test');
    await page.click('[data-testid="add-device-btn"]');
    await page.selectOption('[data-testid="device-profile-0"]', 'temperature_sensor');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Navigate to environment tab
    await page.click('[data-testid="tab-environment"]');
    
    // Record initial temperature
    const initialTemp = await page.locator('[data-testid="sensor-temperature"]').textContent();
    
    // Change environmental temperature
    await page.fill('input[name="environmentTemperature"]', '-10');
    await page.click('[data-testid="apply-environment-btn"]');
    
    // Wait for sensor to react
    await page.waitForTimeout(5000);
    
    // Verify temperature sensor is affected
    const updatedTemp = await page.locator('[data-testid="sensor-temperature"]').textContent();
    expect(parseFloat(updatedTemp || '0')).toBeLessThan(parseFloat(initialTemp || '0'));
  });

  test('error handling and recovery', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation
    await page.click('[data-testid="start-simulation-btn"]');
    await page.click('[data-testid="quick-start-basic"]');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Simulate network disconnection
    await page.context().setOffline(true);
    
    // Verify offline indicator
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
    
    // Try to send command (should fail gracefully)
    await page.click('[data-testid="tab-devices"]');
    await page.click('[data-testid="device-rover"]');
    await page.click('[data-testid="send-command-btn"]');
    await page.selectOption('select[name="command"]', 'move');
    await page.click('[data-testid="execute-command-btn"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Connection lost');
    
    // Restore connection
    await page.context().setOffline(false);
    
    // Verify reconnection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
  });

  test('performance under load', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation with many devices
    await page.click('[data-testid="start-simulation-btn"]');
    await page.fill('input[name="simulationName"]', 'Performance Test');
    
    // Add 10 devices
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="add-device-btn"]');
      const profiles = ['temperature_sensor', 'imu_sensor', 'gps', 'rover'];
      await page.selectOption(`[data-testid="device-profile-${i}"]`, profiles[i % profiles.length]);
    }
    
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Monitor performance metrics
    await page.click('[data-testid="tab-metrics"]');
    
    // Verify system remains responsive
    const startTime = Date.now();
    await page.click('[data-testid="refresh-metrics-btn"]');
    await page.waitForSelector('[data-testid="metrics-updated"]');
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    
    // Check CPU and memory usage indicators
    await expect(page.locator('[data-testid="cpu-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-usage"]')).toBeVisible();
  });
});

test.describe('Simulation System Security Tests', () => {
  test('role-based access control', async ({ page }) => {
    // Login as viewer (read-only)
    await login(page, 'viewer', 'viewer123');
    await navigateToSimulation(page);
    
    // Verify start button is disabled
    await expect(page.locator('[data-testid="start-simulation-btn"]')).toBeDisabled();
    
    // Can view but not modify
    await expect(page.locator('[data-testid="simulation-dashboard"]')).toBeVisible();
    
    // Logout and login as operator
    await page.click('[data-testid="logout-btn"]');
    await login(page, 'operator', 'operator123');
    await navigateToSimulation(page);
    
    // Verify full access
    await expect(page.locator('[data-testid="start-simulation-btn"]')).toBeEnabled();
  });
});

test.describe('Simulation System Integration Tests', () => {
  test('hardware abstraction layer integration', async ({ page }) => {
    await navigateToSimulation(page);
    
    // Start simulation
    await page.click('[data-testid="start-simulation-btn"]');
    await page.click('[data-testid="quick-start-hal-test"]');
    await page.click('[data-testid="confirm-start-btn"]');
    await page.waitForSelector('[data-testid="simulation-status"]:has-text("Running")');
    
    // Verify HAL status
    await page.click('[data-testid="tab-system"]');
    await expect(page.locator('[data-testid="hal-status"]')).toContainText('Connected');
    await expect(page.locator('[data-testid="hal-mode"]')).toContainText('Simulation');
    
    // Test switching between simulation and hardware
    // This would require actual hardware to be connected
  });
});