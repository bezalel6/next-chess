import { useEffect, useRef } from 'react';
import { GameService } from '@/services/gameService';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import type { Tables } from '@/types/database';

// Type for live game broadcast payload
interface LiveGamePayload {
  // Complete game state
  id: string;
  current_fen: string;
  ban_chess_state: 'waiting_for_ban' | 'waiting_for_move';
  turn: 'white' | 'black';
  banning_player: 'white' | 'black' | null;
  status: 'active' | 'completed';
  winner: 'white' | 'black' | 'draw' | null;
  
  // Action details
  lastAction?: {
    type: 'move' | 'ban';
    playerId: string;
    playerColor: 'white' | 'black';
    from?: string;
    to?: string;
    promotion?: string;
    timestamp: string;
  };
  
  // Engine state
  history: unknown[];
  legalMoves: unknown[];
  nextActionType: 'move' | 'ban';
  gameOver: boolean;
  result: string | null;
  
  // Players
  white_player_id: string;
  black_player_id: string;
  white_player?: { username: string };
  black_player?: { username: string };
}

export function useGameSync(gameId: string | undefined) {
  const loadGame = useUnifiedGameStore(s => s.loadGame);
  const updateGameFromBroadcast = useUnifiedGameStore(s => s.updateGameFromBroadcast);
  const isLiveGame = useRef(false);
  
  useEffect(() => {
    if (!gameId) return;
    
    // Load initial game state from database (for viewing completed games or initial load)
    GameService.loadGame(gameId).then(game => {
      if (game) {
        isLiveGame.current = game.status === 'active';
        loadGame(gameId, game);
      }
    });
    
    // Subscribe to live broadcasts (for active games only)
    const unsubscribe = GameService.subscribeToGame(gameId, (payload: unknown) => {
      console.log('[useGameSync] Received payload from GameService:', payload);
      const livePayload = payload as LiveGamePayload;
      
      // For live games, use broadcast data as source of truth
      if (livePayload.id && livePayload.current_fen) {
        console.log('[useGameSync] Valid payload, updating store:', {
          id: livePayload.id,
          fen: livePayload.current_fen,
          state: livePayload.ban_chess_state,
          turn: livePayload.turn
        });
        
        // Convert broadcast payload to game format for store
        const gameUpdate: Partial<Tables<'games'>> = {
          id: livePayload.id,
          current_fen: livePayload.current_fen,
          ban_chess_state: livePayload.ban_chess_state,
          turn: livePayload.turn,
          banning_player: livePayload.banning_player,
          status: livePayload.status,
          winner: livePayload.winner,
          white_player_id: livePayload.white_player_id,
          black_player_id: livePayload.black_player_id,
          updated_at: livePayload.lastAction?.timestamp || new Date().toISOString(),
        };
        
        // Update store with broadcast data
        console.log('[useGameSync] Calling updateGameFromBroadcast');
        updateGameFromBroadcast(gameId, gameUpdate, livePayload);
      } else {
        console.log('[useGameSync] Invalid payload, missing id or fen:', livePayload);
      }
    });
    
    return unsubscribe;
  }, [gameId, loadGame, updateGameFromBroadcast]);
}