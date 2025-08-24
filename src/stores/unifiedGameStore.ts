import { create } from 'zustand';
import { BanChess } from 'ban-chess.ts';
import { GameService } from '@/services/gameService';
import type { Tables } from '@/types/database';

type GameData = Tables<'games'>;

interface GameStore {
  // Core state only
  engine: BanChess | null;
  gameId: string | null;
  myColor: 'white' | 'black' | null;
  
  // Actions - minimal
  loadGame: (gameId: string, gameData: GameData | string) => void;
  playAction: (action: { ban?: { from: string; to: string }, move?: { from: string; to: string; promotion?: string } }) => Promise<void>;
  reset: () => void;
}

export const useUnifiedGameStore = create<GameStore>((set, get) => ({
  engine: null,
  gameId: null,
  myColor: null,
  
  loadGame: (gameId, gameData) => {
    // Extract FEN from game data - handle both full game object and direct FEN string
    let fen;
    if (typeof gameData === 'string') {
      // If it's already a FEN string, use it
      if (gameData.includes('/')) {
        fen = gameData;
      } else {
        // If it's a state like "waiting_for_ban", use default position
        fen = undefined; // BanChess constructor will use default
      }
    } else if (gameData && typeof gameData === 'object') {
      // If it's a game object, use current_fen field
      fen = gameData.current_fen;
    }
    
    const engine = new BanChess(fen);
    set({ gameId, engine });
  },
  
  playAction: async (action) => {
    const { gameId } = get();
    if (!gameId) return;
    
    await GameService.playAction(gameId, action);
    // State will be updated via realtime subscription
  },
  
  reset: () => {
    set({ engine: null, gameId: null, myColor: null });
  },
}));