import React, { useEffect, useState } from 'react';
import { Box, Typography, Tooltip, Chip, LinearProgress } from '@mui/material';
import { 
  Circle as CircleIcon,
  AccessTime as ClockIcon,
  Warning as WarningIcon,
  WifiOff as DisconnectedIcon,
  Sync as ReconnectingIcon,
  SignalCellularAlt as SignalIcon,
  SignalCellularAlt1Bar as PoorSignalIcon,
} from '@mui/icons-material';
import { useGamePresence, type PlayerPresenceData } from '@/contexts/GamePresenceContext';
import { supabaseBrowser } from '@/utils/supabase-browser';

interface PlayerPresenceIndicatorV2Props {
  playerId: string;
  playerColor: 'white' | 'black';
  isCurrentTurn: boolean;
  playerUsername?: string;
  isCurrentUser?: boolean;
}

export default function PlayerPresenceIndicatorV2({ 
  playerId, 
  playerColor,
  isCurrentTurn,
  playerUsername = 'Player',
  isCurrentUser = false
}: PlayerPresenceIndicatorV2Props) {
  const { myPresence, opponentPresence, isChannelConnected, reconnectAttempts } = useGamePresence();
  const [secondsSinceLastSeen, setSecondsSinceLastSeen] = useState<number>(0);
  const [dbPresence, setDbPresence] = useState<any>(null);

  // Use realtime presence if available, fallback to database
  const presence: PlayerPresenceData | null = isCurrentUser 
    ? myPresence 
    : opponentPresence || null;

  // Fallback to database presence if realtime not available
  useEffect(() => {
    if (!presence && playerId) {
      const supabase = supabaseBrowser();
      
      const fetchPresence = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('is_online, last_heartbeat, last_active, username')
          .eq('id', playerId)
          .single();

        if (data) {
          setDbPresence(data);
        }
      };

      fetchPresence();
      const interval = setInterval(fetchPresence, 10000);
      return () => clearInterval(interval);
    }
  }, [playerId, presence]);

  // Update timer every second
  useEffect(() => {
    if (!presence && !dbPresence) return;

    const updateTimer = () => {
      const lastSeen = presence?.lastSeen || (dbPresence?.last_active ? new Date(dbPresence.last_active) : null);
      if (!lastSeen) return;

      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - lastSeen.getTime()) / 1000);
      setSecondsSinceLastSeen(Math.max(0, diffSeconds));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [presence, dbPresence]);

  // Determine status with realtime presence priority
  const getStatus = () => {
    // If we have realtime presence, use it
    if (presence) {
      if (presence.status === 'disconnected') return 'disconnected';
      if (presence.isReconnecting) return 'reconnecting';
      if (presence.status === 'away') return 'away';
      if (presence.status === 'online') return 'online';
    }

    // Fallback to database-based status
    if (dbPresence) {
      if (secondsSinceLastSeen < 30) return 'online';
      if (secondsSinceLastSeen < 60) return 'idle';
      if (secondsSinceLastSeen < 120) return 'warning';
      return 'abandoned';
    }

    return 'unknown';
  };

  const getConnectionQuality = () => {
    if (presence?.connectionQuality) return presence.connectionQuality;
    if (!isChannelConnected) return 'unknown';
    if (reconnectAttempts > 2) return 'poor';
    return 'good';
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
  const connectionQuality = getConnectionQuality();
  const displayUsername = presence?.username || dbPresence?.username || playerUsername;

  // Status configuration
  const statusConfig = {
    online: {
      color: '#4caf50',
      message: 'Online',
      icon: CircleIcon,
      pulse: true,
    },
    away: {
      color: '#ffc107',
      message: 'Away',
      icon: ClockIcon,
      pulse: false,
    },
    idle: {
      color: '#ffeb3b',
      message: 'Idle',
      icon: CircleIcon,
      pulse: false,
    },
    warning: {
      color: '#ff9800',
      message: 'May be away',
      icon: WarningIcon,
      pulse: false,
    },
    disconnected: {
      color: '#f44336',
      message: 'Disconnected',
      icon: DisconnectedIcon,
      pulse: false,
    },
    reconnecting: {
      color: '#2196f3',
      message: 'Reconnecting...',
      icon: ReconnectingIcon,
      pulse: true,
      rotate: true as true,
    },
    abandoned: {
      color: '#f44336',
      message: 'Appears to have left',
      icon: WarningIcon,
      pulse: false,
    },
    unknown: {
      color: '#9e9e9e',
      message: 'Unknown',
      icon: CircleIcon,
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const showTimer = isCurrentTurn && (status === 'warning' || status === 'abandoned' || status === 'disconnected');
  const showReconnecting = status === 'reconnecting';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: isCurrentTurn ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
        border: isCurrentTurn ? '1px solid rgba(33, 150, 243, 0.3)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Player name and color */}
      <Typography 
        variant="body2" 
        sx={{ 
          fontWeight: isCurrentTurn ? 'bold' : 'normal',
          color: isCurrentTurn ? 'primary.main' : 'text.primary',
        }}
      >
        {displayUsername} ({playerColor})
      </Typography>

      {/* Connection quality indicator */}
      {isCurrentUser && connectionQuality !== 'unknown' && (
        <Tooltip title={`Connection: ${connectionQuality}`}>
          {connectionQuality === 'good' ? (
            <SignalIcon sx={{ fontSize: 14, color: '#4caf50' }} />
          ) : (
            <PoorSignalIcon sx={{ fontSize: 14, color: '#ff9800' }} />
          )}
        </Tooltip>
      )}

      {/* Status indicator */}
      <Tooltip title={config.message}>
        <StatusIcon 
          sx={{ 
            fontSize: 12, 
            color: config.color,
            animation: config.pulse ? 'pulse 2s infinite' : 
                      ('rotate' in config && config.rotate) ? 'rotate 1s linear infinite' : 'none',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.4 },
              '100%': { opacity: 1 },
            },
            '@keyframes rotate': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            }
          }} 
        />
      </Tooltip>

      {/* Reconnecting indicator */}
      {showReconnecting && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="info.main">
            Reconnecting
          </Typography>
          {reconnectAttempts > 0 && (
            <Typography variant="caption" color="text.secondary">
              (attempt {reconnectAttempts})
            </Typography>
          )}
        </Box>
      )}

      {/* Disconnection/Warning timer */}
      {showTimer && !showReconnecting && (
        <Chip
          size="small"
          icon={status === 'disconnected' ? <DisconnectedIcon /> : <ClockIcon />}
          label={
            status === 'disconnected' 
              ? `Disconnected ${formatTime(secondsSinceLastSeen)} ago`
              : `Away for ${formatTime(secondsSinceLastSeen)}`
          }
          color={status === 'disconnected' || status === 'abandoned' ? 'error' : 'warning'}
          variant={status === 'disconnected' || status === 'abandoned' ? 'filled' : 'outlined'}
          sx={{
            height: 24,
            '& .MuiChip-icon': {
              fontSize: 16
            }
          }}
        />
      )}

      {/* Turn indicator */}
      {isCurrentTurn && status !== 'abandoned' && status !== 'disconnected' && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'primary.main',
            ml: 'auto',
            fontWeight: 'bold',
          }}
        >
          {isCurrentUser ? 'Your turn' : 'Their turn'}
        </Typography>
      )}

      {/* Reconnection progress */}
      {showReconnecting && (
        <Box sx={{ width: 60, ml: 1 }}>
          <LinearProgress 
            variant="indeterminate" 
            sx={{ 
              height: 2,
              borderRadius: 1,
              bgcolor: 'rgba(33, 150, 243, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'info.main',
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
}