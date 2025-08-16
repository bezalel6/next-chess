/**
 * Clock Synchronization Hook
 * Manages real-time clock updates via WebSocket
 * Implements lag compensation and server synchronization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/utils/supabase";
import type { 
  GameClock, 
  ClockSyncMessage, 
  ClockUpdateMessage,
  TimeFlagMessage,
  LagCompensation,
  TimeControl
} from "@/types/time-control";
import type { PlayerColor } from "@/types/game";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseClockSyncOptions {
  gameId: string;
  timeControl: TimeControl;
  myColor: PlayerColor | null;
  onTimeFlag?: (color: PlayerColor) => void;
  enabled?: boolean;
}

interface ClockSyncState {
  clock: GameClock;
  isConnected: boolean;
  latency: number;
  lastSync: number;
}

export function useClockSync({
  gameId,
  timeControl,
  myColor,
  onTimeFlag,
  enabled = true,
}: UseClockSyncOptions): ClockSyncState {
  const [clock, setClock] = useState<GameClock>(() => ({
    white: {
      timeRemaining: timeControl.initialTime,
      turnStartTime: null,
      lastUpdateTime: Date.now(),
      isRunning: false,
    },
    black: {
      timeRemaining: timeControl.initialTime,
      turnStartTime: null,
      lastUpdateTime: Date.now(),
      isRunning: false,
    },
    activeColor: "white",
    serverTime: Date.now(),
    latencyCompensation: 0,
  }));

  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [lastSync, setLastSync] = useState(Date.now());
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lagCompensationRef = useRef<LagCompensation>({
    averageLatency: 0,
    lastPingTime: 0,
    lastPongTime: 0,
    samples: [],
    maxCompensation: 1000,
  });
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate latency with ping-pong
   */
  const measureLatency = useCallback(() => {
    const pingTime = Date.now();
    lagCompensationRef.current.lastPingTime = pingTime;
    
    // Send ping to server
    channelRef.current?.send({
      type: "broadcast",
      event: "clock_ping",
      payload: {
        gameId,
        playerId: myColor,
        timestamp: pingTime,
      },
    });
  }, [gameId, myColor]);

  /**
   * Handle pong response from server
   */
  const handlePong = useCallback((payload: any) => {
    const pongTime = Date.now();
    const pingTime = payload.timestamp;
    const roundTripTime = pongTime - pingTime;
    const estimatedLatency = roundTripTime / 2;
    
    // Update lag compensation
    const lagComp = lagCompensationRef.current;
    lagComp.lastPongTime = pongTime;
    lagComp.samples.push(estimatedLatency);
    
    // Keep only last 10 samples
    if (lagComp.samples.length > 10) {
      lagComp.samples.shift();
    }
    
    // Calculate average latency
    lagComp.averageLatency = lagComp.samples.reduce((a, b) => a + b, 0) / lagComp.samples.length;
    setLatency(lagComp.averageLatency);
    
    // Apply to clock
    setClock(prev => ({
      ...prev,
      latencyCompensation: Math.min(lagComp.maxCompensation, lagComp.averageLatency),
    }));
  }, []);

  /**
   * Handle clock sync message from server
   */
  const handleClockSync = useCallback((message: ClockSyncMessage) => {
    const now = Date.now();
    const serverTimeDiff = now - message.serverTime;
    const compensation = Math.min(1000, serverTimeDiff / 2); // Half RTT as compensation
    
    setClock(prev => ({
      white: {
        timeRemaining: message.white.timeRemaining + (message.white.isRunning ? compensation : 0),
        turnStartTime: message.white.isRunning ? message.serverTime : null,
        lastUpdateTime: now,
        isRunning: message.white.isRunning,
      },
      black: {
        timeRemaining: message.black.timeRemaining + (message.black.isRunning ? compensation : 0),
        turnStartTime: message.black.isRunning ? message.serverTime : null,
        lastUpdateTime: now,
        isRunning: message.black.isRunning,
      },
      activeColor: message.activeColor,
      serverTime: message.serverTime,
      latencyCompensation: compensation,
    }));
    
    setLastSync(now);
  }, []);

  /**
   * Handle clock update after moves
   */
  const handleClockUpdate = useCallback((message: ClockUpdateMessage) => {
    setClock(prev => {
      const newClock = { ...prev };
      
      // Update the player who just moved
      newClock[message.color] = {
        timeRemaining: message.timeRemaining,
        turnStartTime: null,
        lastUpdateTime: Date.now(),
        isRunning: false,
      };
      
      // Start the opponent's clock
      const oppositeColor = message.color === "white" ? "black" : "white";
      newClock[oppositeColor] = {
        ...newClock[oppositeColor],
        turnStartTime: message.turnStartTime,
        isRunning: true,
        lastUpdateTime: Date.now(),
      };
      
      newClock.activeColor = oppositeColor;
      newClock.serverTime = Date.now();
      
      return newClock;
    });
  }, []);

  /**
   * Handle time flag (time violation)
   */
  const handleTimeFlag = useCallback((message: TimeFlagMessage) => {
    if (message.serverVerified) {
      // Server confirmed the flag
      setClock(prev => ({
        ...prev,
        [message.flaggedColor]: {
          ...prev[message.flaggedColor],
          timeRemaining: 0,
          isRunning: false,
          turnStartTime: null,
        },
      }));
      
      onTimeFlag?.(message.flaggedColor);
    }
  }, [onTimeFlag]);

  /**
   * Report a time flag to the server (opponent flagging)
   */
  const reportTimeFlag = useCallback((color: PlayerColor) => {
    if (!myColor || color === myColor) return;
    
    channelRef.current?.send({
      type: "broadcast",
      event: "time_flag",
      payload: {
        gameId,
        flaggedColor: color,
        reportedBy: myColor,
        timestamp: Date.now(),
      },
    });
  }, [gameId, myColor]);

  /**
   * Set up WebSocket channel and listeners
   */
  useEffect(() => {
    if (!enabled || !gameId) return;
    
    // Create channel for game clock updates
    const channel = supabase.channel(`game-clock:${gameId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: myColor || "spectator" },
      },
    });
    
    channelRef.current = channel;
    
    // Subscribe to clock events
    channel
      .on("broadcast", { event: "clock_sync" }, ({ payload }) => {
        handleClockSync(payload as ClockSyncMessage);
      })
      .on("broadcast", { event: "clock_update" }, ({ payload }) => {
        handleClockUpdate(payload as ClockUpdateMessage);
      })
      .on("broadcast", { event: "time_flag" }, ({ payload }) => {
        handleTimeFlag(payload as TimeFlagMessage);
      })
      .on("broadcast", { event: "clock_pong" }, ({ payload }) => {
        handlePong(payload);
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
        
        if (status === "SUBSCRIBED") {
          // Request initial sync
          channel.send({
            type: "broadcast",
            event: "request_sync",
            payload: { gameId },
          });
        }
      });
    
    // Set up periodic latency measurement
    pingIntervalRef.current = setInterval(measureLatency, 5000); // Every 5 seconds
    
    // Cleanup
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [enabled, gameId, myColor, handleClockSync, handleClockUpdate, handleTimeFlag, handlePong, measureLatency]);

  /**
   * Local clock update (client-side prediction)
   */
  useEffect(() => {
    if (!clock.activeColor) return;
    
    const interval = setInterval(() => {
      setClock(prev => {
        if (!prev.activeColor || !prev[prev.activeColor].isRunning) {
          return prev;
        }
        
        const now = Date.now();
        const activeClock = prev[prev.activeColor];
        
        if (!activeClock.turnStartTime) return prev;
        
        const elapsed = now - activeClock.turnStartTime;
        const remaining = Math.max(0, activeClock.timeRemaining - elapsed);
        
        // Check for local time flag
        if (remaining <= 0 && prev.activeColor !== myColor) {
          reportTimeFlag(prev.activeColor);
        }
        
        return {
          ...prev,
          [prev.activeColor]: {
            ...activeClock,
            timeRemaining: remaining,
            lastUpdateTime: now,
          },
        };
      });
    }, 100); // Update every 100ms for smooth display
    
    return () => clearInterval(interval);
  }, [clock.activeColor, myColor, reportTimeFlag]);

  return {
    clock,
    isConnected,
    latency,
    lastSync,
  };
}

/**
 * Hook for sending clock updates (used by server/game logic)
 */
export function useClockBroadcast(gameId: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  useEffect(() => {
    const channel = supabase.channel(`game-clock:${gameId}`, {
      config: { broadcast: { self: true } },
    });
    
    channelRef.current = channel;
    channel.subscribe();
    
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [gameId]);
  
  const broadcastClockSync = useCallback((message: ClockSyncMessage) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "clock_sync",
      payload: message,
    });
  }, []);
  
  const broadcastClockUpdate = useCallback((message: ClockUpdateMessage) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "clock_update",
      payload: message,
    });
  }, []);
  
  const broadcastTimeFlag = useCallback((message: TimeFlagMessage) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "time_flag",
      payload: message,
    });
  }, []);
  
  return {
    broadcastClockSync,
    broadcastClockUpdate,
    broadcastTimeFlag,
  };
}