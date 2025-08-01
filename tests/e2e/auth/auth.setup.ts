import { test as setup, expect } from '@playwright/test';
import path from 'path';

/**
 * Authentication Setup for E2E Tests
 * 
 * This setup creates authenticated browser contexts for different user roles.
 * The authentication states are saved and reused across tests for performance.
 */

const adminAuthFile = 'tests/e2e/auth/admin-auth.json';
const operatorAuthFile = 'tests/e2e/auth/operator-auth.json';
const viewerAuthFile = 'tests/e2e/auth/viewer-auth.json';

/**
 * Setup Admin Authentication
 */
setup('authenticate as admin', async ({ page }) => {
  console.log('🔐 Setting up admin authentication...');
  
  // Navigate to login page
  await page.goto('/login');
  
  // Wait for login form to be visible
  await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  
  // Fill login credentials
  await page.fill('[data-testid="username-input"]', 'admin');
  await page.fill('[data-testid="password-input"]', 'Admin@123');
  
  // Click login button
  await page.click('[data-testid="login-button"]');
  
  // Wait for successful login (redirect to dashboard)
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  
  // Verify admin privileges
  await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
  
  console.log('✅ Admin authentication completed');
  
  // Save authentication state
  await page.context().storageState({ path: adminAuthFile });
});

/**
 * Setup Operator Authentication
 */
setup('authenticate as operator', async ({ page }) => {
  console.log('🔐 Setting up operator authentication...');
  
  // Navigate to login page
  await page.goto('/login');
  
  // Wait for login form to be visible
  await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  
  // Fill login credentials
  await page.fill('[data-testid="username-input"]', 'operator');
  await page.fill('[data-testid="password-input"]', 'Operator@123');
  
  // Click login button
  await page.click('[data-testid="login-button"]');
  
  // Wait for successful login
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  
  // Verify operator privileges (no admin menu)
  await expect(page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="operator-controls"]')).toBeVisible();
  
  console.log('✅ Operator authentication completed');
  
  // Save authentication state
  await page.context().storageState({ path: operatorAuthFile });
});

/**
 * Setup Viewer Authentication
 */
setup('authenticate as viewer', async ({ page }) => {
  console.log('🔐 Setting up viewer authentication...');
  
  // Navigate to login page
  await page.goto('/login');
  
  // Wait for login form to be visible  
  await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  
  // Fill login credentials
  await page.fill('[data-testid="username-input"]', 'viewer');
  await page.fill('[data-testid="password-input"]', 'Viewer@123');
  
  // Click login button
  await page.click('[data-testid="login-button"]');
  
  // Wait for successful login
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  
  // Verify viewer privileges (read-only access)
  await expect(page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="operator-controls"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="viewer-dashboard"]')).toBeVisible();
  
  console.log('✅ Viewer authentication completed');
  
  // Save authentication state
  await page.context().storageState({ path: viewerAuthFile });
});