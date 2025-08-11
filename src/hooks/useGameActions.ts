import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { GameService } from '@/services/gameService';
import type { ChessMove } from '@/types/game';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { useEffect } from 'react';
import type { Square } from 'chess.ts/dist/types';

export function useGameActions(gameId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    setPhase,
    confirmBan,
    receiveBan,
    confirmMove,
    receiveMove,
    setMyColor,
    myColor,
    currentTurn,
  } = useGameStore();

  // Fetch game state
  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => GameService.getGame(gameId!),
    enabled: !!gameId,
    refetchInterval: false, // We'll use realtime for updates
  });

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
      }, (payload) => {
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        
        const newGame = payload.new;
        
        // Handle phase transitions
        if (newGame.banning_player && newGame.banning_player === myColor) {
          setPhase('selecting_ban');
        } else if (newGame.banning_player) {
          setPhase('waiting_for_ban');
        } else if (newGame.turn === myColor) {
          setPhase('making_move');
        } else {
          setPhase('waiting_for_move');
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, myColor, queryClient, setPhase]);

  // Ban move mutation with optimistic update
  const banMoveMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      if (!gameId) throw new Error('No game ID');
      
      // Optimistically update UI
      confirmBan(from as Square, to as Square);
      
      // Make server call
      return GameService.banMove(gameId, { 
        from: from as Square, 
        to: to as Square 
      });
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
    },
    onError: () => {
      // Rollback optimistic update
      useGameStore.getState().reset();
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  // Make move mutation with optimistic update
  const makeMoveMutation = useMutation({
    mutationFn: async ({ from, to, promotion }: ChessMove) => {
      if (!gameId) throw new Error('No game ID');
      
      // Optimistically update UI
      confirmMove(from, to);
      
      // Make server call
      return GameService.makeMove(gameId, { from, to, promotion });
    },
    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData(['game', gameId], data);
      
      // Play move sound
      const audio = new Audio('/sounds/move.mp3');
      audio.play().catch(() => {});
    },
    onError: () => {
      // Rollback optimistic update
      useGameStore.getState().reset();
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  return {
    game,
    banMove: (from: string, to: string) => {
      // Play ban sound immediately for feedback
      const audio = new Audio('/sounds/ban.mp3');
      audio.play().catch(() => {});
      
      banMoveMutation.mutate({ from, to });
    },
    makeMove: (from: string, to: string, promotion?: string) => {
      makeMoveMutation.mutate({ 
        from: from as Square, 
        to: to as Square, 
        promotion: promotion as any 
      });
    },
    isLoading: banMoveMutation.isPending || makeMoveMutation.isPending,
  };
}