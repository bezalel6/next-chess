import { Box, Paper, Button, Chip } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import ResizableChessBoard from './ResizableChessBoard';
import MoveHistoryTable from './MoveHistoryTable';
import type { HistoryEntry } from './MoveHistoryTable';
import type { ReactNode } from 'react';

interface GameLayoutProps {
  // Board props
  fen: string;
  onSquareClick: (square: string) => void;
  highlightedSquares: string[];
  lastBan?: { from: string; to: string } | null;
  orientation?: 'white' | 'black';
  isBanMode?: boolean;
  boardDisabled?: boolean;
  
  // Game state
  turn: 'white' | 'black';
  nextAction: 'ban' | 'move';
  inCheck?: boolean;
  isGameOver?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
  
  // Move history
  moveHistory: HistoryEntry[];
  
  // Actions
  onNewGame?: () => void;
  
  // Additional controls (for online games)
  additionalControls?: ReactNode;
}

export default function GameLayout({
  fen,
  onSquareClick,
  highlightedSquares,
  lastBan,
  orientation = 'white',
  isBanMode = false,
  boardDisabled = false,
  turn,
  nextAction,
  inCheck = false,
  isGameOver = false,
  checkmate = false,
  stalemate = false,
  moveHistory,
  onNewGame,
  additionalControls,
}: GameLayoutProps) {
  return (
    <Box sx={{ 
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'flex-start',
      pt: 4,
      pb: 4,
      px: 2,
      minHeight: 'calc(100vh - 200px)', // Account for header and footer
      maxWidth: '1600px',
      mx: 'auto',
      width: '100%',
    }}>
      {/* Left spacer */}
      <Box />
      
      {/* Board - Center column */}
      <Paper elevation={3} sx={{ p: 1, bgcolor: 'background.paper' }}>
        <ResizableChessBoard
          fen={fen}
          onSquareClick={onSquareClick}
          highlightedSquares={highlightedSquares}
          lastBan={lastBan}
          orientation={orientation}
          isBanMode={isBanMode}
          disabled={boardDisabled}
        />
      </Paper>

      {/* Right column with move history */}
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'flex-start',
        pl: 3,
      }}>
        <Paper 
          elevation={2} 
          sx={{ 
            width: 280,
            maxWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: 'fit-content',
            position: 'sticky',
            top: 20,
          }}
        >
            <MoveHistoryTable 
              history={moveHistory}
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
              
              {additionalControls}
              
              {onNewGame && (
                <Button
                  startIcon={<Refresh />}
                  onClick={onNewGame}
                  size="small"
                  variant="contained"
                  fullWidth
                >
                  New Game
                </Button>
              )}
            </Box>
        </Paper>
      </Box>
    </Box>
  );
}