import React, { useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, LinearProgress, Chip, Tooltip } from '@mui/material';
import { 
  Timer as TimerIcon,
  CheckCircle as ClaimIcon,
  Handshake as DrawIcon,
  HourglassEmpty as WaitIcon,
  WifiOff as DisconnectIcon,
  ExitToApp as RageQuitIcon,
} from '@mui/icons-material';
import { useGamePresence } from '@/services/presenceService';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';

interface DisconnectHandlerProps {
  gameId: string;
}

export default function DisconnectHandler({ gameId }: DisconnectHandlerProps) {
  const { user } = useAuth();
  const game = useUnifiedGameStore(state => state.game);
  const { opponentStatus, presenceService } = useGamePresence(gameId);
  const [claimAvailable, setClaimAvailable] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(0);
  const [claiming, setClaiming] = useState(false);

  // Check if we can claim
  useEffect(() => {
    if (!game || !user) return;

    const checkClaimStatus = async () => {
      // Only check if opponent is disconnected and it's their turn
      const isOpponentTurn = 
        (game.turn === 'white' && game.white_player_id !== user.id) ||
        (game.turn === 'black' && game.black_player_id !== user.id);

      if (!isOpponentTurn || opponentStatus === 'online') {
        setClaimAvailable(false);
        setTimeoutSeconds(0);
        return;
      }

      // Check claim availability from database
      if (game.claim_available_at) {
        const claimTime = new Date(game.claim_available_at);
        const now = new Date();
        
        if (now >= claimTime) {
          setClaimAvailable(true);
          setTimeoutSeconds(0);
        } else {
          setClaimAvailable(false);
          const secondsRemaining = Math.ceil((claimTime.getTime() - now.getTime()) / 1000);
          setTimeoutSeconds(secondsRemaining);
        }
      }
    };

    checkClaimStatus();
    const interval = setInterval(checkClaimStatus, 1000);

    return () => clearInterval(interval);
  }, [game, user, opponentStatus]);

  const handleClaim = useCallback(async (claimType: 'victory' | 'draw' | 'wait') => {
    if (!gameId || claiming) return;

    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke('claim-abandonment', {
        body: { gameId, claimType },
      });

      if (error) {
        console.error('Failed to claim:', error);
      } else if (data?.success) {
        if (claimType === 'wait') {
          // Reset timer for wait
          setTimeoutSeconds(60);
          setClaimAvailable(false);
        }
      }
    } finally {
      setClaiming(false);
    }
  }, [gameId, claiming]);

  // Don't show anything if no disconnect
  if (opponentStatus === 'online' || !game) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const getDisconnectInfo = () => {
    if (game.last_connection_type === 'rage_quit') {
      return {
        icon: <RageQuitIcon />,
        label: 'Opponent left the game',
        color: 'error' as const,
        timeout: 10,
      };
    } else {
      return {
        icon: <DisconnectIcon />,
        label: 'Opponent disconnected',
        color: 'warning' as const,
        timeout: game.disconnect_allowance_seconds - game.total_disconnect_seconds,
      };
    }
  };

  const info = getDisconnectInfo();

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 4,
        p: 3,
        minWidth: 320,
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {info.icon}
        <Typography variant="h6">{info.label}</Typography>
      </Box>

      {/* Timer or claim status */}
      {!claimAvailable && timeoutSeconds > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TimerIcon fontSize="small" />
            <Typography variant="body2">
              You can claim in {formatTime(timeoutSeconds)}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(info.timeout - timeoutSeconds) / info.timeout * 100}
            sx={{ mb: 2 }}
          />
        </>
      )}

      {/* Claim buttons */}
      {claimAvailable && (
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Your opponent has been disconnected. What would you like to do?
          </Typography>
          
          <Button
            variant="contained"
            color="success"
            startIcon={<ClaimIcon />}
            onClick={() => handleClaim('victory')}
            disabled={claiming}
            fullWidth
          >
            Claim Victory
          </Button>

          <Button
            variant="outlined"
            color="info"
            startIcon={<DrawIcon />}
            onClick={() => handleClaim('draw')}
            disabled={claiming}
            fullWidth
          >
            Claim Draw
          </Button>

          <Button
            variant="text"
            startIcon={<WaitIcon />}
            onClick={() => handleClaim('wait')}
            disabled={claiming}
            fullWidth
          >
            Give More Time
          </Button>
        </Box>
      )}

      {/* Disconnection stats */}
      {game.total_disconnect_seconds > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Total disconnection time: {formatTime(game.total_disconnect_seconds)}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Remaining allowance: {formatTime(game.disconnect_allowance_seconds - game.total_disconnect_seconds)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}