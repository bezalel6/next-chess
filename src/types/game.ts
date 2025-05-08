import { Chess } from 'chess.ts';
import type { ChessMove, GameMatch } from './socket';

export type GameStatus = 'waiting' | 'active' | 'finished';
export type GameResult = 'white' | 'black' | 'draw' | null;

export interface Game {
    id: string;
    whitePlayer: string;
    blackPlayer: string;
    status: GameStatus;
    result: GameResult;
    currentFen: string;
    chess: Chess;
    lastMove: ChessMove | null;
    turn: 'white' | 'black';
    startTime: number;
    lastMoveTime: number;
}

export interface GameContextType {
    game: Game | null;
    setGame: (game: Game | null) => void;
    makeMove: (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => void;
    resetGame: () => void;
    isMyTurn: boolean;
    myColor: 'white' | 'black' | null;
    handleGameMatch: (data: GameMatch) => void;
    handleMoveMade: (move: ChessMove) => void;
} 