/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { Chess } from "chess-ts";
import {
  verifyGameAccess,
  validateMove,
  isGameOver,
  type ChessMove,
  type PlayerColor,
  type Game,
} from "./chess-utils.ts";
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { successResponse, errorResponse } from "./response-utils.ts";
import { dbQuery } from "./db-utils.ts";
import { validateRequired } from "./validation-utils.ts";
import { EventType, recordEvent } from "./event-utils.ts";

const logger = createLogger("GAME");

interface MakeMoveParams {
  gameId: string;
  move: ChessMove;
}

interface BanMoveParams {
  gameId: string;
  move: ChessMove;
}

interface GameOfferParams {
  gameId: string;
  playerColor?: PlayerColor;
}

interface ResignationParams {
  gameId: string;
}

interface MushroomGrowthParams {
  gameId: string;
}

/**
 * Handles making a move in a chess game
 */
export async function handleMakeMove(
  user: User,
  params: MakeMoveParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    logger.info(`User ${user.id} making move in game ${params.gameId}`);

    // Validate required params
    const validation = validateRequired(params, ["gameId", "move"]);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
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
      logger.warn(`Unauthorized move attempt: ${error}`);
      return errorResponse(error, 403);
    }

    // Validate the move using chess rules
    const moveResult = validateMove(game.current_fen, move);
    if (!moveResult.valid) {
      logger.warn(`Invalid move attempt: ${moveResult.error}`);
      return errorResponse(moveResult.error, 400);
    }

    // Check game over conditions
    const gameOverState = isGameOver(moveResult.newFen);
    const status = gameOverState.isOver ? "finished" : "active";

    // If game is over, log the event
    if (gameOverState.isOver) {
      logger.info(
        `Game ${gameId} ended: ${gameOverState.result} by ${gameOverState.reason}`,
      );
    }

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
          banningPlayer: playerColor,
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
      logger.error(`Failed to update game:`, updateError);
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
    logger.error(`Error handling move:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles banning a move in a chess game
 */
export async function handleBanMove(
  user: User,
  params: BanMoveParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    logger.info(`User ${user.id} banning move in game ${params.gameId}`);

    // Validate required params
    const validation = validateRequired(params, ["gameId", "move"]);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
    }

    const { gameId, move } = params;

    // Verify game access
    const { game, playerColor, authorized, error } = await verifyGameAccess(
      supabase,
      gameId,
      user.id,
    );

    if (!authorized) {
      logger.warn(`Unauthorized ban attempt: ${error}`);
      return errorResponse(error, 403);
    }

    // Check if this player is allowed to ban
    if (
      game.banningPlayer !==
      (game.white_player_id === user.id ? "white" : "black")
    ) {
      return errorResponse(
        "You don't have permission to ban a move at this time",
        403,
      );
    }

    // Parse the existing PGN and add the banned move as a comment
    const chess = new Chess(game.current_fen);
    if (game.pgn) {
      chess.loadPgn(game.pgn);
    }
    chess.setComment(`banning: ${move.from}${move.to}`);

    // Check game over conditions
    const gameOverState = isGameOver(game.current_fen);
    const status = gameOverState.isOver ? "finished" : "active";

    // Update the game
    const { data: updatedGame, error: updateError } = await dbQuery(
      supabase,
      "games",
      "update",
      {
        data: {
          banningPlayer: null,
          pgn: chess.pgn(),
          status,
          result: gameOverState.result,
          end_reason: gameOverState.reason,
        },
        match: { id: gameId },
        select: "*",
        single: true,
        operation: "update game ban move",
      },
    );

    if (updateError) {
      logger.error(`Failed to update game with ban:`, updateError);
      return errorResponse(
        `Failed to update game: ${updateError.message}`,
        500,
      );
    }

    // Record event
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
    logger.error(`Error handling ban move:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles game offers (draw/rematch)
 */
export async function handleGameOffer(
  user: User,
  params: GameOfferParams,
  supabase: SupabaseClient,
  offerType: "draw" | "rematch",
  action: "offer" | "accept" | "decline",
): Promise<Response> {
  try {
    logger.info(
      `User ${user.id} ${action}ing ${offerType} in game ${params.gameId}`,
    );

    // Validate required params
    const validation = validateRequired(params, ["gameId"]);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
    }

    const { gameId, playerColor } = params;

    // Verify game access
    const { game, authorized, error } = await verifyGameAccess(
      supabase,
      gameId,
      user.id,
    );

    if (!authorized) {
      logger.warn(`Unauthorized ${offerType} ${action} attempt: ${error}`);
      return errorResponse(error, 403);
    }

    const userColor = game.white_player_id === user.id ? "white" : "black";
    const field = `${offerType}_offered_by`;

    // Handle offering
    if (action === "offer") {
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
        logger.error(`Failed to offer ${offerType}:`, updateError);
        return errorResponse(
          `Failed to offer ${offerType}: ${updateError.message}`,
          500,
        );
      }

      // Record event
      await recordEvent(
        supabase,
        EventType.OFFER_MADE,
        {
          game_id: gameId,
          offer_type: offerType,
        },
        user.id,
      );

      return successResponse(updatedGame);
    }

    // Handle declining
    if (action === "decline") {
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
        logger.error(`Failed to decline ${offerType}:`, updateError);
        return errorResponse(
          `Failed to decline ${offerType}: ${updateError.message}`,
          500,
        );
      }

      // Record event
      await recordEvent(
        supabase,
        EventType.OFFER_DECLINED,
        {
          game_id: gameId,
          offer_type: offerType,
        },
        user.id,
      );

      return successResponse(updatedGame);
    }

    // Handle accepting
    if (action === "accept") {
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
          logger.error(`Failed to accept draw:`, updateError);
          return errorResponse(
            `Failed to accept draw: ${updateError.message}`,
            500,
          );
        }

        // Record events
        await recordEvent(
          supabase,
          EventType.OFFER_ACCEPTED,
          {
            game_id: gameId,
            offer_type: offerType,
          },
          user.id,
        );

        await recordEvent(
          supabase,
          EventType.GAME_ENDED,
          {
            game_id: gameId,
            result: "draw",
            reason: "draw_agreement",
          },
          user.id,
        );

        return successResponse(updatedGame);
      }

      if (offerType === "rematch") {
        // Create a new game with swapped colors
        const { data: newGame, error: createError } = await dbQuery(
          supabase,
          "games",
          "insert",
          {
            data: {
              white_player_id: game.black_player_id, // Swap colors
              black_player_id: game.white_player_id, // Swap colors
              status: "active",
              current_fen:
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
              pgn: "",
              turn: "white",
              banningPlayer: "black",
              parent_game_id: gameId,
            },
            select: "*",
            single: true,
            operation: "create rematch game",
          },
        );

        if (createError) {
          logger.error(`Failed to create rematch game:`, createError);
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
  } catch (error) {
    logger.error(`Error handling ${offerType} ${action}:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Handles game resignation
 */
export async function handleResignation(
  user: User,
  params: ResignationParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    logger.info(`User ${user.id} resigning game ${params.gameId}`);

    // Validate required params
    const validation = validateRequired(params, ["gameId"]);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
    }

    const { gameId } = params;

    // Verify game access
    const { game, playerColor, authorized, error } = await verifyGameAccess(
      supabase,
      gameId,
      user.id,
    );

    if (!authorized) {
      logger.warn(`Unauthorized resignation attempt: ${error}`);
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
      logger.error(`Failed to resign game:`, updateError);
      return errorResponse(
        `Failed to resign game: ${updateError.message}`,
        500,
      );
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
  } catch (error) {
    logger.error(`Error handling resignation:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * Special mushroom growth transformation handler
 */
export async function handleMushroomGrowth(
  user: User,
  params: MushroomGrowthParams,
  supabase: SupabaseClient,
): Promise<Response> {
  try {
    logger.info(
      `User ${user.id} applying mushroom transformation in game ${params.gameId}`,
    );

    // Validate required params
    const validation = validateRequired(params, ["gameId"]);
    if (!validation.valid) {
      return errorResponse(validation.errors.join("; "), 400);
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
      logger.warn(`Unauthorized mushroom transformation attempt: ${error}`);
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
    const newPgn = `[SetUp "1"]\n[FEN "${fen}"]`;

    // Update the game with the mushroom transformation
    const { data: updatedGame, error: updateError } = await dbQuery(
      supabase,
      "games",
      "update",
      {
        data: {
          current_fen: fen,
          pgn: newPgn,
        },
        match: { id: gameId },
        select: "*",
        single: true,
        operation: "apply mushroom transformation",
      },
    );

    if (updateError) {
      logger.error(`Failed to apply mushroom transformation:`, updateError);
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

    return successResponse(updatedGame);
  } catch (error) {
    logger.error(`Error handling mushroom transformation:`, error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
