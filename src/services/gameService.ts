import { supabase, invokeWithAuth } from "../utils/supabase";
import type { Game, ChessMove, PlayerColor } from "@/types/game";
import { Chess } from "chess.ts";
import type { Database } from "@/types/database";

// Define type aliases for better readability
type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerColorEnum = Database["public"]["Enums"]["player_color"];
type GameStatusEnum = Database["public"]["Enums"]["game_status"];
type GameResultEnum = Database["public"]["Enums"]["game_result"];
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

      return this.mapGameFromDB(game as GameRow);
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

      const allGames = data.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      return allGames.map((game) => this.mapGameFromDB(game as GameRow));
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
        (payload) => callback(this.mapGameFromDB(payload.new as GameRow)),
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
          `[GameService] Error during ${operation}: ${error.message}`,
        );
        throw error;
      }

      return this.mapGameFromResponse(data.data as GameRow);
    } catch (error) {
      console.error(`[GameService] Error in ${operation}: ${error.message}`);
      throw error;
    }
  }

  static mapGameFromDB(dbGame: GameRow): Game {
    const chess = new Chess(dbGame.current_fen);
    console.log({ dbGame });
    return {
      id: dbGame.id,
      whitePlayer: dbGame.white_player_id,
      blackPlayer: dbGame.black_player_id,
      status: dbGame.status,
      result: dbGame.result,
      currentFen: dbGame.current_fen,
      pgn: dbGame.pgn || "",
      chess,
      lastMove: dbGame.last_move
        ? (dbGame.last_move as unknown as ChessMove)
        : null,
      turn: dbGame.turn,
      banningPlayer: dbGame.banning_player,
      startTime: new Date(dbGame.created_at).getTime(),
      lastMoveTime: new Date(dbGame.updated_at).getTime(),
      drawOfferedBy: dbGame.draw_offered_by || null,
      endReason: dbGame.end_reason || null,
      rematchOfferedBy: dbGame.rematch_offered_by || null,
      parentGameId: dbGame.parent_game_id || null,
      whiteTimeRemaining: dbGame.white_time_remaining || null,
      blackTimeRemaining: dbGame.black_time_remaining || null,
      timeControl: dbGame.time_control
        ? {
            initialTime: (dbGame.time_control as any)?.initial_time || 600000,
            increment: (dbGame.time_control as any)?.increment || 0,
          }
        : { initialTime: 600000, increment: 0 },
    };
  }

  private static mapGameFromResponse(game: GameRow): Game {
    if (!game) throw new Error("Game data is missing from response");
    return this.mapGameFromDB(game);
  }
}
