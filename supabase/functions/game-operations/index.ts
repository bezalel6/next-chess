/// <reference lib="deno.ns" />
import { serve } from "std/http/server.ts";
import {
  handleAuthenticatedRequest,
  corsHeaders,
} from "../_shared/auth-utils.ts";
import {
  handleMakeMove,
  handleBanMove,
  handleGameOffer,
  handleResignation,
  handleMushroomGrowth,
} from "../_shared/game-handlers.ts";

// Main serve function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    const { operation, ...params } = body;

    switch (operation) {
      case "makeMove":
        return await handleMakeMove(user, params, supabase);

      case "banMove":
        return await handleBanMove(user, params, supabase);

      // Draw offers
      case "offerDraw":
        return await handleGameOffer(user, params, supabase, "draw", "offer");

      case "acceptDraw":
        return await handleGameOffer(user, params, supabase, "draw", "accept");

      case "declineDraw":
        return await handleGameOffer(user, params, supabase, "draw", "decline");

      // Rematch offers
      case "offerRematch":
        return await handleGameOffer(
          user,
          params,
          supabase,
          "rematch",
          "offer",
        );

      case "acceptRematch":
        return await handleGameOffer(
          user,
          params,
          supabase,
          "rematch",
          "accept",
        );

      case "declineRematch":
        return await handleGameOffer(
          user,
          params,
          supabase,
          "rematch",
          "decline",
        );

      // Resignation
      case "resign":
        return await handleResignation(user, params, supabase);

      // Special functions
      case "mushroomGrowth":
        return await handleMushroomGrowth(user, params, supabase);

      default:
        return new Response(JSON.stringify({ error: "Unknown operation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  });
});
