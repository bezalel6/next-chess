/// <reference lib="deno.ns" />
import { createLogger } from "./logger.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";
import type { Json } from "./database-types.ts";

const logger = createLogger("TIME_CONTROL");

export interface TimeControl {
  initialTime: number; // milliseconds
  increment: number; // milliseconds
}
export function toJson<T>(input: T): Json {
  return input as unknown as Json;
}

/**
 * Gets default time control settings from the settings table
 *
 * This is the centralized function for all edge functions to use
 */
export async function getDefaultTimeControl(
  supabase: TypedSupabaseClient,
): Promise<TimeControl> {
  try {
    // Query settings table directly - this is more efficient than using RPC
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "default_time_control")
      .single();

    if (error) {
      logger.error("Error fetching time control from settings:", error);
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
        logger.error("Error parsing time control:", e);
      }
    }

    // Fallback
    return { initialTime: 600000, increment: 0 };
  } catch (err) {
    logger.error("Exception fetching time control:", err);
    return { initialTime: 600000, increment: 0 };
  }
}

/**
 * Gets just the initial time value
 */
export async function getDefaultInitialTime(
  supabase: TypedSupabaseClient,
): Promise<number> {
  const timeControl = await getDefaultTimeControl(supabase);
  return timeControl.initialTime;
}

/**
 * Gets just the increment value
 */
export async function getDefaultIncrement(
  supabase: TypedSupabaseClient,
): Promise<number> {
  const timeControl = await getDefaultTimeControl(supabase);
  return timeControl.increment;
}
