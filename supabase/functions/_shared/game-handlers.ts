/// <reference lib="deno.ns" />
import { Chess } from "https://esm.sh/chess.ts@0.16.2";
import {
  verifyGameAccess,
  validateMove,
  isGameOver,
  type ChessMove,
  type PlayerColor,
  type GameResult,
  type GameEndReason,
} from "./chess-utils.ts";
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { successResponse, errorResponse } from "./response-utils.ts";
import { getTable, logOperation, ensureSingle } from "./db-utils.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";
import { validateWithZod, Schemas } from "./validation-utils.ts";
import { EventType, recordEvent } from "./event-utils.ts";
import type { Json } from "./database-types.ts";
import { 
  handleMoveClockUpdate, 
  checkTimeViolations,
  initializeGameClock 
} from "./clock-handlers.ts";

const logger = createLogger("GAME");

// Detects PostgREST schema-cache or missing-column errors for the optional `version` column
function shouldFallbackVersionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "") as string;
  const details = (err.details || "") as string;
  return (
    msg.includes('column "version" does not exist') ||
    details.includes('version') ||
    msg.toLowerCase().includes('schema cache') ||
    msg.includes("Could not find the 'version' column") ||
    msg.includes("'version' column of 'games'")
  );
}

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
 * Unified game operation handler that routes to specific handlers based on operation
 */
