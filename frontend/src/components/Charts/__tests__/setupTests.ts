/**
 * Chart Tests Setup
 * Global setup and utilities for chart component tests
 */

import 'jest-axe/extend-expect';
import '@testing-library/jest-dom';

// Mock D3 modules that might cause issues in test environment
jest.mock('d3-selection', () => ({
  ...jest.requireActual('d3-selection'),
  select: jest.fn().mockImplementation((selector) => {
    const element = typeof selector === 'string' 
      ? document.querySelector(selector)
      : selector;
    
    return {
      node: () => element,
      attr: jest.fn().mockReturnThis(),
      style: jest.fn().mockReturnThis(),
      append: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      data: jest.fn().mockReturnThis(),
      enter: jest.fn().mockReturnThis(),
      exit: jest.fn().mockReturnThis(),
      remove: jest.fn().mockReturnThis(),
      transition: jest.fn().mockReturnThis(),
      duration: jest.fn().mockReturnThis(),
      ease: jest.fn().mockReturnThis(),
      call: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      html: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      classed: jest.fn().mockReturnThis()
    };
  })
}));

// Mock performance API for older test environments
if (!global.performance) {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  } as any;
}

// Mock ResizeObserver globally
class MockResizeObserver {
  callback: ResizeObserverCallback;
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  observe = jest.fn((target: Element) => {
    // Simulate immediate callback with default dimensions
    const mockEntry: ResizeObserverEntry = {
      target,
      contentRect: {
        width: 800,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 800,
        x: 0,
        y: 0,
        toJSON: () => ({})
      },
      borderBoxSize: [] as any,
      contentBoxSize: [] as any,
      devicePixelContentBoxSize: [] as any
    };
    
    setTimeout(() => this.callback([mockEntry], this), 0);
  });
  
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = MockResizeObserver as any;

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.IntersectionObserver = MockIntersectionObserver as any;

// Mock Canvas and WebGL contexts for canvas rendering tests
HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === '2d') {
    return {
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Array(4) })),
      putImageData: jest.fn(),
      createImageData: jest.fn(() => ({ data: new Array(4) })),
      setTransform: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      fillText: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      transform: jest.fn(),
      rect: jest.fn(),
      clip: jest.fn(),
    };
  }
  return null;
});

// Mock URL.createObjectURL for export functionality
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Blob for file export tests
global.Blob = jest.fn().mockImplementation((content, options) => ({
  content,
  options,
  size: content ? content.reduce((acc: number, item: string) => acc + item.length, 0) : 0,
  type: options?.type || ''
})) as any;

// Add custom Jest matchers for chart testing
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveValidSVGStructure(received: Element) {
    const isSVG = received.tagName.toLowerCase() === 'svg';
    const hasViewBox = received.hasAttribute('viewBox');
    const hasWidth = received.hasAttribute('width');
    const hasHeight = received.hasAttribute('height');
    
    const pass = isSVG && hasViewBox && hasWidth && hasHeight;
    
    if (pass) {
      return {
        message: () => `expected SVG element not to have valid structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected SVG element to have valid structure (svg tag, viewBox, width, height)`,
        pass: false,
      };
    }
  },
  
  toHaveAccessibleAttributes(received: Element) {
    const hasRole = received.hasAttribute('role');
    const hasAriaLabel = received.hasAttribute('aria-label') || received.hasAttribute('aria-labelledby');
    
    const pass = hasRole && hasAriaLabel;
    
    if (pass) {
      return {
        message: () => `expected element not to have accessible attributes`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected element to have accessible attributes (role and aria-label/aria-labelledby)`,
        pass: false,
      };
    }
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveValidSVGStructure(): R;
      toHaveAccessibleAttributes(): R;
    }
  }
}

// Suppress console warnings in tests unless explicitly testing error handling
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clean up any DOM modifications
  document.body.innerHTML = '';
  
  // Reset any global state
  if (global.ResizeObserver) {
    (global.ResizeObserver as any).mockClear?.();
  }
});

// Test utilities
export const createMockTimeSeriesData = (count: number, startTime?: Date) => {
  const start = startTime || new Date('2024-01-01T10:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(start.getTime() + i * 60000), // 1 minute intervals
    value: Math.sin(i / 10) * 50 + 50 + (Math.random() - 0.5) * 10,
    category: i % 10 === 0 ? 'critical' : i % 5 === 0 ? 'warning' : 'normal'
  }));
};

export const createMockBarData = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    x: `Category ${String.fromCharCode(65 + i)}`, // A, B, C, etc.
    y: Math.random() * 100
  }));
};

export const createMockGaugeData = (value = 50, min = 0, max = 100) => ({
  value,
  min,
  max,
  thresholds: [
    { value: max * 0.3, label: 'Low', color: '#4caf50' },
    { value: max * 0.7, label: 'Medium', color: '#ff9800' },
    { value: max * 0.9, label: 'High', color: '#f44336' }
  ]
});

export const createMockHeatmapData = (width: number, height: number) => {
  const data = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      data.push({
        x: x,
        y: y,
        value: Math.random() * 100
      });
    }
  }
  return data;
};

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const start = performance.now();
  renderFn();
  return performance.now() - start;
};

export const waitForChartRender = async (timeout = 5000) => {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Chart render timeout after ${timeout}ms`));
    }, timeout);
    
    // Wait for next tick
    setTimeout(() => {
      clearTimeout(timer);
      resolve();
    }, 0);
  });
};
