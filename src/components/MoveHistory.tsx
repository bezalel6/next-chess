import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import { useEffect, useState, useRef, useCallback } from "react";
import { useGame } from "@/contexts/GameContext";
import { Chess } from "chess.ts";
import { getAllBannedMoves, getBannedMove, getMoveNumber } from './../utils/gameUtils';
import BlockIcon from '@mui/icons-material/Block';
import { createMagicalMap } from "@/utils/magicalMap";
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
}
type Move = [Ply, Ply?];
function pliesToMoves(plies: Ply[]): Move[] {
  const moves: [Ply, Ply?][] = [];

  for (let i = 0; i < plies.length; i += 2) {
    const whitePly = plies[i];
    const blackPly = i + 1 < plies.length ? plies[i + 1] : undefined;
    moves.push([whitePly, blackPly]);
  }

  return moves;
}
const plyRecord = createMagicalMap<Ply>(() => ({}))
const MoveHistory = () => {
  const { game, setPgn } = useGame();
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [selectedPly, setSelectedPly] = useState<Ply | null>(null);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1);
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  // Update move history whenever the game state changes
  useEffect(() => {
    // Use the game's PGN to generate move history
    const formatMovesFromPgn = () => {
      const refGame = new Chess();

      try {
        // Load the game from PGN
        refGame.loadPgn(game.pgn);
        getAllBannedMoves(game.pgn).forEach((m, i) => {
          plyRecord[i].banned = m;
        })
        const moveHistory = refGame.history({ verbose: true });

        const runningGame = new Chess()
        moveHistory.forEach((move, index) => {

          runningGame.move(move)
          const fen = runningGame.fen()
          const comment = refGame.getComment(fen) || ''
          runningGame.setComment(comment, fen)
          const pgn = runningGame.pgn()

          plyRecord[index].move = move.san;
          plyRecord[index].fen = fen;
          plyRecord[index].pgn = pgn;
        });
        setMoveHistory(pliesToMoves(plyRecord.toArr()));
        // Set current ply to last move when history updates
        const plies = plyRecord.toArr();
        if (plies.length > 0) {
          setCurrentPlyIndex(plies.length - 1);
          setSelectedPly(plies[plies.length - 1]);
        }
      } catch (error) {
        console.error("Error parsing PGN:", error);
        setMoveHistory([]);
      }
    };
    formatMovesFromPgn();
  }, [game.pgn]);

  // Auto-scroll to bottom when move history changes
  useEffect(() => {
    if (moveHistoryRef.current && moveHistory.length > 0) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [moveHistory]);

  // Handle ply selection
  const handlePlyClick = useCallback((ply: Ply, index: number) => {
    setPgn(ply.pgn || game.pgn)
    setSelectedPly(ply);
    setCurrentPlyIndex(index);
  }, [game?.pgn, setPgn, setSelectedPly]);

  // Navigation functions
  const navigateToFirst = useCallback(() => {
    const plies = plyRecord.toArr();
    if (plies.length > 0) {
      handlePlyClick(plies[0], 0);
    }
  }, [handlePlyClick]);

  const navigateToPrevious = useCallback(() => {
    const plies = plyRecord.toArr();
    if (currentPlyIndex > 0) {
      handlePlyClick(plies[currentPlyIndex - 1], currentPlyIndex - 1);
    }
  }, [currentPlyIndex, handlePlyClick]);

  const navigateToNext = useCallback(() => {
    const plies = plyRecord.toArr();
    if (currentPlyIndex < plies.length - 1) {
      handlePlyClick(plies[currentPlyIndex + 1], currentPlyIndex + 1);
    }
  }, [currentPlyIndex, handlePlyClick]);

  const navigateToLast = useCallback(() => {
    const plies = plyRecord.toArr();
    if (plies.length > 0) {
      handlePlyClick(plies[plies.length - 1], plies.length - 1);
    }
  }, [handlePlyClick]);

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

  // Calculate ply index when clicked from move rows
  const getPlyIndex = (moveIndex: number, isBlack: boolean) => {
    return moveIndex * 2 + (isBlack ? 1 : 0);
  };

  return (
    <Box
      sx={{
        width: { xs: '100%', md: '200px' },
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
          {moveHistory.map((move, index) => (
            <MovesRow
              move={move}
              key={index}
              moveNumber={index + 1}
              selectedPly={selectedPly}
              onPlyClick={(ply, isBlack) => handlePlyClick(ply, getPlyIndex(index, isBlack))}
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
              disabled={currentPlyIndex >= plyRecord.toArr().length - 1}
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
              disabled={currentPlyIndex >= plyRecord.toArr().length - 1}
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
  move: [whiteMove, blackMove],
  selectedPly,
  moveNumber,
  onPlyClick
}: {
  move: Move;
  selectedPly: Ply | null;
  moveNumber: number;
  onPlyClick: (ply: Ply, isBlack: boolean) => void;
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
        {moveNumber}
      </Box>
      <Box sx={{
        display: 'table-cell',
        p: 1,
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.8rem',
        textAlign: 'center',
        verticalAlign: 'middle',
        bgcolor: selectedPly === whiteMove ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: 'pointer',
        width: '45%'
      }}
        onClick={() => onPlyClick(whiteMove, false)}
      >
        <PlyComponent ply={whiteMove} />
      </Box>
      <Box sx={{
        display: 'table-cell',
        p: 1,
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.8rem',
        textAlign: 'center',
        verticalAlign: 'middle',
        bgcolor: selectedPly === blackMove ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: blackMove ? 'pointer' : 'default',
        width: '45%'
      }}
        onClick={() => blackMove && onPlyClick(blackMove, true)}
      >
        <PlyComponent ply={blackMove} />
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
            width: ply?.banned ? '50%' : '100%',
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
              width: ply?.move ? '50%' : '100%',
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