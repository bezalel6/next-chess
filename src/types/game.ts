import type { Chess } from "chess.ts";
import type { Square } from "chess.ts/dist/types";
/**
 * Type definitions for color representations
 */
export type ShortColor = "w" | "b";
export type LongColor = "white" | "black";
export type PlayerColor = "white" | "black";

export type GameStatus = "active" | "finished" | "abandoned";
export type GameResult = "white" | "black" | "draw" | null;

export interface ChessMove {
  from: Square;
  to: Square;
  promotion?: PromoteablePieces;
}

export interface DBGame {
  id?: string;
  white_player_id: string;
  black_player_id: string;
  status: GameStatus;
  last_move?: ChessMove;
  result?: GameResult;
  current_fen: string;
  pgn: string;
  turn: PlayerColor;
  banningPlayer: PlayerColor | null;
  created_at?: number;
  updated_at?: number;
}
export interface Game {
  id: string;
  whitePlayer: string;
  blackPlayer: string;
  status: GameStatus;
  result: GameResult;
  currentFen: string;
  pgn: string;
  chess: Chess;
  lastMove: ChessMove | null;
  turn: PlayerColor;
  startTime: number;
  lastMoveTime: number;
  banningPlayer: PlayerColor | null;
}

export interface GameContextType {
  game: Game | null;
  setGame: (game: Game | null) => void;
  pgn: string;
  setPgn: (pgn: string) => void;
  makeMove: (from: string, to: string, promotion?: PromoteablePieces) => void;
  banMove: (from: string, to: string) => void;
  resetGame: () => void;
  isMyTurn: boolean;
  myColor: PlayerColor | null;
  loading: boolean;
  playerUsernames: { white: string; black: string };
}

/**
 * Maps for conversion between short and long color formats
 */
const shortToLong: Record<ShortColor, LongColor> = {
  w: "white",
  b: "black",
};

const longToShort: Record<LongColor, ShortColor> = {
  white: "w",
  black: "b",
};

/**
 * Generic color converter function that can convert in both directions
 * @template Target The target color type (ShortColor or LongColor)
 * @template S The source color type (the opposite of T)
 * @param color The color to convert
 * @returns The converted color in the target format
 */
export function clr<Target extends ShortColor | LongColor>(
  color: Target extends ShortColor ? LongColor : ShortColor,
): Target {
  if (
    (typeof color === "string" && color.length === 1) ||
    color === "w" ||
    color === "b"
  ) {
    // Converting from short to long
    return shortToLong[color as ShortColor] as Target;
  } else {
    // Converting from long to short
    return longToShort[color as LongColor] as Target;
  }
}
export type PromoteablePieces = "q" | "r" | "b" | "n";

export const PROMOTION_PIECES: Record<PromoteablePieces, string> = {
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
} as const;
