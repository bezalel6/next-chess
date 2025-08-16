import { Box, Typography, Tooltip, IconButton, Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
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
import ViewStreamIcon from "@mui/icons-material/ViewStream";
import ViewCompactIcon from "@mui/icons-material/ViewCompact";
import ViewListIcon from "@mui/icons-material/ViewList";
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
  fen_before?: string;  // FEN before the move was made
  banned_from?: string;
  banned_to?: string;
  banned_by?: "white" | "black";
  time_taken_ms?: number;
};

// Navigation state type - now tracks half-moves
type NavigationState = {
  moveIndex: number;  // -1 for initial position, 0+ for moves
  phase: 'initial' | 'after-ban' | 'after-move';  // Which phase within a move
};

// Layout options for ban/move display
type BanMoveLayout = 'stacked' | 'inline' | 'side-by-side' | 'compact';

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
  const [navigationState, setNavigationState] = useState<NavigationState>({
    moveIndex: -1,
    phase: 'initial'
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  const [banMoveLayout, setBanMoveLayout] = useState<BanMoveLayout>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('banMoveLayout');
    return (saved as BanMoveLayout) || 'stacked';
  });

  // Save layout preference
  const handleLayoutChange = (_: React.MouseEvent<HTMLElement>, newLayout: BanMoveLayout | null) => {
    if (newLayout) {
      setBanMoveLayout(newLayout);
      localStorage.setItem('banMoveLayout', newLayout);
    }
  };
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

  // Get the currently selected move based on navigation state
  const selectedMove = useMemo(() => {
    if (navigationState.moveIndex >= 0 && navigationState.moveIndex < movesData.length) {
      return movesData[navigationState.moveIndex];
    }
    return null;
  }, [navigationState.moveIndex, movesData]);

  // Reset initialization when game changes
  useEffect(() => {
    setHasInitialized(false);
    setNavigationState({ moveIndex: -1, phase: 'initial' });
  }, [game?.id]);

  // Initialize to show the last move as active when moves are loaded
  useEffect(() => {
    if (!hasInitialized && movesData.length > 0) {
      setNavigationState({
        moveIndex: movesData.length - 1,
        phase: 'after-move'
      });
      setHasInitialized(true);
    }
  }, [movesData.length, hasInitialized]);

  // Auto-scroll to the latest move when new moves are added
  useEffect(() => {
    if (moveHistoryRef.current && moves.length > 0) {
      // Auto-scroll to bottom to show latest moves
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Scroll to the selected move when navigating
  useEffect(() => {
    if (moveHistoryRef.current && navigationState.moveIndex >= 0) {
      // Find the element for the current move
      const moveElements =
        moveHistoryRef.current.querySelectorAll("[data-ply]");
      const targetElement = Array.from(moveElements).find(
        (el) => el.getAttribute("data-ply") === navigationState.moveIndex.toString()
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
  const handleMoveClick = useCallback((move: MoveData, clickedPhase: 'after-ban' | 'after-move' = 'after-move') => {
    const { navigateToPosition } = useGameStore.getState();
    
    // Navigate to the appropriate position based on phase
    if (clickedPhase === 'after-ban' && move.banned_from && move.banned_to) {
      // Show position after ban but before move
      const bannedMove = { from: move.banned_from as Square, to: move.banned_to as Square };
      // Use fen_before if available, otherwise use previous move's fen_after
      const fenToUse = move.fen_before || 
        (move.ply_number > 0 ? movesData[move.ply_number - 1]?.fen_after : null) ||
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      navigateToPosition(move.ply_number, fenToUse, bannedMove);
    } else {
      // Show position after move
      const bannedMove = move.banned_from && move.banned_to
        ? { from: move.banned_from as Square, to: move.banned_to as Square }
        : null;
      navigateToPosition(move.ply_number, move.fen_after, bannedMove);
    }
    
    setNavigationState({
      moveIndex: move.ply_number,
      phase: clickedPhase
    });
  }, [movesData]);

  // Navigation functions with half-move support
  const navigateToFirst = useCallback(() => {
    // Go to initial position (before any moves)
    const { navigateToPosition } = useGameStore.getState();
    // Navigate to initial chess position with ply -1
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    navigateToPosition(-1, initialFen, null);
    setNavigationState({ moveIndex: -1, phase: 'initial' });
  }, []);

  const navigateToPrevious = useCallback(() => {
    const { moveIndex, phase } = navigationState;
    
    if (phase === 'after-move' && movesData[moveIndex]?.banned_from) {
      // If at after-move and there was a ban, go to after-ban
      handleMoveClick(movesData[moveIndex], 'after-ban');
    } else if (phase === 'after-ban' || (phase === 'after-move' && !movesData[moveIndex]?.banned_from)) {
      // Go to previous move's after-move phase
      if (moveIndex > 0) {
        handleMoveClick(movesData[moveIndex - 1], 'after-move');
      } else {
        // Go to initial position
        navigateToFirst();
      }
    } else if (phase === 'initial' && movesData.length > 0) {
      // Can't go before initial
      return;
    }
  }, [navigationState, handleMoveClick, movesData, navigateToFirst]);

  const navigateToNext = useCallback(() => {
    const { moveIndex, phase } = navigationState;
    
    if (phase === 'initial') {
      // From initial, go to first move's after-ban or after-move
      if (movesData.length > 0) {
        if (movesData[0].banned_from) {
          handleMoveClick(movesData[0], 'after-ban');
        } else {
          handleMoveClick(movesData[0], 'after-move');
        }
      }
    } else if (phase === 'after-ban') {
      // From after-ban, go to after-move
      handleMoveClick(movesData[moveIndex], 'after-move');
    } else if (phase === 'after-move') {
      // From after-move, go to next move's after-ban or after-move
      if (moveIndex < movesData.length - 1) {
        const nextMove = movesData[moveIndex + 1];
        if (nextMove.banned_from) {
          handleMoveClick(nextMove, 'after-ban');
        } else {
          handleMoveClick(nextMove, 'after-move');
        }
      }
    }
  }, [navigationState, handleMoveClick, movesData]);

  const navigateToLast = useCallback(() => {
    if (movesData.length > 0) {
      handleMoveClick(movesData[movesData.length - 1], 'after-move');
    } else {
      // If no moves, stay at initial position
      navigateToFirst();
    }
  }, [handleMoveClick, movesData, navigateToFirst]);

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
        height: "100%",
        bgcolor: "rgba(255,255,255,0.03)",
        borderRadius: 0.5,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Layout Switcher */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "rgba(0,0,0,0.2)",
        }}
      >
        <Typography variant="caption" sx={{ color: '#888', ml: 1 }}>
          Layout:
        </Typography>
        <ToggleButtonGroup
          value={banMoveLayout}
          exclusive
          onChange={handleLayoutChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              py: 0.25,
              px: 0.75,
              color: 'rgba(255,255,255,0.5)',
              borderColor: 'rgba(255,255,255,0.1)',
              fontSize: '0.75rem',
              '&.Mui-selected': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'white',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.15)',
                },
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            },
          }}
        >
          <ToggleButton value="stacked">
            <Tooltip title="Stacked: Ban above move">
              <ViewStreamIcon sx={{ fontSize: 16 }} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="inline">
            <Tooltip title="Inline: Ban → Move">
              <ViewCompactIcon sx={{ fontSize: 16 }} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="side-by-side">
            <Tooltip title="Side by side: Ban | Move">
              <ViewListIcon sx={{ fontSize: 16 }} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="compact">
            <Tooltip title="Compact: Minimal">
              <BlockIcon sx={{ fontSize: 16 }} />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      
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
              disabled={navigationState.moveIndex === -1 && navigationState.phase === 'initial'}
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
              disabled={navigationState.moveIndex === -1 && navigationState.phase === 'initial'}
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
              disabled={navigationState.moveIndex >= movesData.length - 1 && navigationState.phase === 'after-move'}
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
              disabled={navigationState.moveIndex >= movesData.length - 1 && navigationState.phase === 'after-move'}
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
          height: "200px", // Fixed height of about half the panel
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
              layout={banMoveLayout}
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
  navigationState,
  onMoveClick,
  layout,
}: {
  move: Move;
  selectedMove: MoveData | null;
  navigationState: NavigationState;
  onMoveClick: (move: MoveData, phase: 'after-ban' | 'after-move') => void;
  layout: BanMoveLayout;
}) {
  // Determine if this row should have dark squares (checkered pattern)
  const isDarkRow = move.number % 2 === 0;
  
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
          bgcolor: isDarkRow ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)",
          py: 0.75,
        }}
      >
        {move.number}.
      </Box>
      {move.white && (
        <Box
          data-ply={move.white.ply_number}
          sx={{
            display: "table-cell",
            py: 0.75,
            px: 1.5,
            color: "#bababa",
            fontSize: "0.95rem",
            textAlign: "left",
            verticalAlign: "middle",
            bgcolor: isDarkRow ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            width: "42.5%",
            fontWeight:
              selectedMove?.ply_number === move.white.ply_number ? 600 : 400,
            "&:hover": { bgcolor: isDarkRow ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.06)" },
            // Use outline for selection instead of background
            outline: selectedMove?.ply_number === move.white.ply_number
              ? "2px solid rgba(255,204,0,0.8)"
              : "none",
            outlineOffset: "-2px",
            position: "relative",
          }}
          onClick={() => onMoveClick(move.white!, 'after-move')}
        >
          <MoveComponent 
            move={move.white}
            isSelected={selectedMove?.ply_number === move.white.ply_number}
            isBanPhase={navigationState.moveIndex === move.white.ply_number && navigationState.phase === 'after-ban'}
            onBanClick={move.white.banned_from ? () => onMoveClick(move.white!, 'after-ban') : undefined}
            layout={layout}
          />
        </Box>
      )}
      {move.black ? (
        <Box
          data-ply={move.black.ply_number}
          sx={{
            display: "table-cell",
            py: 0.75,
            px: 1.5,
            color: "#bababa",
            fontSize: "0.95rem",
            textAlign: "left",
            verticalAlign: "middle",
            bgcolor: !isDarkRow ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            width: "42.5%",
            fontWeight:
              selectedMove?.ply_number === move.black.ply_number ? 600 : 400,
            "&:hover": { bgcolor: !isDarkRow ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.06)" },
            // Use outline for selection instead of background
            outline: selectedMove?.ply_number === move.black.ply_number
              ? "2px solid rgba(255,204,0,0.8)"
              : "none",
            outlineOffset: "-2px",
            position: "relative",
          }}
          onClick={() => onMoveClick(move.black!, 'after-move')}
        >
          <MoveComponent 
            move={move.black}
            isSelected={selectedMove?.ply_number === move.black.ply_number}
            isBanPhase={navigationState.moveIndex === move.black.ply_number && navigationState.phase === 'after-ban'}
            onBanClick={move.black.banned_from ? () => onMoveClick(move.black!, 'after-ban') : undefined}
            layout={layout}
          />
        </Box>
      ) : (
        <Box
          sx={{
            display: "table-cell",
            width: "42.5%",
            bgcolor: !isDarkRow ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.02)",
            py: 0.75,
            px: 1.5,
          }}
        />
      )}
    </Box>
  );
}

