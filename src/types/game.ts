import type { BanChess } from "@/lib/simple-ban-chess";

/**
 * Type definitions for color representations
 */
export type ShortColor = "w" | "b";
export type LongColor = "white" | "black";
export type PlayerColor = "white" | "black";

export type GameStatus = "active" | "completed" | "abandoned";
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

// Ban Chess action types
export interface Move {
  from: string;
  to: string;
  promotion?: string;
}

export interface Ban {
  from: string;
  to: string;
}

export interface Action {
  move?: Move;
  ban?: Ban;
}

export interface Game {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whitePlayer: string;  // Username
  blackPlayer: string;  // Username
  status: GameStatus;
  result: GameResult;
  engine: BanChess;
  lastAction: Action | null;
  turn: PlayerColor;
  startTime: number;
  lastMoveTime: number;
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
  // Server version for realtime ordering
  version?: number;
}

export interface GameContextType {
  game: Game | null;
  setGame: (game: Game | null) => void;
  isMyTurn: boolean;
  myColor: PlayerColor | null;
  loading: boolean;
  playerUsernames: { white: string; black: string };
  isLocalGame?: boolean;
  localGameOrientation?: PlayerColor;
  boardOrientation?: PlayerColor;
  actions: {
    play: (action: Action) => Promise<void>;
    resetGame: () => void;
    offerDraw: () => Promise<void>;
    acceptDraw: () => Promise<void>;
    declineDraw: () => Promise<void>;
    resign: () => Promise<void>;
    offerRematch: () => Promise<void>;
    acceptRematch: () => Promise<void>;
    declineRematch: () => Promise<void>;
    startLocalGame?: () => void;
    flipBoardOrientation?: () => void;
  };
}

/**
 * Maps for conversion between short and long color formats
 */
export const shortToLong: Record<ShortColor, LongColor> = {
  w: "white",
  b: "black",
};

export const longToShort: Record<LongColor, ShortColor> = {
  white: "w",
  black: "b",
};

export function convertShortToLongColor(color: ShortColor): LongColor {
  return shortToLong[color];
}

export function convertLongToShortColor(color: LongColor): ShortColor {
  return longToShort[color];
}

// Type guard functions
export function isMove(action: Action): action is { move: Move } {
  return 'move' in action && action.move !== undefined;
}

export function isBan(action: Action): action is { ban: Ban } {
  return 'ban' in action && action.ban !== undefined;
}

// Legacy type aliases for gradual migration
export type ChessMove = Move;
export type Square = string;
export type PromoteablePieces = 'q' | 'r' | 'b' | 'n';