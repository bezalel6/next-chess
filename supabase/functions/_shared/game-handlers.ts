/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BanChess } from "https://esm.sh/ban-chess.ts@1.1.1";
import { handleMove } from "./move.ts";
import { handleBan } from "./ban.ts";
import { validateGameAction } from "./validation.ts";
import { Database } from "../database-types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  gameId: string;
  action: {
    move?: {
      from: string;
      to: string;
      promotion?: string;
    };
    ban?: {
      from: string;
      to: string;
    };
    resign?: boolean;
    drawOffer?: boolean;
    drawAccept?: boolean;
  };
}

interface GameRecord {
  id: string;
  current_fen: string | null;
  white_player_id: string;
  black_player_id: string;
  white_player?: { username: string };
  black_player?: { username: string };
  banning_player: string | null;
  turn: string;
  status: string;
}

export async function handleGameOperation(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No authorization token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json() as RequestBody;
    const { gameId, action } = body;
    
    if (!gameId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing gameId or action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: game, error: gameError } = await supabaseClient
      .from('games')
      .select('*, white_player:profiles!games_white_player_id_fkey(username), black_player:profiles!games_black_player_id_fkey(username)')
      .eq('id', gameId)
      .single();
      
    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: 'Game not found', details: gameError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const gameRecord: GameRecord = {
      id: game.id,
      current_fen: game.current_fen,
      white_player_id: game.white_player_id,
      black_player_id: game.black_player_id,
      white_player: game.white_player,
      black_player: game.black_player,
      banning_player: game.banning_player,
      turn: game.turn,
      status: game.status
    };
    
    const validation = validateGameAction(gameRecord, user, action);
    
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action.move) {
      return handleMove(req, supabaseClient, user, gameRecord, { move: action.move });
    } else if (action.ban) {
      return handleBan(req, supabaseClient, user, gameRecord, { ban: action.ban });
    } else if (action.resign) {
      // TODO: Implement resignation logic
      return new Response(
        JSON.stringify({ error: "Resignation not yet implemented" }),
        { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action.drawOffer || action.drawAccept) {
      // TODO: Implement draw logic
      return new Response(
        JSON.stringify({ error: "Draw functionality not yet implemented" }),
        { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action type" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    
    console.error('[game-action] Unexpected error:', errorMessage);
    console.error('[game-action] Error stack:', errorDetails);
    
    return new Response(
      JSON.stringify({ error: errorMessage, details: errorDetails }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}