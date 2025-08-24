import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import type { GameMatch } from '@/types/realtime';
import { MatchmakingService } from '@/services/matchmakingService';
import { getErrorMessage } from '@/utils/type-guards';

interface QueueState {
  inQueue: boolean;
  position: number;
  size: number;
}

interface ConnectionStatsLogEntry {
  timestamp: number;
  message: string;
}

interface ConnectionState {
  queue: QueueState;
  matchDetails: GameMatch | null;
  stats: {
    activeUsers: number;
    log: ConnectionStatsLogEntry[];
  };
  // Actions
  setQueue: (queue: Partial<QueueState>) => void;
  setMatchDetails: (match: GameMatch | null) => void;
  addLog: (message: string) => void;
  clearLog: () => void;
  // Presence controls
  startPresence: (userId?: string | null) => Promise<void>;
  stopPresence: () => void;
  // Queue handler
  handleQueueToggle: () => Promise<void>;
}

let presenceChannel: RealtimeChannel | null = null;
let playerChannel: RealtimeChannel | null = null;

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  queue: { inQueue: false, position: 0, size: 0 },
  matchDetails: null,
  stats: { activeUsers: 0, log: [] },

  setQueue: (queue) => set((s) => ({ queue: { ...s.queue, ...queue } })),
  setMatchDetails: (match) => set({ matchDetails: match }),
  addLog: (message) =>
    set((s) => ({
      stats: {
        ...s.stats,
        log: [
          ...s.stats.log.slice(0, 19),
          { message, timestamp: Date.now() },
        ],
      },
    })),
  clearLog: () => set((s) => ({ stats: { ...s.stats, log: [] } })),

  startPresence: async (userId?: string | null) => {
    try {
      // Teardown any existing channels first
      if (presenceChannel) {
        try { presenceChannel.unsubscribe(); } catch {
          // Ignore unsubscribe errors
        }
        presenceChannel = null;
      }
      if (playerChannel) {
        try { playerChannel.unsubscribe(); } catch {
          // Ignore unsubscribe errors
        }
        playerChannel = null;
      }

      const key = userId || 'anonymous-' + Math.random().toString(36).slice(2);

      // Site-wide presence channel (active users)
      const channel = supabase.channel('online-users', {
        config: { presence: { key } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const userCount = Object.keys(state).length;
          set((s) => ({ stats: { ...s.stats, activeUsers: userCount } }));
          get().addLog(`Active users: ${userCount}`);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          get().addLog(`User joined: ${key}`);
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          get().addLog(`User left: ${key}`);
        });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: key, online_at: new Date().toISOString() });
        }
      });

      presenceChannel = channel;

      // Player-specific channel (matchmaking notifications)
      if (userId) {
        const pch = supabase.channel(`player:${userId}`, {
          config: {
            broadcast: { self: true },
            presence: { key: userId },
          },
        });

        pch
          .on('broadcast', { event: 'game_matched' }, (payload) => {
            const { gameId, isWhite, opponentId } = (payload as Record<string, unknown>).payload as Record<string, unknown> || {};
            if (gameId) {
              get().addLog(`Game matched! Game ID: ${gameId}`);
              set({
                matchDetails: { gameId: gameId as string, isWhite: isWhite as boolean, opponentId: opponentId as string },
                queue: { ...get().queue, inQueue: false, position: 0 },
              });
            }
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              get().addLog('Player channel subscribed');
            }
          });

        playerChannel = pch;

        // On auth/connect, check existing matchmaking status and active game
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // Check existing queue status via function (optional)
            try {
              const status = await MatchmakingService.checkStatus(session);
              if (status?.inQueue) {
                set((s) => ({ queue: { ...s.queue, inQueue: true } }));
                get().addLog('Detected existing queue entry');
              } else if (status?.activeGame && status?.game) {
                const game = status.game as Record<string, unknown>;
                if (game.id && typeof game.id === 'string') {
                  set({ matchDetails: { gameId: game.id, isWhite: undefined, opponentId: undefined } });
                  get().addLog(`Detected active game: ${game.id}`);
                }
              }
            } catch (e) {
              // Non-fatal
            }
          }
        } catch {
          // Ignore errors
        }
      }
    } catch (e) {
      console.warn('[connectionStore] startPresence error', e);
    }
  },

  stopPresence: () => {
    try {
      if (presenceChannel) {
        presenceChannel.unsubscribe();
      }
    } catch {
      // Ignore unsubscribe errors
    }
    presenceChannel = null;
    try {
      if (playerChannel) {
        playerChannel.unsubscribe();
      }
    } catch {
      // Ignore unsubscribe errors
    }
    playerChannel = null;
  },

  handleQueueToggle: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        get().addLog('Cannot toggle queue: no session');
        return;
      }

      const state = get();
      if (state.queue.inQueue) {
        // Leave queue
        get().addLog('Attempting to leave matchmaking queue');
        try {
          await MatchmakingService.leaveQueue(session);
          set({ queue: { ...state.queue, inQueue: false, position: 0 } });
          get().addLog('Left matchmaking queue');
        } catch (error) {
          get().addLog(`Error leaving queue: ${getErrorMessage(error) || 'unknown'}`);
        }
      } else {
        // Check if user already has active game
        try {
          const { data: activeGames } = await supabase
            .from('games')
            .select('id')
            .or(`white_player_id.eq.${session.user.id},black_player_id.eq.${session.user.id}`)
            .eq('status', 'active')
            .limit(1);
          if (activeGames && activeGames.length > 0) {
            const gameId = activeGames[0].id;
            set({ matchDetails: { gameId, isWhite: undefined, opponentId: undefined } });
            get().addLog(`Already in an active game: ${gameId}`);
            return;
          }
        } catch (e) {
          get().addLog('Error checking active games');
        }

        // Join queue
        get().addLog('Joining matchmaking queue');
        try {
          await MatchmakingService.joinQueue(session);
          set({ queue: { ...state.queue, inQueue: true } });
          get().addLog('Joined matchmaking queue');
        } catch (error) {
          get().addLog(`Error joining queue: ${getErrorMessage(error) || 'unknown'}`);
        }
      }
    } catch (e) {
      get().addLog('Queue toggle failed');
    }
  },
}));
