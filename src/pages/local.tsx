import { useState, useCallback } from 'react';
import { BanChess } from 'ban-chess.ts';
import type { Action } from 'ban-chess.ts';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
import ResizableChessBoard from '@/components/ResizableChessBoard';
import MoveHistoryTable from '@/components/MoveHistoryTable';
import type { HistoryEntry } from '@/components/MoveHistoryTable';
import { Refresh } from '@mui/icons-material';

function LocalGamePage() {
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
        
        // Capture who is acting BEFORE we play the action
        const currentTurn = game.turn;
        
        const result = game.play(action);
        
        if (result.success) {
          // Update game state
          const newGame = new BanChess(game.fen());
          setGame(newGame);
          
          // Update history tracking based on Ban Chess flow:
          // 1. Black bans (before White's move) -> whiteBan in row 1
          // 2. White moves -> whiteMove in row 1
          // 3. White bans (before Black's move) -> blackBan in row 1
          // 4. Black moves -> blackMove in row 1
          // 5. Black bans (before White's move) -> whiteBan in row 2
          // etc...
          
          if (nextType === 'ban') {
            const banNotation = `${selectedSquare}→${square}`;
            setLastBan({ from: selectedSquare, to: square });
            
            // Who is banning and what column does it go in?
            // Black bans -> whiteBan (restricts White's move)
            // White bans -> blackBan (restricts Black's move)
            const banKey = currentTurn === 'black' ? 'whiteBan' : 'blackBan';
            
            // Check if we need to start a new row
            // New row starts when Black bans after completing a full turn
            const needNewRow = banKey === 'whiteBan' && currentEntry.blackMove;
            
            if (needNewRow) {
              // Save current row and start new one
              setMoveHistory(prev => [...prev, currentEntry as HistoryEntry]);
              setCurrentEntry({
                turnNumber: turnNumber + 1,
                [banKey]: banNotation,
              });
              setTurnNumber(prev => prev + 1);
            } else {
              // Add to current row
              setCurrentEntry({
                ...currentEntry,
                turnNumber: currentEntry.turnNumber || turnNumber,
                [banKey]: banNotation,
              });
            }
          } else if (nextType === 'move' && result.san) {
            // Use the turn we captured BEFORE playing the move
            const moveKey = currentTurn === 'white' ? 'whiteMove' : 'blackMove';
            
            setCurrentEntry({
              ...currentEntry,
              turnNumber: currentEntry.turnNumber || turnNumber,
              [moveKey]: result.san,
            });
            
            setLastBan(null);
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
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      pt: 4,
      pb: 4,
      minHeight: 'calc(100vh - 200px)', // Account for header and footer
    }}>
      {/* Board - Centered */}
      <Paper elevation={3} sx={{ p: 1, bgcolor: 'background.paper' }}>
        <ResizableChessBoard
          fen={game.fen()}
          onSquareClick={handleSquareClick}
          highlightedSquares={highlightedSquares}
          lastBan={lastBan}
          orientation="white"
          isBanMode={nextAction === 'ban'}
        />
      </Paper>

      {/* Side Panel - Positioned absolutely */}
      <Paper 
        elevation={2} 
        sx={{ 
          position: 'absolute',
          right: 20,
          top: 60,
          width: 280,
          maxWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: 'fit-content',
        }}
      >
        <MoveHistoryTable 
          history={[...moveHistory, ...(currentEntry.turnNumber ? [currentEntry as HistoryEntry] : [])]}
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

export default LocalGamePage;