/// <reference lib="deno.ns" />
// matchmaking/index.ts
import { serve } from "std/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
} from "../_shared/auth-utils.ts";
import {
  handleCreateMatch,
  handleJoinQueue,
  handleLeaveQueue,
  handleCheckMatchmakingStatus,
} from "../_shared/matchmaking-handlers.ts";

// Main serve function
serve(async (req) => {
  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    const { operation, ...params } = body;

    switch (operation) {
      case "createMatch":
        return await handleCreateMatch(user, params, supabase);

      case "joinQueue":
        return await handleJoinQueue(user, params, supabase);

      case "leaveQueue":
        return await handleLeaveQueue(user, params, supabase);

      case "checkStatus":
        return await handleCheckMatchmakingStatus(user, params, supabase);

      default:
        return new Response(JSON.stringify({ error: "Unknown operation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  });
});
