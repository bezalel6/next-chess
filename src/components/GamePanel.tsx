import { Box, Typography, Tooltip, IconButton, Button } from "@mui/material";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import type { Square } from "chess.ts/dist/types";
import BlockIcon from "@mui/icons-material/Block";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import CachedIcon from "@mui/icons-material/Cached";
import FlagIcon from "@mui/icons-material/Flag";
import HandshakeIcon from "@mui/icons-material/Handshake";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";

import { useSingleKeys, Keys } from "@/hooks/useKeys";
import { supabase } from "@/utils/supabase";
import { useQuery } from "@tanstack/react-query";
import { useGameActions } from "@/hooks/useGameActions";
import ConfirmActionButton from "./ConfirmActionButton";
import { Chess } from "chess.ts";

type MoveData = {
  id: string;
  move_number: number;
  ply_number: number;
  player_color: "white" | "black";
  from_square: string;
  to_square: string;
  promotion?: string;
  san: string;
  fen_after: string;
  fen_before?: string; // FEN before the move was made
  banned_from?: string;
  banned_to?: string;
  banned_by?: "white" | "black";
  time_taken_ms?: number;
};

// Navigation state type - now tracks half-moves
type NavigationState = {
  moveIndex: number; // -1 for initial position, 0+ for moves
  phase: "initial" | "after-ban" | "after-move"; // Which phase within a move
};

type Move = {
  number: number;
  white?: MoveData & { isPending?: boolean };
  black?: MoveData & { isPending?: boolean };
};

// Helper function to parse PGN into MoveData for local games
function parsePgnToMoveData(pgn: string): MoveData[] {
  if (!pgn.trim()) return [];

  try {
    const chess = new Chess();
    chess.loadPgn(pgn);

    const moves: MoveData[] = [];
    const history = chess.history({ verbose: true });

    // Reset to starting position and replay moves to capture intermediate FENs
    const replayChess = new Chess();

    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      const moveNumber = Math.floor(i / 2) + 1;
      const isWhiteMove = i % 2 === 0;

      // Capture FEN before the move
      const fenBefore = replayChess.fen();

      // Make the move
      replayChess.move(move);
      const fenAfter = replayChess.fen();

      // Check for ban comments in the current position
      // Ban Chess uses comments like: {[%clk banning: e2e4]}
      let bannedFrom: string | undefined;
      let bannedTo: string | undefined;
      let bannedBy: "white" | "black" | undefined;

      // Try to extract ban info from PGN comments
      // This is a simplified approach - real implementation might need more sophisticated parsing
      const moveWithComments = chess
        .pgn()
        .split("\n")
        .find((line) => line.includes(move.san) && line.includes("banning:"));

      if (moveWithComments) {
        const banMatch = moveWithComments.match(
          /banning:\s*([a-h][1-8])([a-h][1-8])/
        );
        if (banMatch) {
          bannedFrom = banMatch[1];
          bannedTo = banMatch[2];
          bannedBy = isWhiteMove ? "white" : "black";
        }
      }

      const moveData: MoveData = {
        id: `local-${i}`,
        move_number: moveNumber,
        ply_number: i,
        player_color: isWhiteMove ? "white" : "black",
        from_square: move.from,
        to_square: move.to,
        promotion: move.promotion || undefined,
        san: move.san,
        fen_after: fenAfter,
        fen_before: fenBefore,
        banned_from: bannedFrom,
        banned_to: bannedTo,
        banned_by: bannedBy,
      };

      moves.push(moveData);
    }

    return moves;
  } catch (error) {
    console.error("Failed to parse PGN:", error);
    return [];
  }
}

