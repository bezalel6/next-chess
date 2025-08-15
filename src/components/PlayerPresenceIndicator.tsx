import React, { useEffect, useState } from 'react';
import { Box, Typography, Tooltip, Chip } from '@mui/material';
import { 
  Circle as CircleIcon,
  AccessTime as ClockIcon,
  Warning as WarningIcon 
} from '@mui/icons-material';
import { supabaseBrowser } from '@/utils/supabase-browser';

interface PlayerPresenceIndicatorProps {
  playerId: string;
  playerColor: 'white' | 'black';
  isCurrentTurn: boolean;
}

interface PlayerPresence {
  is_online: boolean;
  last_heartbeat: string;
  last_active: string;
  username: string;
}

const STALE_THRESHOLD_SECONDS = 120; // 2 minutes
const WARNING_THRESHOLD_SECONDS = 60; // 1 minute

export default function PlayerPresenceIndicator({ 
  playerId, 
  playerColor,
  isCurrentTurn 
}: PlayerPresenceIndicatorProps) {
  const [presence, setPresence] = useState<PlayerPresence | null>(null);
  const [secondsSinceActive, setSecondsSinceActive] = useState<number>(0);

  // Fetch and subscribe to player presence
  useEffect(() => {
    if (!playerId) return;

    const supabase = supabaseBrowser();
    
    // Initial fetch
    const fetchPresence = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_online, last_heartbeat, last_active, username')
        .eq('id', playerId)
        .single();

      if (!error && data) {
        setPresence(data);
      }
    };

    fetchPresence();

    // Subscribe to presence changes
    const channel = supabase
      .channel(`presence:${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          const newData = payload.new as PlayerPresence;
          setPresence(newData);
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  // Update timer every second
  useEffect(() => {
    if (!presence?.last_active) return;

    const updateTimer = () => {
      const lastActive = new Date(presence.last_active);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);
      setSecondsSinceActive(diffSeconds);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [presence?.last_active]);

  // Determine status
  const getStatus = () => {
    if (!presence) return 'unknown';
    
    if (secondsSinceActive < 30) return 'online';
    if (secondsSinceActive < WARNING_THRESHOLD_SECONDS) return 'idle';
    if (secondsSinceActive < STALE_THRESHOLD_SECONDS) return 'warning';
    return 'abandoned';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const status = getStatus();
  const isAbandoned = status === 'abandoned';
  const isWarning = status === 'warning';
  const showTimer = isCurrentTurn && (isWarning || isAbandoned);

  // Status colors
  const statusColors = {
    online: '#4caf50',
    idle: '#ffeb3b',
    warning: '#ff9800',
    abandoned: '#f44336',
    unknown: '#9e9e9e'
  };

  const statusMessages = {
    online: 'Online',
    idle: 'Idle',
    warning: 'May be away',
    abandoned: 'Appears to have left',
    unknown: 'Unknown'
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: isCurrentTurn ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: isCurrentTurn ? '1px solid rgba(255,255,255,0.1)' : 'none',
      }}
    >
      {/* Player name and color */}
      <Typography variant="body2" sx={{ fontWeight: isCurrentTurn ? 'bold' : 'normal' }}>
        {presence?.username || 'Player'} ({playerColor})
      </Typography>

      {/* Status indicator */}
      <Tooltip title={statusMessages[status]}>
        <CircleIcon 
          sx={{ 
            fontSize: 12, 
            color: statusColors[status],
            animation: status === 'online' ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.5 },
              '100%': { opacity: 1 },
            }
          }} 
        />
      </Tooltip>

      {/* Abandonment warning/timer */}
      {showTimer && (
        <Chip
          size="small"
          icon={isAbandoned ? <WarningIcon /> : <ClockIcon />}
          label={`Away for ${formatTime(secondsSinceActive)}`}
          color={isAbandoned ? 'error' : 'warning'}
          variant={isAbandoned ? 'filled' : 'outlined'}
          sx={{
            height: 24,
            '& .MuiChip-icon': {
              fontSize: 16
            }
          }}
        />
      )}

      {/* Turn indicator */}
      {isCurrentTurn && !isAbandoned && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'primary.main',
            ml: 'auto'
          }}
        >
          Their turn
        </Typography>
      )}
    </Box>
  );
}