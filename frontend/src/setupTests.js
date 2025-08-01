// React Testing Library and Jest DOM setup
import '@testing-library/jest-dom';

// Jest-axe setup for accessibility testing
import { configureAxe } from 'jest-axe';

// MSW setup for API mocking
import { server } from './__mocks__/server';

// Polyfills for jsdom environment
import 'whatwg-fetch';

// Global test utilities
import { cleanup } from '@testing-library/react';

// Configure MSW
beforeAll(() => {
  // Start the MSW server
  server.listen({
    onUnhandledRequest: 'warn'
  });
});

afterEach(() => {
  // Reset any request handlers that are declared as a part of our tests
  server.resetHandlers();
  // Clean up React Testing Library
  cleanup();
  // Clear all mocks
  jest.clearAllMocks();
});

afterAll(() => {
  // Clean up after all tests are done
  server.close();
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
  }

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  unobserve() {
    return null;
  }
};

// Mock ResizeObserver for components that use it
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  unobserve() {
    return null;
  }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock document.elementFromPoint for drag and drop tests
document.elementFromPoint = jest.fn();

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.scrollTo
window.scrollTo = jest.fn();

// Mock HTMLElement.scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock URL.createObjectURL for file upload tests
window.URL.createObjectURL = jest.fn(() => 'mocked-url');
window.URL.revokeObjectURL = jest.fn();

// Mock Canvas API for chart components
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({
    data: new Array(4)
  })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
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
}));

// Mock Chart.js for chart components
jest.mock('chart.js', () => ({
  Chart: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    update: jest.fn(),
    render: jest.fn(),
  })),
  registerables: [],
}));

// Mock three.js for 3D components
jest.mock('three', () => ({
  Scene: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    remove: jest.fn(),
  })),
  WebGLRenderer: jest.fn().mockImplementation(() => ({
    setSize: jest.fn(),
    render: jest.fn(),
    domElement: document.createElement('canvas'),
  })),
  PerspectiveCamera: jest.fn(),
  Vector3: jest.fn(),
  Mesh: jest.fn(),
  BoxGeometry: jest.fn(),
  MeshBasicMaterial: jest.fn(),
}));

// Mock Socket.IO client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  })),
}));

// Mock Monaco Editor
jest.mock('@monaco-editor/react', () => ({
  Editor: ({ onChange, value }) => {
    return (
      <textarea
        data-testid="monaco-editor"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    );
  },
}));

// Mock WebGL context for Three.js components
HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return {
      getExtension: jest.fn(),
      getParameter: jest.fn(),
      createProgram: jest.fn(),
      createShader: jest.fn(),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      useProgram: jest.fn(),
      getAttribLocation: jest.fn(),
      getUniformLocation: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      createBuffer: jest.fn(),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      clear: jest.fn(),
      drawArrays: jest.fn(),
      viewport: jest.fn(),
    };
  }
  
  // Fallback to 2d context mock
  return {
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Array(4)
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => []),
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
});

// Mock Fullscreen API
document.documentElement.requestFullscreen = jest.fn();
document.exitFullscreen = jest.fn();

// Suppress specific console warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is deprecated') ||
       args[0].includes('Warning: componentWillMount has been renamed') ||
       args[0].includes('Warning: componentWillReceiveProps has been renamed'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global test timeout
jest.setTimeout(10000);

// Configure axe-core for accessibility testing
const axe = configureAxe({
  rules: {
    // Configure accessibility rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-usage': { enabled: true },
    'semantic-markup': { enabled: true },
    'image-alt': { enabled: true },
    'form-labels': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-usage': { enabled: true },
    'tab-navigation': { enabled: true }
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  // Timeout for accessibility checks
  timeout: 5000
});

// Make axe available globally in tests
global.axe = axe;