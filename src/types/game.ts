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
export type GameEndReason =
  | "checkmate"
  | "resignation"
  | "draw_agreement"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "timeout"
  | null;

export interface ChessMove {
  from: Square;
  to: Square;
  promotion?: PromoteablePieces;
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
  drawOfferedBy: PlayerColor | null;
  endReason: GameEndReason;
  rematchOfferedBy: PlayerColor | null;
  parentGameId: string | null;
  // Time control properties
  whiteTimeRemaining?: number;
  blackTimeRemaining?: number;
  timeControl?: {
    initialTime: number; // in milliseconds
    increment: number; // in milliseconds
  };
}

export interface GameContextType {
  game: Game | null;
  setGame: (game: Game | null) => void;
  pgn: string;
  setPgn: (pgn: string) => void;
  isMyTurn: boolean;
  myColor: PlayerColor | null;
  loading: boolean;
  playerUsernames: { white: string; black: string };
  actions: {
    makeMove: (
      from: string,
      to: string,
      promotion?: PromoteablePieces,
    ) => Promise<void>;
    banMove: (from: string, to: string) => Promise<void>;
    resetGame: () => void;
    offerDraw: () => Promise<void>;
    acceptDraw: () => Promise<void>;
    declineDraw: () => Promise<void>;
    resign: () => Promise<void>;
    offerRematch: () => Promise<void>;
    acceptRematch: () => Promise<void>;
    declineRematch: () => Promise<void>;
  };
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
