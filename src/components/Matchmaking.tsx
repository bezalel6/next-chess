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
  Fade 
} from '@mui/material';
import { SportsEsports, Cancel } from '@mui/icons-material';

export default function Matchmaking() {
  const [inQueue, setInQueue] = useState(false);
  const [searching, setSearching] = useState(false);
  const [timeInQueue, setTimeInQueue] = useState(0);
  const { user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!user) return;
    
    // Check if already in queue
    GameService.checkMatchmakingStatus().then(status => {
      if (status) {
        setInQueue(true);
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
    
    // Subscribe to player channel for game match notifications
    const channel = supabase
      .channel(`player:${user.id}`)
      .on('broadcast', { event: 'game_matched' }, (payload) => {
        // Game matched via matchmaking
        if (payload.payload?.gameId) {
          router.push(`/game/${payload.payload.gameId}`);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [searching, user, router]);
  
  const handleFindGame = async () => {
    if (!user) {
      alert('Please sign in to play');
      return;
    }
    
    setSearching(true);
    setInQueue(true);
    setTimeInQueue(0);
    
    try {
      // Call matchmaking edge function to join queue
      const response = await supabase.functions.invoke('matchmaking', {
        body: { operation: 'joinQueue' }
      });
      
      if (response.data?.matchFound) {
        // Immediate match found
        router.push(`/game/${response.data.game.id}`);
      }
    } catch (error) {
      console.error('Failed to join queue:', error);
      setSearching(false);
      setInQueue(false);
    }
  };
  
  const handleCancel = async () => {
    setSearching(false);
    setInQueue(false);
    setTimeInQueue(0);
    
    try {
      // Call matchmaking edge function to leave queue
      await supabase.functions.invoke('matchmaking', {
        body: { operation: 'leaveQueue' }
      });
    } catch (error) {
      console.error('Failed to leave queue:', error);
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
        In Ban Chess, before each move, you ban one of your opponent's legal moves!
      </Typography>
      
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
    </Paper>
  );
}