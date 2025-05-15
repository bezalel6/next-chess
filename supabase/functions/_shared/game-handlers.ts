/// <reference lib="deno.ns" />
import { Chess } from "chess-ts";
import {
  verifyGameAccess,
  validateMove,
  isGameOver,
  type ChessMove,
  type PlayerColor,
  type GameResult,
  type GameEndReason,
} from "./chess-utils.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { successResponse, errorResponse } from "./response-utils.ts";
import { dbQuery } from "./db-utils.ts";
import { validateWithZod, Schemas } from "./validation-utils.ts";
import { EventType, recordEvent } from "./event-utils.ts";

const logger = createLogger("GAME");

// Common parameter interfaces
interface GameParams {
  gameId: string;
}

interface MoveParams extends GameParams {
  move: ChessMove;
}

interface PlayerParams extends GameParams {
  playerColor?: PlayerColor;
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
 * Unified game operation handler that routes to specific handlers based on operation
 */
export async function handleGameOperation(
  user: User,
  params: any,
  supabase: SupabaseClient,
  operation: string,
): Promise<Response> {
  try {
    logger.info(
      `User ${user.id} performing ${operation} on game ${params.gameId}`,
    );

    // Validate gameId is always present
    if (!params.gameId) {
      return errorResponse("Missing required parameter: gameId", 400);
    }

    // Route to appropriate handler based on operation
    switch (operation) {
      case "makeMove":
        return await handleMakeMove(user, params as MoveParams, supabase);

      case "banMove":
        return await handleBanMove(user, params as MoveParams, supabase);

      case "resign":
        return await handleResignation(user, params as PlayerParams, supabase);

      case "offerDraw":
        return await handleGameOffer(user, params, supabase, "draw", "offer");
      case "acceptDraw":
        return await handleGameOffer(user, params, supabase, "draw", "accept");
      case "declineDraw":
        return await handleGameOffer(user, params, supabase, "draw", "decline");
      case "offerRematch":
        return await handleGameOffer(
          user,
          params,
          supabase,
          "rematch",
          "offer",
        );
      case "acceptRematch":
        return await handleGameOffer(
          user,
          params,
          supabase,
          "rematch",
          "accept",
        );
      case "declineRematch":
        return await handleGameOffer(
          user,
          params,
          supabase,
          "rematch",
          "decline",
        );

      case "mushroomGrowth":
        return await handleMushroomGrowth(user, params, supabase);

      default:
        return errorResponse(`Unknown operation: ${operation}`, 400);
    }
  } catch (error) {
    logger.error(`Error in game operation ${operation}:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles making a move in a chess game
 */
async function handleMakeMove(
  user: User,
  params: MoveParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    // Validate required params using Zod
    const validation = validateWithZod(params, Schemas.MoveParams);
    if (!validation.valid) {
      return errorResponse(validation.errors!.join("; "), 400);
    }

    const { gameId, move } = params;

    // Verify game access - must be player's turn
    const { game, playerColor, authorized, error } = await verifyGameAccess(
      supabase,
      gameId,
      user.id,
      true, // requires turn
    );

    if (!authorized) {
      return errorResponse(error, 403);
    }

    // Validate the move using chess rules, passing the current PGN to preserve history
    const moveResult = validateMove(game.current_fen, move, game.pgn);
    if (!moveResult.valid) {
      return errorResponse(moveResult.error, 400);
    }

    // Check game over conditions using PGN to account for banned moves
    const gameOverState = isGameOver(moveResult.newFen, moveResult.newPgn);
    const status = gameOverState.isOver ? "finished" : "active";

    // Update the game with the new state
    const { data: updatedGame, error: updateError } = await dbQuery(
      supabase,
      "games",
      "update",
      {
        data: {
          current_fen: moveResult.newFen,
          pgn: moveResult.newPgn,
          last_move: move,
          turn: playerColor === "white" ? "black" : "white",
          banning_player: playerColor,
          status,
          result: gameOverState.result,
          end_reason: gameOverState.reason,
          draw_offered_by: null, // Clear any pending draw offers
        },
        match: { id: gameId },
        select: "*",
        single: true,
        operation: "update game state",
      },
    );

    if (updateError) {
      return errorResponse(
        `Failed to update game: ${updateError.message}`,
        500,
      );
    }

    // Record the move in move history
    await dbQuery(supabase, "moves", "insert", {
      data: {
        game_id: gameId,
        move,
        created_by: user.id,
        position_fen: moveResult.newFen,
      },
      operation: "record move",
    });

    // Record event
    await recordEvent(
      supabase,
      EventType.MOVE_MADE,
      {
        game_id: gameId,
        move,
        fen: moveResult.newFen,
      },
      user.id,
    );

    // If game ended, record that too
    if (gameOverState.isOver) {
      await recordEvent(
        supabase,
        EventType.GAME_ENDED,
        {
          game_id: gameId,
          result: gameOverState.result,
          reason: gameOverState.reason,
        },
        user.id,
      );
    }

    return successResponse(updatedGame);
  } catch (error) {
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles banning a move in a chess game
 */
async function handleBanMove(
  user: User,
  params: MoveParams,
  supabase: SupabaseClient,
): Promise<Response> {
  // Validate required params using Zod
  const validation = validateWithZod(params, Schemas.MoveParams);
  if (!validation.valid) {
    return errorResponse(validation.errors!.join("; "), 400);
  }

  const { gameId, move } = params;

  // Verify game access
  const { game, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
  );

  if (!authorized) {
    return errorResponse(error, 403);
  }

  // Check if this player is allowed to ban
  const userColor = game.white_player_id === user.id ? "white" : "black";
  if (game.banning_player !== userColor) {
    return errorResponse(
      `Player ${user.id} (${userColor}) attempted to ban a move but only ${game.banning_player} player can ban moves at this time\n${JSON.stringify(game, null, 2)}`,
      403,
    );
  }

  // Parse the existing PGN and add the banned move as a comment
  const chess = new Chess(game.current_fen);
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  }
  chess.setComment(`banning: ${move.from}${move.to}`);
  const updatedPgn = chess.pgn();

  // Check if the game is over after banning this move
  const gameOverState = isGameOver(game.current_fen, updatedPgn);
  const updateData: Record<string, any> = {
    banning_player: null,
    pgn: updatedPgn,
  };

  // If the game is over after this ban, update the game status
  if (gameOverState.isOver) {
    updateData.status = "finished";
    updateData.result = gameOverState.result;
    updateData.end_reason = gameOverState.reason;
  }

  // Update the game
  const { data: updatedGame, error: updateError } = await dbQuery(
    supabase,
    "games",
    "update",
    {
      data: updateData,
      match: { id: gameId },
      select: "*",
      single: true,
      operation: "update game ban move",
    },
  );

  if (updateError) {
    return errorResponse(`Failed to update game: ${updateError.message}`, 500);
  }

  // Record ban event
  await recordEvent(
    supabase,
    EventType.GAME_UPDATED,
    {
      game_id: gameId,
      move,
      action: "move_banned",
    },
    user.id,
  );

  // If game ended because of this ban, record that too
  if (gameOverState.isOver) {
    await recordEvent(
      supabase,
      EventType.GAME_ENDED,
      {
        game_id: gameId,
        result: gameOverState.result,
        reason: gameOverState.reason,
      },
      user.id,
    );
  }

  return successResponse(updatedGame);
}

/**
 * Handles game offers (draw/rematch)
 */
async function handleGameOffer(
  user: User,
  params: PlayerParams,
  supabase: SupabaseClient,
  offerType: "draw" | "rematch",
  action: "offer" | "accept" | "decline",
): Promise<Response> {
  // Validate required params using Zod
  const validation = validateWithZod(params, Schemas.PlayerParams);
  if (!validation.valid) {
    return errorResponse(validation.errors!.join("; "), 400);
  }

  const { gameId } = params;

  // Verify game access
  const { game, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
  );

  if (!authorized) {
    return errorResponse(error, 403);
  }

  const userColor = game.white_player_id === user.id ? "white" : "black";
  const field = `${offerType}_offered_by`;

  if (action === "offer") {
    // Handle offering
    const { data: updatedGame, error: updateError } = await dbQuery(
      supabase,
      "games",
      "update",
      {
        data: { [field]: userColor },
        match: { id: gameId },
        select: "*",
        single: true,
        operation: `offer ${offerType}`,
      },
    );

    if (updateError) {
      return errorResponse(
        `Failed to offer ${offerType}: ${updateError.message}`,
        500,
      );
    }

    await recordEvent(
      supabase,
      EventType.OFFER_MADE,
      { game_id: gameId, offer_type: offerType },
      user.id,
    );

    return successResponse(updatedGame);
  } else if (action === "decline") {
    // Handle declining
    const { data: updatedGame, error: updateError } = await dbQuery(
      supabase,
      "games",
      "update",
      {
        data: { [field]: null },
        match: { id: gameId },
        select: "*",
        single: true,
        operation: `decline ${offerType}`,
      },
    );

    if (updateError) {
      return errorResponse(
        `Failed to decline ${offerType}: ${updateError.message}`,
        500,
      );
    }

    await recordEvent(
      supabase,
      EventType.OFFER_DECLINED,
      { game_id: gameId, offer_type: offerType },
      user.id,
    );

    return successResponse(updatedGame);
  } else if (action === "accept") {
    // Handle accepting
    if (offerType === "draw") {
      const { data: updatedGame, error: updateError } = await dbQuery(
        supabase,
        "games",
        "update",
        {
          data: {
            status: "finished",
            result: "draw",
            [field]: null,
            end_reason: "draw_agreement",
          },
          match: { id: gameId },
          select: "*",
          single: true,
          operation: "accept draw",
        },
      );

      if (updateError) {
        return errorResponse(
          `Failed to accept draw: ${updateError.message}`,
          500,
        );
      }

      // Record events
      await recordEvent(
        supabase,
        EventType.OFFER_ACCEPTED,
        { game_id: gameId, offer_type: offerType },
        user.id,
      );

      await recordEvent(
        supabase,
        EventType.GAME_ENDED,
        { game_id: gameId, result: "draw", reason: "draw_agreement" },
        user.id,
      );

      return successResponse(updatedGame);
    } else if (offerType === "rematch") {
      // Generate a new game ID
      const newGameId = generateShortId();

      // Create a new game with swapped colors
      const { data: newGame, error: createError } = await dbQuery(
        supabase,
        "games",
        "insert",
        {
          data: {
            id: newGameId,
            white_player_id: game.black_player_id,
            black_player_id: game.white_player_id,
            status: "active",
            current_fen:
              "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            pgn: "",
            turn: "white",
            banning_player: "black",
            parent_game_id: gameId,
          },
          select: "*",
          single: true,
          operation: "create rematch game",
        },
      );

      if (createError) {
        return errorResponse(
          `Failed to create rematch game: ${createError.message}`,
          500,
        );
      }

      // Clear the rematch offer from the original game
      await dbQuery(supabase, "games", "update", {
        data: { [field]: null },
        match: { id: gameId },
        operation: "clear rematch offer",
      });

      // Record events
      await recordEvent(
        supabase,
        EventType.OFFER_ACCEPTED,
        {
          game_id: gameId,
          offer_type: offerType,
          new_game_id: newGame.id,
        },
        user.id,
      );

      await recordEvent(
        supabase,
        EventType.GAME_CREATED,
        {
          game_id: newGame.id,
          parent_game_id: gameId,
        },
        user.id,
      );

      return successResponse(newGame);
    }
  }

  return errorResponse(`Invalid action ${action} for ${offerType}`, 400);
}

/**
 * Handles game resignation
 */
async function handleResignation(
  user: User,
  params: PlayerParams,
  supabase: SupabaseClient,
): Promise<Response> {
  // Validate required params using Zod
  const validation = validateWithZod(params, Schemas.PlayerParams);
  if (!validation.valid) {
    console.log(params);
    return errorResponse(validation.errors!.join("; "), 400);
  }

  const { gameId } = params;

  // Verify game access
  const { game, playerColor, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
  );

  if (!authorized) {
    return errorResponse(error, 403);
  }

  // When a player resigns, the opponent wins
  const result = playerColor === "white" ? "black" : "white";

  const { data: updatedGame, error: updateError } = await dbQuery(
    supabase,
    "games",
    "update",
    {
      data: {
        status: "finished",
        result,
        end_reason: "resignation",
      },
      match: { id: gameId },
      select: "*",
      single: true,
      operation: "resign game",
    },
  );

  if (updateError) {
    return errorResponse(`Failed to resign game: ${updateError.message}`, 500);
  }

  // Record event
  await recordEvent(
    supabase,
    EventType.GAME_ENDED,
    {
      game_id: gameId,
      result,
      reason: "resignation",
    },
    user.id,
  );

  return successResponse(updatedGame);
}

/**
 * Special mushroom growth transformation handler
 */
async function handleMushroomGrowth(
  user: User,
  params: GameParams,
  supabase: SupabaseClient,
): Promise<Response> {
  // Validate required params using Zod
  const validation = validateWithZod(params, Schemas.GameParams);
  if (!validation.valid) {
    return errorResponse(validation.errors!.join("; "), 400);
  }

  const { gameId } = params;

  // Verify game access - must be player's turn
  const { game, playerColor, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
    true, // requires turn
  );

  if (!authorized) {
    return errorResponse(error, 403);
  }

  // Implement mushroom transformation (pawns to queens)
  const chess = new Chess(game.current_fen);
  let fen = chess.fen();

  // Transform pawns to queens for the current player
  if (playerColor === "white") {
    fen = fen.replace(/P/g, "Q");
  } else {
    fen = fen.replace(/p/g, "q");
  }

  // Set the custom position and create a new PGN
  chess.load(fen);

  // Preserve existing PGN comments/history and add transformation record
  let newPgn = game.pgn;
  if (!newPgn || newPgn.trim() === "") {
    newPgn = `[SetUp "1"]\n[FEN "${fen}"]`;
  } else {
    // Add a comment to indicate mushroom transformation
    chess.loadPgn(game.pgn);
    chess.setComment(`mushroom_transformation: ${playerColor}`);
    newPgn = chess.pgn();
  }

  // Check if the game is over after the transformation
  const gameOverState = isGameOver(fen, newPgn);

  const updateData: Record<string, any> = {
    current_fen: fen,
    pgn: newPgn,
    turn: playerColor === "white" ? "black" : "white", // Switch turns after transformation
  };

  // If game is over, update status accordingly
  if (gameOverState.isOver) {
    updateData.status = "finished";
    updateData.result = gameOverState.result;
    updateData.end_reason = gameOverState.reason;
  }

  // Update the game with the mushroom transformation
  const { data: updatedGame, error: updateError } = await dbQuery(
    supabase,
    "games",
    "update",
    {
      data: updateData,
      match: { id: gameId },
      select: "*",
      single: true,
      operation: "apply mushroom transformation",
    },
  );

  if (updateError) {
    return errorResponse(
      `Failed to apply mushroom transformation: ${updateError.message}`,
      500,
    );
  }

  // Record event
  await recordEvent(
    supabase,
    EventType.GAME_UPDATED,
    {
      game_id: gameId,
      transformation: "mushroom_growth",
      player_color: playerColor,
    },
    user.id,
  );

  // If game ended after transformation, record that too
  if (gameOverState.isOver) {
    await recordEvent(
      supabase,
      EventType.GAME_ENDED,
      {
        game_id: gameId,
        result: gameOverState.result,
        reason: gameOverState.reason,
      },
      user.id,
    );
  }

  return successResponse(updatedGame);
}
