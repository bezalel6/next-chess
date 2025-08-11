import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useGame } from "@/contexts/GameContextV2";
import { Chess } from "chess.ts";
import { getAllBannedMoves, getBannedMove, getMoveNumber } from '@/utils/gameUtils';
import BlockIcon from '@mui/icons-material/Block';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import CachedIcon from '@mui/icons-material/Cached';
import { useSingleKeys, Keys } from "@/hooks/useKeys";
import { useMagicalObjectMap } from "@/utils/magicalMap";

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
function pliesToMoves(plies: Ply[]): Move[] {
  const moves: Move[] = [];

  for (let i = 0; i < plies.length; i += 2) {
    const whitePly = plies[i];
    const blackPly = i + 1 < plies.length ? plies[i + 1] : undefined;
    moves.push({ number: getMoveNumber(i), white: whitePly, black: blackPly });
  }

  return moves;
}
const MoveHistory = () => {
  const { game, setPgn, actions, myColor, isLocalGame, localGameOrientation } = useGame();
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const prevGameIdRef = useRef<string | null>(null);
  const { map: magicalMoves, version: magicalMovesVersion } = useMagicalObjectMap(() => ({ index: -1 } as Ply), [])
  // Convert plies to paired moves for display
  const moves = useMemo<Move[]>(() => {
    return pliesToMoves(magicalMoves.toArray());
  }, [magicalMovesVersion]);

  // Get the currently selected ply
  const selectedPly = useMemo(() => {
    const arr = magicalMoves.toArray()
    return currentPlyIndex >= 0 && currentPlyIndex < arr.length
      ? arr[currentPlyIndex]
      : null;
  }, [currentPlyIndex, magicalMovesVersion]);

  // Reset state when game changes
  useEffect(() => {
    if (game.id && prevGameIdRef.current !== game.id) {
      magicalMoves.clear()
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
      bannedMoves.forEach((m, i) => {
        magicalMoves[i].banned = m;
        magicalMoves[i].index = i;
      })
      // Process move history
      const moveHistory = refGame.history({ verbose: true });
      const runningGame = new Chess();

      moveHistory.forEach((move, index) => {
        runningGame.move(move);
        const fen = runningGame.fen();
        const comment = refGame.getComment(fen) || '';
        runningGame.setComment(comment, fen);
        const pgn = runningGame.pgn();
        magicalMoves[index].fen = fen;
        magicalMoves[index].pgn = pgn;
        magicalMoves[index].move = move.san;
      });

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
    if (magicalMoves.length > 0) {
      handlePlyClick(magicalMoves[0]);
    }
  }, [handlePlyClick, magicalMovesVersion]);

  const navigateToPrevious = useCallback(() => {
    if (currentPlyIndex > 0) {
      handlePlyClick(magicalMoves[currentPlyIndex - 1]);
    }
  }, [currentPlyIndex, handlePlyClick, magicalMovesVersion]);

  const navigateToNext = useCallback(() => {
    if (currentPlyIndex < magicalMoves.length - 1) {
      handlePlyClick(magicalMoves[currentPlyIndex + 1]);
    }
  }, [currentPlyIndex, handlePlyClick, magicalMovesVersion]);

  const navigateToLast = useCallback(() => {
    if (magicalMoves.length > 0) {
      handlePlyClick(magicalMoves[magicalMoves.length - 1]);
    }
  }, [handlePlyClick, magicalMovesVersion]);

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
        width: '100%',
        height: 400, // Fixed height like Lichess
        maxHeight: '60vh',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* No header - moves list starts immediately like Lichess */}

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
          {/* No table header - cleaner look */}

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

      {/* Navigation Bar - Lichess style */}
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
              disabled={currentPlyIndex >= magicalMoves.length - 1}
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
              disabled={currentPlyIndex >= magicalMoves.length - 1}
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
      <Box sx={{
        display: 'table-cell',
        py: 0.5,
        px: 1.5,
        color: selectedPly?.index === move.white.index ? '#fff' : '#bababa',
        fontSize: '0.95rem',
        textAlign: 'left',
        verticalAlign: 'middle',
        bgcolor: selectedPly?.index === move.white.index ? 'rgba(255,204,0,0.25)' : 'transparent',
        cursor: 'pointer',
        width: '42.5%',
        fontWeight: selectedPly?.index === move.white.index ? 600 : 400,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
        borderRadius: selectedPly?.index === move.white.index ? '3px 0 0 3px' : 0,
      }}
        onClick={() => onPlyClick(move.white)}
      >
        <PlyComponent ply={move.white} />
      </Box>
      <Box sx={{
        display: 'table-cell',
        py: 0.5,
        px: 1.5,
        color: selectedPly?.index === move.black?.index ? '#fff' : '#bababa',
        fontSize: '0.95rem',
        textAlign: 'left',
        verticalAlign: 'middle',
        bgcolor: selectedPly?.index === move.black?.index ? 'rgba(255,204,0,0.25)' : 'transparent',
        cursor: move.black ? 'pointer' : 'default',
        width: '42.5%',
        fontWeight: selectedPly?.index === move.black?.index ? 600 : 400,
        '&:hover': move.black ? { bgcolor: 'rgba(255,255,255,0.08)' } : {},
        borderRadius: selectedPly?.index === move.black?.index ? '0 3px 3px 0' : 0,
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