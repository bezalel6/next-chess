import { create } from 'zustand';
import { BanChess } from '@/lib/simple-ban-chess';
import { GameService } from '@/services/gameService';

interface GameStore {
  // Core state only
  engine: BanChess | null;
  gameId: string | null;
  myColor: 'white' | 'black' | null;
  
  // Actions - minimal
  loadGame: (gameId: string, state: string) => void;
  playAction: (action: any) => Promise<void>;
  reset: () => void;
}

export const useUnifiedGameStore = create<GameStore>((set, get) => ({
  engine: null,
  gameId: null,
  myColor: null,
  
  loadGame: (gameId, state) => {
    const engine = new BanChess(state);
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