import { useEffect } from 'react';
import { GameService } from '@/services/gameService';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';

export function useGameSync(gameId: string | undefined) {
  const loadGame = useUnifiedGameStore(s => s.loadGame);
  
  useEffect(() => {
    if (!gameId) return;
    
    // Load initial game state
    GameService.loadGame(gameId).then(game => {
      if (game?.ban_chess_state) {
        loadGame(gameId, game.ban_chess_state);
      }
    });
    
    // Subscribe to updates
    const unsubscribe = GameService.subscribeToGame(gameId, (payload) => {
      if (payload.state) {
        loadGame(gameId, payload.state);
      } else if (payload.game?.ban_chess_state) {
        loadGame(gameId, payload.game.ban_chess_state);
      }
    });
    
    return unsubscribe;
  }, [gameId, loadGame]);
}