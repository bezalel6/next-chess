import { Box, Container, Typography, Button, Paper, Grid } from "@mui/material";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useState } from "react";

// Define all chess sounds matching the CHESS_SOUNDS constant
const CHESS_SOUNDS = {
  move: '/sounds/self-move.wav',
  capture: '/sounds/capture.wav',
  check: '/sounds/check.wav',
  castle: '/sounds/castle.wav',
  promote: '/sounds/promote.wav',
  gameStart: '/sounds/game-start.wav',
  gameEnd: '/sounds/game-end.wav',
  ban: '/sounds/ban.mp3',
  opponentMove: '/sounds/opponent-move.wav',
  tenSeconds: '/sounds/ten-seconds.wav',
} as const;

// Sound descriptions for better UX
const SOUND_DESCRIPTIONS: Record<keyof typeof CHESS_SOUNDS, string> = {
  move: 'Regular Move',
  capture: 'Capture Piece',
  check: 'Check',
  castle: 'Castling',
  promote: 'Pawn Promotion',
  gameStart: 'Game Start',
  gameEnd: 'Game End',
  ban: 'Ban Move',
  opponentMove: 'Opponent Move',
  tenSeconds: 'Ten Seconds Warning',
};

export default function SoundTestPage() {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);

  const playSound = (soundKey: keyof typeof CHESS_SOUNDS) => {
    const audio = new Audio(CHESS_SOUNDS[soundKey]);
    
    setCurrentlyPlaying(soundKey);
    setLastPlayed(soundKey);
    
    audio.play().catch((error) => {
      console.error(`Failed to play ${soundKey}:`, error);
    });
    
    audio.addEventListener('ended', () => {
      setCurrentlyPlaying(null);
    });
  };

  const playAllSounds = async () => {
    const soundKeys = Object.keys(CHESS_SOUNDS) as Array<keyof typeof CHESS_SOUNDS>;
    
    for (const soundKey of soundKeys) {
      await new Promise<void>((resolve) => {
        const audio = new Audio(CHESS_SOUNDS[soundKey]);
        
        setCurrentlyPlaying(soundKey);
        setLastPlayed(soundKey);
        
        audio.play().catch((error) => {
          console.error(`Failed to play ${soundKey}:`, error);
          resolve();
        });
        
        audio.addEventListener('ended', () => {
          setCurrentlyPlaying(null);
          setTimeout(resolve, 500); // Small delay between sounds
        });
      });
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: '#161512',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        bgcolor: '#1e1a17',
      }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ color: '#bababa', fontWeight: 600 }}>
            Chess Sound Test
          </Typography>
          <Typography variant="body2" sx={{ color: '#888', mt: 1 }}>
            Click any button to play the corresponding chess sound effect
          </Typography>
        </Container>
      </Box>

      {/* Main content */}
      <Container maxWidth="lg" sx={{ py: 4, flex: 1 }}>
        <Paper sx={{ 
          p: 3, 
          bgcolor: '#2e2a24',
          border: 'none',
        }}>
          {/* Status display */}
          <Box sx={{ mb: 4, p: 2, bgcolor: '#1e1a17', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ color: '#888' }}>
              Currently Playing: {' '}
              <span style={{ color: currentlyPlaying ? '#4caf50' : '#bababa', fontWeight: 600 }}>
                {currentlyPlaying ? SOUND_DESCRIPTIONS[currentlyPlaying as keyof typeof CHESS_SOUNDS] : 'None'}
              </span>
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', mt: 1 }}>
              Last Played: {' '}
              <span style={{ color: '#bababa' }}>
                {lastPlayed ? SOUND_DESCRIPTIONS[lastPlayed as keyof typeof CHESS_SOUNDS] : 'None'}
              </span>
            </Typography>
          </Box>

          {/* Play All button */}
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={playAllSounds}
              disabled={currentlyPlaying !== null}
              sx={{
                bgcolor: '#4caf50',
                color: 'white',
                '&:hover': { bgcolor: '#45a049' },
                '&:disabled': { bgcolor: '#333', color: '#666' },
              }}
            >
              Play All Sounds (Sequential)
            </Button>
          </Box>

          {/* Individual sound buttons */}
          <Grid container spacing={2}>
            {(Object.keys(CHESS_SOUNDS) as Array<keyof typeof CHESS_SOUNDS>).map((soundKey) => (
              <Grid item xs={12} sm={6} md={4} key={soundKey}>
                <Button
                  variant="outlined"
                  fullWidth
                  size="large"
                  startIcon={<VolumeUpIcon />}
                  onClick={() => playSound(soundKey)}
                  disabled={currentlyPlaying === soundKey}
                  sx={{
                    color: currentlyPlaying === soundKey ? '#4caf50' : '#bababa',
                    borderColor: currentlyPlaying === soundKey ? '#4caf50' : 'rgba(255,255,255,0.2)',
                    bgcolor: currentlyPlaying === soundKey ? 'rgba(76,175,80,0.1)' : 'transparent',
                    '&:hover': { 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                    '&:disabled': {
                      color: '#4caf50',
                      borderColor: '#4caf50',
                    },
                    py: 1.5,
                  }}
                >
                  <Box sx={{ textAlign: 'left', width: '100%' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {SOUND_DESCRIPTIONS[soundKey]}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {CHESS_SOUNDS[soundKey].split('/').pop()}
                    </Typography>
                  </Box>
                </Button>
              </Grid>
            ))}
          </Grid>

          {/* Additional info */}
          <Box sx={{ mt: 4, p: 2, bgcolor: '#1e1a17', borderRadius: 1 }}>
            <Typography variant="h6" sx={{ color: '#bababa', mb: 2 }}>
              Sound Usage in Game
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                  <strong>Move Sounds:</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: '#888', pl: 2 }}>
                  • Regular Move - Standard piece movement<br/>
                  • Capture - When taking an opponent's piece<br/>
                  • Castle - King and rook castling move<br/>
                  • Promote - Pawn reaching the back rank<br/>
                  • Check - When putting opponent in check
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>
                  <strong>Game Events:</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: '#888', pl: 2 }}>
                  • Game Start - Beginning of a new game<br/>
                  • Game End - Checkmate or game over<br/>
                  • Ban Move - Ban Chess variant move ban<br/>
                  • Opponent Move - Opponent makes a move<br/>
                  • Ten Seconds - Time warning alert
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}