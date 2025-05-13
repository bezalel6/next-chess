/// <reference lib="deno.ns" />
import { corsHeaders } from "./auth-utils.ts";
import { Chess } from "chess-ts";
import {
  verifyGameAccess,
  validateMove,
  isGameOver,
  buildResponse,
  type ChessMove,
  type PlayerColor,
  type Game,
} from "./chess-utils.ts";

/**
 * Handles making a move in a chess game
 */
export async function handleMakeMove(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  const { gameId, move } = params;

  if (!gameId || !move) {
    return buildResponse(
      "Missing required parameters: gameId or move",
      400,
      corsHeaders,
    );
  }

  // Verify game access - must be player's turn
  const { game, playerColor, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
    true, // requires turn
  );

  if (!authorized) {
    return buildResponse(error, 403, corsHeaders);
  }

  // Validate the move using chess rules
  const moveResult = validateMove(game.current_fen, move);
  if (!moveResult.valid) {
    return buildResponse(moveResult.error, 400, corsHeaders);
  }

  // Check game over conditions
  const gameOverState = isGameOver(moveResult.newFen);
  const status = gameOverState.isOver ? "finished" : "active";

  // Update the game with the new state
  const { data: updatedGame, error: updateError } = await supabase
    .from("games")
    .update({
      current_fen: moveResult.newFen,
      pgn: moveResult.newPgn,
      last_move: move,
      turn: playerColor === "white" ? "black" : "white",
      banningPlayer: playerColor,
      status,
      result: gameOverState.result,
      end_reason: gameOverState.reason,
      draw_offered_by: null, // Clear any pending draw offers
    })
    .eq("id", gameId)
    .select()
    .single();

  if (updateError) {
    return buildResponse(
      `Failed to update game: ${updateError.message}`,
      500,
      corsHeaders,
    );
  }

  // Record the move in move history
  await supabase.from("moves").insert({
    game_id: gameId,
    move,
    created_by: user.id,
    position_fen: moveResult.newFen,
  });

  return buildResponse(updatedGame, 200, corsHeaders);
}

/**
 * Handles banning a move in a chess game
 */
export async function handleBanMove(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  const { gameId, move } = params;

  if (!gameId || !move) {
    return buildResponse(
      "Missing required parameters: gameId or move",
      400,
      corsHeaders,
    );
  }

  // Verify game access - must be the banning player's turn
  const { game, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
  );

  if (!authorized) {
    return buildResponse(error, 403, corsHeaders);
  }

  // Check if this player is allowed to ban
  if (
    game.banningPlayer !==
    (game.white_player_id === user.id ? "white" : "black")
  ) {
    return buildResponse(
      "You don't have permission to ban a move at this time",
      403,
      corsHeaders,
    );
  }

  // Parse the existing PGN and add the banned move as a comment
  const chess = new Chess(game.current_fen);
  if (game.pgn) {
    chess.loadPgn(game.pgn);
  }
  chess.setComment(`banning: ${move.from}${move.to}`);

  // Check game over conditions
  const gameOverState = isGameOver(game.current_fen);
  const status = gameOverState.isOver ? "finished" : "active";

  // Update the game
  const { data: updatedGame, error: updateError } = await supabase
    .from("games")
    .update({
      banningPlayer: null,
      pgn: chess.pgn(),
      status,
      result: gameOverState.result,
      end_reason: gameOverState.reason,
    })
    .eq("id", gameId)
    .select()
    .single();

  if (updateError) {
    return buildResponse(
      `Failed to update game: ${updateError.message}`,
      500,
      corsHeaders,
    );
  }

  return buildResponse(updatedGame, 200, corsHeaders);
}

/**
 * Handles game offers (draw/rematch)
 */
