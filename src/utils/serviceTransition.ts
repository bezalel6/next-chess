/**
 * This file exports secure services for the application
 */

import { SecureGameService } from "@/services/secureGameService";
import { SecureMatchmakingService } from "@/services/secureMatchmakingService";
import { testMatchmaking } from "./testMatchmaking";

/**
 * Exports the secure game service
 */
export const gameService = SecureGameService;

/**
 * Exports the secure matchmaking service
 */
export const matchmakingService = SecureMatchmakingService;

// Add to window in development for testing
if (process.env.NODE_ENV === "development") {
  if (typeof window !== "undefined") {
    (window as any).testMatchmaking = testMatchmaking;
  }
}

// Include with other exports
export { testMatchmaking };
