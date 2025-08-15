import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './AuthContext';
import { useGame as useGameHook } from '@/hooks/useGameQueries';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useChessSounds } from '@/hooks/useChessSounds';
import type { Square } from 'chess.ts/dist/types';

// Simple context that provides the game hook to children
interface GameContextType {
  gameId?: string;
  isLocalGame: boolean;
}

const GameContext = createContext<GameContextType>({
  gameId: undefined,
  isLocalGame: false,
});

export function GameProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const { playGameStart } = useChessSounds();
  
  const gameId = router.query.id as string | undefined;
  const isLocalGame = router.pathname === '/local-game';
  
  // Initialize local game
  useEffect(() => {
    if (isLocalGame) {
      const store = useUnifiedGameStore.getState();
      if (store.mode !== 'local') {
        store.initLocalGame();
        playGameStart();
      }
    }
  }, [isLocalGame, playGameStart]);
  
  // Initialize online game (handled by useGameHook)
  if (gameId && !isLocalGame) {
    useGameHook(gameId, user?.id);
  }
  
  return (
    <GameContext.Provider value={{ gameId, isLocalGame }}>
      {children}
    </GameContext.Provider>
  );
}

// Export a simplified useGame hook that components can use
export function useGame() {
  const context = useContext(GameContext);
  const { user } = useAuth();
  
  // Get the game hook if online
  const gameHook = context.gameId ? useGameHook(context.gameId, user?.id) : null;
  
  // Get store values
  const store = useUnifiedGameStore();
  
  if (context.isLocalGame) {
    // Return local game interface
    return {
      game: null,
      isLoading: false,
      error: null,
      
      mode: 'local' as const,
      myColor: store.localCurrentPlayer,
      phase: store.localPhase === 'banning' ? 'selecting_ban' : 'making_move',
      canMove: store.localPhase === 'playing',
      canBan: store.localPhase === 'banning',
      isMyTurn: true,
      
      currentBannedMove: store.localBannedMove,
      moveHistory: store.moveHistory,
      highlightedSquares: store.highlightedSquares,
      
      makeMove: (from: string, to: string, promotion?: string) => {
        store.localMakeMove(from as any, to as any, promotion);
      },
      banMove: (from: string, to: string) => {
        store.localSelectBan(from as any, to as any);
      },
      
      // UI Actions
      setHighlightedSquares: store.highlightSquares,
      clearHighlights: store.clearHighlights,
      previewBan: (from: any, to: any) => store.highlightSquares([from, to]),
      previewMove: (from: any, to: any) => store.highlightSquares([from, to]),
      startBanSelection: (moves: any[]) => {
        const squares = moves.map(m => m.from);
        store.highlightSquares(squares);
      },
      
      // Not applicable for local games
      resign: () => {},
      offerDraw: () => {},
      acceptDraw: () => {},
      declineDraw: () => {},
    };
  }
  
  // Return online game interface
  if (gameHook) {
    return {
      ...gameHook,
      
      currentBannedMove: store.currentBannedMove,
      moveHistory: store.moveHistory,
      highlightedSquares: store.highlightedSquares,
      
      // UI Actions
      setHighlightedSquares: store.highlightSquares,
      clearHighlights: store.clearHighlights,
      previewBan: (from: any, to: any) => store.highlightSquares([from, to]),
      previewMove: (from: any, to: any) => store.highlightSquares([from, to]),
      startBanSelection: (moves: any[]) => {
        const squares = moves.map(m => m.from);
        store.highlightSquares(squares);
      },
    };
  }
  
  // No game loaded
  return {
    game: null,
    isLoading: false,
    error: null,
    mode: 'spectator' as const,
    myColor: null,
    phase: 'waiting_for_move' as const,
    canMove: false,
    canBan: false,
    isMyTurn: false,
    currentBannedMove: null,
    moveHistory: [],
    highlightedSquares: [],
    makeMove: () => {},
    banMove: () => {},
    setHighlightedSquares: () => {},
    clearHighlights: () => {},
    previewBan: () => {},
    previewMove: () => {},
    startBanSelection: () => {},
    resign: () => {},
    offerDraw: () => {},
    acceptDraw: () => {},
    declineDraw: () => {},
  };
}