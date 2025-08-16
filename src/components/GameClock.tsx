/**
 * Client-side Game Clock Component
 * Implements local prediction with server synchronization
 * Based on Lichess methodology
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Typography, LinearProgress, useTheme } from "@mui/material";
import { Timer, TimerOff } from "@mui/icons-material";
import type { 
  PlayerClock, 
  ClockSyncMessage, 
  ClockUpdateMessage,
  TimeCategory,
  ClockPreferences 
} from "@/types/time-control";
import type { PlayerColor } from "@/types/game";
import { getTimeCategory, getClockTickInterval } from "@/types/time-control";

interface GameClockProps {
  color: PlayerColor;
  timeControl: {
    initialTime: number;
    increment: number;
  };
  isActive: boolean;
  isMyTurn: boolean;
  serverClock?: PlayerClock;
  onTimeFlag?: () => void;
  preferences?: Partial<ClockPreferences>;
}

export function GameClock({
  color,
  timeControl,
  isActive,
  isMyTurn,
  serverClock,
  onTimeFlag,
  preferences = {},
}: GameClockProps) {
  const theme = useTheme();
  const [localTime, setLocalTime] = useState(serverClock?.timeRemaining || timeControl.initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const turnStartRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Default preferences
  const clockPrefs: ClockPreferences = {
    showTenths: true,
    showProgressBar: true,
    soundEnabled: true,
    warningTime: 30000,
    criticalTime: 10000,
    ...preferences,
  };

  // Determine update interval based on time category
  const timeCategory = getTimeCategory(timeControl);
  const tickInterval = getClockTickInterval(timeCategory);

  // Format time display
  const formatTime = useCallback((ms: number): string => {
    if (ms < 0) return "0:00";
    
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (clockPrefs.showTenths && ms < 10000) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
    }
    
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [clockPrefs.showTenths]);

  // Handle server synchronization
  const syncWithServer = useCallback((serverTime: number, serverTurnStart: number | null) => {
    setLocalTime(serverTime);
    setLastSync(Date.now());
    
    if (serverTurnStart) {
      turnStartRef.current = serverTurnStart;
      setIsRunning(true);
    } else {
      turnStartRef.current = null;
      setIsRunning(false);
    }
  }, []);

  // Update clock tick
  const updateClock = useCallback(() => {
    if (!isRunning || !turnStartRef.current) return;
    
    const now = Date.now();
    const elapsed = now - turnStartRef.current;
    const remaining = Math.max(0, (serverClock?.timeRemaining || localTime) - elapsed);
    
    setLocalTime(remaining);
    
    // Check for time flag
    if (remaining <= 0 && onTimeFlag) {
      onTimeFlag();
      setIsRunning(false);
    }
    
    // Warning sounds
    if (clockPrefs.soundEnabled && audioRef.current) {
      if (remaining <= clockPrefs.criticalTime && remaining > clockPrefs.criticalTime - tickInterval) {
        audioRef.current.playbackRate = 2.0;
        audioRef.current.play().catch(() => {});
      } else if (remaining <= clockPrefs.warningTime && remaining > clockPrefs.warningTime - tickInterval) {
        audioRef.current.playbackRate = 1.0;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [isRunning, localTime, serverClock, onTimeFlag, clockPrefs, tickInterval]);

  // Start/stop clock based on turn
  useEffect(() => {
    if (isActive && isMyTurn) {
      // Start clock
      if (!turnStartRef.current) {
        turnStartRef.current = Date.now();
      }
      setIsRunning(true);
    } else {
      // Stop clock
      if (isRunning) {
        const elapsed = Date.now() - (turnStartRef.current || Date.now());
        setLocalTime(prev => Math.max(0, prev - elapsed));
      }
      setIsRunning(false);
      turnStartRef.current = null;
    }
  }, [isActive, isMyTurn, isRunning]);

  // Set up clock interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(updateClock, tickInterval);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, updateClock, tickInterval]);

  // Sync with server clock updates
  useEffect(() => {
    if (serverClock) {
      syncWithServer(serverClock.timeRemaining, serverClock.turnStartTime);
    }
  }, [serverClock, syncWithServer]);

  // Calculate progress percentage
  const progressPercentage = (localTime / timeControl.initialTime) * 100;
  
  // Determine color based on time remaining
  const getTimeColor = () => {
    if (localTime <= clockPrefs.criticalTime) return theme.palette.error.main;
    if (localTime <= clockPrefs.warningTime) return theme.palette.warning.main;
    if (isRunning) return theme.palette.primary.main;
    return theme.palette.text.secondary;
  };

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 1,
        bgcolor: isRunning ? "action.selected" : "background.paper",
        border: `2px solid ${isRunning ? theme.palette.primary.main : "transparent"}`,
        transition: "all 0.3s ease",
        minWidth: 120,
      }}
    >
      {/* Player color indicator */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            bgcolor: color === "white" ? "common.white" : "common.black",
            border: "1px solid",
            borderColor: "divider",
            mr: 1,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {color.charAt(0).toUpperCase() + color.slice(1)}
        </Typography>
        {isRunning ? (
          <Timer sx={{ ml: "auto", fontSize: 16, color: getTimeColor() }} />
        ) : (
          <TimerOff sx={{ ml: "auto", fontSize: 16, color: "text.disabled" }} />
        )}
      </Box>

      {/* Time display */}
      <Typography
        variant="h4"
        sx={{
          fontFamily: "monospace",
          fontWeight: "bold",
          color: getTimeColor(),
          textAlign: "center",
          mb: 1,
        }}
      >
        {formatTime(localTime)}
      </Typography>

      {/* Progress bar */}
      {clockPrefs.showProgressBar && (
        <LinearProgress
          variant="determinate"
          value={progressPercentage}
          sx={{
            height: 4,
            borderRadius: 2,
            bgcolor: "action.disabled",
            "& .MuiLinearProgress-bar": {
              bgcolor: getTimeColor(),
              transition: "width 0.1s linear",
            },
          }}
        />
      )}

      {/* Increment indicator */}
      {timeControl.increment > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>
          +{timeControl.increment / 1000}s
        </Typography>
      )}

      {/* Hidden audio element for warning sounds */}
      {clockPrefs.soundEnabled && (
        <audio
          ref={audioRef}
          src="/sounds/clock-tick.mp3"
          preload="auto"
          style={{ display: "none" }}
        />
      )}
    </Box>
  );
}

