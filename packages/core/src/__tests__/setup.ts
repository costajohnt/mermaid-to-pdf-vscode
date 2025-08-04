/**
 * Test setup file for Jest
 */

// Increase timeout for browser operations
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Basic test to satisfy Jest requirement
describe('Test Setup', () => {
  it('should be configured', () => {
    expect(true).toBe(true);
  });
});