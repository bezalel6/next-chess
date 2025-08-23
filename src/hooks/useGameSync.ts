import { useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { GameService } from '@/services/gameService';
import type { Game } from '@/types/game';
import type { ChatMessage } from '@/types/chat';

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
  const loadMessages = useUnifiedGameStore(s => s.loadMessages);
  const receiveMessage = useUnifiedGameStore(s => s.receiveMessage);
  const setChatTimeout = useUnifiedGameStore(s => s.setChatTimeout);

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
        
        // Load chat messages after game is initialized
        loadMessages(gameId);
      } finally {
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [gameId, userId, initGame, setLoading, loadMessages]);

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
      // Subscribe to new chat messages via postgres_changes
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_messages',
        filter: `game_id=eq.${gameId}`
      }, ({ new: message }) => {
        if (message && message.sender_id !== userId) {
          receiveMessage(GameService.mapChatMessageFromDB(message));
        }
      })
      // Subscribe to timeout updates for current user
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_timeouts',
        filter: `user_id=eq.${userId}`
      }, ({ new: timeout }) => {
        if (timeout) {
          setChatTimeout(new Date(timeout.timeout_until));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_timeouts',
        filter: `user_id=eq.${userId}`
      }, ({ new: timeout }) => {
        if (timeout) {
          const timeoutUntil = new Date(timeout.timeout_until);
          if (timeoutUntil > new Date()) {
            setChatTimeout(timeoutUntil);
          } else {
            setChatTimeout(null);
          }
        }
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, userId, syncWithServer, setConnected, receiveMessage, setChatTimeout]);
}
