/// <reference lib="deno.ns" />
// matchmaking/index.ts
import { serve } from "std/http/server.ts";
import { handleAuthenticatedRequest } from "../_shared/auth-utils.ts";
import {
  handleCreateMatch,
  handleJoinQueue,
  handleLeaveQueue,
  handleCheckMatchmakingStatus,
} from "../_shared/matchmaking-handlers.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { createLogger } from "../_shared/logger.ts";

// Create a logger for this module
const logger = createLogger("MATCHMAKING");

// Define routes for matchmaking operations
const matchmakingRouter = createRouter([
  defineRoute("createMatch", handleCreateMatch),
  defineRoute("joinQueue", handleJoinQueue),
  defineRoute("leaveQueue", handleLeaveQueue),
  defineRoute("checkStatus", handleCheckMatchmakingStatus),
]);

// Main serve function
serve(async (req) => {
  logger.info(`Received request: ${req.method} ${new URL(req.url).pathname}`);

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await matchmakingRouter(user, body, supabase);
  });
});
