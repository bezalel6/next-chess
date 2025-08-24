import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { Container, Typography, Paper, Box, Avatar, Divider, Chip, CircularProgress } from '@mui/material';
import { supabaseBrowser } from '@/utils/supabase-browser';
import { EmojiEvents, Timer, VideogameAsset } from '@mui/icons-material';

interface ProfilePageProps {
  username: string;
}

interface ProfileData {
  id: string;
  username: string;
  created_at: string;
  avatar_url?: string;
}

interface GameStats {
  total_games: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
}

export default function ProfilePage({ username }: ProfilePageProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabaseBrowser()
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            setError('User not found');
          } else {
            setError('Failed to load profile');
          }
          return;
        }

        setProfile(profileData);

        // Fetch game statistics
        const { data: games, error: gamesError } = await supabaseBrowser()
          .from('games')
          .select('status, white_player_id, black_player_id, winner')
          .or(`white_player_id.eq.${profileData.id},black_player_id.eq.${profileData.id}`)
          .in('status', ['completed', 'resigned', 'timeout', 'draw']);

        if (!gamesError && games) {
          const stats: GameStats = {
            total_games: games.length,
            games_won: 0,
            games_lost: 0,
            games_drawn: 0,
          };

          games.forEach((game) => {
            const isWhite = game.white_player_id === profileData.id;
            
            if (game.winner === 'draw' || game.status === 'draw') {
              stats.games_drawn++;
            } else if (game.winner === 'white') {
              if (isWhite) stats.games_won++;
              else stats.games_lost++;
            } else if (game.winner === 'black') {
              if (!isWhite) stats.games_won++;
              else stats.games_lost++;
            } else if (game.status === 'resigned') {
              // Check who resigned based on the last move or other logic
              stats.games_lost++; // Simplified - would need more logic
            } else if (game.status === 'timeout') {
              // Check who timed out
              stats.games_lost++; // Simplified - would need more logic
            }
          });

          setStats(stats);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('An error occurred while loading the profile');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      loadProfile();
    }
  }, [username]);

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container maxWidth="md">
        <Box py={8} textAlign="center">
          <Typography variant="h4" gutterBottom>
            {error || 'Profile not found'}
          </Typography>
          <Typography color="text.secondary">
            The user u/{username} could not be found.
          </Typography>
        </Box>
      </Container>
    );
  }

  const winRate = stats && stats.total_games > 0 
    ? ((stats.games_won / stats.total_games) * 100).toFixed(1)
    : '0';

  return (
    <Container maxWidth="md">
      <Box py={4}>
        <Paper elevation={3}>
          <Box p={4}>
              {/* Profile Header */}
              <Box display="flex" alignItems="center" gap={3} mb={4}>
                <Avatar
                  src={profile.avatar_url}
                  sx={{ width: 100, height: 100, bgcolor: 'primary.main' }}
                >
                  {profile.username[0].toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h4" gutterBottom>
                    u/{profile.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Member since {new Date(profile.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Statistics */}
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VideogameAsset /> Game Statistics
              </Typography>
              
              {stats ? (
                <Box display="flex" gap={2} flexWrap="wrap" mt={2}>
                  <Chip
                    icon={<Timer />}
                    label={`${stats.total_games} Games Played`}
                    variant="outlined"
                  />
                  <Chip
                    icon={<EmojiEvents />}
                    label={`${stats.games_won} Wins`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    label={`${stats.games_lost} Losses`}
                    color="error"
                    variant="outlined"
                  />
                  <Chip
                    label={`${stats.games_drawn} Draws`}
                    variant="outlined"
                  />
                  <Chip
                    label={`${winRate}% Win Rate`}
                    color="primary"
                  />
                </Box>
              ) : (
                <Typography color="text.secondary">
                  No games played yet
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>
      </Container>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const username = context.params?.username as string;
  
  if (!username) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      username,
    },
  };
};