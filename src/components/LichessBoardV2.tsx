import dynamic from 'next/dynamic';
import { useMemo, useCallback, type ComponentProps } from 'react';
import { Box } from '@mui/material';
import { useGame } from '@/contexts/GameContextV2';
import { useGameStore } from '@/stores/gameStore';
import { Chess } from 'chess.ts';
import type { Square } from 'chess.ts/dist/types';
import { motion, AnimatePresence } from 'framer-motion';

const Chessground = dynamic(() => import('@react-chess/chessground'), {
  ssr: false,
});

type Config = ComponentProps<typeof Chessground>['config'];

interface LichessBoardV2Props {
  orientation: 'white' | 'black';
}

export default function LichessBoardV2({ orientation }: LichessBoardV2Props) {
  const { game, myColor, canBan, canMove, makeMove, banMove } = useGame();
  const { 
    phase, 
    currentBannedMove, 
    highlightedSquares,
    previewBan,
    previewMove,
  } = useGameStore();

  // Parse current position
  const chess = useMemo(() => {
    if (!game) return null;
    const c = new Chess(game.currentFen);
    if (game.pgn) {
      try {
        c.loadPgn(game.pgn);
      } catch {}
    }
    return c;
  }, [game?.currentFen, game?.pgn]);

  // Calculate legal moves (excluding banned move)
  const legalMoves = useMemo(() => {
    if (!chess || !game || game.status !== 'active') return new Map();
    
    const moves = new Map<string, string[]>();
    
    // If we're in ban phase, show opponent's moves
    if (canBan) {
      const opponentColor = myColor === 'white' ? 'black' : 'white';
      chess.moves({ verbose: true }).forEach(move => {
        // Only show opponent's pieces' moves
        const piece = chess.get(move.from as Square);
        if (piece && piece.color === (opponentColor === 'white' ? 'w' : 'b')) {
          const from = move.from;
          const to = move.to;
          const dests = moves.get(from) || [];
          moves.set(from, [...dests, to]);
        }
      });
    } 
    // If we can move, show our moves (excluding banned)
    else if (canMove) {
      chess.moves({ verbose: true }).forEach(move => {
        // Skip if this is the banned move
        if (currentBannedMove && 
            move.from === currentBannedMove.from && 
            move.to === currentBannedMove.to) {
          return;
        }
        
        const from = move.from;
        const to = move.to;
        const dests = moves.get(from) || [];
        moves.set(from, [...dests, to]);
      });
    }
    
    return moves;
  }, [chess, game, canBan, canMove, myColor, currentBannedMove]);

  // Get last move for highlighting
  const lastMove = useMemo(() => {
    if (!game?.lastMove) return undefined;
    return [game.lastMove.from, game.lastMove.to] as [Square, Square];
  }, [game?.lastMove]);

  // Check if king is in check
  const check = useMemo(() => {
    if (!chess || !chess.inCheck()) return undefined;
    const turn = chess.turn();
    return turn === 'w' ? 'white' : 'black';
  }, [chess]);

  // Create drawable shapes for banned move
  const shapes = useMemo(() => {
    const s: Config['drawable']['shapes'] = [];
    
    // Show current banned move with red
    if (currentBannedMove && !canBan) {
      s.push({
        orig: currentBannedMove.from as Square,
        dest: currentBannedMove.to as Square,
        brush: 'red',
        modifiers: { lineWidth: 10 },
      });
    }
    
    // Show preview when hovering during ban selection
    if (canBan && highlightedSquares.length === 2) {
      s.push({
        orig: highlightedSquares[0] as Square,
        dest: highlightedSquares[1] as Square,
        brush: 'yellow',
        modifiers: { lineWidth: 8 },
      });
    }
    
    return s;
  }, [currentBannedMove, canBan, highlightedSquares]);

  // Handle piece movement
  const handleMove = useCallback((from: string, to: string) => {
    if (canBan) {
      // Play ban sound
      const audio = new Audio('/sounds/check.wav');
      audio.play().catch(() => {});
      banMove(from, to);
    } else if (canMove) {
      // Check for promotion
      const move = chess?.move({ from: from as Square, to: to as Square, promotion: 'q' });
      if (move) {
        chess?.undo(); // Undo local move, server will handle it
        
        if (move.promotion) {
          // TODO: Show promotion dialog
          makeMove(from, to, 'q');
        } else {
          makeMove(from, to);
        }
      }
    }
  }, [canBan, canMove, banMove, makeMove, chess]);

  // Chessground configuration
  const config = useMemo<Config>(() => ({
    fen: chess?.fen() || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation,
    turnColor: game?.turn || 'white',
    lastMove,
    check,
    movable: {
      free: false,
      color: canMove ? myColor || undefined : undefined,
      dests: legalMoves,
      showDests: true,
    },
    selectable: {
      enabled: canBan,
    },
    draggable: {
      enabled: canMove,
    },
    events: {
      move: handleMove,
      select: (square: Square) => {
        if (canBan) {
          // Show possible ban destinations when selecting opponent piece
          const dests = legalMoves.get(square);
          if (dests && dests.length > 0) {
            previewBan(square, dests[0] as Square);
          }
        }
      },
    },
    drawable: {
      enabled: true,
      visible: true,
      shapes,
    },
    animation: {
      enabled: true,
      duration: 250,
    },
  }), [
    chess, 
    orientation, 
    game?.turn, 
    lastMove, 
    check, 
    canMove, 
    canBan,
    myColor, 
    legalMoves, 
    handleMove,
    shapes,
    previewBan,
  ]);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 560,
        aspectRatio: '1/1',
        position: 'relative',
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: 3,
        bgcolor: 'background.paper',
        ...(canBan && {
          outline: '3px solid',
          outlineColor: 'error.main',
          outlineOffset: 2,
        }),
      }}
    >
      <AnimatePresence>
        {canBan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 10,
              background: 'radial-gradient(circle, transparent 30%, rgba(255,0,0,0.1) 100%)',
            }}
          />
        )}
      </AnimatePresence>
      
      <Chessground config={config} />
    </Box>
  );
}