import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameStore, type GamePhase, type BannedMove } from '@/stores/gameStore';
import { GameService } from '@/services/gameService';
import { useAuth } from './AuthContext';
import { supabase } from '@/utils/supabase';
import { useChessSounds } from '@/hooks/useChessSounds';
import type { ChessMove, Game, PlayerColor } from '@/types/game';
import type { Square } from 'chess.ts/dist/types';
import { Chess } from 'chess.ts';

interface GameContextType {
  game: Game | null;
  loading: boolean;
  isLoading: boolean;
  myColor: PlayerColor | null;
  isMyTurn: boolean;
  canBan: boolean;
  canMove: boolean;
  isLocalGame: boolean;
  localGameOrientation: PlayerColor;
  playerUsernames: {
    white: string;
    black: string;
  };
  
  // Zustand store state (exposed for components)
  phase: GamePhase;
  currentBannedMove: { from: Square; to: Square } | null;
  banHistory: BannedMove[];
  moveHistory: Array<{ from: Square; to: Square; san: string }>;
  highlightedSquares: Square[];
  possibleBans: Array<{ from: Square; to: Square }>;
  isAnimating: boolean;
  optimisticMove: { from: Square; to: Square } | null;
  optimisticBan: { from: Square; to: Square } | null;
  
  // Actions
  makeMove: (from: string, to: string, promotion?: string) => void;
  banMove: (from: string, to: string) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  setPgn: (pgn: string) => void;
  
  // UI Actions from store
  setHighlightedSquares: (squares: Square[]) => void;
  clearHighlights: () => void;
  previewBan: (from: Square, to: Square) => void;
  previewMove: (from: Square, to: Square) => void;
  startBanSelection: (possibleMoves: Array<{ from: Square; to: Square }>) => void;
  
