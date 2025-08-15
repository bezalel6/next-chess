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
  const gameState = useUnifiedGameStore(s => s.localGame);
  const selectBan = useUnifiedGameStore(s => s.selectLocalBan);
  const makeMove = useUnifiedGameStore(s => s.makeLocalMove);
  const resetGame = useUnifiedGameStore(s => s.resetLocalGame);
  const getPossibleMoves = useUnifiedGameStore(s => s.getLocalPossibleMoves);
  const isMoveBanned = useUnifiedGameStore(s => s.isLocalMoveBanned);
  const getGameStatusMessage = useUnifiedGameStore(s => s.getLocalGameStatusMessage);
  
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, any>>({});
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

  // Update board orientation based on game phase and current player
  useEffect(() => {
    if (!gameState) return;
    
    // During banning phase, orient board from the perspective of the banning player
    if (gameState.phase === 'banning') {
      // The banning player is the one who just moved (opposite of current turn)
      const banningPlayer = gameState.chess.turn() === 'w' ? 'black' : 'white';
      setBoardOrientation(banningPlayer);
    } else {
      // During playing phase, keep board oriented for current player
      setBoardOrientation(gameState.currentPlayer);
    }
  }, [gameState?.phase, gameState?.currentPlayer, gameState?.chess]);

  // Get move options for highlighting
  const getMoveOptions = useCallback((square: Square) => {
    if (!gameState) return {};

    const moves = getPossibleMoves();
    const newSquares: Record<string, any> = {};

    moves.forEach((move) => {
      if (move.from === square) {
        const isBanned = isMoveBanned(move.from as Square, move.to as Square);
        newSquares[move.to] = {
          background: isBanned 
            ? 'radial-gradient(circle, rgba(255,0,0,0.3) 25%, transparent 25%)'
            : gameState.chess.get(move.to) 
              ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' 
              : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
          borderRadius: '50%',
        };
      }
    });

    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    };

    return newSquares;
  }, [gameState, getPossibleMoves, isMoveBanned]);

  // Handle piece click for move or ban selection
  const onSquareClick = useCallback((square: Square) => {
    if (!gameState) return;

    // If in banning phase
    if (gameState.phase === 'banning') {
      if (!moveFrom) {
        // First click - select piece to move from
        const piece = gameState.chess.get(square);
        if (piece && piece.color === gameState.chess.turn()) {
          setMoveFrom(square);
          setOptionSquares(getMoveOptions(square));
        }
      } else {
        // If clicking the same square, deselect it
        if (moveFrom === square) {
          setMoveFrom(null);
          setOptionSquares({});
          return;
        }
        
        // Second click - select destination to ban
        const moves = getPossibleMoves();
        const moveExists = moves.some(m => m.from === moveFrom && m.to === square);
        
        if (moveExists) {
          selectBan(moveFrom, square);
          setMoveFrom(null);
          setOptionSquares({});
        } else {
          // Check if clicking another piece to select instead
          const piece = gameState.chess.get(square);
          if (piece && piece.color === gameState.chess.turn()) {
            setMoveFrom(square);
            setOptionSquares(getMoveOptions(square));
          } else {
            // Reset selection if invalid
            setMoveFrom(null);
            setOptionSquares({});
          }
        }
      }
    } 
    // If in playing phase
    else if (gameState.phase === 'playing') {
      if (!moveFrom) {
        // First click - select piece to move
        const piece = gameState.chess.get(square);
        if (piece && piece.color === gameState.chess.turn()) {
          setMoveFrom(square);
          setOptionSquares(getMoveOptions(square));
        }
      } else {
        // If clicking the same square, deselect it
        if (moveFrom === square) {
          setMoveFrom(null);
          setOptionSquares({});
          return;
        }
        
        // Second click - make the move
        const success = makeMove(moveFrom, square);
        
        if (success) {
          setMoveFrom(null);
          setOptionSquares({});
        } else {
          // Try selecting a new piece if move failed
          const piece = gameState.chess.get(square);
          if (piece && piece.color === gameState.chess.turn()) {
            setMoveFrom(square);
            setOptionSquares(getMoveOptions(square));
          } else {
            setMoveFrom(null);
            setOptionSquares({});
          }
        }
      }
    }
  }, [gameState, moveFrom, selectBan, makeMove, getPossibleMoves, getMoveOptions]);

  // Handle drag start - show available moves
  const onPieceDragBegin = useCallback((piece: string, sourceSquare: Square) => {
    if (!gameState) return;
    
    // Show moves for both playing and banning phases
    const pieceData = gameState.chess.get(sourceSquare);
    if (pieceData && pieceData.color === gameState.chess.turn()) {
      setMoveFrom(sourceSquare); // Track the source for ban selection
      setOptionSquares(getMoveOptions(sourceSquare));
    }
  }, [gameState, getMoveOptions]);

  // Handle drag end - clear highlights
  const onPieceDragEnd = useCallback(() => {
    setOptionSquares({});
    // Don't clear moveFrom here as we might need it for ban selection
  }, []);

  // Handle drag and drop for both playing and banning phases
  const onDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (!gameState) return false;
    
    if (gameState.phase === 'playing') {
      const success = makeMove(sourceSquare, targetSquare);
      setOptionSquares({});
      setMoveFrom(null);
      return success;
    } else if (gameState.phase === 'banning') {
      // Check if this is a valid move to ban
      const moves = getPossibleMoves();
      const moveExists = moves.some(m => m.from === sourceSquare && m.to === targetSquare);
      
      if (moveExists) {
        selectBan(sourceSquare, targetSquare);
        setOptionSquares({});
        setMoveFrom(null);
        return true;
      }
      
      setOptionSquares({});
      setMoveFrom(null);
      return false;
    }
    
    return false;
  }, [gameState, makeMove, selectBan, getPossibleMoves]);

  const customSquareStyles = {
    ...optionSquares,
    ...rightClickedSquares,
  };

  // Add banned move highlighting
  const bannedSquareStyles = gameState?.bannedMove ? {
    [gameState.bannedMove.from]: {
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
    },
    [gameState.bannedMove.to]: {
      backgroundColor: 'rgba(255, 0, 0, 0.3)',
    },
  } : {};

  const allSquareStyles = {
    ...customSquareStyles,
    ...bannedSquareStyles,
  };

  if (!gameState) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography>Initializing game...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      {/* Status Display */}
      <Paper sx={{ 
        p: 2, 
        width: '100%', 
        maxWidth: 560,
        bgcolor: '#2e2a24',
        color: '#bababa',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">
            Local Ban Chess Game
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={resetGame}
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
            gameState.status !== 'active' ? 'success' :
            gameState.phase === 'banning' ? 'warning' : 'info'
          }
          icon={gameState.phase === 'banning' ? <BlockIcon /> : <SportsEsportsIcon />}
          sx={{ mb: 1 }}
        >
          {getGameStatusMessage()}
        </Alert>

        {/* Game Info */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={`Turn: ${gameState.currentPlayer === 'white' ? 'White' : 'Black'}`}
            color={gameState.currentPlayer === 'white' ? 'default' : 'primary'}
            size="small"
          />
          <Chip 
            label={`Move ${Math.floor(gameState.moveHistory.length / 2) + 1}`}
            size="small"
            variant="outlined"
          />
          {gameState.phase === 'banning' && (
            <Chip 
              label="Ban Phase"
              color="warning"
              size="small"
              icon={<BlockIcon />}
            />
          )}
          {gameState.bannedMove && gameState.phase === 'playing' && (
            <Chip 
              label={`Banned: ${gameState.bannedMove.from}${gameState.bannedMove.to}`}
              color="error"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {/* Instructions */}
        <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
          {gameState.phase === 'banning' 
            ? `Click or drag a ${gameState.currentPlayer} piece to a destination square to ban that move.`
            : `${gameState.currentPlayer === 'white' ? 'White' : 'Black'}'s turn. Click or drag to move.`}
        </Typography>
      </Paper>

      {/* Chess Board */}
      <Box sx={{ width: 560, height: 560 }}>
        <Chessboard
          position={gameState.chess.fen()}
          onSquareClick={onSquareClick}
          onPieceDrop={onDrop}
          onPieceDragBegin={onPieceDragBegin}
          onPieceDragEnd={onPieceDragEnd}
          boardOrientation={boardOrientation}
          customSquareStyles={allSquareStyles}
          customBoardStyle={{
            borderRadius: '4px',
            boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
          }}
          animationDuration={200}
          arePiecesDraggable={true}
        />
      </Box>

      {/* Move History Summary */}
      <Paper sx={{ 
        p: 1.5, 
        width: '100%', 
        maxWidth: 560,
        bgcolor: '#2e2a24',
        color: '#bababa',
      }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Recent Moves:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {gameState.moveHistory.slice(-4).map((move, idx) => (
            <Chip
              key={idx}
              label={`${move.moveNumber}. ${move.san}`}
              size="small"
              variant="outlined"
              sx={{ 
                color: move.playerColor === 'white' ? '#fff' : '#aaa',
                borderColor: move.bannedMove ? 'error.main' : 'divider',
              }}
            />
          ))}
          {gameState.moveHistory.length === 0 && (
            <Typography variant="caption" sx={{ opacity: 0.5 }}>
              No moves yet
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default LocalGameBoard;