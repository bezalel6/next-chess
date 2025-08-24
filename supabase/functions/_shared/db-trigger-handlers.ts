/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { successResponse, errorResponse } from "./response-utils.ts";
import { createLogger } from "./logger.ts";
import { getTable, logOperation, ensureSingle } from "./db-utils.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { validateWithZod, Schemas } from "./validation-utils.ts";
import { EventType, recordEvent } from "./event-utils.ts";
import type { Json } from "./database-types.ts";
import { INITIAL_FEN } from "./constants.ts";
import { getDefaultTimeControl } from "./time-control-utils.ts";

const logger = createLogger("DB_TRIGGER");

interface MatchedPlayer {
  player_id: string;
  joined_at: string;
}

interface GameCreationResult {
  id: string;
  white_player_id: string;
  black_player_id: string;
  [key: string]: unknown;
}


/**
 * Gets default time control from the database
 * @deprecated Use getDefaultTimeControl from time-control-utils.ts instead
 */
async function getTimeControlFromDB(supabase: TypedSupabaseClient) {
  return await getDefaultTimeControl(supabase);
}

/**
 * Notifies players about a game update
 */
async function notifyGameCreation(
  supabase: TypedSupabaseClient,
  gameId: string,
  whitePlayerId: string,
  blackPlayerId: string,
): Promise<void> {
  try {
    // Fetch the complete game data
    const { data: game, error: gameError } = await getTable(supabase, "games")
      .select("*")
      .eq("id", gameId)
      .single();

    logOperation("get game for notification", gameError);
    if (gameError) {
      logger.error("Failed to fetch game for notification:", gameError);
      return;
    }

    // Log the event
    await recordEvent(
      supabase,
      EventType.GAME_CREATED,
      {
        gameId,
        whiteId: whitePlayerId,
        blackId: blackPlayerId,
      },
      "system",
    );

    // No ad-hoc channel fan-out; unified broadcast is handled in game-operations.

    logger.info(
      `Successfully sent game creation notifications for game ${gameId}`,
    );
  } catch (error) {
    logger.error("Error sending game notifications:", error);
  }
}

/**
 * Creates a new game between matched players
 * Simple, direct function for game creation
 */
export async function createGameFromMatchedPlayers(
  supabase: TypedSupabaseClient,
): Promise<Response> {
  try {
    logger.info("Creating game for matched players");

    // Get matched players (status = 'matched')
    const { data: matchedPlayers, error: matchError } = await getTable(
      supabase,
      "matchmaking",
    )
      .select("player_id, joined_at, preferences")
      .eq("status", "matched")
      .order("joined_at", { ascending: true })
      .limit(2);

    logOperation("fetch matched players", matchError);
    if (matchError) {
      logger.error("Database error fetching matched players:", matchError);
      return errorResponse("Database error fetching matched players", 500);
    }

    // We need exactly 2 matched players to create a game
    if (!matchedPlayers || matchedPlayers.length < 2) {
      logger.info(
        `Not enough matched players (found ${matchedPlayers?.length || 0})`,
      );
      return successResponse(
        {
          count: matchedPlayers?.length || 0,
        },
        "Not enough matched players",
        200,
      );
    }

    // Get player IDs and randomize colors
    const player1Id = matchedPlayers[0].player_id;
    const player2Id = matchedPlayers[1].player_id;
    const isPlayer1White = Math.random() >= 0.5;
    const whiteId = isPlayer1White ? player1Id : player2Id;
    const blackId = isPlayer1White ? player2Id : player1Id;

    logger.info(
      `Creating game: White=${whiteId}, Black=${blackId} with default time control`,
    );

// Get time control from database (single source of truth)
  const timeControl = await getDefaultTimeControl(supabase);

// Create the game directly in the database
    const { data: game, error: gameError } = await getTable(supabase, "games")
      .insert({
        white_player_id: whiteId,
        black_player_id: blackId,
        status: "active",
        current_fen: INITIAL_FEN,
        pgn: "",
        turn: "white",
        banning_player: "black", // Black bans before White's first move
        time_control: {
          initial_time: timeControl.initialTime,
          increment: timeControl.increment,
        },
        white_time_remaining: timeControl.initialTime,
        black_time_remaining: timeControl.initialTime,
      })
      .select("*")
      .single();

    logOperation("create game", gameError);
    if (gameError) {
      logger.error("Game creation error:", gameError);
      return errorResponse("Error creating game", 500);
    }

    logger.info(`Success: Created game ${game.id}`);

// Update matchmaking records to link to the new game
    const { error: updateError } = await getTable(supabase, "matchmaking")
      .update({ game_id: game.id })
      .in("player_id", [whiteId, blackId]);

    logOperation("update matchmaking records", updateError);
    if (updateError) {
      logger.warn(
        "Failed to update matchmaking records with game ID:",
        updateError,
      );
      // Non-critical error, continue with the process
    }

    // Send notifications to both players
    try {
      await notifyGameCreation(supabase, game.id, whiteId, blackId);
      // No chat broadcast fan-out here; keep creation simple.
    } catch (notifyError) {
      logger.error("Error sending game notifications:", notifyError);
      // Non-critical error, continue with the process
    }

    return successResponse({ game }, "Game created", 200);
  } catch (error) {
    logger.error("Error creating game from matched players:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${errorMessage}`, 500);
  }
}

/**
 * Processes the matchmaking queue to create games
 * This can be called periodically or triggered by database events
 */
export async function processMatchmakingQueue(
  supabase: TypedSupabaseClient,
): Promise<Response> {
  try {
    logger.info("Processing matchmaking queue");
    // This function is simpler now since the database trigger does most of the work
    // It just creates games for any matched players that don't have games yet
    return await createGameFromMatchedPlayers(supabase);
  } catch (error) {
    logger.error("Error processing matchmaking queue:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${errorMessage}`, 500);
  }
}

/**
 * Handles database trigger events for matchmaking
 * This is called by the database trigger when players are matched
 */
export async function handleDbTriggerOperation(
  user: User | null,
  params: Record<string, unknown>,
  supabase: TypedSupabaseClient,
): Promise<Response> {
  try {
    logger.info("Processing database trigger operation", params);

    if (!params || !params.source || params.source !== "db_trigger") {
      logger.warn("Invalid trigger source:", params);
      return errorResponse("Invalid trigger source", 400);
    }

    // Route to the appropriate handler based on operation
    switch (params.operation) {
      case "create-game-from-matched":
        return await createGameFromMatchedPlayers(supabase);
      default:
        logger.warn(`Unknown db trigger operation: ${params.operation}`);
        return errorResponse(`Unknown operation: ${params.operation}`, 400);
    }
  } catch (error) {
    logger.error("Error in database trigger handler:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResponse(`Internal server error: ${errorMessage}`, 500);
  }
}
