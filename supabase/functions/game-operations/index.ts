/// <reference lib="deno.ns" />
import { serve } from "std/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
  initSupabaseAdmin,
} from "../_shared/auth-utils.ts";
import { handleGameOperation } from "../_shared/game-handlers.ts";
import {
  createGameFromMatchedPlayers,
  processMatchmakingQueue,
} from "../_shared/db-trigger-handlers.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";
import { validateWithZod } from "../_shared/validation-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { uuidSchema } from "./../_shared/validation-utils.ts";
import { ensureSingle, logOperation, getTable } from "../_shared/db-utils.ts";
import type { TypedSupabaseClient } from "../_shared/db-utils.ts";

// Create a logger for this module
const logger = createLogger("GAME-OPS");

// Game operations schemas
const GameOpsSchemas = {
  NotifyUpdateParams: z.object({
    gameId: uuidSchema,
  }),
};

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

  // Game notification route - admin only
  defineRoute(
    "notify-game-update",
    async (user, params, supabase) => {
      return await notifyGameUpdate(params, supabase);
    },
    "service_role",
  ),


  // Game operation routes using unified handler
  defineRoute("makeMove", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "makeMove",
    );

    // After successful operation, notify game update
    if (result.status === 200 && params.gameId) {
      try {
        await notifyGameChange(supabase, params.gameId);
      } catch (error) {
        logger.warn(`Failed to notify game change: ${error.message}`);
      }
    }

    return result;
  }),

  defineRoute("banMove", async (user, params, supabase) => {
    const result = await handleGameOperation(user, params, supabase, "banMove");
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("offerDraw", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "offerDraw",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("acceptDraw", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "acceptDraw",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("declineDraw", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "declineDraw",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("offerRematch", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "offerRematch",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("acceptRematch", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "acceptRematch",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("declineRematch", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "declineRematch",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("resign", async (user, params, supabase) => {
    const result = await handleGameOperation(user, params, supabase, "resign");
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),

  defineRoute("mushroomGrowth", async (user, params, supabase) => {
    const result = await handleGameOperation(
      user,
      params,
      supabase,
      "mushroomGrowth",
    );
    if (result.status === 200 && params.gameId) {
      await notifyGameChange(supabase, params.gameId);
    }
    return result;
  }),
]);



/**
 * Handles game update notifications
 */
async function notifyGameUpdate(params: any, supabase: TypedSupabaseClient) {
  try {
    // Validate parameters using Zod
    const validation = validateWithZod(
      params,
      GameOpsSchemas.NotifyUpdateParams,
    );
    if (!validation.valid) {
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const { gameId } = params;

    await notifyGameChange(supabase, gameId);

    return successResponse({ success: true });
  } catch (error) {
    logger.error("Error notifying game update:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Notify game changes via Supabase realtime
 * This replaces the database notify function
 */
async function notifyGameChange(supabase: TypedSupabaseClient, gameId: string) {
  try {
    // Fetch the game data
    const { data: game, error: gameError } = await getTable(supabase, "games")
      .select("*")
      .eq("id", gameId)
      .maybeSingle();

    logOperation("get game for notification", gameError);

    if (!game) {
      logger.warn(`Game not found for notification: ${gameId}`);
      return false;
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "game_updated",
      entityType: "game",
      entityId: gameId,
      data: {
        status: game.status,
        turn: game.turn,
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
        draw_offered_by: (game as any).draw_offered_by ?? (game as any).drawOfferedBy ?? null,
        result: game.result,
        end_reason: (game as any).end_reason ?? (game as any).endReason ?? null,
      },
    });

    // Broadcast realtime update so both clients get the change immediately
    const channel = supabase.channel(`game:${gameId}:unified`);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: game,
    });

    logger.info(`Broadcasted game_update for ${gameId}`);
    return true;
  } catch (error) {
    logger.warn(`Failed to notify game change: ${error.message}`);
    return false;
  }
}

/**
 * Helper function to log events
 */
async function logEvent(
  supabase: TypedSupabaseClient,
  {
    eventType,
    entityType,
    entityId,
    userId,
    data,
  }: {
    eventType: string;
    entityType: string;
    entityId: string;
    userId?: string;
    data?: Record<string, any>;
  },
) {
  try {
    await getTable(supabase, "event_log").insert({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      data: data || {},
    });

    logOperation("log event");
  } catch (error) {
    logger.warn(`Failed to log event ${eventType}:`, error);
  }
}

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
