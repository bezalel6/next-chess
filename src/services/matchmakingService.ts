import { supabase, invokeWithAuth } from "../utils/supabase";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import type { NextRouter } from "next/router";

export class MatchmakingService {
  /**
   * Join matchmaking queue and setup notification channel
   */
  static async joinQueue(
    session: Session,
    existingChannel?: RealtimeChannel,
  ): Promise<RealtimeChannel> {
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

    // Setup notification channel if not provided
    const channel = existingChannel || this.setupNotificationChannel(userId);

    // Handle immediate match if exists
    if (data?.matchFound && data?.game) {
      console.log(`[Matchmaking] Already matched with game: ${data.game.id}`);
      setTimeout(() => {
        channel.send({
          type: "broadcast",
          event: "game-matched",
          payload: { gameId: data.game.id },
        });
      }, 500);
    }

    return channel;
  }

  /**
   * Leave the matchmaking queue
   */
  static async leaveQueue(
    session: Session,
    channel?: RealtimeChannel,
  ): Promise<void> {
    console.log(`[Matchmaking] User ${session.user.id} leaving queue`);

    // Call edge function to leave queue
    const { error } = await invokeWithAuth("matchmaking", {
      body: { operation: "leaveQueue" },
    });

    if (error) {
      console.error(`[Matchmaking] Error leaving queue: ${error.message}`);
    }

    // Cleanup channel if provided
    if (channel) {
      try {
        await channel.untrack();
      } catch (untrackError) {
        console.warn(
          `[Matchmaking] Error untracking channel: ${untrackError.message}`,
        );
      }
    }
  }

  /**
   * Setup match listener with navigation
   */
  static setupMatchListener(
    channel: RealtimeChannel,
    router: NextRouter,
    callback?: (gameId: string, isWhite?: boolean) => void,
  ): void {
    channel.on("broadcast", { event: "game-matched" }, (payload) => {
      if (payload.payload?.gameId) {
        const gameId = payload.payload.gameId;
        console.log(`[Matchmaking] Match found! Game ID: ${gameId}`);

        // Navigate to game and execute callback if provided
        if (callback) {
          callback(gameId);
        }
        router.push(`/game/${gameId}`);
      }
    });
  }

  /**
   * Check for active matches for a user
   */
  static async checkActiveMatch(userId: string): Promise<string | null> {
    try {
      // Check for active games first
      const { data: activeGame } = await supabase
        .from("games")
        .select("id")
        .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeGame?.id) {
        return activeGame.id;
      }

      // Then check matchmaking for matched status
      const { data: matchmakingEntry } = await supabase
        .from("matchmaking")
        .select("game_id")
        .eq("player_id", userId)
        .eq("status", "matched")
        .maybeSingle();

      return matchmakingEntry?.game_id || null;
    } catch (error) {
      console.error(
        `[Matchmaking] Error checking active match: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Private helper to setup notification channel
   */
  private static setupNotificationChannel(userId: string): RealtimeChannel {
    const channel = supabase.channel(`matchmaking:${userId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });

    // Listen for matchmaking status changes
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matchmaking",
        filter: `player_id=eq.${userId}`,
      },
      (payload) => {
        const newStatus = payload.new?.status;
        const gameId = payload.new?.game_id;

        if (newStatus === "matched" && gameId) {
          console.log(`[Matchmaking] Player matched with game ${gameId}`);
          channel.send({
            type: "broadcast",
            event: "game-matched",
            payload: { gameId },
          });
        }
      },
    );

    channel.subscribe();
    return channel;
  }
}
