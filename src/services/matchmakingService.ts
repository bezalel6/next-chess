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

    // Also setup player-specific channel for direct notifications
    this.setupPlayerChannel(userId);

    // Handle immediate match if exists
    if (data?.matchFound && data?.game) {
      console.log(`[Matchmaking] Already matched with game: ${data.game.id}`);
      setTimeout(() => {
        channel.send({
          type: "broadcast",
          event: "game-matched",
          payload: {
            gameId: data.game.id,
            isWhite: data.game.white_player_id === userId,
          },
        });
      }, 500);
    }

    return channel;
  }

  /**
   * Leave matchmaking queue
   */
  static async leaveQueue(
    session: Session,
    channel?: RealtimeChannel,
  ): Promise<boolean> {
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

    // Unsubscribe from the channel if provided
    if (channel) {
      await channel.unsubscribe();
      console.log(`[Matchmaking] Unsubscribed from queue channel`);
    }

    return true;
  }

  /**
   * Setup match listener with navigation
   */
  static setupMatchListener(
    channel: RealtimeChannel,
    router: NextRouter,
    callback?: (gameId: string, isWhite?: boolean) => void,
  ): void {
    // Listen for the legacy game-matched event
    channel.on("broadcast", { event: "game-matched" }, (payload) => {
      if (payload.payload?.gameId) {
        const gameId = payload.payload.gameId;
        const isWhite = payload.payload.isWhite;
        console.log(
          `[Matchmaking] Match found! Game ID: ${gameId}, Playing as white: ${isWhite}`,
        );

        // Navigate to game and execute callback if provided
        if (callback) {
          callback(gameId, isWhite);
        }
        router.push(`/game/${gameId}`);
      }
    });

    // Also listen for the new game_matched event format
    channel.on("broadcast", { event: "game_matched" }, (payload) => {
      if (payload.payload?.gameId) {
        const gameId = payload.payload.gameId;
        const isWhite = payload.payload.isWhite;
        console.log(
          `[Matchmaking] Match found! Game ID: ${gameId}, Playing as white: ${isWhite}`,
        );

        // Navigate to game and execute callback if provided
        if (callback) {
          callback(gameId, isWhite);
        }
        router.push(`/game/${gameId}`);
      }
    });
  }

  /**
   * Check matchmaking status
   */
  static async checkStatus(session: Session): Promise<any> {
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

  /**
   * Setup a player-specific channel to receive direct notifications
   */
  static setupPlayerChannel(userId: string): RealtimeChannel {
    const playerChannel = supabase.channel(`player:${userId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    // Listen for direct player notifications
    playerChannel.on("broadcast", { event: "game_matched" }, (payload) => {
      if (payload.payload?.gameId) {
        const gameId = payload.payload.gameId;
        const isWhite = payload.payload.isWhite;
        const opponentId = payload.payload.opponentId;

        console.log(
          `[Matchmaking] Direct match notification! Game ID: ${gameId}, Playing as white: ${isWhite}, Opponent: ${opponentId}`,
        );

        // Dispatch a custom event for the ConnectionContext to handle
        window.dispatchEvent(
          new CustomEvent("game_matched", {
            detail: { gameId, isWhite, opponentId },
          }),
        );
      }
    });

    playerChannel.subscribe((status) => {
      console.log(`[Matchmaking] Player channel status: ${status}`);
    });

    return playerChannel;
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
