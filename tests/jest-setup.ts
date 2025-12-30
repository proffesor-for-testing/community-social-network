/**
 * Jest Test Setup
 * Global configuration and mocks for all tests
 */

// Extend Jest matchers if needed
expect.extend({
  toHaveBeenCalledBefore(received: jest.Mock, expected: jest.Mock) {
    const receivedOrder = received.mock.invocationCallOrder[0];
    const expectedOrder = expected.mock.invocationCallOrder[0];

    const pass = receivedOrder < expectedOrder;

    if (pass) {
      return {
        message: () =>
          `expected ${received.getMockName()} not to have been called before ${expected.getMockName()}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received.getMockName()} to have been called before ${expected.getMockName()}`,
        pass: false,
      };
    }
  },
});

// Silence console.log in tests unless DEBUG=true
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Global test timeout
jest.setTimeout(10000);

// Type declaration for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledBefore(expected: jest.Mock): R;
    }
  }
}

export {};
