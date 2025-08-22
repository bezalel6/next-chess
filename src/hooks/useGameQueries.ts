import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { GameService } from '@/services/gameService';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useDebugLogStore } from '@/stores/debugLogStore';
import { useChessSounds } from './useChessSounds';
import { useNotification } from '@/contexts/NotificationContext';
import type { Game, ChessMove, PlayerColor } from '@/types/game';
import type { Square, PieceSymbol } from 'chess.ts/dist/types';
import { Chess } from 'chess.ts';

// ============= Game Query Hook =============
export function useGameQuery(gameId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  
  // Get store functions individually to avoid creating new objects in selector
  const setLoading = useUnifiedGameStore(s => s.setLoading);
  const initGame = useUnifiedGameStore(s => s.initGame);
  const syncWithServer = useUnifiedGameStore(s => s.syncWithServer);
  const receiveMove = useUnifiedGameStore(s => s.receiveMove);
  const receiveBan = useUnifiedGameStore(s => s.receiveBan);
  const setConnected = useUnifiedGameStore(s => s.setConnected);
  const updateGame = useUnifiedGameStore(s => s.updateGame);
  
  // Fetch game data
  const query = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId || gameId === 'local') return null;
      return GameService.getGame(gameId);
    },
    enabled: !!gameId && gameId !== 'local',
    refetchInterval: false, // We'll use realtime updates instead
    staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh longer
    gcTime: 1000 * 60 * 10, // 10 minutes cache time
  });
  
  // Update loading state
  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);
  
  // Initialize store when game data is loaded
  useEffect(() => {
    if (query.data && gameId) {
      const game = query.data as Game; // GameService.getGame returns a mapped Game

      // Derive color strictly from camelCase IDs normalized by GameService
      const myColor = !userId
        ? null
        : game.whitePlayerId === userId
          ? 'white'
          : game.blackPlayerId === userId
            ? 'black'
            : null;

      // Only initialize if game data has actually changed
      const currentGameId = useUnifiedGameStore.getState().gameId;
      const currentGame = useUnifiedGameStore.getState().game;

      if (currentGameId !== gameId || currentGame?.currentFen !== game.currentFen) {
        initGame(gameId, game, myColor);
      }

      // Ensure board orientation matches myColor even if game was already initialized
      const state = useUnifiedGameStore.getState();
      if (myColor && state.boardOrientation !== myColor) {
        useUnifiedGameStore.setState({ myColor, boardOrientation: myColor });
      }
    }
  }, [query.data, gameId, userId, initGame]);
  
  // Set up realtime subscription (server-authoritative updates only)
  useEffect(() => {
    if (!gameId || gameId === 'local') return;
    
    const { logBroadcastReceived } = useDebugLogStore.getState();
    
    const channel = supabase
      .channel(`game:${gameId}:unified`)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        logBroadcastReceived('game_update', payload.payload);
        
        // Update React Query cache
        queryClient.setQueryData(['game', gameId], (old: Game | null) => {
          if (!old) return payload.payload as Game;
          return { ...old, ...payload.payload } as Game;
        });
        
        // Sync store with server
        if (payload.payload) {
          syncWithServer(payload.payload);
        }
        
        // Ensure move list caches refresh
        queryClient.invalidateQueries({ queryKey: ['moves', gameId] });
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      channel.unsubscribe();
    };
  }, [gameId, queryClient, syncWithServer, setConnected]);
  
  return query;
}