export async function handleGameOffer(
  user: any,
  params: any,
  supabase: any,
  offerType: "draw" | "rematch",
  action: "offer" | "accept" | "decline",
): Promise<Response> {
  const { gameId, playerColor } = params;

  if (!gameId) {
    return buildResponse("Missing gameId parameter", 400, corsHeaders);
  }

  // Verify game access
  const { game, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
  );

  if (!authorized) {
    return buildResponse(error, 403, corsHeaders);
  }

  const userColor = game.white_player_id === user.id ? "white" : "black";
  const field = `${offerType}_offered_by`;

  // Handle offering
  if (action === "offer") {
    const { data: updatedGame, error: updateError } = await supabase
      .from("games")
      .update({ [field]: userColor })
      .eq("id", gameId)
      .select()
      .single();

    if (updateError) {
      return buildResponse(
        `Failed to offer ${offerType}: ${updateError.message}`,
        500,
        corsHeaders,
      );
    }

    return buildResponse(updatedGame, 200, corsHeaders);
  }

  // Handle declining
  if (action === "decline") {
    const { data: updatedGame, error: updateError } = await supabase
      .from("games")
      .update({ [field]: null })
      .eq("id", gameId)
      .select()
      .single();

    if (updateError) {
      return buildResponse(
        `Failed to decline ${offerType}: ${updateError.message}`,
        500,
        corsHeaders,
      );
    }

    return buildResponse(updatedGame, 200, corsHeaders);
  }

  // Handle accepting
  if (action === "accept") {
    if (offerType === "draw") {
      const { data: updatedGame, error: updateError } = await supabase
        .from("games")
        .update({
          status: "finished",
          result: "draw",
          [field]: null,
          end_reason: "draw_agreement",
        })
        .eq("id", gameId)
        .select()
        .single();

      if (updateError) {
        return buildResponse(
          `Failed to accept draw: ${updateError.message}`,
          500,
          corsHeaders,
        );
      }

      return buildResponse(updatedGame, 200, corsHeaders);
    }

    if (offerType === "rematch") {
      // Create a new game with swapped colors
      const { data: newGame, error: createError } = await supabase
        .from("games")
        .insert({
          white_player_id: game.black_player_id, // Swap colors
          black_player_id: game.white_player_id, // Swap colors
          status: "active",
          current_fen:
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          pgn: "",
          turn: "white",
          banningPlayer: "black",
          parent_game_id: gameId,
        })
        .select()
        .single();

      if (createError) {
        return buildResponse(
          `Failed to create rematch game: ${createError.message}`,
          500,
          corsHeaders,
        );
      }

      // Clear the rematch offer from the original game
      await supabase
        .from("games")
        .update({ [field]: null })
        .eq("id", gameId);

      return buildResponse(newGame, 200, corsHeaders);
    }
  }

  return buildResponse(
    `Invalid action ${action} for ${offerType}`,
    400,
    corsHeaders,
  );
}

/**
 * Handles game resignation
 */
export async function handleResignation(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  const { gameId } = params;

  if (!gameId) {
    return buildResponse("Missing gameId parameter", 400, corsHeaders);
  }

  // Verify game access
  const { game, playerColor, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
  );

  if (!authorized) {
    return buildResponse(error, 403, corsHeaders);
  }

  // When a player resigns, the opponent wins
  const result = playerColor === "white" ? "black" : "white";

  const { data: updatedGame, error: updateError } = await supabase
    .from("games")
    .update({
      status: "finished",
      result,
      end_reason: "resignation",
    })
    .eq("id", gameId)
    .select()
    .single();

  if (updateError) {
    return buildResponse(
      `Failed to resign game: ${updateError.message}`,
      500,
      corsHeaders,
    );
  }

  return buildResponse(updatedGame, 200, corsHeaders);
}

/**
 * Special mushroom growth transformation handler
 */
export async function handleMushroomGrowth(
  user: any,
  params: any,
  supabase: any,
): Promise<Response> {
  const { gameId } = params;

  if (!gameId) {
    return buildResponse("Missing gameId parameter", 400, corsHeaders);
  }

  // Verify game access - must be player's turn
  const { game, playerColor, authorized, error } = await verifyGameAccess(
    supabase,
    gameId,
    user.id,
    true, // requires turn
  );

  if (!authorized) {
    return buildResponse(error, 403, corsHeaders);
  }

  // Implement mushroom transformation (pawns to queens)
  const chess = new Chess(game.current_fen);
  let fen = chess.fen();

  // Transform pawns to queens for the current player
  if (playerColor === "white") {
    fen = fen.replace(/P/g, "Q");
  } else {
    fen = fen.replace(/p/g, "q");
  }

  // Set the custom position and create a new PGN
  chess.load(fen);
  const newPgn = `[SetUp "1"]\n[FEN "${fen}"]`;

  // Update the game with the mushroom transformation
  const { data: updatedGame, error: updateError } = await supabase
    .from("games")
    .update({
      current_fen: fen,
      pgn: newPgn,
    })
    .eq("id", gameId)
    .select()
    .single();

  if (updateError) {
    return buildResponse(
      `Failed to apply mushroom transformation: ${updateError.message}`,
      500,
      corsHeaders,
    );
  }

  return buildResponse(updatedGame, 200, corsHeaders);
}
