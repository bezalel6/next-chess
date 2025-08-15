import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Paper, Chip, Alert, Button } from '@mui/material';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.ts';
import type { Square } from 'chess.ts/dist/types';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import BlockIcon from '@mui/icons-material/Block';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

const LocalGameBoard: React.FC = () => {
  // Get state values individually to avoid infinite loops
  const mode = useUnifiedGameStore(s => s.mode);
  const chess = useUnifiedGameStore(s => s.chess);
  const currentFen = useUnifiedGameStore(s => s.currentFen);
  const localPhase = useUnifiedGameStore(s => s.localPhase);
  const localCurrentPlayer = useUnifiedGameStore(s => s.localCurrentPlayer);
  const localBannedMove = useUnifiedGameStore(s => s.localBannedMove);
  const localGameStatus = useUnifiedGameStore(s => s.localGameStatus);
  const moveHistory = useUnifiedGameStore(s => s.moveHistory);
  
  // Get functions
  const selectLocalBan = useUnifiedGameStore(s => s.selectLocalBan);
  const makeLocalMove = useUnifiedGameStore(s => s.makeLocalMove);
  const resetLocalGame = useUnifiedGameStore(s => s.resetLocalGame);
  const getLocalPossibleMoves = useUnifiedGameStore(s => s.getLocalPossibleMoves);
  const isLocalMoveBanned = useUnifiedGameStore(s => s.isLocalMoveBanned);
  const getLocalGameStatusMessage = useUnifiedGameStore(s => s.getLocalGameStatusMessage);
  
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, any>>({});
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

  // Update board orientation based on game phase and current player
  useEffect(() => {
    if (!chess || mode !== 'local') return;
    
    // During banning phase, orient board from the perspective of the banning player
    if (localPhase === 'banning') {
      // The banning player is the one who just moved (opposite of current turn)
      const banningPlayer = chess.turn() === 'w' ? 'black' : 'white';
      setBoardOrientation(banningPlayer);
    } else {
      // During playing phase, keep board oriented for current player
      setBoardOrientation(localCurrentPlayer);
    }
  }, [localPhase, localCurrentPlayer, chess, mode]);

  // Get move options for highlighting
  const getMoveOptions = useCallback((square: Square) => {
    if (!getLocalPossibleMoves) return {};

    const moves = getLocalPossibleMoves();
    const newSquares: Record<string, any> = {};

    moves.forEach((move) => {
      if (move.from === square) {
        const isBanned = isLocalMoveBanned ? isLocalMoveBanned(move.from as Square, move.to as Square) : false;
        newSquares[move.to] = {
          background: isBanned 
            ? 'radial-gradient(circle, rgba(255, 0, 0, 0.4) 25%, transparent 25%)'
            : 'radial-gradient(circle, rgba(0, 255, 0, 0.3) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      }
    });

    return newSquares;
  }, [getLocalPossibleMoves, isLocalMoveBanned]);

  const onSquareClick = useCallback((square: Square) => {
    if (!chess || mode !== 'local') return;

    // If we're in banning phase
    if (localPhase === 'banning') {
      const moves = getLocalPossibleMoves ? getLocalPossibleMoves() : [];
      
      if (!moveFrom) {
        // First click - select piece to ban
        const movesFromSquare = moves.filter(m => m.from === square);
        if (movesFromSquare.length > 0) {
          setMoveFrom(square);
          setOptionSquares(getMoveOptions(square));
        }
      } else {
        // Second click - select destination to ban
        const moveExists = moves.some(m => m.from === moveFrom && m.to === square);
        if (moveExists && selectLocalBan) {
          selectLocalBan(moveFrom, square);
          setOptionSquares({});
          setMoveFrom(null);
        } else {
          // Try selecting a new piece
          const movesFromSquare = moves.filter(m => m.from === square);
          if (movesFromSquare.length > 0) {
            setMoveFrom(square);
            setOptionSquares(getMoveOptions(square));
          } else {
            setOptionSquares({});
            setMoveFrom(null);
          }
        }
      }
    } else if (localPhase === 'playing') {
      // Playing phase - make moves
      if (!moveFrom) {
        setMoveFrom(square);
        setOptionSquares(getMoveOptions(square));
      } else {
        const moves = getLocalPossibleMoves ? getLocalPossibleMoves() : [];
        const moveExists = moves.some(m => m.from === moveFrom && m.to === square);
        
        if (moveExists && makeLocalMove) {
          const success = makeLocalMove(moveFrom, square);
          if (success) {
            setOptionSquares({});
            setMoveFrom(null);
          }
        } else {
          // Try selecting a new piece
          const movesFromSquare = moves.filter(m => m.from === square);
          if (movesFromSquare.length > 0) {
            setMoveFrom(square);
            setOptionSquares(getMoveOptions(square));
          } else {
            setOptionSquares({});
            setMoveFrom(null);
          }
        }
      }
    }
  }, [chess, mode, localPhase, moveFrom, getMoveOptions, getLocalPossibleMoves, selectLocalBan, makeLocalMove]);

  const onSquareRightClick = useCallback((square: Square) => {
    const color = 'rgba(255, 0, 0, 0.4)';
    setRightClickedSquares({
      ...rightClickedSquares,
      [square]: rightClickedSquares[square]
        ? undefined
        : { backgroundColor: color },
    });
  }, [rightClickedSquares]);

  const customSquareStyles = {
    ...optionSquares,
    ...rightClickedSquares,
  };

  // Add banned move highlighting
  const bannedSquareStyles = localBannedMove ? {
    [localBannedMove.from]: {
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
    },
    [localBannedMove.to]: {
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
    },
  } : {};

  const allSquareStyles = {
    ...customSquareStyles,
    ...bannedSquareStyles,
  };

  if (mode !== 'local' || !chess) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography>Initializing game...</Typography>
      </Box>
    );
  }

  const statusMessage = getLocalGameStatusMessage ? getLocalGameStatusMessage() : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      {/* Status Display */}
      <Paper sx={{ 
        p: 2, 
        bgcolor: '#2e2a24',
        width: '100%',
        maxWidth: 600,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip 
              icon={localPhase === 'banning' ? <BlockIcon /> : <SportsEsportsIcon />}
              label={localPhase === 'banning' ? 'Banning Phase' : 'Playing Phase'}
              color={localPhase === 'banning' ? 'error' : 'primary'}
              size="small"
            />
            <Chip 
              label={`${localCurrentPlayer === 'white' ? 'White' : 'Black'} to ${localPhase === 'banning' ? 'ban' : 'move'}`}
              size="small"
              variant="outlined"
            />
            <Chip 
              label={`Move ${Math.floor(moveHistory.length / 2) + 1}`}
              size="small"
              variant="outlined"
            />
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={resetLocalGame}
            sx={{
              color: '#bababa',
              borderColor: 'rgba(255,255,255,0.2)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.3)',
              },
            }}
          >
            New Game
          </Button>
        </Box>

        {/* Current Status */}
        <Alert 
          severity={
            localGameStatus !== 'active' ? 'success' :
            localPhase === 'banning' ? 'error' : 'info'
          }
          sx={{
            bgcolor: 'rgba(255,255,255,0.05)',
            '& .MuiAlert-icon': {
              color: localPhase === 'banning' ? '#f44336' : '#2196f3',
            },
          }}
        >
          {statusMessage}
        </Alert>

        {/* Banned Move Display */}
        {localBannedMove && (
          <Box sx={{ mt: 2, p: 1, bgcolor: 'rgba(255, 0, 0, 0.1)', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ color: '#ff9999' }}>
              <BlockIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
              Banned move: {localBannedMove.from} → {localBannedMove.to} 
              (by {localBannedMove.bannedBy})
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Chess Board */}
      <Box sx={{ width: 600, height: 600 }}>
        <Chessboard
          position={currentFen}
          onSquareClick={onSquareClick}
          onSquareRightClick={onSquareRightClick}
          boardOrientation={boardOrientation}
          customSquareStyles={allSquareStyles}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
          }}
        />
      </Box>
    </Box>
  );
};

export default LocalGameBoard;