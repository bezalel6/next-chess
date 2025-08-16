import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, LinearProgress } from '@mui/material';
import { 
  Timer as TimerIcon,
  CheckCircle as ClaimIcon,
  Handshake as DrawIcon,
  HourglassEmpty as WaitIcon,
  WifiOff as DisconnectIcon,
  ExitToApp as RageQuitIcon,
} from '@mui/icons-material';
import { supabase } from '@/utils/supabase';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';

interface DisconnectHandlerProps {
  gameId: string;
}

interface DisconnectInfo {
  icon: React.ReactElement;
  label: string;
  color: 'error' | 'warning';
  timeout: number;
}

export default function DisconnectHandler({ gameId }: DisconnectHandlerProps) {
  const { user } = useAuth();
  const game = useUnifiedGameStore(state => state.game);
  const [claimAvailable, setClaimAvailable] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [showHandler, setShowHandler] = useState(false);

  // Determine if opponent is disconnected and it's their turn
  const isOpponentDisconnected = useMemo(() => {
    if (!game || !user) return false;
    
    const isOpponentTurn = 
      (game.turn === 'white' && game.whitePlayerId !== user.id) ||
      (game.turn === 'black' && game.blackPlayerId !== user.id);
    
    // Check if there's an active disconnect
    // If server provides enhanced disconnect fields, you can extend Game type and mapper
    // For now, hide handler unless claim times are present in game (feature gated)
    return isOpponentTurn && (game as any).disconnectStartedAt != null;
  }, [game, user]);

  // Monitor claim availability
  useEffect(() => {
    if (!isOpponentDisconnected || !game) {
      setShowHandler(false);
      setClaimAvailable(false);
      setTimeoutSeconds(0);
      return;
    }

    setShowHandler(true);
    
    const checkClaimStatus = () => {
      const anyGame = game as any;
      if (anyGame.claimAvailableAt) {
        const claimTime = new Date(anyGame.claimAvailableAt);
        const now = new Date();
        
        if (now >= claimTime) {
          setClaimAvailable(true);
          setTimeoutSeconds(0);
        } else {
          setClaimAvailable(false);
          const secondsRemaining = Math.ceil((claimTime.getTime() - now.getTime()) / 1000);
          setTimeoutSeconds(Math.max(0, secondsRemaining));
        }
      } else {
        // Calculate timeout from disconnect start
        const disconnectType = (anyGame.lastConnectionType as string) || 'disconnect';
        const baseTimeout = disconnectType === 'rage_quit' ? 10 : 120;
        
        if (anyGame.disconnectStartedAt) {
          const disconnectTime = new Date(anyGame.disconnectStartedAt);
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - disconnectTime.getTime()) / 1000);
          const remaining = Math.max(0, baseTimeout - elapsed);
          
          setTimeoutSeconds(remaining);
          setClaimAvailable(remaining === 0);
        }
      }
    };

    checkClaimStatus();
    const interval = setInterval(checkClaimStatus, 1000);

    return () => clearInterval(interval);
  }, [isOpponentDisconnected, game]);

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

  // Helper functions
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  }, []);

  const disconnectInfo = useMemo((): DisconnectInfo | null => {
    if (!game) return null;
    const anyGame = game as any;
    const disconnectType = (anyGame.lastConnectionType as string) || 'disconnect';
    return {
      icon: disconnectType === 'rage_quit' ? <RageQuitIcon /> : <DisconnectIcon />,
      label: disconnectType === 'rage_quit' ? 'Opponent left the game' : 'Opponent disconnected',
      color: disconnectType === 'rage_quit' ? 'error' : 'warning',
      timeout: disconnectType === 'rage_quit' ? 10 : 
        ((anyGame.disconnectAllowanceSeconds as number) || 120) - ((anyGame.totalDisconnectSeconds as number) || 0),
    };
  }, [game]);

  // Don't render if not needed
  if (!showHandler || !disconnectInfo) {
    return null;
  }

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
        {disconnectInfo.icon}
        <Typography variant="h6">{disconnectInfo.label}</Typography>
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
            value={disconnectInfo.timeout > 0 ? 
              ((disconnectInfo.timeout - timeoutSeconds) / disconnectInfo.timeout * 100) : 0}
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
      {(game as any) && (((game as any).totalDisconnectSeconds || 0) > 0) && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Total disconnection time: {formatTime((game as any).totalDisconnectSeconds || 0)}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Remaining allowance: {formatTime(
              (((game as any).disconnectAllowanceSeconds || 120) - ((game as any).totalDisconnectSeconds || 0))
            )}
          </Typography>
        </Box>
      )}
    </Box>
  );
}