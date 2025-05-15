/// <reference lib="deno.ns" />
// matchmaking/index.ts
import { serve } from "std/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
  initSupabaseAdmin,
} from "../_shared/auth-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";
import { dbQuery } from "../_shared/db-utils.ts";
import { validateRequired } from "../_shared/validation-utils.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

const logger = createLogger("MATCHMAKING");

// Define matchmaking operations
const matchmakingRouter = createRouter([
  // Join matchmaking queue
  defineRoute("joinQueue", async (user, params, supabase) => {
    return await handleJoinQueue(user, supabase);
  }),

  // Leave matchmaking queue
  defineRoute("leaveQueue", async (user, params, supabase) => {
    return await handleLeaveQueue(user, supabase);
  }),

  // Check queue status
  defineRoute("checkStatus", async (user, params, supabase) => {
    return await checkQueueStatus(user, supabase);
  }),
]);

/**
 * Handle join queue operation
 */
async function handleJoinQueue(user: User, supabase: SupabaseClient) {
  try {
    // Check if user already has an active game
    const { data: activeGame } = await dbQuery(supabase, "games", "select", {
      select: "id",
      match: {
        status: "active",
        or: `white_player_id.eq.${user.id},black_player_id.eq.${user.id}`,
      },
      limit: 1,
      operation: "check active game",
    });

    if (activeGame?.length > 0) {
      return errorResponse("User already has an active game", 400);
    }

    // Check if already in queue
    const { data: existingEntry } = await dbQuery(
      supabase,
      "matchmaking",
      "select",
      {
        select: "*",
        match: { player_id: user.id },
        single: true,
        operation: "check existing entry",
      },
    );

    // If already in queue, return current state
    if (existingEntry) {
      if (existingEntry.status === "matched" && existingEntry.game_id) {
        // Get matched game info
        const { data: game } = await dbQuery(supabase, "games", "select", {
          select: "*",
          match: {
            id: existingEntry.game_id,
          },
          single: true,
          operation: "get matched game",
        });

        if (game) {
          return successResponse({
            matchFound: true,
            game,
          });
        }
      }

      return successResponse({
        status: existingEntry.status,
        joinedAt: existingEntry.joined_at,
      });
    }

    // Add to matchmaking queue
    const { data: queueEntry, error } = await dbQuery(
      supabase,
      "matchmaking",
      "insert",
      {
        data: {
          player_id: user.id,
          status: "waiting",
          preferences: {},
        },
        select: "*",
        single: true,
        operation: "join queue",
      },
    );

    if (error) {
      return errorResponse(`Failed to join queue: ${error.message}`, 500);
    }

    // Try to find a match immediately by calling the match_players function
    try {
      // Direct call to RPC function
      await supabase.rpc("match_players");
    } catch (rpcError) {
      logger.warn(`Error calling match_players: ${rpcError.message}`);
      // Non-critical error, continue
    }

    return successResponse({
      status: "waiting",
      joinedAt: queueEntry.joined_at,
    });
  } catch (error) {
    logger.error("Error joining queue:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handle leave queue operation
 */
async function handleLeaveQueue(user: User, supabase: SupabaseClient) {
  try {
    // Remove from matchmaking queue
    const { error } = await dbQuery(supabase, "matchmaking", "delete", {
      match: { player_id: user.id, status: "waiting" },
      operation: "leave queue",
    });

    if (error) {
      return errorResponse(`Failed to leave queue: ${error.message}`, 500);
    }

    return successResponse({ success: true });
  } catch (error) {
    logger.error("Error leaving queue:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Check queue status
 */
async function checkQueueStatus(user: User, supabase: SupabaseClient) {
  try {
    // Check current matchmaking status
    const { data: entry } = await dbQuery(supabase, "matchmaking", "select", {
      select: "*",
      match: { player_id: user.id },
      single: true,
      operation: "check status",
    });

    if (!entry) {
      return successResponse({ inQueue: false });
    }

    if (entry.status === "matched" && entry.game_id) {
      // Get matched game
      const { data: game } = await dbQuery(supabase, "games", "select", {
        select: "*",
        match: { id: entry.game_id },
        single: true,
        operation: "get matched game",
      });

      return successResponse({
        inQueue: true,
        status: "matched",
        matchFound: true,
        game,
      });
    }

    return successResponse({
      inQueue: true,
      status: entry.status,
      joinedAt: entry.joined_at,
    });
  } catch (error) {
    logger.error("Error checking queue status:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

// Main serve function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await matchmakingRouter(user, body, supabase);
  });
});
