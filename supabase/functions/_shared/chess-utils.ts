/// <reference lib="deno.ns" />
import { Chess, type PartialMove } from "chess-ts";
import type { SupabaseClient } from "supabase";

export interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  status: "active" | "finished";
  result?: "white" | "black" | "draw" | null;
  current_fen: string;
  pgn: string;
  last_move?: ChessMove;
  turn: "white" | "black";
  banningPlayer: "white" | "black" | null;
  created_at: string;
  updated_at: string;
  draw_offered_by?: string | null;
  end_reason?: string | null;
  rematch_offered_by?: string | null;
  parent_game_id?: string | null;
}

export type PlayerColor = "white" | "black";

/**
 * Verifies if a user is authorized to perform an action on a game
 */
export async function verifyGameAccess(
  supabase: SupabaseClient,
  gameId: string,
  userId: string,
  requiresTurn = false,
): Promise<{
  game: Game;
  playerColor: PlayerColor;
  authorized: boolean;
  error?: string;
}> {
  // Get the game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single<Game>();

  if (gameError || !game) {
    return {
      game: null,
      playerColor: null,
      authorized: false,
      error: `Game not found: ${gameError?.message || "Unknown error"}`,
    };
  }

  // Check if user is a player in this game
  const isWhitePlayer = game.white_player_id === userId;
  const isBlackPlayer = game.black_player_id === userId;

  if (!isWhitePlayer && !isBlackPlayer) {
    return {
      game,
      playerColor: null,
      authorized: false,
      error: "User is not a player in this game",
    };
  }

  const playerColor = isWhitePlayer ? "white" : "black";

  // If this operation requires it to be the player's turn
  if (requiresTurn && game.turn !== playerColor) {
    return {
      game,
      playerColor,
      authorized: false,
      error: "Not your turn",
    };
  }

  return {
    game,
    playerColor,
    authorized: true,
  };
}

/**
 * Validates and processes a chess move
 */
export function validateMove(
  fen: string,
  move: ChessMove,
): { valid: boolean; newFen?: string; newPgn?: string; error?: string } {
  try {
    const chess = new Chess(fen);
    const result = chess.move(move as PartialMove);

    if (!result) {
      return { valid: false, error: "Invalid move" };
    }

    return {
      valid: true,
      newFen: chess.fen(),
      newPgn: chess.pgn(),
    };
  } catch (error) {
    return {
      valid: false,
      error: `Chess error: ${error.message}`,
    };
  }
}

/**
 * Checks if the game is over based on the current position
 */
export function isGameOver(fen: string): {
  isOver: boolean;
  result?: "white" | "black" | "draw" | null;
  reason?: string;
} {
  const chess = new Chess(fen);

  // Check for checkmate
  if (chess.inCheckmate()) {
    // The side to move has lost
    const winner = chess.turn() === "w" ? "black" : "white";
    return { isOver: true, result: winner, reason: "checkmate" };
  }

  // Check for draw conditions
  if (chess.inDraw()) {
    if (chess.inStalemate()) {
      return { isOver: true, result: "draw", reason: "stalemate" };
    }
    if (chess.insufficientMaterial()) {
      return { isOver: true, result: "draw", reason: "insufficient_material" };
    }
    if (chess.inThreefoldRepetition()) {
      return { isOver: true, result: "draw", reason: "threefold_repetition" };
    }
    return { isOver: true, result: "draw", reason: "fifty_move_rule" };
  }

  return { isOver: false };
}

/**
 * Common response builder for edge functions
 */
export function buildResponse(
  data: any,
  status = 200,
  corsHeaders: HeadersInit = {},
): Response {
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  if (status >= 400) {
    return new Response(JSON.stringify({ error: data }), { status, headers });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers,
  });
}
