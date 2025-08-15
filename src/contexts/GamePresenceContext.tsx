import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';

export interface PlayerPresenceData {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'disconnected';
  lastSeen: Date;
  connectionQuality: 'good' | 'poor' | 'unknown';
  isReconnecting: boolean;
}

interface GamePresenceContextType {
  gameId: string | null;
  myPresence: PlayerPresenceData | null;
  opponentPresence: PlayerPresenceData | null;
  isChannelConnected: boolean;
  reconnectAttempts: number;
  forceReconnect: () => Promise<void>;
}

const GamePresenceContext = createContext<GamePresenceContextType>({
  gameId: null,
  myPresence: null,
  opponentPresence: null,
  isChannelConnected: false,
  reconnectAttempts: 0,
  forceReconnect: async () => {},
});

export const useGamePresence = () => useContext(GamePresenceContext);

interface GamePresenceProviderProps {
  children: React.ReactNode;
  gameId: string;
  opponentId: string;
  opponentUsername?: string;
}

export function GamePresenceProvider({ 
  children, 
  gameId, 
  opponentId,
  opponentUsername = 'Opponent' 
}: GamePresenceProviderProps) {
  const { session } = useAuth();
  const { notifyInfo, notifyWarning } = useNotification();
  
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isChannelConnected, setIsChannelConnected] = useState(false);
  const [myPresence, setMyPresence] = useState<PlayerPresenceData | null>(null);
  const [opponentPresence, setOpponentPresence] = useState<PlayerPresenceData | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const isReconnectingRef = useRef(false);

  // Track user activity with stable handler
  const updateActivity = useCallback(() => {
    lastActivityRef.current = new Date();
    if (channel && myPresence) {
      channel.track({
        ...myPresence,
        lastSeen: new Date().toISOString(),
        status: 'online',
      }).catch(err => {
        console.warn('[GamePresence] Failed to update activity:', err);
      });
    }
  }, [channel, myPresence]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'mousemove'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [updateActivity]);

  // Auto-away detection
  useEffect(() => {
    const checkActivity = () => {
      const now = new Date();
      const timeSinceActivity = now.getTime() - lastActivityRef.current.getTime();
      
      if (timeSinceActivity > 30000 && myPresence?.status === 'online') {
        // Mark as away after 30 seconds of inactivity
        if (channel) {
          channel.track({
            ...myPresence,
            status: 'away',
            lastSeen: lastActivityRef.current.toISOString(),
          });
        }
      }
    };

    const interval = setInterval(checkActivity, 5000);
    return () => clearInterval(interval);
  }, [channel, myPresence]);

  const setupPresenceChannel = useCallback(async () => {
    if (!session?.user || !gameId || isReconnectingRef.current) return;
    
    isReconnectingRef.current = true;

    try {
      // Clean up existing channel
      if (channel) {
        await channel.unsubscribe();
      }

    const presenceChannel = supabase.channel(`game:${gameId}:presence`, {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    // Handle presence sync
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state: RealtimePresenceState = presenceChannel.presenceState();
        
        // Process presence state
        Object.entries(state).forEach(([userId, presences]) => {
          if (presences && presences.length > 0) {
            const latestPresence = presences[presences.length - 1] as any;
            
            const presenceData: PlayerPresenceData = {
              userId,
              username: latestPresence.username || 'Unknown',
              status: latestPresence.status || 'online',
              lastSeen: new Date(latestPresence.lastSeen || new Date()),
              connectionQuality: latestPresence.connectionQuality || 'unknown',
              isReconnecting: latestPresence.isReconnecting || false,
            };

            if (userId === session.user.id) {
              setMyPresence(presenceData);
            } else if (userId === opponentId) {
              setOpponentPresence(presenceData);
            }
          }
        });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`Player ${key} joined the game`);
        if (key === opponentId && newPresences && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setOpponentPresence({
            userId: key,
            username: presence.username || opponentUsername,
            status: 'online',
            lastSeen: new Date(),
            connectionQuality: presence.connectionQuality || 'good',
            isReconnecting: false,
          });
          notifyInfo(`${presence.username || 'Opponent'} reconnected`);
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`Player ${key} left the game`);
        if (key === opponentId) {
          setOpponentPresence(prev => prev ? {
            ...prev,
            status: 'disconnected',
            lastSeen: new Date(),
            isReconnecting: true,
          } : null);
          notifyWarning(`${opponentUsername} disconnected`);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Game presence channel subscribed');
          setIsChannelConnected(true);
          setReconnectAttempts(0);
          
          // Track our initial presence
          const myData = {
            userId: session.user.id,
            username: session.user.email?.split('@')[0] || 'Player',
            status: 'online',
            lastSeen: new Date().toISOString(),
            connectionQuality: 'good',
            isReconnecting: false,
          };
          
          await presenceChannel.track(myData);
          setMyPresence({
            ...myData,
            status: myData.status as 'online' | 'away' | 'disconnected',
            connectionQuality: myData.connectionQuality as 'good' | 'poor' | 'unknown',
            lastSeen: new Date(myData.lastSeen),
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Game presence channel error');
          setIsChannelConnected(false);
          handleReconnect();
        } else if (status === 'TIMED_OUT') {
          console.error('Game presence channel timed out');
          setIsChannelConnected(false);
          handleReconnect();
        } else if (status === 'CLOSED') {
          console.log('Game presence channel closed');
          setIsChannelConnected(false);
        }
      });

      setChannel(presenceChannel);
      return presenceChannel;
    } finally {
      isReconnectingRef.current = false;
    }
  }, [session, gameId, opponentId, opponentUsername]);

  const handleReconnect = useCallback(() => {
    // Prevent concurrent reconnection attempts
    if (reconnectTimeoutRef.current || isReconnectingRef.current) {
      return;
    }

    const attempt = reconnectAttempts;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff, max 30s
    
    console.log(`Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
    setReconnectAttempts(prev => prev + 1);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      setupPresenceChannel();
    }, delay);
  }, [reconnectAttempts, setupPresenceChannel]);

  const forceReconnect = useCallback(async () => {
    console.log('Force reconnecting presence channel');
    setReconnectAttempts(0);
    await setupPresenceChannel();
  }, [setupPresenceChannel]);

  // Initialize presence channel
  useEffect(() => {
    setupPresenceChannel();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
      }
    };
  }, [gameId, opponentId]);

  // Monitor connection health
  useEffect(() => {
    const checkConnection = async () => {
      if (channel && isChannelConnected) {
        try {
          // Update our presence to show we're still here
          if (myPresence) {
            await channel.track({
              ...myPresence,
              lastSeen: new Date().toISOString(),
              connectionQuality: 'good',
            });
          }
        } catch (error) {
          console.error('Failed to update presence:', error);
          setIsChannelConnected(false);
          handleReconnect();
        }
      }
    };

    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [channel, isChannelConnected, myPresence]);

  return (
    <GamePresenceContext.Provider
      value={{
        gameId,
        myPresence,
        opponentPresence,
        isChannelConnected,
        reconnectAttempts,
        forceReconnect,
      }}
    >
      {children}
    </GamePresenceContext.Provider>
  );
}