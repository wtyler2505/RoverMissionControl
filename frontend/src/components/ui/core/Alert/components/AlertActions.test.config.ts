/**
 * AlertActions Test Configuration
 * Centralizes test setup, utilities, and shared mocks for all alert action tests
 */

import { AlertAction, ActionResult, AlertActionGroup } from '../types/AlertActionTypes';

// Common test utilities
export const TestUtils = {
  // Create a mock action with default values
  createMockAction: (overrides: Partial<AlertAction> = {}): AlertAction => {
    const baseAction: AlertAction = {
      id: 'mock-action',
      type: 'custom',
      label: 'Mock Action',
      priority: 'primary',
      execute: jest.fn(() => Promise.resolve({ success: true })),
      ...overrides
    };
    return baseAction;
  },

  // Create multiple mock actions
  createMockActions: (count: number, baseOverrides: Partial<AlertAction> = {}): AlertAction[] => {
    return Array.from({ length: count }, (_, i) => 
      TestUtils.createMockAction({
        id: `action-${i}`,
        label: `Action ${i}`,
        ...baseOverrides
      })
    );
  },

  // Create action groups
  createMockActionGroup: (
    actions: AlertAction[], 
    overrides: Partial<AlertActionGroup> = {}
  ): AlertActionGroup => ({
    id: 'mock-group',
    label: 'Mock Group',
    priority: 'primary',
    orientation: 'horizontal',
    actions,
    ...overrides
  }),

  // Mock successful result
  mockSuccessResult: (overrides: Partial<ActionResult> = {}): ActionResult => ({
    success: true,
    ...overrides
  }),

  // Mock error result
  mockErrorResult: (message = 'Test error', overrides: Partial<ActionResult> = {}): ActionResult => ({
    success: false,
    error: message,
    ...overrides
  }),

  // Wait for async operations
  waitFor: (condition: () => boolean, timeout = 1000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkCondition = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Condition not met within timeout'));
        } else {
          setTimeout(checkCondition, 10);
        }
      };
      checkCondition();
    });
  },

  // Mock DOM methods that might not be available in test environment
  mockDOMFeatures: () => {
    // Mock focus if not available
    if (!HTMLElement.prototype.focus) {
      HTMLElement.prototype.focus = jest.fn();
    }

    // Mock blur if not available
    if (!HTMLElement.prototype.blur) {
      HTMLElement.prototype.blur = jest.fn();
    }

    // Mock scrollIntoView if not available
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = jest.fn();
    }

    // Mock getBoundingClientRect if not available
    if (!HTMLElement.prototype.getBoundingClientRect) {
      HTMLElement.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 100,
        height: 44,
        top: 0,
        left: 0,
        bottom: 44,
        right: 100,
        x: 0,
        y: 0,
        toJSON: jest.fn()
      }));
    }

    // Mock getComputedStyle if not available
    if (!window.getComputedStyle) {
      window.getComputedStyle = jest.fn(() => ({
        minHeight: '44px',
        minWidth: '44px',
        height: '44px',
        width: '100px',
        borderWidth: '2px',
        fontWeight: '500',
        color: '#000000',
        backgroundColor: '#ffffff',
        transition: 'all 0.2s ease',
        transform: 'none',
        maxWidth: '200px'
      } as CSSStyleDeclaration));
    }

    // Mock matchMedia if not available
    if (!window.matchMedia) {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    }

    // Mock performance if not available
    if (!window.performance) {
      window.performance = {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn(),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn(),
        getEntries: jest.fn(() => []),
        getEntriesByName: jest.fn(() => []),
        getEntriesByType: jest.fn(() => [])
      } as any;
    }
  },

  // Clean up after tests
  cleanup: () => {
    jest.clearAllMocks();
    
    // Clear any remaining DOM elements from announcements
    const announcements = document.querySelectorAll('[aria-live]');
    announcements.forEach(el => el.remove());

    // Reset document properties
    document.dir = 'ltr';
    
    // Reset window properties
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  }
};

// Mock implementations for action utilities
export const MockActionUtils = {
  canExecuteAction: jest.fn(() => ({ canExecute: true })),
  markActionExecuting: jest.fn(),
  markActionCompleted: jest.fn(),
  executeActionSafely: jest.fn(),
  handleKeyboardNavigation: jest.fn(),
  generateFocusOrder: jest.fn((actions: AlertAction[]) => 
    actions.map(action => action.id)
  ),
  validateAction: jest.fn(() => ({ valid: true, errors: [] })),
  createActionAriaLabel: jest.fn((action: AlertAction) => 
    `${action.label}${action.shortcut ? ` (${action.shortcut})` : ''}`
  ),
  clearActionRegistry: jest.fn()
};

