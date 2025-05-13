import { supabase, invokeWithAuth } from "../utils/supabase";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { SecureGameService } from "./secureGameService";
import type { Game } from "@/types/game";

export class SecureMatchmakingService {
  private static realtimeSubscription: RealtimeChannel | null = null;

  /**
   * Joins the matchmaking queue and sets up listeners for match notifications
   * @returns A promise that resolves with the channel used for matchmaking
   */
  static async joinQueue(session: Session): Promise<RealtimeChannel> {
    try {
      const userId = session.user.id;
      console.log(`[Matchmaking] User ${userId} attempting to join queue`);

      // Check if user might already be in queue and clean up if needed
      await this.cleanupStaleQueueEntries(userId);

      // 1. First add the player to the database queue, which triggers matchmaking
      console.log(`[Matchmaking] Adding user ${userId} to database queue`);
      const { data, error } = await invokeWithAuth("matchmaking", {
        body: { operation: "joinQueue" },
      });

      if (error) {
        // Special case for when a user is already in queue (code 23505 in the backend)
        if (
          error.message?.includes("already in queue") ||
          error.message?.includes("violates unique constraint")
        ) {
          console.log(
            `[Matchmaking] User ${userId} is already in queue, proceeding with listener setup`,
          );
          // Just continue to set up the listeners
        } else {
          console.error(
            `[Matchmaking] Error joining queue: ${error.message}`,
            error,
          );
          throw error;
        }
      } else {
        console.log(
          `[Matchmaking] Successfully added user ${userId} to queue: `,
          data,
        );
      }

      // 2. Set up a realtime subscription to listen for match notifications and queue updates
      console.log(
        `[Matchmaking] Setting up realtime channel for user ${userId}`,
      );
      const channel = supabase.channel("matchmaking", {
        config: {
          broadcast: { self: true },
          presence: { key: userId },
        },
      });

      // 3. Set up listeners for status changes in the queue table
      console.log(
        `[Matchmaking] Setting up subscription listeners for user ${userId}`,
      );
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
            console.log(
              `[Matchmaking] Queue notification received (as white player):`,
              payload,
            );
            if (payload.new && payload.new.type === "match_found") {
              const gameId = payload.new.game_id;
              if (gameId) {
                console.log(
                  `[Matchmaking] Match found notification received for game: ${gameId} (as white)`,
                );
                channel.send({
                  type: "broadcast",
                  event: "game-matched",
                  payload: { gameId },
                });
              }
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
            console.log(
              `[Matchmaking] Queue notification received (as black player):`,
              payload,
            );
            if (payload.new && payload.new.type === "match_found") {
              const gameId = payload.new.game_id;
              if (gameId) {
                console.log(
                  `[Matchmaking] Match found notification received for game: ${gameId} (as black)`,
                );
                channel.send({
                  type: "broadcast",
                  event: "game-matched",
                  payload: { gameId },
                });
              }
            }
          },
        );

      // Listen for new games where the user is either white or black
      console.log(
        `[Matchmaking] Setting up game table listeners for user ${userId}`,
      );
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "games",
            filter: `white_player_id=eq.${userId}`,
          },
          (payload) => {
            console.log(
              `[Matchmaking] Game table event received (as white):`,
              payload,
            );
            if (payload.new) {
              console.log(
                `[Matchmaking] New game detected (as white): ${payload.new.id}, game:`,
                payload.new,
              );
              const gameId = payload.new.id;

              // Broadcast the match to the client
              console.log(
                `[Matchmaking] Broadcasting match found for game ${gameId} (as white)`,
              );
              channel.send({
                type: "broadcast",
                event: "game-matched",
                payload: { gameId },
              });
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "games",
            filter: `black_player_id=eq.${userId}`,
          },
          (payload) => {
            console.log(
              `[Matchmaking] Game table event received (as black):`,
              payload,
            );
            if (payload.new) {
              console.log(
                `[Matchmaking] New game detected (as black): ${payload.new.id}, game:`,
                payload.new,
              );
              const gameId = payload.new.id;

              // Broadcast the match to the client
              console.log(
                `[Matchmaking] Broadcasting match found for game ${gameId} (as black)`,
              );
              channel.send({
                type: "broadcast",
                event: "game-matched",
                payload: { gameId },
              });
            }
          },
        );