// ============= Move Mutation Hook =============
export function useMoveMutation(gameId: string | undefined) {
  const store = useUnifiedGameStore();
  const queryClient = useQueryClient();
  const { playMoveSound } = useChessSounds();
  const { notify } = useNotification();
  const { logApiCall, logApiResponse, logBroadcastSent, logError } = useDebugLogStore.getState();
  
  return useMutation({
    mutationFn: async ({ from, to, promotion }: ChessMove) => {
      if (!gameId) throw new Error('No game ID');
      
      // Get current game state
      const game = queryClient.getQueryData<Game>(['game', gameId]);
      if (!game) throw new Error('No game data');
      
      // Calculate move sound
      const chess = new Chess(game.currentFen);
      const move = chess.move({ from: from as Square, to: to as Square, promotion });
      if (move) {
        playMoveSound(move, chess);
      }
      
      // Optimistic update in store
      store.makeMove(from as Square, to as Square, promotion);
      
      // Log API call
      logApiCall('makeMove', { gameId, from, to, promotion });
      
      // Send to server
      return GameService.makeMove(gameId, { from, to, promotion });
    },
    
    onSuccess: (data) => {
      // Log API response
      logApiResponse('makeMove', data);
      
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
      
      // Update store's game object with the updated PGN
      store.updateGame(data);
      
      // Invalidate moves query to update move history
      queryClient.invalidateQueries({ queryKey: ['moves', gameId] });
      
      // Confirm optimistic update immediately (no need to wait)
      store.confirmOptimisticUpdate();
      
      // Rely on server-authoritative broadcasts; no client send.
    },
    
    onError: (error: any) => {
      console.error('[useMoveMutation] Error:', error);
      logError('Move mutation failed', error);
      
      // Rollback optimistic update
      store.rollbackOptimisticUpdate();
      
      // Show detailed error message
      const errorMessage = error?.message || 'Failed to make move';
      const detailedError = error?.details || error?.error || '';
      
      // Show toast notification via NotificationContext
      if (detailedError.includes('handle_move_clock_update')) {
        notify(
          'Database function missing. Please contact support to fix this issue.',
          'error',
          10000
        );
      } else if (detailedError.includes('does not exist')) {
        notify(
          `Database error: ${detailedError}. The game database may need updates.`,
          'error',
          10000
        );
      } else if (error?.status === 500) {
        notify(
          'Server error occurred. Please try again or refresh the page.',
          'error',
          8000
        );
      } else {
        notify(
          `Move failed: ${errorMessage}${detailedError ? ` - ${detailedError}` : ''}`,
          'error',
          6000
        );
      }
      
      // Refetch game and moves to sync with server
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['moves', gameId] });
    },
  });
}

// ============= Ban Mutation Hook =============
export function useBanMutation(gameId: string | undefined) {
  const store = useUnifiedGameStore();
  const queryClient = useQueryClient();
  const { playBan } = useChessSounds();
  const { notify } = useNotification();
  
  const { logApiCall, logApiResponse, logBroadcastSent, logError } = useDebugLogStore.getState();
  
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      if (!gameId) throw new Error('No game ID');
      
      // Play ban sound
      playBan();
      
      // Optimistic update in store
      store.banMove(from as Square, to as Square);
      
      // Log API call
      logApiCall('banMove', { gameId, from, to });
      
      // Send to server
      return GameService.banMove(gameId, { from: from as Square, to: to as Square });
    },
    
    onSuccess: (data) => {
      console.log('[useBanMutation] Ban success, data:', data);
      
      // Log API response
      logApiResponse('banMove', data);
      
      // Confirm optimistic update
      store.confirmOptimisticUpdate();
      
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
      
      // Update store's game object with the updated PGN
      store.updateGame(data);
      
      // Invalidate moves query to update move history
      queryClient.invalidateQueries({ queryKey: ['moves', gameId] });
      
      // Rely on server-authoritative broadcasts; no client send.
    },
    
    onError: (error: any) => {
      console.error('[useBanMutation] Error:', error);
      logError('Ban mutation failed', error);
      
      // Rollback optimistic update
      store.rollbackOptimisticUpdate();
      
      // Show detailed error message
      const errorMessage = error?.message || 'Failed to ban move';
      const detailedError = error?.details || error?.error || '';
      
      // Show toast notification via NotificationContext
      if (detailedError.includes('handle_move_clock_update')) {
        notify(
          'Database function missing. Please contact support to fix this issue.',
          'error',
          10000
        );
      } else if (detailedError.includes('does not exist')) {
        notify(
          `Database error: ${detailedError}. The game database may need updates.`,
          'error',
          10000
        );
      } else if (error?.status === 500) {
        notify(
          'Server error occurred. Please try again or refresh the page.',
          'error',
          8000
        );
      } else {
        notify(
          `Ban failed: ${errorMessage}${detailedError ? ` - ${detailedError}` : ''}`,
          'error',
          6000
        );
      }
      
      // Refetch game and moves to sync with server
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['moves', gameId] });
    },
  });
}

