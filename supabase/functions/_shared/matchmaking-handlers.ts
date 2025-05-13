/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { buildResponse } from "./chess-utils.ts";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Handles creating a new match
 */
export async function handleCreateMatch(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  const { player1Id, player2Id } = params;

  if (!player1Id || !player2Id) {
    return buildResponse(
      "Missing required parameters: player1Id or player2Id",
      400,
      corsHeaders,
    );
  }

  // Verify players exist
  const { data: players, error: playerError } = await supabase
    .from("profiles")
    .select("id")
    .in("id", [player1Id, player2Id]);

  if (playerError || !players || players.length !== 2) {
    return buildResponse(
      `Invalid players: ${playerError?.message || "One or both players not found"}`,
      400,
      corsHeaders,
    );
  }

  // Check authorization (only admins or the players themselves can create a match)
  const isAuthorized =
    user.id === player1Id ||
    user.id === player2Id ||
    user.app_metadata?.role === "admin";

  if (!isAuthorized) {
    return buildResponse(
      "Unauthorized to create a match between these players",
      403,
      corsHeaders,
    );
  }

  // Create the new game
  const { data: game, error: createError } = await supabase
    .from("games")
    .insert({
      white_player_id: player1Id,
      black_player_id: player2Id,
      status: "active",
      current_fen: INITIAL_FEN,
      pgn: "",
      turn: "white",
      banningPlayer: "black",
    })
    .select()
    .single();

  if (createError) {
    return buildResponse(
      `Failed to create game: ${createError.message}`,
      500,
      corsHeaders,
    );
  }

  return buildResponse(game, 200, corsHeaders);
}

/**
 * Handles the queue joining process
 */
export async function handleJoinQueue(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  // Check if player already has too many active games
  const { data: activeGames, error: countError } = await supabase
    .from("games")
    .select("id")
    .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
    .eq("status", "active");

  if (countError) {
    return buildResponse(
      `Failed to check active games: ${countError.message}`,
      500,
      corsHeaders,
    );
  }

  // Optional: limit active games (configurable)
  const maxActiveGames = 5; // Could be moved to a configuration
  if (activeGames.length >= maxActiveGames) {
    return buildResponse(
      `Too many active games (max: ${maxActiveGames})`,
      403,
      corsHeaders,
    );
  }

  // At this point, we would typically handle the queue logic
  // This could be implemented in various ways:
  // 1. Using a queue table in the database
  // 2. Using Realtime Presence (as shown in the client)
  // 3. Using a serverless queue service

  // For this example, we'll validate and return success
  // The actual queue joining happens on the client via Realtime Presence

  return buildResponse(
    {
      success: true,
      message: "Approved to join queue",
      userId: user.id,
      timestamp: new Date().toISOString(),
    },
    200,
    corsHeaders,
  );
}

/**
 * Handles the queue leaving process
 */
export async function handleLeaveQueue(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  // If using a database queue, we'd remove the player here
  // For Realtime Presence, it happens client-side

  return buildResponse(
    {
      success: true,
      message: "Removed from queue",
      userId: user.id,
    },
    200,
    corsHeaders,
  );
}

/**
 * Handles automatic matchmaking (can be triggered by a cron job)
 */
export async function handleAutoMatch(supabase: any): Promise<Response> {
  // Query for users currently in the queue
  // This is a simplified example assuming we have a queue table
  const { data: queuedPlayers, error: queueError } = await supabase
    .from("queue")
    .select("user_id, joined_at")
    .order("joined_at", { ascending: true });

  if (queueError) {
    return buildResponse(
      `Failed to fetch queue: ${queueError.message}`,
      500,
      corsHeaders,
    );
  }

  // Create an array to track matches we've made
  const matches = [];

  // Match players in pairs
  for (let i = 0; i < queuedPlayers.length - 1; i += 2) {
    const player1 = queuedPlayers[i];
    const player2 = queuedPlayers[i + 1];

    // Create a new game
    const { data: game, error: createError } = await supabase
      .from("games")
      .insert({
        white_player_id: player1.user_id,
        black_player_id: player2.user_id,
        status: "active",
        current_fen: INITIAL_FEN,
        pgn: "",
        turn: "white",
        banningPlayer: "black",
      })
      .select()
      .single();

    if (createError) {
      console.error(
        `Failed to create match for ${player1.user_id} vs ${player2.user_id}: ${createError.message}`,
      );
      continue;
    }

    // Add to matches array
    matches.push({
      gameId: game.id,
      whitePlayer: player1.user_id,
      blackPlayer: player2.user_id,
    });

    // Remove matched players from queue
    await supabase
      .from("queue")
      .delete()
      .in("user_id", [player1.user_id, player2.user_id]);

    // Notify players via Realtime broadcast
    await supabase.from("queue_notifications").insert({
      type: "match_found",
      game_id: game.id,
      white_player_id: player1.user_id,
      black_player_id: player2.user_id,
    });
  }

  return buildResponse(
    {
      matchesCreated: matches.length,
      matches,
      remainingInQueue: queuedPlayers.length % 2,
    },
    200,
    corsHeaders,
  );
}