// Predefined action sets for testing
export const TestActionSets = {
  // Basic actions for simple tests
  basic: [
    TestUtils.createMockAction({
      id: 'retry',
      type: 'retry',
      label: 'Retry',
      priority: 'primary',
      variant: 'primary',
      retryOperation: jest.fn(() => Promise.resolve({ success: true })),
      shortcut: 'r'
    }),
    TestUtils.createMockAction({
      id: 'dismiss',
      type: 'dismiss',
      label: 'Dismiss',
      priority: 'tertiary',
      variant: 'ghost',
      dismissOperation: jest.fn(() => Promise.resolve({ success: true })),
      shortcut: 'Escape'
    })
  ],

  // Actions with confirmations
  withConfirmations: [
    TestUtils.createMockAction({
      id: 'delete',
      type: 'custom',
      label: 'Delete',
      priority: 'primary',
      variant: 'danger',
      confirmation: 'destructive',
      confirmationTitle: 'Confirm Deletion',
      confirmationMessage: 'Are you sure?',
      execute: jest.fn(() => Promise.resolve({ success: true }))
    }),
    TestUtils.createMockAction({
      id: 'reset',
      type: 'custom',
      label: 'Reset',
      priority: 'secondary',
      confirmation: 'simple',
      execute: jest.fn(() => Promise.resolve({ success: true }))
    })
  ],

  // Actions for accessibility testing
  accessible: [
    TestUtils.createMockAction({
      id: 'accessible-retry',
      type: 'retry',
      label: 'Retry Operation',
      priority: 'primary',
      ariaLabel: 'Retry the failed operation',
      description: 'Attempts to retry the operation that failed',
      retryOperation: jest.fn(() => Promise.resolve({ success: true })),
      shortcut: 'r'
    }),
    TestUtils.createMockAction({
      id: 'accessible-details',
      type: 'view-details',
      label: 'View Details',
      priority: 'tertiary',
      ariaLabel: 'View detailed information',
      description: 'Opens detailed information about this alert',
      detailsUrl: '/details/123'
    })
  ],

  // Actions for performance testing
  many: TestUtils.createMockActions(20),

  // Actions with various states
  withStates: [
    TestUtils.createMockAction({
      id: 'loading',
      label: 'Loading Action',
      state: 'loading'
    }),
    TestUtils.createMockAction({
      id: 'success',
      label: 'Success Action',
      state: 'success'
    }),
    TestUtils.createMockAction({
      id: 'error',
      label: 'Error Action',
      state: 'error'
    }),
    TestUtils.createMockAction({
      id: 'disabled',
      label: 'Disabled Action',
      disabled: true
    })
  ]
};

// Browser environment mocks
export const BrowserMocks = {
  userAgents: {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.864.59 Edg/91.0.864.59'
  },
  
  screenSizes: {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 }
  },

  mockUserAgent: (agent: keyof typeof BrowserMocks.userAgents) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: BrowserMocks.userAgents[agent],
      configurable: true
    });
  },

  mockScreenSize: (size: keyof typeof BrowserMocks.screenSizes) => {
    const { width, height } = BrowserMocks.screenSizes[size];
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
  },

  mockMediaQuery: (queries: Record<string, boolean>) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: queries[query] || false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }
};

// Test configuration object
export const TestConfig = {
  // Default props for AlertActions
  defaultProps: {
    alertId: 'test-alert',
    alertPriority: 'high',
    keyboard: { enabled: true },
    confirmations: true
  },

  // Timeouts for various operations
  timeouts: {
    action: 5000,
    animation: 1000,
    debounce: 500,
    focus: 100
  },

  // Expected values for assertions
  expectations: {
    minTouchTarget: 44,
    maxActionExecutionTime: 1000,
    maxRenderTime: 100,
    maxRerenderTime: 50
  }
};

// Global test setup
export const setupTests = () => {
  TestUtils.mockDOMFeatures();
  
  // Mock console methods to reduce noise in tests
  const originalConsole = { ...console };
  console.warn = jest.fn();
  console.error = jest.fn();
  
  return () => {
    TestUtils.cleanup();
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  };
};

// Jest setup for specific test files
export const jestSetup = {
  beforeEach: () => {
    TestUtils.mockDOMFeatures();
    TestUtils.cleanup();
  },
  
  afterEach: () => {
    TestUtils.cleanup();
  }
};