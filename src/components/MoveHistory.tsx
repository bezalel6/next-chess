import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { useGame } from "@/contexts/GameContext";
import { Chess } from "chess.ts";
import { getBannedMove } from './../utils/gameUtils';
import BlockIcon from '@mui/icons-material/Block';

type Ply = {
  move?: string;
  banned?: string;
  fen?: string;
}

interface FormattedMove {
  number: number;
  white: Ply;
  black: Ply;
}

const MoveHistory = () => {
  const { game } = useGame();
  const [moveHistory, setMoveHistory] = useState<FormattedMove[]>([]);
  const [selectedPly, setSelectedPly] = useState<string | null>(null);
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  // Update move history whenever the game state changes
  useEffect(() => {
    // Use the game's PGN to generate move history
    const formatMovesFromPgn = () => {
      const refGame = new Chess();

      try {
        // Load the game from PGN
        refGame.loadPgn(game.pgn);

        const moveHistory = refGame.history({ verbose: true });
        const formattedMoves: FormattedMove[] = [];
        const runningGame = new Chess()
        let moveNumber = 1;
        let currentPair: FormattedMove = { white: {}, black: {}, number: moveNumber };
        moveHistory.forEach((move, index) => {
          runningGame.move(move)
          const fen = runningGame.fen()
          const currentPly = {
            fen,
            banned: getBannedMove(refGame.getComment(fen)) || '',
            move: move.san || ""
          }

          if (index % 2 === 0) {
            // White's move
            currentPair = { white: currentPly, black: {}, number: moveNumber };

            // If this is the last move and it's white's, add it now
            if (index === moveHistory.length - 1) {
              formattedMoves.push(currentPair);
            }
          } else {
            // Black's move - complete the pair and add to formatted moves
            currentPair.black = currentPly;
            formattedMoves.push({
              number: moveNumber,
              white: currentPair.white,
              black: currentPair.black
            });
            moveNumber++;
          }
        });

        setMoveHistory(formattedMoves);
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
  const handlePlyClick = (fen: string | undefined) => {
    if (fen) {
      setSelectedPly(fen);
    }
  };

  return (
    <Box
      ref={moveHistoryRef}
      sx={{
        width: { xs: '100%', md: '200px' },
        height: { xs: 'auto', md: 'min(500px, 60vh)' },
        bgcolor: 'rgba(10,10,10,0.8)',
        borderRadius: 1,
        alignSelf: 'center',
        overflow: 'auto',
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

      {/* Move table */}
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
        {moveHistory.map((move) => (
          <MovesRow
            move={move}
            key={move.number}
            selectedPly={selectedPly}
            onPlyClick={handlePlyClick}
          />
        ))}
      </Box>
    </Box>
  );
};

function MovesRow({
  move,
  selectedPly,
  onPlyClick
}: {
  move: FormattedMove;
  selectedPly: string | null;
  onPlyClick: (fen: string | undefined) => void;
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
        textAlign: 'center'
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
        bgcolor: selectedPly === move.white.fen ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: move.white.fen ? 'pointer' : 'default'
      }}
        onClick={() => onPlyClick(move.white.fen)}
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
        bgcolor: selectedPly === move.black.fen ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: move.black.fen ? 'pointer' : 'default'
      }}
        onClick={() => onPlyClick(move.black.fen)}
      >
        <PlyComponent ply={move.black} />
      </Box>
    </Box>
  );
}

function PlyComponent({ ply }: { ply: Ply }) {
  if (!ply.move) return null;

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography
        component="span"
        sx={{
          display: 'inline-block',
          fontWeight: ply.banned ? 'normal' : 'medium'
        }}
      >
        {ply.move}
      </Typography>

      {ply.banned && (
        <Tooltip title={`Banned move: ${ply.banned}`} arrow>
          <Box component="span" sx={{
            display: 'inline-flex',
            alignItems: 'center',
            ml: 0.5,
            color: 'error.main'
          }}>
            {ply.banned}
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

export default MoveHistory; 