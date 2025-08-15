import dynamic from "next/dynamic";
import {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ComponentProps,
} from "react";
import { Box } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useGameStore } from "@/stores/gameStore";
import { useGame } from "@/hooks/useGameQueries";
import { useAuth } from "@/contexts/AuthContext";
import { Chess } from "chess.ts";
import type { Square } from "chess.ts/dist/types";
import { motion, AnimatePresence } from "framer-motion";
import type { Config } from "chessground/config";
import type { Key } from "chessground/types";

const Chessground = dynamic(() => import("@react-chess/chessground"), {
  ssr: false,
});

interface LichessBoardV2Props {
  orientation: "white" | "black";
}

export default function LichessBoardV2({ orientation }: LichessBoardV2Props) {
  // Use individual selectors to avoid infinite loops
  // Use atomic selectors to avoid reference changes and infinite loops
  const game = useUnifiedGameStore(s => s.game);
  const mode = useUnifiedGameStore(s => s.mode);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const phase = useUnifiedGameStore(s => s.phase);
  const currentBannedMove = useUnifiedGameStore(s => s.currentBannedMove);
  const highlightedSquares = useUnifiedGameStore(s => s.highlightedSquares);
  const optimisticMove = useUnifiedGameStore(s => s.optimisticMove);
  const optimisticBan = useUnifiedGameStore(s => s.optimisticBan);
  const executeGameOperation = useUnifiedGameStore(s => s.executeGameOperation);
  const selectedSquare = useUnifiedGameStore(s => s.selectedSquare);
  const possibleMoves = useUnifiedGameStore(s => s.possibleMoves);
  
  // Use mutations for online games
  const banMutation = useBanMutation(game?.id);
  const moveMutation = useMoveMutation(game?.id);
  
  // Use unified selectors - computed values to avoid infinite loops
  const canBan = useUnifiedGameStore(s => s.phase === 'selecting_ban' && s.game?.status === 'active');
  const canMove = useUnifiedGameStore(s => {
    if (s.mode === 'local') {
      return s.phase === 'making_move' && s.game?.status === 'active';
    }
    const isMyTurn = s.mode !== 'spectator' && 
                    s.game?.turn === s.myColor && 
                    s.game?.status === 'active';
    return s.phase === 'making_move' && isMyTurn;
  });
  
  // Get navigation state and pending operation from store
  const { navigationFen, navigationBan, viewingPly, pendingOperation, optimisticFen } = useGameStore();


  // Parse current position (use navigation FEN if navigating)
  const chess = useMemo(() => {
    if (!game) return null;
    
    // If navigating through history, use the navigation FEN
    if (navigationFen && viewingPly !== null) {
      const c = new Chess(navigationFen);
      return c;
    }
    
    // Use optimistic FEN if we have one (after a move was made)
    if (optimisticFen && pendingOperation === 'move') {
      const c = new Chess(optimisticFen);
      console.log('[LichessBoardV2] Using optimistic FEN');
      return c;
    }
    
    // Otherwise use the current game FEN
    const c = new Chess(game.currentFen);
    return c;
  }, [game?.currentFen, navigationFen, viewingPly, optimisticFen, pendingOperation]);

  // Get legal moves from unified store - fixed to avoid infinite loop
  // Don't call functions in selectors! Get the store method separately
  const getLegalMoves = useUnifiedGameStore(s => s.getLegalMoves);
  const allLegalMoves = useMemo(() => getLegalMoves(), [getLegalMoves, game?.currentFen, currentBannedMove]);
  
  // Use possibleMoves when a square is selected, otherwise show all legal moves
  const legalMoves = useMemo(() => {
    if (selectedSquare && possibleMoves.length > 0) {
      // When a square is selected, only show moves from that square
      const movesMap = new Map<Key, Key[]>();
      movesMap.set(selectedSquare as Key, possibleMoves as Key[]);
      return movesMap;
    }
    // Otherwise show all legal moves (convert Map<string, string[]> to Map<Key, Key[]>)
    const convertedMoves = new Map<Key, Key[]>();
    allLegalMoves.forEach((dests, orig) => {
      convertedMoves.set(orig as Key, dests as Key[]);
    });
    return convertedMoves;
  }, [selectedSquare, possibleMoves, allLegalMoves]);

  // Get last move for highlighting
  const lastMove = useMemo(() => {
    if (!game?.lastMove) return undefined;
    return [game.lastMove.from, game.lastMove.to] as [Square, Square];
  }, [game?.lastMove]);

  // Check if king is in check
  const check = useMemo(() => {
    if (!chess || !chess.inCheck()) return undefined;
    const turn = chess.turn();
    return turn === "w" ? "white" : "black";
  }, [chess]);

  // Create drawable shapes for banned move
  const shapes = useMemo(() => {
    const s: Config["drawable"]["shapes"] = [];

    // Determine which banned move to show (navigation, optimistic, or current)
    const bannedToShow = viewingPly !== null ? navigationBan : (optimisticBan || currentBannedMove);
    
    console.log('[LichessBoardV2] Shapes debug:', {
      bannedToShow,
      optimisticBan: optimisticBan,
      currentBannedMove: currentBannedMove,
      canBan,
      viewingPly
    });

    // Show banned move with red arrow
    if (bannedToShow && !canBan) {
      console.log('[LichessBoardV2] Adding red arrow for banned move:', bannedToShow);
      s.push({
        orig: bannedToShow.from,
        dest: bannedToShow.to,
        brush: "red",
      });
    }

    // Show preview when hovering during ban selection
    if (canBan && highlightedSquares.length === 2) {
      s.push({
        orig: highlightedSquares[0],
        dest: highlightedSquares[1],
        brush: "yellow",
      });
    }

    return s;
  }, [currentBannedMove, canBan, highlightedSquares, viewingPly, navigationBan, optimisticBan]);

  // Handle piece movement using unified operation
  const handleMove = useCallback(
    (from: string, to: string) => {
      // Use unified operation handler
      const operation = canBan ? 'ban' : 'move';
      const success = executeGameOperation(operation, from as Square, to as Square, 'q');
      
      if (!success) {
        console.log(`Failed to execute ${operation}:`, from, to);
      }
    },
    [canBan, canMove, executeGameOperation]
  );


  // Chessground configuration
  const config = useMemo<Config>(
    () => ({
      fen:
        chess?.fen() ||
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      orientation,
      turnColor: game?.turn || "white",
      lastMove,
      check,
      movable: {
        free: false,
        color: canBan
          ? mode === 'local'
            ? game?.turn || undefined // In local mode during ban, allow moving pieces of the current turn
            : myColor === "white"
              ? "black"
              : "white" // In online mode during ban, allow moving opponent's pieces
          : canMove
            ? mode === 'local'
              ? game?.turn || undefined // In local mode during move, allow moving pieces of the current turn
              : myColor || undefined // In online mode during move, allow moving own pieces
            : undefined,
        dests: legalMoves,
        showDests: true,
        rookCastle: false, // Handle castling ourselves
      },
      selectable: {
        enabled: true, // Always enable selection to show moves on click
      },
      draggable: {
        enabled: canMove || canBan, // Enable dragging during both move and ban phases
        showGhost: true, // Show ghost piece while dragging
      },
      events: {
        move: handleMove,
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: shapes,
      },
      animation: {
        enabled: true,
        duration: 250,
      },
      coordinates: true, // Enable coordinate display
    }),
    [
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
    ]
  );


  return (
    <>
      <AnimatePresence>
        {canBan && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              zIndex: 10,
              background:
                "radial-gradient(circle, transparent 30%, rgba(255,0,0,0.1) 100%)",
              outline: "3px solid rgba(255,0,0,0.5)",
              outlineOffset: -3,
              borderRadius: "inherit",
            }}
          />
        )}
      </AnimatePresence>


      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          "& > div": {
            width: "100% !important",
            height: "100% !important",
          },
          "& .cg-wrap": {
            width: "100% !important",
            height: "100% !important",
            borderRadius: "inherit",
            // Add padding to prevent coordinate cutoff
            padding: "4px",
            boxSizing: "border-box",
          },
          // Make coordinate labels larger
          "& coords": {
            fontSize: "16px !important",
            fontWeight: "600 !important",
          },
          "& coords.ranks coord": {
            fontSize: "16px !important",
            fontWeight: "600 !important",
          },
          "& coords.files": {
            bottom: "7px !important",
            left: "-28px !important",
          },
          "& coords.files coord": {
            fontSize: "16px !important",
            fontWeight: "600 !important",
          },
          // Styles for banned move squares
          "& .cg-wrap square.banned-from": {
            background:
              "radial-gradient(circle, rgba(255,0,0,0.6) 20%, rgba(255,0,0,0.3) 80%) !important",
          },
          "& .cg-wrap square.banned-to": {
            background:
              "radial-gradient(circle, rgba(255,0,0,0.8) 30%, rgba(255,0,0,0.4) 90%) !important",
            "&::after": {
              content: '"✕"',
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "3rem",
              color: "rgba(255,255,255,0.9)",
              fontWeight: "bold",
              pointerEvents: "none",
            },
          },
          "& .cg-container": {
            position: "absolute !important",
            width: "100% !important",
            height: "100% !important",
          },
          "& cg-board": {
            width: "100% !important",
            height: "100% !important",
          },
          "& square": {
            width: "12.5% !important",
            height: "12.5% !important",
          },
        }}
      >
        <Chessground config={config} />
      </Box>
    </>
  );
}
