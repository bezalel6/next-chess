import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useGameQuery } from './useGameQueries';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useChessSounds } from './useChessSounds';

/**
 * Hook to initialize game based on route
 * Use this in pages that need game state
 */
export function useGameInit() {
  const router = useRouter();
  const { user } = useAuth();
  const { playGameStart } = useChessSounds();
  const store = useUnifiedGameStore();
  
  const gameId = router.query.id as string | undefined;
  const isLocalGame = router.pathname === '/local-game';
  
  // Initialize local game
  useEffect(() => {
    if (isLocalGame && store.mode !== 'local') {
      store.initLocalGame();
      playGameStart();
    }
  }, [isLocalGame, store, playGameStart]);
  
  // Initialize online game
  const gameQuery = gameId ? useGameQuery(gameId, user?.id) : null;
  
  return {
    gameId,
    isLocalGame,
    gameQuery,
  };
}