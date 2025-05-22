/**
 * Shared constants for Edge Functions
 *
 * IMPORTANT: These values must match the client-side constants in:
 * src/constants/timeControl.ts
 */

// Default time control configuration
export const DEFAULT_TIME_CONTROL = {
  initialTime: 1.5 * 60 * 1000, // Time in milliseconds
  increment: 0, // Increment in milliseconds
};

// Initial FEN string for a new chess game
export const INITIAL_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Export individual time control constants for convenience
export const DEFAULT_INITIAL_TIME = DEFAULT_TIME_CONTROL.initialTime;
export const DEFAULT_INCREMENT = DEFAULT_TIME_CONTROL.increment;
