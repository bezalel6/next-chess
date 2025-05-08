import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Chess } from 'chess.ts';
import { useRouter } from 'next/router';
import type { Game, GameContextType, PromoteablePieces } from '@/types/game';
import type { GameMatch, ChessMove, CustomSocket, ServerToClientEvents } from '@/types/socket';
import { useChessSounds } from '@/hooks/useChessSounds';

interface GameProviderProps {
    children: ReactNode;
    socket: CustomSocket;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children, socket }: GameProviderProps) {
    const [game, setGame] = useState<Game | null>(null);
    const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
    const { playGameStart, playGameEnd } = useChessSounds();
    const router = useRouter();

    useEffect(() => {
        const eventHandlers: Pick<ServerToClientEvents, 'game-matched' | 'move-made'> = {
            'game-matched': (data: GameMatch) => {
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
                socket.emit('join-game', data.gameId);
                playGameStart();

                // Update URL without triggering a page reload
                router.replace(`/game/${data.gameId}`, undefined, { shallow: true });
            },
            'move-made': (move: ChessMove) => {
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
            }
        };

        // Subscribe to game events
        Object.entries(eventHandlers).forEach(([event, handler]) => {
            socket.on(event as keyof ServerToClientEvents, handler);
        });

        return () => {
            // Clean up game event listeners
            Object.entries(eventHandlers).forEach(([event, handler]) => {
                socket.off(event as keyof ServerToClientEvents, handler);
            });
        };
    }, [game, playGameEnd, playGameStart, socket, router]);

    const makeMove = useCallback((from: string, to: string, promotion?: PromoteablePieces) => {
        if (!game || game.status !== 'active' || game.turn !== myColor) return;

        try {
            const move = { from, to, promotion };
            const newChess = new Chess(game.currentFen);
            const result = newChess.move(move);

            if (result) {
                socket.emit('make-move', { gameId: game.id, move });
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
    }, [game, myColor, socket]);

    const resetGame = useCallback(() => {
        if (game) {
            socket.emit('leave-game', game.id);
        }
        setGame(null);
        setMyColor(null);
        // Clear the game ID from the URL
        router.replace('/', undefined, { shallow: true });
    }, [game, socket, router]);

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