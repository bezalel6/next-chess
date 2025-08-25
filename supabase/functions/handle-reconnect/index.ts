import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

interface ReconnectRequest {
  gameId: string;
  playerId: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { gameId, playerId } = await req.json() as ReconnectRequest;

    // Validate inputs
    if (!gameId || !playerId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate UUID format for gameId and playerId to match (uuid, uuid) signature
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(gameId) || !uuidRegex.test(playerId)) {
      return new Response(
        JSON.stringify({ error: "Invalid id format (expected UUIDs for gameId and playerId)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Call the database function to handle reconnect (uuid, uuid)
    const { data, error } = await supabaseClient.rpc('handle_player_reconnect', {
      game_id: gameId,
      player_id: playerId,
    });

    if (error) {
      console.error('Error handling reconnect:', error);
      return new Response(
        JSON.stringify({ 
          error: error.message, 
          code: (error as Record<string, unknown>)?.code,
          details: (error as Record<string, unknown>)?.details,
          hint: (error as Record<string, unknown>)?.hint
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Best-effort broadcast reconnect event to game channel (do not fail request)
    try {
      const channel = supabaseClient.channel(`game:${gameId}`);
      await channel.send({
        type: 'broadcast',
        event: 'player_reconnect',
        payload: {
          playerId,
          ...data,
        },
      });
    } catch (broadcastErr) {
      console.warn('handle-reconnect: broadcast failed (continuing):', broadcastErr);
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in handle-reconnect:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});