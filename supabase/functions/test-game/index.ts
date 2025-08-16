import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get service role client for bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { withBan = false } = await req.json();

    // Generate a UUID for the game
    const generateUUID = () => {
      return crypto.randomUUID();
    };

    const gameId = generateUUID();
    const now = new Date().toISOString();

    // Create a test game with the authenticated user playing both sides
    const gameData = {
      id: gameId,
      white_player_id: user.id,
      black_player_id: user.id, // Self-play for testing
      status: "active",
      turn: "white",
      banning_player: withBan ? null : "black", // Black bans first unless a ban was already applied
      current_fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      pgn: "",
      white_time_remaining: 600000000, // 10 minutes in microseconds
      black_time_remaining: 600000000,
      time_control: { initial_time: 600000000, increment: 0 },
      created_at: now,
      updated_at: now,
      current_banned_move: withBan ? { from: "e2", to: "e4" } : null,
    };

    // Insert the game using service role to bypass RLS
    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert(gameData)
      .select()
      .single();

    if (gameError) {
      console.error("Error creating test game:", gameError);
      return new Response(
        JSON.stringify({ error: `Failed to create game: ${gameError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If withBan is true, also insert a ban record in the moves table
    if (withBan) {
      const { error: moveError } = await supabase
        .from("moves")
        .insert({
          game_id: gameId,
          ply_number: 0,
          move_number: 1,
          player_color: "black",
          banned_from: "e2",
          banned_to: "e4",
          created_at: now,
        });

      if (moveError) {
        console.error("Error creating ban record:", moveError);
        // Non-fatal error, game was still created
      }
    }

    // Return the created game
    return new Response(
      JSON.stringify({
        success: true,
        game,
        message: `Test game created with ID: ${gameId}`,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});