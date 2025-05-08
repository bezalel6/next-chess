import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.ts';
import { useRouter } from 'next/router';
import type { Game, GameContextType, PromoteablePieces } from '@/types/game';
import type { GameMatch, ChessMove } from '@/types/realtime';
import { useChessSounds } from '@/hooks/useChessSounds';
import { supabase } from '@/utils/supabase';

interface GameProviderProps {
    children: ReactNode;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: GameProviderProps) {
    const [game, setGame] = useState<Game | null>(null);
    const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
    const { playGameStart, playGameEnd } = useChessSounds();
    const router = useRouter();

    useEffect(() => {
        const gameChannel = supabase.channel('game-events')
            .on('broadcast', { event: 'game-matched' }, async ({ payload }) => {
                const data = payload as GameMatch;
                const { data: { user } } = await supabase.auth.getUser();
                const userId = user?.id || 'unknown';
                const newGame: Game = {
                    id: data.gameId,
                    whitePlayer: data.color === 'white' ? userId : 'opponent',
                    blackPlayer: data.color === 'black' ? userId : 'opponent',
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
                playGameStart();

                // Update URL without triggering a page reload
                router.replace(`/game/${data.gameId}`, undefined, { shallow: true });
            })
            .on('broadcast', { event: 'move-made' }, ({ payload }) => {
                const move = payload as ChessMove;
                if (game) {
                    const newChess = new Chess(game.currentFen);
                    try {
                        newChess.move(move);
                        const isGameOver = newChess.gameOver();
                        setGame({
                            ...game,
                            currentFen: newChess.fen(),
                            chess: newChess,
                            lastMove: move,
                            turn: game.turn === 'white' ? 'black' : 'white',
                            lastMoveTime: Date.now(),
                            status: isGameOver ? 'finished' : 'active',
                            result: isGameOver ? (newChess.inCheckmate() ? game.turn : 'draw') : null
                        });
                        if (isGameOver) {
                            playGameEnd();
                        }
                    } catch (error) {
                        console.error('Invalid move received:', error);
                    }
                }
            });

        return () => {
            gameChannel.unsubscribe();
        };
    }, [game, playGameEnd, playGameStart, router]);

    const makeMove = useCallback(async (from: string, to: string, promotion?: PromoteablePieces) => {
        if (!game || game.status !== 'active' || game.turn !== myColor) return;

        try {
            const move = { from, to, promotion };
            const newChess = new Chess(game.currentFen);
            const result = newChess.move(move);

            if (result) {
                await supabase.channel('game-events').send({
                    type: 'broadcast',
                    event: 'make-move',
                    payload: { gameId: game.id, move }
                });
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
    }, [game, myColor]);

    const resetGame = useCallback(async () => {
        if (game) {
            await supabase.channel('game-events').send({
                type: 'broadcast',
                event: 'leave-game',
                payload: { gameId: game.id }
            });
        }
        setGame(null);
        setMyColor(null);
        // Clear the game ID from the URL
        router.replace('/', undefined, { shallow: true });
    }, [game, router]);

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