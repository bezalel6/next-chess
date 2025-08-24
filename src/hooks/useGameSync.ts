import { useEffect } from 'react';
import { GameService } from '@/services/gameService';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';

export function useGameSync(gameId: string | undefined) {
  const loadGame = useUnifiedGameStore(s => s.loadGame);
  
  useEffect(() => {
    if (!gameId) return;
    
    // Load initial game state
    GameService.loadGame(gameId).then(game => {
      if (game) {
        loadGame(gameId, game);
      }
    });
    
    // Subscribe to updates
    const unsubscribe = GameService.subscribeToGame(gameId, (payload) => {
      if (payload.game) {
        loadGame(gameId, payload.game);
      } else if (payload.new) {
        // Handle direct table updates
        loadGame(gameId, payload.new);
      }
    });
    
    return unsubscribe;
  }, [gameId, loadGame]);
}