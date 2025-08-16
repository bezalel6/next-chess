import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { corsHeaders } from "../_shared/cors.ts";

interface DisconnectRequest {
  gameId: string;
  playerId: string;
  disconnectType: 'rage_quit' | 'disconnect';
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

    const { gameId, playerId, disconnectType } = await req.json() as DisconnectRequest;

    // Validate inputs
    if (!gameId || !playerId || !disconnectType) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate UUID format for playerId to match (text, uuid, text) signature
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(playerId)) {
      return new Response(
        JSON.stringify({ error: "Invalid playerId format (expected UUID)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Call the database function to handle disconnect
    const { data, error } = await supabaseClient.rpc('handle_player_disconnect', {
      game_id: gameId,
      player_id: playerId,
      disconnect_type: disconnectType,
    });

    if (error) {
      console.error('Error handling disconnect:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Broadcast disconnect event to game channel
    const channel = supabaseClient.channel(`game:${gameId}`);
    await channel.send({
      type: 'broadcast',
      event: 'player_disconnect',
      payload: {
        playerId,
        disconnectType,
        ...data,
      },
    });

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in handle-disconnect:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});