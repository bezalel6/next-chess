/**
 * Utility for testing the matchmaking flow
 * These functions can be used from the browser console to test the matchmaking flow
 */

import { supabase } from "./supabase";

export const testMatchmaking = {
  /**
   * Force a match between two players
   */
  async forceMatch(player1Id: string, player2Id: string): Promise<void> {
    console.log(
      `[TEST] Forcing match between players ${player1Id} and ${player2Id}`,
    );

    try {
      // Add both users to the queue
      await Promise.all([
        supabase.from("queue").upsert({
          user_id: player1Id,
          status: "waiting",
        }),
        supabase.from("queue").upsert({
          user_id: player2Id,
          status: "waiting",
        }),
      ]);

      console.log(`[TEST] Both players added to queue`);

      // Force them to be matched
      await Promise.all([
        supabase
          .from("queue")
          .update({
            status: "matched",
          })
          .eq("user_id", player1Id),
        supabase
          .from("queue")
          .update({
            status: "matched",
          })
          .eq("user_id", player2Id),
      ]);

      console.log(`[TEST] Both players marked as matched`);

      // Call the edge function to create the game
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/game-operations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            operation: "create-game-from-matched",
            source: "test",
          }),
        },
      );

      const result = await res.json();
      console.log(`[TEST] Game creation result:`, result);

      return result;
    } catch (error) {
      console.error(`[TEST] Error forcing match:`, error);
      throw error;
    }
  },

  /**
   * Simulate a match by adding current user to queue
   */
  async simulateMatch(): Promise<void> {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;

    if (!userId) {
      throw new Error("Not logged in");
    }

    console.log(`[TEST] Adding user ${userId} to queue`);

    try {
      await supabase.from("queue").upsert({
        user_id: userId,
        status: "waiting",
      });

      console.log(
        `[TEST] User added to queue, check connection context log for updates`,
      );
    } catch (error) {
      console.error(`[TEST] Error simulating match:`, error);
      throw error;
    }
  },

  /**
   * Check if a player has active games
   */
  async checkActiveGames(userId?: string): Promise<any> {
    const session = await supabase.auth.getSession();
    const checkId = userId || session.data.session?.user.id;

    if (!checkId) {
      throw new Error("No user ID provided and not logged in");
    }

    // Check games where player is white
    const { data: whiteGames, error: whiteError } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, status, created_at")
      .eq("white_player_id", checkId)
      .eq("status", "active");

    if (whiteError) {
      console.error(`[TEST] Error checking active games as white:`, whiteError);
      throw whiteError;
    }

    // Check games where player is black
    const { data: blackGames, error: blackError } = await supabase
      .from("games")
      .select("id, white_player_id, black_player_id, status, created_at")
      .eq("black_player_id", checkId)
      .eq("status", "active");

    if (blackError) {
      console.error(`[TEST] Error checking active games as black:`, blackError);
      throw blackError;
    }

    // Combine results
    const allGames = [...whiteGames, ...blackGames];

    console.log(
      `[TEST] Found ${allGames.length} active games for user ${checkId}:`,
      allGames,
    );
    return allGames;
  },
};
