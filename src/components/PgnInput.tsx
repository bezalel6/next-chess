import { Box, TextField, IconButton, Tooltip } from "@mui/material";
import { useState, useEffect } from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { Chess } from "chess.ts";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UploadIcon from '@mui/icons-material/Upload';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function PgnInput() {
  const game = useUnifiedGameStore(s => s.game);
  const resetLocalGame = useUnifiedGameStore(s => s.resetLocalGame);
  const [pgnText, setPgnText] = useState('');

  // Update local PGN text when game changes
  useEffect(() => {
    if (game?.pgn) {
      setPgnText(game.pgn);
    } else {
      setPgnText('');
    }
  }, [game?.pgn]);

  const handlePgnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPgnText(event.target.value);
  };

  const handleLoadPgn = () => {
    try {
      if (!pgnText.trim()) return;

      // Validate PGN by trying to load it
      const testChess = new Chess();
      testChess.loadPgn(pgnText.trim());

      // Get the state from the unified store
      const state = useUnifiedGameStore.getState();
      
      // Reset and reinitialize with new PGN
      state.initLocalGame();
      
      // Load the PGN into the chess instance
      if (state.chess) {
        state.chess.loadPgn(pgnText.trim());
        
        // Update the game object with new state
        const newFen = state.chess.fen();
        const newTurn = state.chess.turn() === 'w' ? 'white' : 'black';
        
        // Determine the next banning player based on game state
        const history = state.chess.history();
        let banningPlayer: 'white' | 'black' | null = null;
        let phase: 'selecting_ban' | 'making_move' = 'selecting_ban';
        
        if (history.length === 0) {
          // Game start - Black bans first
          banningPlayer = 'black';
          phase = 'selecting_ban';
        } else {
          // Determine phase based on move count and turn
          const lastMoveColor = history.length % 2 === 1 ? 'white' : 'black';
          banningPlayer = lastMoveColor; // The player who just moved bans next
          phase = 'selecting_ban';
        }
        
        if (state.game) {
          state.game.pgn = pgnText.trim();
          state.game.currentFen = newFen;
          state.game.turn = newTurn;
          state.game.banningPlayer = banningPlayer;
        }
        
        // Update store state
        state.setPhase(phase);
        useUnifiedGameStore.setState({
          currentFen: newFen,
          currentTurn: newTurn,
        });
      }
    } catch (err) {
      console.error('Failed to load PGN:', err);
    }
  };

  const handleCopyPgn = async () => {
    try {
      await navigator.clipboard.writeText(pgnText);
    } catch (err) {
      console.error('Failed to copy to clipboard');
    }
  };

  const handleNewGame = () => {
    resetLocalGame();
  };

  return (
    <Box sx={{ 
      display: 'flex',
      gap: 0.5,
      alignItems: 'center',
      width: '100%',
      mt: 1,
    }}>
      <TextField
        value={pgnText}
        onChange={handlePgnChange}
        placeholder="PGN"
        size="small"
        fullWidth
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            color: 'rgba(255,255,255,0.7)',
            backgroundColor: 'rgba(0,0,0,0.15)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            height: '32px',
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.08)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255,255,255,0.12)',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'rgba(255,255,255,0.2)',
            },
            '& input': {
              padding: '6px 10px',
            }
          },
        }}
      />
      
      <Tooltip title="Load PGN">
        <IconButton 
          size="small" 
          onClick={handleLoadPgn}
          disabled={!pgnText.trim()}
          sx={{ 
            color: 'rgba(255,255,255,0.3)',
            padding: '6px',
            '&:hover': {
              color: 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(255,255,255,0.05)',
            },
            '&.Mui-disabled': {
              color: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <UploadIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Copy PGN">
        <IconButton 
          size="small" 
          onClick={handleCopyPgn}
          disabled={!pgnText.trim()}
          sx={{ 
            color: 'rgba(255,255,255,0.3)',
            padding: '6px',
            '&:hover': {
              color: 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(255,255,255,0.05)',
            },
            '&.Mui-disabled': {
              color: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          <ContentCopyIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="New Game">
        <IconButton 
          size="small" 
          onClick={handleNewGame}
          sx={{ 
            color: 'rgba(255,255,255,0.3)',
            padding: '6px',
            '&:hover': {
              color: 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(255,255,255,0.05)',
            },
          }}
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}