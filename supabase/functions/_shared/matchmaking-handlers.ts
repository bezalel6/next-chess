/// <reference lib="deno.ns" />
import { successResponse, errorResponse } from "./response-utils.ts";
import { createLogger } from "./logger.ts";
import { validateWithZod, Schemas } from "./validation-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { uuidSchema } from "./validation-utils.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { getTable, logOperation, ensureSingle } from "./db-utils.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";
import { INITIAL_FEN } from "./constants.ts";
import { getDefaultTimeControl, toJson } from "./time-control-utils.ts";
import type { Json } from "https://esm.sh/@supabase/postgrest-js@1.19.4/dist/cjs/select-query-parser/types.d.ts";

const logger = createLogger("MATCHMAKING");

interface CreateMatchParams {
  player1Id: string;
  player2Id: string;
}

interface QueueParams {
  // Add any queue-specific parameters if needed
  preferences?: Record<string, any>;
}

// Define Zod schemas for matchmaking
const MatchmakingSchemas = {
  CreateMatchParams: z.object({
    player1Id: uuidSchema,
    player2Id: uuidSchema,
  }),
};

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
 * Gets default time control from the database
 * @deprecated Use getDefaultTimeControl from time-control-utils.ts instead
 */
async function getTimeControlFromDB(supabase: TypedSupabaseClient) {
  return await getDefaultTimeControl(supabase);
}

/**
 * Handles creating a new match
 */
