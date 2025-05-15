/// <reference lib="deno.ns" />
import { serve } from "std/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
  initSupabaseAdmin,
} from "../_shared/auth-utils.ts";
import {
  handleMakeMove,
  handleBanMove,
  handleGameOffer,
  handleResignation,
  handleMushroomGrowth,
} from "../_shared/game-handlers.ts";
import {
  createGameFromMatchedPlayers,
  processMatchmakingQueue,
} from "../_shared/db-trigger-handlers.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";

// Create a logger for this module
const logger = createLogger("GAME-OPS");

// Define routes for game operations - admin routes have required role
const gameRouter = createRouter([
  defineRoute(
    "process-matches",
    async (user, params, supabase) => {
      return await processMatchmakingQueue(supabase);
    },
    "admin",
  ),

  defineRoute(
    "create-game-from-matched",
    async (user, params, supabase) => {
      logger.info("Creating game from matched players, source:", params.source);
      return await createGameFromMatchedPlayers(supabase);
    },
    "admin",
  ),

  defineRoute("makeMove", handleMakeMove),
  defineRoute("banMove", handleBanMove),

  // Draw offers
  defineRoute("offerDraw", async (user, params, supabase) => {
    return await handleGameOffer(user, params, supabase, "draw", "offer");
  }),

  defineRoute("acceptDraw", async (user, params, supabase) => {
    return await handleGameOffer(user, params, supabase, "draw", "accept");
  }),

  defineRoute("declineDraw", async (user, params, supabase) => {
    return await handleGameOffer(user, params, supabase, "draw", "decline");
  }),

  // Rematch offers
  defineRoute("offerRematch", async (user, params, supabase) => {
    return await handleGameOffer(user, params, supabase, "rematch", "offer");
  }),

  defineRoute("acceptRematch", async (user, params, supabase) => {
    return await handleGameOffer(user, params, supabase, "rematch", "accept");
  }),

  defineRoute("declineRematch", async (user, params, supabase) => {
    return await handleGameOffer(user, params, supabase, "rematch", "decline");
  }),

  // Resignation
  defineRoute("resign", handleResignation),

  // Special functions
  defineRoute("mushroomGrowth", handleMushroomGrowth),
]);

// CRON job access handler
async function handleCronRequest(req: Request) {
  logger.info("Processing matchmaking queue from CRON job");

  try {
    const supabaseAdmin = initSupabaseAdmin();
    return await processMatchmakingQueue(supabaseAdmin);
  } catch (error) {
    logger.error("Error in cron handler:", error);
    return errorResponse(error.message, 500);
  }
}

// Main serve function
serve(async (req) => {
  // Extract request path
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  logger.info(`Received request: ${req.method} ${url.pathname}`);

  // Special handling for CRON jobs (authenticated by Supabase platform)
  if (
    path === "process-matches" &&
    req.headers.get("Authorization") === `Bearer ${Deno.env.get("CRON_SECRET")}`
  ) {
    return await handleCronRequest(req);
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await gameRouter(user, body, supabase);
  });
});
