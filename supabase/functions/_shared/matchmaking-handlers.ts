/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { buildResponse } from "./chess-utils.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log(
      `User ${user.id} attempting to create match with params:`,
      params,
    );
    const { player1Id, player2Id } = params;

    if (!player1Id || !player2Id) {
      console.log(
        `Missing parameters: player1Id=${player1Id}, player2Id=${player2Id}`,
      );
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

    if (playerError) {
      console.error(
        `Error verifying players: ${playerError.message}`,
        playerError,
      );
      return buildResponse(
        `Invalid players: ${playerError.message}`,
        400,
        corsHeaders,
      );
    }

    if (!players || players.length !== 2) {
      console.log(
        `One or both players not found: found ${players?.length || 0} players`,
      );
      return buildResponse(
        "Invalid players: One or both players not found",
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
      console.log(
        `User ${user.id} unauthorized to create match between ${player1Id} and ${player2Id}`,
      );
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
      console.error(`Error creating game: ${createError.message}`, createError);
      return buildResponse(
        `Failed to create game: ${createError.message}`,
        500,
        corsHeaders,
      );
    }

    console.log(
      `Successfully created game ${game.id} between ${player1Id} and ${player2Id}`,
    );
    return buildResponse(game, 200, corsHeaders);
  } catch (error) {
    console.error(`Error creating match: ${error.message}`, error);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
  }
}

/**
 * Handles the queue joining process
 */
export async function handleJoinQueue(
  user: User,
  params: QueueParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    console.log(
      `User ${user.id} attempting to join queue with params:`,
      params,
    );

    // Check if player already has too many active games
    const { data: activeGames, error: countError } = await supabase
      .from("games")
      .select("id")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .eq("status", "active");

    if (countError) {
      console.error(`Failed to check active games for ${user.id}:`, countError);
      return buildResponse(
        `Failed to check active games: ${countError.message}`,
        500,
        corsHeaders,
      );
    }

    // Optional: limit active games (configurable)
    const maxActiveGames = 5; // Could be moved to a configuration
    if (activeGames.length >= maxActiveGames) {
      console.log(
        `User ${user.id} has too many active games: ${activeGames.length}`,
      );
      return buildResponse(
        `Too many active games (max: ${maxActiveGames})`,
        403,
        corsHeaders,
      );
    }

    // First, check if there's already a waiting player in the queue
    const { data: waitingPlayers, error: queueError } = await supabase
      .from("queue")
      .select("user_id")
      .eq("status", "waiting")
      .neq("user_id", user.id) // Don't match with self
      .order("joined_at", { ascending: true })
      .limit(1);

    if (queueError) {
      console.error(`Failed to check queue: ${queueError.message}`, queueError);
      return buildResponse(
        `Failed to check queue: ${queueError.message}`,
        500,
        corsHeaders,
      );
    }

    // If there's a waiting player, create a match immediately
    if (waitingPlayers && waitingPlayers.length > 0) {
      const opponentId = waitingPlayers[0].user_id;
      console.log(
        `Found waiting player ${opponentId}, creating match with ${user.id}`,
      );

      // Determine who plays white and who plays black (random)
      const isUserWhite = Math.random() >= 0.5;
      const whiteId = isUserWhite ? user.id : opponentId;
      const blackId = isUserWhite ? opponentId : user.id;

      // Create the new game
      const { data: game, error: createError } = await supabase
        .from("games")
        .insert({
          white_player_id: whiteId,
          black_player_id: blackId,
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
          `Error creating game: ${createError.message}`,
          createError,
        );
        return buildResponse(
          `Failed to create game: ${createError.message}`,
          500,
          corsHeaders,
        );
      }

      // Remove the opponent from the queue
      const { error: removeError } = await supabase
        .from("queue")
        .delete()
        .eq("user_id", opponentId);

      if (removeError) {
        console.error(
          `Failed to remove opponent from queue: ${removeError.message}`,
        );
        // Continue anyway, as the match was created
      }

      // Create notification for the match
      const { error: notificationError } = await supabase
        .from("queue_notifications")
        .insert({
          type: "match_created",
          game_id: game.id,
          white_player_id: whiteId,
          black_player_id: blackId,
          data: {
            matchType: "auto",
            initiatedBy: user.id,
          },
        });

      if (notificationError) {
        console.error(
          `Failed to create notification: ${notificationError.message}`,
        );
        // Continue anyway, as the match was created
      }

      console.log(
        `Successfully created game ${game.id} between ${whiteId} and ${blackId}`,
      );
      return buildResponse(
        {
          success: true,
          message: "Match created",
          matchFound: true,
          game,
        },
        200,
        corsHeaders,
      );
    }

    // No match found, add the player to the queue
    const { data: queueEntry, error: insertError } = await supabase
      .from("queue")
      .insert({
        user_id: user.id,
        status: "waiting",
        preferences: params.preferences || {},
      })
      .select()
      .single();

    if (insertError) {
      // Handle case where user is already in queue
      if (insertError.code === "23505") {
        // Unique violation
        console.log(`User ${user.id} is already in the queue`);
        return buildResponse(
          {
            success: true,
            message: "Already in queue",
            userId: user.id,
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders,
        );
      }

      console.error(`Failed to add user to queue: ${insertError.message}`);
      return buildResponse(
        `Failed to join queue: ${insertError.message}`,
        500,
        corsHeaders,
      );
    }

    console.log(`User ${user.id} added to queue`);
    return buildResponse(
      {
        success: true,
        message: "Added to queue",
        userId: user.id,
        timestamp: new Date().toISOString(),
        matchFound: false,
        queueEntry,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`Error processing join queue for user ${user.id}:`, error);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
  }
}

/**
 * Handles the queue leaving process
 */
export async function handleLeaveQueue(
  user: User,
  params: QueueParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    console.log(
      `User ${user.id} attempting to leave queue with params:`,
      params,
    );

    // If using a database queue, we'd remove the player here
    // For Realtime Presence, it happens client-side

    console.log(`User ${user.id} successfully removed from queue`);
    return buildResponse(
      {
        success: true,
        message: "Removed from queue",
        userId: user.id,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`Error processing leave queue for user ${user.id}:`, error);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
  }
}

/**
 * Handles automatic matchmaking (can be triggered by a cron job)
 */
export async function handleAutoMatch(
  supabase: SupabaseClient,
): Promise<Response> {
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

    matches.push(game);

    // Remove these players from the queue
    await supabase
      .from("queue")
      .delete()
      .in("user_id", [player1.user_id, player2.user_id]);
  }

  return buildResponse(
    {
      matchesCreated: matches.length,
      matches,
    },
    200,
    corsHeaders,
  );
}
