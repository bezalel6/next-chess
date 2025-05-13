/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { buildResponse } from "./chess-utils.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Creates a new game between matched players
 * Simple, direct function for game creation
 */
export async function createGameFromMatchedPlayers(
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    console.log("[MATCH] Creating game for matched players");

    // Get matched players (status = 'matched')
    const { data: matchedPlayers, error: matchError } = await supabase
      .from("queue")
      .select("user_id")
      .eq("status", "matched")
      .order("joined_at", { ascending: true })
      .limit(2);

    if (matchError) {
      console.error(`[MATCH] DB Error: ${matchError.message}`);
      return buildResponse(
        { success: false, message: "Database error fetching matched players" },
        500,
        corsHeaders,
      );
    }

    // We need exactly 2 matched players to create a game
    if (!matchedPlayers || matchedPlayers.length < 2) {
      return buildResponse(
        {
          success: false,
          message: "Not enough matched players",
          count: matchedPlayers?.length || 0,
        },
        200,
        corsHeaders,
      );
    }

    // Get player IDs and randomize colors
    const player1Id = matchedPlayers[0].user_id;
    const player2Id = matchedPlayers[1].user_id;
    const isPlayer1White = Math.random() >= 0.5;
    const whiteId = isPlayer1White ? player1Id : player2Id;
    const blackId = isPlayer1White ? player2Id : player1Id;

    console.log(`[MATCH] Creating game: White=${whiteId}, Black=${blackId}`);

    // Create game and all related records in a transaction
    const { data: game, error: txError } = await supabase.rpc(
      "create_game_with_notifications",
      {
        white_player: whiteId,
        black_player: blackId,
        initial_fen: INITIAL_FEN,
      },
    );

    if (txError) {
      console.error(`[MATCH] Game creation error: ${txError.message}`);
      return buildResponse(
        { success: false, message: "Error creating game" },
        500,
        corsHeaders,
      );
    }

    console.log(`[MATCH] Success: Created game ${game.id}`);

    return buildResponse(
      { success: true, message: "Game created", game },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[MATCH] Error: ${error.message}`);
    return buildResponse(
      { success: false, message: "Internal server error" },
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
