import { useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { GameService } from '@/services/gameService';
import type { Game } from '@/types/game';

/**
 * Minimal, lichess-like game sync hook:
 * - One authoritative fetch on mount
 * - One realtime subscription per game
 * - Server snapshot is the single source of truth
 */
export function useGameSync(gameId: string | undefined, userId: string | undefined) {
  const initGame = useUnifiedGameStore(s => s.initGame);
  const syncWithServer = useUnifiedGameStore(s => s.syncWithServer);
  const setLoading = useUnifiedGameStore(s => s.setLoading);
  const setConnected = useUnifiedGameStore(s => s.setConnected);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!gameId || gameId === 'local') return;
      setLoading(true);
      try {
        const game = await GameService.getGame(gameId);
        if (!mounted || !game) return;

        // Derive my color from IDs
        const myColor = !userId
          ? null
          : game.whitePlayerId === userId
            ? 'white'
            : game.blackPlayerId === userId
              ? 'black'
              : null;

        initGame(gameId, game, myColor);
      } finally {
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [gameId, userId, initGame, setLoading]);

  useEffect(() => {
    if (!gameId || gameId === 'local') return;

    const channel = supabase
      .channel(`game:${gameId}:unified`)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        const snapshot = payload.payload as Game;
        if (snapshot) {
          syncWithServer(snapshot as any);
        }
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, syncWithServer, setConnected]);
}