const GamePanel = () => {
  const game = useUnifiedGameStore((s) => s.game);
  const setPgn = useUnifiedGameStore((s) => s.setPgn);
  const actions = useUnifiedGameStore((s) => s.actions);
  const myColor = useUnifiedGameStore((s) => s.myColor);
  const isLocalGame = useUnifiedGameStore((s) => s.mode === "local");
  const boardOrientation = useUnifiedGameStore((s) => s.boardOrientation);
  const currentBannedMove = useUnifiedGameStore((s) => s.currentBannedMove);
  const phase = useUnifiedGameStore((s) => s.phase);
  const currentTurn = useUnifiedGameStore((s) => s.currentTurn);
  const [navigationState, setNavigationState] = useState<NavigationState>({
    moveIndex: -1,
    phase: "initial",
  });
  const [hasInitialized, setHasInitialized] = useState(false);

  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const gameActions = useGameActions();

  // For local games, use moveHistory from store; for online games, parse PGN
  const storeMovesHistory = useUnifiedGameStore((s) => s.moveHistory);
  const { data: movesData = [], isLoading } = useQuery({
    queryKey: ["moves-from-pgn", game?.id, game?.pgn, isLocalGame ? storeMovesHistory : null],
    queryFn: async () => {
      if (!game?.id) return [];
      
      // For local games, transform store's moveHistory to match MoveData format
      if (isLocalGame) {
        return storeMovesHistory.map((move, index) => ({
          id: `local-${index}`,
          move_number: Math.floor(index / 2) + 1,
          ply_number: index,
          player_color: index % 2 === 0 ? "white" : "black",
          from_square: move.from,
          to_square: move.to,
          san: move.san,
          fen_after: move.fen,
          fen_before: index > 0 ? storeMovesHistory[index - 1].fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          banned_from: move.bannedMove?.from,
          banned_to: move.bannedMove?.to,
          banned_by: move.bannedMove?.byPlayer,
        } as MoveData));
      }
      
      // For online games, parse from PGN
      return parsePgnToMoveData(game.pgn || "");
    },
    enabled: !!game?.id,
    refetchInterval: false,
  });

  // Server broadcasts are authoritative; moves are derived from PGN only.

  // Convert flat moves array to paired moves for display, including pending bans
  const moves = useMemo<Move[]>(() => {
    const paired: Move[] = [];
    const movesByNumber = new Map<number, Move>();

    for (let i = 0; i < movesData.length; i++) {
      const move = movesData[i];
      const moveNumber = move.move_number;

      // Get or create the move pair for this move number
      let movePair = movesByNumber.get(moveNumber);
      if (!movePair) {
        movePair = { number: moveNumber };
        movesByNumber.set(moveNumber, movePair);
        paired.push(movePair);
      }

      // Add the move data to the appropriate color slot
      if (move.player_color === "white") {
        movePair.white = move;
      } else {
        movePair.black = move;
      }
    }

    // Add pending ban if one exists (ban without corresponding move yet)
    if (currentBannedMove && phase === "making_move") {
      const nextMoveNumber = Math.floor(movesData.length / 2) + 1;
      const isWhiteTurn = currentTurn === "white";
      
      // Check if we need to add this to an existing move pair or create a new one
      let movePair = movesByNumber.get(nextMoveNumber);
      if (!movePair) {
        movePair = { number: nextMoveNumber };
        movesByNumber.set(nextMoveNumber, movePair);
        paired.push(movePair);
      }
      
      // Create a "pending" move entry that only has ban info
      // This is a real move in the sequence, just waiting for the actual chess move
      const pendingMove: MoveData & { isPending?: boolean } = {
        id: `pending-${movesData.length}`, // Temporary ID for pending move
        ply_number: movesData.length, // This IS the next ply in sequence
        move_number: nextMoveNumber,
        player_color: isWhiteTurn ? "white" : "black",
        san: "", // No move yet
        from_square: "", // No move yet
        to_square: "", // No move yet
        fen_after: "", // Will be filled when move is made
        banned_from: currentBannedMove.from,
        banned_to: currentBannedMove.to,
        isPending: true, // Mark as pending (ban without move)
      };
      
      if (isWhiteTurn) {
        movePair.white = pendingMove;
      } else {
        movePair.black = pendingMove;
      }
    }

    return paired;
  }, [movesData, currentBannedMove, phase, currentTurn]);

  // Get the currently selected move based on navigation state
  const selectedMove = useMemo(() => {
    if (
      navigationState.moveIndex >= 0 &&
      navigationState.moveIndex < movesData.length
    ) {
      return movesData[navigationState.moveIndex];
    }
    // Check if we're on a pending ban
    if (currentBannedMove && phase === "making_move" && 
        navigationState.moveIndex === movesData.length) {
      // Return a synthetic move for the pending ban
      return {
        ply_number: movesData.length,
        isPending: true
      } as any;
    }
    return null;
  }, [navigationState.moveIndex, movesData, currentBannedMove, phase]);

  // Reset initialization when game changes
  useEffect(() => {
    setHasInitialized(false);
    setNavigationState({ moveIndex: -1, phase: "initial" });
  }, [game?.id]);

  // Initialize to show the last move as active when moves are loaded
  useEffect(() => {
    if (!hasInitialized && movesData.length > 0) {
      // Only set to last move on initial load
      setNavigationState({
        moveIndex: movesData.length - 1,
        phase: "after-move",
      });
      setHasInitialized(true);
    }
  }, [movesData.length, hasInitialized]);

  // Track if user has manually navigated away from latest
  const [userNavigatedAway, setUserNavigatedAway] = useState(false);

  // Helper to get the latest game position dynamically
  const getLatestPosition = useCallback(() => {
    // If there's a pending ban, that's the latest
    if (currentBannedMove && phase === "making_move") {
      return {
        moveIndex: movesData.length,
        phase: "after-ban" as const,
        isPending: true
      };
    }
    // Otherwise, the last move in the data
    if (movesData.length > 0) {
      return {
        moveIndex: movesData.length - 1,
        phase: "after-move" as const,
        isPending: false
      };
    }
    // Initial position
    return {
      moveIndex: -1,
      phase: "initial" as const,
      isPending: false
    };
  }, [movesData.length, currentBannedMove, phase]);

  // Auto-navigate to latest position when it changes
  useEffect(() => {
    if (!userNavigatedAway && hasInitialized) {
      const latest = getLatestPosition();
      setNavigationState({
        moveIndex: latest.moveIndex,
        phase: latest.phase,
      });
    }
  }, [getLatestPosition, userNavigatedAway, hasInitialized]);

  // Auto-scroll to the latest position (including pending bans)
  useEffect(() => {
    if (moveHistoryRef.current && !userNavigatedAway) {
      const latest = getLatestPosition();
      // Only scroll if we have something to show
      if (latest.moveIndex >= 0 || moves.length > 0) {
        const container = moveHistoryRef.current;
        setTimeout(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }, 50); // Small delay to ensure DOM is updated
      }
    }
  }, [moves.length, getLatestPosition, userNavigatedAway]);

  // Scroll to the selected move when navigating
  useEffect(() => {
    if (moveHistoryRef.current && navigationState.moveIndex >= 0) {
      // Find the element for the current move
      const moveElements =
        moveHistoryRef.current.querySelectorAll("[data-ply]");
      const targetElement = Array.from(moveElements).find(
        (el) =>
          el.getAttribute("data-ply") === navigationState.moveIndex.toString()
      );

      if (targetElement) {
        // Scroll the element into view smoothly
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [navigationState.moveIndex]);

  // Handle move selection - now supports half-move navigation
  const handleMoveClick = useCallback(
    (
      move: MoveData & { isPending?: boolean },
      clickedPhase: "after-ban" | "after-move" = "after-move"
    ) => {
      const { navigateToPosition, currentFen } = useUnifiedGameStore.getState();

      // Navigate to the appropriate position based on phase
      if (clickedPhase === "after-ban" && move.banned_from && move.banned_to) {
        // Show position after ban but before move
        const bannedMove = {
          from: move.banned_from as Square,
          to: move.banned_to as Square,
        };
        
        // For pending moves (ban without move), use current board position
        // For completed moves, use the position before the move
        const fenToUse = move.isPending 
          ? currentFen 
          : (move.fen_before ||
            (move.ply_number > 0
              ? movesData[move.ply_number - 1]?.fen_after
              : null) ||
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
            
        navigateToPosition(move.ply_number, fenToUse, bannedMove);
      } else {
        // Show position after move (not applicable for pending moves)
        const bannedMove =
          move.banned_from && move.banned_to
            ? { from: move.banned_from as Square, to: move.banned_to as Square }
            : null;
        navigateToPosition(move.ply_number, move.fen_after || currentFen, bannedMove);
      }

      setNavigationState({
        moveIndex: move.ply_number,
        phase: clickedPhase,
      });

      // User manually navigated - mark as navigated away if not at latest
      const isAtLatest =
        move.ply_number === movesData.length - 1 &&
        clickedPhase === "after-move";
      setUserNavigatedAway(!isAtLatest);
    },
    [movesData]
  );

  // Navigation functions with half-move support
  const navigateToFirst = useCallback(() => {
    // Go to initial position (before any moves)
    const { navigateToPosition } = useUnifiedGameStore.getState();
    // Navigate to initial chess position with ply -1
    const initialFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    navigateToPosition(-1, initialFen, null);
    setNavigationState({ moveIndex: -1, phase: "initial" });
    setUserNavigatedAway(true); // User manually navigated
  }, []);

  const navigateToPrevious = useCallback(() => {
    const { moveIndex, phase } = navigationState;

    if (phase === "after-move" && movesData[moveIndex]?.banned_from) {
      // If at after-move and there was a ban, go to after-ban
      handleMoveClick(movesData[moveIndex], "after-ban");
    } else if (
      phase === "after-ban" ||
      (phase === "after-move" && !movesData[moveIndex]?.banned_from)
    ) {
      // Go to previous move's after-move phase
      if (moveIndex > 0) {
        handleMoveClick(movesData[moveIndex - 1], "after-move");
      } else {
        // Go to initial position
        navigateToFirst();
      }
    } else if (phase === "initial" && movesData.length > 0) {
      // Can't go before initial
      return;
    }
  }, [navigationState, handleMoveClick, movesData, navigateToFirst]);

  // Helper to check if we can navigate to next position
  const canNavigateNext = useMemo(() => {
    const { moveIndex, phase: navPhase } = navigationState;
    const latest = getLatestPosition();
    
    // Already at latest? Can't go further
    if (moveIndex === latest.moveIndex && navPhase === latest.phase) {
      return false;
    }
    
    // From initial, can go next if there are moves or pending ban
    if (navPhase === "initial") {
      return movesData.length > 0 || (currentBannedMove !== null && phase === "making_move");
    }
    
    // From after-ban, can always go to after-move (same move index)
    if (navPhase === "after-ban") {
      return moveIndex < movesData.length;
    }
    
    // From after-move, check if there's a next move or pending ban
    if (navPhase === "after-move") {
      // Is there another completed move?
      if (moveIndex < movesData.length - 1) return true;
      // Is there a pending ban?
      if (moveIndex === movesData.length - 1 && currentBannedMove !== null && phase === "making_move") return true;
    }
    
    return false;
  }, [navigationState, movesData, getLatestPosition, currentBannedMove, phase]);

  const navigateToNext = useCallback(() => {
    if (!canNavigateNext) return;
    
    const { moveIndex, phase: navPhase } = navigationState;

    if (navPhase === "initial") {
      // From initial, go to first move or pending ban
      if (movesData.length > 0) {
        const firstMove = movesData[0];
        if (firstMove && firstMove.banned_from) {
          handleMoveClick(firstMove, "after-ban");
        } else if (firstMove) {
          handleMoveClick(firstMove, "after-move");
        }
      } else if (currentBannedMove && phase === "making_move") {
        // Go to pending ban - use the actual current banned move only when we're truly at the latest
        handleMoveClick({
          ply_number: 0,
          isPending: true,
          banned_from: currentBannedMove.from,
          banned_to: currentBannedMove.to
        } as any, "after-ban");
      }
    } else if (navPhase === "after-ban" && moveIndex < movesData.length) {
      // From after-ban, go to after-move
      const currentMove = movesData[moveIndex];
      if (currentMove) {
        handleMoveClick(currentMove, "after-move");
      }
    } else if (navPhase === "after-move") {
      // From after-move, go to next move's after-ban or after-move
      if (moveIndex < movesData.length - 1) {
        const nextMove = movesData[moveIndex + 1];
        if (nextMove && nextMove.banned_from) {
          handleMoveClick(nextMove, "after-ban");
        } else if (nextMove) {
          handleMoveClick(nextMove, "after-move");
        }
      } else if (currentBannedMove && phase === "making_move" && moveIndex === movesData.length - 1) {
        // Go to pending ban - only use current banned move when we're truly at the latest position
        handleMoveClick({
          ply_number: movesData.length,
          isPending: true,
          banned_from: currentBannedMove.from,
          banned_to: currentBannedMove.to
        } as any, "after-ban");
      }
    }
  }, [navigationState, handleMoveClick, movesData, canNavigateNext, currentBannedMove, phase]);

  // Helper to check if we're at the latest position
  const isAtLatest = useMemo(() => {
    const latest = getLatestPosition();
    return navigationState.moveIndex === latest.moveIndex && 
           navigationState.phase === latest.phase;
  }, [navigationState, getLatestPosition]);

  const navigateToLast = useCallback(() => {
    const latest = getLatestPosition();
    const { navigateToPosition, currentFen } = useUnifiedGameStore.getState();
    
    if (latest.isPending && currentBannedMove) {
      // Pending ban - use current position with ban overlay
      navigateToPosition(
        latest.moveIndex,
        currentFen,
        { from: currentBannedMove.from as Square, to: currentBannedMove.to as Square }
      );
    } else if (latest.moveIndex >= 0 && latest.moveIndex < movesData.length) {
      // Completed move
      const move = movesData[latest.moveIndex];
      const bannedMove = move.banned_from && move.banned_to
        ? { from: move.banned_from as Square, to: move.banned_to as Square }
        : null;
      navigateToPosition(move.ply_number, move.fen_after, bannedMove);
    } else {
      // Initial position
      navigateToFirst();
      return;
    }
    
    setNavigationState({
      moveIndex: latest.moveIndex,
      phase: latest.phase,
    });
    setUserNavigatedAway(false);
  }, [getLatestPosition, movesData, navigateToFirst, currentBannedMove]);

  // Add keyboard navigation
  useSingleKeys(
    {
      key: Keys.ArrowLeft,
      callback: (e) => {
        e.preventDefault();
        navigateToPrevious();
      },
    },
    {
      key: Keys.ArrowRight,
      callback: (e) => {
        e.preventDefault();
        navigateToNext();
      },
    },
    {
      key: Keys.ArrowUp,
      callback: (e) => {
        e.preventDefault();
        navigateToFirst();
      },
    },
    {
      key: Keys.ArrowDown,
      callback: (e) => {
        e.preventDefault();
        navigateToLast();
      },
    },
    {
      key: "F",
      callback: () => {
        actions.flipBoardOrientation?.();
      },
    }
  );

  // Draw offer UI
  const renderDrawControls = () => {
    if (!myColor || game?.status !== "active") return null;

    const opponentColor = myColor === "white" ? "black" : "white";

    if (game.drawOfferedBy === myColor) {
      return (
        <Typography
          sx={{ color: "#888", fontSize: "0.85rem", fontStyle: "italic" }}
        >
          Draw offer sent
        </Typography>
      );
    }

    if (game.drawOfferedBy === opponentColor) {
      return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Accept Draw">
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => gameActions.acceptDraw()}
              startIcon={<CheckCircleIcon fontSize="small" />}
              sx={{ fontSize: "0.75rem", py: 0.25 }}
            >
              Accept
            </Button>
          </Tooltip>
          <Tooltip title="Decline Draw">
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => gameActions.declineDraw()}
              startIcon={<CancelIcon fontSize="small" />}
              sx={{ fontSize: "0.75rem", py: 0.25 }}
            >
              Decline
            </Button>
          </Tooltip>
        </Box>
      );
    }

    return (
      <ConfirmActionButton
        icon={<HandshakeIcon fontSize="small" />}
        tooltip="Offer Draw"
        confirmTooltip="Confirm draw offer"
        onConfirm={gameActions.offerDraw}
        color="info"
      />
    );
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Loading moves...
        </Typography>
      </Box>
    );
  }

  // Return the normal GamePanel UI even when no moves exist yet
  if (!movesData || movesData.length === 0) {
    // Show empty move history but maintain the full panel structure
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Show indicator when user navigated away from latest move */}
      {userNavigatedAway && !isAtLatest && (
        <Box
          sx={{
            p: 0.5,
            bgcolor: "rgba(255, 165, 0, 0.1)",
            borderTop: "1px solid rgba(255, 165, 0, 0.3)",
            textAlign: "center",
            cursor: "pointer",
            "&:hover": {
              bgcolor: "rgba(255, 165, 0, 0.2)",
            },
          }}
          onClick={navigateToLast}
        >
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "rgba(255, 165, 0, 0.9)",
              fontWeight: 500,
            }}
          >
            Go to latest move →
          </Typography>
        </Box>
      )}

      {/* Navigation Bar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 0.25,
          p: 0.5,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "rgba(0,0,0,0.2)",
        }}
      >
        <Tooltip title="First Move (Home)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToFirst}
              disabled={
                navigationState.moveIndex === -1 &&
                navigationState.phase === "initial"
              }
              sx={{
                color: "white",
                "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" },
              }}
            >
              <FirstPageIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Previous Move (Left Arrow)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToPrevious}
              disabled={
                navigationState.moveIndex === -1 &&
                navigationState.phase === "initial"
              }
              sx={{
                color: "white",
                "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" },
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Flip Board">
          <IconButton
            size="small"
            onClick={() => actions.flipBoardOrientation?.()}
            sx={{
              color: "white",
              mx: 1,
              bgcolor: (
                isLocalGame ? boardOrientation === "black" : myColor === "black"
              )
                ? "rgba(255,255,255,0.15)"
                : "transparent",
              "&:hover": {
                bgcolor: (
                  isLocalGame
                    ? boardOrientation === "black"
                    : myColor === "black"
                )
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(255,255,255,0.08)",
              },
            }}
          >
            <CachedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Next Move (Right Arrow)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToNext}
              disabled={!canNavigateNext}
              sx={{
                color: "white",
                "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" },
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Last Move (End)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToLast}
              disabled={isAtLatest}
              sx={{
                color: "white",
                "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" },
              }}
            >
              <LastPageIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {/* Move table with scroll */}
      <Box
        ref={moveHistoryRef}
        sx={{
          height: "150px",
          overflowY: "auto",
          overflowX: "hidden",
          width: "100%",
          p: 0,
          bgcolor: "rgba(0,0,0,0.1)",
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-track": {
            bgcolor: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.2)",
            borderRadius: "3px",
            "&:hover": {
              bgcolor: "rgba(255,255,255,0.3)",
            },
          },
        }}
      >
        <Box
          sx={{ width: "100%", display: "table", borderCollapse: "collapse" }}
        >
          {/* Game moves - now includes pending bans */}
          {moves.map((move) => (
            <MovesRow
              key={move.number}
              move={move}
              selectedMove={selectedMove}
              navigationState={navigationState}
              onMoveClick={handleMoveClick}
            />
          ))}
        </Box>
      </Box>

      {/* Game Actions Bar - only show for active games */}
      {game?.status === "active" && myColor && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 0.25,
            p: 0.5,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            bgcolor: "rgba(0,0,0,0.2)",
          }}
        >
          {/* Draw controls */}
          {renderDrawControls()}

          {/* Resign button */}
          <ConfirmActionButton
            icon={<FlagIcon fontSize="small" />}
            tooltip="Resign"
            confirmTooltip="Confirm resignation"
            onConfirm={gameActions.resign}
            color="error"
          />
        </Box>
      )}
    </Box>
  );
};

