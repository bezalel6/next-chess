import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { Chess } from 'chess.ts';
import type { Square, PartialMove } from 'chess.ts/dist/types';
import type { Game, PlayerColor } from '@/types/game';

// ============= Types =============
export type GameMode = 'online' | 'local' | 'spectator';
export type GamePhase = 'waiting_for_ban' | 'selecting_ban' | 'waiting_for_move' | 'making_move' | 'game_over';

interface BannedMove {
  from: Square;
  to: Square;
  byPlayer: PlayerColor;
  atMoveNumber: number;
}

interface MoveRecord {
  from: Square;
  to: Square;
  san: string;
  fen: string;
  ply: number;
  bannedMove?: BannedMove;
}

// ============= Store Slices =============

interface GameSlice {
  // Core game data
  gameId: string | null;
  mode: GameMode;
  game: Game | null;
  chess: Chess | null;
  myColor: PlayerColor | null;
  
  // Game state
  currentFen: string;
  phase: GamePhase;
  currentTurn: PlayerColor;
  currentBannedMove: { from: Square; to: Square } | null;
  
  // History
  moveHistory: MoveRecord[];
  banHistory: BannedMove[];
  
  // Computed values
  isMyTurn: () => boolean;
  canMove: () => boolean;
  canBan: () => boolean;
  getLegalMoves: () => Map<string, string[]>;
  getPossibleBans: () => Array<{ from: Square; to: Square }>;
  isMoveBanned: (from: Square, to: Square) => boolean;
}

interface UISlice {
  // Visual state
  boardOrientation: PlayerColor;
  highlightedSquares: Square[];
  hoveredSquare: Square | null;
  selectedSquare: Square | null;
  possibleMoves: Square[];
  lastMove: { from: Square; to: Square } | null;
  
  // Animations
  isAnimating: boolean;
  pendingAnimation: { from: Square; to: Square } | null;
  
  // Modals and overlays
  showPromotionDialog: boolean;
  promotionSquare: Square | null;
  showGameOverModal: boolean;
  
  // Navigation
  viewingPly: number | null;
  navigationFen: string | null;
}

interface NetworkSlice {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  lastSyncTime: number | null;
  
  // Optimistic updates
  pendingOperation: 'move' | 'ban' | null;
  optimisticMove: { from: Square; to: Square } | null;
  optimisticBan: { from: Square; to: Square } | null;
  optimisticFen: string | null;
  
  // Sync state
  isSyncing: boolean;
  syncQueue: Array<{ type: 'move' | 'ban'; data: any }>;
}

interface LocalGameSlice {
  // Local game specific
  localCurrentPlayer: PlayerColor;
  localPhase: 'banning' | 'playing';
  localBannedMove: { from: Square; to: Square; bannedBy: PlayerColor } | null;
  localGameStatus: 'active' | 'checkmate' | 'stalemate' | 'draw';
  localWinner: PlayerColor | null;
}

// ============= Store Actions =============

interface GameActions {
  // Initialization
  initGame: (gameId: string, game: Game, myColor: PlayerColor | null) => void;
  initLocalGame: () => void;
  resetGame: () => void;
  
  // Game operations
  makeMove: (from: Square, to: Square, promotion?: string) => void;
  banMove: (from: Square, to: Square) => void;
  receiveMove: (move: MoveRecord) => void;
  receiveBan: (ban: BannedMove) => void;
  
  // State updates
  updateGame: (game: Partial<Game>) => void;
  setPhase: (phase: GamePhase) => void;
  syncWithServer: (game: Game) => void;
  
  // Local game operations
  localSelectBan: (from: Square, to: Square) => void;
  localMakeMove: (from: Square, to: Square, promotion?: string) => boolean;
}

interface UIActions {
  // Board interactions
  selectSquare: (square: Square | null) => void;
  hoverSquare: (square: Square | null) => void;
  highlightSquares: (squares: Square[]) => void;
  clearHighlights: () => void;
  
  // Animations
  setAnimating: (animating: boolean) => void;
  queueAnimation: (from: Square, to: Square) => void;
  
