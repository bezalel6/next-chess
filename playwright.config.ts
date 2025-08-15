import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration with enhanced cleanup and resource management
 */
export default defineConfig({
  testDir: './tests',
  
  // Fail fast on CI to prevent hanging processes
  fullyParallel: false, // Run tests sequentially to prevent resource conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Limit retries to prevent process accumulation
  workers: 1, // Single worker to prevent multiple browser instances
  
  // Reporter configuration
  reporter: [
    ['html'],
    ['line'],
    ['json', { outputFile: 'test-results.json' }],
  ],
  
  // Global timeout settings
  timeout: 30000, // 30 seconds per test
  globalTimeout: 600000, // 10 minutes total
  
  use: {
    // Base URL for testing
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace on failure for debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Strict timeout enforcement
    actionTimeout: 10000, // 10 seconds for any action
    navigationTimeout: 20000, // 20 seconds for navigation
  },

  // Project configuration for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
          // Force close browser on context close
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'dom.ipc.processCount': 1,
            'dom.max_script_run_time': 10,
          },
        },
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    timeout: 120000, // 2 minutes to start
    reuseExistingServer: !process.env.CI,
    // Kill the server on exit
    killOnExit: true,
  },

  // Global setup and teardown
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});