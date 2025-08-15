import { useEffect, useRef } from 'react';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { supabase } from '@/utils/supabase';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Hook to handle game state recovery on reconnection
 * Syncs local game state with server state when connection is restored
 */
export function useGameStateRecovery(gameId: string | null) {
  const { notifyInfo, notifySuccess } = useNotification();
  const game = useUnifiedGameStore(s => s.game);
  const syncGameState = useUnifiedGameStore(s => s.syncGameState);
  
  const isRecovering = useRef(false);

  // We'll trigger recovery manually when needed
  // This could be called by the presence service on reconnect
  useEffect(() => {
    // Set up a channel to listen for reconnection events
    if (!gameId) return;
    
    const channel = supabase.channel(`game-recovery:${gameId}`)
      .on('presence', { event: 'sync' }, () => {
        // When presence syncs, we might have reconnected
        if (!isRecovering.current) {
          handleGameStateRecovery();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const handleGameStateRecovery = async () => {
    if (!gameId || isRecovering.current) return;
    
    isRecovering.current = true;
    notifyInfo('Syncing game state...');
    
    try {
      // Fetch latest game state from database
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error('[GameStateRecovery] Game fetch error:', gameError);
        throw new Error(`Failed to fetch game state: ${gameError.message}`);
      }
      
      if (!gameData) {
        console.warn('[GameStateRecovery] Game not found:', gameId);
        return; // Game might have been deleted or doesn't exist
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
          statusChanged: game?.status !== gameData.status
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

  return {
    isRecovering: isRecovering.current,
    handleGameStateRecovery
  };
}