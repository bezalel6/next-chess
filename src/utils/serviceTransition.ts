/**
 * This utility file helps with the transition from direct database services to edge function services
 * It can be used to toggle between the old and new services, making it easier to gradually roll out
 * the secure services while maintaining the ability to quickly revert if needed.
 */

import { GameService } from "@/services/gameService";
import { SecureGameService } from "@/services/secureGameService";
import { MatchmakingService } from "@/services/matchmakingService";
import { SecureMatchmakingService } from "@/services/secureMatchmakingService";

// Feature flags to control which service implementation to use
const FEATURES = {
  useSecureGameService: true,
  useSecureMatchmakingService: true,
};

/**
 * Returns either the secure or legacy game service based on feature flags
 */
export const getGameService = () => {
  return FEATURES.useSecureGameService ? SecureGameService : GameService;
};

/**
 * Returns either the secure or legacy matchmaking service based on feature flags
 */
export const getMatchmakingService = () => {
  return FEATURES.useSecureMatchmakingService
    ? SecureMatchmakingService
    : MatchmakingService;
};

/**
 * Sets the feature flags to use secure services
 */
export const enableSecureServices = () => {
  FEATURES.useSecureGameService = true;
  FEATURES.useSecureMatchmakingService = true;
};

/**
 * Sets the feature flags to use legacy services
 */
export const disableSecureServices = () => {
  FEATURES.useSecureGameService = false;
  FEATURES.useSecureMatchmakingService = false;
};

/**
 * Logs the current service configuration
 */
export const logServiceConfiguration = () => {
  console.log("Current Service Configuration:");
  console.log(
    `- Game Service: ${FEATURES.useSecureGameService ? "Secure" : "Legacy"}`,
  );
  console.log(
    `- Matchmaking Service: ${FEATURES.useSecureMatchmakingService ? "Secure" : "Legacy"}`,
  );
};
