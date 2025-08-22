/// <reference lib="deno.ns" />
// matchmaking/index.ts
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "std/http/server.ts";
import {
  corsHeaders,
  handleAuthenticatedRequest,
  initSupabaseAdmin,
} from "../_shared/auth-utils.ts";
import type { Tables } from "../_shared/database-types.ts";
import type { TypedSupabaseClient } from "../_shared/db-utils.ts";
import {
  formatOrConditions,
  getTable,
  logOperation,
} from "../_shared/db-utils.ts";
import { createLogger } from "../_shared/logger.ts";
import { errorResponse, successResponse } from "../_shared/response-utils.ts";
import { createRouter, defineRoute } from "../_shared/router-utils.ts";
import { INITIAL_FEN } from "../_shared/constants.ts";
import { getDefaultTimeControl } from "../_shared/time-control-utils.ts";

const logger = createLogger("MATCHMAKING");

// Type helpers for database tables
type GameRecord = Tables<"games">;
type MatchmakingRecord = Tables<"matchmaking">;

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
 * Gets default time control from the database
 * @deprecated Use getDefaultTimeControl from time-control-utils.ts instead
 */
async function getTimeControlFromDB(supabase: TypedSupabaseClient) {
  return await getDefaultTimeControl(supabase);
}

/**
 * Handle join queue operation
 */
