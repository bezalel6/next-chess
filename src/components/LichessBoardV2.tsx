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
import { useBanMutation, useMoveMutation } from "@/hooks/useGameQueries";
import { Chess } from "chess.ts";
import type { Square } from "chess.ts/dist/types";
import { motion, AnimatePresence } from "framer-motion";

const Chessground = dynamic(() => import("@react-chess/chessground"), {
  ssr: false,
});

type Config = ComponentProps<typeof Chessground>["config"];

interface LichessBoardV2Props {
  orientation: "white" | "black";
}

export default function LichessBoardV2({ orientation }: LichessBoardV2Props) {
  // Use individual selectors to avoid infinite loops
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const mode = useUnifiedGameStore(s => s.mode);
  const phase = useUnifiedGameStore(s => s.phase);
  const localPhase = useUnifiedGameStore(s => s.localPhase);
  const localGameStatus = useUnifiedGameStore(s => s.localGameStatus);
  const makeMove = useUnifiedGameStore(s => s.makeMove);
  const storeBanMove = useUnifiedGameStore(s => s.banMove); // Rename to avoid conflict
  const currentBannedMove = useUnifiedGameStore(s => s.currentBannedMove);
  const highlightedSquares = useUnifiedGameStore(s => s.highlightedSquares);
  const previewMove = useUnifiedGameStore(s => s.previewMove);
  const optimisticMove = useUnifiedGameStore(s => s.optimisticMove);
  const optimisticBan = useUnifiedGameStore(s => s.optimisticBan);
  
  // Use mutations for online games
  const banMutation = useBanMutation(game?.id);
  const moveMutation = useMoveMutation(game?.id);
  
  // Calculate canBan and canMove based on the state
  const canBan = mode === 'local' 
    ? (localPhase === 'banning' && localGameStatus === 'active')
    : phase === 'selecting_ban';
    
  const canMove = mode === 'local'
    ? (localPhase === 'playing' && localGameStatus === 'active')
    : (phase === 'making_move' && game?.turn === myColor && game?.status === 'active');
  
  // Get navigation state and pending operation from store
  const { navigationFen, navigationBan, viewingPly, pendingOperation, optimisticFen } = useGameStore();

  // Test input refs for automation
  const testInputRef = useRef<HTMLInputElement>(null);

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

  // Calculate legal moves (excluding banned move)
  const legalMoves = useMemo(() => {
    if (!chess || !game || game.status !== "active") return new Map();

    const moves = new Map<string, string[]>();
    
    // Use optimistic ban if available, otherwise current banned move
    const effectiveBannedMove = optimisticBan || currentBannedMove;

    // If we're in ban phase, show opponent's moves
    if (canBan) {
      // Determine who will be moving after the ban
      // The banning player bans the opponent's next move
      const movingPlayerColor = game.turn; // The player who will move after ban
      const movingPlayerNotation = movingPlayerColor === "white" ? "w" : "b";
      
      chess.moves({ verbose: true }).forEach((move) => {
        // Only show the moving player's pieces' moves (these are what can be banned)
        const piece = chess.get(move.from as Square);
        if (piece && piece.color === movingPlayerNotation) {
          const from = move.from;
          const to = move.to;
          const dests = moves.get(from) || [];
          moves.set(from, [...dests, to]);
        }
      });
    }
    // If we can move, show our moves (excluding banned)
    else if (canMove) {
      chess.moves({ verbose: true }).forEach((move) => {
        // Skip if this is the banned move
        if (
          effectiveBannedMove &&
          move.from === effectiveBannedMove.from &&
          move.to === effectiveBannedMove.to
        ) {
          return;
        }

        const from = move.from;
        const to = move.to;
        const dests = moves.get(from) || [];
        moves.set(from, [...dests, to]);
      });
    }

    return moves;
  }, [chess, game, canBan, canMove, myColor, currentBannedMove, optimisticBan]);

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

  // Handle piece movement
  const handleMove = useCallback(
    (from: string, to: string) => {
      if (canBan) {
        // Play ban sound
        const audio = new Audio("/sounds/check.wav");
        audio.play().catch(() => {});
        // Use mutation for online games, store for local games
        if (mode === 'online') {
          banMutation.mutate({ from: from as Square, to: to as Square });
        } else {
          storeBanMove(from as Square, to as Square);
        }
      } else if (canMove) {
        // Check for promotion
        const move = chess?.move({
          from: from as Square,
          to: to as Square,
          promotion: "q",
        });
        if (move) {
          chess?.undo(); // Undo local move, server will handle it

          // Use mutation for online games, direct store update for local
          if (mode === 'online' && moveMutation) {
            if (move.promotion) {
              // TODO: Show promotion dialog
              moveMutation.mutate({ from: from as Square, to: to as Square, promotion: "q" });
            } else {
              moveMutation.mutate({ from: from as Square, to: to as Square });
            }
          } else {
            if (move.promotion) {
              makeMove(from as Square, to as Square, "q");
            } else {
              makeMove(from as Square, to as Square);
            }
          }
        }
      }
    },
    [canBan, canMove, storeBanMove, makeMove, chess, mode, banMutation, moveMutation]
  );

  // Handle square-based input (e.g., "e2" for selection, "e2 e4" for move)
  const handleSquareInput = useCallback(
    (input: string) => {
      if (!chess || !input.trim()) return false;

      const parts = input.trim().toLowerCase().split(/\s+/);

      // Single square - simulate selection
      if (parts.length === 1) {
        const square = parts[0];
        // Validate square format
        if (!/^[a-h][1-8]$/.test(square)) {
          return false;
        }

        // Don't clear input on selection, wait for destination
        return true;
      }

      // Two squares - execute move/ban
      if (parts.length === 2) {
        const [from, to] = parts;
        // Validate square formats
        if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
          return false;
        }

        // Execute the move/ban
        handleMove(from, to);

        // Clear input
        if (testInputRef.current) {
          testInputRef.current.value = "";
        }
        return true;
      }

      return false;
    },
    [chess, handleMove, canBan, legalMoves]
  );

  // Test input handler for automation
  const handleTestInput = useCallback(() => {
    const input = testInputRef.current;
    if (!input || !input.value.trim()) return;

    const success = handleSquareInput(input.value.trim());

    if (!success && testInputRef.current) {
      // Invalid input - flash red border
      testInputRef.current.style.borderColor = "#ff0000";
      setTimeout(() => {
        if (testInputRef.current) {
          testInputRef.current.style.borderColor = canBan
            ? "#ff6b6b"
            : "#4CAF50";
        }
      }, 500);
    }
  }, [handleSquareInput, canBan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTestInput();
      }
    };

    const input = testInputRef.current;
    if (input) {
      input.addEventListener("keydown", handleKeyDown);
      return () => {
        input.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [handleTestInput]);

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
          ? myColor === "white"
            ? "black"
            : "white" // During ban phase, allow moving opponent's pieces
          : canMove
            ? myColor || undefined
            : undefined, // During move phase, allow moving own pieces
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
