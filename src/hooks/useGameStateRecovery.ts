import { useEffect, useRef } from 'react';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useGamePresence } from '@/contexts/GamePresenceContext';
import { supabase } from '@/utils/supabase';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Hook to handle game state recovery on reconnection
 * Syncs local game state with server state when connection is restored
 */
export function useGameStateRecovery(gameId: string | null) {
  const { isChannelConnected, reconnectAttempts } = useGamePresence();
  const { notifyInfo, notifySuccess } = useNotification();
  const game = useUnifiedGameStore(s => s.game);
  const syncGameState = useUnifiedGameStore(s => s.syncGameState);
  
  const lastConnectionState = useRef(isChannelConnected);
  const isRecovering = useRef(false);

  useEffect(() => {
    // Detect reconnection (was disconnected, now connected)
    const wasDisconnected = !lastConnectionState.current;
    const isNowConnected = isChannelConnected;
    
    if (wasDisconnected && isNowConnected && gameId && !isRecovering.current) {
      handleGameStateRecovery();
    }
    
    lastConnectionState.current = isChannelConnected;
  }, [isChannelConnected, gameId]);

  const handleGameStateRecovery = async () => {
    if (!gameId || isRecovering.current) return;
    
    isRecovering.current = true;
    notifyInfo('Syncing game state...');
    
    try {
      // Fetch latest game state from database
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          *,
          white_player:profiles!games_white_player_id_fkey(id, username),
          black_player:profiles!games_black_player_id_fkey(id, username)
        `)
        .eq('id', gameId)
        .single();

      if (gameError || !gameData) {
        throw new Error('Failed to fetch game state');
      }

      // Fetch latest moves
      const { data: movesData, error: movesError } = await supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('move_number', { ascending: true })
        .order('is_white', { ascending: false });

      if (movesError) {
        throw new Error('Failed to fetch moves');
      }

      // Update local state with server state
      const currentPgn = game?.pgn || '';
      const serverPgn = gameData.pgn || '';
      
      // Check if states are different
      if (currentPgn !== serverPgn || game?.status !== gameData.status) {
        // Update game state
        await syncGameState({
          game: gameData,
          moves: movesData || []
        });
        
        notifySuccess('Game state synchronized');
        
        // Log recovery details
        console.log('[GameStateRecovery] State recovered:', {
          movesDifference: (movesData?.length || 0) - (movesData?.length || 0),
          statusChanged: game?.status !== gameData.status,
          reconnectAttempt: reconnectAttempts
        });
      } else {
        notifyInfo('Game state is up to date');
      }
    } catch (error) {
      console.error('[GameStateRecovery] Failed to recover state:', error);
      notifyInfo('Failed to sync game state. Please refresh the page if issues persist.');
    } finally {
      isRecovering.current = false;
    }
  };

  // Also recover on manual reconnect
  useEffect(() => {
    if (reconnectAttempts > 0 && isChannelConnected) {
      handleGameStateRecovery();
    }
  }, [reconnectAttempts, isChannelConnected]);

  return {
    isRecovering: isRecovering.current,
    handleGameStateRecovery
  };
}