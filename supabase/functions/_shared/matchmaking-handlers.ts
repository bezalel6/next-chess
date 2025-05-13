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
  console.log(
    `[EDGE] User ${user.id} attempting to join queue with params:`,
    params,
  );

  try {
    // Check if player already has active games
    console.log(`[EDGE] Checking if user ${user.id} has active games`);
    const { data: activeGames, error: countError } = await supabase
      .from("games")
      .select("id")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .eq("status", "active");

    if (countError) {
      console.error(
        `[EDGE] Failed to check active games for ${user.id}:`,
        countError,
      );
      return buildResponse(
        `Failed to check active games: ${countError.message}`,
        500,
        corsHeaders,
      );
    }

    // Optional: limit active games (configurable)
    const maxActiveGames = 1; // Could be moved to a configuration
    if (activeGames.length >= maxActiveGames) {
      console.log(
        `[EDGE] User ${user.id} already has ${activeGames.length} active games, denying queue join`,
      );
      return buildResponse(`Has active games`, 403, corsHeaders);
    }

    console.log(
      `[EDGE] User ${user.id} has ${activeGames.length} active games, proceeding with queue insertion`,
    );

    // Add the player to the queue - the database trigger will handle the matching
    console.log(`[EDGE] Adding user ${user.id} to the database queue`);
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
        // Unique constraint violation
        console.log(
          `[EDGE] User ${user.id} is already in the queue (constraint violation)`,
        );
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

      console.error(
        `[EDGE] Failed to add user ${user.id} to queue:`,
        insertError,
      );
      return buildResponse(
        `Failed to join queue: ${insertError.message}`,
        500,
        corsHeaders,
      );
    }

    console.log(
      `[EDGE] Successfully added user ${user.id} to the queue with entry:`,
      queueEntry,
    );

    // Check if the player was matched by the trigger
    // This happens when the trigger runs immediately after insertion
    console.log(
      `[EDGE] Checking if user ${user.id} was immediately matched by trigger`,
    );
    const { data: updatedQueue, error: checkError } = await supabase
      .from("queue")
      .select("status")
      .eq("id", queueEntry.id)
      .single();

    if (checkError) {
      console.log(
        `[EDGE] Failed to check if player ${user.id} was matched: ${checkError.message}`,
      );
      // Continue anyway, as the player was added to the queue
    }

    const wasMatched = updatedQueue && updatedQueue.status === "matched";
    console.log(
      `[EDGE] User ${user.id} match status:`,
      wasMatched ? "MATCHED" : "WAITING",
    );

    if (wasMatched) {
      // The player was matched by the trigger
      // Check for a game that includes this player that was just created
      console.log(`[EDGE] Player ${user.id} was matched, checking for game`);
      const { data: games, error: gameError } = await supabase
        .from("games")
        .select("*")
        .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (gameError) {
        console.error(
          `[EDGE] Failed to check for new game for ${user.id}:`,
          gameError,
        );
      } else if (games && games.length > 0) {
        console.log(
          `[EDGE] Player ${user.id} was matched with a game: ${games[0].id}`,
          games[0],
        );

        // Create notification for the match
        console.log(
          `[EDGE] Creating match notification for game ${games[0].id}`,
        );
        const { error: notificationError } = await supabase
          .from("queue_notifications")
          .insert({
            type: "match_found",
            game_id: games[0].id,
            white_player_id: games[0].white_player_id,
            black_player_id: games[0].black_player_id,
            data: {
              matchType: "auto",
              timestamp: new Date().toISOString(),
            },
          });

        if (notificationError) {
          console.error(
            `[EDGE] Failed to create notification for game ${games[0].id}:`,
            notificationError,
          );
          // Continue anyway
        } else {
          console.log(
            `[EDGE] Successfully created notification for game ${games[0].id}`,
          );
        }

        console.log(`[EDGE] Returning matched game ${games[0].id} to client`);
        return buildResponse(
          {
            success: true,
            message: "Match found",
            userId: user.id,
            timestamp: new Date().toISOString(),
            matchFound: true,
            game: games[0],
          },
          200,
          corsHeaders,
        );
      } else {
        console.log(`[EDGE] No game found for matched player ${user.id}`);
      }
    }

    console.log(`[EDGE] User ${user.id} added to queue and waiting for match`);
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
    console.error(
      `[EDGE] Error processing join queue for user ${user.id}:`,
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
 * Handles the queue leaving process
 */
export async function handleLeaveQueue(
  user: User,
  params: QueueParams,
  supabase: SupabaseClient,
): Promise<Response> {
  console.log(
    `[EDGE] User ${user.id} attempting to leave queue with params:`,
    params,
  );

  try {
    // First check if the user is actually in the queue
    console.log(`[EDGE] Checking if user ${user.id} is in the queue`);
    const { data: queueEntry, error: checkError } = await supabase
      .from("queue")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      console.error(
        `[EDGE] Failed to check queue for user ${user.id}:`,
        checkError,
      );
      return buildResponse(
        `Failed to check queue: ${checkError.message}`,
        500,
        corsHeaders,
      );
    }

    // If the user is in the queue, remove them
    if (queueEntry) {
      console.log(`[EDGE] Found queue entry for user ${user.id}:`, queueEntry);

      // Only remove if not already matched (matched players should be removed when a game is created)
      if (queueEntry.status === "waiting") {
        console.log(
          `[EDGE] User ${user.id} is in waiting status, proceeding with removal`,
        );
        const { error: deleteError } = await supabase
          .from("queue")
          .delete()
          .eq("user_id", user.id);

        if (deleteError) {
          console.error(
            `[EDGE] Failed to remove user ${user.id} from queue:`,
            deleteError,
          );
          return buildResponse(
            `Failed to leave queue: ${deleteError.message}`,
            500,
            corsHeaders,
          );
        }

        console.log(`[EDGE] User ${user.id} successfully removed from queue`);
      } else {
        console.log(
          `[EDGE] User ${user.id} already matched (status: ${queueEntry.status}), not removing from queue`,
        );
      }
    } else {
      console.log(
        `[EDGE] User ${user.id} not found in queue, nothing to remove`,
      );
    }

    console.log(
      `[EDGE] Successfully processed leave queue request for user ${user.id}`,
    );
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
    console.error(
      `[EDGE] Error processing leave queue for user ${user.id}:`,
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
