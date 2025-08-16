/// <reference lib="deno.ns" />
/**
 * Server-side Clock Handlers for Edge Functions
 * Implements real-time clock management based on Lichess methodology
 */

import { createLogger } from "./logger.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";

const logger = createLogger("CLOCK_HANDLERS");

export interface ClockState {
  whiteTimeRemaining: number;
  blackTimeRemaining: number;
  whiteTurnStartTime: number | null;
  blackTurnStartTime: number | null;
  lastClockUpdate: string;
  lagCompensationMs: number;
}

export interface ClockUpdate {
  type: "clock_update";
  gameId: string;
  color: "white" | "black";
  timeRemaining: number;
  turnStartTime: number;
  incrementApplied: boolean;
  whiteTime: number;
  blackTime: number;
}

/**
 * Start a player's clock when their turn begins
 */
export async function startPlayerClock(
  supabase: TypedSupabaseClient,
  gameId: string,
  color: "white" | "black"
): Promise<void> {
  const nowMs = Date.now();
  
  try {
    const updateData = color === "white" 
      ? {
          white_turn_start_time: nowMs,
          black_turn_start_time: null,
          last_clock_update: new Date().toISOString(),
        }
      : {
          black_turn_start_time: nowMs,
          white_turn_start_time: null,
          last_clock_update: new Date().toISOString(),
        };
    
    const { error } = await supabase
      .from("games")
      .update(updateData)
      .eq("id", gameId);
    
    if (error) {
      logger.error(`Failed to start ${color} clock:`, error);
      throw error;
    }
    
    logger.info(`Started ${color} clock for game ${gameId}`);
  } catch (err) {
    logger.error(`Exception starting clock:`, err);
    throw err;
  }
}

/**
 * Stop a player's clock and apply increment
 */
