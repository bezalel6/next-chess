// Test mode configuration
// This centralizes test mode detection

export const TEST_MODE = {
  // Check if test auth is enabled
  isEnabled: () => {
    // On server, check the env var directly
    return process.env.NEXT_PUBLIC_USE_TEST_AUTH === 'true';
  }
};

// Make test mode status available globally in browser
if (typeof window !== 'undefined') {
  (window as any).__TEST_MODE__ = TEST_MODE.isEnabled();
}