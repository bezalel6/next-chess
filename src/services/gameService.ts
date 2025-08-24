import { supabase, invokeWithAuth } from "../utils/supabase";
import type { PlayerColor } from "@/types/game";
import type { ChatMessage } from "@/types/chat";
import { BanChess } from "@/lib/simple-ban-chess";
import { Tables } from "@/types/database";

export interface GameAction {
  move?: { from: string; to: string; promotion?: string };
  ban?: { from: string; to: string };
}

// Use the actual database type for games
export type GameData = Tables<'games'>;

export class GameService {
  static async createGame(
    whitePlayerId: string,
    blackPlayerId: string,
    timeControl?: { minutes: number; increment: number }
  ): Promise<GameData> {
    const engine = new BanChess();
    
    const { data, error } = await supabase
      .from('games')
      .insert({
        ban_chess_state: engine.fen(),
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        status: 'active',
        time_control_minutes: timeControl?.minutes || 10,
        increment_seconds: timeControl?.increment || 0,
        white_time_remaining: (timeControl?.minutes || 10) * 60 * 1000,
        black_time_remaining: (timeControl?.minutes || 10) * 60 * 1000,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async loadGame(gameId: string): Promise<GameData> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) throw error;
    return data;
  }

  static async playAction(gameId: string, action: GameAction): Promise<void> {
    const { data, error } = await invokeWithAuth('game-action', {
      body: { gameId, action }
    });

    if (error) {
      throw new Error(error.message || 'Failed to play action');
    }
  }

  static async resignGame(gameId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: game } = await supabase
      .from('games')
      .select('white_player_id, black_player_id')
      .eq('id', gameId)
      .single();

    if (!game) throw new Error('Game not found');

    const winner = user.id === game.white_player_id ? 'black' : 'white';

    const { error } = await supabase
      .from('games')
      .update({
        status: 'completed',
        winner,
        result_reason: 'resignation',
      })
      .eq('id', gameId);

    if (error) throw error;
  }

  static async offerDraw(gameId: string): Promise<void> {
    await this.sendSystemMessage(gameId, 'Draw offer sent');
  }

  static async acceptDraw(gameId: string): Promise<void> {
    const { error } = await supabase
      .from('games')
      .update({
        status: 'completed',
        winner: 'draw',
        result_reason: 'agreement',
      })
      .eq('id', gameId);

    if (error) throw error;
  }

  static async getGameHistory(gameId: string) {
    const { data, error } = await supabase
      .from('game_moves')
      .select('*')
      .eq('game_id', gameId)
      .order('ply', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async getActiveGames(userId: string): Promise<GameData[]> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getCompletedGames(userId: string, limit = 10): Promise<GameData[]> {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static subscribeToGame(gameId: string, onUpdate: (payload: any) => void) {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on('broadcast', { event: 'game_update' }, ({ payload }) => {
        onUpdate(payload);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      }, async () => {
        // Refetch game data on database changes
        const game = await GameService.loadGame(gameId);
        onUpdate({ type: 'db_update', game });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  static subscribeToGameChat(gameId: string, onMessage: (message: ChatMessage) => void) {
    const channel = supabase
      .channel(`game-messages:${gameId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_messages',
        filter: `game_id=eq.${gameId}`,
      }, (payload) => {
        const msg = payload.new;
        onMessage({
          id: msg.id,
          gameId: msg.game_id,
          senderId: msg.sender_id,
          content: msg.content,
          type: msg.message_type,
          timestamp: new Date(msg.created_at),
          metadata: msg.metadata || {},
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  static async sendChatMessage(gameId: string, content: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('game_messages')
      .insert({
        game_id: gameId,
        player_id: user.id,
        message: content,
      });

    if (error) throw error;
  }

  static async sendSystemMessage(gameId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('game_messages')
      .insert({
        game_id: gameId,
        player_id: null,
        message: content,
      });

    if (error) throw error;
  }

  static async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('game_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return (data || []).map((msg: any) => ({
      id: msg.id,
      gameId: msg.game_id,
      senderId: msg.sender_id,
      senderName: msg.sender?.username,
      content: msg.content,
      type: msg.message_type as any,
      timestamp: new Date(msg.created_at),
      metadata: {},
    }));
  }

  // Matchmaking
  static async joinMatchmakingQueue(timeControl?: { minutes: number; increment: number }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Call the matchmaking edge function to join queue
    const { data, error } = await supabase.functions.invoke('matchmaking', {
      body: { operation: 'joinQueue' },
    });

    if (error) throw error;
    return data;
  }

  static async leaveMatchmakingQueue() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Call the matchmaking edge function to leave queue
    const { data, error } = await supabase.functions.invoke('matchmaking', {
      body: { operation: 'leaveQueue' },
    });

    if (error) throw error;
    return data;
  }

  static async checkMatchmakingStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Call the matchmaking edge function to check status
    const { data, error } = await supabase.functions.invoke('matchmaking', {
      body: { operation: 'checkStatus' },
    });

    if (error) throw error;
    return data?.inQueue || false;
  }
}