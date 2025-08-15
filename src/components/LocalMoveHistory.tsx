import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import MoveHistoryV2 from './MoveHistoryV2';

const LocalMoveHistory: React.FC = () => {
  const mode = useUnifiedGameStore(s => s.mode);
  
  // For local games, just use the MoveHistoryV2 component
  // It already works with the unified store
  if (mode === 'local') {
    return <MoveHistoryV2 />;
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