  // Navigation
  navigateToMove: (ply: number) => void;
  navigateToCurrent: () => void;
  
  // UI state
  flipBoard: () => void;
  showPromotion: (square: Square) => void;
  hidePromotion: () => void;
  setGameOverModal: (show: boolean) => void;
}

interface NetworkActions {
  // Connection management
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  
  // Optimistic updates
  startOptimisticUpdate: (type: 'move' | 'ban', data: any) => void;
  confirmOptimisticUpdate: () => void;
  rollbackOptimisticUpdate: () => void;
  
  // Sync operations
  queueOperation: (type: 'move' | 'ban', data: any) => void;
  processSyncQueue: () => void;
  markSynced: () => void;
}

// ============= Unified Store =============

export interface UnifiedGameStore extends GameSlice, UISlice, NetworkSlice, LocalGameSlice, GameActions, UIActions, NetworkActions {}

const initialState = {
  // Game slice
  gameId: null,
  mode: 'online' as GameMode,
  game: null,
  chess: null,
  myColor: null,
  currentFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  phase: 'waiting_for_move' as GamePhase,
  currentTurn: 'white' as PlayerColor,
  currentBannedMove: null,
  moveHistory: [],
  banHistory: [],
  
  // UI slice
  boardOrientation: 'white' as PlayerColor,
  highlightedSquares: [],
  hoveredSquare: null,
  selectedSquare: null,
  possibleMoves: [],
  lastMove: null,
  isAnimating: false,
  pendingAnimation: null,
  showPromotionDialog: false,
  promotionSquare: null,
  showGameOverModal: false,
  viewingPly: null,
  navigationFen: null,
  
  // Network slice
  isConnected: true,
  connectionError: null,
  lastSyncTime: null,
  pendingOperation: null,
  optimisticMove: null,
  optimisticBan: null,
  optimisticFen: null,
  isSyncing: false,
  syncQueue: [],
  
  // Local game slice
  localCurrentPlayer: 'white' as PlayerColor,
  localPhase: 'banning' as 'banning' | 'playing',
  localBannedMove: null,
  localGameStatus: 'active' as 'active' | 'checkmate' | 'stalemate' | 'draw',
  localWinner: null,
};

