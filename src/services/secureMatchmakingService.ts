import { supabase, invokeWithAuth } from "../utils/supabase";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { SecureGameService } from "./secureGameService";
import type { Game } from "@/types/game";

export class SecureMatchmakingService {
  /**
   * Simplified matchmaking service - joins queue and sets up notification channel
   */
  static async joinQueue(session: Session): Promise<RealtimeChannel> {
    const userId = session.user.id;
    console.log(`[Matchmaking] User ${userId} joining queue`);

    // 1. Join the matchmaking queue via Edge function
    const { data, error } = await invokeWithAuth("matchmaking", {
      body: { operation: "joinQueue" },
    });

    if (error) {
      console.error(`[Matchmaking] Error joining queue: ${error.message}`);

      // Special case - if already in a game, this is not a critical error
      if (error.status === 400 && error.message?.includes("active game")) {
        console.log(`[Matchmaking] User already has active game`);
      } else {
        throw error;
      }
    }

    // 2. Set up realtime channel for game notifications
    const channel = this.setupNotificationChannel(userId);

    // 3. If already matched, handle the game immediately
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
   * Set up realtime notification channel for matchmaking updates
   */
  private static setupNotificationChannel(userId: string): RealtimeChannel {
    const channel = supabase.channel(`matchmaking:${userId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });

    // Listen for match notifications directly
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "queue_notifications",
          filter: `white_player_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new?.type === "match_found" && payload.new?.game_id) {
            channel.send({
              type: "broadcast",
              event: "game-matched",
              payload: { gameId: payload.new.game_id },
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "queue_notifications",
          filter: `black_player_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new?.type === "match_found" && payload.new?.game_id) {
            channel.send({
              type: "broadcast",
              event: "game-matched",
              payload: { gameId: payload.new.game_id },
            });
          }
        },
      );

    // Start the channel
    channel.subscribe((status) => {
      console.log(`[Matchmaking] Channel status: ${status}`);
    });

    return channel;
  }

  /**
   * Leave the matchmaking queue
   */
  static async leaveQueue(): Promise<void> {
    await invokeWithAuth("matchmaking", {
      body: { operation: "leaveQueue" },
    });
  }

  /**
   * Poll for matchmaking status
   */
  static async checkMatchStatus(): Promise<any> {
    const { data, error } = await invokeWithAuth("matchmaking", {
      body: { operation: "checkStatus" },
    });

    if (error) {
      console.error(`[Matchmaking] Error checking status: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Set up listener for game matches
   */
  static setupMatchListener(
    channel: RealtimeChannel,
    callback: (gameId: string) => void,
  ): void {
    channel.on("broadcast", { event: "game-matched" }, (payload) => {
      if (payload.payload?.gameId) {
        callback(payload.payload.gameId);
      }
    });
  }
}
