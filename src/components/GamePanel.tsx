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
  white?: MoveData;
  black?: MoveData;
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
      const moveWithComments = chess.pgn().split('\n').find(line => 
        line.includes(move.san) && line.includes('banning:')
      );
      
      if (moveWithComments) {
        const banMatch = moveWithComments.match(/banning:\s*([a-h][1-8])([a-h][1-8])/);
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
  const [navigationState, setNavigationState] = useState<NavigationState>({
    moveIndex: -1,
    phase: "initial",
  });
  const [hasInitialized, setHasInitialized] = useState(false);

  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const gameActions = useGameActions();

  // For local games, parse PGN instead of fetching from database
  const { data: movesData = [], isLoading, refetch } = useQuery({
    queryKey: ["moves", game?.id, game?.pgn],
    queryFn: async () => {
      console.log("[GamePanel] Fetching moves for game:", game?.id);
      console.log("[GamePanel] Current game PGN:", game?.pgn);
      console.log("[GamePanel] Is local game:", isLocalGame);

      if (!game?.id) {
        console.log("[GamePanel] No game ID, returning empty array");
        return [];
      }

      // For local games, parse the PGN to create move data
      if (isLocalGame) {
        console.log("[GamePanel] Local game - parsing PGN");
        return parsePgnToMoveData(game.pgn || "");
      }

      // For online games, fetch from database
      const { data, error } = await supabase.rpc("get_game_moves", {
        p_game_id: game.id,
      });

      if (error) {
        console.error("[GamePanel] Error fetching moves:", error);
        return [];
      }

      console.log("[GamePanel] Fetched moves data:", data);
      return (data as MoveData[]) || [];
    },
    enabled: !!game?.id,
    refetchInterval: false, // Rely on real-time updates
  });

  // Server broadcasts are now authoritative; no separate moves subscription.

  // Convert flat moves array to paired moves for display
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

    return paired;
  }, [movesData]);

  // Get the currently selected move based on navigation state
  const selectedMove = useMemo(() => {
    if (
      navigationState.moveIndex >= 0 &&
      navigationState.moveIndex < movesData.length
    ) {
      return movesData[navigationState.moveIndex];
    }
    return null;
  }, [navigationState.moveIndex, movesData]);

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
  
  // Auto-navigate to new moves when they arrive (unless user manually navigated)
  useEffect(() => {
    if (movesData.length > 0 && hasInitialized && !userNavigatedAway) {
      const newIndex = movesData.length - 1;
      // Always jump to new moves unless user explicitly navigated away
      setNavigationState({
        moveIndex: newIndex,
        phase: "after-move",
      });
    }
  }, [movesData.length]); // Intentionally not including all deps to prevent loops

  // Auto-scroll to the latest move when new moves are added (unless user navigated away)
  useEffect(() => {
    if (moveHistoryRef.current && moves.length > 0 && !userNavigatedAway) {
      // Scroll to bottom when new moves arrive
      const container = moveHistoryRef.current;
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 50); // Small delay to ensure DOM is updated
    }
  }, [moves.length, userNavigatedAway]);

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
      move: MoveData,
      clickedPhase: "after-ban" | "after-move" = "after-move"
    ) => {
      const { navigateToPosition } = useUnifiedGameStore.getState();

      // Navigate to the appropriate position based on phase
      if (clickedPhase === "after-ban" && move.banned_from && move.banned_to) {
        // Show position after ban but before move
        const bannedMove = {
          from: move.banned_from as Square,
          to: move.banned_to as Square,
        };
        // Use fen_before if available, otherwise use previous move's fen_after
        const fenToUse =
          move.fen_before ||
          (move.ply_number > 0
            ? movesData[move.ply_number - 1]?.fen_after
            : null) ||
          "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        navigateToPosition(move.ply_number, fenToUse, bannedMove);
      } else {
        // Show position after move
        const bannedMove =
          move.banned_from && move.banned_to
            ? { from: move.banned_from as Square, to: move.banned_to as Square }
            : null;
        navigateToPosition(move.ply_number, move.fen_after, bannedMove);
      }

      setNavigationState({
        moveIndex: move.ply_number,
        phase: clickedPhase,
      });
      
      // User manually navigated - mark as navigated away if not at latest
      const isAtLatest = move.ply_number === movesData.length - 1 && clickedPhase === "after-move";
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

  const navigateToNext = useCallback(() => {
    const { moveIndex, phase } = navigationState;

    if (phase === "initial") {
      // From initial, go to first move's after-ban or after-move
      if (movesData.length > 0) {
        if (movesData[0].banned_from) {
          handleMoveClick(movesData[0], "after-ban");
        } else {
          handleMoveClick(movesData[0], "after-move");
        }
      }
    } else if (phase === "after-ban") {
      // From after-ban, go to after-move
      handleMoveClick(movesData[moveIndex], "after-move");
    } else if (phase === "after-move") {
      // From after-move, go to next move's after-ban or after-move
      if (moveIndex < movesData.length - 1) {
        const nextMove = movesData[moveIndex + 1];
        if (nextMove.banned_from) {
          handleMoveClick(nextMove, "after-ban");
        } else {
          handleMoveClick(nextMove, "after-move");
        }
      }
    }
  }, [navigationState, handleMoveClick, movesData]);

  const navigateToLast = useCallback(() => {
    if (movesData.length > 0) {
      // Don't use handleMoveClick as it sets userNavigatedAway
      const lastMove = movesData[movesData.length - 1];
      const { navigateToPosition } = useUnifiedGameStore.getState();
      
      const bannedMove = lastMove.banned_from && lastMove.banned_to
        ? { from: lastMove.banned_from as Square, to: lastMove.banned_to as Square }
        : null;
      navigateToPosition(lastMove.ply_number, lastMove.fen_after, bannedMove);
      
      setNavigationState({
        moveIndex: lastMove.ply_number,
        phase: "after-move",
      });
      setUserNavigatedAway(false); // Back to latest, allow auto-follow
    } else {
      // If no moves, stay at initial position
      navigateToFirst();
    }
  }, [movesData, navigateToFirst]);

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

  console.log("[GamePanel] Rendering - isLoading:", isLoading);
  console.log("[GamePanel] Rendering - movesData:", movesData);
  console.log("[GamePanel] Rendering - movesData length:", movesData.length);
  console.log("[GamePanel] Rendering - game PGN:", game?.pgn);

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
      {userNavigatedAway && movesData.length > 0 && (
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
            ← Go to latest move
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
              disabled={
                navigationState.moveIndex >= movesData.length - 1 &&
                navigationState.phase === "after-move"
              }
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
              disabled={
                navigationState.moveIndex >= movesData.length - 1 &&
                navigationState.phase === "after-move"
              }
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
          {/* Game moves */}
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

  return (
    <Box
      sx={{
        display: "table-row",
      }}
    >
      <Box
        sx={{
          display: "table-cell",
          pr: 0.5,
          pl: 1,
          color: "#888",
          fontSize: "1.1rem",
          textAlign: "right",
          verticalAlign: "middle",
          width: "12%",
          fontWeight: 400,
          bgcolor: whiteIsDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)", // Same as white cell
          py: 0.5,
        }}
      >
        {move.number}.
      </Box>
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
          bgcolor: whiteIsDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)",
          cursor: move.white ? "pointer" : "default",
          width: "44%",
          fontWeight:
            selectedMove?.ply_number === move.white?.ply_number ? 600 : 400,
          "&:hover": move.white
            ? {
                bgcolor: whiteIsDark
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.06)",
              }
            : {},
          // Use outline for selection instead of background
          outline:
            selectedMove?.ply_number === move.white?.ply_number
              ? "2px solid rgba(255,204,0,0.8)"
              : "none",
          outlineOffset: "-2px",
          position: "relative",
        }}
        onClick={
          move.white ? () => onMoveClick(move.white, "after-move") : undefined
        }
      >
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
          bgcolor: !whiteIsDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)", // Opposite of white cell
          cursor: move.black ? "pointer" : "default",
          width: "44%",
          fontWeight:
            selectedMove?.ply_number === move.black?.ply_number ? 600 : 400,
          "&:hover": move.black
            ? {
                bgcolor: !whiteIsDark
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.06)",
              }
            : {},
          // Use outline for selection instead of background
          outline:
            selectedMove?.ply_number === move.black?.ply_number
              ? "2px solid rgba(255,204,0,0.8)"
              : "none",
          outlineOffset: "-2px",
          position: "relative",
        }}
        onClick={
          move.black ? () => onMoveClick(move.black, "after-move") : undefined
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
  move: MoveData;
  isSelected: boolean;
  isBanPhase: boolean;
  onBanClick?: () => void;
}) {
  const hasBan = move.banned_from && move.banned_to;

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
        }}
      >
        {move.san}
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
