/**
 * Time control constants
 *
 * IMPORTANT: These values must match the default values in:
 * 1. Server-side functions (supabase/functions/_shared/constants.ts)
 * 2. Database migrations
 */

// Default time control configuration
export const DEFAULT_TIME_CONTROL = {
  // Time in milliseconds
  initialTime: 1.5 * 60 * 1000,
  // Increment in milliseconds
  increment: 0,
};

// Export individual constants for convenience
export const DEFAULT_INITIAL_TIME = DEFAULT_TIME_CONTROL.initialTime;
export const DEFAULT_INCREMENT = DEFAULT_TIME_CONTROL.increment;
