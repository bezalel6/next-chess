import { supabase } from "@/utils/supabase";
import type { Database } from "@/types/database";

type FollowRow = Database["public"]["Tables"]["follows"]["Row"];

export interface FollowedUser {
  following_id: string;
  username: string;
  followed_at: string;
  active_game?: {
    game_id: string;
    status: string;
    white_player_id: string;
    black_player_id: string;
    created_at: string;
    current_position: string;
  };
}

export class FollowService {
  /**
   * Follow a user
   */
  static async followUser(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("follows")
        .insert({
          follower_id: user.id,
          following_id: userId,
        });

      if (error) {
        if (error.code === "23505") {
          // Unique constraint violation - already following
          console.log("Already following this user");
          return false;
        }
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Error following user:", error);
      throw error;
    }
  }

  /**
   * Unfollow a user
   */
  static async unfollowUser(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error unfollowing user:", error);
      throw error;
    }
  }

  /**
   * Check if current user follows another user
   */
  static async isFollowing(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .rpc("is_following", {
          follower: user.id,
          following: userId,
        });

      if (error) throw error;

      return data || false;
    } catch (error) {
      console.error("Error checking follow status:", error);
      return false;
    }
  }

  /**
   * Get list of users that current user follows
   */
  static async getFollowing(): Promise<FollowedUser[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("followed_users_status")
        .select("*")
        .eq("follower_id", user.id)
        .order("followed_at", { ascending: false });

      if (error) throw error;

      return (data as unknown as FollowedUser[]) || [];
    } catch (error) {
      console.error("Error fetching following list:", error);
      throw error;
    }
  }

  /**
   * Get list of users that follow the current user
   */
  static async getFollowers(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("follows")
        .select(`
          follower_id,
          created_at,
          profiles!follows_follower_id_fkey (
            username
          )
        `)
        .eq("following_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error("Error fetching followers:", error);
      throw error;
    }
  }

  /**
   * Get follow statistics for a user
   */
  static async getFollowStats(userId: string): Promise<{ followers_count: number; following_count: number }> {
    try {
      const { data, error } = await supabase
        .rpc("get_follow_stats", { user_id: userId });

      if (error) throw error;

      return (data as { followers_count: number; following_count: number }) || { followers_count: 0, following_count: 0 };
    } catch (error) {
      console.error("Error fetching follow stats:", error);
      return { followers_count: 0, following_count: 0 };
    }
  }

  /**
   * Subscribe to real-time updates for followed users' games
   */
  static subscribeToFollowedUsersGames(
    onGameUpdate: (payload: any) => void
  ) {
    return supabase
      .channel("followed-users-games")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `status=eq.active`,
        },
        async (payload) => {
          // Check if this game involves a followed user
          const following = await this.getFollowing();
          const followedUserIds = following.map(f => f.following_id);
          
          const newGame = payload.new as any;
          if (
            newGame &&
            (followedUserIds.includes(newGame.white_player_id) ||
             followedUserIds.includes(newGame.black_player_id))
          ) {
            onGameUpdate(payload);
          }
        }
      )
      .subscribe();
  }
}