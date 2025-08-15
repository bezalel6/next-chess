// abandonmentDetector.ts
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

interface AbandonmentResult {
  game_id: string;
  abandoned_by: 'white' | 'black' | null;
  minutes_inactive: number;
  action_taken: string;
}

interface AbandonmentStats {
  total_active_games: number;
  games_with_warnings: number;
  games_abandoned: number;
  avg_minutes_to_abandonment: number;
  abandonments_last_hour: number;
  abandonments_by_color: {
    white: number;
    black: number;
  };
}

export class AbandonmentDetector {
  private supabase: SupabaseClient;
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastCheckTime: Date | null = null;
  private checkCount: number = 0;

  constructor(supabaseUrl?: string, serviceRoleKey?: string) {
    // Initialize with service role for full database access
    this.supabase = createClient(
      supabaseUrl || env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey || env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  /**
   * Start the abandonment detection service
   * @param intervalSeconds How often to check for abandonments (default: 30 seconds)
   */
  start(intervalSeconds: number = 30): void {
    if (this.isRunning) {
      console.log("[AbandonmentDetector] Already running");
      return;
    }

    console.log(`[AbandonmentDetector] Starting with ${intervalSeconds}s interval`);
    this.isRunning = true;

    // Run initial check
    this.checkForAbandonments();

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkForAbandonments();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop the abandonment detection service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log("[AbandonmentDetector] Stopping...");
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform a single abandonment check
   */
  async checkForAbandonments(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    this.checkCount++;

    try {
      // Call the batch check function
      const { data, error } = await this.supabase
        .rpc('batch_check_abandonments')
        .returns<AbandonmentResult[]>();

      if (error) {
        console.error("[AbandonmentDetector] Error checking abandonments:", error);
        return;
      }

      const checkDuration = Date.now() - startTime;
      this.lastCheckTime = new Date();

      // Process results
      if (data && data.length > 0) {
        console.log(`[AbandonmentDetector] Check #${this.checkCount} completed in ${checkDuration}ms`);
        console.log(`[AbandonmentDetector] Actions taken:`, data.length);

        // Log each action
        for (const result of data) {
          this.logAction(result);
        }

        // Broadcast important events
        await this.broadcastEvents(data);
      } else if (this.checkCount % 10 === 0) {
        // Log every 10th check even if no actions taken (for monitoring)
        console.log(`[AbandonmentDetector] Check #${this.checkCount}: No actions needed (${checkDuration}ms)`);
      }

      // Get stats every 5 minutes
      if (this.checkCount % 10 === 0) {
        await this.logStats();
      }
    } catch (error) {
      console.error("[AbandonmentDetector] Unexpected error:", error);
    }
  }

  /**
   * Log an abandonment action
   */
  private logAction(result: AbandonmentResult): void {
    const emoji = this.getActionEmoji(result.action_taken);
    console.log(
      `[AbandonmentDetector] ${emoji} Game ${result.game_id.slice(0, 8)}: ` +
      `${result.action_taken} (${result.abandoned_by || 'N/A'} inactive for ${Math.round(result.minutes_inactive)}m)`
    );
  }

  /**
   * Get emoji for action type
   */
  private getActionEmoji(action: string): string {
    switch (action) {
      case 'forfeited': return '🏁';
      case 'marked_abandoned': return '⚠️';
      case 'warned': return '📢';
      case 'cleared': return '✅';
      default: return '•';
    }
  }

  /**
   * Broadcast important events via realtime channels
   */
  private async broadcastEvents(results: AbandonmentResult[]): Promise<void> {
    for (const result of results) {
      if (result.action_taken === 'forfeited' || result.action_taken === 'marked_abandoned') {
        // Broadcast to game channel
        const channel = this.supabase.channel(`game:${result.game_id}`);
        
        await channel.send({
          type: 'broadcast',
          event: 'abandonment_update',
          payload: {
            game_id: result.game_id,
            action: result.action_taken,
            abandoned_by: result.abandoned_by,
            minutes_inactive: result.minutes_inactive,
            timestamp: new Date().toISOString()
          }
        });

        // Clean up channel
        await channel.unsubscribe();
      }
    }
  }

  /**
   * Log abandonment statistics
   */
  private async logStats(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_abandonment_stats')
        .returns<AbandonmentStats>()
        .single();

      if (error) {
        console.error("[AbandonmentDetector] Error getting stats:", error);
        return;
      }

      if (data) {
        console.log("[AbandonmentDetector] === Statistics ===");
        console.log(`  Active games: ${data.total_active_games}`);
        console.log(`  Games with warnings: ${data.games_with_warnings}`);
        console.log(`  Games abandoned: ${data.games_abandoned}`);
        console.log(`  Abandonments (last hour): ${data.abandonments_last_hour}`);
        console.log(`  By color: White=${data.abandonments_by_color.white}, Black=${data.abandonments_by_color.black}`);
        if (data.avg_minutes_to_abandonment) {
          console.log(`  Avg time to abandonment: ${Math.round(data.avg_minutes_to_abandonment)}m`);
        }
        console.log("==================");
      }
    } catch (error) {
      console.error("[AbandonmentDetector] Error logging stats:", error);
    }
  }

  /**
   * Get current service status
   */
  getStatus(): {
    isRunning: boolean;
    checkCount: number;
    lastCheckTime: Date | null;
  } {
    return {
      isRunning: this.isRunning,
      checkCount: this.checkCount,
      lastCheckTime: this.lastCheckTime
    };
  }

  /**
   * Manually trigger a single abandonment check
   */
  async manualCheck(): Promise<AbandonmentResult[]> {
    console.log("[AbandonmentDetector] Manual check triggered");
    
    const { data, error } = await this.supabase
      .rpc('batch_check_abandonments')
      .returns<AbandonmentResult[]>();

    if (error) {
      console.error("[AbandonmentDetector] Manual check error:", error);
      throw error;
    }

    if (data && data.length > 0) {
      console.log(`[AbandonmentDetector] Manual check found ${data.length} actions`);
      for (const result of data) {
        this.logAction(result);
      }
    } else {
      console.log("[AbandonmentDetector] Manual check: No actions needed");
    }

    return data || [];
  }
}