function MovesRow({
  move,
  selectedMove,
  navigationState,
  onMoveClick,
}: {
  move: Move;
  selectedMove: MoveData | null;
  navigationState: NavigationState;
  onMoveClick: (move: MoveData, phase: "after-ban" | "after-move") => void;
}) {
  // Checkered pattern: odd rows have light white cell, even rows have dark white cell
  const whiteIsDark = move.number % 2 === 0;
  const darkBg = "rgba(0,0,0,0.4)";
  const lightBg = "rgba(255,255,255,0.1)";

  return (
    <Box
      sx={{
        display: "table-row",
      }}
    >
      {/* White move cell (includes move number) */}
      <Box
        data-ply={move.white?.ply_number}
        sx={{
          display: "table-cell",
          py: 0.5,
          px: 1,
          color: "#bababa",
          fontSize: "1.2rem",
          textAlign: "left",
          verticalAlign: "middle",
          bgcolor: whiteIsDark ? darkBg : lightBg,
          cursor: move.white ? "pointer" : "default",
          width: "50%",
          fontWeight:
            selectedMove?.ply_number === move.white?.ply_number ? 600 : 400,
          "&:hover": move.white
            ? {
                bgcolor: whiteIsDark
                  ? "rgba(0,0,0,0.5)"
                  : "rgba(255,255,255,0.15)",
              }
            : {},
          // Use outline for selection only when NOT in ban phase and move exists
          outline:
            move.white && selectedMove?.ply_number === move.white.ply_number && 
            !(navigationState.moveIndex === move.white.ply_number && navigationState.phase === "after-ban")
              ? "2px solid rgba(255,204,0,0.8)"
              : "none",
          outlineOffset: "-2px",
          position: "relative",
        }}
        onClick={
          move.white ? () => onMoveClick(move.white, move.white.isPending ? "after-ban" : "after-move") : undefined
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {/* Move number integrated into white cell */}
          <Typography
            component="span"
            sx={{
              color: "#888",
              fontSize: "1.1rem",
              fontWeight: 400,
              minWidth: "28px",
              textAlign: "right",
            }}
          >
            {move.number}.
          </Typography>
          {move.white && (
            <MoveComponent
              move={move.white}
              isSelected={selectedMove?.ply_number === move.white.ply_number}
              isBanPhase={
                navigationState.moveIndex === move.white.ply_number &&
                navigationState.phase === "after-ban"
              }
              onBanClick={
                move.white.banned_from
                  ? () => onMoveClick(move.white, "after-ban")
                  : undefined
              }
            />
          )}
        </Box>
      </Box>
      {/* Black move cell */}
      <Box
        data-ply={move.black?.ply_number}
        sx={{
          display: "table-cell",
          py: 0.5,
          px: 1,
          color: "#bababa",
          fontSize: "1.2rem",
          textAlign: "left",
          verticalAlign: "middle",
          bgcolor: !whiteIsDark ? darkBg : lightBg, // Opposite of white cell
          cursor: move.black ? "pointer" : "default",
          width: "50%",
          fontWeight:
            selectedMove?.ply_number === move.black?.ply_number ? 600 : 400,
          "&:hover": move.black
            ? {
                bgcolor: !whiteIsDark
                  ? "rgba(0,0,0,0.5)"
                  : "rgba(255,255,255,0.15)",
              }
            : {},
          // Use outline for selection only when NOT in ban phase and move exists
          outline:
            move.black && selectedMove?.ply_number === move.black.ply_number &&
            !(navigationState.moveIndex === move.black.ply_number && navigationState.phase === "after-ban")
              ? "2px solid rgba(255,204,0,0.8)"
              : "none",
          outlineOffset: "-2px",
          position: "relative",
        }}
        onClick={
          move.black ? () => onMoveClick(move.black, move.black.isPending ? "after-ban" : "after-move") : undefined
        }
      >
        {move.black && (
          <MoveComponent
            move={move.black}
            isSelected={selectedMove?.ply_number === move.black.ply_number}
            isBanPhase={
              navigationState.moveIndex === move.black.ply_number &&
              navigationState.phase === "after-ban"
            }
            onBanClick={
              move.black.banned_from
                ? () => onMoveClick(move.black, "after-ban")
                : undefined
            }
          />
        )}
      </Box>
    </Box>
  );
}

function MoveComponent({
  move,
  isSelected,
  isBanPhase,
  onBanClick,
}: {
  move: MoveData & { isPending?: boolean };
  isSelected: boolean;
  isBanPhase: boolean;
  onBanClick?: () => void;
}) {
  const hasBan = move.banned_from && move.banned_to;
  const isPending = move.isPending || false;

  // Always use inline layout with consistent font sizes
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "2px 4px",
        gap: 0.5,
      }}
    >
      {/* Ban and move on same line */}
      {hasBan && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
            onBanClick?.();
          }}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            cursor: onBanClick ? "pointer" : "default",
            px: 0.3,
            py: 0.1,
            borderRadius: 0.5,
            bgcolor: isBanPhase ? "rgba(255,0,0,0.2)" : "transparent",
            border: isBanPhase ? "1px solid" : "none",
            borderColor: isBanPhase ? "error.main" : "transparent",
            transition: "all 0.2s",
            "&:hover": onBanClick ? { bgcolor: "rgba(255,0,0,0.1)" } : {},
          }}
        >
          <BlockIcon
            sx={{
              fontSize: 10,
              color: isBanPhase ? "error.light" : "error.dark",
            }}
          />
          <Typography
            component="span"
            sx={{
              fontWeight: isBanPhase ? "bold" : "normal",
              color: isBanPhase ? "error.light" : "error.dark",
              fontSize: "1rem",
            }}
          >
            {move.banned_from}
            {move.banned_to}
          </Typography>
        </Box>
      )}
      <Typography
        component="span"
        sx={{
          fontWeight: "normal",
          fontSize: "1.2rem",
          color: isPending ? "text.secondary" : "inherit",
        }}
      >
        {isPending ? "—" : move.san}
      </Typography>
      {move.time_taken_ms && (
        <Typography
          component="span"
          sx={{
            fontSize: "1rem",
            color: "text.secondary",
            ml: "auto",
          }}
        >
          {(move.time_taken_ms / 1000).toFixed(1)}s
        </Typography>
      )}
    </Box>
  );
}

export default GamePanel;
