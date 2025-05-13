/**
 * This file exports secure services for the application
 */

import { SecureGameService } from "@/services/secureGameService";
import { SecureMatchmakingService } from "@/services/secureMatchmakingService";

/**
 * Exports the secure game service
 */
export const gameService = SecureGameService;

/**
 * Exports the secure matchmaking service
 */
export const matchmakingService = SecureMatchmakingService;
