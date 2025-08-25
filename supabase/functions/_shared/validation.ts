import { User } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface GameRecord {
  id: string;
  white_player_id: string;
  black_player_id: string;
  banning_player: string | null;
  turn: string;
  status: string;
}

interface GameAction {
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
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  playerColor?: "white" | "black";
}

export function validateGameAction(
  game: GameRecord,
  user: User,
  action: GameAction
): ValidationResult {
    // Check if user is a player in this game
    const isWhitePlayer = user.id === game.white_player_id;
    const isBlackPlayer = user.id === game.black_player_id;
    
    if (!isWhitePlayer && !isBlackPlayer) {
      return { valid: false, error: 'Not a player in this game' };
    }
    
    const playerColor: "white" | "black" = isWhitePlayer ? 'white' : 'black';
    
    if (action.ban) {
      if (game.banning_player !== playerColor) {
        return { valid: false, error: 'Not your turn to ban' };
      }
    } else if (action.move) {
      if (game.turn !== playerColor) {
        return { valid: false, error: 'Not your turn to move' };
      }
    }

    return { valid: true, playerColor };
}