export async function stopPlayerClock(
  supabase: TypedSupabaseClient,
  gameId: string,
  color: "white" | "black",
  applyIncrement = true
): Promise<number> {
  const nowMs = Date.now();
  
  try {
    // Get current game state
    const { data: game, error: fetchError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
    
    if (fetchError || !game) {
      logger.error("Failed to fetch game:", fetchError);
      throw fetchError || new Error("Game not found");
    }
    
    const turnStartTime = color === "white" 
      ? game.white_turn_start_time 
      : game.black_turn_start_time;
    
    if (!turnStartTime) {
      // Clock wasn't running
      return color === "white" ? game.white_time_remaining : game.black_time_remaining;
    }
    
    // Calculate time used
    const timeUsed = nowMs - turnStartTime;
    const currentRemaining = color === "white" 
      ? game.white_time_remaining 
      : game.black_time_remaining;
    
    let newTimeRemaining = Math.max(0, currentRemaining - timeUsed);
    
    // Apply increment if specified
    if (applyIncrement && game.time_control?.increment) {
      newTimeRemaining += game.time_control.increment;
    }
    
    // Update database
    const updateData = color === "white"
      ? {
          white_time_remaining: newTimeRemaining,
          white_turn_start_time: null,
          last_clock_update: new Date().toISOString(),
        }
      : {
          black_time_remaining: newTimeRemaining,
          black_turn_start_time: null,
          last_clock_update: new Date().toISOString(),
        };
    
    const { error: updateError } = await supabase
      .from("games")
      .update(updateData)
      .eq("id", gameId);
    
    if (updateError) {
      logger.error(`Failed to stop ${color} clock:`, updateError);
      throw updateError;
    }
    
    logger.info(`Stopped ${color} clock for game ${gameId}, new time: ${newTimeRemaining}ms`);
    return newTimeRemaining;
  } catch (err) {
    logger.error(`Exception stopping clock:`, err);
    throw err;
  }
}

/**
 * Handle clock update after a move
 */
export async function handleMoveClockUpdate(
  supabase: TypedSupabaseClient,
  gameId: string,
  movingColor: "white" | "black"
): Promise<ClockUpdate> {
  const nowMs = Date.now();
  
  try {
    // Stop moving player's clock with increment
    const newTimeRemaining = await stopPlayerClock(supabase, gameId, movingColor, true);
    
    // Start opponent's clock
    const opponentColor = movingColor === "white" ? "black" : "white";
    await startPlayerClock(supabase, gameId, opponentColor);
    
    // Get updated game state
    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
    
    if (error || !game) {
      throw error || new Error("Failed to fetch updated game");
    }
    
    // Build clock update message
    const clockUpdate: ClockUpdate = {
      type: "clock_update",
      gameId,
      color: movingColor,
      timeRemaining: newTimeRemaining,
      turnStartTime: nowMs,
      incrementApplied: (game.time_control?.increment || 0) > 0,
      whiteTime: game.white_time_remaining,
      blackTime: game.black_time_remaining,
    };
    
    // Store clock state in database
    const { error: stateError } = await supabase
      .from("games")
      .update({ clock_state: clockUpdate })
      .eq("id", gameId);
    
    if (stateError) {
      logger.warn("Failed to store clock state:", stateError);
    }
    
    return clockUpdate;
  } catch (err) {
    logger.error(`Exception handling move clock update:`, err);
    throw err;
  }
}

/**
 * Check for time violations
 */
export async function checkTimeViolations(
  supabase: TypedSupabaseClient,
  gameId: string
): Promise<"white" | "black" | null> {
  const nowMs = Date.now();
  
  try {
    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
    
    if (error || !game || game.status !== "active") {
      return null;
    }
    
    // Calculate current time remaining
    const whiteRemaining = game.white_turn_start_time
      ? Math.max(0, game.white_time_remaining - (nowMs - game.white_turn_start_time))
      : game.white_time_remaining;
    
    const blackRemaining = game.black_turn_start_time
      ? Math.max(0, game.black_time_remaining - (nowMs - game.black_turn_start_time))
      : game.black_time_remaining;
    
    // Check for violations
    if (whiteRemaining <= 0 && game.white_turn_start_time) {
      // White flagged
      const { error: updateError } = await supabase
        .from("games")
        .update({
          status: "finished",
          result: "black",
          end_reason: "timeout",
          white_time_remaining: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);
      
      if (updateError) {
        logger.error("Failed to update game after white timeout:", updateError);
      }
      
      logger.info(`White flagged in game ${gameId}`);
      return "white";
    } else if (blackRemaining <= 0 && game.black_turn_start_time) {
      // Black flagged
      const { error: updateError } = await supabase
        .from("games")
        .update({
          status: "finished",
          result: "white",
          end_reason: "timeout",
          black_time_remaining: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId);
      
      if (updateError) {
        logger.error("Failed to update game after black timeout:", updateError);
      }
      
      logger.info(`Black flagged in game ${gameId}`);
      return "black";
    }
    
    return null;
  } catch (err) {
    logger.error(`Exception checking time violations:`, err);
    return null;
  }
}

/**
 * Get current clock state for a game
 */
export async function getClockState(
  supabase: TypedSupabaseClient,
  gameId: string
): Promise<ClockState | null> {
  try {
    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();
    
    if (error || !game) {
      return null;
    }
    
    const nowMs = Date.now();
    
    // Calculate real-time remaining
    const whiteRemaining = game.white_turn_start_time
      ? Math.max(0, game.white_time_remaining - (nowMs - game.white_turn_start_time))
      : game.white_time_remaining;
    
    const blackRemaining = game.black_turn_start_time
      ? Math.max(0, game.black_time_remaining - (nowMs - game.black_turn_start_time))
      : game.black_time_remaining;
    
    return {
      whiteTimeRemaining: whiteRemaining,
      blackTimeRemaining: blackRemaining,
      whiteTurnStartTime: game.white_turn_start_time,
      blackTurnStartTime: game.black_turn_start_time,
      lastClockUpdate: game.last_clock_update,
      lagCompensationMs: game.lag_compensation_ms || 0,
    };
  } catch (err) {
    logger.error(`Exception getting clock state:`, err);
    return null;
  }
}

/**
 * Initialize clock for a new game
 */
export async function initializeGameClock(
  supabase: TypedSupabaseClient,
  gameId: string,
  timeControl: { initial_time: number; increment: number }
): Promise<void> {
  try {
    const { error } = await supabase
      .from("games")
      .update({
        time_control: timeControl,
        white_time_remaining: timeControl.initial_time,
        black_time_remaining: timeControl.initial_time,
        white_turn_start_time: Date.now(), // White starts
        black_turn_start_time: null,
        last_clock_update: new Date().toISOString(),
        clock_state: {
          type: "clock_init",
          whiteTime: timeControl.initial_time,
          blackTime: timeControl.initial_time,
          activeColor: "white",
          serverTime: Date.now(),
        },
      })
      .eq("id", gameId);
    
    if (error) {
      logger.error("Failed to initialize game clock:", error);
      throw error;
    }
    
    logger.info(`Initialized clock for game ${gameId}`);
  } catch (err) {
    logger.error(`Exception initializing clock:`, err);
    throw err;
  }
}

/**
 * Handle lag compensation update
 */
export async function updateLagCompensation(
  supabase: TypedSupabaseClient,
  gameId: string,
  playerId: string,
  latencyMs: number
): Promise<void> {
  try {
    // For now, just store the average lag compensation
    // In a full implementation, we'd track per-player and calculate average
    const { error } = await supabase
      .from("games")
      .update({
        lag_compensation_ms: Math.min(1000, latencyMs), // Cap at 1 second
      })
      .eq("id", gameId);
    
    if (error) {
      logger.warn("Failed to update lag compensation:", error);
    }
  } catch (err) {
    logger.error(`Exception updating lag compensation:`, err);
  }
}