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
  const mode = useUnifiedGameStore(s => s.mode);
  const initLocalGame = useUnifiedGameStore(s => s.initLocalGame);
  
  const gameId = router.query.id as string | undefined;
  const isLocalGame = router.pathname === '/local-game';
  
  // Set loading state when starting
  useEffect(() => {
    if (gameId && !isLocalGame) {
      // Loading state will be managed by the query
    }
  }, [gameId, isLocalGame]);
  
  // Initialize local game
  useEffect(() => {
    if (isLocalGame && mode !== 'local') {
      initLocalGame();
      playGameStart();
    }
  }, [isLocalGame, mode, initLocalGame, playGameStart]);
  
  // Initialize online game - Always call the hook, but enable/disable based on gameId
  const gameQuery = useGameQuery(gameId, user?.id);
  
  return {
    gameId,
    isLocalGame,
    gameQuery,
  };
}