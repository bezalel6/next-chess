import { BanChess } from "https://esm.sh/ban-chess.ts@1.1.1";
import { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Database } from "../database-types.ts";

interface GameRecord {
  id: string;
  current_fen: string | null;
  white_player_id: string;
  black_player_id: string;
  white_player?: { username: string };
  black_player?: { username: string };
  banning_player: string | null;
  turn: string;
}

interface MoveAction {
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
}

export async function handleMove(
  req: Request,
  supabaseClient: SupabaseClient<Database>,
  user: User,
  game: GameRecord,
  action: MoveAction
): Promise<Response> {
    const engine = new BanChess(game.current_fen || undefined);

    try {
      engine.play(action);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: `Invalid action: ${errorMessage}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newFen = engine.fen();
    const nextAction = engine.nextActionType();
    const newTurn = engine.turn;
    
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
      .eq('id', game.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update game' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const actionType = 'move';
    const actionData = action.move;
    const ply = engine.history().length;

    await supabaseClient
      .from('game_moves')
      .insert({
        game_id: game.id,
        action_type: actionType,
        action_data: actionData,
        ply: ply,
      });

    const channel = supabaseClient.channel(`game:${game.id}`);
    
    await channel.subscribe();
    
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: {
        id: game.id,
        current_fen: newFen,
        ban_chess_state: nextAction === 'ban' ? 'waiting_for_ban' : 'waiting_for_move',
        turn: newTurn,
        banning_player: nextAction === 'ban' ? newTurn : null,
        status: engine.gameOver() ? 'completed' : 'active',
        winner: engine.gameOver() ? getWinner(engine) : null,
        lastAction: {
          type: actionType,
          playerId: user.id,
          playerColor: user.id === game.white_player_id ? 'white' : 'black',
          ...actionData,
          timestamp: new Date().toISOString()
        },
        history: engine.history(),
        legalMoves: !engine.gameOver() ? engine.legalMoves() : [],
        nextActionType: nextAction,
        gameOver: engine.gameOver(),
        result: engine.gameOver() ? getWinner(engine) : null,
        white_player_id: game.white_player_id,
        black_player_id: game.black_player_id,
        white_player: game.white_player,
        black_player: game.black_player,
      }
    });
    
    await supabaseClient.removeChannel(channel);

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
        headers: { 'Content-Type': 'application/json' } 
      }
    );
}

function getWinner(engine: BanChess): string | null {
  if (!engine.gameOver()) return null;
  
  if (engine.inCheckmate()) {
    return engine.turn === 'white' ? 'black' : 'white';
  }
  
  if (engine.inStalemate()) {
    return 'draw';
  }
  
  return 'draw';
}
