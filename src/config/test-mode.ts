// Test mode configuration
// This centralizes test mode detection

export const TEST_MODE = {
  // Check if test auth is enabled
  isEnabled: () => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // In browser, check for test mode indicator
      // This is set by Next.js at build time
      return process.env.NEXT_PUBLIC_USE_TEST_AUTH === 'true';
    }
    // On server, check the env var directly
    return process.env.NEXT_PUBLIC_USE_TEST_AUTH === 'true';
  }
};

// Make test mode status available globally in browser
if (typeof window !== 'undefined') {
  (window as any).__TEST_MODE__ = TEST_MODE.isEnabled();
}