import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { Circle as CircleIcon } from '@mui/icons-material';
import { PlayerPresenceStatus } from '@/services/presenceService';

interface PlayerStatusProps {
  username: string;
  color: 'white' | 'black';
  status: PlayerPresenceStatus;
  isCurrentTurn: boolean;
}

export default function PlayerStatus({ username, color, status, isCurrentTurn }: PlayerStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'rage_quit': return '#f44336';
      case 'disconnect': return '#ff9800';
      case 'offline': 
      default: return '#9e9e9e';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online': return 'Online';
      case 'rage_quit': return 'Left the game';
      case 'disconnect': return 'Disconnected';
      case 'offline': 
      default: return 'Offline';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 0.5,
        borderRadius: 1,
        bgcolor: isCurrentTurn ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
        border: isCurrentTurn ? '1px solid rgba(33, 150, 243, 0.3)' : 'none',
      }}
    >
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: isCurrentTurn ? 'bold' : 'normal',
          color: isCurrentTurn ? 'primary.main' : 'text.primary',
        }}
      >
        {username} ({color})
      </Typography>

      <Tooltip title={getStatusText()}>
        <CircleIcon 
          sx={{ 
            fontSize: 10, 
            color: getStatusColor(),
          }} 
        />
      </Tooltip>

      {isCurrentTurn && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'primary.main',
            ml: 'auto',
          }}
        >
          To move
        </Typography>
      )}
    </Box>
  );
}