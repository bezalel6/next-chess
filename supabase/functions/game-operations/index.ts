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
import {
  createGameFromMatchedPlayers,
  processMatchmakingQueue,
} from "../_shared/db-trigger-handlers.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CRON job access handler
async function handleCronRequest(req: Request) {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    return await processMatchmakingQueue(supabaseAdmin);
  } catch (error) {
    console.error(`Error in cron handler: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Main serve function
serve(async (req) => {
  // Extract request path
  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  // Special handling for CRON jobs (authenticated by Supabase platform)
  if (
    path === "process-matches" &&
    req.headers.get("Authorization") === `Bearer ${Deno.env.get("CRON_SECRET")}`
  ) {
    return await handleCronRequest(req);
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return await handleAuthenticatedRequest(req, async (user, body, supabase) => {
    const { operation, ...params } = body;

    switch (operation) {
      case "process-matches":
        // For admin-triggered queue processing
        if (user.app_metadata?.role !== "admin") {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return await processMatchmakingQueue(supabase);

      case "create-game-from-matched":
        // Allow calls from both admin users and database triggers
        if (
          user.app_metadata?.role !== "admin" &&
          params.source !== "db_trigger"
        ) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(
          "[EDGE] Creating game from matched players, source:",
          params.source,
        );
        return await createGameFromMatchedPlayers(supabase);

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
