/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Chess } from "https://esm.sh/chess.js@0.13.4";

// Simple BanChess implementation for edge function
class BanChess {
  private chess: any;
  private bannedMove: { from: string; to: string } | null = null;
  private actionCount: number = 0;
  
  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }
  
  get turn(): 'w' | 'b' {
    return this.chess.turn();
  }
  
  nextActionType(): 'ban' | 'move' {
    if (this.actionCount === 0) return 'ban';
    return this.actionCount % 2 === 0 ? 'ban' : 'move';
  }
  
  play(action: any) {
    if (action.ban) {
      this.bannedMove = action.ban;
      this.actionCount++;
    } else if (action.move) {
      if (this.bannedMove && 
          this.bannedMove.from === action.move.from && 
          this.bannedMove.to === action.move.to) {
        throw new Error('Move is banned');
      }
      
      this.chess.move({
        from: action.move.from,
        to: action.move.to,
        promotion: action.move.promotion
      });
      
      this.bannedMove = null;
      this.actionCount++;
    }
  }
  
  fen(): string {
    return this.chess.fen();
  }
  
  gameOver(): boolean {
    return this.chess.isGameOver();
  }
  
  result(): string {
    if (!this.gameOver()) return '*';
    if (this.chess.isCheckmate()) {
      return this.chess.turn() === 'w' ? '0-1' : '1-0';
    }
    return '1/2-1/2';
  }
}

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

    // Load engine state - use current_fen, not ban_chess_state
    const engine = new BanChess(game.current_fen || undefined);

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
    const newFen = engine.fen();
    const nextAction = engine.nextActionType();
    const newTurn = engine.turn();
    
    const { error: updateError } = await supabaseClient
      .from('games')
      .update({
        current_fen: newFen,
        ban_chess_state: nextAction === 'ban' ? 'waiting_for_ban' : 'waiting_for_move',
        turn: newTurn === 'w' ? 'white' : 'black',
        banning_player: nextAction === 'ban' ? (newTurn === 'w' ? 'white' : 'black') : null,
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

    // Broadcast update via realtime
    const channel = supabaseClient.channel(`game:${gameId}`);
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: {
        current_fen: newFen,
        ban_chess_state: nextAction === 'ban' ? 'waiting_for_ban' : 'waiting_for_move',
        lastAction: { type: actionType, ...actionData },
        nextActionType: nextAction,
        turn: newTurn,
        gameOver: engine.gameOver(),
      }
    });

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