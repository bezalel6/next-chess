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
import { validateWithZod, Schemas } from "../_shared/validation-utils.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";
import type { Database, Tables } from "../_shared/database-types.ts";

const logger = createLogger("MATCHMAKING");

// Type helpers for database tables
type GameRecord = Tables<"games">;
type MatchmakingRecord = Tables<"matchmaking">;

// Helper function to ensure single result (not array)
function ensureSingle<T>(data: T | T[] | undefined): T | undefined {
  if (!data) return undefined;
  return Array.isArray(data) ? data[0] : data;
}

// Matchmaking-specific schemas
const MatchmakingSchemas = {
  QueueParams: z.object({
    preferences: z.record(z.any()).optional(),
  }),
  CheckStatusParams: z.object({
    queueId: z.string().uuid().optional(),
  }),
};

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

  // Process queue - admin only
  defineRoute(
    "processQueue",
    async (user, params, supabase) => {
      return await processMatchmakingQueue(supabase);
    },
    "service_role",
  ),
]);

/**
 * Generate a random short ID for games
 */
function generateShortId(length = 8): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }

  return result;
}

/**
 * Handle join queue operation
 */
async function handleJoinQueue(user: User, supabase: SupabaseClient<Database>) {
  try {
    // Check if user already has an active game
    const { data: activeGame } = await dbQuery<"games", GameRecord>(
      supabase,
      "games",
      "select",
      {
        select: "id",
        match: {
          status: "active",
          _or: [{ white_player_id: user.id }, { black_player_id: user.id }],
        },
        limit: 1,
        operation: "check active game",
      },
    );

    if (activeGame && Array.isArray(activeGame) && activeGame.length > 0) {
      return errorResponse("User already has an active game", 400);
    }

    // Check if already in queue
    const { data: existingEntryData } = await dbQuery<
      "matchmaking",
      MatchmakingRecord
    >(supabase, "matchmaking", "select", {
      select: "*",
      match: { player_id: user.id },
      single: true,
      operation: "check existing entry",
    });

    // Get single item from result and ensure it's not an array
    const existingEntry = ensureSingle(existingEntryData);

    // If already in queue, return current state
    if (existingEntry) {
      return successResponse({
        status: existingEntry.status,
        joinedAt: existingEntry.joined_at,
      });
    }

    // Add to matchmaking queue
    const { data: queueEntryData, error } = await dbQuery<
      "matchmaking",
      MatchmakingRecord
    >(supabase, "matchmaking", "insert", {
      data: {
        player_id: user.id,
        status: "waiting",
        preferences: {},
      },
      select: "*",
      single: true,
      operation: "join queue",
    });

    if (error) {
      return errorResponse(`Failed to join queue: ${error.message}`, 500);
    }

    // Ensure queueEntry is a single object
    const queueEntry = ensureSingle(queueEntryData);
    if (!queueEntry) {
      return errorResponse("Failed to create queue entry", 500);
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "queue_joined",
      entityType: "matchmaking",
      entityId: queueEntry.id,
      userId: user.id,
      data: { preferences: queueEntry.preferences },
    });

    // Try to find a match immediately
    await processMatchmakingQueue(supabase);

    // Check if the player was matched (they would no longer be in the queue if matched)
    const { data: updatedEntryData } = await dbQuery<
      "matchmaking",
      MatchmakingRecord
    >(supabase, "matchmaking", "select", {
      select: "*",
      match: { player_id: user.id },
      single: true,
      operation: "check updated entry",
    });

    const updatedEntry = ensureSingle(updatedEntryData);

    // If player is no longer in queue, check if they're in a game
    if (!updatedEntry) {
      const { data: gameData } = await dbQuery<"games", GameRecord>(
        supabase,
        "games",
        "select",
        {
          select: "*",
          match: {
            status: "active",
            _or: [{ white_player_id: user.id }, { black_player_id: user.id }],
          },
          single: true,
          operation: "get active game",
        },
      );

      const game = ensureSingle(gameData);
      if (game) {
        return successResponse({
          matchFound: true,
          game,
        });
      }
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
async function handleLeaveQueue(
  user: User,
  supabase: SupabaseClient<Database>,
) {
  try {
    // Find the user's queue entry first
    const { data: entryData } = await dbQuery<"matchmaking", MatchmakingRecord>(
      supabase,
      "matchmaking",
      "select",
      {
        select: "id",
        match: { player_id: user.id, status: "waiting" },
        single: true,
        operation: "find queue entry",
      },
    );

    const entry = ensureSingle(entryData);
    if (entry) {
      // Log the event
      await logEvent(supabase, {
        eventType: "queue_left",
        entityType: "matchmaking",
        entityId: entry.id,
        userId: user.id,
      });
    }

    // Remove from matchmaking queue
    const { error } = await dbQuery<"matchmaking">(
      supabase,
      "matchmaking",
      "delete",
      {
        match: { player_id: user.id, status: "waiting" },
        operation: "leave queue",
      },
    );

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
async function checkQueueStatus(
  user: User,
  supabase: SupabaseClient<Database>,
) {
  try {
    // Check current matchmaking status
    const { data: entryData } = await dbQuery<"matchmaking", MatchmakingRecord>(
      supabase,
      "matchmaking",
      "select",
      {
        select: "*",
        match: { player_id: user.id },
        single: true,
        operation: "check status",
      },
    );

    const entry = ensureSingle(entryData);
    if (!entry) {
      // Check if user is in an active game
      const { data: activeGameData } = await dbQuery<"games", GameRecord>(
        supabase,
        "games",
        "select",
        {
          select: "*",
          match: {
            status: "active",
            _or: [{ white_player_id: user.id }, { black_player_id: user.id }],
          },
          single: true,
          operation: "check active game",
        },
      );

      const activeGame = ensureSingle(activeGameData);
      if (activeGame) {
        return successResponse({
          inQueue: false,
          activeGame: true,
          game: activeGame,
        });
      }

      return successResponse({ inQueue: false });
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

/**
 * Process the matchmaking queue to match players
 * This replaces the database trigger function
 */
async function processMatchmakingQueue(supabase: SupabaseClient<Database>) {
  try {
    // Find waiting players
    const { data: waitingPlayers, error } = await dbQuery<
      "matchmaking",
      MatchmakingRecord
    >(supabase, "matchmaking", "select", {
      select: "player_id",
      match: { status: "waiting" },
      order: { column: "joined_at", ascending: true },
      limit: 2,
      operation: "find waiting players",
    });

    if (error) {
      return errorResponse(
        `Failed to find waiting players: ${error.message}`,
        500,
      );
    }

    // If we have at least 2 waiting players, create a game
    if (
      waitingPlayers &&
      Array.isArray(waitingPlayers) &&
      waitingPlayers.length >= 2
    ) {
      const player1 = waitingPlayers[0].player_id;
      const player2 = waitingPlayers[1].player_id;

      // Generate a unique game ID
      const gameId = generateShortId();

      // Create a new game
      const { data: gameData, error: gameError } = await dbQuery<
        "games",
        GameRecord
      >(supabase, "games", "insert", {
        data: {
          id: gameId,
          white_player_id: player1,
          black_player_id: player2,
          status: "active",
          current_fen:
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          pgn: "",
          turn: "white",
          banning_player: "black",
        },
        select: "*",
        single: true,
        operation: "create game",
      });

      if (gameError) {
        return errorResponse(
          `Failed to create game: ${gameError.message}`,
          500,
        );
      }

      // Ensure game is a single object
      const game = ensureSingle(gameData);
      if (!game) {
        return errorResponse("Failed to create game", 500);
      }

      // Remove first player from the matchmaking queue
      const { error: deleteError } = await dbQuery<"matchmaking">(
        supabase,
        "matchmaking",
        "delete",
        {
          match: {
            player_id: player1,
          },
          operation: "remove first player from queue",
        },
      );

      if (deleteError) {
        return errorResponse(
          `Failed to remove first player from matchmaking queue: ${deleteError.message}`,
          500,
        );
      }

      // Remove second player from the matchmaking queue
      const { error: deleteError2 } = await dbQuery<"matchmaking">(
        supabase,
        "matchmaking",
        "delete",
        {
          match: {
            player_id: player2,
          },
          operation: "remove second player from queue",
        },
      );

      if (deleteError2) {
        return errorResponse(
          `Failed to remove second player from matchmaking queue: ${deleteError2.message}`,
          500,
        );
      }

      // Log the event
      await logEvent(supabase, {
        eventType: "players_matched",
        entityType: "game",
        entityId: gameId,
        data: {
          white_player_id: player1,
          black_player_id: player2,
        },
      });

      // Notify the game update (replacing the database notify function)
      try {
        await notifyGameChange(supabase, game);
      } catch (notifyError) {
        logger.warn(`Failed to notify game change: ${notifyError.message}`);
      }

      logger.info(
        `Created game ${gameId} for players ${player1} and ${player2}`,
      );

      return successResponse({
        matchCreated: true,
        gameId,
        whitePlacerId: player1,
        blackPlayerId: player2,
      });
    }

    return successResponse({
      matchCreated: false,
      waitingPlayerCount:
        waitingPlayers && Array.isArray(waitingPlayers)
          ? waitingPlayers.length
          : 0,
    });
  } catch (error) {
    logger.error("Error processing matchmaking queue:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Notify game changes via Supabase realtime
 * This replaces the database notify function
 */
async function notifyGameChange(
  supabase: SupabaseClient<Database>,
  game: GameRecord,
) {
  try {
    // Use Supabase's broadcast feature to notify clients
    // This is a simplified version - in a real app, you'd use a more robust
    // approach like a dedicated notification channel

    // For now, we'll just log the notification
    logger.info(`Game update notification: ${game.id}`);

    // In a real implementation, you might use something like:
    // await supabase.from('notifications').insert({
    //   type: 'game_update',
    //   recipient_id: game.white_player_id,
    //   data: { game_id: game.id, status: game.status }
    // });

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
  supabase: SupabaseClient<Database>,
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
    await dbQuery<"event_log">(supabase, "event_log", "insert", {
      data: {
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        data: data || {},
      },
      operation: "log event",
    });
  } catch (error) {
    logger.warn(`Failed to log event ${eventType}:`, error);
  }
}

// Main serve function
serve(async (req) => {
  // Extract request path
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // Special handling for CRON jobs (authenticated by Supabase platform)
  if (
    path === "process-queue" &&
    req.headers.get("Authorization") === `Bearer ${Deno.env.get("CRON_SECRET")}`
  ) {
    try {
      const supabaseAdmin = initSupabaseAdmin();
      return await processMatchmakingQueue(supabaseAdmin);
    } catch (error) {
      logger.error("Error in cron handler:", error);
      return errorResponse(error.message, 500);
    }
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    return await matchmakingRouter(user, body, supabase);
  });
});
