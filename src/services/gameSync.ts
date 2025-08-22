import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useDebugLogStore } from '@/stores/debugLogStore';
import { toClientGame, toClientMove, toClientBan } from './mappers';

export function subscribeToGame(gameId: string) {
  const { logBroadcastReceived } = useDebugLogStore.getState();
  const channel = supabase
    .channel(`game:${gameId}:unified`)
    .on('broadcast', { event: 'game_update' }, (payload) => {
      logBroadcastReceived('game_update', payload.payload);
      if (payload.payload) {
        const game = toClientGame(payload.payload);
        useUnifiedGameStore.getState().syncWithServer(game as any);
      }
    })
    .on('broadcast', { event: 'move' }, (payload) => {
      logBroadcastReceived('move', payload.payload);
      const state = useUnifiedGameStore.getState();
      const optimisticMove = state.optimisticMove;
      const b = payload.payload as any;

      // If this confirms our own optimistic move, avoid refetch and just confirm
      if (b?.from && b?.to && optimisticMove && optimisticMove.from === b.from && optimisticMove.to === b.to) {
        if (b.pgn || b.fen) {
          state.updateGame({
            ...(b.pgn ? { pgn: b.pgn } : {}),
            ...(b.fen ? { currentFen: b.fen } : {}),
            lastMove: b.from && b.to ? { from: b.from, to: b.to } : undefined,
          } as any);
        }
        state.confirmOptimisticUpdate();
        return;
      }

      // For opponent moves: apply directly to store
      if (b?.from && b?.to && b?.fen) {
        state.receiveMove(toClientMove(b) as any);
      }
    })
    .on('broadcast', { event: 'ban' }, (payload) => {
      logBroadcastReceived('ban', payload.payload);
      const state = useUnifiedGameStore.getState();
      const optimisticBan = state.optimisticBan;
      const b = payload.payload as any;

      if (optimisticBan && b?.from === optimisticBan.from && b?.to === optimisticBan.to) {
        state.confirmOptimisticUpdate();
        // If PGN present, update game minimally
        if (b?.pgn) state.updateGame({ pgn: b.pgn } as any);
        return;
      }

      if (b?.from && b?.to) {
        state.receiveBan(toClientBan(b) as any);
      }
    })
    .subscribe((status) => {
      useUnifiedGameStore.getState().setConnected(status === 'SUBSCRIBED');
    });

  return () => {
    channel.unsubscribe();
  };
}
