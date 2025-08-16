/**
 * Real-time Time Control Types
 * Based on Lichess methodology for accurate, fair time tracking
 */

import type { PlayerColor } from "./game";

/**
 * Time control configuration
 */
export interface TimeControl {
  initialTime: number; // milliseconds
  increment: number; // milliseconds added after each move
}

/**
 * Clock state for a single player
 */
export interface PlayerClock {
  timeRemaining: number; // milliseconds
  turnStartTime: number | null; // timestamp when turn started
  lastUpdateTime: number; // timestamp of last update
  isRunning: boolean;
}

/**
 * Complete clock state for a game
 */
export interface GameClock {
  white: PlayerClock;
  black: PlayerClock;
  activeColor: PlayerColor | null;
  serverTime: number; // server timestamp for synchronization
  latencyCompensation: number; // milliseconds to compensate for network lag
}

/**
 * Clock synchronization message from server
 */
export interface ClockSyncMessage {
  type: "clock_sync";
  gameId: string;
  white: {
    timeRemaining: number;
    isRunning: boolean;
  };
  black: {
    timeRemaining: number;
    isRunning: boolean;
  };
  activeColor: PlayerColor | null;
  serverTime: number;
  moveNumber: number;
}

/**
 * Clock update message (sent after moves)
 */
export interface ClockUpdateMessage {
  type: "clock_update";
  gameId: string;
  color: PlayerColor;
  timeRemaining: number;
  turnStartTime: number;
  incrementApplied: boolean;
}

/**
 * Time violation (flag) message
 */
export interface TimeFlagMessage {
  type: "time_flag";
  gameId: string;
  flaggedColor: PlayerColor;
  reportedBy: PlayerColor;
  serverVerified: boolean;
}

/**
 * Lag compensation data
 */
export interface LagCompensation {
  averageLatency: number; // milliseconds
  lastPingTime: number;
  lastPongTime: number;
  samples: number[];
  maxCompensation: number; // maximum lag compensation allowed
}

/**
 * Clock preferences (user settings)
 */
export interface ClockPreferences {
  showTenths: boolean; // show tenths of seconds
  showProgressBar: boolean; // visual progress bar
  soundEnabled: boolean; // tick/warning sounds
  warningTime: number; // milliseconds before warning (e.g., 30 seconds)
  criticalTime: number; // milliseconds for critical warning (e.g., 10 seconds)
}

/**
 * Time control categories
 */
export enum TimeCategory {
  UltraBullet = "ultrabullet", // < 1 minute
  Bullet = "bullet", // 1-2 minutes
  Blitz = "blitz", // 5-8 minutes
  Rapid = "rapid", // 8-20 minutes
  Classical = "classical", // 30+ minutes
  Correspondence = "correspondence", // days
}

/**
 * Calculate time category from time control
 */
export function getTimeCategory(timeControl: TimeControl): TimeCategory {
  // Formula: estimated duration = initialTime + 40 * increment
  const estimatedDuration = timeControl.initialTime + 40 * timeControl.increment;
  
  if (estimatedDuration < 60000) return TimeCategory.UltraBullet;
  if (estimatedDuration <= 120000) return TimeCategory.Bullet;
  if (estimatedDuration <= 480000) return TimeCategory.Blitz;
  if (estimatedDuration <= 1200000) return TimeCategory.Rapid;
  if (estimatedDuration <= 86400000) return TimeCategory.Classical;
  return TimeCategory.Correspondence;
}

/**
 * Clock tick interval based on time category
 */
export function getClockTickInterval(category: TimeCategory): number {
  switch (category) {
    case TimeCategory.UltraBullet:
    case TimeCategory.Bullet:
      return 100; // Update every 100ms for fast games
    case TimeCategory.Blitz:
      return 200; // Update every 200ms
    case TimeCategory.Rapid:
    case TimeCategory.Classical:
      return 1000; // Update every second
    case TimeCategory.Correspondence:
      return 60000; // Update every minute
  }
}