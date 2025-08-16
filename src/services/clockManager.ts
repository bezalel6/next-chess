/**
 * Server-side Clock Manager
 * Implements timestamp-based time tracking with lag compensation
 * Based on Lichess methodology
 */

import type { 
  TimeControl, 
  PlayerClock, 
  GameClock, 
  ClockSyncMessage,
  ClockUpdateMessage,
  TimeFlagMessage,
  LagCompensation 
} from "@/types/time-control";
import type { PlayerColor } from "@/types/game";

export class ClockManager {
  private gameId: string;
  private timeControl: TimeControl;
  private clock: GameClock;
  private lagCompensation: Map<string, LagCompensation> = new Map();
  private lastMoveTimestamp: number = Date.now();
  private moveCount: number = 0;

  constructor(gameId: string, timeControl: TimeControl) {
    this.gameId = gameId;
    this.timeControl = timeControl;
    
    // Initialize clocks with initial time
    this.clock = {
      white: this.createPlayerClock(timeControl.initialTime),
      black: this.createPlayerClock(timeControl.initialTime),
      activeColor: "white", // White starts
      serverTime: Date.now(),
      latencyCompensation: 0,
    };
  }

  private createPlayerClock(initialTime: number): PlayerClock {
    return {
      timeRemaining: initialTime,
      turnStartTime: null,
      lastUpdateTime: Date.now(),
      isRunning: false,
    };
  }

  /**
   * Start the clock for a player (beginning of their turn)
   */
  startTurn(color: PlayerColor, serverTime?: number): void {
    const now = serverTime || Date.now();
    
    // Stop the other player's clock
    const oppositeColor = color === "white" ? "black" : "white";
    this.stopClock(oppositeColor, now);
    
    // Start this player's clock
    const playerClock = this.clock[color];
    playerClock.turnStartTime = now;
    playerClock.isRunning = true;
    playerClock.lastUpdateTime = now;
    
    this.clock.activeColor = color;
    this.clock.serverTime = now;
  }

  /**
   * Stop a player's clock and calculate time used
   */
  stopClock(color: PlayerColor, serverTime?: number): number {
    const now = serverTime || Date.now();
    const playerClock = this.clock[color];
    
    if (!playerClock.isRunning || !playerClock.turnStartTime) {
      return 0;
    }
    
    // Calculate time used since turn started
    const timeUsed = now - playerClock.turnStartTime;
    
    // Deduct time from remaining (minimum 0)
    playerClock.timeRemaining = Math.max(0, playerClock.timeRemaining - timeUsed);
    playerClock.isRunning = false;
    playerClock.turnStartTime = null;
    playerClock.lastUpdateTime = now;
    
    return timeUsed;
  }

  /**
   * Apply Fischer increment after a move
   */
  applyIncrement(color: PlayerColor): void {
    if (this.timeControl.increment > 0) {
      const playerClock = this.clock[color];
      playerClock.timeRemaining += this.timeControl.increment;
      playerClock.lastUpdateTime = Date.now();
    }
  }

  /**
   * Handle a move: stop current clock, apply increment, start next clock
   */
  handleMove(movingColor: PlayerColor, serverTime?: number): ClockUpdateMessage {
    const now = serverTime || Date.now();
    
    // Stop the moving player's clock
    const timeUsed = this.stopClock(movingColor, now);
    
    // Apply increment to the player who just moved
    this.applyIncrement(movingColor);
    
    // Start the opponent's clock
    const nextColor = movingColor === "white" ? "black" : "white";
    this.startTurn(nextColor, now);
    
    this.lastMoveTimestamp = now;
    this.moveCount++;
    
    return {
      type: "clock_update",
      gameId: this.gameId,
      color: movingColor,
      timeRemaining: this.clock[movingColor].timeRemaining,
      turnStartTime: this.clock[nextColor].turnStartTime!,
      incrementApplied: this.timeControl.increment > 0,
    };
  }

