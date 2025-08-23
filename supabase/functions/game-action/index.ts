/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BanChess } from "https://esm.sh/ban-chess.ts@1.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { gameId, action } = await req.json();

    // Load game
    const { data: game, error: gameError } = await supabaseClient
      .from('games')
      .select('*, white_player:profiles!games_white_player_id_fkey(username), black_player:profiles!games_black_player_id_fkey(username)')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a player in this game
    const isPlayer = user.id === game.white_player_id || user.id === game.black_player_id;
    if (!isPlayer) {
      return new Response(
        JSON.stringify({ error: 'Not a player in this game' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load engine state
    const engine = new BanChess(game.ban_chess_state || undefined);

    // Check if it's the player's turn
    const turn = engine.turn();
    const playerColor = user.id === game.white_player_id ? 'w' : 'b';
    if (turn !== playerColor) {
      return new Response(
        JSON.stringify({ error: 'Not your turn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and play the action
    try {
      engine.play(action);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Invalid action: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save the new state
    const newState = engine.fen();
    const { error: updateError } = await supabaseClient
      .from('games')
      .update({
        ban_chess_state: newState,
        status: engine.gameOver() ? 'completed' : 'active',
        winner: engine.gameOver() ? getWinner(engine) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update game' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the action in moves table
    const actionType = action.move ? 'move' : 'ban';
    const actionData = action.move || action.ban;
    const ply = engine.history().length;

    await supabaseClient
      .from('game_moves')
      .insert({
        game_id: gameId,
        action_type: actionType,
        action_data: actionData,
        ply: ply,
      });

    // Broadcast update via realtime
    const channel = supabaseClient.channel(`game:${gameId}`);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: {
        state: newState,
        lastAction: { type: actionType, ...actionData },
        nextActionType: engine.nextActionType(),
        turn: engine.turn(),
        gameOver: engine.gameOver(),
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        state: newState,
        nextActionType: engine.nextActionType(),
        turn: engine.turn(),
        gameOver: engine.gameOver(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getWinner(engine: BanChess): string | null {
  if (!engine.gameOver()) return null;
  const result = engine.result();
  if (result === '1-0') return 'white';
  if (result === '0-1') return 'black';
  if (result === '1/2-1/2') return 'draw';
  return null;
}