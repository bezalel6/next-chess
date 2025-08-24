import { invokeWithAuth } from "../utils/supabase";
import type { Session } from "@supabase/supabase-js";

export class MatchmakingService {
  /**
   * Join matchmaking queue
   */
  static async joinQueue(session: Session): Promise<void> {
    const userId = session.user.id;
    console.log(`[Matchmaking] User ${userId} joining queue`);

    // Join queue via Edge function
    const { data, error } = await invokeWithAuth("matchmaking", {
      body: { operation: "joinQueue" },
    });

    if (error) {
      console.error(`[Matchmaking] Error joining queue: ${error.message}`);
      throw error;
    }

    // Game matching is now handled by the server-side notifications and ConnectionContext
    if (data?.matchFound && data?.game) {
      console.log(`[Matchmaking] Already matched with game: ${data.game.id}`);
    }
  }

  /**
   * Leave matchmaking queue
   */
  static async leaveQueue(session: Session): Promise<boolean> {
    if (!session) {
      console.error("[Matchmaking] Cannot leave queue: No session");
      return false;
    }

    console.log(`[Matchmaking] User ${session.user.id} leaving queue`);

    // Leave queue via Edge function
    const { error } = await invokeWithAuth("matchmaking", {
      body: { operation: "leaveQueue" },
    });

    if (error) {
      console.error(`[Matchmaking] Error leaving queue: ${error.message}`);
      throw error;
    }

    return true;
  }

  /**
   * Check matchmaking status
   */
  static async checkStatus(session: Session): Promise<Record<string, unknown>> {
    if (!session) {
      return { inQueue: false };
    }

    console.log(`[Matchmaking] Checking status for user ${session.user.id}`);

    const { data, error } = await invokeWithAuth("matchmaking", {
      body: { operation: "checkStatus" },
    });

    if (error) {
      console.error(
        `[Matchmaking] Error checking status: ${error.message}`,
        error,
      );
      throw error;
    }

    return data || { inQueue: false };
  }
}