export async function handleGameOperation(
  user: User,
  params: any,
  supabase: TypedSupabaseClient,
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
  supabase: TypedSupabaseClient,
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
    
    // Create chess instance to get move details
    const chess = new Chess(game.current_fen);
    if (game.pgn) {
      try {
        chess.loadPgn(game.pgn);
      } catch (e) {
        // Continue with fresh instance if PGN load fails
      }
    }
    chess.move(move as any);

    // Check game over conditions using PGN to account for banned moves
    const gameOverState = isGameOver(moveResult.newFen, moveResult.newPgn);
    const status = gameOverState.isOver ? "finished" : "active";

    // Update the game with the new state (attempt version bump if column exists)
    const updatedGameRes = await getTable(
      supabase,
      "games",
    )
      .update({
        current_fen: moveResult.newFen,
        pgn: moveResult.newPgn,
        last_move: move as unknown as Json, // Type cast for database storage
        turn: playerColor === "white" ? "black" : "white",
        banning_player: status === "finished" ? null : playerColor, // Player who just moved now bans opponent's next move
        current_banned_move: null, // Clear the banned move after it's been avoided
        status,
        result: gameOverState.result,
        end_reason: gameOverState.reason,
        draw_offered_by: null, // Clear any pending draw offers
        version: ((game as any).version ?? 0) + 1,
      } as any)
      .eq("id", gameId)
      .select("*")
      .maybeSingle();

    let updatedGame = updatedGameRes.data;
    let updateError = updatedGameRes.error as any;
    logOperation("update game state (with version)", updateError);

    // If version column doesn't exist, retry without setting it
    if (shouldFallbackVersionError(updateError)) {
      const fallbackRes = await getTable(
        supabase,
        "games",
      )
        .update({
          current_fen: moveResult.newFen,
          pgn: moveResult.newPgn,
          last_move: move as unknown as Json,
          turn: playerColor === "white" ? "black" : "white",
          banning_player: status === "finished" ? null : playerColor,
          current_banned_move: null,
          status,
          result: gameOverState.result,
          end_reason: gameOverState.reason,
          draw_offered_by: null,
        })
        .eq("id", gameId)
        .select("*")
        .maybeSingle();
      updatedGame = fallbackRes.data;
      updateError = fallbackRes.error as any;
      logOperation("update game state (fallback no version)", updateError);
    }

    if (updateError) {
      return errorResponse(
        `Failed to update game: ${updateError.message}`,
        500,
      );
    }

    // Handle clock update for the move
    let clockUpdate = null;
    if (status === "active" && game.time_control) {
      try {
        clockUpdate = await handleMoveClockUpdate(supabase, gameId, playerColor);
        logger.info(`Clock updated after move for game ${gameId}`, clockUpdate);
      } catch (clockErr) {
        logger.error(`Failed to update clock for game ${gameId}:`, clockErr);
        // Continue even if clock update fails
      }
    }

    // Check for time violations after the move
    if (status === "active") {
      const flaggedPlayer = await checkTimeViolations(supabase, gameId);
      if (flaggedPlayer) {
        logger.info(`Player ${flaggedPlayer} flagged in game ${gameId}`);
        // Game status already updated by checkTimeViolations
      }
    }

    // Calculate move details for the moves table
    const moveHistory = chess.history({ verbose: true });
    const lastMove = moveHistory[moveHistory.length - 1];
    const plyNumber = moveHistory.length - 1;
    const moveNumber = Math.floor(plyNumber / 2) + 1;
    
    // Get any banned move for this ply from the game state
    const bannedMove = game.current_banned_move;
    
    // Record the move in move history table
    const { error: moveError } = await (supabase as any).from("moves").insert({
      game_id: gameId,
      move_number: moveNumber,
      ply_number: plyNumber,
      player_color: playerColor,
      from_square: move.from,
      to_square: move.to,
      promotion: move.promotion || null,
      san: lastMove?.san || "",
      fen_after: moveResult.newFen,
      banned_from: bannedMove?.from || null,
      banned_to: bannedMove?.to || null,
      banned_by: bannedMove ? (playerColor === "white" ? "black" : "white") : null,
      created_by: user.id,
    });

    logOperation("record move", moveError);

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
  supabase: TypedSupabaseClient,
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
  logger.info(`Current game PGN: ${game.pgn || 'empty'}`);
  const chess = new Chess(game.current_fen);
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  }
  chess.setComment(`banning: ${move.from}${move.to}`);
  const updatedPgn = chess.pgn();
  logger.info(`Updated PGN after adding ban comment: ${updatedPgn}`);

  // Check if the game is over after banning this move
  const gameOverState = isGameOver(game.current_fen, updatedPgn);
  const updateData: Record<string, any> = {
    banning_player: null, // Clear banning_player so the turn player can move
    pgn: updatedPgn,
    current_banned_move: { from: move.from, to: move.to }, // Track the banned move for this turn
  };

  // If the game is over after this ban, update the game status
  if (gameOverState.isOver) {
    updateData.status = "finished";
    updateData.result = gameOverState.result;
    updateData.end_reason = gameOverState.reason;
  }

  // Update the game
  // Attempt to bump version if column exists
  const updatedGameRes = await getTable(
    supabase,
    "games",
  )
    .update({
      ...updateData,
      version: ((game as any).version ?? 0) + 1,
    } as any)
    .eq("id", gameId)
    .select("*")
    .maybeSingle();

  let updatedGame = updatedGameRes.data;
  let updateError = updatedGameRes.error as any;
  logOperation("update game ban move (with version)", updateError);

  if (shouldFallbackVersionError(updateError)) {
    const fallbackRes = await getTable(
      supabase,
      "games",
    )
      .update(updateData)
      .eq("id", gameId)
      .select("*")
      .maybeSingle();
    updatedGame = fallbackRes.data;
    updateError = fallbackRes.error as any;
    logOperation("update game ban move (fallback no version)", updateError);
  }

  if (updateError) {
    return errorResponse(`Failed to update game: ${updateError.message}`, 500);
  }

  // Calculate ply number for the ban
  // Bans happen before moves, so the ply number is the current turn's ply
  const moveHistory = chess.history({ verbose: true });
  const plyNumber = moveHistory.length; // This will be 0 for first ban, 1 after white's first move, etc.
  const moveNumber = Math.floor(plyNumber / 2) + 1;
  
  // Store ban in history table for analysis
  const { error: historyError } = await (supabase as any).from("ban_history").insert({
    game_id: gameId,
    move_number: moveNumber,
    banned_by: userColor,
    banned_move: { from: move.from, to: move.to },
  });

  logOperation("record ban history", historyError);

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
  supabase: TypedSupabaseClient,
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
    const { data: updatedGame, error: updateError } = await getTable(
      supabase,
      "games",
    )
      .update({ [field]: userColor })
      .eq("id", gameId)
      .select("*")
      .maybeSingle();

    logOperation(`offer ${offerType}`, updateError);

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
    const updatedGameRes = await getTable(
      supabase,
      "games",
    )
      .update({ [field]: null, version: ((game as any).version ?? 0) + 1 } as any)
      .eq("id", gameId)
      .select("*")
      .maybeSingle();

    let updatedGame = updatedGameRes.data;
    let updateError = updatedGameRes.error as any;

    if (shouldFallbackVersionError(updateError)) {
      const fallbackRes = await getTable(
        supabase,
        "games",
      )
        .update({ [field]: null })
        .eq("id", gameId)
        .select("*")
        .maybeSingle();
      updatedGame = fallbackRes.data;
      updateError = fallbackRes.error as any;
    }

    logOperation(`decline ${offerType}`, updateError);

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
      const updatedGameRes = await getTable(
        supabase,
        "games",
      )
        .update({
          status: "finished",
          result: "draw",
          [field]: null,
          end_reason: "draw_agreement",
          version: ((game as any).version ?? 0) + 1,
        } as any)
        .eq("id", gameId)
        .select("*")
        .maybeSingle();

      let updatedGame = updatedGameRes.data;
      let updateError = updatedGameRes.error as any;

      if (shouldFallbackVersionError(updateError)) {
        const fallbackRes = await getTable(
          supabase,
          "games",
        )
          .update({
            status: "finished",
            result: "draw",
            [field]: null,
            end_reason: "draw_agreement",
          })
          .eq("id", gameId)
          .select("*")
          .maybeSingle();
        updatedGame = fallbackRes.data;
        updateError = fallbackRes.error as any;
      }

      logOperation("accept draw", updateError);

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
// Create a new game with swapped colors
      const { data: newGame, error: createError } = await getTable(
        supabase,
        "games",
      )
        .insert({
          white_player_id: game.black_player_id,
          black_player_id: game.white_player_id,
          status: "active",
          current_fen:
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          pgn: "",
          turn: "white",
          banning_player: "black", // Black always bans before White's first move
          parent_game_id: gameId,
        })
        .select("*")
        .maybeSingle();

      logOperation("create rematch game", createError);

      if (createError) {
        return errorResponse(
          `Failed to create rematch game: ${createError.message}`,
          500,
        );
      }

      // Clear the rematch offer from the original game
      await getTable(supabase, "games")
        .update({ [field]: null })
        .eq("id", gameId);

      logOperation("clear rematch offer");

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
  supabase: TypedSupabaseClient,
): Promise<Response> {
  // Validate required params using Zod
  const validation = validateWithZod(params, Schemas.PlayerParams);
  if (!validation.valid) {
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

  const updatedGameRes = await getTable(
    supabase,
    "games",
  )
    .update({
      status: "finished",
      result,
      end_reason: "resignation",
      version: ((game as any).version ?? 0) + 1,
    } as any)
    .eq("id", gameId)
    .select("*")
    .maybeSingle();

  let updatedGame = updatedGameRes.data;
  let updateError = updatedGameRes.error as any;

  if (shouldFallbackVersionError(updateError)) {
    const fallbackRes = await getTable(
      supabase,
      "games",
    )
      .update({
        status: "finished",
        result,
        end_reason: "resignation",
      })
      .eq("id", gameId)
      .select("*")
      .maybeSingle();
    updatedGame = fallbackRes.data;
    updateError = fallbackRes.error as any;
  }

  logOperation("resign game", updateError);

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

