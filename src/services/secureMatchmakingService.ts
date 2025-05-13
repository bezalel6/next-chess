import { supabase } from "../utils/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SecureGameService } from "./secureGameService";
import type { Game } from "@/types/game";

export class SecureMatchmakingService {
  static async joinQueue(userId: string, existingChannel?: RealtimeChannel) {
    try {
      // First, invoke the edge function to securely validate and process the request
      const { data, error } = await supabase.functions.invoke("matchmaking", {
        body: {
          operation: "joinQueue",
          userId: userId, // Explicitly include userId in request
        },
      });

      if (error) {
        console.error(
          `[SecureMatchmakingService] Error joining queue: ${error.message}`,
          error,
        );
        throw error;
      }

      // Use the existing channel if provided, otherwise create a new one
      if (existingChannel) {
        await existingChannel.track({
          user_id: userId,
          joined_at: new Date().toISOString(),
        });
        return existingChannel;
      } else {
        // Create a new channel if none was provided
        const channel = supabase.channel("queue-system", {
          config: {
            broadcast: { self: true },
            presence: { key: userId },
          },
        });

        // Subscribe to the channel before tracking presence
        await new Promise<void>((resolve, reject) => {
          channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              resolve();
            } else if (status === "CHANNEL_ERROR") {
              reject(new Error(`Failed to subscribe to channel: ${status}`));
            }
          });
        });

        // Now that we're subscribed, we can track presence
        await channel.track({
          user_id: userId,
          joined_at: new Date().toISOString(),
        });

        return channel;
      }
    } catch (err) {
      console.error(
        "[SecureMatchmakingService] Fatal error joining queue:",
        err,
      );
      throw err;
    }
  }

  static async leaveQueue(userId: string, channel: RealtimeChannel) {
    try {
      await channel.untrack({ user_id: userId });
      await channel.unsubscribe();

      // Optionally notify the server via edge function
      const { data, error } = await supabase.functions.invoke("matchmaking", {
        body: {
          operation: "leaveQueue",
          userId: userId, // Explicitly include userId in request
        },
      });

      if (error) {
        console.error(
          `[SecureMatchmakingService] Error leaving queue: ${error.message}`,
          error,
        );
        // We don't throw here since we already untracked and unsubscribed
      }
    } catch (err) {
      console.error("[SecureMatchmakingService] Error leaving queue:", err);
      // We don't rethrow since the channel operations might have succeeded partially
    }
  }

  static async createMatch(
    player1Id: string,
    player2Id: string,
  ): Promise<Game> {
    try {
      if (!player1Id || !player2Id) {
        throw new Error("Both player IDs are required to create a match");
      }

      const { data, error } = await supabase.functions.invoke("matchmaking", {
        body: {
          operation: "createMatch",
          player1Id,
          player2Id,
        },
      });

      if (error) {
        console.error(
          `[SecureMatchmakingService] Error creating match: ${error.message}`,
          error,
        );
        throw error;
      }

      if (!data?.data) {
        throw new Error("Invalid response from server when creating match");
      }

      return SecureGameService.mapGameFromDB(data.data);
    } catch (err) {
      console.error(
        "[SecureMatchmakingService] Fatal error creating match:",
        err,
      );
      throw err;
    }
  }

  static setupMatchListener(
    channel: RealtimeChannel,
    callback: (gameId: string) => void,
  ) {
    channel.on("broadcast", { event: "game-matched" }, (payload) => {
      console.log(`[SecureMatchmakingService] Match found:`, payload);
      callback(payload.payload.gameId);
    });
  }

  static async getQueuePosition(userId: string): Promise<number> {
    const { data: presenceState } = await supabase
      .channel("queue-system")
      .presenceState();

    if (!presenceState) return 0;

    const queue = Object.values(presenceState).flat() as unknown as Array<{
      user_id: string;
      joined_at: string;
    }>;

    queue.sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    );

    return queue.findIndex((user) => user.user_id === userId) + 1;
  }
}
