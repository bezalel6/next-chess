module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.e2e.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testTimeout: 60000, // 60 seconds for E2E tests
  maxWorkers: 1, // Run tests sequentially for E2E
};