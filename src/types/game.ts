import { Chess } from 'chess.ts';
import type { ChessMove, GameMatch } from './socket';
/**
 * Type definitions for color representations
 */
type ShortColor = 'w' | 'b';
type LongColor = 'white' | 'black';
type PlayerColor = LongColor

export type GameStatus = 'waiting' | 'active' | 'finished';
export type GameResult = PlayerColor | 'draw' | null;


export interface Game {
    id: string;
    whitePlayer: string;
    blackPlayer: string;
    status: GameStatus;
    result: GameResult;
    currentFen: string;
    chess: Chess;
    lastMove: ChessMove | null;
    turn: PlayerColor;
    startTime: number;
    lastMoveTime: number;
}

export interface GameContextType {
    game: Game | null;
    setGame: (game: Game | null) => void;
    makeMove: (from: string, to: string, promotion?: PromoteablePieces) => void;
    resetGame: () => void;
    isMyTurn: boolean;
    myColor: PlayerColor | null;
    handleGameMatch: (data: GameMatch) => void;
    handleMoveMade: (move: ChessMove) => void;
}


/**
 * Maps for conversion between short and long color formats
 */
const shortToLong: Record<ShortColor, LongColor> = {
    'w': 'white',
    'b': 'black'
};

const longToShort: Record<LongColor, ShortColor> = {
    'white': 'w',
    'black': 'b'
};

/**
 * Generic color converter function that can convert in both directions
 * @template T The target color type (ShortColor or LongColor)
 * @template S The source color type (the opposite of T)
 * @param color The color to convert
 * @returns The converted color in the target format
 */
export function clr<T extends ShortColor | LongColor,
    S extends T extends ShortColor ? LongColor : ShortColor>
    (color: S): T {
    if ((typeof color === 'string' && color.length === 1) || color === 'w' || color === 'b') {
        // Converting from short to long
        return shortToLong[color as ShortColor] as T;
    } else {
        // Converting from long to short
        return longToShort[color as LongColor] as T;
    }
}
export type PromoteablePieces = "q" | 'r' | 'b' | 'n'

export const PROMOTION_PIECES: Record<PromoteablePieces, string> = {
    q: '♛',
    r: '♜',
    b: '♝',
    n: '♞'
} as const;

