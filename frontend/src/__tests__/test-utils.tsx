import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

// Create a test theme
const testTheme = createTheme({
  palette: {
    mode: 'light',
  },
});

// Custom render function that includes common providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here
  route?: string;
  theme?: typeof testTheme;
}

const AllTheProviders: React.FC<{ children: React.ReactNode; route?: string; theme?: typeof testTheme }> = ({ 
  children, 
  route = '/',
  theme = testTheme 
}) => {
  // Mock router with initial entries
  const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );

  return (
    <RouterWrapper>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </RouterWrapper>
  );
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { route, theme, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders route={route} theme={theme}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Create a mock WebSocket context provider for testing
export const MockWebSocketProvider: React.FC<{ 
  children: React.ReactNode;
  mockValues?: {
    isConnected?: boolean;
    lastMessage?: any;
    sendMessage?: jest.Mock;
    subscribe?: jest.Mock;
    unsubscribe?: jest.Mock;
  };
}> = ({ children, mockValues = {} }) => {
  const defaultValues = {
    isConnected: true,
    lastMessage: null,
    sendMessage: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    ...mockValues
  };

  // Mock the WebSocket context
  return React.createElement(
    'div',
    { 'data-testid': 'mock-websocket-provider' },
    children
  );
};

// Create a mock HAL context provider for testing
export const MockHALProvider: React.FC<{ 
  children: React.ReactNode;
  mockValues?: {
    devices?: any[];
    isLoading?: boolean;
    error?: string | null;
    refreshDevices?: jest.Mock;
    sendCommand?: jest.Mock;
  };
}> = ({ children, mockValues = {} }) => {
  const defaultValues = {
    devices: [
      {
        id: 'test-device-1',
        name: 'Test Device 1',
        type: 'sensor',
        status: 'connected',
        capabilities: ['temperature']
      }
    ],
    isLoading: false,
    error: null,
    refreshDevices: jest.fn(),
    sendCommand: jest.fn().mockResolvedValue({ success: true }),
    ...mockValues
  };

  return React.createElement(
    'div',
    { 'data-testid': 'mock-hal-provider' },
    children
  );
};

// Mock telemetry data generator
export const generateMockTelemetryData = (count: number = 100, stream: string = 'temperature') => {
  const data = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    data.push({
      timestamp: new Date(now - (count - i) * 1000).toISOString(),
      value: Math.random() * 100,
      stream,
      id: `data-${i}`
    });
  }
  
  return data;
};

// Mock device data generator
export const generateMockDevice = (overrides: any = {}) => ({
  id: 'mock-device-' + Math.random().toString(36).substr(2, 9),
  name: 'Mock Device',
  type: 'sensor',
  status: 'connected',
  lastSeen: new Date().toISOString(),
  capabilities: ['temperature', 'humidity'],
  metadata: {
    version: '1.0.0',
    manufacturer: 'Test Corp'
  },
  ...overrides
});

// Mock command data generator
export const generateMockCommand = (overrides: any = {}) => ({
  id: 'mock-cmd-' + Math.random().toString(36).substr(2, 9),
  command: 'TEST_COMMAND',
  parameters: {},
  status: 'pending',
  priority: 'medium',
  createdAt: new Date().toISOString(),
  deviceId: 'mock-device-1',
  ...overrides
});

// Wait for async operations with timeout
export const waitForAsync = (ms: number = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Custom matchers for better test assertions
export const customMatchers = {
  toBeConnectedDevice: (received: any) => {
    const pass = received && received.status === 'connected';
    return {
      message: () => `expected device to ${pass ? 'not ' : ''}be connected`,
      pass,
    };
  },
  
  toHaveValidTelemetryData: (received: any) => {
    const pass = received && 
                 Array.isArray(received) && 
                 received.every((item: any) => 
                   item.timestamp && 
                   typeof item.value === 'number' && 
                   item.stream
                 );
    return {
      message: () => `expected ${pass ? 'not ' : ''}to have valid telemetry data`,
      pass,
    };
  }
};

// Setup for async testing
export const setupAsyncTest = () => {
  let cleanup: (() => void)[] = [];
  
  const addCleanup = (fn: () => void) => {
    cleanup.push(fn);
  };
  
  const runCleanup = () => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  };
  
  return { addCleanup, runCleanup };
};

// Mock user interaction helpers
export const createMockUser = () => ({
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  permissions: ['read', 'write']
});

// Mock file for file upload tests
export const createMockFile = (name: string = 'test.txt', type: string = 'text/plain', size: number = 1024) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Export everything including the custom render
export * from '@testing-library/react';
export { customRender as render };
export { default as userEvent } from '@testing-library/user-event';