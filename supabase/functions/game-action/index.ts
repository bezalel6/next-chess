/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BanChess } from "https://esm.sh/ban-chess.ts@1.1.1";

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
    // Log request details
    console.log('[game-action] Request received:', {
      method: req.method,
      hasAuth: req.headers.has('Authorization'),
      authHeader: req.headers.get('Authorization')?.substring(0, 50) + '...',
      url: req.url,
    });

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user - pass the token directly
    console.log('[game-action] Attempting to get user with token...');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      console.error('[game-action] Auth error:', authError.message, authError.code);
    }
    
    if (authError || !user) {
      console.log('[game-action] Unauthorized - no user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[game-action] User authenticated:', user.id);

    const { gameId, action } = await req.json();
    console.log('[game-action] Request body:', { gameId, action });

    // Load game
    console.log('[game-action] Loading game:', gameId);
    const { data: game, error: gameError } = await supabaseClient
      .from('games')
      .select('*, white_player:profiles!games_white_player_id_fkey(username), black_player:profiles!games_black_player_id_fkey(username)')
      .eq('id', gameId)
      .single();

    if (gameError) {
      console.error('[game-action] Game load error:', gameError);
      return new Response(
        JSON.stringify({ error: 'Game not found', details: gameError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!game) {
      console.log('[game-action] No game found with ID:', gameId);
      return new Response(
        JSON.stringify({ error: 'Game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[game-action] Game loaded:', {
      id: game.id,
      white: game.white_player_id,
      black: game.black_player_id,
      state: game.ban_chess_state,
      turn: game.turn
    });

    // Check if user is a player in this game
    const isPlayer = user.id === game.white_player_id || user.id === game.black_player_id;
    if (!isPlayer) {
      return new Response(
        JSON.stringify({ error: 'Not a player in this game' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load engine state - use current_fen, not ban_chess_state
    const engine = new BanChess(game.current_fen || undefined);

    // Check if it's the player's turn for the current action
    const playerColor = user.id === game.white_player_id ? 'white' : 'black';
    
    // For bans, check banning_player; for moves, check turn
    if (action.ban) {
      if (game.banning_player !== playerColor) {
        console.log('[game-action] Not player turn to ban:', { 
          banning_player: game.banning_player, 
          playerColor 
        });
        return new Response(
          JSON.stringify({ error: 'Not your turn to ban' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (action.move) {
      if (game.turn !== playerColor) {
        console.log('[game-action] Not player turn to move:', { 
          turn: game.turn, 
          playerColor 
        });
        return new Response(
          JSON.stringify({ error: 'Not your turn to move' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
    const newFen = engine.fen();
    const nextAction = engine.nextActionType();
    const newTurn = engine.turn; // turn is a property in ban-chess.ts, returns 'white' | 'black'
    
    const { error: updateError } = await supabaseClient
      .from('games')
      .update({
        current_fen: newFen,
        ban_chess_state: nextAction === 'ban' ? 'waiting_for_ban' : 'waiting_for_move',
        turn: newTurn,
        banning_player: nextAction === 'ban' ? newTurn : null,
        status: engine.gameOver() ? 'completed' : 'active',
        winner: engine.gameOver() ? getWinner(engine) : null,
        updated_at: new Date().toISOString(),
        last_move_at: new Date().toISOString(),
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

    // Broadcast complete game state via realtime for live synchronization
    console.log('[game-action] Preparing to broadcast update for game:', gameId);
    const channel = supabaseClient.channel(`game:${gameId}`);
    
    // Subscribe the channel first
    await channel.subscribe();
    console.log('[game-action] Channel subscribed, sending broadcast...');
    
    const broadcastResult = await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: {
        // Complete game state for live clients
        id: gameId,
        current_fen: newFen,
        ban_chess_state: nextAction === 'ban' ? 'waiting_for_ban' : 'waiting_for_move',
        turn: newTurn,
        banning_player: nextAction === 'ban' ? newTurn : null,
        status: engine.gameOver() ? 'completed' : 'active',
        winner: engine.gameOver() ? getWinner(engine) : null,
        
        // Action details for immediate UI feedback
        lastAction: {
          type: actionType,
          playerId: user.id,
          playerColor,
          ...actionData,
          timestamp: new Date().toISOString()
        },
        
        // Engine state for client-side validation
        history: engine.history(),
        legalMoves: !engine.gameOver() ? engine.legalMoves() : [],
        nextActionType: nextAction,
        gameOver: engine.gameOver(),
        result: engine.gameOver() ? getWinner(engine) : null,
        
        // Players info
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
        white_player: game.white_player,
        black_player: game.black_player,
      }
    });
    
    console.log('[game-action] Broadcast result:', broadcastResult);
    
    // Clean up the channel
    await supabaseClient.removeChannel(channel);
    console.log('[game-action] Channel cleaned up');

    return new Response(
      JSON.stringify({ 
        success: true, 
        current_fen: newFen,
        ban_chess_state: nextAction === 'ban' ? 'waiting_for_ban' : 'waiting_for_move',
        nextActionType: nextAction,
        turn: newTurn,
        gameOver: engine.gameOver(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[game-action] Unexpected error:', error);
    console.error('[game-action] Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getWinner(engine: BanChess): string | null {
  if (!engine.gameOver()) return null;
  
  // Check for checkmate
  if (engine.inCheckmate()) {
    // If it's white's turn and they're in checkmate, black wins
    return engine.turn === 'white' ? 'black' : 'white';
  }
  
  // Check for stalemate (draw)
  if (engine.inStalemate()) {
    return 'draw';
  }
  
  // Other game over conditions are draws
  return 'draw';
}