function MoveComponent({ 
  move, 
  isSelected,
  isBanPhase,
  onBanClick,
  layout 
}: { 
  move: MoveData;
  isSelected: boolean;
  isBanPhase: boolean;
  onBanClick?: () => void;
  layout: BanMoveLayout;
}) {
  const hasBan = move.banned_from && move.banned_to;
  
  // Render based on layout
  if (layout === 'stacked') {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          position: "relative",
          padding: "2px 4px",
          gap: 0.25,
        }}
      >
        {/* Banned move on top */}
        {hasBan && (
          <Box 
            onClick={(e) => {
              e.stopPropagation();
              onBanClick?.();
            }}
            sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 0.5,
              cursor: onBanClick ? 'pointer' : 'default',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor: isBanPhase ? 'rgba(255,0,0,0.2)' : 'transparent',
              border: isBanPhase ? '1px solid' : 'none',
              borderColor: isBanPhase ? 'error.main' : 'transparent',
              transition: 'all 0.2s',
              '&:hover': onBanClick ? { 
                bgcolor: 'rgba(255,0,0,0.15)',
              } : {},
            }}
          >
            <BlockIcon sx={{ fontSize: 11, color: isBanPhase ? 'error.light' : 'error.main' }} />
            <Typography
              component="span"
              sx={{
                fontWeight: isBanPhase ? 'bold' : 'normal',
                color: isBanPhase ? 'error.light' : 'error.main',
                fontSize: "0.75rem",
                fontStyle: 'italic',
              }}
            >
              {move.banned_from}{move.banned_to}
            </Typography>
          </Box>
        )}
        {/* Actual move below */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography
            component="span"
            sx={{
              fontWeight: "normal",
              fontSize: "0.95rem",
            }}
          >
            {move.san}
          </Typography>
          {move.time_taken_ms && (
            <Typography
              component="span"
              sx={{
                fontSize: "0.65rem",
                color: "text.secondary",
                ml: 1,
              }}
            >
              {(move.time_taken_ms / 1000).toFixed(1)}s
            </Typography>
          )}
        </Box>
      </Box>
    );
  }
  
  if (layout === 'inline') {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "4px",
          gap: 1,
        }}
      >
        {/* Ban and move on same line */}
        {hasBan && (
          <>
            <Box 
              onClick={(e) => {
                e.stopPropagation();
                onBanClick?.();
              }}
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 0.25,
                cursor: onBanClick ? 'pointer' : 'default',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                bgcolor: isBanPhase ? 'rgba(255,0,0,0.2)' : 'transparent',
                border: isBanPhase ? '1px solid' : 'none',
                borderColor: isBanPhase ? 'error.main' : 'transparent',
                transition: 'all 0.2s',
                '&:hover': onBanClick ? { bgcolor: 'rgba(255,0,0,0.1)' } : {},
              }}
            >
              <BlockIcon sx={{ fontSize: 12, color: isBanPhase ? 'error.light' : 'error.dark' }} />
              <Typography
                component="span"
                sx={{
                  fontWeight: isBanPhase ? 'bold' : 'normal',
                  color: isBanPhase ? 'error.light' : 'error.dark',
                  fontSize: "0.8rem",
                }}
              >
                {move.banned_from}{move.banned_to}
              </Typography>
            </Box>
            <Typography sx={{ color: '#666', fontSize: '0.8rem' }}>→</Typography>
          </>
        )}
        <Typography
          component="span"
          sx={{
            fontWeight: "normal",
            fontSize: "0.95rem",
          }}
        >
          {move.san}
        </Typography>
        {move.time_taken_ms && (
          <Typography
            component="span"
            sx={{
              fontSize: "0.65rem",
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
  
  if (layout === 'side-by-side') {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "4px",
          gap: 0.5,
        }}
      >
        {/* Ban on left, move on right with separator */}
        {hasBan ? (
          <>
            <Box 
              onClick={(e) => {
                e.stopPropagation();
                onBanClick?.();
              }}
              sx={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 0.25,
                cursor: onBanClick ? 'pointer' : 'default',
                flex: '0 0 auto',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                bgcolor: isBanPhase ? 'rgba(255,0,0,0.2)' : 'transparent',
                border: isBanPhase ? '1px solid' : 'none',
                borderColor: isBanPhase ? 'error.main' : 'transparent',
                transition: 'all 0.2s',
                '&:hover': onBanClick ? { bgcolor: 'rgba(255,0,0,0.1)' } : {},
              }}
            >
              <BlockIcon sx={{ fontSize: 11, color: isBanPhase ? 'error.light' : '#888' }} />
              <Typography
                component="span"
                sx={{
                  fontWeight: isBanPhase ? 'bold' : 'normal',
                  color: isBanPhase ? 'error.light' : '#888',
                  fontSize: "0.75rem",
                }}
              >
                {move.banned_from}{move.banned_to}
              </Typography>
            </Box>
            <Box sx={{ width: '1px', height: '16px', bgcolor: 'rgba(255,255,255,0.1)' }} />
          </>
        ) : (
          <Box sx={{ width: '60px' }} /> // Spacer for alignment
        )}
        <Typography
          component="span"
          sx={{
            fontWeight: "normal",
            fontSize: "0.95rem",
            flex: 1,
          }}
        >
          {move.san}
        </Typography>
        {move.time_taken_ms && (
          <Typography
            component="span"
            sx={{
              fontSize: "0.65rem",
              color: "text.secondary",
            }}
          >
            {(move.time_taken_ms / 1000).toFixed(1)}s
          </Typography>
        )}
      </Box>
    );
  }
  
  // Compact layout
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
            cursor: onBanClick ? 'pointer' : 'default',
            transition: 'all 0.2s',
            '&:hover': onBanClick ? { opacity: 1 } : {},
            opacity: isBanPhase ? 1 : 0.6,
          }}
        >
          <BlockIcon sx={{ 
            fontSize: 10, 
            color: isBanPhase ? 'error.light' : 'error.dark',
            filter: isBanPhase ? 'drop-shadow(0 0 4px rgba(255,0,0,0.5))' : 'none',
          }} />
          <Typography
            component="span"
            sx={{
              fontWeight: isBanPhase ? 'bold' : 'normal',
              color: isBanPhase ? 'error.light' : 'error.dark',
              fontSize: "0.7rem",
            }}
          >
            {move.banned_from[0]}{move.banned_to}
          </Typography>
        </Box>
      )}
      <Typography
        component="span"
        sx={{
          fontWeight: "normal",
          fontSize: "0.9rem",
        }}
      >
        {move.san}
      </Typography>
      {move.time_taken_ms && (
        <Typography
          component="span"
          sx={{
            fontSize: "0.6rem",
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
