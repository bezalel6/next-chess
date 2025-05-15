/// <reference lib="deno.ns" />
import { Chess, type PartialMove } from "https://esm.sh/chess.ts@0.16.2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { dbQuery } from "./db-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { uuidSchema } from "./validation-utils.ts";

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
  banning_player: "white" | "black" | null;
  created_at: string;
  updated_at: string;
  draw_offered_by?: string | null;
  end_reason?: string | null;
  rematch_offered_by?: string | null;
  parent_game_id?: string | null;
}

export type PlayerColor = "white" | "black";
export type GameResult = "white" | "black" | "draw" | null;
export type GameEndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | null;

// Zod schemas for chess operations
export const ChessSchemas = {
  Move: z.object({
    from: z.string().min(2).max(2),
    to: z.string().min(2).max(2),
    promotion: z.string().optional(),
  }),

  GameAccess: z.object({
    gameId: uuidSchema,
    userId: uuidSchema,
    requiresTurn: z.boolean().optional().default(false),
  }),

  FenString: z.string().min(10),
};

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
  currentPgn?: string,
): { valid: boolean; newFen?: string; newPgn?: string; error?: string } {
  try {
    logger.debug(`Validating move: ${move.from}-${move.to}`);
    const chess = new Chess(fen);

    // Load the current PGN to preserve comments/history
    if (currentPgn && currentPgn.trim().length > 0) {
      try {
        chess.loadPgn(currentPgn);
      } catch (pgnError) {
        logger.warn(`Could not load PGN, will create new: ${pgnError.message}`);
        // If PGN can't be loaded, we'll continue with a fresh chess instance
      }
    }

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
 * Extracts the banned move from the PGN string
 */
export function getBannedMove(pgn: string): string | null {
  if (!pgn) return null;
  const bannedMoveMatch = pgn.match(/\{?banning: ([a-zA-Z0-9]{4})\}?$/);
  return bannedMoveMatch ? bannedMoveMatch[1] : null;
}

/**
 * Gets all banned moves from the PGN string
 */
export function getAllBannedMoves(pgn: string): string[] {
  if (!pgn) return [];

  const bannedMoveRegex = /\{?banning: ([a-zA-Z0-9]{4})\}?/g;
  const bannedMoves: string[] = [];
  let match;

  while ((match = bannedMoveRegex.exec(pgn)) !== null) {
    bannedMoves.push(match[1]);
  }

  return bannedMoves;
}

/**
 * Checks if the game is over based on the current position
 */
export function isGameOver(
  fen: string,
  pgn?: string,
): {
  isOver: boolean;
  result?: GameResult;
  reason?: GameEndReason;
} {
  try {
    logger.debug(`Checking game state from FEN: ${fen.substring(0, 20)}...`);
    const chess = new Chess(fen);

    // Use provided PGN or get it from the chess instance
    const currentPgn = pgn || chess.pgn();

    // Check for checkmate
    if (chess.inCheckmate()) {
      // The side to move has lost
      const winner = chess.turn() === "w" ? "black" : "white";
      logger.info(`Game over by checkmate, winner: ${winner}`);
      return { isOver: true, result: winner, reason: "checkmate" };
    }

    // Check for draw conditions
    if (chess.inStalemate()) {
      logger.info(`Game over by stalemate`);
      return { isOver: true, result: "draw", reason: "stalemate" };
    } else if (chess.insufficientMaterial()) {
      logger.info(`Game over by insufficient material`);
      return { isOver: true, result: "draw", reason: "insufficient_material" };
    } else if (chess.inThreefoldRepetition()) {
      logger.info(`Game over by threefold repetition`);
      return { isOver: true, result: "draw", reason: "threefold_repetition" };
    } else if (chess.inDraw()) {
      logger.info(`Game over by fifty-move rule`);
      return { isOver: true, result: "draw", reason: "fifty_move_rule" };
    }

    // Check banned move logic
    const bannedMove = getBannedMove(currentPgn);
    if (bannedMove) {
      // Get all legal moves
      const legalMoves = chess.moves({ verbose: true });

      // If there is only one legal move and it matches the banned move,
      // then the current player has no valid moves
      if (legalMoves.length === 1) {
        const onlyMove = `${legalMoves[0].from}${legalMoves[0].to}`;
        logger.debug(
          `Only one legal move: ${onlyMove}, banned move: ${bannedMove}`,
        );

        if (onlyMove === bannedMove) {
          // Check if the king is in check
          const inCheck = chess.inCheck();
          if (inCheck) {
            // If in check with no legal moves (since only move is banned), it's checkmate
            const winner = chess.turn() === "w" ? "black" : "white";
            logger.info(
              `Game over by checkmate (banned move), winner: ${winner}`,
            );
            return { isOver: true, result: winner, reason: "checkmate" };
          } else {
            // If not in check with no legal moves, it's stalemate
            logger.info(`Game over by stalemate (banned move)`);
            return { isOver: true, result: "draw", reason: "stalemate" };
          }
        }
      }
    }

    logger.debug(`Game is not over`);
    return { isOver: false };
  } catch (error) {
    logger.error(`Error checking game state:`, error);
    return { isOver: false };
  }
}
