import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useGameStore } from "@/stores/gameStore";
import type { Square } from 'chess.ts/dist/types';
import BlockIcon from '@mui/icons-material/Block';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import CachedIcon from '@mui/icons-material/Cached';
import { useSingleKeys, Keys } from "@/hooks/useKeys";
import { supabase } from "@/utils/supabase";
import { useQuery } from "@tanstack/react-query";

type MoveData = {
  id: string;
  move_number: number;
  ply_number: number;
  player_color: 'white' | 'black';
  from_square: string;
  to_square: string;
  promotion?: string;
  san: string;
  fen_after: string;
  banned_from?: string;
  banned_to?: string;
  banned_by?: 'white' | 'black';
  time_taken_ms?: number;
};

type Move = {
  number: number;
  white?: MoveData;
  black?: MoveData;
};

const MoveHistoryV2 = () => {
  const game = useUnifiedGameStore(s => s.game);
  const setPgn = useUnifiedGameStore(s => s.setPgn);
  const actions = useUnifiedGameStore(s => s.actions);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const isLocalGame = useUnifiedGameStore(s => s.mode === 'local');
  const localGameOrientation = useUnifiedGameStore(s => s.localGameOrientation);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1);
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  // Fetch moves from the database with real-time subscription
  const { data: movesData = [], isLoading } = useQuery({
    queryKey: ['moves', game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      
      const { data, error } = await supabase
        .rpc('get_game_moves', { p_game_id: game.id });
      
      if (error) {
        console.error('Error fetching moves:', error);
        return [];
      }
      
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moves',
        filter: `game_id=eq.${game.id}`,
      }, (payload) => {
        console.log('[MoveHistory] New move received:', payload);
        // React Query will handle the refetch via invalidation in GameContext
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [game?.id]);

  // Convert flat moves array to paired moves for display
  const moves = useMemo<Move[]>(() => {
    const paired: Move[] = [];
    
    for (let i = 0; i < movesData.length; i++) {
      const move = movesData[i];
      const moveNumber = move.move_number;
      
      if (move.player_color === 'white') {
        paired.push({
          number: moveNumber,
          white: move,
        });
      } else {
        // Find the corresponding white move
        const lastMove = paired[paired.length - 1];
        if (lastMove && lastMove.number === moveNumber) {
          lastMove.black = move;
        } else {
          // Shouldn't happen, but handle edge case
          paired.push({
            number: moveNumber,
            black: move,
          });
        }
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
      const moveElements = moveHistoryRef.current.querySelectorAll('[data-ply]');
      const targetElement = Array.from(moveElements).find(
        el => el.getAttribute('data-ply') === currentPlyIndex.toString()
      );
      
      if (targetElement) {
        // Scroll the element into view smoothly
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [currentPlyIndex]);

  // Handle move selection - load position from FEN
  const handleMoveClick = useCallback((move: MoveData) => {
    // Navigate to this position
    const { navigateToPosition } = useGameStore.getState();
    
    // Set the banned move for this position if it exists
    const bannedMove = move.banned_from && move.banned_to 
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
      }
    },
    {
      key: Keys.ArrowRight,
      callback: (e) => {
        e.preventDefault();
        navigateToNext();
      }
    },
    {
      key: Keys.ArrowUp,
      callback: (e) => {
        e.preventDefault();
        navigateToFirst();
      }
    },
    {
      key: Keys.ArrowDown,
      callback: (e) => {
        e.preventDefault();
        navigateToLast();
      }
    }
  );

  if (isLoading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Loading moves...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: 400,
        maxHeight: '60vh',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Move table with scroll */}
      <Box
        ref={moveHistoryRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          p: 0,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(255,255,255,0.2)',
            borderRadius: '3px',
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.3)',
            },
          },
        }}
      >
        <Box sx={{ width: '100%', display: 'table', borderCollapse: 'collapse' }}>
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

      {/* Navigation Bar */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.5,
        p: 1,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(0,0,0,0.2)',
      }}>
        <Tooltip title="First Move (Home)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToFirst}
              disabled={currentPlyIndex <= 0}
              sx={{ color: 'white', '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' } }}
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
              sx={{ color: 'white', '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' } }}
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
              color: 'white', 
              mx: 1,
              bgcolor: (isLocalGame ? localGameOrientation === 'black' : myColor === 'black') 
                ? 'rgba(255,255,255,0.15)' 
                : 'transparent',
              '&:hover': { 
                bgcolor: (isLocalGame ? localGameOrientation === 'black' : myColor === 'black')
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(255,255,255,0.08)',
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
              sx={{ color: 'white', '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' } }}
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
              sx={{ color: 'white', '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' } }}
            >
              <LastPageIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

function MovesRow({
  move,
  selectedMove,
  onMoveClick
}: {
  move: Move;
  selectedMove: MoveData | null;
  onMoveClick: (move: MoveData) => void;
}) {
  return (
    <Box
      sx={{
        display: 'table-row',
      }}
    >
      <Box sx={{
        display: 'table-cell',
        pr: 1,
        pl: 1.5,
        color: '#888',
        fontSize: '0.875rem',
        textAlign: 'right',
        verticalAlign: 'middle',
        width: '15%',
        fontWeight: 400,
      }}>
        {move.number}.
      </Box>
      {move.white && (
        <Box 
          data-ply={move.white.ply_number}
          sx={{
          display: 'table-cell',
          py: 0.5,
          px: 1.5,
          color: selectedMove?.ply_number === move.white.ply_number ? '#fff' : '#bababa',
          fontSize: '0.95rem',
          textAlign: 'left',
          verticalAlign: 'middle',
          bgcolor: selectedMove?.ply_number === move.white.ply_number ? 'rgba(255,204,0,0.25)' : 'transparent',
          cursor: 'pointer',
          width: '42.5%',
          fontWeight: selectedMove?.ply_number === move.white.ply_number ? 600 : 400,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
          borderRadius: selectedMove?.ply_number === move.white.ply_number ? '3px 0 0 3px' : 0,
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
          display: 'table-cell',
          py: 0.5,
          px: 1.5,
          color: selectedMove?.ply_number === move.black.ply_number ? '#fff' : '#bababa',
          fontSize: '0.95rem',
          textAlign: 'left',
          verticalAlign: 'middle',
          bgcolor: selectedMove?.ply_number === move.black.ply_number ? 'rgba(255,204,0,0.25)' : 'transparent',
          cursor: 'pointer',
          width: '42.5%',
          fontWeight: selectedMove?.ply_number === move.black.ply_number ? 600 : 400,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
          borderRadius: selectedMove?.ply_number === move.black.ply_number ? '0 3px 3px 0' : 0,
        }}
          onClick={() => onMoveClick(move.black!)}
        >
          <MoveComponent move={move.black} />
        </Box>
      ) : (
        <Box sx={{
          display: 'table-cell',
          width: '42.5%',
        }} />
      )}
    </Box>
  );
}

function MoveComponent({ move }: { move: MoveData }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        position: 'relative',
        padding: '4px'
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 'normal',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {move.san}
      </Typography>

      {move.banned_from && move.banned_to && (
        <Tooltip title={`Banned: ${move.banned_from}${move.banned_to}`} arrow>
          <BlockIcon 
            sx={{ 
              fontSize: '16px', 
              color: 'error.main',
              ml: 0.5
            }} 
          />
        </Tooltip>
      )}

      {move.time_taken_ms && (
        <Typography
          component="span"
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            ml: 'auto',
            pl: 1
          }}
        >
          {(move.time_taken_ms / 1000).toFixed(1)}s
        </Typography>
      )}
    </Box>
  );
}

export default MoveHistoryV2;