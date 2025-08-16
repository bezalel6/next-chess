import { supabase } from "../utils/supabase";
import type { Game } from "@/types/game";
import { GameService } from "./gameService";

interface UserProfileData {
  username: string;
  id: string;
}

export interface UserGameStats {
  userId: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  games: Array<{
    id: string;
    result: string;
    fen: string;
    date_updated: string;
    playerColor: "white" | "black";
    opponentId: string;
    opponentUsername: string;
  }>;
}

export class UserService {
  // In-memory cache to avoid redundant database requests
  private static usernameCache: Map<string, string> = new Map();
  
  /**
   * Update the current user's username
   */
  static async updateUsername(newUsername: string): Promise<{ username: string }> {
    try {
      const response = await supabase.functions.invoke('user-management', {
        body: {
          operation: 'updateProfile',
          username: newUsername
        }
      });

      console.log('Edge function response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update username');
      }

      // The edge function returns the response wrapped by Supabase
      // Response structure: { data: { success: true, data: { profile: {...} } } }
      if (!response.data) {
        console.error('Response data is missing:', response);
        throw new Error('Invalid response from server');
      }

      // Check if the edge function returned an error
      if (response.data.success === false) {
        throw new Error(response.data.error || 'Failed to update username');
      }

      // Extract the profile from the nested data structure
      const profile = response.data.data?.profile;
      
      if (!profile) {
        console.error('Profile data is missing in response:', response.data);
        throw new Error('Profile data not found in server response');
      }

      // Clear the cache for the updated user to ensure fresh data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        this.usernameCache.delete(user.id);
      }

      return profile;
    } catch (error) {
      console.error('Error updating username:', error);
      throw error;
    }
  }
  
  static async getUserProfile(username: string):Promise<UserGameStats> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user id by username:", error);
      throw error;
    }

    if (!data?.id) {
      throw new Error("User not found");
    }

    return await this.getUserGameStats(data.id);
  }
  /**
   * Get a username by user ID
   */
  static async getUsernameById(userId: string): Promise<string> {
    // Check cache first
    if (this.usernameCache.has(userId)) {
      return this.usernameCache.get(userId) as string;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching username:", error);
      return "Unknown Player";
    }

    const username = data?.username || "Unknown Player";

    // Cache the result
    this.usernameCache.set(userId, username);

    return username;
  }

  /**
   * Get multiple usernames by user IDs at once
   */
  static async getUsernamesByIds(
    userIds: string[],
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    // Filter out IDs that are already in cache
    const uncachedIds = userIds.filter((id) => !this.usernameCache.has(id));

    // Add cached usernames to result
    userIds.forEach((id) => {
      if (this.usernameCache.has(id)) {
        result[id] = this.usernameCache.get(id) as string;
      }
    });

    // If all IDs were cached, return the result
    if (uncachedIds.length === 0) {
      return result;
    }

    // Fetch the uncached usernames
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", uncachedIds);

    if (error) {
      console.error("Error fetching usernames:", error);
      // Return unknown for uncached usernames
      uncachedIds.forEach((id) => {
        result[id] = "Unknown Player";
      });
      return result;
    }

    // Process the fetched data
    (data as UserProfileData[]).forEach((profile) => {
      const username = profile.username || "Unknown Player";
      // Add to cache
      this.usernameCache.set(profile.id, username);
      // Add to result
      result[profile.id] = username;
    });

    // Add any IDs that weren't found in the database
    uncachedIds.forEach((id) => {
      if (!result[id]) {
        result[id] = "Unknown Player";
        this.usernameCache.set(id, "Unknown Player");
      }
    });

    return result;
  }

  /**
   * Get a user's game history (both active and completed games)
   */
  static async getUserGameHistory(userId: string): Promise<Game[]> {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching user game history:", error);
        throw error;
      }

      // Use the GameService's mapper to convert DB records to Game objects
      // Importing directly from the class to avoid circular dependencies
      return data.map((game) => GameService.mapGameFromDB(game));
    } catch (error) {
      console.error(`Error getting user game history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get aggregated game statistics for a user
   */
  static async getUserGameStats(userId: string): Promise<UserGameStats> {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
        .eq("status", "finished")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error fetching user game stats:", error);
        throw error;
      }

      const stats: UserGameStats = {
        userId: userId,
        totalGames: data.length,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        games: [],
      };

      // Process games to get all opponent IDs
      const opponentIds = data.map((game) =>
        game.white_player_id === userId
          ? game.black_player_id
          : game.white_player_id,
      );

      // Fetch all opponent usernames in a single request
      const opponentUsernames = await this.getUsernamesByIds(opponentIds);

      // Calculate stats
      data.forEach((game) => {
        // Determine player color
        const playerColor = game.white_player_id === userId ? "white" : "black";

        // Determine opponent ID
        const opponentId =
          playerColor === "white" ? game.black_player_id : game.white_player_id;

        if (game.result === "draw") {
          stats.draws++;
        } else if (
          (game.result === "white" && playerColor === "white") ||
          (game.result === "black" && playerColor === "black")
        ) {
          stats.wins++;
        } else {
          stats.losses++;
        }

        stats.games.push({
          id: game.id,
          result: game.result,
          fen: game.current_fen,
          date_updated: game.updated_at,
          playerColor,
          opponentId,
          opponentUsername: opponentUsernames[opponentId] || "Unknown Player",
        });
      });

      // Calculate win rate (avoid division by zero)
      if (stats.totalGames > 0) {
        stats.winRate = (stats.wins / stats.totalGames) * 100;
      }

      return stats;
    } catch (error) {
      console.error(`Error getting user game stats: ${error.message}`);
      throw error;
    }
  }
}
