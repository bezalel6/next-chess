import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { GameService } from '@/services/gameService';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useChessSounds } from './useChessSounds';
import type { Game, ChessMove, PlayerColor } from '@/types/game';
import type { Square } from 'chess.ts/dist/types';
import { Chess } from 'chess.ts';

// ============= Game Query Hook =============
export function useGameQuery(gameId: string | undefined, userId: string | undefined) {
  const store = useUnifiedGameStore();
  const queryClient = useQueryClient();
  
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
    store.setLoading(query.isLoading);
  }, [query.isLoading, store]);
  
  // Initialize store when game data is loaded
  useEffect(() => {
    if (query.data && gameId) {
      const game = query.data;
      const myColor = !userId ? null :
        game.whitePlayerId === userId ? 'white' :
        game.blackPlayerId === userId ? 'black' : null;
      
      store.initGame(gameId, game, myColor);
    }
  }, [query.data, gameId, userId, store]);
  
  // Set up realtime subscription
  useEffect(() => {
    if (!gameId) return;
    
    const channel = supabase
      .channel(`game:${gameId}:unified`)
      .on('broadcast', { event: 'game_update' }, (payload) => {
        console.log('[useGameQuery] Received game update:', payload);
        
        // Update React Query cache
        queryClient.setQueryData(['game', gameId], (old: Game | null) => {
          if (!old) return old;
          return { ...old, ...payload.payload };
        });
        
        // Sync store with server
        if (payload.payload) {
          store.syncWithServer(payload.payload);
        }
      })
      .on('broadcast', { event: 'move' }, (payload) => {
        console.log('[useGameQuery] Received move:', payload);
        
        // Refetch to get latest state
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        
        // Update store
        if (payload.payload) {
          store.receiveMove(payload.payload);
        }
      })
      .on('broadcast', { event: 'ban' }, (payload) => {
        console.log('[useGameQuery] Received ban:', payload);
        
        // Refetch to get latest state
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        
        // Update store
        if (payload.payload) {
          store.receiveBan(payload.payload);
        }
      })
      .subscribe((status) => {
        store.setConnected(status === 'SUBSCRIBED');
      });
    
    return () => {
      channel.unsubscribe();
    };
  }, [gameId, queryClient]);
  
  return query;
}

// ============= Move Mutation Hook =============
export function useMoveMutation(gameId: string | undefined) {
  const store = useUnifiedGameStore();
  const queryClient = useQueryClient();
  const { playMoveSound } = useChessSounds();
  
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
      
      // Send to server
      return GameService.makeMove(gameId, { from, to, promotion });
    },
    
    onSuccess: (data) => {
      // Confirm optimistic update
      store.confirmOptimisticUpdate();
      
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
      
      // Broadcast move to other clients
      supabase.channel(`game:${gameId}:unified`).send({
        type: 'broadcast',
        event: 'move',
        payload: {
          from: data.lastMove?.from,
          to: data.lastMove?.to,
          fen: data.currentFen,
        },
      });
    },
    
    onError: (error) => {
      console.error('[useMoveMutation] Error:', error);
      
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
  
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      if (!gameId) throw new Error('No game ID');
      
      // Play ban sound
      playBan();
      
      // Optimistic update in store
      store.banMove(from as Square, to as Square);
      
      // Send to server
      return GameService.banMove(gameId, { from: from as Square, to: to as Square });
    },
    
    onSuccess: (data) => {
      // Confirm optimistic update
      store.confirmOptimisticUpdate();
      
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
      
      // Broadcast ban to other clients
      supabase.channel(`game:${gameId}:unified`).send({
        type: 'broadcast',
        event: 'ban',
        payload: {
          from: data.currentBannedMove?.from,
          to: data.currentBannedMove?.to,
        },
      });
    },
    
    onError: (error) => {
      console.error('[useBanMutation] Error:', error);
      
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
  
  // Get store values using selectors for performance
  const mode = useUnifiedGameStore((s) => s.mode);
  const myColor = useUnifiedGameStore((s) => s.myColor);
  const phase = useUnifiedGameStore((s) => s.phase);
  const canMove = useUnifiedGameStore((s) => s.canMove());
  const canBan = useUnifiedGameStore((s) => s.canBan());
  const isMyTurn = useUnifiedGameStore((s) => s.isMyTurn());
  
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
    mode,
    myColor,
    phase,
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