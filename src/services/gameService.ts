import { supabase } from "../utils/supabase";
import type { Game, ChessMove, DBGame, PlayerColor } from "@/types/game";
import { getBannedMove, isGameOver as isGameOverFunc } from "@/utils/gameUtils";
import { Chess } from "chess.ts";

export class GameService {
  static async createGame(
    whitePlayerId: string,
    blackPlayerId: string,
  ): Promise<Game> {
    const chess = new Chess();
    const { data: game, error } = await supabase
      .from("games")
      .insert<Partial<DBGame>>({
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        status: "active",
        current_fen: chess.fen(),
        pgn: chess.pgn(),
        turn: "white",
        banningPlayer: "black",
      })
      .select()
      .single<DBGame>();

    if (error) throw error;

    return this.mapGameFromDB(game);
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

  static async updateGame(
    gameId: string,
    updates: Partial<DBGame>,
  ): Promise<Game> {
    console.log(`[GameService] Updating game ${gameId}:`, updates);

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update(updates)
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error updating game: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }

  static async banMove(gameId: string, move: Omit<ChessMove, "promotion">) {
    const game = await this.getGame(gameId);
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    chess.setComment(`banning: ${move.from}${move.to}`);
    const gameOverState = isGameOverFunc(chess);
    const status = gameOverState.isOver ? "finished" : "active";

    return this.updateGame(gameId, {
      banningPlayer: null,
      pgn: chess.pgn(),
      status,
      result: gameOverState.result,
      end_reason: gameOverState.reason,
    });
  }

  static async makeMove(gameId: string, move: ChessMove): Promise<Game> {
    console.log(
      `[GameService] Making move ${JSON.stringify(move)} for game ${gameId}`,
    );
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");

    const chess = new Chess(game.currentFen);
    if (game.pgn) {
      chess.loadPgn(game.pgn);
    }

    const result = chess.move(move);
    if (!result) throw new Error("Invalid move");

    console.log(`[GameService] Move valid. New FEN: ${chess.fen()}`);
    console.log(`[GameService] Updated PGN: ${chess.pgn()}`);

    // Check game over with banned move consideration
    const gameOverState = isGameOverFunc(chess, game.pgn);
    const isGameOver = gameOverState.isOver;
    const status = isGameOver ? "finished" : "active";

    const updatedGame = await this.updateGame(gameId, {
      current_fen: chess.fen(),
      pgn: chess.pgn(),
      last_move: move,
      turn: game.turn === "white" ? "black" : "white",
      banningPlayer: game.turn,
      status,
      result: gameOverState.result,
      end_reason: gameOverState.reason,
      draw_offered_by: null,
    });

    // Record the move
    await supabase.from("moves").insert({
      game_id: gameId,
      move,
    });

    console.log(`[GameService] Move recorded in history`);

    return updatedGame;
  }

  static async subscribeToGame(gameId: string, callback: (game: Game) => void) {
    console.log(`[GameService] Subscribing to game ${gameId}`);
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
              `[GameService] Game update received for game ${gameId}`,
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

    console.log(`[GameService] Subscription initiated for game ${gameId}`);
    return subscription;
  }

  static async getUserActiveGames(userId: string): Promise<Game[]> {
    console.log(`[GameService] Getting active games for user ${userId}`);
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(
        `[GameService] Error getting active games: ${error.message}`,
      );
      throw error;
    }

    return data.map(this.mapGameFromDB);
  }

  static mapGameFromDB(dbGame: DBGame | any): Game {
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

  // Unified offer management function
  static async handleOffer(
    gameId: string,
    offerType: "draw" | "rematch",
    playerColor: PlayerColor,
    action: "offer" | "accept" | "decline",
  ): Promise<Game> {
    const field = `${offerType}_offered_by`;
    console.log(
      `[GameService] ${action} ${offerType} by ${playerColor} in game ${gameId}`,
    );

    // Handle offering
    if (action === "offer") {
      return this.updateGame(gameId, {
        [field]: playerColor,
      });
    }

    // Handle declining
    if (action === "decline") {
      return this.updateGame(gameId, {
        [field]: null,
      });
    }

    // Handle accepting
    if (action === "accept") {
      if (offerType === "draw") {
        return this.updateGame(gameId, {
          status: "finished",
          result: "draw",
          [field]: null,
          end_reason: "draw_agreement",
        });
      } else if (offerType === "rematch") {
        // First get the current game to get player IDs and swap them
        const currentGame = await this.getGame(gameId);
        if (!currentGame) throw new Error("Game not found");

        // Create a new game with swapped colors
        const newGame = await this.createGame(
          currentGame.blackPlayer, // Swap colors
          currentGame.whitePlayer, // Swap colors
        );

        // Update parent game reference
        await this.updateGame(gameId, {
          [field]: null, // Clear the offer
        });

        // Update the new game with parent reference
        return this.updateGame(newGame.id, {
          parent_game_id: gameId,
        });
      }
    }

    throw new Error(`Invalid action ${action} for ${offerType}`);
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
    console.log(
      `[GameService] Player ${playerColor} resigned in game ${gameId}`,
    );
    const result = playerColor === "white" ? "black" : "white";

    return this.updateGame(gameId, {
      status: "finished",
      result,
      end_reason: "resignation",
    });
  }
}
