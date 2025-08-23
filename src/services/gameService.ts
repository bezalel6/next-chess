import { supabase, invokeWithAuth } from "../utils/supabase";
import type { Game, ChessMove, PlayerColor } from "@/types/game";
import type { ChatMessage } from "@/types/chat";
import { Chess } from "chess.ts";
import type { Database } from "@/types/database";

// Define type aliases for better readability
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerColorEnum = Database["public"]["Enums"]["player_color"];
type GameStatusEnum = Database["public"]["Enums"]["game_status"];
type GameResultEnum = Database["public"]["Enums"]["game_result"];

// Enhanced error type for better error handling
interface EnhancedError extends Error {
  details?: string;
  status?: number;
  code?: string;
}
type EndReasonEnum = Database["public"]["Enums"]["end_reason"];

export class GameService {
  // Core game operations
  static async makeMove(gameId: string, move: ChessMove): Promise<Game> {
    return this.performGameOperation("makeMove", gameId, { move });
  }

  static async banMove(
    gameId: string,
    move: Omit<ChessMove, "promotion">,
  ): Promise<Game> {
    return this.performGameOperation("banMove", gameId, { move });
  }

  static async resign(
    gameId: string,
    playerColor: PlayerColorEnum,
  ): Promise<Game> {
    return this.performGameOperation("resign", gameId, { playerColor });
  }

  // Offer management (draw, rematch)
  static async offerDraw(
    gameId: string,
    playerColor: PlayerColorEnum,
  ): Promise<Game> {
    return this.performGameOperation("offerDraw", gameId, { playerColor });
  }

  static async acceptDraw(gameId: string): Promise<Game> {
    return this.performGameOperation("acceptDraw", gameId);
  }

  static async declineDraw(gameId: string): Promise<Game> {
    return this.performGameOperation("declineDraw", gameId);
  }

  static async offerRematch(
    gameId: string,
    playerColor: PlayerColorEnum,
  ): Promise<Game> {
    return this.performGameOperation("offerRematch", gameId, { playerColor });
  }

  static async acceptRematch(gameId: string): Promise<Game> {
    return this.performGameOperation("acceptRematch", gameId);
  }

  static async declineRematch(gameId: string): Promise<Game> {
    return this.performGameOperation("declineRematch", gameId);
  }

