import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/stores/gameStore';
import { GameService } from '@/services/gameService';
import { useAuth } from './AuthContext';
import { supabase } from '@/utils/supabase';
import { useChessSounds } from '@/hooks/useChessSounds';
import type { ChessMove, Game, PlayerColor } from '@/types/game';
import type { Square } from 'chess.ts/dist/types';
import { Chess } from 'chess.ts';

interface GameContextType {
  game: Game | null;
  isLoading: boolean;
  myColor: PlayerColor | null;
  isMyTurn: boolean;
  canBan: boolean;
  canMove: boolean;
  makeMove: (from: string, to: string, promotion?: string) => void;
  banMove: (from: string, to: string) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { playMoveSound, playGameStart, playGameEnd } = useChessSounds();
  const gameId = router.query.id as string | undefined;
  
  const {
    setPhase,
    setMyColor,
    confirmBan,
    confirmMove,
    receiveBan,
    receiveMove,
    myColor,
    phase,
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
    if (!game || !user) {
      setMyColor(null);
      return;
    }
    
    const color = game.whitePlayer === user.id ? 'white' : 
                   game.blackPlayer === user.id ? 'black' : null;
    setMyColor(color);
  }, [game, user, setMyColor]);

  // Update phase based on game state
  useEffect(() => {
    if (!game || !myColor) return;
    
    if (game.status === 'finished') {
      setPhase('game_over');
    } else if (game.banningPlayer === myColor) {
      setPhase('selecting_ban');
    } else if (game.banningPlayer) {
      setPhase('waiting_for_ban');
    } else if (game.turn === myColor) {
      setPhase('making_move');
    } else {
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

  const value: GameContextType = {
    game: game || null,
    isLoading,
    myColor,
    isMyTurn: game?.status === 'active' && game?.turn === myColor,
    canBan: phase === 'selecting_ban',
    canMove: phase === 'making_move',
    
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