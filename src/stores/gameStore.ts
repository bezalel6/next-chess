import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Chess } from 'chess.ts';
import type { Square } from 'chess.ts/dist/types';

export type GamePhase = 'waiting_for_ban' | 'selecting_ban' | 'waiting_for_move' | 'making_move' | 'game_over';

export interface BannedMove {
  from: Square;
  to: Square;
  byPlayer: 'white' | 'black';
  atMoveNumber: number;
}

interface GameStore {
  // Core game state
  gameId: string | null;
  phase: GamePhase;
  myColor: 'white' | 'black' | null;
  
  // Current turn state
  currentTurn: 'white' | 'black';
  currentBannedMove: { from: Square; to: Square } | null;
  
  // History
  banHistory: BannedMove[];
  moveHistory: Array<{ from: Square; to: Square; san: string }>;
  
  // UI state for smooth interactions
  highlightedSquares: Square[];
  possibleBans: Array<{ from: Square; to: Square }>;
  isAnimating: boolean;
  
  // Optimistic updates
  optimisticMove: { from: Square; to: Square } | null;
  optimisticBan: { from: Square; to: Square } | null;
  
  // Navigation state for move history
  viewingPly: number | null; // null means viewing current position
  navigationFen: string | null; // FEN of the position being viewed
  navigationBan: { from: Square; to: Square } | null; // Banned move at viewed position
  
  // Previous state for rollback
  previousState: {
    phase: GamePhase;
    currentBannedMove: { from: Square; to: Square } | null;
    banHistory: BannedMove[];
    moveHistory: Array<{ from: Square; to: Square; san: string }>;
  } | null;
  
  // Actions
  setGameId: (id: string) => void;
  setPhase: (phase: GamePhase) => void;
  setMyColor: (color: 'white' | 'black' | null) => void;
  
  // Ban actions
  startBanSelection: (possibleMoves: Array<{ from: Square; to: Square }>) => void;
  previewBan: (from: Square, to: Square) => void;
  confirmBan: (from: Square, to: Square) => void;
  receiveBan: (from: Square, to: Square, byPlayer: 'white' | 'black') => void;
  
  // Move actions
  previewMove: (from: Square, to: Square) => void;
  confirmMove: (from: Square, to: Square) => void;
  receiveMove: (from: Square, to: Square, san: string) => void;
  
  // UI helpers
  setHighlightedSquares: (squares: Square[]) => void;
  clearHighlights: () => void;
  setAnimating: (animating: boolean) => void;
  
  // Reset
  reset: () => void;
  rollback: () => void;
  saveStateForRollback: () => void;
  
  // Navigation actions
  navigateToPosition: (ply: number | null, fen: string | null, ban: { from: Square; to: Square } | null) => void;
  clearNavigation: () => void;
}

const initialState = {
  gameId: null,
  phase: 'waiting_for_move' as GamePhase,
  myColor: null,
  currentTurn: 'white' as const,
  currentBannedMove: null,
  banHistory: [],
  moveHistory: [],
  highlightedSquares: [],
  possibleBans: [],
  isAnimating: false,
  optimisticMove: null,
  optimisticBan: null,
  previousState: null,
  viewingPly: null,
  navigationFen: null,
  navigationBan: null,
};

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    setGameId: (id) => set({ gameId: id }),
    setPhase: (phase) => set({ phase }),
    setMyColor: (color) => set({ myColor: color }),
    
    startBanSelection: (possibleMoves) => {
      set({ 
        phase: 'selecting_ban',
        possibleBans: possibleMoves,
        highlightedSquares: possibleMoves.map(m => m.from),
      });
    },
    
    previewBan: (from, to) => {
      set({ 
        highlightedSquares: [from, to],
        optimisticBan: { from, to },
      });
    },
    
    confirmBan: (from, to) => {
      const { currentTurn, banHistory } = get();
      const byPlayer = currentTurn === 'white' ? 'black' : 'white'; // Opponent bans
      
      set({
        optimisticBan: { from, to },
        phase: 'waiting_for_move',
        isAnimating: true,
      });
      
      // Animation will complete and clear optimistic state
      setTimeout(() => {
        set({ 
          currentBannedMove: { from, to },
          banHistory: [...banHistory, { 
            from, 
            to, 
            byPlayer,
            atMoveNumber: Math.floor(banHistory.length / 2) + 1,
          }],
          optimisticBan: null,
          isAnimating: false,
          highlightedSquares: [],
        });
      }, 300);
    },
    
    receiveBan: (from, to, byPlayer) => {
      const { banHistory } = get();
      
      set({
        currentBannedMove: { from, to },
        banHistory: [...banHistory, {
          from,
          to,
          byPlayer,
          atMoveNumber: Math.floor(banHistory.length / 2) + 1,
        }],
        phase: get().myColor === get().currentTurn ? 'making_move' : 'waiting_for_move',
        highlightedSquares: [],
      });
    },
    
    previewMove: (from, to) => {
      set({
        highlightedSquares: [from, to],
        optimisticMove: { from, to },
      });
    },
    
    confirmMove: (from, to) => {
      set({
        optimisticMove: { from, to },
        phase: 'waiting_for_ban',
        isAnimating: true,
      });
      
      setTimeout(() => {
        set({
          optimisticMove: null,
          isAnimating: false,
        });
      }, 300);
    },
    
    receiveMove: (from, to, san) => {
      const { moveHistory, currentTurn } = get();
      
      set({
        moveHistory: [...moveHistory, { from, to, san }],
        currentTurn: currentTurn === 'white' ? 'black' : 'white',
        currentBannedMove: null, // Clear ban for next turn
        phase: get().myColor === (currentTurn === 'white' ? 'black' : 'white') 
          ? 'selecting_ban' 
          : 'waiting_for_ban',
        highlightedSquares: [],
      });
    },
    
    setHighlightedSquares: (squares) => set({ highlightedSquares: squares }),
    clearHighlights: () => set({ highlightedSquares: [] }),
    setAnimating: (animating) => set({ isAnimating: animating }),
    
    reset: () => set(initialState),
    
    saveStateForRollback: () => {
      const { phase, currentBannedMove, banHistory, moveHistory } = get();
      set({
        previousState: {
          phase,
          currentBannedMove,
          banHistory: [...banHistory],
          moveHistory: [...moveHistory],
        }
      });
    },
    
    rollback: () => {
      const { previousState } = get();
      if (previousState) {
        set({
          phase: previousState.phase,
          currentBannedMove: previousState.currentBannedMove,
          banHistory: previousState.banHistory,
          moveHistory: previousState.moveHistory,
          optimisticMove: null,
          optimisticBan: null,
          highlightedSquares: [],
          isAnimating: false,
        });
      }
    },
    
    navigateToPosition: (ply, fen, ban) => {
      set({
        viewingPly: ply,
        navigationFen: fen,
        navigationBan: ban,
      });
    },
    
    clearNavigation: () => {
      set({
        viewingPly: null,
        navigationFen: null,
        navigationBan: null,
      });
    },
  }))
);