// ============= Other Game Mutations =============
export function useGameMutations(gameId: string | undefined) {
  const queryClient = useQueryClient();
  const { playGameEnd } = useChessSounds();
  const store = useUnifiedGameStore();
  
  const resignMutation = useMutation({
    mutationFn: async (playerColor: PlayerColor) => {
      if (!gameId) throw new Error('No game ID');
      return GameService.resign(gameId, playerColor);
    },
    onSuccess: (data) => {
      playGameEnd();
      queryClient.setQueryData(['game', gameId], data);
      store.setPhase('game_over');
    },
  });
  
  const offerDrawMutation = useMutation({
    mutationFn: async (playerColor: PlayerColor) => {
      if (!gameId) throw new Error('No game ID');
      return GameService.offerDraw(gameId, playerColor);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['game', gameId], data);
    },
  });
  
  const acceptDrawMutation = useMutation({
    mutationFn: async () => {
      if (!gameId) throw new Error('No game ID');
      return GameService.acceptDraw(gameId);
    },
    onSuccess: (data) => {
      playGameEnd();
      queryClient.setQueryData(['game', gameId], data);
      store.setPhase('game_over');
    },
  });
  
  const declineDrawMutation = useMutation({
    mutationFn: async () => {
      if (!gameId) throw new Error('No game ID');
      return GameService.declineDraw(gameId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['game', gameId], data);
    },
  });
  
  return {
    resign: resignMutation.mutate,
    offerDraw: offerDrawMutation.mutate,
    acceptDraw: acceptDrawMutation.mutate,
    declineDraw: declineDrawMutation.mutate,
    isLoading: resignMutation.isPending || offerDrawMutation.isPending || 
               acceptDrawMutation.isPending || declineDrawMutation.isPending,
  };
}

// ============= Composite Game Hook =============
export function useGame(gameId: string | undefined, userId: string | undefined) {
  const query = useGameQuery(gameId, userId);
  const moveMutation = useMoveMutation(gameId);
  const banMutation = useBanMutation(gameId);
  const mutations = useGameMutations(gameId);
  const { playMoveSound, playBan } = useChessSounds();
  
  // Use individual selectors to avoid infinite loops
  const mode = useUnifiedGameStore(s => s.mode);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const phase = useUnifiedGameStore(s => s.phase);
  const game = useUnifiedGameStore(s => s.game);
  
  // Calculate these values outside the selector
  const canMove = mode === 'local'
    ? (phase === 'making_move' && game?.status === 'active')
    : (phase === 'making_move' && game?.turn === myColor && game?.status === 'active');
    
  const canBan = mode === 'local' 
    ? (phase === 'selecting_ban' && game?.status === 'active')
    : phase === 'selecting_ban';
    
  const isMyTurn = mode === 'local' 
    ? true
    : (mode !== 'spectator' && game?.turn === myColor && game?.status === 'active');
  
  const makeMove = useCallback((from: string, to: string, promotion?: PieceSymbol) => {
    if (mode === 'local') {
      // Handle local move with sound
      const store = useUnifiedGameStore.getState();
      
      // Calculate move sound before making the move
      if (store.chess && store.game) {
        const chess = new Chess(store.chess.fen());
        const move = chess.move({ from: from as Square, to: to as Square, promotion });
        if (move) {
          playMoveSound(move, chess);
        }
      }
      
      store.executeMove(from as Square, to as Square, promotion);
    } else {
      // Handle online move (sound is played in mutation)
      moveMutation.mutate({ from: from as Square, to: to as Square, promotion: promotion as any });
    }
  }, [mode, moveMutation, playMoveSound]);
  
  const banMove = useCallback((from: string, to: string) => {
    if (mode === 'local') {
      // Handle local ban with sound
      playBan();
      const store = useUnifiedGameStore.getState();
      store.executeBan(from as Square, to as Square);
    } else {
      // Handle online ban (sound is played in mutation)
      banMutation.mutate({ from, to });
    }
  }, [mode, banMutation, playBan]);
  
  return {
    // Game data
    game: query.data,
    isLoading: query.isLoading,
    error: query.error,
    
    // Game state
    mode: mode,
    myColor: myColor,
    phase: phase,
    canMove,
    canBan,
    isMyTurn,
    
    // Actions
    makeMove,
    banMove,
    resign: mutations.resign,
    offerDraw: mutations.offerDraw,
    acceptDraw: mutations.acceptDraw,
    declineDraw: mutations.declineDraw,
    
    // Loading states
    isMakingMove: moveMutation.isPending,
    isBanning: banMutation.isPending,
    isMutating: mutations.isLoading,
  };
}

// ============= Active Games Query =============
export function useActiveGames(userId: string | undefined) {
  return useQuery({
    queryKey: ['activeGames', userId],
    queryFn: async () => {
      if (!userId) return [];
      return GameService.getUserActiveGames(userId);
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}