async function handleJoinQueue(user: User, supabase: TypedSupabaseClient) {
  try {
    // Check if user already has an active game
    const { data: activeGames, error: activeGameError } = await getTable(
      supabase,
      "games",
    )
      .select("id")
      .eq("status", "active")
      .or(
        formatOrConditions([
          { white_player_id: user.id },
          { black_player_id: user.id },
        ]),
      )
      .limit(1);

    logOperation("check active game", activeGameError);

    if (activeGames && activeGames.length > 0) {
      return errorResponse("User already has an active game", 400);
    }

    // Check if already in queue
    const { data: existingEntry, error: existingEntryError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("*")
      .eq("player_id", user.id)
      .maybeSingle();

    logOperation("check existing entry", existingEntryError);

    // If already in queue, update last_online in profiles and return current state
    if (existingEntry) {
      // Update last_online timestamp in profiles
      await getTable(supabase, "profiles")
        .update({ last_online: new Date().toISOString() })
        .eq("id", user.id);
        
      return successResponse({
        status: existingEntry.status,
        joinedAt: existingEntry.joined_at,
      });
    }

    // Update last_online in profiles
    await getTable(supabase, "profiles")
      .update({ last_online: new Date().toISOString() })
      .eq("id", user.id);
    
    // Add to matchmaking queue
    const { data: queueEntry, error: queueError } = await getTable(
      supabase,
      "matchmaking",
    )
      .insert({
        player_id: user.id,
        status: "waiting",
        preferences: {}, // Empty preferences object (required by schema)
      })
      .select("*")
      .maybeSingle();

    logOperation("join queue", queueError);

    if (queueError) {
      return errorResponse(`Failed to join queue: ${queueError.message}`, 500);
    }

    if (!queueEntry) {
      return errorResponse("Failed to create queue entry", 500);
    }

    // Log the event
    await logEvent(supabase, {
      eventType: "queue_joined",
      entityType: "matchmaking",
      entityId: queueEntry.id,
      userId: user.id,
      data: {}, // No preferences data
    });

    // Try to find a match immediately
    await processMatchmakingQueue(supabase);

    // Check if the player was matched (they would no longer be in the queue if matched)
    const { data: updatedEntry, error: updatedEntryError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("*")
      .eq("player_id", user.id)
      .maybeSingle();

    logOperation("check updated entry", updatedEntryError);

    // If player is no longer in queue, check if they're in a game
    if (!updatedEntry) {
      const { data: game, error: gameError } = await getTable(supabase, "games")
        .select("*")
        .eq("status", "active")
        .or(
          formatOrConditions([
            { white_player_id: user.id },
            { black_player_id: user.id },
          ]),
        )
        .maybeSingle();

      logOperation("get active game", gameError);

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
async function handleLeaveQueue(user: User, supabase: TypedSupabaseClient) {
  try {
    // Find the user's queue entry first
    const { data: entry, error: entryError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("id")
      .eq("player_id", user.id)
      .eq("status", "waiting")
      .maybeSingle();

    logOperation("find queue entry", entryError);

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
    const { error: deleteError } = await getTable(supabase, "matchmaking")
      .delete()
      .eq("player_id", user.id)
      .eq("status", "waiting");

    logOperation("leave queue", deleteError);

    if (deleteError) {
      return errorResponse(
        `Failed to leave queue: ${deleteError.message}`,
        500,
      );
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
async function checkQueueStatus(user: User, supabase: TypedSupabaseClient) {
  try {
    // Check current matchmaking status
    const { data: entry, error: entryError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("*")
      .eq("player_id", user.id)
      .maybeSingle();

    logOperation("check status", entryError);

    if (!entry) {
      // Check if user is in an active game
      const { data: activeGame, error: gameError } = await getTable(
        supabase,
        "games",
      )
        .select("*")
        .eq("status", "active")
        .or(
          formatOrConditions([
            { white_player_id: user.id },
            { black_player_id: user.id },
          ]),
        )
        .maybeSingle();

      logOperation("check active game", gameError);

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
async function processMatchmakingQueue(supabase: TypedSupabaseClient) {
  try {
    // Log start of queue processing
    await debugLog(supabase, {
      eventType: "queue_processing_started",
      entityType: "matchmaking",
      entityId: "system",
    });

    // First, get stale users (offline for more than 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    
    const { data: staleProfiles, error: staleProfilesError } = await getTable(
      supabase,
      "profiles",
    )
      .select("id")
      .lt("last_online", oneMinuteAgo);
    
    if (staleProfiles && staleProfiles.length > 0) {
      // Remove stale entries from matchmaking
      const stalePlayerIds = staleProfiles.map(p => p.id);
      const { data: staleEntries, error: staleError } = await getTable(
        supabase,
        "matchmaking",
      )
        .delete()
        .eq("status", "waiting")
        .in("player_id", stalePlayerIds)
        .select("player_id");
      
      if (staleEntries && staleEntries.length > 0) {
        await debugLog(supabase, {
          eventType: "stale_entries_removed",
          entityType: "matchmaking",
          entityId: "system",
          data: {
            removedCount: staleEntries.length,
            removedPlayers: staleEntries.map(e => e.player_id),
          },
        });
        logger.info(`Removed ${staleEntries.length} stale queue entries`);
      }
    }

    // Find waiting players (ensure no duplicates)
    const { data: waitingPlayersRaw, error: waitingPlayersError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("player_id, joined_at")
      .eq("status", "waiting")
      .order("joined_at", { ascending: true })
      .limit(20);
    
// Deduplicate players (in case of DB issues)
    const seenPlayers = new Set<string>();
    const waitingPlayersDeduped = waitingPlayersRaw?.filter(p => {
      if (seenPlayers.has(p.player_id)) {
        logger.warn(`Duplicate player in queue: ${p.player_id}`);
        return false;
      }
      seenPlayers.add(p.player_id);
      return true;
    }) || [];

    // Filter by recent activity: last_online within the last 30 seconds (broadened from 10s)
    const recentThreshold = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: recentProfiles } = await getTable(supabase, "profiles")
      .select("id, last_online")
      .in("id", waitingPlayersDeduped.map(p => p.player_id));
    const recentSet = new Set((recentProfiles || [])
      .filter(p => p.last_online && p.last_online >= recentThreshold)
      .map(p => p.id));

    const waitingPlayers = waitingPlayersDeduped.filter(p => recentSet.has(p.player_id));

    logOperation("find online waiting players", waitingPlayersError);

    if (waitingPlayersError) {
      await debugLog(supabase, {
        eventType: "queue_processing_error",
        entityType: "matchmaking",
        entityId: "system",
        data: {
          error: waitingPlayersError.message,
          step: "find_waiting_players",
        },
      });
      return errorResponse(
        `Failed to find waiting players: ${waitingPlayersError.message}`,
        500,
      );
    }

    // Log number of waiting players found
    await debugLog(supabase, {
      eventType: "waiting_players_found",
      entityType: "matchmaking",
      entityId: "system",
      data: {
        count: waitingPlayers?.length || 0,
        playerIds: waitingPlayers?.map((p) => p.player_id) || [],
        lastOnlineTimes: [],
      },
    });

    // If we have at least 2 waiting players, create a game
    if (waitingPlayers && waitingPlayers.length >= 2) {
      // Choose the first two with recent activity
      const player1 = waitingPlayers[0].player_id;
      const player2 = waitingPlayers[1].player_id;
      
      // CRITICAL: Never match a player with themselves
      if (player1 === player2) {
        logger.error(`CRITICAL: Attempted to match player with themselves: ${player1}`);
        await debugLog(supabase, {
          eventType: "self_match_prevented",
          entityType: "matchmaking",
          entityId: "system",
          data: {
            player_id: player1,
            queue_state: waitingPlayers,
          },
        });
        
        return successResponse({
          matchCreated: false,
          waitingPlayerCount: waitingPlayers.length,
          reason: "self_match_prevented",
        });
      }

      // Log match attempt - entityId will be set after game creation
      await debugLog(supabase, {
        eventType: "match_attempt_started",
        entityType: "matchmaking",
        entityId: "pending",
        data: {
          player1,
          player2,
        },
      });

      // Get time control from database
      const timeControl = await getDefaultTimeControl(supabase);

      // Log time control retrieved
      await debugLog(supabase, {
        eventType: "time_control_retrieved",
        entityType: "matchmaking",
        entityId: "pending",
        data: { timeControl },
      });

      // Create a new game with dynamic time control
      const { data: game, error: gameError } = await getTable(supabase, "games")
        .insert({
          white_player_id: player1,
          black_player_id: player2,
          status: "active",
          current_fen: INITIAL_FEN,
          pgn: "",
          turn: "white",
          banning_player: "black",
          time_control: {
            initial_time: timeControl.initialTime,
            increment: timeControl.increment,
          },
          white_time_remaining: timeControl.initialTime,
          black_time_remaining: timeControl.initialTime,
        })
        .select("*")
        .maybeSingle();

      logOperation("create game", gameError);

      if (gameError) {
        await debugLog(supabase, {
          eventType: "game_creation_failed",
          entityType: "matchmaking",
          entityId: "pending",
          data: {
            error: gameError.message,
            player1,
            player2,
          },
        });
        return errorResponse(
          `Failed to create game: ${gameError.message}`,
          500,
        );
      }

      if (!game) {
        await debugLog(supabase, {
          eventType: "game_creation_failed",
          entityType: "matchmaking",
          entityId: "pending",
          data: {
            error: "No game returned from insert",
            player1,
            player2,
          },
        });
        return errorResponse("Failed to create game", 500);
      }

      // Log successful game creation
      await debugLog(supabase, {
        eventType: "game_created_successfully",
        entityType: "game",
        entityId: game.id,
        data: {
          white_player_id: player1,
          black_player_id: player2,
          timeControl,
        },
      });

      const { error } = await getTable(supabase, "matchmaking")
        .delete()
        .in("player_id", [player1, player2]);

      logOperation("remove both players from queue", error);

      if (error) {
        await debugLog(supabase, {
          eventType: "queue_cleanup_failed",
          entityType: "matchmaking",
          entityId: game.id,
          data: {
            error: error.message,
            player1,
            player2,
          },
        });
        return errorResponse(
          `Failed to remove players from matchmaking queue: ${error.message}`,
          500,
        );
      }

      // Log successful queue cleanup
      await debugLog(supabase, {
        eventType: "queue_cleanup_successful",
        entityType: "matchmaking",
        entityId: game.id,
        data: {
          removedPlayers: [player1, player2],
        },
      });

      // Log the event
      await logEvent(supabase, {
        eventType: "players_matched",
        entityType: "game",
        entityId: game.id,
        data: {
          white_player_id: player1,
          black_player_id: player2,
        },
      });

      // Notify the game update (replacing the database notify function)
      try {
        const notifySuccess = await notifyGameChange(supabase, game);
        await debugLog(supabase, {
          eventType: "notification_attempt",
          entityType: "game",
entityId: game.id,
          data: {
            success: notifySuccess,
            white_player_id: player1,
            black_player_id: player2,
          },
        });
      } catch (notifyError) {
        logger.warn(`Failed to notify game change: ${notifyError.message}`);
        await debugLog(supabase, {
          eventType: "notification_failed",
          entityType: "game",
          entityId: gameId,
          data: {
            error: notifyError.message,
            white_player_id: player1,
            black_player_id: player2,
          },
        });
      }

      logger.info(
        `Created game ${game.id} for players ${player1} and ${player2}`,
      );

      // Log successful completion
      await debugLog(supabase, {
        eventType: "queue_processing_completed",
        entityType: "matchmaking",
        entityId: game.id,
        data: {
          matchCreated: true,
          gameId: game.id,
          white_player_id: player1,
          black_player_id: player2,
        },
      });

      return successResponse({
        matchCreated: true,
        gameId: game.id,
        whitePlacerId: player1,
        blackPlayerId: player2,
      });
    }

    // Log when not enough players are found
    await debugLog(supabase, {
      eventType: "queue_processing_completed",
      entityType: "matchmaking",
      entityId: "system",
      data: {
        matchCreated: false,
        waitingPlayerCount: waitingPlayers?.length || 0,
        reason: "insufficient_players",
      },
    });

    return successResponse({
      matchCreated: false,
      waitingPlayerCount: waitingPlayers?.length || 0,
    });
  } catch (error) {
    logger.error("Error processing matchmaking queue:", error);

    // Log unexpected errors
    await debugLog(supabase, {
      eventType: "queue_processing_error",
      entityType: "matchmaking",
      entityId: "system",
      data: {
        error: error.message,
        step: "unexpected_error",
        stack: error.stack,
      },
    });

    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Notify game changes via Supabase realtime
 * This replaces the database notify function
 */
async function notifyGameChange(
  supabase: TypedSupabaseClient,
  game: GameRecord,
) {
  async function send(uid: string) {
    const channel = supabase.channel(`player:${uid}`);
    return await channel.send({
      type: "broadcast",
      event: "game_matched",
      payload: {
        gameId: game.id,
        isWhite: game.white_player_id === uid,
        opponentId:
          uid === game.black_player_id
            ? game.white_player_id
            : game.black_player_id,
      },
    });
  }
  try {
    logger.info(`Game update notification: ${game.id}`);
    await Promise.all([send(game.white_player_id), send(game.black_player_id)]);
    return true;
  } catch (error) {
    logger.warn(`Failed to notify game change: ${error.message}`);
    return false;
  }
}

/**
 * Helper function to log events conditionally based on DEBUG_MATCHMAKING environment variable
 */
async function debugLog(
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
  if (Deno.env.get("DEBUG_MATCHMAKING")) {
    await logEvent(supabase, {
      eventType,
      entityType,
      entityId,
      userId,
      data,
    });
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
