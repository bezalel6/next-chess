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
  loading: boolean;
  
  // Player info
  playerUsernames: { white: string; black: string };
  
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
  previewMove: { from: Square; to: Square } | null;
  previewBan: { from: Square; to: Square } | null;
  
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

// Local game slice removed - using unified state only

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
  setPgn: (pgn: string) => void;
  setLoading: (loading: boolean) => void;
  
  // Unified game operations (works for both local and online)
  executeGameOperation: (operation: 'move' | 'ban', from: Square, to: Square, promotion?: string) => boolean;
  executeBan: (from: Square, to: Square) => boolean;
  executeMove: (from: Square, to: Square, promotion?: string) => boolean;
  isOperationValid: (operation: 'move' | 'ban', from: Square, to: Square) => boolean;
  getPossibleOperations: (operation: 'move' | 'ban') => Array<{ from: Square; to: Square; san?: string }>;
  getBoardState: () => { fen: string; legalMoves: Map<string, string[]>; bannedMove: { from: Square; to: Square } | null };
  handleSquareClick: (from: Square, to?: Square) => boolean;
  getGameStatusMessage: () => string;
  advancePhase: () => void;
  
  // Test utilities
  setupTestPosition: (fen: string) => void;
  
  // Game actions (resign, draw, etc)
  actions: {
    resign: () => void;
    offerDraw: () => void;
    acceptDraw: () => void;
    declineDraw: () => void;
    offerRematch: () => void;
    acceptRematch: () => void;
    declineRematch: () => void;
    resetGame: () => void;
    startLocalGame: () => void;
    flipBoardOrientation: () => void;
  };
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

export interface UnifiedGameStore extends GameSlice, UISlice, NetworkSlice, GameActions, UIActions, NetworkActions {}

