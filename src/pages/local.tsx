import { useState, useCallback } from 'react';
import { BanChess } from 'ban-chess.ts';
import type { Action } from 'ban-chess.ts';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import ResizableChessBoard from '@/components/ResizableChessBoard';
import MoveHistoryTable from '@/components/MoveHistoryTable';
import type { HistoryEntry } from '@/components/MoveHistoryTable';
import { Refresh } from '@mui/icons-material';

export default function LocalGamePage() {
  const [game, setGame] = useState(() => new BanChess());
  const [moveHistory, setMoveHistory] = useState<HistoryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Partial<HistoryEntry>>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
  const [lastBan, setLastBan] = useState<{ from: string; to: string } | null>(null);
  const [turnNumber, setTurnNumber] = useState(1);

  const handleSquareClick = useCallback((square: string) => {
    if (game.gameOver()) return;

    const nextType = game.nextActionType();
    
    if (!selectedSquare) {
      // First click - check if this square has any legal actions
      let destinations: string[] = [];
      
      if (nextType === 'move') {
        const moves = game.legalMoves();
        destinations = moves
          .filter(m => m.from === square)
          .map(m => m.to);
      } else {
        const bans = game.legalBans();
        destinations = bans
          .filter(b => b.from === square)
          .map(b => b.to);
      }
      
      // Only select the square if it has legal destinations
      if (destinations.length > 0) {
        setSelectedSquare(square);
        setHighlightedSquares(destinations);
      }
    } else {
      // Second click - make the action
      if (highlightedSquares.includes(square)) {
        const action: Action = nextType === 'move'
          ? { move: { from: selectedSquare, to: square } }
          : { ban: { from: selectedSquare, to: square } };
        
        const result = game.play(action);
        
        if (result.success) {
          // Update game state
          const newGame = new BanChess(game.fen());
          setGame(newGame);
          
          // Update history tracking
          if (nextType === 'move' && result.san) {
            const wasWhiteMove = game.turn === 'black';
            const moveKey = wasWhiteMove ? 'whiteMove' : 'blackMove';
            
            const updatedEntry = {
              ...currentEntry,
              turnNumber,
              [moveKey]: result.san,
            };
            
            if (!wasWhiteMove) {
              setMoveHistory(prev => [...prev, updatedEntry as HistoryEntry]);
              setCurrentEntry({});
              setTurnNumber(prev => prev + 1);
            } else {
              setCurrentEntry(updatedEntry);
            }
            
            setLastBan(null);
          } else if (nextType === 'ban') {
            const banNotation = `${selectedSquare}→${square}`;
            setLastBan({ from: selectedSquare, to: square });
            
            // Immediately add the ban to the history
            const isWhiteBanning = game.turn === 'white';
            const banKey = isWhiteBanning ? 'whiteBan' : 'blackBan';
            
            if (isWhiteBanning) {
              // White just moved and is now banning - update current entry
              const updatedEntry = {
                ...currentEntry,
                [banKey]: banNotation,
              };
              setCurrentEntry(updatedEntry);
            } else {
              // Black just moved and is now banning - need to complete the entry
              const updatedEntry = {
                ...currentEntry,
                [banKey]: banNotation,
              };
              setMoveHistory(prev => [...prev, updatedEntry as HistoryEntry]);
              setCurrentEntry({});
              setTurnNumber(prev => prev + 1);
            }
          }
        }
      }
      
      // Clear selection
      setSelectedSquare(null);
      setHighlightedSquares([]);
    }
  }, [game, selectedSquare, highlightedSquares, currentEntry, turnNumber]);

  const resetGame = () => {
    setGame(new BanChess());
    setMoveHistory([]);
    setCurrentEntry({});
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setLastBan(null);
    setTurnNumber(1);
  };

  const turn = game.turn;
  const nextAction = game.nextActionType();
  const isGameOver = game.gameOver();
  const inCheck = game.inCheck();
  const checkmate = game.inCheckmate();
  const stalemate = game.inStalemate();

  return (
    <Box sx={{ 
      height: '100vh',
      display: 'flex',
      p: 3,
      gap: 3,
      bgcolor: 'background.default',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Board - Primary Focus */}
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flex: '0 1 auto',
      }}>
        <Paper elevation={3} sx={{ p: 1.5, bgcolor: 'background.paper' }}>
          <ResizableChessBoard
            fen={game.fen()}
            onSquareClick={handleSquareClick}
            highlightedSquares={highlightedSquares}
            lastBan={lastBan}
            orientation="white"
            isBanMode={nextAction === 'ban'}
          />
        </Paper>
      </Box>

      {/* Side Panel - Move History and Controls */}
      <Paper 
        elevation={2} 
        sx={{ 
          width: 280,
          maxWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: 'fit-content',
          maxHeight: '80vh',
        }}
      >
        <MoveHistoryTable 
          history={[...moveHistory, ...(Object.keys(currentEntry).length > 1 ? [currentEntry as HistoryEntry] : [])]}
        />
        
        {/* Game Status and Controls */}
        <Box sx={{ 
          borderTop: 1, 
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              label={turn === 'white' ? 'White' : 'Black'}
              size="small"
              color={turn === 'white' ? 'default' : 'primary'}
              sx={{ flex: 1, minWidth: 60 }}
            />
            <Chip 
              label={nextAction === 'ban' ? 'Banning' : 'Moving'}
              size="small"
              color={nextAction === 'ban' ? 'error' : 'success'}
              sx={{ flex: 1, minWidth: 70 }}
            />
          </Box>
          
          {inCheck && <Chip label="CHECK" size="small" color="warning" />}
          {isGameOver && (
            <Chip 
              label={checkmate ? 'CHECKMATE' : stalemate ? 'STALEMATE' : 'GAME OVER'}
              size="small"
              color="error"
            />
          )}
          
          <Button
            startIcon={<Refresh />}
            onClick={resetGame}
            size="small"
            variant="contained"
            fullWidth
          >
            New Game
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}