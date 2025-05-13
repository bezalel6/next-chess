/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { buildResponse } from "./chess-utils.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Creates a new game between matched players
 * This function is called by the Edge function after players are matched
 */
export async function createGameFromMatchedPlayers(
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    console.log("[EDGE] Creating game for matched players");

    // Get matched players (status = 'matched')
    const { data: matchedPlayers, error: matchError } = await supabase
      .from("queue")
      .select("user_id, joined_at")
      .eq("status", "matched")
      .order("joined_at", { ascending: true })
      .limit(2);

    if (matchError) {
      console.error(
        `[EDGE] Failed to get matched players: ${matchError.message}`,
      );
      return buildResponse(
        `Failed to get matched players: ${matchError.message}`,
        500,
        corsHeaders,
      );
    }

    // We need exactly 2 matched players to create a game
    if (!matchedPlayers || matchedPlayers.length < 2) {
      console.log(
        `[EDGE] Not enough matched players found: ${matchedPlayers?.length || 0}`,
      );
      return buildResponse(
        "Not enough matched players found to create a game",
        200, // Not an error, just not enough players
        corsHeaders,
      );
    }

    const player1Id = matchedPlayers[0].user_id;
    const player2Id = matchedPlayers[1].user_id;

    console.log(`[EDGE] Found matched players: ${player1Id} and ${player2Id}`);

    // Determine random colors
    const isPlayer1White = Math.random() >= 0.5;
    const whiteId = isPlayer1White ? player1Id : player2Id;
    const blackId = isPlayer1White ? player2Id : player1Id;

    // Create the new game in a single transaction
    const { data: game, error: createError } = await supabase
      .from("games")
      .insert({
        white_player_id: whiteId,
        black_player_id: blackId,
        status: "active",
        current_fen: INITIAL_FEN,
        pgn: "",
        turn: "white",
        banningPlayer: "black", // Optional for specific game variants
      })
      .select()
      .single();

    if (createError) {
      console.error(`[EDGE] Error creating game: ${createError.message}`);
      return buildResponse(
        `Failed to create game: ${createError.message}`,
        500,
        corsHeaders,
      );
    }

    console.log(
      `[EDGE] Created game ${game.id} between ${whiteId} (White) and ${blackId} (Black)`,
    );

    // Create notification for both players
    const { error: notificationError } = await supabase
      .from("queue_notifications")
      .insert({
        type: "match_found",
        game_id: game.id,
        white_player_id: whiteId,
        black_player_id: blackId,
        data: {
          matchTime: new Date().toISOString(),
        },
      });

    if (notificationError) {
      console.error(
        `[EDGE] Failed to create notification: ${notificationError.message}`,
      );
      // Continue anyway since the game was created
    } else {
      console.log(`[EDGE] Created match notification for game ${game.id}`);
    }

    // Remove the players from the queue
    const { error: removeError } = await supabase
      .from("queue")
      .delete()
      .in("user_id", [player1Id, player2Id]);

    if (removeError) {
      console.error(
        `[EDGE] Failed to remove players from queue: ${removeError.message}`,
      );
      // Continue anyway since the game was created
    } else {
      console.log(
        `[EDGE] Removed players from queue: ${player1Id}, ${player2Id}`,
      );
    }

    return buildResponse(
      {
        success: true,
        message: "Game created for matched players",
        game,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(
      `[EDGE] Error creating game from matched players: ${error.message}`,
      error,
    );
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
  }
}

/**
 * Processes the matchmaking queue to create games
 * This can be called periodically or triggered by database events
 */
export async function processMatchmakingQueue(
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    // This function is simpler now since the database trigger does most of the work
    // It just creates games for any matched players that don't have games yet
    return await createGameFromMatchedPlayers(supabase);
  } catch (error) {
    console.error(
      `Error processing matchmaking queue: ${error.message}`,
      error,
    );
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
  }
}
