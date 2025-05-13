import type { ChessMove, GameEndReason, GameResult } from "@/types/game";
import type { PartialMove } from "chess.ts";
import { Chess } from "chess.ts";

export function getBannedMove(pgn: string): string | null {
  if (!pgn) return null;
  const bannedMoveMatch = pgn.match(/\{?banning: ([a-zA-Z0-9]{4})\}?$/);
  return bannedMoveMatch ? bannedMoveMatch[1] : null;
}
export function getMoveNumber(plyIndex: number) {
  return Math.floor(plyIndex / 2) + 1;
}

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
function normalizeFuzz(fuzzy: FuzzyMove) {
  if (!fuzzy) return null;
  return typeof fuzzy === "string" ? fuzzy : `${fuzzy.from}${fuzzy.to}`;
}
type FuzzyMove = ChessMove | PartialMove | string;
export function isMoveFuzzyEq(move1: FuzzyMove, move2: FuzzyMove) {
  return normalizeFuzz(move1) === normalizeFuzz(move2);
}

/**
 * Checks if the game is over, taking into account normal chess rules
 * and banned moves. If the only legal move is a banned move, the result depends
 * on whether the player is in check (checkmate) or not (stalemate).
 */
export function isGameOver(
  chess: Chess,
  pgn: string = chess.pgn(),
): {
  isOver: boolean;
  result: GameResult;
  reason: GameEndReason;
} {
  // Check standard chess game over conditions first
  if (chess.gameOver()) {
    if (chess.inCheckmate()) {
      // Current player lost by checkmate
      const winner = chess.turn() === "w" ? "black" : "white";
      return { isOver: true, result: winner, reason: "checkmate" };
    } else if (chess.inStalemate()) {
      return { isOver: true, result: "draw", reason: "stalemate" };
    } else if (chess.insufficientMaterial()) {
      return { isOver: true, result: "draw", reason: "insufficient_material" };
    } else if (chess.inThreefoldRepetition()) {
      return { isOver: true, result: "draw", reason: "threefold_repetition" };
    } else if (chess.inDraw()) {
      return { isOver: true, result: "draw", reason: "fifty_move_rule" };
    }
  }

  // Check if there's a banned move
  const bannedMove = getBannedMove(pgn);
  if (bannedMove) {
    // Get all legal moves
    const legalMoves = chess.moves({ verbose: true });

    // If there is only one legal move and it matches the banned move,
    // then the current player has no valid moves

    if (legalMoves.length === 1) {
      const onlyMove = `${legalMoves[0].from}${legalMoves[0].to}`;
      console.log("Only one legal move", onlyMove);
      console.log("Banned:", bannedMove);
      if (onlyMove === bannedMove) {
        // Check if the king is in check
        const inCheck = chess.inCheck();
        if (inCheck) {
          // If in check with no legal moves (since only move is banned), it's checkmate
          const winner = chess.turn() === "w" ? "black" : "white";
          return { isOver: true, result: winner, reason: "checkmate" };
        } else {
          // If not in check with no legal moves, it's stalemate
          return { isOver: true, result: "draw", reason: "stalemate" };
        }
      }
    }
  }

  // Game is not over
  return { isOver: false, result: null, reason: null };
}
