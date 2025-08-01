import { test as teardown } from '@playwright/test';
import fs from 'fs/promises';

/**
 * Authentication Teardown for E2E Tests
 * 
 * This teardown cleans up authentication states and related resources.
 */

teardown('cleanup authentication states', async ({}) => {
  console.log('🧹 Cleaning up authentication states...');
  
  const authFiles = [
    'tests/e2e/auth/admin-auth.json',
    'tests/e2e/auth/operator-auth.json',
    'tests/e2e/auth/viewer-auth.json'
  ];
  
  for (const file of authFiles) {
    try {
      await fs.unlink(file);
      console.log(`✅ Removed ${file}`);
    } catch (error) {
      // File might not exist, which is fine
      console.log(`ℹ️  ${file} not found or already removed`);
    }
  }
  
  console.log('✅ Authentication cleanup completed');
});