  /**
   * Get current time remaining for a player (with live calculation)
   */
  getTimeRemaining(color: PlayerColor, currentTime?: number): number {
    const now = currentTime || Date.now();
    const playerClock = this.clock[color];
    
    if (!playerClock.isRunning || !playerClock.turnStartTime) {
      return playerClock.timeRemaining;
    }
    
    // Calculate time used so far in current turn
    const timeUsed = now - playerClock.turnStartTime;
    return Math.max(0, playerClock.timeRemaining - timeUsed);
  }

  /**
   * Check for time violations (called periodically or by opponent)
   */
  checkTimeViolation(reportingColor?: PlayerColor): TimeFlagMessage | null {
    const now = Date.now();
    
    // Check both players
    for (const color of ["white", "black"] as PlayerColor[]) {
      const timeRemaining = this.getTimeRemaining(color, now);
      
      if (timeRemaining <= 0 && this.clock[color].isRunning) {
        return {
          type: "time_flag",
          gameId: this.gameId,
          flaggedColor: color,
          reportedBy: reportingColor || (color === "white" ? "black" : "white"),
          serverVerified: true,
        };
      }
    }
    
    return null;
  }

  /**
   * Apply lag compensation for a player
   */
  applyLagCompensation(playerId: string, latency: number): void {
    if (!this.lagCompensation.has(playerId)) {
      this.lagCompensation.set(playerId, {
        averageLatency: latency,
        lastPingTime: Date.now(),
        lastPongTime: Date.now(),
        samples: [latency],
        maxCompensation: 1000, // Max 1 second compensation
      });
    } else {
      const comp = this.lagCompensation.get(playerId)!;
      comp.samples.push(latency);
      
      // Keep only last 10 samples
      if (comp.samples.length > 10) {
        comp.samples.shift();
      }
      
      // Calculate average
      comp.averageLatency = comp.samples.reduce((a, b) => a + b, 0) / comp.samples.length;
      comp.lastPongTime = Date.now();
    }
    
    // Update global compensation (average of both players)
    const allCompensations = Array.from(this.lagCompensation.values());
    if (allCompensations.length > 0) {
      this.clock.latencyCompensation = Math.min(
        1000, // Max 1 second
        allCompensations.reduce((sum, c) => sum + c.averageLatency, 0) / allCompensations.length
      );
    }
  }

  /**
   * Generate clock sync message for clients
   */
  getClockSync(): ClockSyncMessage {
    const now = Date.now();
    
    return {
      type: "clock_sync",
      gameId: this.gameId,
      white: {
        timeRemaining: this.getTimeRemaining("white", now),
        isRunning: this.clock.white.isRunning,
      },
      black: {
        timeRemaining: this.getTimeRemaining("black", now),
        isRunning: this.clock.black.isRunning,
      },
      activeColor: this.clock.activeColor,
      serverTime: now,
      moveNumber: this.moveCount,
    };
  }

  /**
   * Restore clock state from database
   */
  static fromDatabaseState(
    gameId: string,
    timeControl: TimeControl,
    whiteTimeRemaining: number,
    blackTimeRemaining: number,
    activeColor: PlayerColor | null,
    lastMoveTime?: number
  ): ClockManager {
    const manager = new ClockManager(gameId, timeControl);
    
    manager.clock.white.timeRemaining = whiteTimeRemaining;
    manager.clock.black.timeRemaining = blackTimeRemaining;
    manager.clock.activeColor = activeColor;
    
    // If there's an active color, start their clock
    if (activeColor) {
      const turnStartTime = lastMoveTime || Date.now();
      manager.clock[activeColor].turnStartTime = turnStartTime;
      manager.clock[activeColor].isRunning = true;
      manager.clock[activeColor].lastUpdateTime = turnStartTime;
    }
    
    return manager;
  }

  /**
   * Get state for database persistence
   */
  getDatabaseState(): {
    whiteTimeRemaining: number;
    blackTimeRemaining: number;
    lastMoveTime: number;
  } {
    return {
      whiteTimeRemaining: this.getTimeRemaining("white"),
      blackTimeRemaining: this.getTimeRemaining("black"),
      lastMoveTime: this.lastMoveTimestamp,
    };
  }
}