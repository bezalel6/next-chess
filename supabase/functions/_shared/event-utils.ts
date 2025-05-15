/// <reference lib="deno.ns" />
import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { getTable, logOperation } from "./db-utils.ts";
import type { TypedSupabaseClient } from "./db-utils.ts";
import type { Json } from "./database-types.ts";

const logger = createLogger("EVENTS");

/**
 * Event types for the system
 */
export enum EventType {
  GAME_CREATED = "game_created",
  GAME_UPDATED = "game_updated",
  GAME_ENDED = "game_ended",
  MOVE_MADE = "move_made",
  MATCH_FOUND = "match_found",
  QUEUE_JOINED = "queue_joined",
  OFFER_MADE = "offer_made",
  OFFER_ACCEPTED = "offer_accepted",
  OFFER_DECLINED = "offer_declined",
}

/**
 * Records a system event with standardized format
 */
export async function recordEvent(
  supabase: TypedSupabaseClient,
  type: EventType,
  data: Record<string, any>,
  userId?: string,
  metadata: Record<string, any> = {},
): Promise<void> {
  try {
    logger.debug(`Recording event: ${type}`, { userId, ...data });

    const { error } = await getTable(supabase, "event_log").insert({
      event_type: type,
      entity_type: data.game_id ? "game" : "system",
      entity_id: data.game_id || crypto.randomUUID(),
      user_id: userId || null,
      data: {
        ...data,
        metadata: { ...metadata, timestamp: new Date().toISOString() },
      } as Json,
    });

    logOperation(`record ${type} event`, error);
  } catch (error) {
    // Just log the error but don't fail the operation
    logger.error(`Failed to record event ${type}:`, error);
  }
}
