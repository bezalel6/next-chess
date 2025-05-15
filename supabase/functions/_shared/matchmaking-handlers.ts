/// <reference lib="deno.ns" />
import { successResponse, errorResponse } from "./response-utils.ts";
import { createLogger } from "./logger.ts";
import { dbQuery } from "./db-utils.ts";
import { validateRequired } from "./validation-utils.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

const logger = createLogger("MATCHMAKING");
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface CreateMatchParams {
  player1Id: string;
  player2Id: string;
}

interface QueueParams {
  // Add any queue-specific parameters if needed
  preferences?: Record<string, any>;
}

/**
 * Handles creating a new match
 */
export async function handleCreateMatch(
  user: User,
  params: CreateMatchParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    logger.info(
      `User ${user.id} attempting to create match with params:`,
      params,
    );

    // Validate required parameters
    const validation = validateRequired(params, ["player1Id", "player2Id"]);
    if (!validation.valid) {
      logger.warn(`Missing parameters for create match:`, validation.errors);
      return errorResponse(validation.errors.join("; "), 400);
    }

    const { player1Id, player2Id } = params;

    // Verify players exist
    const { data: players, error: playerError } = await dbQuery(
      supabase,
      "profiles",
      "select",
      {
        select: "id",
        match: { _in: [{ id: [player1Id, player2Id] }] },
        operation: "verify players",
      },
    );

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

    // Create the new game
    const { data: game, error: createError } = await dbQuery(
      supabase,
      "games",
      "insert",
      {
        data: {
          white_player_id: player1Id,
          black_player_id: player2Id,
          status: "active",
          current_fen: INITIAL_FEN,
          pgn: "",
          turn: "white",
          banningPlayer: "black",
        },
        select: "*",
        single: true,
        operation: "create game",
      },
    );

    if (createError) {
      logger.error(`Error creating game:`, createError);
      return errorResponse(
        `Failed to create game: ${createError.message}`,
        500,
      );
    }

    logger.info(
      `Successfully created game ${game.id} between ${player1Id} and ${player2Id}`,
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
  supabase: SupabaseClient,
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

    // if (activeGames && activeGames.length > 0) {
    //   console.log(
    //     `[MATCHMAKING] User ${user.id} already has active game: ${activeGames[0].id}`,
    //   );
    //   return buildResponse(
    //     {
    //       success: false,
    //       message: "Already in an active game",
    //       game: activeGames[0],
    //     },
    //     400,
    //     corsHeaders,
    //   );
    // }

    // 2. Check if already in queue
    const { data: existingEntry, error: queueError } = await dbQuery(
      supabase,
      "queue",
      "select",
      {
        select: "id, status",
        match: { user_id: user.id },
        single: true,
        operation: "check queue entry",
      },
    );

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
    const { data: newEntry, error: insertError } = await dbQuery(
      supabase,
      "queue",
      "insert",
      {
        data: {
          user_id: user.id,
          status: "waiting",
          preferences: params.preferences || {},
        },
        select: "*",
        single: true,
        operation: "add to queue",
      },
    );

    if (insertError) {
      logger.error(`Error adding to queue:`, insertError);
      return errorResponse(`Error joining queue: ${insertError.message}`, 500);
    }

    // 5. Check if immediately matched by trigger
    const { data: updated, error: statusError } = await dbQuery(
      supabase,
      "queue",
      "select",
      {
        select: "status",
        match: { user_id: user.id },
        single: true,
        operation: "check updated status",
      },
    );

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
  supabase: SupabaseClient,
): Promise<Response> {
  logger.info(`Checking status for user ${user.id}`);

  try {
    // 1. Check queue status
    const { data: queueEntry, error: queueError } = await dbQuery(
      supabase,
      "queue",
      "select",
      {
        select: "status, joined_at",
        match: { user_id: user.id },
        single: true,
        operation: "check queue status",
      },
    );

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
  supabase: SupabaseClient,
): Promise<Response> {
  logger.info(`User ${user.id} leaving queue`);

  try {
    // Delete from queue regardless of status
    const { error: deleteError } = await dbQuery(supabase, "queue", "delete", {
      match: { user_id: user.id },
      operation: "remove from queue",
    });

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
  supabase: SupabaseClient,
): Promise<Response> {
  logger.info(`Creating or finding game for user ${userId}`);

  try {
    // 1. Check if we already have a game created for this user
    // Need to look for notifications since the player might be a participant
    // in multiple games
    const { data: notification, error: notifError } = await dbQuery(
      supabase,
      "queue_notifications",
      "select",
      {
        select: "game_id, white_player_id, black_player_id",
        match: {
          _or: [`white_player_id.eq.${userId}`, `black_player_id.eq.${userId}`],
          type: "match_found",
        },
        order: { column: "created_at", ascending: false },
        limit: 1,
        single: true,
        operation: "fetch notifications",
      },
    );

    if (notifError && !notifError.message.includes("No rows found")) {
      logger.error(`Error fetching notifications:`, notifError);
      return errorResponse(`Database error: ${notifError.message}`, 500);
    }

    if (notification?.game_id) {
      logger.info(
        `Found existing game ${notification.game_id} for user ${userId}`,
      );

      // Check the game details to return to client
      const { data: gameData, error: gameError } = await dbQuery(
        supabase,
        "games",
        "select",
        {
          select:
            "id, white_player_id, black_player_id, status, created_at, current_fen, turn",
          match: { id: notification.game_id },
          single: true,
          operation: "fetch game details",
        },
      );

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
  supabase: SupabaseClient,
): Promise<Response> {
  logger.info("Running automatic matchmaking");

  // Query for users currently in the queue
  // This is a simplified example assuming we have a queue table
  const { data: queuedPlayers, error: queueError } = await dbQuery(
    supabase,
    "queue",
    "select",
    {
      select: "user_id, joined_at",
      order: { column: "joined_at", ascending: true },
      operation: "fetch queued players",
    },
  );

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

    logger.info(`Matching ${player1.user_id} with ${player2.user_id}`);

    // Create a new game
    const { data: game, error: createError } = await dbQuery(
      supabase,
      "games",
      "insert",
      {
        data: {
          white_player_id: player1.user_id,
          black_player_id: player2.user_id,
          status: "active",
          current_fen: INITIAL_FEN,
          pgn: "",
          turn: "white",
          banningPlayer: "black",
        },
        select: "*",
        single: true,
        operation: "create match",
      },
    );

    if (createError) {
      logger.error(
        `Failed to create match for ${player1.user_id} vs ${player2.user_id}:`,
        createError,
      );
      continue;
    }

    matches.push(game);

    // Remove these players from the queue
    await dbQuery(supabase, "queue", "delete", {
      match: { _in: [{ user_id: [player1.user_id, player2.user_id] }] },
      operation: "remove matched players",
    });
  }

  return successResponse({
    matchesCreated: matches.length,
    matches,
  });
}
