import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useGame } from "@/contexts/GameContext";
import { Chess } from "chess.ts";
import { getAllBannedMoves, getBannedMove, getMoveNumber } from '@/utils/gameUtils';
import BlockIcon from '@mui/icons-material/Block';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import { useSingleKeys, Keys } from "@/hooks/useKeys";

type Ply = {
  move?: string;
  banned?: string;
  fen?: string;
  pgn?: string;
  index: number;
}

type Move = {
  number: number;
  white: Ply;
  black?: Ply;
}

const MoveHistory = () => {
  const { game, setPgn } = useGame();
  const [plies, setPlies] = useState<Ply[]>([]);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const prevGameIdRef = useRef<string | null>(null);

  // Convert plies to paired moves for display
  const moves = useMemo<Move[]>(() => {
    const result: Move[] = [];

    for (let i = 0; i < plies.length; i += 2) {
      const white = plies[i];
      const black = i + 1 < plies.length ? plies[i + 1] : undefined;

      result.push({
        number: Math.floor(i / 2) + 1,
        white,
        black
      });
    }

    return result;
  }, [plies]);

  // Get the currently selected ply
  const selectedPly = useMemo(() => {
    return currentPlyIndex >= 0 && currentPlyIndex < plies.length
      ? plies[currentPlyIndex]
      : null;
  }, [currentPlyIndex, plies]);

  // Reset state when game changes
  useEffect(() => {
    if (game.id && prevGameIdRef.current !== game.id) {
      setPlies([]);
      setCurrentPlyIndex(-1);
      prevGameIdRef.current = game.id;
    }
  }, [game.id]);

  // Update move history when PGN changes
  useEffect(() => {
    if (!game.pgn) return;

    try {
      // Process the game and extract moves
      const refGame = new Chess();
      refGame.loadPgn(game.pgn);

      // Get all banned moves
      const bannedMoves = getAllBannedMoves(game.pgn);

      // Process move history
      const moveHistory = refGame.history({ verbose: true });
      const runningGame = new Chess();
      const newPlies: Ply[] = [];

      moveHistory.forEach((move, index) => {
        runningGame.move(move);
        const fen = runningGame.fen();
        const comment = refGame.getComment(fen) || '';
        runningGame.setComment(comment, fen);
        const pgn = runningGame.pgn();

        newPlies.push({
          move: move.san,
          banned: bannedMoves[index],
          fen,
          pgn,
          index
        });
      });

      setPlies(newPlies);

      // Select last move when history updates
      if (newPlies.length > 0) {
        setCurrentPlyIndex(newPlies.length - 1);
      }
    } catch (error) {
      console.error("Error parsing PGN:", error);
    }
  }, [game.pgn]);

  // Auto-scroll to the latest move
  useEffect(() => {
    if (moveHistoryRef.current && moves.length > 0) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Handle ply selection
  const handlePlyClick = useCallback((ply: Ply) => {
    setPgn(ply.pgn || game.pgn);
    setCurrentPlyIndex(ply.index);
  }, [game.pgn, setPgn]);

  // Navigation functions
  const navigateToFirst = useCallback(() => {
    if (plies.length > 0) {
      handlePlyClick(plies[0]);
    }
  }, [handlePlyClick, plies]);

  const navigateToPrevious = useCallback(() => {
    if (currentPlyIndex > 0) {
      handlePlyClick(plies[currentPlyIndex - 1]);
    }
  }, [currentPlyIndex, handlePlyClick, plies]);

  const navigateToNext = useCallback(() => {
    if (currentPlyIndex < plies.length - 1) {
      handlePlyClick(plies[currentPlyIndex + 1]);
    }
  }, [currentPlyIndex, handlePlyClick, plies]);

  const navigateToLast = useCallback(() => {
    if (plies.length > 0) {
      handlePlyClick(plies[plies.length - 1]);
    }
  }, [handlePlyClick, plies]);

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

  return (
    <Box
      sx={{
        width: { xs: '100%', md: '300px' },
        height: { xs: 'auto', md: 'min(500px, 60vh)' },
        bgcolor: 'rgba(10,10,10,0.8)',
        borderRadius: 1,
        alignSelf: 'center',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        mb: { xs: 3, md: 0 },
        maxHeight: { xs: '40vh', md: 'min(500px, 60vh)' },
        position: 'relative'
      }}
    >
      {/* Header */}
      <Box sx={{
        p: 1,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        bgcolor: 'rgba(0,0,0,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
          Moves
        </Typography>
      </Box>

      {/* Move table with scroll */}
      <Box
        ref={moveHistoryRef}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          width: '100%'
        }}
      >
        <Box sx={{ width: '100%', display: 'table', borderCollapse: 'collapse' }}>
          {/* Table header */}
          <Box sx={{ display: 'table-row', bgcolor: 'rgba(0,0,0,0.2)' }}>
            <Box sx={{ display: 'table-cell', p: 1, width: '20%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
              #
            </Box>
            <Box sx={{ display: 'table-cell', p: 1, width: '40%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
              White
            </Box>
            <Box sx={{ display: 'table-cell', p: 1, width: '40%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
              Black
            </Box>
          </Box>

          {/* Game moves */}
          {moves.map((move) => (
            <MovesRow
              key={move.number}
              move={move}
              selectedPly={selectedPly}
              onPlyClick={handlePlyClick}
            />
          ))}
        </Box>
      </Box>

      {/* Navigation Bar */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        p: 1,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        bgcolor: 'rgba(0,0,0,0.3)',
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
        <Tooltip title="Next Move (Right Arrow)">
          <span>
            <IconButton
              size="small"
              onClick={navigateToNext}
              disabled={currentPlyIndex >= plies.length - 1}
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
              disabled={currentPlyIndex >= plies.length - 1}
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
  selectedPly,
  onPlyClick
}: {
  move: Move;
  selectedPly: Ply | null;
  onPlyClick: (ply: Ply) => void;
}) {
  return (
    <Box
      sx={{
        display: 'table-row',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
      }}
    >
      <Box sx={{
        display: 'table-cell',
        p: 1,
        color: 'rgba(255,255,255,0.5)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.75rem',
        textAlign: 'center',
        verticalAlign: 'middle',
        width: '10%'
      }}>
        {move.number}
      </Box>
      <Box sx={{
        display: 'table-cell',
        p: 1,
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.8rem',
        textAlign: 'center',
        verticalAlign: 'middle',
        bgcolor: selectedPly?.index === move.white.index ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: 'pointer',
        width: '45%'
      }}
        onClick={() => onPlyClick(move.white)}
      >
        <PlyComponent ply={move.white} />
      </Box>
      <Box sx={{
        display: 'table-cell',
        p: 1,
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.8rem',
        textAlign: 'center',
        verticalAlign: 'middle',
        bgcolor: selectedPly?.index === move.black?.index ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: move.black ? 'pointer' : 'default',
        width: '45%'
      }}
        onClick={() => move.black && onPlyClick(move.black)}
      >
        {move.black && <PlyComponent ply={move.black} />}
      </Box>
    </Box>
  );
}

function PlyComponent({ ply }: { ply: Ply }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        padding: '4px'
      }}
    >
      {ply?.move && (
        <Typography
          component="span"
          sx={{
            fontWeight: 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {ply.move}
        </Typography>
      )}

      {ply?.banned && (
        <Tooltip title={`Banned move: ${ply.banned}`} arrow>
          <Box
            component="span"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'error.main',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {ply.banned}
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

export default MoveHistory; 