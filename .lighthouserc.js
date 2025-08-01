/**
 * Lighthouse CI Configuration
 * 
 * Automated accessibility, performance, and best practices auditing
 * Focuses on WCAG 2.1 AA compliance and performance benchmarks
 */

module.exports = {
  ci: {
    // Collect configuration
    collect: {
      // Number of runs per URL for more reliable results
      numberOfRuns: 3,
      
      // URLs to audit
      url: [
        'http://localhost:3000',
        'http://localhost:3000/hal-dashboard',
        'http://localhost:3000/device-discovery',
        'http://localhost:3000/telemetry',
        'http://localhost:3000/simulation'
      ],
      
      // Lighthouse settings
      settings: {
        // Chrome flags for consistent testing
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--no-first-run',
          '--disable-default-apps'
        ],
        
        // Emulation settings
        emulatedFormFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        
        // Only run categories we care about
        onlyCategories: [
          'accessibility',
          'best-practices',
          'performance',
          'seo'
        ],
        
        // Skip certain audits that aren't relevant
        skipAudits: [
          'canonical',
          'meta-description',
          'robots-txt'
        ],
        
        // Additional accessibility audits
        additionalTraceCategories: 'accessibility'
      },
      
      // Start server before collection
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'webpack compiled',
      startServerReadyTimeout: 30000,
      
      // Collect artifacts for debugging
      artifacts: true
    },
    
    // Assert configuration - Define minimum thresholds
    assert: {
      assertions: {
        // Accessibility thresholds (WCAG 2.1 AA compliance)
        'categories:accessibility': ['error', { minScore: 0.95 }],
        
        // Performance thresholds
        'categories:performance': ['warn', { minScore: 0.8 }],
        
        // Best practices
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        
        // SEO basics
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Specific accessibility audits
        'audits:aria-allowed-attr': 'error',
        'audits:aria-command-name': 'error',
        'audits:aria-hidden-body': 'error',
        'audits:aria-hidden-focus': 'error',
        'audits:aria-input-field-name': 'error',
        'audits:aria-meter-name': 'error',
        'audits:aria-progressbar-name': 'error',
        'audits:aria-required-attr': 'error',
        'audits:aria-required-children': 'error',
        'audits:aria-required-parent': 'error',
        'audits:aria-roles': 'error',
        'audits:aria-toggle-field-name': 'error',
        'audits:aria-tooltip-name': 'error',
        'audits:aria-valid-attr': 'error',
        'audits:aria-valid-attr-value': 'error',
        'audits:button-name': 'error',
        'audits:bypass': 'error',
        'audits:color-contrast': 'error',
        'audits:definition-list': 'error',
        'audits:dlitem': 'error',
        'audits:document-title': 'error',
        'audits:duplicate-id-active': 'error',
        'audits:duplicate-id-aria': 'error',
        'audits:form-field-multiple-labels': 'error',
        'audits:frame-title': 'error',
        'audits:heading-order': 'error',
        'audits:html-has-lang': 'error',
        'audits:html-lang-valid': 'error',
        'audits:image-alt': 'error',
        'audits:input-image-alt': 'error',
        'audits:label': 'error',
        'audits:landmark-one-main': 'error',
        'audits:link-name': 'error',
        'audits:list': 'error',
        'audits:listitem': 'error',
        'audits:meta-refresh': 'error',
        'audits:meta-viewport': 'error',
        'audits:object-alt': 'error',
        'audits:tabindex': 'error',
        'audits:td-headers-attr': 'error',
        'audits:th-has-data-cells': 'error',
        'audits:valid-lang': 'error',
        'audits:video-caption': 'error',
        
        // Performance audits
        'audits:first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'audits:largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'audits:cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'audits:total-blocking-time': ['warn', { maxNumericValue: 300 }],
        
        // Resource loading
        'audits:unused-css-rules': ['warn', { maxNumericValue: 20000 }],
        'audits:unused-javascript': ['warn', { maxNumericValue: 20000 }],
        
        // Best practices
        'audits:uses-https': 'error',
        'audits:is-on-https': 'error',
        'audits:viewport': 'error'
      },
      
      // Preset configurations
      preset: 'lighthouse:no-pwa',
      
      // Include passed audits in output
      includePassedAssertions: true
    },
    
    // Upload configuration (if using LHCI server)
    upload: {
      target: 'temporary-public-storage',
      
      // Alternative: Upload to GitHub Pages or custom server
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN
    },
    
    // Server configuration (if running LHCI server)
    server: {
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite3',
        sqlDatabasePath: './lhci.db'
      }
    }
  }
};

// Environment-specific overrides
if (process.env.CI) {
  // CI-specific settings
  module.exports.ci.collect.settings.chromeFlags.push(
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  );
  
  // More lenient thresholds for CI due to resource constraints
  module.exports.ci.assert.assertions['categories:performance'] = ['warn', { minScore: 0.7 }];
  module.exports.ci.assert.assertions['audits:first-contentful-paint'] = ['warn', { maxNumericValue: 3000 }];
  module.exports.ci.assert.assertions['audits:largest-contentful-paint'] = ['warn', { maxNumericValue: 4000 }];
}

// Mobile-specific configuration for responsive testing
const mobileConfig = {
  ...module.exports,
  ci: {
    ...module.exports.ci,
    collect: {
      ...module.exports.ci.collect,
      settings: {
        ...module.exports.ci.collect.settings,
        emulatedFormFactor: 'mobile',
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        }
      }
    }
  }
};

// Export both configurations
module.exports.mobile = mobileConfig;