import { Box, Container, Typography, Button, Paper } from "@mui/material";
import { useRouter } from "next/router";
import { useEffect } from "react";
import GameBoardV2 from "@/components/GameBoardV2";
import MoveHistory from "@/components/MoveHistory";
import { useGame } from "@/contexts/GameContextV2";
import { useAuth } from "@/contexts/AuthContext";

export default function LocalGamePage() {
  const router = useRouter();
  const { game, isLocalGame, actions } = useGame();
  const { user } = useAuth();

  useEffect(() => {
    // If we're not in local game mode and there's no game, redirect to home
    if (!isLocalGame && !game) {
      router.push("/");
    }
  }, [isLocalGame, game, router]);

  const handleEndLocalGame = () => {
    actions.resetGame();
    router.push("/");
  };

  if (!isLocalGame || !game) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h5" gutterBottom>
            Loading local game mode...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ 
      height: '100%',
      bgcolor: '#161512',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Main content area */}
      <Box sx={{
        display: 'flex',
        flex: 1,
        p: 2,
        gap: 2,
        maxWidth: 1400,
        mx: 'auto',
        width: '100%',
      }}>
        {/* Left sidebar - game info/chat */}
        <Box sx={{ 
          width: 240,
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          gap: 2,
        }}>
          <Paper sx={{ 
            p: 2, 
            bgcolor: '#2e2a24',
            border: 'none',
          }}>
            <Typography variant="h6" sx={{ color: '#bababa', mb: 1 }}>
              Local Game
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleEndLocalGame}
              sx={{ 
                color: '#bababa',
                borderColor: 'rgba(255,255,255,0.2)',
                '&:hover': { 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255,255,255,0.3)',
                },
              }}
            >
              Exit Game
            </Button>
          </Paper>
        </Box>
        
        {/* Center - Game board */}
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}>
          <GameBoardV2 />
        </Box>
        
        {/* Right sidebar - Move history */}
        <Box sx={{ 
          width: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}>
          <MoveHistory />
        </Box>
      </Box>
    </Box>
  );
}
