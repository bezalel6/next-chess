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
 * Simple handler for joining the matchmaking queue
 */
export async function handleJoinQueue(
  user: User,
  params: QueueParams,
  supabase: SupabaseClient,
): Promise<Response> {
  console.log(`[MATCHMAKING] User ${user.id} joining queue`);

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
    const { data: existingEntry, error: queueError } = await supabase
      .from("queue")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (queueError) {
      console.error(
        `[MATCHMAKING] Error checking queue: ${queueError.message}`,
      );
      return buildResponse(
        `Error checking queue: ${queueError.message}`,
        500,
        corsHeaders,
      );
    }

    // 3. Handle existing queue entries
    if (existingEntry) {
      console.log(
        `[MATCHMAKING] User ${user.id} already in queue with status: ${existingEntry.status}`,
      );

      if (existingEntry.status === "matched") {
        // Already matched - create or check for game
        return await createOrFindGame(user.id, supabase);
      }

      // Already waiting in queue
      return buildResponse(
        {
          success: true,
          message: "Already in queue",
          status: existingEntry.status,
        },
        200,
        corsHeaders,
      );
    }

    // 4. Add to queue
    console.log(`[MATCHMAKING] Adding user ${user.id} to queue`);
    const { data: newEntry, error: insertError } = await supabase
      .from("queue")
      .insert({
        user_id: user.id,
        status: "waiting",
        preferences: params.preferences || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error(
        `[MATCHMAKING] Error adding to queue: ${insertError.message}`,
      );
      return buildResponse(
        `Error joining queue: ${insertError.message}`,
        500,
        corsHeaders,
      );
    }

    // 5. Check if immediately matched by trigger
    const { data: updated, error: statusError } = await supabase
      .from("queue")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (statusError) {
      console.log(
        `[MATCHMAKING] Error checking updated status: ${statusError.message}`,
      );
      // Continue with default response
    } else if (updated && updated.status === "matched") {
      console.log(
        `[MATCHMAKING] User ${user.id} immediately matched, creating game`,
      );
      return await createOrFindGame(user.id, supabase);
    }

    // 6. Return default waiting response
    return buildResponse(
      {
        success: true,
        message: "Added to queue",
        status: "waiting",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[MATCHMAKING] Error in join queue: ${error.message}`);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
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
  console.log(`[MATCHMAKING] Checking status for user ${user.id}`);

  try {
    // 1. Check queue status
    const { data: queueEntry, error: queueError } = await supabase
      .from("queue")
      .select("status, joined_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (queueError) {
      console.error(
        `[MATCHMAKING] Error checking queue: ${queueError.message}`,
      );
      return buildResponse(
        `Error checking status: ${queueError.message}`,
        500,
        corsHeaders,
      );
    }

    // 2. Not in queue
    if (!queueEntry) {
      return buildResponse(
        {
          success: true,
          inQueue: false,
          message: "Not in queue",
        },
        200,
        corsHeaders,
      );
    }

    // 3. In queue with matched status - create or find game
    if (queueEntry.status === "matched") {
      return await createOrFindGame(user.id, supabase);
    }

    // 4. In queue with waiting status
    if (queueEntry.status === "waiting") {
      const joinedAt = new Date(queueEntry.joined_at);
      const waitSeconds = Math.floor((Date.now() - joinedAt.getTime()) / 1000);

      return buildResponse(
        {
          success: true,
          inQueue: true,
          status: "waiting",
          waitTimeSeconds: waitSeconds,
          message: "Waiting for match",
        },
        200,
        corsHeaders,
      );
    }

    // 5. Unknown status
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
    console.error(`[MATCHMAKING] Error checking status: ${error.message}`);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
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
  console.log(`[MATCHMAKING] User ${user.id} leaving queue`);

  try {
    // Delete from queue regardless of status
    const { error: deleteError } = await supabase
      .from("queue")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error(
        `[MATCHMAKING] Error leaving queue: ${deleteError.message}`,
      );
      return buildResponse(
        `Error leaving queue: ${deleteError.message}`,
        500,
        corsHeaders,
      );
    }

    return buildResponse(
      {
        success: true,
        message: "Removed from queue",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[MATCHMAKING] Error leaving queue: ${error.message}`);
    return buildResponse(
      `Internal server error: ${error.message}`,
      500,
      corsHeaders,
    );
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
  console.log(`[MATCHMAKING] Creating or finding game for user ${userId}`);

  try {
    // 1. Check if we already have a game created for this user
    // Need to look for notifications since the player might be a participant
    // in multiple games
    const { data: notification, error: notifError } = await supabase
      .from("queue_notifications")
      .select("game_id, white_player_id, black_player_id")
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .eq("type", "match_found")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (notifError && !notifError.message.includes("No rows found")) {
      console.error(
        `[MATCHMAKING] Error fetching notifications: ${notifError.message}`,
      );
      return buildResponse(
        `Database error: ${notifError.message}`,
        500,
        corsHeaders,
      );
    }

    if (notification?.game_id) {
      console.log(
        `[MATCHMAKING] Found existing game ${notification.game_id} for user ${userId}`,
      );

      // Check the game details to return to client
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select(
          "id, white_player_id, black_player_id, status, created_at, current_fen, turn",
        )
        .eq("id", notification.game_id)
        .single();

      if (gameError) {
        console.error(
          `[MATCHMAKING] Error fetching game details: ${gameError.message}`,
        );
        return buildResponse(
          `Database error: ${gameError.message}`,
          500,
          corsHeaders,
        );
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

      return buildResponse(
        {
          success: true,
          matchFound: true,
          message: "Match found and game already created",
          game,
        },
        200,
        corsHeaders,
      );
    }

    // 2. Request the edge function to create the game from matched players
    // This uses an internal edge function call to create the game with service role privileges
    console.log(
      `[MATCHMAKING] No existing game, creating new game from matched players`,
    );
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
      console.log(`[MATCHMAKING] Successfully created game ${gameResult.id}`);
      return buildResponse(
        {
          success: true,
          matchFound: true,
          message: "Match found and game created",
          game: gameResult,
        },
        200,
        corsHeaders,
      );
    }

    // 4. Return waiting for 2nd player if no game could be created yet
    return buildResponse(
      {
        success: true,
        matchFound: false,
        message: "Matched but waiting for game creation",
        status: "matched_pending",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error(`[MATCHMAKING] Error in createOrFindGame: ${error.message}`);
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
