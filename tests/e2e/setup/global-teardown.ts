import { FullConfig } from '@playwright/test';
import { DatabaseService } from '../utils/database-service';
import { HardwareService } from '../utils/hardware-service';
import fs from 'fs/promises';
import path from 'path';

/**
 * Global Teardown for Playwright E2E Tests
 * 
 * This teardown runs once after all tests complete and handles:
 * - Database cleanup
 * - Hardware simulator shutdown
 * - Temporary file cleanup
 * - Test artifacts organization
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Rover Mission Control E2E Test Teardown...');

  try {
    // Stop hardware simulators
    console.log('🔧 Stopping hardware simulators...');
    const hardwareService = new HardwareService();
    await hardwareService.stopSimulators();

    // Cleanup test database
    console.log('📊 Cleaning up test database...');
    const dbService = new DatabaseService();
    await dbService.cleanup();

    // Clean up authentication states
    console.log('🔐 Cleaning up authentication states...');
    await cleanupAuthStates();

    // Organize test artifacts
    console.log('📁 Organizing test artifacts...');
    await organizeTestArtifacts();

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error to prevent masking test failures
  }
}

/**
 * Clean up authentication state files
 */
async function cleanupAuthStates() {
  const authDir = 'tests/e2e/auth';
  try {
    const files = await fs.readdir(authDir);
    const authFiles = files.filter(file => file.endsWith('-auth.json'));
    
    for (const file of authFiles) {
      await fs.unlink(path.join(authDir, file));
    }
  } catch (error) {
    console.warn('Warning: Failed to cleanup auth states:', error);
  }
}

/**
 * Organize test artifacts by timestamp
 */
async function organizeTestArtifacts() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactsDir = `test-artifacts-${timestamp}`;

  try {
    // Create artifacts directory
    await fs.mkdir(artifactsDir, { recursive: true });

    // Move test results
    try {
      await fs.rename('test-results', `${artifactsDir}/test-results`);
    } catch (error) {
      // Directory might not exist if no tests failed
    }

    // Move playwright report
    try {
      await fs.rename('playwright-report', `${artifactsDir}/playwright-report`);
    } catch (error) {
      // Directory might not exist if no HTML report was generated
    }

    // Move coverage reports if they exist
    try {
      await fs.rename('coverage', `${artifactsDir}/coverage`);
    } catch (error) {
      // Coverage directory might not exist
    }

    console.log(`📁 Test artifacts organized in: ${artifactsDir}`);
  } catch (error) {
    console.warn('Warning: Failed to organize test artifacts:', error);
  }
}

export default globalTeardown;