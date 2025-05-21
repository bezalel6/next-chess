import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { useGame } from "@/contexts/GameContext";
import { Chess } from "chess.ts";
import { getAllBannedMoves, getBannedMove, getMoveNumber } from './../utils/gameUtils';
import BlockIcon from '@mui/icons-material/Block';
import { createMagicalMap } from "@/utils/magicalMap";

type Ply = {
  move?: string;
  banned?: string;
  fen?: string;
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
  const { game } = useGame();
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
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
        getAllBannedMoves(game.pgn).forEach((m, i) => {
          plyRecord[i].banned = m;
        })
        const moveHistory = refGame.history({ verbose: true });

        const runningGame = new Chess()
        moveHistory.forEach((move, index) => {

          runningGame.move(move)
          const fen = runningGame.fen()

          plyRecord[index].move = move.san;
          plyRecord[index].fen = fen;
        });
        setMoveHistory(pliesToMoves(plyRecord.toArr()));
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
        {moveHistory.map((move, index) => (
          <MovesRow
            move={move}
            key={index}
            moveNumber={index + 1}
            selectedPly={selectedPly}
            onPlyClick={handlePlyClick}
          />
        ))}
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
  selectedPly: string | null;
  moveNumber: number;
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
        bgcolor: selectedPly === whiteMove.fen ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: whiteMove.fen ? 'pointer' : 'default',
        width: '45%'
      }}
        onClick={() => whiteMove.fen && onPlyClick(whiteMove.fen)}
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
        bgcolor: selectedPly === blackMove?.fen ? 'rgba(255,255,255,0.15)' : 'transparent',
        cursor: blackMove?.fen ? 'pointer' : 'default',
        width: '45%'
      }}
        onClick={() => blackMove?.fen && onPlyClick(blackMove?.fen)}
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