import { supabase } from "../utils/supabase";
import type { Game, ChessMove, PlayerColor } from "@/types/game";
import { Chess } from "chess.ts";

export class SecureGameService {
  static async makeMove(gameId: string, move: ChessMove): Promise<Game> {
    console.log(
      `[SecureGameService] Making move ${JSON.stringify(move)} for game ${gameId}`,
    );

    const { data, error } = await supabase.functions.invoke("game-operations", {
      body: {
        operation: "makeMove",
        gameId,
        move,
      },
    });

    if (error) {
      console.error(`[SecureGameService] Error making move: ${error.message}`);
      throw error;
    }

    return this.mapGameFromResponse(data.data);
  }

  static async banMove(gameId: string, move: Omit<ChessMove, "promotion">) {
    const { data, error } = await supabase.functions.invoke("game-operations", {
      body: {
        operation: "banMove",
        gameId,
        move,
      },
    });

    if (error) {
      console.error(`[SecureGameService] Error banning move: ${error.message}`);
      throw error;
    }

    return this.mapGameFromResponse(data.data);
  }

  static async getGame(gameId: string): Promise<Game | null> {
    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return this.mapGameFromDB(game);
  }

  static async subscribeToGame(gameId: string, callback: (game: Game) => void) {
    console.log(`[SecureGameService] Subscribing to game ${gameId}`);
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
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            const gameData = payload.new as any;
            console.log(
              `[SecureGameService] Game update received for game ${gameId}`,
              {
                event: payload.eventType,
                fen: gameData.current_fen,
                pgn: gameData.pgn,
                turn: gameData.turn,
                status: gameData.status,
              },
            );
          }
          callback(this.mapGameFromDB(payload.new));
        },
      )
      .subscribe();

    console.log(
      `[SecureGameService] Subscription initiated for game ${gameId}`,
    );
    return subscription;
  }

  static async getUserActiveGames(userId: string): Promise<Game[]> {
    console.log(`[SecureGameService] Getting active games for user ${userId}`);
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(
        `[SecureGameService] Error getting active games: ${error.message}`,
      );
      throw error;
    }

    return data.map(this.mapGameFromDB);
  }

  // Secure unified offer management function
  static async handleOffer(
    gameId: string,
    offerType: "draw" | "rematch",
    playerColor: PlayerColor,
    action: "offer" | "accept" | "decline",
  ): Promise<Game> {
    const { data, error } = await supabase.functions.invoke("game-operations", {
      body: {
        operation: `${action}${offerType.charAt(0).toUpperCase() + offerType.slice(1)}`,
        gameId,
        playerColor,
      },
    });

    if (error) {
      console.error(
        `[SecureGameService] Error handling ${action} ${offerType}: ${error.message}`,
      );
      throw error;
    }

    return this.mapGameFromResponse(data.data);
  }

  // Draw offer methods using the unified function
  static async offerDraw(
    gameId: string,
    playerColor: PlayerColor,
  ): Promise<Game> {
    return this.handleOffer(gameId, "draw", playerColor, "offer");
  }

  static async acceptDraw(gameId: string): Promise<Game> {
    return this.handleOffer(gameId, "draw", null, "accept");
  }

  static async declineDraw(gameId: string): Promise<Game> {
    return this.handleOffer(gameId, "draw", null, "decline");
  }

  // Rematch offer methods using the unified function
  static async offerRematch(
    gameId: string,
    playerColor: PlayerColor,
  ): Promise<Game> {
    return this.handleOffer(gameId, "rematch", playerColor, "offer");
  }

  static async acceptRematch(gameId: string): Promise<Game> {
    return this.handleOffer(gameId, "rematch", null, "accept");
  }

  static async declineRematch(gameId: string): Promise<Game> {
    return this.handleOffer(gameId, "rematch", null, "decline");
  }

  static async resign(gameId: string, playerColor: PlayerColor): Promise<Game> {
    const { data, error } = await supabase.functions.invoke("game-operations", {
      body: {
        operation: "resign",
        gameId,
        playerColor,
      },
    });

    if (error) {
      console.error(`[SecureGameService] Error resigning: ${error.message}`);
      throw error;
    }

    return this.mapGameFromResponse(data.data);
  }

  // Helper methods for mapping data
  static mapGameFromDB(dbGame: any): Game {
    const chess = new Chess(dbGame.current_fen);
    return {
      id: dbGame.id,
      whitePlayer: dbGame.white_player_id,
      blackPlayer: dbGame.black_player_id,
      status: dbGame.status,
      result: dbGame.result,
      currentFen: dbGame.current_fen,
      pgn: dbGame.pgn || "",
      chess,
      lastMove: dbGame.last_move,
      turn: dbGame.turn,
      banningPlayer: dbGame.banningPlayer,
      startTime: new Date(dbGame.created_at).getTime(),
      lastMoveTime: new Date(dbGame.updated_at).getTime(),
      drawOfferedBy: dbGame.draw_offered_by || null,
      endReason: dbGame.end_reason || null,
      rematchOfferedBy: dbGame.rematch_offered_by || null,
      parentGameId: dbGame.parent_game_id || null,
    };
  }

  static mapGameFromResponse(game: any): Game {
    if (!game) throw new Error("Game data is missing from response");
    return this.mapGameFromDB(game);
  }
}
