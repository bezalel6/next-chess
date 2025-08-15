import { Box, Typography, Tooltip, IconButton, Button } from "@mui/material";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useGameStore } from "@/stores/gameStore";
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
  banned_from?: string;
  banned_to?: string;
  banned_by?: "white" | "black";
  time_taken_ms?: number;
};

type Move = {
  number: number;
  white?: MoveData;
  black?: MoveData;
};

const GamePanel = () => {
  const game = useUnifiedGameStore((s) => s.game);
  const setPgn = useUnifiedGameStore((s) => s.setPgn);
  const actions = useUnifiedGameStore((s) => s.actions);
  const myColor = useUnifiedGameStore((s) => s.myColor);
  const isLocalGame = useUnifiedGameStore((s) => s.mode === "local");
  const boardOrientation = useUnifiedGameStore((s) => s.boardOrientation);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const gameActions = useGameActions();

  // Fetch moves from the database with real-time subscription
  const { data: movesData = [], isLoading } = useQuery({
    queryKey: ["moves", game?.id],
    queryFn: async () => {
      console.log("[GamePanel] Fetching moves for game:", game?.id);
      console.log("[GamePanel] Current game PGN:", game?.pgn);

      if (!game?.id) {
        console.log("[GamePanel] No game ID, returning empty array");
        return [];
      }

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

  // Subscribe to real-time move updates
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`moves:${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moves",
          filter: `game_id=eq.${game.id}`,
        },
        (payload) => {
          console.log("[GamePanel] New move received:", payload);
          // React Query will handle the refetch via invalidation in GameContext
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [game?.id]);

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

  // Get the currently selected move
  const selectedMove = useMemo(() => {
    return currentPlyIndex >= 0 && currentPlyIndex < movesData.length
      ? movesData[currentPlyIndex]
      : null;
  }, [currentPlyIndex, movesData]);

  // Auto-scroll to the latest move when new moves are added
  useEffect(() => {
    if (moveHistoryRef.current && moves.length > 0 && currentPlyIndex === -1) {
      // Only auto-scroll if not navigating (at current position)
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [moves.length, currentPlyIndex]);

  // Scroll to the selected move when navigating
  useEffect(() => {
    if (moveHistoryRef.current && currentPlyIndex >= 0) {
      // Find the element for the current move
      const moveElements =
        moveHistoryRef.current.querySelectorAll("[data-ply]");
      const targetElement = Array.from(moveElements).find(
        (el) => el.getAttribute("data-ply") === currentPlyIndex.toString()
      );

      if (targetElement) {
        // Scroll the element into view smoothly
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [currentPlyIndex]);

  // Handle move selection - load position from FEN
  const handleMoveClick = useCallback((move: MoveData) => {
    // Navigate to this position
    const { navigateToPosition } = useGameStore.getState();

    // Set the banned move for this position if it exists
    const bannedMove =
      move.banned_from && move.banned_to
        ? { from: move.banned_from as Square, to: move.banned_to as Square }
        : null;

    // Navigate to the position with banned move info
    navigateToPosition(move.ply_number, move.fen_after, bannedMove);
    setCurrentPlyIndex(move.ply_number);
  }, []);

  // Navigation functions
  const navigateToFirst = useCallback(() => {
    if (movesData.length > 0) {
      handleMoveClick(movesData[0]);
    }
  }, [handleMoveClick, movesData]);

  const navigateToPrevious = useCallback(() => {
    if (currentPlyIndex > 0) {
      handleMoveClick(movesData[currentPlyIndex - 1]);
    }
  }, [currentPlyIndex, handleMoveClick, movesData]);

  const navigateToNext = useCallback(() => {
    if (currentPlyIndex < movesData.length - 1) {
      handleMoveClick(movesData[currentPlyIndex + 1]);
    }
  }, [currentPlyIndex, handleMoveClick, movesData]);

  const navigateToLast = useCallback(() => {
    if (movesData.length > 0) {
      handleMoveClick(movesData[movesData.length - 1]);
    } else {
      // If no moves, clear navigation to show starting position
      const { clearNavigation } = useGameStore.getState();
      clearNavigation();
      setCurrentPlyIndex(-1);
    }
  }, [handleMoveClick, movesData]);

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
    }
  );

  // Draw offer UI
  const renderDrawControls = () => {
    if (!myColor || game?.status !== 'active') return null;
    
    const opponentColor = myColor === 'white' ? 'black' : 'white';
    
    if (game.drawOfferedBy === myColor) {
      return (
        <Typography sx={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
          Draw offer sent
        </Typography>
      );
    }
    
    if (game.drawOfferedBy === opponentColor) {
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Accept Draw">
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => gameActions.acceptDraw()}
              startIcon={<CheckCircleIcon fontSize="small" />}
              sx={{ fontSize: '0.75rem', py: 0.25 }}
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
              sx={{ fontSize: '0.75rem', py: 0.25 }}
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
  console.log(
    "[GamePanel] Rendering - movesData length:",
    movesData.length
  );
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

  // Add debug message when no moves
  if (!movesData || movesData.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: "center", bgcolor: "error.dark" }}>
        <Typography variant="body1" color="error.main">
          DEBUG: No moves in database
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Game PGN: {game?.pgn || "undefined"}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary">
          Game ID: {game?.id || "undefined"}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: 400,
        maxHeight: "60vh",
        bgcolor: "rgba(255,255,255,0.03)",
        borderRadius: 0.5,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Navigation Bar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 0.5,
          p: 1,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "rgba(0,0,0,0.2)",
        }}
      >
        <Tooltip title="First Move (Home)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToFirst}
              disabled={currentPlyIndex <= 0}
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
              disabled={currentPlyIndex <= 0}
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
              disabled={currentPlyIndex >= movesData.length - 1}
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
              disabled={currentPlyIndex >= movesData.length - 1}
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
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          width: "100%",
          p: 0,
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
              onMoveClick={handleMoveClick}
            />
          ))}
        </Box>
      </Box>
      
      {/* Game Actions Bar - only show for active games */}
      {game?.status === 'active' && myColor && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 0.5,
            p: 1,
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
  onMoveClick,
}: {
  move: Move;
  selectedMove: MoveData | null;
  onMoveClick: (move: MoveData) => void;
}) {
  return (
    <Box
      sx={{
        display: "table-row",
      }}
    >
      <Box
        sx={{
          display: "table-cell",
          pr: 1,
          pl: 1.5,
          color: "#888",
          fontSize: "0.875rem",
          textAlign: "right",
          verticalAlign: "middle",
          width: "15%",
          fontWeight: 400,
        }}
      >
        {move.number}.
      </Box>
      {move.white && (
        <Box
          data-ply={move.white.ply_number}
          sx={{
            display: "table-cell",
            py: 0.5,
            px: 1.5,
            color:
              selectedMove?.ply_number === move.white.ply_number
                ? "#fff"
                : "#bababa",
            fontSize: "0.95rem",
            textAlign: "left",
            verticalAlign: "middle",
            bgcolor:
              selectedMove?.ply_number === move.white.ply_number
                ? "rgba(255,204,0,0.25)"
                : "transparent",
            cursor: "pointer",
            width: "42.5%",
            fontWeight:
              selectedMove?.ply_number === move.white.ply_number ? 600 : 400,
            "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
            borderRadius:
              selectedMove?.ply_number === move.white.ply_number
                ? "3px 0 0 3px"
                : 0,
          }}
          onClick={() => onMoveClick(move.white!)}
        >
          <MoveComponent move={move.white} />
        </Box>
      )}
      {move.black ? (
        <Box
          data-ply={move.black.ply_number}
          sx={{
            display: "table-cell",
            py: 0.5,
            px: 1.5,
            color:
              selectedMove?.ply_number === move.black.ply_number
                ? "#fff"
                : "#bababa",
            fontSize: "0.95rem",
            textAlign: "left",
            verticalAlign: "middle",
            bgcolor:
              selectedMove?.ply_number === move.black.ply_number
                ? "rgba(255,204,0,0.25)"
                : "transparent",
            cursor: "pointer",
            width: "42.5%",
            fontWeight:
              selectedMove?.ply_number === move.black.ply_number ? 600 : 400,
            "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
            borderRadius:
              selectedMove?.ply_number === move.black.ply_number
                ? "0 3px 3px 0"
                : 0,
          }}
          onClick={() => onMoveClick(move.black!)}
        >
          <MoveComponent move={move.black} />
        </Box>
      ) : (
        <Box
          sx={{
            display: "table-cell",
            width: "42.5%",
          }}
        />
      )}
    </Box>
  );
}

function MoveComponent({ move }: { move: MoveData }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        position: "relative",
        padding: "4px",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {/* Show banned move if it exists */}
        {move.banned_from && move.banned_to && (
          <Typography
            component="span"
            sx={{
              fontWeight: "normal",
              color: "error.main",
              fontSize: "0.9rem",
            }}
          >
            {move.banned_from}
            {move.banned_to}
          </Typography>
        )}

        {/* Show actual move if it exists */}
        {move.san && (
          <Typography
            component="span"
            sx={{
              fontWeight: "normal",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {move.san}
          </Typography>
        )}
      </Box>

      {move.time_taken_ms && (
        <Typography
          component="span"
          sx={{
            fontSize: "0.75rem",
            color: "text.secondary",
            ml: "auto",
            pl: 1,
          }}
        >
          {(move.time_taken_ms / 1000).toFixed(1)}s
        </Typography>
      )}
    </Box>
  );
}

export default GamePanel;
