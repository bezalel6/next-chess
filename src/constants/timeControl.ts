/**
 * Time control utilities
 *
 * IMPORTANT: This file no longer defines the time control values.
 * The single source of truth is now the settings table in the database.
 * This file only provides utilities to fetch those values.
 */

import { supabase } from "@/utils/supabase";

// Time control interface (matches what database returns)
export interface TimeControl {
  initialTime: number; // milliseconds
  increment: number; // milliseconds
}

/**
 * Fetches the default time control values from the database settings
 */
export async function getDefaultTimeControl(): Promise<TimeControl> {
  try {
    // Query settings table directly - more efficient than using RPC
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "default_time_control")
      .single();

    if (error) {
      console.error("Error fetching time control from settings:", error);
      // Fallback if settings table access fails
      return { initialTime: 600000, increment: 0 };
    }

    if (data?.value) {
      try {
        // Parse response
        const parsed =
          typeof data.value === "string" ? JSON.parse(data.value) : data.value;
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
