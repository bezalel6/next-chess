/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { buildResponse } from "./chess-utils.ts";
import { createGameFromMatchedPlayers } from "./db-trigger-handlers.ts";
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
    // Check if player is already in queue
    const { data: existingQueue, error: queueCheckError } = await supabase
      .from("queue")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (queueCheckError) {
      console.error(
        `[EDGE] Error checking existing queue: ${queueCheckError.message}`,
      );
    } else if (existingQueue) {
      console.log(
        `[EDGE] User ${user.id} already in queue with status: ${existingQueue.status}`,
      );

      // If already matched, try to create a game or find an existing one
      if (existingQueue.status === "matched") {
        // Try to create a game for matched players
        console.log(
          `[EDGE] User ${user.id} is already matched, checking/creating game`,
        );
        const gameResponse = await createGameFromMatchedPlayers(supabase);

        try {
          const gameResult = await gameResponse.json();
          if (gameResult.game) {
            return buildResponse(
              {
                success: true,
                message: "Match found and game created",
                matchFound: true,
                game: gameResult.game,
              },
              200,
              corsHeaders,
            );
          }
        } catch (parseError) {
          console.error(
            `[EDGE] Error parsing game creation response: ${parseError.message}`,
          );
        }
      }

      return buildResponse(
        {
          success: true,
          message: `Already in queue with status: ${existingQueue.status}`,
          queueEntry: existingQueue,
          status: existingQueue.status,
        },
        200,
        corsHeaders,
      );
    }

    // Check if player already has active games
    const { data: activeGames, error: gameCheckError } = await supabase
      .from("games")
      .select("id")
      .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
      .eq("status", "active");

    if (gameCheckError) {
      console.error(
        `[EDGE] Error checking active games: ${gameCheckError.message}`,
      );
      return buildResponse(
        `Error checking active games: ${gameCheckError.message}`,
        500,
        corsHeaders,
      );
    }

    // Optional: prevent joining if player already has active games
    const maxActiveGames = 1; // Could be configurable
    if (activeGames && activeGames.length >= maxActiveGames) {
      console.log(
        `[EDGE] User ${user.id} already has ${activeGames.length} active games`,
      );
      return buildResponse(
        {
          success: false,
          message: "Already has active games",
          activeGames: activeGames,
        },
        403,
        corsHeaders,
      );
    }

    // Add player to queue - database trigger will handle matching
    console.log(`[EDGE] Adding user ${user.id} to matchmaking queue`);
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
      console.error(`[EDGE] Error joining queue: ${insertError.message}`);
      return buildResponse(
        `Failed to join queue: ${insertError.message}`,
        500,
        corsHeaders,
      );
    }

    console.log(`[EDGE] User ${user.id} added to queue successfully`);

    // Check if the player was matched by the trigger
    const { data: updatedQueue, error: statusError } = await supabase
      .from("queue")
      .select("status")
      .eq("id", queueEntry.id)
      .single();

    if (statusError) {
      console.log(`[EDGE] Error checking match status: ${statusError.message}`);
      // Continue with original queue status
    } else if (updatedQueue && updatedQueue.status === "matched") {
      console.log(
        `[EDGE] User ${user.id} was immediately matched, creating game`,
      );

      // Create game for the matched players
      const gameResponse = await createGameFromMatchedPlayers(supabase);

      try {
        const gameResult = await gameResponse.json();
        if (gameResult.game) {
          console.log(
            `[EDGE] Game created successfully: ${gameResult.game.id}`,
          );
          return buildResponse(
            {
              success: true,
              message: "Match found and game created",
              matchFound: true,
              game: gameResult.game,
            },
            200,
            corsHeaders,
          );
        }
      } catch (parseError) {
        console.error(
          `[EDGE] Error parsing game creation response: ${parseError.message}`,
        );
      }
    }

    // Default response - added to queue and waiting
    return buildResponse(
      {
        success: true,
        message: "Added to queue, waiting for match",
        queueEntry: queueEntry,
        status: "waiting",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[EDGE] Error in join queue handler: ${error.message}`);
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

/**
 * Checks the current status of a player in the matchmaking queue
 * Clients can poll this endpoint to get updates
 */
export async function handleCheckMatchmakingStatus(
  user: User,
  params: QueueParams,
  supabase: SupabaseClient,
): Promise<Response> {
  console.log(`[EDGE] Checking matchmaking status for user ${user.id}`);

  try {
    // Check if player is in queue and what their status is
    const { data: queueEntry, error: queueError } = await supabase
      .from("queue")
      .select("id, status, joined_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (queueError) {
      console.error(
        `[EDGE] Error checking queue status: ${queueError.message}`,
      );
      return buildResponse(
        `Error checking queue status: ${queueError.message}`,
        500,
        corsHeaders,
      );
    }

    // Not in queue
    if (!queueEntry) {
      return buildResponse(
        {
          success: true,
          inQueue: false,
          message: "Not in matchmaking queue",
        },
        200,
        corsHeaders,
      );
    }

    // In waiting status - just return current wait time
    if (queueEntry.status === "waiting") {
      const joinedAt = new Date(queueEntry.joined_at);
      const waitTimeMs = Date.now() - joinedAt.getTime();
      const waitTimeSeconds = Math.floor(waitTimeMs / 1000);

      return buildResponse(
        {
          success: true,
          inQueue: true,
          status: "waiting",
          waitTimeSeconds: waitTimeSeconds,
          message: "Waiting for match",
        },
        200,
        corsHeaders,
      );
    }

    // Matched status - try to create or find game
    if (queueEntry.status === "matched") {
      console.log(`[EDGE] User ${user.id} is matched, checking/creating game`);

      // First check if there's already a game
      const { data: games, error: gameError } = await supabase
        .from("games")
        .select("*")
        .or(`white_player_id.eq.${user.id},black_player_id.eq.${user.id}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (gameError) {
        console.error(
          `[EDGE] Error checking for existing games: ${gameError.message}`,
        );
      } else if (games && games.length > 0) {
        console.log(
          `[EDGE] Found existing game ${games[0].id} for matched user ${user.id}`,
        );
        return buildResponse(
          {
            success: true,
            inQueue: false,
            matchFound: true,
            status: "matched_with_game",
            game: games[0],
            message: "Match found with existing game",
          },
          200,
          corsHeaders,
        );
      }

      // No existing game found, try to create one
      console.log(
        `[EDGE] No existing game found for matched user ${user.id}, creating new game`,
      );
      const gameResponse = await createGameFromMatchedPlayers(supabase);

      try {
        const gameResult = await gameResponse.json();
        if (gameResult.game) {
          console.log(
            `[EDGE] Game created successfully: ${gameResult.game.id}`,
          );
          return buildResponse(
            {
              success: true,
              inQueue: false,
              matchFound: true,
              status: "matched_with_game",
              game: gameResult.game,
              message: "Match found and game created",
            },
            200,
            corsHeaders,
          );
        } else {
          return buildResponse(
            {
              success: true,
              inQueue: true,
              status: "matched_without_game",
              message: "Matched but waiting for game creation",
            },
            200,
            corsHeaders,
          );
        }
      } catch (parseError) {
        console.error(
          `[EDGE] Error parsing game creation response: ${parseError.message}`,
        );
        return buildResponse(
          {
            success: true,
            inQueue: true,
            status: "matched_without_game",
            message: "Matched but error creating game",
          },
          200,
          corsHeaders,
        );
      }
    }

    // Unknown status
    return buildResponse(
      {
        success: true,
        inQueue: true,
        status: queueEntry.status,
        message: `In queue with status: ${queueEntry.status}`,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[EDGE] Error checking matchmaking status: ${error.message}`);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
  }
}
