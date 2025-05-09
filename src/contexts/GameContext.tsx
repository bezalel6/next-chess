import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import type { Game, GameContextType, PromoteablePieces } from '@/types/game';
import type { GameMatch } from '@/types/realtime';
import { useChessSounds } from '@/hooks/useChessSounds';
import { GameService } from '@/services/gameService';
import { useAuth } from './AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface GameProviderProps {
    children: ReactNode;
}

// Create the context with a proper initial null value
const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: GameProviderProps) {
    const [game, setGame] = useState<Game | null>(null);
    const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
    const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);
    const { playGameStart, playGameEnd } = useChessSounds();
    const router = useRouter();
    const { user } = useAuth();

    // Clean up subscription when component unmounts or when game changes
    const cleanupSubscription = useCallback(() => {
        if (subscription) {
            subscription.unsubscribe();
            setSubscription(null);
        }
    }, [subscription]);

    // Set up game subscription
    useEffect(() => {
        if (!game?.id) return;

        // Clean up any existing subscription before creating a new one
        cleanupSubscription();

        const setupSubscription = async () => {
            try {
                const newSubscription = await GameService.subscribeToGame(game.id, (updatedGame) => {
                    setGame(updatedGame);
                    if (updatedGame.status === 'finished') {
                        playGameEnd();
                    }
                });
                setSubscription(newSubscription);
            } catch (error) {
                console.error('Error setting up game subscription:', error);
            }
        };

        setupSubscription();

        // Cleanup subscription on unmount or game change
        return cleanupSubscription;
    }, [game?.id, playGameEnd, cleanupSubscription]);

    const makeMove = useCallback(async (from: string, to: string, promotion?: PromoteablePieces) => {
        if (!game || game.status !== 'active' || game.turn !== myColor || !user) return;

        try {
            const move = { from, to, promotion };
            const updatedGame = await GameService.makeMove(game.id, move);
            setGame(updatedGame);
        } catch (error) {
            console.error('Invalid move:', error);
        }
    }, [game, myColor, user]);

    const resetGame = useCallback(async () => {
        // Make sure to clean up subscription before resetting game state
        cleanupSubscription();
        setGame(null);
        setMyColor(null);
        router.replace('/', undefined, { shallow: true });
    }, [router, cleanupSubscription]);

    // Set myColor whenever game or user changes
    useEffect(() => {
        if (!game || !user) {
            setMyColor(null);
            return;
        }

        if (game.whitePlayer === user.id) {
            setMyColor('white');
        } else if (game.blackPlayer === user.id) {
            setMyColor('black');
        } else {
            setMyColor(null); // Spectator
        }
    }, [game, user]);

    // Play game start sound when game becomes active
    useEffect(() => {
        if (game?.status === 'active') {
            playGameStart();
        }
    }, [game?.status, playGameStart]);

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