  // Game retrieval and subscription
  static async getGame(gameId: string): Promise<Game | null> {
    try {
      const { data: game, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      // Fetch usernames separately
      const [whiteProfile, blackProfile] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", game.white_player_id).single(),
        supabase.from("profiles").select("username").eq("id", game.black_player_id).single()
      ]);

      // Add username data to game object
      const gameWithUsernames = {
        ...game,
        white_profile: whiteProfile.data,
        black_profile: blackProfile.data
      };

      return this.mapGameFromDB(gameWithUsernames);
    } catch (error) {
      console.error(`[GameService] Error fetching game: ${error.message}`);
      throw error;
    }
  }

  static async getUserActiveGames(userId: string): Promise<Game[]> {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("status", "active")
        .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`);

      if (error) {
        throw error;
      }

      // Fetch all unique player IDs
      const playerIds = new Set<string>();
      data.forEach(game => {
        playerIds.add(game.white_player_id);
        playerIds.add(game.black_player_id);
      });

      // Fetch all profiles at once
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", Array.from(playerIds));

      // Create a map for quick lookup
      const profileMap = new Map(profiles?.map(p => [p.id, p.username]) || []);

      // Add username data to each game
      const gamesWithUsernames = data.map(game => ({
        ...game,
        white_profile: { username: profileMap.get(game.white_player_id) || game.white_player_id },
        black_profile: { username: profileMap.get(game.black_player_id) || game.black_player_id }
      }));

      const allGames = gamesWithUsernames.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      return allGames.map((game) => this.mapGameFromDB(game));
    } catch (error) {
      console.error(
        `[GameService] Error getting active games: ${error.message}`,
      );
      throw error;
    }
  }

  static subscribeToGame(gameId: string, callback: (game: Game) => void) {
    const subscription = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        async (payload) => {
          // Fetch the full game data with usernames
          const game = await this.getGame(gameId);
          if (game) {
            callback(game);
          }
        },
      )
      .subscribe();

    return subscription;
  }

  // Private helper methods
  private static async performGameOperation(
    operation: string,
    gameId: string,
    params: any = {},
  ): Promise<Game> {
    try {
      const { data, error } = await invokeWithAuth("game-operations", {
        body: {
          operation,
          gameId,
          ...params,
        },
      });

      if (error) {
        console.error(
          `[GameService] Error during ${operation}:`,
          error
        );
        
        // Create enhanced error with all details
        const enhancedError: EnhancedError = new Error(error.message || `${operation} failed`);
        enhancedError.details = error.details || error.message || '';
        enhancedError.status = error.status;
        enhancedError.code = error.code;
        throw enhancedError;
      }

      // Edge function returns game without usernames, so fetch the full game
      const fullGame = await this.getGame(gameId);
      if (!fullGame) {
        throw new Error("Game not found after operation");
      }
      return fullGame;
    } catch (error: any) {
      console.error(`[GameService] Error in ${operation}:`, error);
      
      // If it's already an enhanced error, pass it through
      if (error.details) {
        throw error;
      }
      
      // Otherwise enhance it
      const enhancedError: EnhancedError = new Error(error.message || `${operation} failed`);
      enhancedError.details = error.message || '';
      enhancedError.status = error.status;
      throw enhancedError;
    }
  }

  static mapGameFromDB(dbGame: any): Game {
    // Normalize snake_case -> camelCase once here; rest of app must use camelCase only
    const currentFen = dbGame.current_fen ?? dbGame.currentFen;
    const whitePlayerId = dbGame.white_player_id ?? dbGame.whitePlayerId;
    const blackPlayerId = dbGame.black_player_id ?? dbGame.blackPlayerId;
    const lastMoveRaw = dbGame.last_move ?? dbGame.lastMove ?? null;
    const banningPlayer = dbGame.banning_player ?? dbGame.banningPlayer ?? null;
    const currentBannedMove = dbGame.current_banned_move ?? dbGame.currentBannedMove ?? null;
    const startTime = dbGame.created_at ?? dbGame.createdAt;
    const lastMoveTime = dbGame.updated_at ?? dbGame.updatedAt;
    const drawOfferedBy = dbGame.draw_offered_by ?? dbGame.drawOfferedBy ?? null;
    const endReason = dbGame.end_reason ?? dbGame.endReason ?? null;
    const rematchOfferedBy = dbGame.rematch_offered_by ?? dbGame.rematchOfferedBy ?? null;
    const parentGameId = dbGame.parent_game_id ?? dbGame.parentGameId ?? null;
    const whiteTimeRemaining = dbGame.white_time_remaining ?? dbGame.whiteTimeRemaining ?? null;
    const blackTimeRemaining = dbGame.black_time_remaining ?? dbGame.blackTimeRemaining ?? null;
    const timeControl = dbGame.time_control ?? dbGame.timeControl ?? null;

    const chess = new Chess(currentFen);

    // Extract usernames from joined profiles or fallback to IDs
    const whiteUsername = dbGame.white_profile?.username || whitePlayerId;
    const blackUsername = dbGame.black_profile?.username || blackPlayerId;

    return {
      id: dbGame.id,
      whitePlayerId,
      blackPlayerId,
      whitePlayer: whiteUsername,
      blackPlayer: blackUsername,
      status: dbGame.status,
      result: dbGame.result,
      currentFen,
      pgn: dbGame.pgn || "",
      chess,
      lastMove: lastMoveRaw ? (lastMoveRaw as unknown as ChessMove) : null,
      turn: dbGame.turn,
      banningPlayer,
      currentBannedMove: currentBannedMove ? (currentBannedMove as ChessMove) : null,
      startTime: new Date(startTime).getTime(),
      lastMoveTime: new Date(lastMoveTime).getTime(),
      drawOfferedBy,
      endReason,
      rematchOfferedBy,
      parentGameId,
      whiteTimeRemaining,
      blackTimeRemaining,
      timeControl: timeControl
        ? {
            initialTime: (timeControl as any)?.initial_time ?? (timeControl as any)?.initialTime ?? 600000,
            increment: (timeControl as any)?.increment ?? 0,
          }
        : { initialTime: 600000, increment: 0 },
      version: dbGame.version ?? undefined,
    };
  }

  private static mapGameFromResponse(game: GameRow): Game {
    if (!game) throw new Error("Game data is missing from response");
    return this.mapGameFromDB(game);
  }

  // ============= Chat Methods =============
  
  static async sendChatMessage(gameId: string, content: string): Promise<ChatMessage> {
    try {
      const response = await this.performGameOperation("sendChatMessage", gameId, { 
        content: content.trim() 
      }) as any;
      
      if (response.error) {
        if (response.error.includes('moderation')) {
          // Include timeout data in error
          const error = new Error(response.error) as any;
          error.data = response.data;
          throw error;
        }
        throw new Error(response.error);
      }
      
      return response.message;
    } catch (error: any) {
      // If it's a moderation error from the edge function, preserve the data
      if (error.data) {
        throw error;
      }
      throw new Error(error.message || 'Failed to send message');
    }
  }
  
  static async getChatMessages(gameId: string, limit: number = 50): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('game_messages' as any)
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Failed to fetch chat messages:', error);
      throw error;
    }
    
    // Reverse to get chronological order and map to ChatMessage type
    return (data || []).reverse().map(this.mapChatMessageFromDB);
  }
  
  static async checkChatTimeout(): Promise<{ isTimedOut: boolean; until?: Date }> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      return { isTimedOut: false };
    }
    
    const { data, error } = await supabase
      .from('chat_timeouts' as any)
      .select('timeout_until')
      .eq('user_id', user.user.id)
      .single();
    
    if (error || !data) {
      return { isTimedOut: false };
    }
    
    const timeoutUntil = new Date((data as any).timeout_until);
    if (timeoutUntil < new Date()) {
      return { isTimedOut: false };
    }
    
    return { 
      isTimedOut: true, 
      until: timeoutUntil 
    };
  }
  
  static mapChatMessageFromDB(dbMessage: any): ChatMessage {
    return {
      id: dbMessage.id,
      gameId: dbMessage.game_id,
      type: dbMessage.message_type,
      senderId: dbMessage.sender_id,
      content: dbMessage.content,
      timestamp: new Date(dbMessage.created_at),
      metadata: dbMessage.metadata || {}
    };
  }
}
