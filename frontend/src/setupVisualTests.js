/**
 * Visual Testing Setup
 * 
 * Configures Jest for visual regression testing with image snapshots.
 * Provides utilities for consistent screenshot testing across components.
 */

import { configureToMatchImageSnapshot } from 'jest-image-snapshot';

// Configure image snapshot matching
const toMatchImageSnapshot = configureToMatchImageSnapshot({
  // Comparison settings
  threshold: 0.1, // 10% difference threshold
  comparisonMethod: 'ssim', // Structural similarity
  
  // Image processing
  blur: 1, // Slight blur to reduce noise
  allowSizeMismatch: false,
  
  // Failure settings
  failureThreshold: 0.01, // 1% pixel difference threshold
  failureThresholdType: 'percent',
  
  // Output settings
  customDiffDir: '__image_snapshots__/__diff_output__',
  customSnapshotsDir: '__image_snapshots__',
  customSnapshotIdentifier: ({ currentTestName, counter }) => 
    `${currentTestName.replace(/\s+/g, '-').toLowerCase()}-${counter}`,
  
  // Diff configuration
  diffDirection: 'horizontal',
  dumpDiffToConsole: process.env.CI ? false : true,
  dumpInlineDiffToConsole: false,
  
  // Color settings for diff highlighting
  diffColorAlt: [255, 0, 255], // Magenta for differences
  diffColor: [255, 255, 0], // Yellow for differences
  
  // Noise reduction
  noColors: false,
  
  // Update behavior
  updateSnapshot: process.env.UPDATE_SNAPSHOTS === 'true' || process.argv.includes('--updateSnapshot')
});

// Add custom matcher to Jest
expect.extend({ toMatchImageSnapshot });

// Global configuration for visual tests
global.visualTestConfig = {
  // Default viewport sizes for responsive testing
  viewports: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1200, height: 800 },
    ultrawide: { width: 1920, height: 1080 }
  },
  
  // Theme configurations
  themes: {
    light: {
      background: '#ffffff',
      surface: '#f5f5f5',
      primary: '#1976d2',
      secondary: '#dc004e'
    },
    dark: {
      background: '#1a1a1a',
      surface: '#2d2d2d',
      primary: '#90caf9',
      secondary: '#f48fb1'
    },
    highContrast: {
      background: '#000000',
      surface: '#ffffff',
      primary: '#ffff00',
      secondary: '#00ffff'
    }
  },
  
  // Animation settings
  animations: {
    disable: true, // Disable animations for consistent screenshots
    duration: 0
  },
  
  // Loading states
  waitForLoad: {
    timeout: 5000,
    checkInterval: 100
  },
  
  // HAL component specific settings
  hal: {
    mockDataDelay: 100,
    simulatedLatency: 50,
    deviceCount: 5
  }
};

// Visual testing utilities
global.visualTestUtils = {
  /**
   * Wait for component to be fully rendered
   */
  waitForRender: (timeout = 1000) => 
    new Promise(resolve => setTimeout(resolve, timeout)),
  
  /**
   * Wait for all images to load
   */
  waitForImages: () => 
    new Promise(resolve => {
      const images = document.getElementsByTagName('img');
      let loadedCount = 0;
      
      if (images.length === 0) {
        resolve();
        return;
      }
      
      Array.from(images).forEach(img => {
        if (img.complete) {
          loadedCount++;
        } else {
          img.onload = () => {
            loadedCount++;
            if (loadedCount === images.length) resolve();
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === images.length) resolve();
          };
        }
      });
      
      if (loadedCount === images.length) resolve();
    }),
  
  /**
   * Wait for animations to complete
   */
  waitForAnimations: () => 
    new Promise(resolve => {
      // Disable CSS transitions and animations
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-delay: 0.01ms !important;
          transition-duration: 0.01ms !important;
          transition-delay: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
      
      // Wait for any ongoing animations to finish
      setTimeout(() => {
        document.head.removeChild(style);
        resolve();
      }, 100);
    }),
  
  /**
   * Set up mock data for HAL components
   */
  setupHALMocks: () => {
    // Mock WebSocket connection
    global.mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Mock HAL device data
    global.mockHALDevices = [
      {
        id: 'hal-device-1',
        name: 'Main Control Unit',
        type: 'controller',
        status: 'connected',
        firmware: '1.2.3',
        lastSeen: new Date().toISOString()
      },
      {
        id: 'hal-device-2',
        name: 'Sensor Array',
        type: 'sensor',
        status: 'active',
        firmware: '2.1.0',
        lastSeen: new Date().toISOString()
      }
    ];
    
    // Mock telemetry data
    global.mockTelemetryData = {
      timestamp: Date.now(),
      temperature: 23.5,
      humidity: 45.2,
      pressure: 1013.25,
      voltage: 12.6,
      current: 2.3
    };
  },
  
  /**
   * Clean up after visual tests
   */
  cleanup: () => {
    // Clear any injected styles
    const visualTestStyles = document.querySelectorAll('style[data-visual-test]');
    visualTestStyles.forEach(style => style.remove());
    
    // Reset global mocks
    delete global.mockWebSocket;
    delete global.mockHALDevices;
    delete global.mockTelemetryData;
  }
};

// Environment setup for visual testing
if (process.env.NODE_ENV === 'test') {
  // Disable console warnings for cleaner test output
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Filter out React warnings that don't affect visual output
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('componentWillReceiveProps') ||
      message.includes('componentWillUpdate') ||
      message.includes('findDOMNode')
    )) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  // Mock requestAnimationFrame for consistent timing
  global.requestAnimationFrame = callback => setTimeout(callback, 16);
  global.cancelAnimationFrame = clearTimeout;
  
  // Mock ResizeObserver
  global.ResizeObserver = class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  
  // Mock IntersectionObserver
  global.IntersectionObserver = class MockIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Performance optimization for CI
if (process.env.CI) {
  // Reduce image quality for faster comparisons
  toMatchImageSnapshot.updateSnapshotState = Object.assign(
    toMatchImageSnapshot.updateSnapshotState,
    { 
      comparisonMethod: 'pixelmatch',
      threshold: 0.2 
    }
  );
}

console.log('✓ Visual testing setup complete');