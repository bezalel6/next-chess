import { Box, Container, Typography, Button, Paper } from "@mui/material";
import { useRouter } from "next/router";
import { useGameInit } from "@/hooks/useGameInit";
import GameBoardV2 from "@/components/GameBoardV2";
import LocalMoveHistory from "@/components/LocalMoveHistory";
import HomeIcon from '@mui/icons-material/Home';
import InfoIcon from '@mui/icons-material/Info';

export default function LocalGamePage() {
  const router = useRouter();
  
  // Initialize local game
  useGameInit();

  const handleReturnHome = () => {
    router.push("/");
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5" sx={{ color: '#bababa', fontWeight: 600 }}>
                Ban Chess - Local Game
              </Typography>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={handleReturnHome}
                sx={{ 
                  color: '#bababa',
                  borderColor: 'rgba(255,255,255,0.2)',
                  '&:hover': { 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                }}
              >
                Return Home
              </Button>
            </Box>
          </Container>
        </Box>

        {/* Main content area */}
        <Box sx={{
          display: 'flex',
          flex: 1,
          p: 2,
        }}>
          <Container maxWidth="lg">
            <Box sx={{
              display: 'flex',
              gap: 3,
              justifyContent: 'center',
              flexWrap: { xs: 'wrap', lg: 'nowrap' },
            }}>
              {/* Left sidebar - Game Rules */}
              <Box sx={{ 
                width: { xs: '100%', lg: 280 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                <Paper sx={{ 
                  p: 2, 
                  bgcolor: '#2e2a24',
                  border: 'none',
                  color: '#bababa',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <InfoIcon fontSize="small" />
                    <Typography variant="h6">
                      How to Play
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1.5 }}>
                    <strong>Ban Chess Rules:</strong>
                  </Typography>
                  <Typography variant="body2" component="ol" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
                    <li>Black bans one of White's possible first moves</li>
                    <li>White makes their first move (avoiding the ban)</li>
                    <li>White then bans one of Black's possible moves</li>
                    <li>Black makes their move (avoiding the ban)</li>
                    <li>Continue alternating: move, then ban opponent's next move</li>
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1.5, opacity: 0.8 }}>
                    The banned move is highlighted in red. Click on pieces to select moves to ban or make.
                  </Typography>
                </Paper>

                <Paper sx={{ 
                  p: 2, 
                  bgcolor: '#2e2a24',
                  border: 'none',
                  color: '#bababa',
                }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    <strong>Tips:</strong>
                  </Typography>
                  <Typography variant="body2" component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
                    <li>Ban critical defensive moves to create threats</li>
                    <li>Ban escape squares when checking</li>
                    <li>Consider banning castle moves at key moments</li>
                  </Typography>
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
                width: { xs: '100%', lg: 280 },
                display: 'flex',
                flexDirection: 'column',
              }}>
                <LocalMoveHistory />
              </Box>
            </Box>
          </Container>
        </Box>
      </Box>
  );
}