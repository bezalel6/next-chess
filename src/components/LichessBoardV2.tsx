import dynamic from "next/dynamic";
import {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ComponentProps,
} from "react";
import { Box } from "@mui/material";
import { useGame } from "@/contexts/GameContextV2";
import { useGameStore } from "@/stores/gameStore";
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
  const {
    game,
    myColor,
    canBan,
    canMove,
    makeMove,
    banMove,
    phase,
    currentBannedMove,
    highlightedSquares,
    previewBan,
    previewMove,
  } = useGame();
  
  // Get navigation state from store
  const { navigationFen, navigationBan, viewingPly } = useGameStore();

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
    
    // Otherwise use current game position
    const c = new Chess(game.currentFen);
    if (game.pgn) {
      try {
        c.loadPgn(game.pgn);
      } catch {}
    }
    return c;
  }, [game?.currentFen, game?.pgn, navigationFen, viewingPly]);

  // Calculate legal moves (excluding banned move)
  const legalMoves = useMemo(() => {
    if (!chess || !game || game.status !== "active") return new Map();

    const moves = new Map<string, string[]>();

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
          currentBannedMove &&
          move.from === currentBannedMove.from &&
          move.to === currentBannedMove.to
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
    return turn === "w" ? "white" : "black";
  }, [chess]);

  // Create drawable shapes for banned move
  const shapes = useMemo(() => {
    const s: Config["drawable"]["shapes"] = [];

    // Determine which banned move to show (navigation or current)
    const bannedToShow = viewingPly !== null ? navigationBan : currentBannedMove;

    // Show banned move with red
    if (bannedToShow && !canBan) {
      s.push({
        orig: bannedToShow.from as Square,
        dest: bannedToShow.to as Square,
        brush: "red",
        modifiers: { lineWidth: 10 },
      });
    }

    // Show preview when hovering during ban selection
    if (canBan && highlightedSquares.length === 2) {
      s.push({
        orig: highlightedSquares[0] as Square,
        dest: highlightedSquares[1] as Square,
        brush: "yellow",
        modifiers: { lineWidth: 8 },
      });
    }

    return s;
  }, [currentBannedMove, canBan, highlightedSquares, viewingPly, navigationBan]);

  // Handle piece movement
  const handleMove = useCallback(
    (from: string, to: string) => {
      if (canBan) {
        // Play ban sound
        const audio = new Audio("/sounds/check.wav");
        audio.play().catch(() => {});
        banMove(from, to);
      } else if (canMove) {
        // Check for promotion
        const move = chess?.move({
          from: from as Square,
          to: to as Square,
          promotion: "q",
        });
        if (move) {
          chess?.undo(); // Undo local move, server will handle it

          if (move.promotion) {
            // TODO: Show promotion dialog
            makeMove(from, to, "q");
          } else {
            makeMove(from, to);
          }
        }
      }
    },
    [canBan, canMove, banMove, makeMove, chess]
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

        // For single square, we can trigger piece selection if in ban phase
        if (canBan) {
          // Show possible ban destinations when selecting opponent piece
          const dests = legalMoves.get(square);
          if (dests && dests.length > 0) {
            previewBan(square as Square, dests[0] as Square);
          }
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
    [chess, handleMove, canBan, legalMoves, previewBan]
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
      previewBan,
    ]
  );

  // Calculate banned square positions for overlay
  const bannedSquareOverlays = useMemo(() => {
    // Determine which banned move to show (navigation or current)
    const bannedToShow = viewingPly !== null ? navigationBan : currentBannedMove;
    
    console.log(
      "[LichessBoardV2] bannedToShow:",
      bannedToShow,
      "canBan:",
      canBan,
      "viewingPly:",
      viewingPly
    );

    if (!bannedToShow || canBan) return null;

    const squareSize = 100 / 8; // 12.5% of board size
    
    // Calculate coordinates based on board orientation
    const fileToX = (file: string) => {
      const fileIndex = file.charCodeAt(0) - 97;
      return orientation === 'white' 
        ? fileIndex * squareSize 
        : (7 - fileIndex) * squareSize;
    };
    
    const rankToY = (rank: string) => {
      const rankIndex = 8 - parseInt(rank);
      return orientation === 'white'
        ? rankIndex * squareSize
        : (7 - rankIndex) * squareSize;
    };

    const fromFile = bannedToShow.from[0];
    const fromRank = bannedToShow.from[1];
    const toFile = bannedToShow.to[0];
    const toRank = bannedToShow.to[1];

    const overlays = {
      from: {
        left: `${fileToX(fromFile)}%`,
        top: `${rankToY(fromRank)}%`,
      },
      to: {
        left: `${fileToX(toFile)}%`,
        top: `${rankToY(toRank)}%`,
      },
    };

    console.log("[LichessBoardV2] bannedSquareOverlays:", overlays);
    return overlays;
  }, [currentBannedMove, canBan, viewingPly, navigationBan, orientation]);

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

      {/* Banned move overlay indicators */}
      {bannedSquareOverlays && (
        <>
          {/* From square indicator */}
          <div
            style={{
              position: "absolute",
              left: bannedSquareOverlays.from.left,
              top: bannedSquareOverlays.from.top,
              width: "12.5%",
              height: "12.5%",
              background:
                "radial-gradient(circle, rgba(255,0,0,0.6) 20%, rgba(255,0,0,0.3) 80%)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
          {/* To square indicator with X */}
          <div
            style={{
              position: "absolute",
              left: bannedSquareOverlays.to.left,
              top: bannedSquareOverlays.to.top,
              width: "12.5%",
              height: "12.5%",
              background:
                "radial-gradient(circle, rgba(255,0,0,0.8) 30%, rgba(255,0,0,0.4) 90%)",
              pointerEvents: "none",
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "2rem",
                color: "rgba(255,255,255,0.9)",
                fontWeight: "bold",
              }}
            >
              ✕
            </span>
          </div>
        </>
      )}

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
