import { supabase, invokeWithAuth } from "../utils/supabase";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { SecureGameService } from "./secureGameService";
import type { Game } from "@/types/game";
import { useRouter } from "next/router";
import type { NextRouter } from "next/router";

export class SecureMatchmakingService {
  /**
   * Simplified matchmaking service - joins queue and sets up notification channel
   */
  static async joinQueue(
    session: Session,
    existingChannel?: RealtimeChannel,
  ): Promise<RealtimeChannel> {
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

    // 2. Set up realtime channel for game notifications (if not already provided)
    const channel = existingChannel || this.setupNotificationChannel(userId);

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
  static async leaveQueue(
    session: Session,
    channel?: RealtimeChannel,
  ): Promise<void> {
    console.log(`[Matchmaking] User ${session.user.id} leaving queue`);

    // Call the edge function to leave the queue
    const { error } = await invokeWithAuth("matchmaking", {
      body: { operation: "leaveQueue" },
    });

    if (error) {
      console.error(`[Matchmaking] Error leaving queue: ${error.message}`);
    }

    // If we have a channel, attempt to untrack the user
    if (channel) {
      try {
        await channel.untrack();
      } catch (untrackError) {
        console.warn(
          `[Matchmaking] Error untracking from channel: ${untrackError.message}`,
        );
      }
    }
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
   * Set up listener for game matches with navigation
   */
  static setupMatchListener(
    channel: RealtimeChannel,
    router: NextRouter,
    callback?: (gameId: string, isWhite?: boolean) => void,
  ): void {
    channel.on("broadcast", { event: "game-matched" }, (payload) => {
      if (payload.payload?.gameId) {
        const gameId = payload.payload.gameId;
        const whitePlayerId = payload.payload.whitePlayerId;
        const blackPlayerId = payload.payload.blackPlayerId;
        const currentUserId = supabase.auth
          .getSession()
          .then(({ data }) => data?.session?.user?.id);

        console.log(`[Matchmaking] Match found! Game ID: ${gameId}`);

        // Determine if current user is white
        currentUserId.then((userId) => {
          const isWhite = userId === whitePlayerId;

          // Execute optional callback if provided
          if (callback) {
            callback(gameId, isWhite);
          }

          // Navigate to the game page
          router.push(`/game/${gameId}`);
        });
      }
    });
  }

  /**
   * Utility method to directly join a specific game
   */
  static async joinGame(gameId: string, router: NextRouter): Promise<void> {
    console.log(`[Matchmaking] Directly joining game: ${gameId}`);

    try {
      // Verify the game exists and user is a participant
      const { data: game, error } = await supabase
        .from("games")
        .select("id, white_player_id, black_player_id, status")
        .eq("id", gameId)
        .single();

      if (error) {
        console.error(`[Matchmaking] Error fetching game: ${error.message}`);
        throw new Error(`Game not found: ${error.message}`);
      }

      if (game.status !== "active") {
        console.warn(
          `[Matchmaking] Joining non-active game: ${gameId} (status: ${game.status})`,
        );
      }

      // Navigate to the game
      router.push(`/game/${gameId}`);
    } catch (error) {
      console.error(`[Matchmaking] Error joining game: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a user has an active match in progress
   */
  static async checkActiveMatch(userId: string): Promise<string | null> {
    try {
      // First check the queue for a matched status
      const { data: queueEntry, error } = await supabase
        .from("queue")
        .select("status")
        .eq("user_id", userId)
        .eq("status", "matched")
        .maybeSingle();

      if (error) {
        console.error(
          `[Matchmaking] Error checking queue status: ${error.message}`,
        );
      }

      if (queueEntry) {
        // User is matched, check for game
        const { data: notification } = await supabase
          .from("queue_notifications")
          .select("game_id")
          .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
          .eq("type", "match_found")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (notification?.game_id) {
          return notification.game_id;
        }
      }

      // Next check for active games
      const { data: activeGame } = await supabase
        .from("games")
        .select("id")
        .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return activeGame?.id || null;
    } catch (error) {
      console.error(
        `[Matchmaking] Error checking active match: ${error.message}`,
      );
      return null;
    }
  }
}
