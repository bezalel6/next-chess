import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { GameService } from '@/services/gameService';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useDebugLogStore } from '@/stores/debugLogStore';
import { useChessSounds } from './useChessSounds';
import type { Game, ChessMove, PlayerColor } from '@/types/game';
import type { Square } from 'chess.ts/dist/types';
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
      if (!gameId) return null;
      return GameService.getGame(gameId);
    },
    enabled: !!gameId,
    refetchInterval: false, // We'll use realtime updates instead
    staleTime: 1000 * 30, // 30 seconds
  });
  
  // Update loading state
  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);
  
  // Initialize store when game data is loaded
  useEffect(() => {
    if (query.data && gameId) {
      const game = query.data;
      const myColor = !userId ? null :
        game.whitePlayerId === userId ? 'white' :
        game.blackPlayerId === userId ? 'black' : null;
      
      // Only initialize if game data has actually changed
      const currentGameId = useUnifiedGameStore.getState().gameId;
      const currentGame = useUnifiedGameStore.getState().game;
      
      if (currentGameId !== gameId || currentGame?.currentFen !== game.currentFen) {
        initGame(gameId, game, myColor);
      }
    }
  }, [query.data, gameId, userId, initGame]);
  
  // Set up realtime subscription
  useEffect(() => {
    if (!gameId) return;
    
    const { logBroadcastReceived, logStateChange } = useDebugLogStore.getState();
    
    const channel = supabase
      .channel(`game:${gameId}:unified`)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        console.log('[useGameQuery] Received game update:', payload);
        logBroadcastReceived('game_update', payload.payload);
        
        // Update React Query cache
        queryClient.setQueryData(['game', gameId], (old: Game | null) => {
          if (!old) return old;
          return { ...old, ...payload.payload };
        });
        
        // Sync store with server
        if (payload.payload) {
          syncWithServer(payload.payload);
        }
      })
      .on('broadcast', { event: 'move' }, (payload) => {
        console.log('[useGameQuery] Received move:', payload);
        logBroadcastReceived('move', payload.payload);
        
        // Refetch to get latest state
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        
        // Update store
        if (payload.payload) {
          receiveMove(payload.payload);
        }
      })
      .on('broadcast', { event: 'ban' }, (payload) => {
        console.log('[useGameQuery] Received ban:', payload);
        logBroadcastReceived('ban', payload.payload);
        
        // If PGN is included in the broadcast, update immediately
        if (payload.payload?.pgn) {
          console.log('[useGameQuery] Updating game with broadcasted PGN');
          updateGame({ pgn: payload.payload.pgn });
        }
        
        // Refetch to get latest state and update store with PGN
        queryClient.invalidateQueries({ queryKey: ['game', gameId] }).then(() => {
          // After invalidation completes, the query will refetch
          // Get the updated game data and update the store
          const updatedGame = queryClient.getQueryData<Game>(['game', gameId]);
          if (updatedGame) {
            console.log('[useGameQuery] Updating game after refetch');
            updateGame(updatedGame);
          }
        });
        
        // Update store
        if (payload.payload) {
          receiveBan(payload.payload);
        }
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      channel.unsubscribe();
    };
  }, [gameId, queryClient, syncWithServer, receiveMove, receiveBan, updateGame, setConnected]);
  
  return query;
}

// ============= Move Mutation Hook =============
export function useMoveMutation(gameId: string | undefined) {
  const store = useUnifiedGameStore();
  const queryClient = useQueryClient();
  const { playMoveSound } = useChessSounds();
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
      
      // Confirm optimistic update
      store.confirmOptimisticUpdate();
      
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
      
      // Update store's game object with the updated PGN
      store.updateGame(data);
      
      // Broadcast move to other clients
      const broadcastPayload = {
        from: data.lastMove?.from,
        to: data.lastMove?.to,
        fen: data.currentFen,
      };
      
      logBroadcastSent('move', broadcastPayload);
      
      supabase.channel(`game:${gameId}:unified`).send({
        type: 'broadcast',
        event: 'move',
        payload: broadcastPayload,
      });
    },
    
    onError: (error) => {
      console.error('[useMoveMutation] Error:', error);
      logError('Move mutation failed', error);
      
      // Rollback optimistic update
      store.rollbackOptimisticUpdate();
      
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });
}

// ============= Ban Mutation Hook =============
export function useBanMutation(gameId: string | undefined) {
  const store = useUnifiedGameStore();
  const queryClient = useQueryClient();
  const { playBan } = useChessSounds();
  
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
      
      // Broadcast ban to other clients
      console.log('[useBanMutation] Broadcasting ban:', data.currentBannedMove);
      const broadcastPayload = {
        from: data.currentBannedMove?.from,
        to: data.currentBannedMove?.to,
        pgn: data.pgn, // Include PGN in broadcast
      };
      
      logBroadcastSent('ban', broadcastPayload);
      
      supabase.channel(`game:${gameId}:unified`).send({
        type: 'broadcast',
        event: 'ban',
        payload: broadcastPayload,
      });
    },
    
    onError: (error) => {
      console.error('[useBanMutation] Error:', error);
      logError('Ban mutation failed', error);
      
      // Rollback optimistic update
      store.rollbackOptimisticUpdate();
      
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
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
  
  // Use individual selectors to avoid infinite loops
  const mode = useUnifiedGameStore(s => s.mode);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const phase = useUnifiedGameStore(s => s.phase);
  const game = useUnifiedGameStore(s => s.game);
  const localPhase = useUnifiedGameStore(s => s.localPhase);
  const localGameStatus = useUnifiedGameStore(s => s.localGameStatus);
  
  // Calculate these values outside the selector
  const canMove = mode === 'local'
    ? (localPhase === 'playing' && localGameStatus === 'active')
    : (phase === 'making_move' && game?.turn === myColor && game?.status === 'active');
    
  const canBan = mode === 'local' 
    ? (localPhase === 'banning' && localGameStatus === 'active')
    : phase === 'selecting_ban';
    
  const isMyTurn = mode === 'local' 
    ? true
    : (mode !== 'spectator' && game?.turn === myColor && game?.status === 'active');
  
  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    if (mode === 'local') {
      // Handle local move
      const store = useUnifiedGameStore.getState();
      store.makeLocalMove(from as Square, to as Square, promotion);
    } else {
      // Handle online move
      moveMutation.mutate({ from: from as Square, to: to as Square, promotion: promotion as any });
    }
  }, [mode, moveMutation]);
  
  const banMove = useCallback((from: string, to: string) => {
    if (mode === 'local') {
      // Handle local ban
      const store = useUnifiedGameStore.getState();
      store.selectLocalBan(from as Square, to as Square);
    } else {
      // Handle online ban
      banMutation.mutate({ from, to });
    }
  }, [mode, banMutation]);
  
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