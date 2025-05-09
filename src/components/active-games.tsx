import { useState, useEffect } from 'react';
import { Box, Button, Typography, CircularProgress, Alert, Divider } from '@mui/material';
import { SportsEsports } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { GameService } from '@/services/gameService';
import { UserService } from '@/services/userService';
import type { Game } from '@/types/game';
import { useRouter } from 'next/router';

interface ActiveGamesProps {
  fullHeight?: boolean;
}

interface GameWithOpponent extends Game {
  opponentName: string;
}

function ActiveGames({ fullHeight = false }: ActiveGamesProps) {
  const [activeGames, setActiveGames] = useState<GameWithOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchActiveGames() {
      if (!user) {
        setActiveGames([]);
        setLoading(false);
        return;
      }

      try {
        const games = await GameService.getUserActiveGames(user.id);
        
        // Extract all opponent IDs
        const opponentIds = games.map(game => 
          game.whitePlayer === user.id ? game.blackPlayer : game.whitePlayer
        );
        
        // Fetch usernames for all opponents at once
        const usernames = await UserService.getUsernamesByIds(opponentIds);
        
        // Add opponent names to game objects
        const gamesWithOpponents = games.map(game => {
          const opponentId = game.whitePlayer === user.id ? game.blackPlayer : game.whitePlayer;
          return {
            ...game,
            opponentName: usernames[opponentId] || "Unknown Player"
          };
        });
        
        setActiveGames(gamesWithOpponents);
      } catch (error) {
        console.error('Error fetching active games:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActiveGames();
  }, [user]);

  const handleJoinGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  if (!user || (!loading && activeGames.length === 0)) {
    return null;
  }

  return (
    <Box sx={{ 
      width: '100%', 
      height: fullHeight ? '100%' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: fullHeight ? 'center' : 'flex-start',
      mt: fullHeight ? 0 : 2 
    }}>
      {!fullHeight && <Divider sx={{ mb: 2 }} />}
      
      <Typography variant="h6" gutterBottom color="warning.dark" align="center" sx={{ mt: fullHeight ? 0 : 2 }}>
        Unfinished Games ({activeGames.length})
      </Typography>
      
      <Alert severity="warning" sx={{ mb: 3 }}>
        You must finish these games before starting a new one
      </Alert>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          flex: fullHeight ? 1 : 'auto',
          maxHeight: fullHeight ? '100%' : '200px',
          overflowY: activeGames.length > (fullHeight ? 3 : 2) ? 'auto' : 'visible',
          pr: activeGames.length > (fullHeight ? 3 : 2) ? 1 : 0,
          pb: 2
        }}>
          {activeGames.map(game => {
            const isWhite = game.whitePlayer === user?.id;
            const colorPlaying = isWhite ? 'white' : 'black';
            const opponentTurn = game.turn !== colorPlaying;
            
            return (
              <Box 
                key={game.id} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: fullHeight ? 2 : 1.5,
                  borderRadius: 1,
                  bgcolor: opponentTurn ? 'background.default' : 'action.hover',
                  border: '1px solid',
                  borderColor: opponentTurn ? 'divider' : 'primary.light'
                }}
              >
                <Box>
                  <Typography variant={fullHeight ? "body1" : "body2"} fontWeight={500}>
                    vs. {game.opponentName}
                  </Typography>
                  <Typography 
                    variant={fullHeight ? "body2" : "caption"} 
                    color={opponentTurn ? "text.secondary" : "primary"}
                    sx={{ mt: fullHeight ? 0.5 : 0 }}
                  >
                    {opponentTurn ? `${game.opponentName}'s turn` : "Your turn"} • {colorPlaying}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color={opponentTurn ? "primary" : "success"}
                  size={fullHeight ? "medium" : "small"}
                  startIcon={<SportsEsports />}
                  onClick={() => handleJoinGame(game.id)}
                >
                  Resume
                </Button>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default ActiveGames; 