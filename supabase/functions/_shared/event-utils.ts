/// <reference lib="deno.ns" />
import type {
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";
import { dbQuery } from "./db-utils.ts";

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
  supabase: SupabaseClient,
  type: EventType,
  data: Record<string, any>,
  userId?: string,
  metadata: Record<string, any> = {},
): Promise<void> {
  try {
    logger.debug(`Recording event: ${type}`, { userId, ...data });

    const eventData = {
      type,
      user_id: userId || null,
      data,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };

    // await dbQuery(supabase, "events", "insert", {
    //   data: eventData,
    //   operation: `record ${type} event`,
    // });
  } catch (error) {
    // Just log the error but don't fail the operation
    logger.error(`Failed to record event ${type}:`, error);
  }
}

/**
 * Sends a notification to a user
 */
export async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  message: string,
  data: Record<string, any> = {},
): Promise<boolean> {
  try {
    logger.debug(`Sending notification to user ${userId}: ${title}`);

    const notificationData = {
      user_id: userId,
      title,
      message,
      data,
      read: false,
      created_at: new Date().toISOString(),
    };

    await dbQuery(supabase, "notifications", "insert", {
      data: notificationData,
      operation: "send notification",
    });

    return true;
  } catch (error) {
    logger.error(`Failed to notify user ${userId}:`, error);
    return false;
  }
}

/**
 * Create a standard activity log entry
 */
export async function logActivity(
  supabase: SupabaseClient,
  user: User,
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, any> = {},
): Promise<void> {
  try {
    const activityData = {
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      timestamp: new Date().toISOString(),
    };

    await dbQuery(supabase, "activity_logs", "insert", {
      data: activityData,
      operation: `log ${action}`,
    });
  } catch (error) {
    logger.error(`Failed to log activity for user ${user.id}:`, error);
  }
}