const initialState = {
  // Game slice
  gameId: null,
  mode: 'online' as GameMode,
  game: null,
  chess: null,
  myColor: null,
  loading: false,
  playerUsernames: { white: 'White', black: 'Black' },
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
  previewMove: null,
  previewBan: null,
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
  
  // Unified state - no more local duplicates
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
            return state.phase === 'making_move' && state.game?.status === 'active';
          }
          // Don't call isMyTurn() here to avoid circular dependency
          const isMyTurn = state.mode !== 'spectator' && 
                          state.game?.turn === state.myColor && 
                          state.game?.status === 'active';
          return state.phase === 'making_move' && isMyTurn;
        },
        
        canBan: () => {
          const state = get();
          return state.phase === 'selecting_ban' && state.game?.status === 'active';
        },
        
        getLegalMoves: () => {
          const state = get();
          const moves = new Map<string, string[]>();
          
          if (!state.chess) return moves;
          
          const allMoves = state.chess.moves({ verbose: true });
          const bannedMove = state.currentBannedMove;
          
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
          return state.currentBannedMove?.from === from && state.currentBannedMove?.to === to;
        },
        
        // ============= Game Actions =============
        
        initGame: (gameId, game, myColor) => {
          if (!game || !game.currentFen) {
            console.error('Invalid game data received:', game);
            return;
          }
          
          const chess = new Chess(game.currentFen);
          
          // Extract player usernames
          const playerUsernames = {
            white: game.whitePlayer || 'White',
            black: game.blackPlayer || 'Black',
          };
          
          set({
            gameId,
            game,
            chess,
            myColor,
            loading: false,
            playerUsernames,
            mode: myColor ? 'online' : 'spectator',
            currentFen: game.currentFen,
            currentTurn: game.turn || 'white',
            currentBannedMove: game.currentBannedMove || null,
            
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
          const initialFen = chess.fen();
          
          // Create a full game object that works with existing components
          const localGameObj = {
            id: 'local',
            pgn: chess.pgn(),
            currentFen: initialFen,
            status: 'active' as const,
            turn: 'white' as PlayerColor, // White's turn to move (after Black bans)
            currentBannedMove: null,
            whitePlayer: 'Player 1',
            blackPlayer: 'Player 2',
            whitePlayerId: 'local-white',
            blackPlayerId: 'local-black',
            result: null,
            lastMove: null,
            banningPlayer: 'black' as PlayerColor, // Black bans first
            drawOfferedBy: null,
            endReason: null,
            rematchOfferedBy: null,
            parentGameId: null,
            chess: chess,
            startTime: Date.now(),
            lastMoveTime: Date.now(),
          } as Game;
          
          // Reset to clean state and set up local game
          set({
            ...initialState,  // Start with clean slate
            mode: 'local',
            game: localGameObj,
            chess,
            myColor: null, // In local games, player controls both sides
            currentFen: initialFen,
            currentTurn: 'white',
            phase: 'selecting_ban' as GamePhase, // Black bans first
            currentBannedMove: null,
            moveHistory: [],
            banHistory: [],
            lastMove: null,
            selectedSquare: null,
            possibleMoves: [],
            highlightedSquares: [],
            boardOrientation: 'white',
            loading: false,
            gameId: 'local',
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
          // In Ban Chess, the player who just moved (or Black at start) is the one who bans
          // At game start, Black bans first. After moves, the player who just moved bans.
          const bannedBy = state.moveHistory.length === 0 
            ? 'black' as PlayerColor  // Black bans first at game start
            : state.currentTurn;       // Current turn player bans after their move
          
          const newBanHistory = [...state.banHistory, {
            from,
            to,
            byPlayer: bannedBy,
            atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
          }];
          
          set({
            currentBannedMove: { from, to },
            banHistory: newBanHistory,
            
            // Update phase based on mode
            ...(state.mode === 'online' ? {
              optimisticBan: { from, to },
              pendingOperation: 'ban' as const,
              phase: (state.currentTurn === state.myColor ? 'making_move' : 'waiting_for_move') as GamePhase,
            } : {
              // For local mode, just update the phase
              phase: 'making_move' as GamePhase,
            }),
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
          console.log('[Store] Receiving ban:', ban);
          
          // Determine the new phase after receiving a ban
          const newPhase = state.currentTurn === state.myColor ? 'making_move' : 'waiting_for_move';
          
          set({
            currentBannedMove: { from: ban.from, to: ban.to },
            banHistory: [...state.banHistory, ban],
            phase: newPhase,
            
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
            console.log('[Store] Updating game with:', gameUpdate);
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
        
        // ============= Additional Missing Methods =============
        
        setPgn: (pgn) => {
          const state = get();
          if (state.game) {
            set({ game: { ...state.game, pgn } });
          }
        },
        
        setLoading: (loading) => {
          set({ loading });
        },
        
        // ============= Unified Game Operations =============
        
        executeGameOperation: (operation, from, to, promotion) => {
          const state = get();
          
          // Quick validation
          if (!state.chess || !state.game || state.game.status !== 'active') return false;
          
          // Get all legal chess moves
          const legalMoves = state.chess.moves({ verbose: true });
          const moveExists = legalMoves.some(m => m.from === from && m.to === to);
          if (!moveExists) return false;
          
          if (operation === 'ban') {
            if (state.phase !== 'selecting_ban') return false;
            
            // Execute ban inline
            const bannedBy = state.currentTurn === 'white' ? 'black' : 'white';
            const newBanHistory = [...state.banHistory, {
              from,
              to,
              byPlayer: bannedBy as PlayerColor,
              atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
            }];
            
            // Update state
            set({
              currentBannedMove: { from, to },
              banHistory: newBanHistory,
              phase: 'making_move',
            });
            
            // Check for Ban Chess checkmate AFTER the ban is applied
            if (state.chess && state.game) {
              const opponentColor = state.currentTurn; // The opponent is the current turn player
              const isInCheck = state.chess.inCheck();
              const legalMoves = state.chess.moves({ verbose: true });
              
              // Filter out the banned move from legal moves
              const availableMoves = legalMoves.filter(m => 
                !(m.from === from && m.to === to)
              );
              
              let gameUpdates: any = {};
              
              if (isInCheck && availableMoves.length === 0) {
                // Ban Chess checkmate! The opponent is in check and their only legal move was banned
                gameUpdates.status = 'finished';
                gameUpdates.result = opponentColor === 'white' ? '0-1' : '1-0';
                gameUpdates.endReason = 'checkmate';
                set({ 
                  showGameOverModal: true,
                  phase: 'game_over'
                });
              }
              
              // Update game object PGN
              state.chess.setComment(`banning: ${from}${to}`);
              const updatedPgn = state.chess.pgn();
              
              // After a ban, the banningPlayer doesn't change yet - it changes after the next move
              // The current turn player will move next, then they will become the banning player
              set({
                game: { 
                  ...state.game, 
                  pgn: updatedPgn, 
                  currentBannedMove: { from, to },
                  ...gameUpdates
                }
              });
            }
            
            return true;
            
          } else {
            if (state.phase !== 'making_move') return false;
            
            // Can't make a banned move
            if (state.currentBannedMove?.from === from && state.currentBannedMove?.to === to) {
              return false;
            }
            
            // Execute move inline
            const move = state.chess.move({ from, to, promotion: promotion as any });
            if (!move) return false;
            
            const newFen = state.chess.fen();
            const newTurn = state.currentTurn === 'white' ? 'black' : 'white';
            const newMoveHistory = [...state.moveHistory, {
              from,
              to,
              san: move.san,
              fen: newFen,
              ply: state.moveHistory.length,
              bannedMove: state.currentBannedMove ? {
                from: state.currentBannedMove.from,
                to: state.currentBannedMove.to,
                byPlayer: (state.currentTurn === 'white' ? 'black' : 'white') as PlayerColor,
                atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
              } : undefined,
            }];
            
            // Check for game over (Ban Chess variant rules)
            let gameUpdates: any = {
              pgn: state.chess.pgn(),
              currentFen: newFen,
              lastMove: { from, to },
              turn: newTurn,
              banningPlayer: state.currentTurn, // The player who just moved now bans
            };
            
            // In Ban Chess, checkmate occurs when:
            // 1. King is in check
            // 2. All legal moves can be banned (only 1 legal move exists)
            // Note: The player who just moved can now ban, so we check if the opponent is mated
            
            const isInCheck = state.chess.inCheck();
            const legalMoves = state.chess.moves({ verbose: true });
            
            // In Ban Chess, we only check for immediate game over conditions
            // The "1 legal move while in check" scenario is NOT immediate checkmate
            // because the opponent needs to ban that move first
            if (legalMoves.length === 0) {
              // No legal moves at all
              if (isInCheck) {
                // Standard checkmate (shouldn't happen in Ban Chess but kept for safety)
                gameUpdates.status = 'finished';
                gameUpdates.result = state.currentTurn === 'white' ? '1-0' : '0-1';
                gameUpdates.endReason = 'checkmate';
              } else {
                // Stalemate
                gameUpdates.status = 'finished';
                gameUpdates.result = '1/2-1/2';
                gameUpdates.endReason = 'stalemate';
              }
            } else if (state.chess.inDraw()) {
              // Other draw conditions (insufficient material, threefold repetition, etc.)
              gameUpdates.status = 'finished';
              gameUpdates.result = '1/2-1/2';
              gameUpdates.endReason = 'draw';
            }
            
            // Update all state at once
            set({
              currentFen: newFen,
              lastMove: { from, to },
              moveHistory: newMoveHistory,
              currentBannedMove: null,
              currentTurn: newTurn,
              phase: gameUpdates.status === 'finished' ? 'game_over' : 'selecting_ban',
              game: { ...state.game, ...gameUpdates },
              showGameOverModal: gameUpdates.status === 'finished',
            });
            
            return true;
          }
        },
        
        executeBan: (from, to) => {
          const state = get();
          
          // In Ban Chess, the player who just moved is the one who bans
          // At game start, Black bans first (before any moves)
          let bannedBy: PlayerColor;
          if (state.moveHistory.length === 0) {
            // First ban of the game is by Black
            bannedBy = 'black';
          } else {
            // After moves, the player who just moved is the one banning
            // Since turn hasn't changed yet after the move, currentTurn is the player who just moved
            bannedBy = state.currentTurn;
          }
          
          const newBanHistory = [...state.banHistory, {
            from,
            to,
            byPlayer: bannedBy,
            atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
          }];
          
          set({
            currentBannedMove: { from, to },
            banHistory: newBanHistory,
          });
          
          console.log(`[Store] Ban set - currentBannedMove: ${JSON.stringify({ from, to })}`);
          
          // Check for Ban Chess checkmate AFTER the ban is applied
          // If the opponent is in check and the banned move was their only legal move, it's checkmate
          if (state.chess && state.game) {
            const opponentColor = state.currentTurn; // The opponent is the current turn player
            const isInCheck = state.chess.inCheck();
            const legalMoves = state.chess.moves({ verbose: true });
            
            // Filter out the banned move from legal moves
            const availableMoves = legalMoves.filter(m => 
              !(m.from === from && m.to === to)
            );
            
            let gameUpdates: any = {};
            
            if (isInCheck && availableMoves.length === 0) {
              // Ban Chess checkmate! The opponent is in check and their only legal move was banned
              gameUpdates.status = 'finished';
              gameUpdates.result = opponentColor === 'white' ? '0-1' : '1-0';
              gameUpdates.endReason = 'checkmate';
              set({ showGameOverModal: true });
            }
            
            // Update game object PGN with ban comment
            state.chess.setComment(`banning: ${from}${to}`);
            const updatedPgn = state.chess.pgn();
            set({
              game: { 
                ...state.game, 
                pgn: updatedPgn, 
                currentBannedMove: { from, to },
                ...gameUpdates
              },
              ...(gameUpdates.status === 'finished' ? { phase: 'game_over' } : {})
            });
          }
          
          // Advance phase and handle mode-specific logic
          const { advancePhase } = get();
          advancePhase();
          
          // Log the state after phase advance
          const newState = get();
          console.log(`[Store] After ban - phase: ${newState.phase}, bannedMove: ${JSON.stringify(newState.currentBannedMove)}`);
          
          // For online games, use mutation
          if (state.mode === 'online') {
            // The banMove method will handle server sync
            get().banMove(from, to);
          }
          
          return true;
        },
        
        executeMove: (from, to, promotion) => {
          const state = get();
          if (!state.chess) return false;
          
          // Try to make the move
          const move = state.chess.move({ from, to, promotion: promotion as any });
          if (!move) return false;
          
          const newFen = state.chess.fen();
          const newMoveHistory = [...state.moveHistory, {
            from,
            to,
            san: move.san,
            fen: newFen,
            ply: state.moveHistory.length,
            bannedMove: state.currentBannedMove ? {
              from: state.currentBannedMove.from,
              to: state.currentBannedMove.to,
              byPlayer: (state.currentTurn === 'white' ? 'black' : 'white') as PlayerColor,
              atMoveNumber: Math.floor(state.moveHistory.length / 2) + 1,
            } : undefined,
          }];
          
          // Update core state
          const newTurn = state.chess.turn() === 'w' ? 'white' : 'black';
          set({
            currentFen: newFen,
            currentTurn: newTurn,
            lastMove: { from, to },
            moveHistory: newMoveHistory,
            currentBannedMove: null, // Clear banned move after successful move
          });
          
          // Update game object
          if (state.game) {
            const updatedPgn = state.chess.pgn();
            let gameUpdates: any = {
              pgn: updatedPgn,
              currentFen: newFen,
              turn: newTurn,
              lastMove: { from, to },
              // After a move, the player who just moved becomes the banning player
              banningPlayer: state.currentTurn,
            };
            
            // Check for game over (Ban Chess variant rules)
            const isInCheck = state.chess.inCheck();
            const legalMoves = state.chess.moves({ verbose: true });
            
            // In Ban Chess, we only check for immediate game over conditions
            // The "1 legal move while in check" scenario is NOT immediate checkmate
            // because the opponent needs to ban that move first
            if (legalMoves.length === 0) {
              // No legal moves at all
              if (isInCheck) {
                // Standard checkmate (shouldn't happen in Ban Chess but kept for safety)
                gameUpdates.status = 'finished';
                gameUpdates.result = state.currentTurn === 'white' ? '1-0' : '0-1';
                gameUpdates.endReason = 'checkmate';
                set({ showGameOverModal: true });
              } else {
                // Stalemate
                gameUpdates.status = 'finished';
                gameUpdates.result = '1/2-1/2';
                gameUpdates.endReason = 'stalemate';
                set({ showGameOverModal: true });
              }
            } else if (state.chess.inDraw()) {
              // Other draw conditions (insufficient material, threefold repetition, etc.)
              gameUpdates.status = 'finished';
              gameUpdates.result = '1/2-1/2';
              gameUpdates.endReason = 'draw';
              set({ showGameOverModal: true });
            }
            
            set({
              game: { ...state.game, ...gameUpdates }
            });
          }
          
          // Advance phase
          const { advancePhase } = get();
          advancePhase();
          
          // For online games, use mutation
          if (state.mode === 'online') {
            get().makeMove(from, to, promotion);
          }
          
          return true;
        },
        
        isOperationValid: (operation, from, to) => {
          const state = get();
          if (!state.chess || !state.game || state.game.status !== 'active') return false;
          
          // Get all legal chess moves
          const legalMoves = state.chess.moves({ verbose: true });
          
          // Check if the operation exists in legal moves
          const moveExists = legalMoves.some(m => m.from === from && m.to === to);
          if (!moveExists) return false;
          
          if (operation === 'move') {
            // Can't make a banned move
            if (state.currentBannedMove?.from === from && state.currentBannedMove?.to === to) {
              return false;
            }
            // Must be in move phase
            if (state.phase !== 'making_move') return false;
          } else if (operation === 'ban') {
            // Must be in ban phase
            if (state.phase !== 'selecting_ban') return false;
          }
          
          return true;
        },
        
        getPossibleOperations: (operation) => {
          const state = get();
          if (!state.chess) return [];
          
          const allMoves = state.chess.moves({ verbose: true });
          
          if (operation === 'ban') {
            // All legal moves can be banned
            return allMoves.map(move => ({
              from: move.from as Square,
              to: move.to as Square,
              san: move.san,
            }));
          } else {
            // For moves, exclude banned moves
            return allMoves
              .filter(move => {
                if (state.currentBannedMove) {
                  return !(move.from === state.currentBannedMove.from && move.to === state.currentBannedMove.to);
                }
                return true;
              })
              .map(move => ({
                from: move.from as Square,
                to: move.to as Square,
                san: move.san,
              }));
          }
        },
        
        getBoardState: () => {
          const state = get();
          return {
            fen: state.currentFen,
            legalMoves: state.getLegalMoves(),
            bannedMove: state.currentBannedMove,
          };
        },
        
        handleSquareClick: (from, to) => {
          const state = get();
          
          if (!to) {
            // First click - just select the square
            const possibleMoves = state.chess?.moves({ square: from, verbose: true }).map(m => m.to as Square) || [];
            set({ selectedSquare: from, possibleMoves });
            return true;
          }
          
          // Second click - execute operation via the unified method
          const { executeGameOperation } = get();
          if (state.phase === 'selecting_ban') {
            return executeGameOperation('ban', from, to);
          } else if (state.phase === 'making_move') {
            return executeGameOperation('move', from, to);
          }
          
          return false;
        },
        
        getGameStatusMessage: () => {
          const state = get();
          if (!state.game) return '';
          
          // Game over states
          if (state.game.status === 'finished') {
            const result = state.game?.result as any;
            if (!result) return 'Game over';
            if (result === '1-0' || result === 'white') return 'White wins by checkmate!';
            if (result === '0-1' || result === 'black') return 'Black wins by checkmate!';
            if (result === '1/2-1/2' || result === 'draw') {
              if (state.game.endReason === 'stalemate') return 'Draw by stalemate!';
              return 'Draw!';
            }
          }
          
          // Active game states
          if (state.mode === 'local') {
            if (state.phase === 'selecting_ban') {
              const banningPlayer = state.currentTurn === 'white' ? 'Black' : 'White';
              return `${banningPlayer} is selecting a move to ban`;
            } else {
              const movingPlayer = state.currentTurn === 'white' ? 'White' : 'Black';
              return `${movingPlayer} to move`;
            }
          } else {
            // Online game
            if (state.phase === 'selecting_ban') {
              return state.game.banningPlayer === state.myColor 
                ? 'Select a move to ban'
                : 'Opponent is selecting a ban';
            } else {
              return state.game.turn === state.myColor 
                ? 'Your turn to move'
                : 'Opponent\'s turn to move';
            }
          }
        },
        
        advancePhase: () => {
          const state = get();
          
          if (state.game?.status === 'finished') {
            if (state.phase !== 'game_over') {
              set({ phase: 'game_over' });
            }
            return;
          }
          
          if (state.mode === 'local') {
            // Local games: Ban Chess phase transitions
            if (state.phase === 'selecting_ban') {
              // After a ban is selected, it's time for the current turn player to make a move
              // The turn is already set to the player who needs to move
              set({ 
                phase: 'making_move',
              });
              
              // Don't update banningPlayer here - it stays the same until after the next move
            } else if (state.phase === 'making_move') {
              // After a move is made, the phase changes to selecting_ban
              // The turn has already been updated in executeMove
              // The banningPlayer has also been set in executeMove
              set({ 
                phase: 'selecting_ban',
              });
            }
          } else {
            // Online games: wait for server updates
            if (state.phase === 'selecting_ban') {
              set({ phase: 'waiting_for_move' });
            } else if (state.phase === 'making_move') {
              set({ phase: 'waiting_for_ban' });
            }
          }
        },
        
        setupTestPosition: (fen: string) => {
          const chess = new Chess();
          chess.load(fen);
          
          // Check for game-over conditions
          const legalMoves = chess.moves();
          const isInCheck = chess.inCheck();
          let gameStatus: GameStatus = 'active';
          let result = null;
          let endReason = null;
          let phase: GamePhase = 'selecting_ban';
          
          if (legalMoves.length === 0) {
            if (isInCheck) {
              // Standard checkmate
              gameStatus = 'finished';
              result = chess.turn() === 'w' ? '0-1' : '1-0';
              endReason = 'checkmate';
              phase = 'game_over';
            } else {
              // Stalemate
              gameStatus = 'finished';
              result = '1/2-1/2';
              endReason = 'stalemate';
              phase = 'game_over';
            }
          } else if (chess.inDraw()) {
            gameStatus = 'finished';
            result = '1/2-1/2';
            endReason = 'draw';
            phase = 'game_over';
          }
          
          set({
            chess,
            currentFen: fen,
            currentTurn: chess.turn() === 'w' ? 'white' : 'black',
            moveHistory: [],
            banHistory: [],
            currentBannedMove: null,
            phase,
            mode: 'local',
            game: {
              ...get().game,
              status: gameStatus,
              result,
              endReason,
              currentFen: fen,
              turn: chess.turn() === 'w' ? 'white' : 'black',
            } as any,
            showGameOverModal: gameStatus === 'finished',
          });
        },
        
        actions: {
          resign: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to resign
              console.log('Resigning...');
            }
          },
          
          offerDraw: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to offer draw
              console.log('Offering draw...');
            }
          },
          
          acceptDraw: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to accept draw
              console.log('Accepting draw...');
            }
          },
          
          declineDraw: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to decline draw
              console.log('Declining draw...');
            }
          },
          
          offerRematch: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to offer rematch
              console.log('Offering rematch...');
            }
          },
          
          acceptRematch: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to accept rematch
              console.log('Accepting rematch...');
            }
          },
          
          declineRematch: () => {
            const state = get();
            if (state.game && state.myColor) {
              // TODO: Call API to decline rematch
              console.log('Declining rematch...');
            }
          },
          
          resetGame: () => {
            const state = get();
            if (state.mode === 'local') {
              // Re-initialize local game inline
              const chess = new Chess();
              const initialFen = chess.fen();
              
              const localGameObj = {
                id: 'local',
                pgn: chess.pgn(),
                currentFen: initialFen,
                status: 'active' as const,
                turn: 'white' as PlayerColor,
                currentBannedMove: null,
                whitePlayer: 'Player 1',
                blackPlayer: 'Player 2',
                whitePlayerId: 'local-white',
                blackPlayerId: 'local-black',
                result: null,
                lastMove: null,
                banningPlayer: 'black' as PlayerColor,
                drawOfferedBy: null,
                endReason: null,
                rematchOfferedBy: null,
                parentGameId: null,
                chess: chess,
                startTime: Date.now(),
                lastMoveTime: Date.now(),
              } as Game;
              
              set({
                mode: 'local',
                game: localGameObj,
                chess,
                myColor: null,
                currentFen: initialFen,
                currentTurn: 'white',
                phase: 'selecting_ban' as GamePhase,
                currentBannedMove: null,
                moveHistory: [],
                banHistory: [],
                lastMove: null,
                selectedSquare: null,
                possibleMoves: [],
                highlightedSquares: [],
                boardOrientation: 'white',
              });
            } else {
              set(initialState);
            }
          },
          
          startLocalGame: () => {
            const { initLocalGame } = get();
            initLocalGame();
          },
          
          flipBoardOrientation: () => {
            const state = get();
            set({ boardOrientation: state.boardOrientation === 'white' ? 'black' : 'white' });
          },
          
          setupTestPosition: (fen: string) => {
            // Method for tests to set up specific board positions
            const chess = new Chess();
            chess.load(fen);
            set({
              chess,
              currentFen: fen,
              currentTurn: chess.turn() === 'w' ? 'white' : 'black',
              moveHistory: [],
              banHistory: [],
              currentBannedMove: null,
            });
          },
        },
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
export const useCanMove = () => {
  // Use individual selectors to avoid infinite loops - don't create objects in selector!
  const mode = useUnifiedGameStore((s) => s.mode);
  const phase = useUnifiedGameStore((s) => s.phase);
  const game = useUnifiedGameStore((s) => s.game);
  const myColor = useUnifiedGameStore((s) => s.myColor);
  
  if (mode === 'local') {
    return phase === 'making_move' && game?.status === 'active';
  }
  const isMyTurn = mode !== 'spectator' && 
                  game?.turn === myColor && 
                  game?.status === 'active';
  return phase === 'making_move' && isMyTurn;
};

export const useCanBan = () => {
  // Use individual selectors to avoid infinite loops - don't create objects in selector!
  const phase = useUnifiedGameStore((s) => s.phase);
  const game = useUnifiedGameStore((s) => s.game);
  
  return phase === 'selecting_ban' && game?.status === 'active';
};
export const useBoardOrientation = () => useUnifiedGameStore((s) => s.boardOrientation);
export const useHighlightedSquares = () => useUnifiedGameStore((s) => s.highlightedSquares);
export const useLastMove = () => useUnifiedGameStore((s) => s.lastMove);
export const useCurrentBannedMove = () => useUnifiedGameStore((s) => s.currentBannedMove);
export const useMoveHistory = () => useUnifiedGameStore((s) => s.moveHistory);
export const useIsAnimating = () => useUnifiedGameStore((s) => s.isAnimating);
export const useGameStatus = () => useUnifiedGameStore((s) => s.game?.status);
// Removed local-specific selectors - use unified selectors instead