export const useUnifiedGameStore = create<UnifiedGameStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
        ...initialState,
        
        // ============= Computed Values =============
        
        isMyTurn: () => {
          const state = get();
          if (state.mode === 'local') return true;
          if (state.mode === 'spectator') return false;
          return state.game?.turn === state.myColor && state.game?.status === 'active';
        },
        
        canMove: () => {
          const state = get();
          if (state.mode === 'local') {
            return state.localPhase === 'playing' && state.localGameStatus === 'active';
          }
          return state.phase === 'making_move' && state.isMyTurn();
        },
        
        canBan: () => {
          const state = get();
          if (state.mode === 'local') {
            return state.localPhase === 'banning' && state.localGameStatus === 'active';
          }
          return state.phase === 'selecting_ban';
        },
        
        getLegalMoves: () => {
          const state = get();
          const moves = new Map<string, string[]>();
          
          if (!state.chess) return moves;
          
          const allMoves = state.chess.moves({ verbose: true });
          const bannedMove = state.mode === 'local' ? state.localBannedMove : state.currentBannedMove;
          
          allMoves.forEach((move) => {
            // Skip banned moves
            if (bannedMove && move.from === bannedMove.from && move.to === bannedMove.to) {
              return;
            }
            
            const from = move.from;
            const to = move.to;
            const dests = moves.get(from) || [];
            moves.set(from, [...dests, to]);
          });
          
          return moves;
        },
        
        getPossibleBans: () => {
          const state = get();
          if (!state.chess) return [];
          
          return state.chess.moves({ verbose: true }).map(move => ({
            from: move.from as Square,
            to: move.to as Square,
          }));
        },
        
        isMoveBanned: (from: Square, to: Square) => {
          const state = get();
          const bannedMove = state.mode === 'local' ? state.localBannedMove : state.currentBannedMove;
          return bannedMove?.from === from && bannedMove?.to === to;
        },
        
        // ============= Game Actions =============
        
        initGame: (gameId, game, myColor) => {
          const chess = new Chess(game.currentFen);
          set({
            gameId,
            game,
            chess,
            myColor,
            mode: myColor ? 'online' : 'spectator',
            currentFen: game.currentFen,
            currentTurn: game.turn,
            currentBannedMove: game.currentBannedMove,
            
            // Set phase based on game state
            phase: game.status === 'finished' ? 'game_over' :
                   game.banningPlayer === myColor ? 'selecting_ban' :
                   game.banningPlayer ? 'waiting_for_ban' :
                   game.turn === myColor ? 'making_move' : 'waiting_for_move',
            
            // Set board orientation
            boardOrientation: myColor || 'white',
          });
        },
        
        initLocalGame: () => {
          const chess = new Chess();
          set({
            mode: 'local',
            chess,
            currentFen: chess.fen(),
            localCurrentPlayer: 'white',
            localPhase: 'banning',
            localBannedMove: null,
            localGameStatus: 'active',
            localWinner: null,
            moveHistory: [],
            banHistory: [],
          });
        },
        
        resetGame: () => {
          set(initialState);
        },
        
        makeMove: (from, to, promotion) => {
          const state = get();
          if (!state.chess) return;
          
          // Apply move to chess instance
          const move = state.chess.move({ from, to, promotion: promotion as any });
          if (!move) return;
          
          const newFen = state.chess.fen();
          const newMoveHistory = [...state.moveHistory, {
            from,
            to,
            san: move.san,
            fen: newFen,
            ply: state.moveHistory.length,
            bannedMove: state.currentBannedMove ? {
              ...state.currentBannedMove,
              byPlayer: (state.currentTurn === 'white' ? 'black' : 'white') as PlayerColor,
              atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
            } : undefined,
          }];
          
          set({
            currentFen: newFen,
            lastMove: { from, to },
            moveHistory: newMoveHistory,
            currentTurn: state.currentTurn === 'white' ? 'black' : 'white',
            currentBannedMove: null,
            
            // Set optimistic state for online games
            ...(state.mode === 'online' ? {
              optimisticMove: { from, to },
              optimisticFen: newFen,
              pendingOperation: 'move' as const,
              phase: 'selecting_ban' as const,
            } : {}),
          });
        },
        
        banMove: (from, to) => {
          const state = get();
          const bannedBy = (state.mode === 'local' 
            ? (state.localCurrentPlayer === 'white' ? 'black' : 'white')
            : (state.currentTurn === 'white' ? 'black' : 'white')) as PlayerColor;
          
          const newBanHistory = [...state.banHistory, {
            from,
            to,
            byPlayer: bannedBy,
            atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
          }];
          
          set({
            currentBannedMove: { from, to },
            banHistory: newBanHistory,
            
            // Update phase and mode-specific state
            ...(state.mode === 'online' ? {
              optimisticBan: { from, to },
              pendingOperation: 'ban' as const,
              phase: (state.currentTurn === state.myColor ? 'making_move' : 'waiting_for_move') as GamePhase,
            } : state.mode === 'local' ? {
              localBannedMove: { from, to, bannedBy },
              localPhase: 'playing' as const,
            } : {}),
          });
        },
        
        receiveMove: (move) => {
          const state = get();
          if (!state.chess) return;
          
          // Apply the move
          state.chess.load(move.fen);
          const newTurn = state.chess.turn() === 'w' ? 'white' : 'black';
          
          set({
            currentFen: move.fen,
            moveHistory: [...state.moveHistory, move],
            lastMove: { from: move.from, to: move.to },
            currentTurn: newTurn,
            
            // Clear optimistic state if this confirms our move
            ...(state.optimisticMove?.from === move.from && state.optimisticMove?.to === move.to ? {
              optimisticMove: null,
              optimisticFen: null,
              pendingOperation: null,
            } : {}),
          });
        },
        
        receiveBan: (ban) => {
          const state = get();
          set({
            currentBannedMove: { from: ban.from, to: ban.to },
            banHistory: [...state.banHistory, ban],
            
            // Clear optimistic state if this confirms our ban
            ...(state.optimisticBan?.from === ban.from && state.optimisticBan?.to === ban.to ? {
              optimisticBan: null,
              pendingOperation: null,
            } : {}),
          });
        },
        
        updateGame: (gameUpdate) => {
          const state = get();
          if (state.game) {
            set({ game: { ...state.game, ...gameUpdate } });
          }
        },
        
        setPhase: (phase) => set({ phase }),
        
        syncWithServer: (game) => {
          const state = get();
          if (state.chess) {
            state.chess.load(game.currentFen);
          }
          
          // Determine phase based on server state
          const phase = game.status === 'finished' ? 'game_over' :
                       game.banningPlayer === state.myColor ? 'selecting_ban' :
                       game.banningPlayer ? 'waiting_for_ban' :
                       game.turn === state.myColor ? 'making_move' : 'waiting_for_move';
          
          set({
            game,
            currentFen: game.currentFen,
            currentTurn: game.turn,
            currentBannedMove: game.currentBannedMove,
            phase,
            lastSyncTime: Date.now(),
          });
        },
        
        // ============= Local Game Actions =============
        
        localSelectBan: (from, to) => {
          const state = get();
          const bannedBy = state.localCurrentPlayer === 'white' ? 'black' : 'white';
          set({
            localBannedMove: { from, to, bannedBy },
            localPhase: 'playing',
          });
        },
        
        localMakeMove: (from, to, promotion) => {
          const state = get();
          if (!state.chess || state.localPhase !== 'playing') return false;
          
          // Check if move is banned
          if (state.localBannedMove && 
              state.localBannedMove.from === from && 
              state.localBannedMove.to === to) {
            return false;
          }
          
          // Try to make the move
          const move = state.chess.move({ from, to, promotion: promotion as any });
          if (!move) return false;
          
          const newFen = state.chess!.fen();
          const newMoveHistory = [...state.moveHistory, {
            from,
            to,
            san: move.san,
            fen: newFen,
            ply: state.moveHistory.length,
            bannedMove: state.localBannedMove ? {
              from: state.localBannedMove.from,
              to: state.localBannedMove.to,
              byPlayer: state.localBannedMove.bannedBy,
              atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
            } : undefined,
          }];
          
          // Check game status
          let updates: any = {
            currentFen: newFen,
            lastMove: { from, to },
            moveHistory: newMoveHistory,
            localCurrentPlayer: state.localCurrentPlayer === 'white' ? 'black' : 'white',
            localBannedMove: null,
          };
          
          if (state.chess!.inCheckmate()) {
            updates.localGameStatus = 'checkmate';
            updates.localWinner = state.localCurrentPlayer;
            updates.showGameOverModal = true;
            updates.localPhase = 'playing';
          } else if (state.chess!.inStalemate()) {
            updates.localGameStatus = 'stalemate';
            updates.showGameOverModal = true;
            updates.localPhase = 'playing';
          } else if (state.chess!.inDraw()) {
            updates.localGameStatus = 'draw';
            updates.showGameOverModal = true;
            updates.localPhase = 'playing';
          } else {
            updates.localPhase = 'banning';
          }
          
          set(updates);
          
          return true;
        },
        
        // ============= UI Actions =============
        
        selectSquare: (square) => {
          const state = get();
          let possibleMoves: Square[] = [];
          if (square && state.chess) {
            // Calculate possible moves from this square
            const moves = state.chess.moves({ square, verbose: true });
            possibleMoves = moves.map(m => m.to as Square);
          }
          set({ selectedSquare: square, possibleMoves });
        },
        
        hoverSquare: (square) => set({ hoveredSquare: square }),
        
        highlightSquares: (squares) => set({ highlightedSquares: squares }),
        
        clearHighlights: () => set({ 
          highlightedSquares: [],
          selectedSquare: null,
          possibleMoves: [],
        }),
        
        setAnimating: (animating) => set({ isAnimating: animating }),
        
        queueAnimation: (from, to) => set({ pendingAnimation: { from, to } }),
        
        navigateToMove: (ply) => {
          const state = get();
          if (ply < 0 || ply >= state.moveHistory.length) return;
          
          const move = state.moveHistory[ply];
          set({
            viewingPly: ply,
            navigationFen: move.fen,
          });
        },
        
        navigateToCurrent: () => set({
          viewingPly: null,
          navigationFen: null,
        }),
        
        flipBoard: () => {
          const state = get();
          set({ boardOrientation: state.boardOrientation === 'white' ? 'black' : 'white' });
        },
        
        showPromotion: (square) => set({
          showPromotionDialog: true,
          promotionSquare: square,
        }),
        
        hidePromotion: () => set({
          showPromotionDialog: false,
          promotionSquare: null,
        }),
        
        setGameOverModal: (show) => set({ showGameOverModal: show }),
        
        // ============= Network Actions =============
        
        setConnected: (connected) => set({
          isConnected: connected,
          connectionError: connected ? null : 'Connection lost',
        }),
        
        setConnectionError: (error) => set({ connectionError: error }),
        
        startOptimisticUpdate: (type, data) => set({
          pendingOperation: type,
          ...(type === 'move' ? { optimisticMove: data } : {}),
          ...(type === 'ban' ? { optimisticBan: data } : {}),
        }),
        
        confirmOptimisticUpdate: () => set({
          pendingOperation: null,
          optimisticMove: null,
          optimisticBan: null,
          optimisticFen: null,
        }),
        
        rollbackOptimisticUpdate: () => {
          const state = get();
          
          let updates: any = {
            pendingOperation: null,
            optimisticMove: null,
            optimisticBan: null,
            optimisticFen: null,
          };
          
          // Rollback optimistic changes
          if (state.optimisticMove && state.chess) {
            // Undo the last move
            state.chess.undo();
            updates.currentFen = state.chess.fen();
            updates.moveHistory = state.moveHistory.slice(0, -1);
          }
          
          if (state.optimisticBan) {
            updates.banHistory = state.banHistory.slice(0, -1);
            updates.currentBannedMove = null;
          }
          
          // Reset phase
          if (state.game) {
            if (state.game.banningPlayer === state.myColor) {
              updates.phase = 'selecting_ban';
            } else if (state.game.turn === state.myColor) {
              updates.phase = 'making_move';
            } else {
              updates.phase = 'waiting_for_move';
            }
          }
          
          set(updates);
        },
        
        queueOperation: (type, data) => {
          const state = get();
          set({ syncQueue: [...state.syncQueue, { type, data }] });
        },
        
        processSyncQueue: () => {
          const state = get();
          if (state.syncQueue.length === 0 || !state.isConnected) return;
          
          // Process queue items
          // This would trigger the actual API calls
          set({ isSyncing: true });
        },
        
        markSynced: () => set({
          lastSyncTime: Date.now(),
          isSyncing: false,
          syncQueue: [],
        }),
      })),
    {
      name: 'unified-game-store',
    }
  )
);

// ============= Selector Hooks for Performance =============

export const useGameMode = () => useUnifiedGameStore((s) => s.mode);
export const useGamePhase = () => useUnifiedGameStore((s) => s.phase);
export const useMyColor = () => useUnifiedGameStore((s) => s.myColor);
export const useCurrentTurn = () => useUnifiedGameStore((s) => s.currentTurn);
export const useCanMove = () => useUnifiedGameStore((s) => s.canMove());
export const useCanBan = () => useUnifiedGameStore((s) => s.canBan());
export const useBoardOrientation = () => useUnifiedGameStore((s) => s.boardOrientation);
export const useHighlightedSquares = () => useUnifiedGameStore((s) => s.highlightedSquares);
export const useLastMove = () => useUnifiedGameStore((s) => s.lastMove);
export const useCurrentBannedMove = () => useUnifiedGameStore((s) => s.currentBannedMove);
export const useMoveHistory = () => useUnifiedGameStore((s) => s.moveHistory);
export const useIsAnimating = () => useUnifiedGameStore((s) => s.isAnimating);
export const useGameStatus = () => useUnifiedGameStore((s) => s.game?.status);
export const useLocalGameStatus = () => useUnifiedGameStore((s) => s.localGameStatus);