export async function handleCreateMatch(
  user: User,
  params: CreateMatchParams,
  supabase: TypedSupabaseClient,
): Promise<Response> {
  try {
    logger.info(
      `User ${user.id} attempting to create match with params:`,
      params,
    );

    // Validate required parameters using Zod
    const validation = validateWithZod(
      params,
      MatchmakingSchemas.CreateMatchParams,
    );
    if (!validation.valid) {
      logger.warn(`Invalid parameters for create match:`, validation.errors);
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const { player1Id, player2Id } = params;

    // Verify players exist
    const { data: players, error: playerError } = await getTable(
      supabase,
      "profiles",
    )
      .select("id")
      .in("id", [player1Id, player2Id]);

    logOperation("verify players", playerError);
    if (playerError) {
      logger.error(`Error verifying players:`, playerError);
      return errorResponse(`Invalid players: ${playerError.message}`, 400);
    }

    if (!players || players.length !== 2) {
      logger.warn(
        `One or both players not found: found ${players?.length || 0} players`,
      );
      return errorResponse(
        "Invalid players: One or both players not found",
        400,
      );
    }

    // Check authorization (only admins or the players themselves can create a match)
    const isAuthorized =
      user.id === player1Id ||
      user.id === player2Id ||
      user.app_metadata?.role === "admin";

    if (!isAuthorized) {
      logger.warn(
        `User ${user.id} unauthorized to create match between ${player1Id} and ${player2Id}`,
      );
      return errorResponse(
        "Unauthorized to create a match between these players",
        403,
      );
    }

    // Get time control from database (single source of truth)
    const timeControl = await getDefaultTimeControl(supabase);

    // Create the new game
    const { data: game, error: createError } = await getTable(supabase, "games")
      .insert({
        id: generateShortId(),
        white_player_id: player1Id,
        black_player_id: player2Id,
        status: "active",
        current_fen: INITIAL_FEN,
        pgn: "",
        turn: "white",
        banning_player: "black", // Black must ban before White's first move
        time_control: {
          initial_time: timeControl.initialTime,
          increment: timeControl.increment,
        },
        white_time_remaining: timeControl.initialTime,
        black_time_remaining: timeControl.initialTime,
      })
      .select("*")
      .single();

    logOperation("create game", createError);
    if (createError) {
      logger.error(`Error creating game:`, createError);
      return errorResponse(
        `Failed to create game: ${createError.message}`,
        500,
      );
    }

    logger.info(
      `Successfully created game ${game?.id} between ${player1Id} and ${player2Id}`,
    );
    return successResponse(game);
  } catch (error) {
    logger.error(`Error creating match:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Simple handler for joining the matchmaking queue
 */
export async function handleJoinQueue(
  user: User,
  params: QueueParams,
  supabase: TypedSupabaseClient,
): Promise<Response> {
  logger.info(`User ${user.id} joining queue`);

  try {
    // // 1. Check if player already has active games
    // const { data: activeGames, error: gameError } = await supabase
    //   .from("games")
    //   .select("id")
    //   .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
    //   .eq("status", "active")
    //   .limit(1);

    // if (gameError) {
    //   console.error(
    //     `[MATCHMAKING] Error checking active games: ${gameError.message}`,
    //   );
    //   return buildResponse(
    //     `Error checking games: ${gameError.message}`,
    //     500,
    //     corsHeaders,
    //   );
    // }

    // // if (activeGames && activeGames.length > 0) {
    // //   console.log(
    // //     `[MATCHMAKING] User ${user.id} already has active game: ${activeGames[0].id}`,
    // //   );
    // //   return buildResponse(
    // //     {
    // //       success: false,
    // //       message: "Already in an active game",
    // //       game: activeGames[0],
    // //     },
    // //     400,
    // //     corsHeaders,
    // //   );
    // // }

    // 2. Check if already in queue
    const { data: existingEntry, error: queueError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("id, status")
      .eq("player_id", user.id)
      .maybeSingle();

    logOperation("check queue entry", queueError);
    if (queueError) {
      logger.error(`Error checking queue:`, queueError);
      return errorResponse(`Error checking queue: ${queueError.message}`, 500);
    }

    // 3. Handle existing queue entries
    if (existingEntry) {
      logger.info(
        `User ${user.id} already in queue with status: ${existingEntry.status}`,
      );

      if (existingEntry.status === "matched") {
        // Already matched - create or check for game
        return await createOrFindGame(user.id, supabase);
      }

      // Already waiting in queue
      return successResponse({
        success: true,
        message: "Already in queue",
        status: existingEntry.status,
      });
    }

    // 4. Add to queue
    logger.info(`Adding user ${user.id} to queue`);

    // Get time control from database (single source of truth)
    const timeControl = await getDefaultTimeControl(supabase);

    const { data: newEntry, error: insertError } = await getTable(
      supabase,
      "matchmaking",
    )
      .insert({
        player_id: user.id,
        status: "waiting",
        preferences: params?.preferences || { timeControl },
      })
      .select("*")
      .single();

    logOperation("add to queue", insertError);
    if (insertError) {
      logger.error(`Error adding to queue:`, insertError);
      return errorResponse(`Error joining queue: ${insertError.message}`, 500);
    }

    // 5. Check if immediately matched by trigger
    const { data: updated, error: statusError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("status")
      .eq("player_id", user.id)
      .maybeSingle();

    logOperation("check updated status", statusError);
    if (statusError) {
      logger.warn(`Error checking updated status:`, statusError);
      // Continue with default response
    } else if (updated && updated.status === "matched") {
      logger.info(`User ${user.id} immediately matched, creating game`);
      return await createOrFindGame(user.id, supabase);
    }

    // 6. Return default waiting response
    return successResponse({
      success: true,
      message: "Added to queue",
      status: "waiting",
    });
  } catch (error) {
    logger.error(`Error in join queue:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Simple handler for checking matchmaking status
 */
export async function handleCheckMatchmakingStatus(
  user: User,
  params: QueueParams,
  supabase: TypedSupabaseClient,
): Promise<Response> {
  logger.info(`Checking status for user ${user.id}`);

  try {
    // 1. Check queue status
    const { data: queueEntry, error: queueError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("status, joined_at")
      .eq("player_id", user.id)
      .maybeSingle();

    logOperation("check queue status", queueError);
    if (queueError) {
      logger.error(`Error checking queue:`, queueError);
      return errorResponse(`Error checking status: ${queueError.message}`, 500);
    }

    // 2. Not in queue
    if (!queueEntry) {
      return successResponse({
        success: true,
        inQueue: false,
        message: "Not in queue",
      });
    }

    // 3. In queue with matched status - create or find game
    if (queueEntry.status === "matched") {
      return await createOrFindGame(user.id, supabase);
    }

    // 4. In queue with waiting status
    if (queueEntry.status === "waiting") {
      const joinedAt = new Date(queueEntry.joined_at);
      const waitSeconds = Math.floor((Date.now() - joinedAt.getTime()) / 1000);

      return successResponse({
        success: true,
        inQueue: true,
        status: "waiting",
        waitTimeSeconds: waitSeconds,
        message: "Waiting for match",
      });
    }

    // 5. Unknown status
    return successResponse({
      success: true,
      inQueue: true,
      status: queueEntry.status,
      message: `In queue with status: ${queueEntry.status}`,
    });
  } catch (error) {
    logger.error(`Error checking status:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Simple handler for leaving the queue
 */
export async function handleLeaveQueue(
  user: User,
  params: QueueParams,
  supabase: TypedSupabaseClient,
): Promise<Response> {
  logger.info(`User ${user.id} leaving queue`);

  try {
    // Delete from queue regardless of status
    const { error: deleteError } = await getTable(supabase, "matchmaking")
      .delete()
      .eq("player_id", user.id);

    logOperation("remove from queue", deleteError);
    if (deleteError) {
      logger.error(`Error leaving queue:`, deleteError);
      return errorResponse(`Error leaving queue: ${deleteError.message}`, 500);
    }

    return successResponse({
      success: true,
      message: "Removed from queue",
    });
  } catch (error) {
    logger.error(`Error leaving queue:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Unified function to create or find a game for a matched player
 * This is the SINGLE path to game creation
 */
async function createOrFindGame(
  userId: string,
  supabase: TypedSupabaseClient,
): Promise<Response> {
  logger.info(`Creating or finding game for user ${userId}`);

  try {
    // 1. Check if we already have a game created for this user by looking at matchmaking
    const { data: matchedEntry, error: matchError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("game_id")
      .eq("player_id", userId)
      .eq("status", "matched")
      .maybeSingle();

    logOperation("fetch matched player", matchError);

    if (matchError && !matchError.message.includes("No rows found")) {
      logger.error(`Error fetching match info:`, matchError);
      return errorResponse(`Database error: ${matchError.message}`, 500);
    }

    if (matchedEntry?.game_id) {
      logger.info(
        `Found existing game ${matchedEntry.game_id} for user ${userId}`,
      );

      // Check the game details to return to client
      const { data: gameData, error: gameError } = await getTable(
        supabase,
        "games",
      )
        .select(
          "id, white_player_id, black_player_id, status, created_at, current_fen, turn",
        )
        .eq("id", matchedEntry.game_id)
        .single();

      logOperation("fetch game details", gameError);
      if (gameError) {
        logger.error(`Error fetching game details:`, gameError);
        return errorResponse(`Database error: ${gameError.message}`, 500);
      }

      // Convert to the format expected by clients
      const game = {
        id: gameData.id,
        white_player_id: gameData.white_player_id,
        black_player_id: gameData.black_player_id,
        status: gameData.status,
        current_fen: gameData.current_fen,
        turn: gameData.turn,
        created_at: gameData.created_at,
      };

      return successResponse({
        success: true,
        matchFound: true,
        message: "Match found and game already created",
        game,
      });
    }

    // 2. Request the edge function to create the game from matched players
    // This uses an internal edge function call to create the game with service role privileges
    logger.info(`No existing game, creating new game from matched players`);
    const createGameResult = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/game-operations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          operation: "create-game-from-matched",
          source: "db_trigger",
        }),
      },
    ).then((res) => res.json());

    const gameResult = createGameResult.game;

    // 3. If game created successfully, return it
    if (gameResult) {
      logger.info(`Successfully created game ${gameResult.id}`);
      return successResponse({
        success: true,
        matchFound: true,
        message: "Match found and game created",
        game: gameResult,
      });
    }

    // 4. Return waiting for 2nd player if no game could be created yet
    return successResponse({
      success: true,
      matchFound: false,
      message: "Matched but waiting for game creation",
      status: "matched_pending",
    });
  } catch (error) {
    logger.error(`Error in createOrFindGame:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles automatic matchmaking (can be triggered by a cron job)
 */
export async function handleAutoMatch(
  supabase: TypedSupabaseClient,
): Promise<Response> {
  logger.info("Running automatic matchmaking");

  // Query for users currently in the queue
  const { data: queuedPlayers, error: queueError } = await getTable(
    supabase,
    "matchmaking",
  )
    .select("player_id, joined_at")
    .eq("status", "waiting")
    .order("joined_at", { ascending: true });

  logOperation("fetch queued players", queueError);

  if (queueError) {
    logger.error(`Failed to fetch queue:`, queueError);
    return errorResponse(`Failed to fetch queue: ${queueError.message}`, 500);
  }

  // Create an array to track matches we've made
  const matches = [];

  // Match players in pairs
  for (let i = 0; i < queuedPlayers.length - 1; i += 2) {
    const player1 = queuedPlayers[i];
    const player2 = queuedPlayers[i + 1];

    logger.info(`Matching ${player1.player_id} with ${player2.player_id}`);

    // Get time control from database (single source of truth)
    const timeControl = await getDefaultTimeControl(supabase);

    // Create a new game
    const { data: game, error: createError } = await getTable(supabase, "games")
      .insert({
        id: generateShortId(),
        white_player_id: player1.player_id,
        black_player_id: player2.player_id,
        status: "active",
        current_fen: INITIAL_FEN,
        pgn: "",
        turn: "white",
        banning_player: "black",
        time_control: toJson(timeControl),
        white_time_remaining: timeControl.initialTime,
        black_time_remaining: timeControl.initialTime,
      })
      .select("*")
      .single();

    logOperation("create match", createError);
    if (createError) {
      logger.error(
        `Failed to create match for ${player1.player_id} vs ${player2.player_id}:`,
        createError,
      );
      continue;
    }

    if (game) {
      matches.push(game);
    }

    // Remove these players from the queue
    await getTable(supabase, "matchmaking")
      .delete()
      .in("player_id", [player1.player_id, player2.player_id]);

    logOperation("remove matched players", null);
  }

  return successResponse({
    matchesCreated: matches.length,
    matches,
  });
}