/**
 * Dual clock display for both players
 */
interface DualClockProps {
  whiteTime: number;
  blackTime: number;
  timeControl: {
    initialTime: number;
    increment: number;
  };
  activeColor: PlayerColor | null;
  myColor: PlayerColor | null;
  onTimeFlag?: (color: PlayerColor) => void;
  preferences?: Partial<ClockPreferences>;
}

export function DualClock({
  whiteTime,
  blackTime,
  timeControl,
  activeColor,
  myColor,
  onTimeFlag,
  preferences,
}: DualClockProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Opponent's clock (top) */}
      <GameClock
        color={myColor === "white" ? "black" : "white"}
        timeControl={timeControl}
        isActive={activeColor === (myColor === "white" ? "black" : "white")}
        isMyTurn={false}
        serverClock={{
          timeRemaining: myColor === "white" ? blackTime : whiteTime,
          turnStartTime: activeColor === (myColor === "white" ? "black" : "white") ? Date.now() : null,
          lastUpdateTime: Date.now(),
          isRunning: activeColor === (myColor === "white" ? "black" : "white"),
        }}
        onTimeFlag={() => onTimeFlag?.(myColor === "white" ? "black" : "white")}
        preferences={preferences}
      />
      
      {/* My clock (bottom) */}
      <GameClock
        color={myColor || "white"}
        timeControl={timeControl}
        isActive={activeColor === myColor}
        isMyTurn={true}
        serverClock={{
          timeRemaining: myColor === "white" ? whiteTime : blackTime,
          turnStartTime: activeColor === myColor ? Date.now() : null,
          lastUpdateTime: Date.now(),
          isRunning: activeColor === myColor,
        }}
        onTimeFlag={() => onTimeFlag?.(myColor || "white")}
        preferences={preferences}
      />
    </Box>
  );
}

// Export SingleClock for individual clock display
export function SingleClock(props: GameClockProps) {
  return <GameClock {...props} />;
}