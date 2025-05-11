import { supabase } from "../utils/supabase";
import type {
  Game,
  ChessMove,
  DBGame,
  GameEndReason,
  PlayerColor,
} from "@/types/game";
import { Chess } from "chess.ts";

export class GameService {
  static async createGame(
    whitePlayerId: string,
    blackPlayerId: string,
  ): Promise<Game> {
    const chess = new Chess();
    const { data: game, error } = await supabase
      .from("games")
      .insert({
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        status: "active",
        current_fen: chess.fen(),
        pgn: chess.pgn(),
        turn: "white",
      })
      .select()
      .single();

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
  static async banMove(gameId: string, move: Omit<ChessMove, "promotion">) {
    const game = await this.getGame(gameId);
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    chess.setComment(`banning: ${move.from}${move.to}`);
    const { error, data } = await supabase
      .from("games")
      .update({
        banningPlayer: null,
        pgn: chess.pgn(),
      })
      .eq("id", gameId)
      .select()
      .single();
    if (error) {
      console.error(`[GameService] Error updating game: ${error.message}`);
      throw error;
    }

    console.log(`[GameService] Game updated. Turn: ${data.turn}`);
    return this.mapGameFromDB(data);
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

    const isGameOver = chess.gameOver();
    const status = isGameOver ? "finished" : "active";
    let gameResult = null;
    let endReason = null;

    if (isGameOver) {
      if (chess.inCheckmate()) {
        gameResult = game.turn;
        endReason = "checkmate";
      } else if (chess.inStalemate()) {
        gameResult = "draw";
        endReason = "stalemate";
      } else if (chess.insufficientMaterial()) {
        gameResult = "draw";
        endReason = "insufficient_material";
      } else if (chess.inThreefoldRepetition()) {
        gameResult = "draw";
        endReason = "threefold_repetition";
      } else if (chess.inDraw()) {
        gameResult = "draw";
        endReason = "fifty_move_rule";
      }
      console.log(
        `[GameService] Game over. Result: ${gameResult}, Reason: ${endReason}`,
      );
    }

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        current_fen: chess.fen(),
        pgn: chess.pgn(),
        last_move: move,
        turn: game.turn === "white" ? "black" : "white",
        banningPlayer: game.turn,
        status,
        result: gameResult,
        end_reason: endReason,
        draw_offered_by: null,
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error updating game: ${error.message}`);
      throw error;
    }

    console.log(`[GameService] Game updated. Turn: ${updatedGame.turn}`);

    // Record the move
    await supabase.from("moves").insert({
      game_id: gameId,
      move,
    });

    console.log(`[GameService] Move recorded in history`);

    return this.mapGameFromDB(updatedGame);
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

  static async offerDraw(
    gameId: string,
    playerColor: PlayerColor,
  ): Promise<Game> {
    console.log(
      `[GameService] Draw offered by ${playerColor} in game ${gameId}`,
    );

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        draw_offered_by: playerColor,
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error offering draw: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }

  static async acceptDraw(gameId: string): Promise<Game> {
    console.log(`[GameService] Draw accepted in game ${gameId}`);

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        status: "finished",
        result: "draw",
        draw_offered_by: null,
        end_reason: "draw_agreement",
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error accepting draw: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }

  static async declineDraw(gameId: string): Promise<Game> {
    console.log(`[GameService] Draw declined in game ${gameId}`);

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        draw_offered_by: null,
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error declining draw: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }

  static async resign(gameId: string, playerColor: PlayerColor): Promise<Game> {
    console.log(
      `[GameService] Player ${playerColor} resigned in game ${gameId}`,
    );

    const result = playerColor === "white" ? "black" : "white";

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        status: "finished",
        result,
        end_reason: "resignation",
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error resigning game: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }

  static async offerRematch(
    gameId: string,
    playerColor: PlayerColor,
  ): Promise<Game> {
    console.log(
      `[GameService] Rematch offered by ${playerColor} in game ${gameId}`,
    );

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        rematch_offered_by: playerColor,
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error offering rematch: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }

  static async acceptRematch(gameId: string): Promise<Game> {
    console.log(`[GameService] Rematch accepted for game ${gameId}`);

    // First get the current game to get player IDs and swap them
    const currentGame = await this.getGame(gameId);
    if (!currentGame) throw new Error("Game not found");

    // Create a new game with swapped colors
    const newGame = await this.createGame(
      currentGame.blackPlayer, // Swap colors
      currentGame.whitePlayer, // Swap colors
    );

    // Update parent game reference
    await supabase
      .from("games")
      .update({
        rematch_offered_by: null, // Clear the offer
      })
      .eq("id", gameId);

    // Update the new game with parent reference
    const { data: updatedNewGame, error } = await supabase
      .from("games")
      .update({
        parent_game_id: gameId,
      })
      .eq("id", newGame.id)
      .select()
      .single();

    if (error) {
      console.error(
        `[GameService] Error setting up rematch game: ${error.message}`,
      );
      throw error;
    }

    return this.mapGameFromDB(updatedNewGame);
  }

  static async declineRematch(gameId: string): Promise<Game> {
    console.log(`[GameService] Rematch declined for game ${gameId}`);

    const { data: updatedGame, error } = await supabase
      .from("games")
      .update({
        rematch_offered_by: null,
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error(`[GameService] Error declining rematch: ${error.message}`);
      throw error;
    }

    return this.mapGameFromDB(updatedGame);
  }
}
