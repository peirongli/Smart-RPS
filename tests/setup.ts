// Test setup file for DeveloperWorks JavaScript SDK

// Mock fetch for Node.js environment
if (typeof global.fetch === 'undefined') {
  const { fetch } = require('node-fetch');
  global.fetch = fetch;
}

// Mock localStorage for Node.js environment
if (typeof global.localStorage === 'undefined') {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn()
  };
  global.localStorage = localStorageMock;
}

// Mock window for Node.js environment
if (typeof global.window === 'undefined') {
  global.window = {
    localStorage: global.localStorage,
  } as any;
}

// Mock AbortSignal.timeout for Node.js environment
if (typeof AbortSignal.timeout === 'undefined') {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Global test utilities
global.console = {
  ...console,
  // Uncomment to suppress console.log during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
