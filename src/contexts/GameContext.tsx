import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.ts';
import { socket } from '@/pages/socket';
import type { Game, GameContextType } from '@/types/game';
import type { GameMatch, ChessMove } from '@/types/socket';

interface GameProviderProps {
    children: ReactNode;
    onSendMove?: (gameId: string, move: ChessMove) => void;
    onGameEvent?: (event: 'join' | 'leave', gameId: string) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children, onSendMove, onGameEvent }: GameProviderProps) {
    const [game, setGame] = useState<Game | null>(null);
    const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);

    // Handle game match event from Connection
    const handleGameMatch = useCallback((data: GameMatch) => {
        const newGame: Game = {
            id: data.gameId,
            whitePlayer: data.color === 'white' ? socket.id : 'opponent',
            blackPlayer: data.color === 'black' ? socket.id : 'opponent',
            status: 'active',
            result: null,
            currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            chess: new Chess(),
            lastMove: null,
            turn: 'white',
            startTime: Date.now(),
            lastMoveTime: Date.now()
        };
        setGame(newGame);
        setMyColor(data.color);
        onGameEvent?.('join', data.gameId);
    }, [onGameEvent]);

    // Handle move event from Connection
    const handleMoveMade = useCallback((move: ChessMove) => {
        if (game) {
            const newChess = new Chess(game.currentFen);
            try {
                newChess.move(move);
                setGame({
                    ...game,
                    currentFen: newChess.fen(),
                    chess: newChess,
                    lastMove: move,
                    turn: game.turn === 'white' ? 'black' : 'white',
                    lastMoveTime: Date.now()
                });
            } catch (error) {
                console.error('Invalid move received:', error);
            }
        }
    }, [game]);

    const makeMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
        if (!game || game.status !== 'active' || game.turn !== myColor) return;

        try {
            const move = { from, to, promotion };
            const newChess = new Chess(game.currentFen);
            const result = newChess.move(move);

            if (result) {
                onSendMove?.(game.id, move);
                setGame({
                    ...game,
                    currentFen: newChess.fen(),
                    chess: newChess,
                    lastMove: move,
                    turn: game.turn === 'white' ? 'black' : 'white',
                    lastMoveTime: Date.now()
                });
            }
        } catch (error) {
            console.error('Invalid move:', error);
        }
    }, [game, myColor, onSendMove]);

    const resetGame = useCallback(() => {
        if (game) {
            onGameEvent?.('leave', game.id);
        }
        setGame(null);
        setMyColor(null);
    }, [game, onGameEvent]);

    const value: GameContextType = {
        game,
        setGame,
        makeMove,
        resetGame,
        isMyTurn: game?.status === 'active' && game?.turn === myColor,
        myColor,
        handleGameMatch,
        handleMoveMade
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
} 