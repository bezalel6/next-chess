/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { successResponse, errorResponse } from "./response-utils.ts";
import { createLogger } from "./logger.ts";
import { getTable, logOperation, ensureSingle } from "./db-utils.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { validateWithZod, Schemas } from "./validation-utils.ts";
import { EventType, recordEvent } from "./event-utils.ts";
import type { Json } from "./database-types.ts";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const logger = createLogger("DB_TRIGGER");

// Add a fixed default time control
const DEFAULT_TIME_CONTROL = {
  initialTime: 600000, // 10 minutes in ms
  increment: 0, // No increment
};

interface MatchedPlayer {
  player_id: string;
  joined_at: string;
}

interface GameCreationResult {
  id: string;
  white_player_id: string;
  black_player_id: string;
  [key: string]: any;
}

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

    // Send realtime notifications to both players through different channels

    // 1. Game-specific channel that clients can subscribe to
    const gameChannel = supabase.channel(`game:${gameId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    await gameChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await gameChannel.send({
          type: "broadcast",
          event: "game_created",
          payload: {
            game: game,
          },
        });
        // Unsubscribe after sending
        setTimeout(() => gameChannel.unsubscribe(), 1000);
      }
    });

    // 2. Player-specific channels for each participant
    for (const playerId of [whitePlayerId, blackPlayerId]) {
      const playerChannel = supabase.channel(`player:${playerId}`, {
        config: {
          broadcast: { self: true },
        },
      });

      await playerChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await playerChannel.send({
            type: "broadcast",
            event: "game_matched",
            payload: {
              gameId,
              isWhite: playerId === whitePlayerId,
              opponentId:
                playerId === whitePlayerId ? blackPlayerId : whitePlayerId,
            },
          });
          // Unsubscribe after sending
          setTimeout(() => playerChannel.unsubscribe(), 1000);
        }
      });
    }

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

    // Generate a short game ID
    const gameId = generateShortId();

    // Create the game directly in the database
    const { data: game, error: gameError } = await getTable(supabase, "games")
      .insert({
        id: gameId,
        white_player_id: whiteId,
        black_player_id: blackId,
        status: "active",
        current_fen: INITIAL_FEN,
        pgn: "",
        turn: "white",
        banning_player: "black",
        time_control: DEFAULT_TIME_CONTROL,
        white_time_remaining: DEFAULT_TIME_CONTROL.initialTime,
        black_time_remaining: DEFAULT_TIME_CONTROL.initialTime,
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
      .update({ game_id: gameId })
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
    } catch (notifyError) {
      logger.error("Error sending game notifications:", notifyError);
      // Non-critical error, continue with the process
    }

    return successResponse({ game }, "Game created", 200);
  } catch (error) {
    logger.error("Error creating game from matched players:", error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
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
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles database trigger events for matchmaking
 * This is called by the database trigger when players are matched
 */
export async function handleDbTriggerOperation(
  user: User | null,
  params: any,
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
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
