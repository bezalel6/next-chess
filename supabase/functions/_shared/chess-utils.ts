/// <reference lib="deno.ns" />
import { Chess, type PartialMove } from "https://esm.sh/chess.ts@0.16.2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { dbQuery } from "./db-utils.ts";

const logger = createLogger("CHESS");

export interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  status: "active" | "finished";
  result?: "white" | "black" | "draw" | null;
  current_fen: string;
  pgn: string;
  last_move?: ChessMove;
  turn: "white" | "black";
  banningPlayer: "white" | "black" | null;
  created_at: string;
  updated_at: string;
  draw_offered_by?: string | null;
  end_reason?: string | null;
  rematch_offered_by?: string | null;
  parent_game_id?: string | null;
}

export type PlayerColor = "white" | "black";

/**
 * Verifies if a user is authorized to perform an action on a game
 */
export async function verifyGameAccess(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  requiresTurn = false,
): Promise<{
  game: Game;
  playerColor: PlayerColor;
  authorized: boolean;
  error?: string;
}> {
  logger.debug(`Verifying game access for user ${userId} on game ${gameId}`);

  // Get the game
  const { data: game, error: gameError } = await dbQuery<Game>(
    supabase,
    "games",
    "select",
    {
      match: { id: gameId },
      single: true,
      operation: `get game ${gameId}`,
    },
  );

  if (gameError || !game) {
    logger.warn(`Game not found: ${gameId}`, gameError);
    return {
      game: null,
      playerColor: null,
      authorized: false,
      error: `Game not found: ${gameError?.message || "Unknown error"}`,
    };
  }

  // Check if user is a player in this game
  const isWhitePlayer = game.white_player_id === userId;
  const isBlackPlayer = game.black_player_id === userId;

  if (!isWhitePlayer && !isBlackPlayer) {
    logger.warn(`User ${userId} is not a player in game ${gameId}`);
    return {
      game,
      playerColor: null,
      authorized: false,
      error: "User is not a player in this game",
    };
  }

  const playerColor = isWhitePlayer ? "white" : "black";

  // If this operation requires it to be the player's turn
  if (requiresTurn && game.turn !== playerColor) {
    logger.warn(`Not ${userId}'s turn in game ${gameId}`);
    return {
      game,
      playerColor,
      authorized: false,
      error: "Not your turn",
    };
  }

  logger.debug(`Access authorized for user ${userId} as ${playerColor}`);
  return {
    game,
    playerColor,
    authorized: true,
  };
}

/**
 * Validates and processes a chess move
 */
export function validateMove(
  fen: string,
  move: ChessMove,
): { valid: boolean; newFen?: string; newPgn?: string; error?: string } {
  try {
    logger.debug(`Validating move: ${move.from}-${move.to}`);
    const chess = new Chess(fen);
    const result = chess.move(move as PartialMove);

    if (!result) {
      logger.warn(`Invalid move: ${move.from}-${move.to}`);
      return { valid: false, error: "Invalid move" };
    }

    logger.debug(`Move validated successfully`);
    return {
      valid: true,
      newFen: chess.fen(),
      newPgn: chess.pgn(),
    };
  } catch (error) {
    logger.error(`Chess error validating move:`, error);
    return {
      valid: false,
      error: `Chess error: ${error.message}`,
    };
  }
}

/**
 * Checks if the game is over based on the current position
 */
export function isGameOver(fen: string): {
  isOver: boolean;
  result?: "white" | "black" | "draw" | null;
  reason?: string;
} {
  try {
    logger.debug(`Checking game state from FEN: ${fen.substring(0, 20)}...`);
    const chess = new Chess(fen);

    // Check for checkmate
    if (chess.inCheckmate()) {
      // The side to move has lost
      const winner = chess.turn() === "w" ? "black" : "white";
      logger.info(`Game over by checkmate, winner: ${winner}`);
      return { isOver: true, result: winner, reason: "checkmate" };
    }

    // Check for draw conditions
    if (chess.inDraw()) {
      let reason = "fifty_move_rule";

      if (chess.inStalemate()) {
        reason = "stalemate";
      } else if (chess.insufficientMaterial()) {
        reason = "insufficient_material";
      } else if (chess.inThreefoldRepetition()) {
        reason = "threefold_repetition";
      }

      logger.info(`Game over by draw, reason: ${reason}`);
      return { isOver: true, result: "draw", reason };
    }

    logger.debug(`Game is not over`);
    return { isOver: false };
  } catch (error) {
    logger.error(`Error checking game state:`, error);
    return { isOver: false };
  }
}
