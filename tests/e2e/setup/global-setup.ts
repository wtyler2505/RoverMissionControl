import { chromium, FullConfig } from '@playwright/test';
import { AuthService } from '../utils/auth-service';
import { DatabaseService } from '../utils/database-service';
import { HardwareService } from '../utils/hardware-service';

/**
 * Global Setup for Playwright E2E Tests
 * 
 * This setup runs once before all tests and handles:
 * - Database initialization and seeding
 * - Hardware simulator setup
 * - Environment configuration
 * - Service health checks
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Rover Mission Control E2E Test Setup...');

  try {
    // Initialize test database
    console.log('📊 Initializing test database...');
    const dbService = new DatabaseService();
    await dbService.initialize();
    await dbService.seedTestData();

    // Setup hardware simulators
    console.log('🔧 Setting up hardware simulators...');
    const hardwareService = new HardwareService();
    await hardwareService.startSimulators();

    // Verify services are running
    console.log('🏥 Performing health checks...');
    await verifyServices();

    // Setup authentication states
    console.log('🔐 Setting up authentication states...');
    await setupAuthenticationStates();

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Verify that all required services are running and accessible
 */
async function verifyServices() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Check frontend is accessible
    const frontendResponse = await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle' 
    });
    if (!frontendResponse?.ok()) {
      throw new Error('Frontend service not accessible');
    }

    // Check backend API health
    const apiResponse = await page.request.get('http://localhost:8000/health');
    if (!apiResponse.ok()) {
      throw new Error('Backend API not accessible');
    }

    // Check WebSocket connection
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:8000/ws');
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });
    });

    console.log('✅ All services are healthy');
  } finally {
    await browser.close();
  }
}

/**
 * Setup authentication states for different user roles
 */
async function setupAuthenticationStates() {
  const authService = new AuthService();

  // Setup admin authentication state
  await authService.createAuthState({
    username: 'admin',
    password: 'Admin@123',
    role: 'admin',
    outputPath: 'tests/e2e/auth/admin-auth.json'
  });

  // Setup operator authentication state
  await authService.createAuthState({
    username: 'operator',
    password: 'Operator@123',
    role: 'operator',
    outputPath: 'tests/e2e/auth/operator-auth.json'
  });

  // Setup viewer authentication state
  await authService.createAuthState({
    username: 'viewer',
    password: 'Viewer@123',
    role: 'viewer',
    outputPath: 'tests/e2e/auth/viewer-auth.json'
  });
}

export default globalSetup;