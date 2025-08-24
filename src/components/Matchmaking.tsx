import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { GameService } from '@/services/gameService';
import { supabase } from '@/utils/supabase';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  CircularProgress,
  Fade,
  Divider,
  Alert,
  AlertTitle,
  Stack
} from '@mui/material';
import { SportsEsports, Cancel, Computer, OpenInNew, Flag } from '@mui/icons-material';

export default function Matchmaking() {
  const [searching, setSearching] = useState(false);
  const [timeInQueue, setTimeInQueue] = useState(0);
  const [error, setError] = useState<{ message: string; gameId?: string } | null>(null);
  const [isResigning, setIsResigning] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!user) return;
    
    // Check if already in queue
    GameService.checkMatchmakingStatus().then(status => {
      if (status) {
        setSearching(true);
      }
    });
  }, [user]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (searching) {
      interval = setInterval(() => {
        setTimeInQueue(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [searching]);
  
  useEffect(() => {
    if (!searching || !user) return;
    
    // Subscribe to games table for new games where we're a player
    // We need two separate subscriptions since Supabase doesn't support OR in filters
    const channelWhite = supabase
      .channel(`game-matches-white-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: `white_player_id=eq.${user.id}`,
        },
        (payload) => {
          // New game created where we're white
          if (payload.new && payload.new.id) {
            console.log('Game matched as white! Redirecting to:', payload.new.id);
            router.push(`/game/${payload.new.id}`);
          }
        }
      )
      .subscribe();
      
    const channelBlack = supabase
      .channel(`game-matches-black-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: `black_player_id=eq.${user.id}`,
        },
        (payload) => {
          // New game created where we're black
          if (payload.new && payload.new.id) {
            console.log('Game matched as black! Redirecting to:', payload.new.id);
            router.push(`/game/${payload.new.id}`);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channelWhite);
      supabase.removeChannel(channelBlack);
    };
  }, [searching, user, router]);
  
  const handleFindGame = async () => {
    if (!user) {
      alert('Please sign in to play');
      return;
    }
    
    setError(null);
    setSearching(true);
    setTimeInQueue(0);
    
    try {
      // Join matchmaking queue - server will handle the matching
      await GameService.joinMatchmakingQueue();
      
      // The server will match players and send a realtime notification
      // via the player:${user.id} channel with event 'game_matched'
      // The useEffect above is already listening for this notification
      
    } catch (error: any) {
      console.error('Failed to join queue:', error);
      setSearching(false);
      
      // Check if the error is about having an active game
      if (error?.message?.includes('already has an active game')) {
        // Extract game ID from error details if available
        const gameId = error?.details?.gameId || error?.data?.gameId;
        setError({ 
          message: 'You already have an active game', 
          gameId 
        });
      } else {
        setError({ message: error?.message || 'Failed to join queue' });
      }
    }
  };
  
  const handleCancel = async () => {
    setSearching(false);
    setTimeInQueue(0);
    setError(null);
    
    try {
      // Use GameService to leave queue
      await GameService.leaveMatchmakingQueue();
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };
  
  const handleResignActiveGame = async () => {
    if (!error?.gameId) return;
    
    setIsResigning(true);
    try {
      await GameService.resignGame(error.gameId);
      setError(null);
      // Try to join queue again after resigning
      handleFindGame();
    } catch (err) {
      console.error('Failed to resign game:', err);
      alert('Failed to resign the game. Please try again.');
    } finally {
      setIsResigning(false);
    }
  };
  
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!user) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 5,
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          Sign in to Play
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create an account or sign in to start playing Ban Chess
        </Typography>
      </Paper>
    );
  }
  
  if (searching) {
    return (
      <Fade in={searching}>
        <Paper
          elevation={3}
          sx={{
            p: 5,
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Finding Opponent...
          </Typography>
          
          <Box sx={{ my: 3 }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
          
          <Typography variant="body1" sx={{ mb: 3 }}>
            Time in queue: {formatTime(timeInQueue)}
          </Typography>
          
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            startIcon={<Cancel />}
            size="large"
            sx={{ px: 4 }}
          >
            Cancel
          </Button>
        </Paper>
      </Fade>
    );
  }
  
  return (
    <Paper
      elevation={3}
      sx={{
        p: 5,
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
      }}
    >
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Play Ban Chess
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        In Ban Chess, before each move, you ban one of your opponent&apos;s legal moves!
      </Typography>
      
      {error && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3, textAlign: 'left' }}
        >
          <AlertTitle>{error.message}</AlertTitle>
          {error.gameId && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography variant="body2">
                You have an active game in progress.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => router.push(`/game/${error.gameId}`)}
                  startIcon={<OpenInNew />}
                >
                  Go to Game
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={handleResignActiveGame}
                  startIcon={<Flag />}
                  disabled={isResigning}
                >
                  {isResigning ? 'Resigning...' : 'Resign Game'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Alert>
      )}
      
      <Button
        variant="contained"
        onClick={handleFindGame}
        startIcon={<SportsEsports />}
        size="large"
        sx={{
          px: 5,
          py: 2,
          fontSize: '1.1rem',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #5a67d8 0%, #6b3690 100%)',
          },
        }}
      >
        Find Game
      </Button>
      
      <Typography variant="caption" display="block" sx={{ mt: 3, color: 'text.secondary' }}>
        10+0 • Rated
      </Typography>
      
      <Divider sx={{ my: 3 }} />
      
      <Button
        variant="outlined"
        onClick={() => router.push('/local')}
        startIcon={<Computer />}
        size="medium"
        sx={{ mt: 1 }}
      >
        Play Offline
      </Button>
    </Paper>
  );
}