import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import GamePanel from './GamePanel';

const LocalMoveHistory: React.FC = () => {
  const mode = useUnifiedGameStore(s => s.mode);
  
  // For local games, just use the GamePanel component
  // It already works with the unified store
  if (mode === 'local') {
    return <GamePanel />;
  }

  return (
    <Paper sx={{ 
      p: 2, 
      bgcolor: '#2e2a24',
      color: '#bababa',
      height: '100%',
    }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Move History
      </Typography>
      <Typography variant="body2">
        No local game in progress
      </Typography>
    </Paper>
  );
};

export default LocalMoveHistory;