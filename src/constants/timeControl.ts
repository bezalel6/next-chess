/**
 * Time control utilities
 *
 * IMPORTANT: This file no longer defines the time control values.
 * The single source of truth is now the database function get_default_time_control().
 * This file only provides utilities to fetch those values.
 */

import { supabase } from "@/utils/supabase";

// Time control interface (matches what database returns)
export interface TimeControl {
  initialTime: number; // milliseconds
  increment: number; // milliseconds
}

/**
 * Fetches the default time control values from the database
 */
export async function getDefaultTimeControl(): Promise<TimeControl> {
  try {
    // Use the supabase client to call the RPC function
    const { data, error } = await supabase.rpc("get_default_time_control");

    if (error) {
      console.error("Error fetching default time control:", error);
      // Fallback only if database call fails
      return { initialTime: 600000, increment: 0 };
    }

    // Parse response
    if (data) {
      try {
        // Handle both string and object responses
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        return {
          initialTime: parsed.initial_time || 600000,
          increment: parsed.increment || 0,
        };
      } catch (e) {
        console.error("Error parsing time control:", e);
      }
    }

    // Fallback
    return { initialTime: 600000, increment: 0 };
  } catch (err) {
    console.error("Exception fetching time control:", err);
    return { initialTime: 600000, increment: 0 };
  }
}

/**
 * Gets just the initial time value
 */
export async function getDefaultInitialTime(): Promise<number> {
  const timeControl = await getDefaultTimeControl();
  return timeControl.initialTime;
}

/**
 * Gets just the increment value
 */
export async function getDefaultIncrement(): Promise<number> {
  const timeControl = await getDefaultTimeControl();
  return timeControl.increment;
}
