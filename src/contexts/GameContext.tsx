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

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: GameProviderProps) {
    const [game, setGame] = useState<Game | null>(null);
    const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
    const { playGameStart, playGameEnd } = useChessSounds();
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        if (!game?.id) return;

        let subscription: RealtimeChannel;

        const setupSubscription = async () => {
            subscription = await GameService.subscribeToGame(game.id, (updatedGame) => {
                setGame(updatedGame);
                if (updatedGame.status === 'finished') {
                    playGameEnd();
                }
            });
        };

        setupSubscription();

        return () => {
            subscription?.unsubscribe();
        };
    }, [game?.id, playGameEnd]);

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
        setGame(null);
        setMyColor(null);
        router.replace('/', undefined, { shallow: true });
    }, [router]);

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