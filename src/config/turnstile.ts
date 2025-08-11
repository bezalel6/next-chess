// Turnstile configuration
// This file centralizes Turnstile configuration to ensure it works in all environments
import { TEST_MODE } from './test-mode';

export const TURNSTILE_CONFIG = {
  // Site key should be set via environment variable NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // This is replaced at build time by Next.js
  siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAABqaOP-v_GdBeTg0',
  
  // Check if test mode is active
  isTestMode: () => {
    return TEST_MODE.isEnabled();
  },
  
  // Check if Turnstile widget should be shown (not in test mode and has key)
  isEnabled: () => {
    // Skip Turnstile entirely in test mode
    if (TURNSTILE_CONFIG.isTestMode()) {
      return false;
    }
    const key = TURNSTILE_CONFIG.siteKey;
    return !!(key && key !== '' && key !== 'undefined');
  },
  
  // Check if captcha is required for form submission
  isRequired: () => {
    // Never required in test mode
    return !TURNSTILE_CONFIG.isTestMode() && TURNSTILE_CONFIG.isEnabled();
  },
  
  // Widget options
  options: {
    theme: 'dark' as const,
    size: 'invisible' as const,
    appearance: 'execute' as const,
    execution: 'render' as const,
    retry: 'auto' as const,
    refreshExpired: 'auto' as const,
  }
};

// Log configuration status (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Turnstile config:', {
    siteKey: TURNSTILE_CONFIG.siteKey ? `${TURNSTILE_CONFIG.siteKey.substring(0, 10)}...` : 'not configured',
    isEnabled: TURNSTILE_CONFIG.isEnabled()
  });
}