  actions: {
    resetGame: () => void;
    flipBoardOrientation?: () => void;
    startLocalGame: () => void;
    resign: () => void;
    offerDraw: () => void;
    acceptDraw: () => void;
    declineDraw: () => void;
    offerRematch?: () => void;
    acceptRematch?: () => void;
    declineRematch?: () => void;
  };
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playMoveSound, playGameStart, playGameEnd } = useChessSounds();
  const gameId = router.query.id as string | undefined;
  const isLocalGame = router.pathname === '/local';
  
  const {
    setPhase,
    setMyColor,
    confirmBan,
    confirmMove,
    receiveBan,
    receiveMove,
    myColor,
    phase,
    currentBannedMove,
    banHistory,
    moveHistory,
    highlightedSquares,
    possibleBans,
    isAnimating,
    optimisticMove,
    optimisticBan,
    setHighlightedSquares,
    clearHighlights,
    previewBan,
    previewMove,
    startBanSelection,
  } = useGameStore();

  // Fetch game data
  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      return GameService.getGame(gameId);
    },
    enabled: !!gameId,
  });

  // Determine player color
  useEffect(() => {
    if (!game) {
      setMyColor(null);
      return;
    }
    
    // If no user, they're a spectator
    if (!user) {
      setMyColor(null);
      return;
    }
    
    const color = game.whitePlayerId === user.id ? 'white' : 
                   game.blackPlayerId === user.id ? 'black' : null;
    setMyColor(color);
  }, [game, user, setMyColor]);

  // Sync currentBannedMove from game data to store
  useEffect(() => {
    if (!game) return;
    
    console.log('[GameContextV2] Game object:', game);
    console.log('[GameContextV2] Syncing banned move:', game.currentBannedMove);
    
    // If game has a current banned move, update the store
    if (game.currentBannedMove) {
      const store = useGameStore.getState();
      // Only update if it's different from what's in the store
      if (!store.currentBannedMove || 
          store.currentBannedMove.from !== game.currentBannedMove.from ||
          store.currentBannedMove.to !== game.currentBannedMove.to) {
        console.log('[GameContextV2] Updating store with banned move:', game.currentBannedMove);
        useGameStore.setState({ 
          currentBannedMove: game.currentBannedMove 
        });
      }
    } else {
      // Clear banned move if game doesn't have one
      const store = useGameStore.getState();
      if (store.currentBannedMove) {
        console.log('[GameContextV2] Clearing banned move from store');
        useGameStore.setState({ currentBannedMove: null });
      }
    }
  }, [game?.currentBannedMove]);

  // Update phase based on game state
  useEffect(() => {
    if (!game) return;
    
    // If no player color determined (spectator/test mode)
    if (!myColor) {
      // Still show the correct phase based on game state
      if (game.status === 'finished') {
        setPhase('game_over');
      } else if (game.banningPlayer) {
        setPhase('waiting_for_ban'); // Show waiting state during ban phase
      } else {
        setPhase('waiting_for_move'); // Show waiting state during move phase
      }
      return;
    }
    
    if (game.status === 'finished') {
      setPhase('game_over');
    } else if (game.banningPlayer === myColor) {
      // I need to ban the opponent's move
      setPhase('selecting_ban');
    } else if (game.banningPlayer && game.banningPlayer !== myColor) {
      // Opponent is banning my move
      setPhase('waiting_for_ban');
    } else if (!game.banningPlayer && game.turn === myColor) {
      // It's my turn to move (ban has been completed)
      setPhase('making_move');
    } else if (!game.banningPlayer && game.turn !== myColor) {
      // It's opponent's turn to move (ban has been completed)
      setPhase('waiting_for_move');
    } else {
      // Default to waiting
      setPhase('waiting_for_move');
    }
  }, [game, myColor, setPhase]);

  // Set up realtime subscription
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      }, () => {
        // Invalidate to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, queryClient]);

  // Ban move mutation
  const banMoveMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      if (!gameId) throw new Error('No game');
      
      // Optimistic update
      confirmBan(from as Square, to as Square);
      
      // Play ban sound
      const audio = new Audio('/sounds/ban.mp3');
      audio.play().catch(() => {});
      
      return GameService.banMove(gameId, { from: from as Square, to: to as Square });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
    onError: () => {
      // Reset on error
      useGameStore.getState().reset();
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  // Make move mutation
  const makeMoveMutation = useMutation({
    mutationFn: async ({ from, to, promotion }: ChessMove) => {
      if (!gameId || !game) throw new Error('No game');
      
      // Optimistic update
      confirmMove(from, to);
      
      // Play move sound
      const chess = new Chess(game.currentFen);
      const move = chess.move({ from: from as Square, to: to as Square, promotion });
      if (move) {
        playMoveSound(move, chess);
      }
      
      return GameService.makeMove(gameId, { from, to, promotion });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
    onError: () => {
      // Reset on error
      useGameStore.getState().reset();
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  // Other game actions
  const resignMutation = useMutation({
    mutationFn: async () => {
      if (!gameId || !myColor) throw new Error('Cannot resign');
      return GameService.resign(gameId, myColor);
    },
    onSuccess: () => {
      playGameEnd();
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  // Get player usernames
  const playerUsernames = {
    white: game?.whitePlayer || 'White',
    black: game?.blackPlayer || 'Black',
  };

  const value: GameContextType = {
    game: game || null,
    loading: isLoading,
    isLoading,
    myColor: isLocalGame ? 'white' : myColor,
    isMyTurn: isLocalGame ? true : (game?.status === 'active' && game?.turn === myColor),
    canBan: phase === 'selecting_ban',
    canMove: phase === 'making_move',
    isLocalGame,
    localGameOrientation: 'white', // Default to white for local games
    playerUsernames,
    
    // Zustand store state
    phase,
    currentBannedMove,
    banHistory,
    moveHistory,
    highlightedSquares,
    possibleBans,
    isAnimating,
    optimisticMove,
    optimisticBan,
    
    // Actions
    makeMove: (from: string, to: string, promotion?: string) => {
      makeMoveMutation.mutate({ 
        from: from as Square, 
        to: to as Square, 
        promotion: promotion as any 
      });
    },
    
    banMove: (from: string, to: string) => {
      banMoveMutation.mutate({ from, to });
    },
    
    resign: () => resignMutation.mutate(),
    
    offerDraw: async () => {
      if (!gameId || !myColor) return;
      await GameService.offerDraw(gameId, myColor);
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
    
    acceptDraw: async () => {
      if (!gameId) return;
      await GameService.acceptDraw(gameId);
      playGameEnd();
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
    
    declineDraw: async () => {
      if (!gameId) return;
      await GameService.declineDraw(gameId);
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },

    setPgn: (pgn: string) => {
      // For move history navigation - this would need proper implementation
      // For now, we'll keep it as a no-op since the V2 context uses TanStack Query
      console.log('setPgn called with:', pgn);
    },
    
    // UI Actions from store
    setHighlightedSquares,
    clearHighlights,
    previewBan,
    previewMove,
    startBanSelection,

    actions: {
      resetGame: () => {
        router.push('/');
      },
      flipBoardOrientation: () => {
        // This would need to be implemented in the game store
        console.log('Flip board orientation');
      },
      startLocalGame: () => {
        router.push('/local-game');
      },
      resign: () => resignMutation.mutate(),
      offerDraw: async () => {
        if (!gameId || !myColor) return;
        await GameService.offerDraw(gameId, myColor);
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      },
      acceptDraw: async () => {
        if (!gameId) return;
        await GameService.acceptDraw(gameId);
        playGameEnd();
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      },
      declineDraw: async () => {
        if (!gameId) return;
        await GameService.declineDraw(gameId);
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      },
      offerRematch: async () => {
        if (!gameId || !myColor) return;
        // This would need to be implemented in GameService
        console.log('Offer rematch');
      },
      acceptRematch: async () => {
        if (!gameId) return;
        // This would need to be implemented in GameService
        console.log('Accept rematch');
      },
      declineRematch: async () => {
        if (!gameId) return;
        // This would need to be implemented in GameService  
        console.log('Decline rematch');
      },
    },
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}