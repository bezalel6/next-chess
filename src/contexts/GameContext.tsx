import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.ts';
import { socket } from '@/pages/socket';
import type { Game, GameContextType } from '@/types/game';

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
    const [game, setGame] = useState<Game | null>(null);
    const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);

    const makeMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
        if (!game || game.status !== 'active' || game.turn !== myColor) return;

        try {
            const move = { from, to, promotion };
            const newChess = new Chess(game.currentFen);
            const result = newChess.move(move);

            if (result) {
                socket.emit('make-move', {
                    gameId: game.id,
                    move: { from, to, promotion }
                });
            }
        } catch (error) {
            console.error('Invalid move:', error);
        }
    }, [game, myColor]);

    const resetGame = useCallback(() => {
        setGame(null);
        setMyColor(null);
    }, []);

    const value: GameContextType = {
        game,
        setGame,
        makeMove,
        resetGame,
        isMyTurn: game?.status === 'active' && game?.turn === myColor,
        myColor
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