import type { ChessMove } from "@/types/game";
import type { PartialMove } from "chess.ts";

export function getBannedMove(pgn: string): string | null {
  const bannedMoveMatch = pgn.match(/\{banning: ([a-zA-Z0-9]{4})\}$/);
  return bannedMoveMatch ? bannedMoveMatch[1] : null;
}

function normalizeFuzz(fuzzy: FuzzyMove) {
  return typeof fuzzy === "string" ? fuzzy : `${fuzzy.from}${fuzzy.to}`;
}
type FuzzyMove = ChessMove | PartialMove | string;
export function isMoveFuzzyEq(move1: FuzzyMove, move2: FuzzyMove) {
  return normalizeFuzz(move1) === normalizeFuzz(move2);
}