      // Optional backup - Try to listen for queue updates if available
      // This is commented out because queue table subscriptions are causing errors
      // We'll use the notifications and games tables instead which are more reliable

      try {
        channel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "queue",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new && payload.new.status === "matched") {
              this.handlePlayerMatched(userId);
            }
          },
        );
      } catch (error) {
        console.log(
          "[Matchmaking] Queue table not available for subscription, using fallback methods",
        );
        // The table might not be enabled for Realtime - that's ok, we have other listeners
      }

      // 4. Subscribe to the channel
      console.log(`[Matchmaking] Subscribing to channel for user ${userId}`);
      await new Promise<void>((resolve, reject) => {
        channel.subscribe((status) => {
          console.log(`[Matchmaking] Channel subscription status: ${status}`);
          if (status === "SUBSCRIBED") {
            console.log(
              `[Matchmaking] Successfully subscribed to channel for user ${userId}`,
            );
            resolve();
          } else if (status === "CHANNEL_ERROR") {
            console.error(
              `[Matchmaking] Failed to subscribe to channel: ${status}`,
            );
            reject(new Error(`Failed to subscribe to channel: ${status}`));
          }
        });
      });

      // 5. Store presence information
      await channel.track({
        user_id: userId,
        joined_at: new Date().toISOString(),
      });

      this.realtimeSubscription = channel;
      return channel;
    } catch (err) {
      console.error("[Matchmaking] Fatal error joining queue:", err);
      throw err;
    }
  }

  /**
   * Cleans up any stale queue entries for a user
   * This helps prevent the unique constraint violation
   */
  private static async cleanupStaleQueueEntries(userId: string): Promise<void> {
    try {
      console.log(
        `[Matchmaking] Checking for existing queue entries for user ${userId}`,
      );

      // Check if user has any existing queue entries
      const { data: existingEntries, error } = await supabase
        .from("queue")
        .select("id, status, joined_at")
        .eq("user_id", userId);

      if (error) {
        console.error(
          `[Matchmaking] Error checking queue entries: ${error.message}`,
          error,
        );
        return;
      }

      if (existingEntries && existingEntries.length > 0) {
        console.log(
          `[Matchmaking] Found ${existingEntries.length} existing queue entries for user ${userId}:`,
          existingEntries,
        );

        // Check for stale entries (over 30 minutes old)
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

        const staleEntries = existingEntries.filter((entry) => {
          const joinedAt = new Date(entry.joined_at);
          return joinedAt < thirtyMinutesAgo;
        });

        // Delete stale entries directly
        if (staleEntries.length > 0) {
          console.log(
            `[Matchmaking] Found ${staleEntries.length} stale entries to clean up`,
          );
          const staleIds = staleEntries.map((entry) => entry.id);

          const { error: deleteError } = await supabase
            .from("queue")
            .delete()
            .in("id", staleIds);

          if (deleteError) {
            console.error(
              `[Matchmaking] Error deleting stale entries: ${deleteError.message}`,
            );
          } else {
            console.log(
              `[Matchmaking] Successfully cleaned up ${staleEntries.length} stale queue entries`,
            );
          }
        } else {
          console.log(
            `[Matchmaking] No stale entries found for user ${userId}`,
          );
        }

        // For active entries, log their current status
        const activeEntries = existingEntries.filter(
          (entry) => !staleEntries.includes(entry),
        );
        if (activeEntries.length > 0) {
          console.log(
            `[Matchmaking] User ${userId} has ${activeEntries.length} active queue entries:`,
            activeEntries,
          );
        }
      } else {
        console.log(
          `[Matchmaking] No existing queue entries found for user ${userId}`,
        );
      }
    } catch (error) {
      console.error(
        `[Matchmaking] Error cleaning up stale queue entries for user ${userId}:`,
        error,
      );
      // Continue anyway, as this is just a cleanup operation
    }
  }

  /**
   * Handles logic when a player is matched
   */
  private static async handlePlayerMatched(userId: string): Promise<void> {
    try {
      console.log(
        `[Matchmaking] Player ${userId} was matched, looking for the game`,
      );

      // Query for the newly created game
      const { data: games, error } = await supabase
        .from("games")
        .select("*")
        .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error(
          `[Matchmaking] Error fetching matched game: ${error.message}`,
          error,
        );
        return;
      }

      if (games && games.length > 0) {
        const gameId = games[0].id;
        console.log(
          `[Matchmaking] Found game ${gameId} for matched player ${userId}, game details:`,
          games[0],
        );

        // If we have an active subscription channel, broadcast the match
        if (this.realtimeSubscription) {
          console.log(
            `[Matchmaking] Broadcasting match found for game ${gameId} via shared channel`,
          );
          this.realtimeSubscription.send({
            type: "broadcast",
            event: "game-matched",
            payload: { gameId },
          });
        } else {
          console.log(
            `[Matchmaking] No active Realtime subscription to broadcast match`,
          );
        }
      } else {
        console.log(
          `[Matchmaking] No games found for matched player ${userId}`,
        );
      }
    } catch (error) {
      console.error(
        `[Matchmaking] Error in handlePlayerMatched for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Leaves the matchmaking queue
   */
  static async leaveQueue(
    session: Session,
    channel: RealtimeChannel,
  ): Promise<void> {
    try {
      const userId = session.user.id;
      console.log(`[Matchmaking] User ${userId} attempting to leave queue`);

      // 1. Remove presence tracking
      console.log(
        `[Matchmaking] Removing user ${userId} from presence tracking`,
      );
      await channel.untrack({ user_id: userId });

      // 2. Notify the server via edge function
      console.log(
        `[Matchmaking] Notifying server that user ${userId} is leaving queue`,
      );
      const { data, error } = await invokeWithAuth("matchmaking", {
        body: { operation: "leaveQueue" },
      });

      if (error) {
        console.error(
          `[Matchmaking] Error leaving queue: ${error.message}`,
          error,
        );
      } else {
        console.log(
          `[Matchmaking] Successfully notified server of queue departure:`,
          data,
        );
      }

      // 3. Unsubscribe from the channel
      console.log(`[Matchmaking] Unsubscribing user ${userId} from channel`);
      await channel.unsubscribe();
      console.log(`[Matchmaking] Successfully unsubscribed from channel`);

      if (this.realtimeSubscription === channel) {
        console.log(
          `[Matchmaking] Clearing shared Realtime subscription reference`,
        );
        this.realtimeSubscription = null;
      }

      console.log(
        `[Matchmaking] User ${userId} has successfully left the queue`,
      );
    } catch (err) {
      console.error(`[Matchmaking] Error leaving queue for user:`, err);
    }
  }

  /**
   * Sets up a listener for match notifications
   */
  static setupMatchListener(
    channel: RealtimeChannel,
    callback: (gameId: string) => void,
  ): void {
    channel.on("broadcast", { event: "game-matched" }, (payload) => {
      console.log(`[Matchmaking] Match found:`, payload);
      callback(payload.payload.gameId);
    });
  }

  /**
   * Gets the current position in the queue
   */
  static async getQueuePosition(userId: string): Promise<number> {
    // Query the database directly for accurate queue position
    const { data, error } = await supabase
      .from("queue")
      .select("id, joined_at")
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("[Matchmaking] Error getting queue position:", error);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    // Find the user's position in the queue
    const userIndex = data.findIndex((entry: any) => entry.user_id === userId);
    return userIndex >= 0 ? userIndex + 1 : 0;
  }

  /**
   * Creates a match directly (admin or testing functionality)
   */
  static async createMatch(player2Id: string): Promise<Game> {
    try {
      if (!player2Id) {
        throw new Error("Player 2 ID is required to create a match");
      }

      const { data, error } = await invokeWithAuth("matchmaking", {
        body: {
          operation: "createMatch",
          player2Id,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.data) {
        throw new Error("Invalid response from server when creating match");
      }

      return SecureGameService.mapGameFromDB(data.data);
    } catch (err) {
      console.error("[Matchmaking] Error creating match:", err);
      throw err;
    }
  }

  static async createMatchServerSide(
    player1Id: string,
    player2Id: string,
  ): Promise<Game> {
    try {
      if (!player1Id || !player2Id) {
        throw new Error("Both player IDs are required to create a match");
      }

      // For server-side usage with service role key
      const { data, error } = await supabase.functions.invoke("matchmaking", {
        body: {
          operation: "createMatch",
          player1Id,
          player2Id,
        },
      });

      if (error) {
        console.error(
          `[SecureMatchmakingService] Error creating match (server-side): ${error.message}`,
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
        "[SecureMatchmakingService] Fatal error creating match (server-side):",
        err,
      );
      throw err;
    }
  }
}
