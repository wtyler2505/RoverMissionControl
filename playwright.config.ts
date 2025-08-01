import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration for Rover Mission Control E2E Testing
 * 
 * This configuration provides comprehensive testing setup for:
 * - Multi-browser testing (Chromium, Firefox, WebKit)
 * - Mobile device simulation
 * - Visual regression testing
 * - Authentication state management
 * - CI/CD optimization
 */

export default defineConfig({
  // Test directory structure
  testDir: './tests/e2e',
  testMatch: '**/*.{test,spec}.{js,ts}',
  
  // Global test settings
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 15000, // 15 seconds for assertions
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'strict',
      animations: 'disabled'
    },
    toMatchSnapshot: {
      threshold: 0.2
    }
  },
  
  // Test execution settings
  fullyParallel: process.env.CI ? false : true, // Disable parallel in CI for stability
  forbidOnly: !!process.env.CI, // Prevent .only() in CI
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
  workers: process.env.CI ? 2 : undefined, // Limit workers in CI
  
  // Reporter configuration
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/setup/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/setup/global-teardown.ts'),
  
  // Test output directories
  outputDir: 'test-results/',
  snapshotDir: 'tests/e2e/snapshots',
  
  // Web server configuration
  webServer: [
    {
      command: 'cd frontend && npm start',
      port: 3000,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        REACT_APP_API_URL: 'http://localhost:8000',
        REACT_APP_WS_URL: 'ws://localhost:8000'
      }
    },
    {
      command: 'cd backend && python server.py --test-mode',
      port: 8000,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      env: {
        ENVIRONMENT: 'test',
        DATABASE_URL: 'sqlite:///test_rover_platform.db',
        LOG_LEVEL: 'WARNING'
      }
    }
  ],
  
  // Common browser configuration
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:3000',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: process.env.CI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    
    // Network options
    extraHTTPHeaders: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    
    // Performance settings
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Storage state for authenticated tests
    storageState: process.env.STORAGE_STATE || undefined
  },

  // Project configurations for different browsers and scenarios
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      teardown: 'cleanup'
    },
    
    // Cleanup project
    {
      name: 'cleanup',
      testMatch: '**/auth.teardown.ts'
    },

    // Desktop browsers - Chrome/Chromium
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // Desktop browsers - Firefox
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // Desktop browsers - Safari (WebKit)
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // Mobile testing - Chrome Mobile
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // Mobile testing - Safari Mobile
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // High DPI testing
    {
      name: 'high-dpi',
      use: {
        ...devices['Desktop Chrome HiDPI'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // API testing project
    {
      name: 'api',
      testDir: './tests/e2e/api',
      use: {
        baseURL: 'http://localhost:8000',
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    },

    // Visual regression testing
    {
      name: 'visual',
      testDir: './tests/e2e/visual',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // Performance testing
    {
      name: 'performance',
      testDir: './tests/e2e/performance',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    },

    // Accessibility testing
    {
      name: 'accessibility',
      testDir: './tests/e2e/accessibility',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/auth/admin-auth.json'
      },
      dependencies: ['setup']
    }
  ],

  // Metadata for test reporting
  metadata: {
    testEnvironment: process.env.NODE_ENV || 'test',
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:8000',
    playwrightVersion: require('@playwright/test/package.json').version,
    nodeVersion: process.version,
    os: process.platform,
    ci: !!process.env.CI
  }
});