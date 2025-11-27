/**
 * Jest setup file
 * Runs once before all tests in the suite (via setupFilesAfterEnv)
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Increase timeout for async operations
jest.setTimeout(30000);

// Global beforeAll/afterAll hooks if needed
beforeAll(async () => {
  // Setup code that runs once before all tests
});

afterAll(async () => {
  // Cleanup code that runs once after all tests
});
