import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Global teardown: Tests completed.');
  // Add any cleanup logic here if needed
  // For example, cleaning up test data, closing connections, etc.
}

export default globalTeardown;