import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase";

export type PlayerPresenceStatus = 'online' | 'rage_quit' | 'disconnect' | 'offline';

interface PresenceState {
  user_id: string;
  status: PlayerPresenceStatus;
  last_seen: string;
}

interface DisconnectCallback {
  (playerId: string, type: 'rage_quit' | 'disconnect'): void;
}

interface ReconnectCallback {
  (playerId: string): void;
}

export class GamePresenceService {
  private channel: RealtimeChannel | null = null;
  private gameId: string;
  private playerId: string;
  private isCurrentPlayer: boolean;
  private disconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onDisconnect?: DisconnectCallback;
  private onReconnect?: ReconnectCallback;
  private lastActivity: Date = new Date();
  private presenceState: Map<string, PresenceState> = new Map();

  constructor(
    gameId: string,
    playerId: string,
    isCurrentPlayer: boolean,
    onDisconnect?: DisconnectCallback,
    onReconnect?: ReconnectCallback
  ) {
    this.gameId = gameId;
    this.playerId = playerId;
    this.isCurrentPlayer = isCurrentPlayer;
    this.onDisconnect = onDisconnect;
    this.onReconnect = onReconnect;
  }

  async join(): Promise<void> {
    // Create channel for this game
    this.channel = supabase.channel(`game:${this.gameId}`, {
      config: {
        presence: {
          key: this.playerId,
        },
      },
    });

    // Track presence changes
    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState();
        this.handlePresenceSync(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== this.playerId) {
          this.handlePlayerJoin(key!, newPresences);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (key !== this.playerId) {
          this.handlePlayerLeave(key!, leftPresences);
        }
      });

    // Subscribe and track our presence
    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.trackPresence('online');
        this.startHeartbeat();
      }
    });
  }

  private async trackPresence(status: PlayerPresenceStatus): Promise<void> {
    if (!this.channel) return;

    const presence: PresenceState = {
      user_id: this.playerId,
      status,
      last_seen: new Date().toISOString(),
    };

    await this.channel.track(presence);
    this.lastActivity = new Date();
  }

  private startHeartbeat(): void {
    // Send heartbeat every 25 seconds (must be < 30s for Supabase)
    this.heartbeatInterval = setInterval(async () => {
      await this.trackPresence('online');
    }, 25000);
  }

  private handlePresenceSync(state: Record<string, any>): void {
    this.presenceState.clear();
    
    Object.entries(state).forEach(([key, presences]) => {
      const presence = Array.isArray(presences) ? presences[0] : presences;
      if (presence) {
        this.presenceState.set(key, presence as PresenceState);
      }
    });
  }

  private handlePlayerJoin(playerId: string, presences: any[]): void {
    const presence = presences[0] as PresenceState;
    this.presenceState.set(playerId, presence);
    
    // If this was a disconnected player reconnecting
    if (this.onReconnect && presence.status === 'online') {
      this.onReconnect(playerId);
    }
  }

  private handlePlayerLeave(playerId: string, leftPresences: any[]): void {
    // Start disconnect detection
    this.detectDisconnectType(playerId);
  }

  private detectDisconnectType(playerId: string): void {
    // Clear any existing timer
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
    }

    // Rage quit detection: 10 seconds
    this.disconnectTimer = setTimeout(() => {
      // Check if player navigated away (rage quit) or lost connection
      const isRageQuit = this.checkIfRageQuit(playerId);
      
      if (this.onDisconnect) {
        this.onDisconnect(playerId, isRageQuit ? 'rage_quit' : 'disconnect');
      }
    }, 10000); // 10 seconds for rage quit detection
  }

  private checkIfRageQuit(playerId: string): boolean {
    // In a real implementation, we'd check:
    // 1. If the tab/window is still open
    // 2. If they navigated to another page on the site
    // 3. If they closed the tab entirely
    
    // For now, we'll use heuristics:
    // - If they're still on the site (detected via another channel), it's rage quit
    // - Otherwise, it's a disconnect
    
    // This would require checking a site-wide presence channel
    // For simplicity, we'll default to disconnect for now
    return false;
  }

  async updateActivity(): Promise<void> {
    this.lastActivity = new Date();
    await this.trackPresence('online');
  }

  async leave(): Promise<void> {
    // Clean up
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
    }

    if (this.channel) {
      await this.channel.untrack();
      await supabase.removeChannel(this.channel);
    }
  }

  getPlayerStatus(playerId: string): PlayerPresenceStatus {
    const presence = this.presenceState.get(playerId);
    return presence?.status || 'offline';
  }

  isPlayerOnline(playerId: string): boolean {
    return this.getPlayerStatus(playerId) === 'online';
  }

  getLastSeen(playerId: string): Date | null {
    const presence = this.presenceState.get(playerId);
    return presence ? new Date(presence.last_seen) : null;
  }
}

// Hook for React components
import { useEffect, useState, useCallback } from 'react';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';

export function useGamePresence(gameId: string | null) {
  const [presenceService, setPresenceService] = useState<GamePresenceService | null>(null);
  const [opponentStatus, setOpponentStatus] = useState<PlayerPresenceStatus>('offline');
  const { user } = useAuth();
  const game = useUnifiedGameStore(state => state.game);

  const handleDisconnect = useCallback(async (playerId: string, type: 'rage_quit' | 'disconnect') => {
    if (!gameId || !user) return;

    // Call edge function to handle disconnect
    const { error } = await supabase.functions.invoke('handle-disconnect', {
      body: {
        gameId,
        playerId,
        disconnectType: type,
      },
    });

    if (error) {
      console.error('Failed to handle disconnect:', error);
    }
  }, [gameId, user]);

  const handleReconnect = useCallback(async (playerId: string) => {
    if (!gameId || !user) return;

    // Call edge function to handle reconnect
    const { error } = await supabase.functions.invoke('handle-reconnect', {
      body: {
        gameId,
        playerId,
      },
    });

    if (error) {
      console.error('Failed to handle reconnect:', error);
    }
  }, [gameId, user]);

  useEffect(() => {
    if (!gameId || !user || !game) return;

    const isCurrentPlayer = 
      (game.turn === 'white' && game.whitePlayerId === user.id) ||
      (game.turn === 'black' && game.blackPlayerId === user.id);

    const service = new GamePresenceService(
      gameId,
      user.id,
      isCurrentPlayer,
      handleDisconnect,
      handleReconnect
    );

    service.join().then(() => {
      setPresenceService(service);
    });

    return () => {
      service.leave();
    };
  }, [gameId, user, game, handleDisconnect, handleReconnect]);

  // Track opponent status
  useEffect(() => {
    if (!presenceService || !game || !user) return;

    const opponentId = game.whitePlayerId === user.id 
      ? game.blackPlayerId 
      : game.whitePlayerId;

    const interval = setInterval(() => {
      const status = presenceService.getPlayerStatus(opponentId);
      setOpponentStatus(status);
    }, 1000);

    return () => clearInterval(interval);
  }, [presenceService, game, user]);

  const updateActivity = useCallback(async () => {
    await presenceService?.updateActivity();
  }, [presenceService]);

  return {
    opponentStatus,
    updateActivity,
    presenceService,
  };
}