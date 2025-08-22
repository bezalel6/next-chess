import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
// Legacy useGameQuery removed; use useGameSync in pages instead
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
  
  // Online game initialization is handled by useGameSync at the page level.
  return {
    gameId,
    isLocalGame,
  };
}