import { supabase } from '../utils/supabase';

interface UserProfileData {
  username: string;
  id: string;
}

export class UserService {
  // In-memory cache to avoid redundant database requests
  private static usernameCache: Map<string, string> = new Map();

  /**
   * Get a username by user ID
   */
  static async getUsernameById(userId: string): Promise<string> {
    // Check cache first
    if (this.usernameCache.has(userId)) {
      return this.usernameCache.get(userId) as string;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching username:', error);
      return 'Unknown Player';
    }

    const username = data?.username || 'Unknown Player';
    
    // Cache the result
    this.usernameCache.set(userId, username);
    
    return username;
  }

  /**
   * Get multiple usernames by user IDs at once
   */
  static async getUsernamesByIds(userIds: string[]): Promise<Record<string, string>> {
    // Filter out IDs that are already in cache
    const uncachedIds = userIds.filter(id => !this.usernameCache.has(id));
    
    const result: Record<string, string> = {};
    
    // Add cached usernames to result
    userIds.forEach(id => {
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
      .from('profiles')
      .select('id, username')
      .in('id', uncachedIds);
      
    if (error) {
      console.error('Error fetching usernames:', error);
      // Return unknown for uncached usernames
      uncachedIds.forEach(id => {
        result[id] = 'Unknown Player';
      });
      return result;
    }
    
    // Process the fetched data
    (data as UserProfileData[]).forEach(profile => {
      const username = profile.username || 'Unknown Player';
      // Add to cache
      this.usernameCache.set(profile.id, username);
      // Add to result
      result[profile.id] = username;
    });
    
    // Add any IDs that weren't found in the database
    uncachedIds.forEach(id => {
      if (!result[id]) {
        result[id] = 'Unknown Player';
        this.usernameCache.set(id, 'Unknown Player');
      }
    });
    
    return result;
  }
} 