import Head from "next/head";
import LichessBoard from "@/components/lichess-board";
import FindMatch from "@/components/find-match";
import Login from "@/components/login";
import ServerStats from "@/components/server-stats";
import ActiveGames from "@/components/active-games";
import { Box, Container, Grid, Paper, Typography, Divider } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

export default function Home() {
  const { game } = useGame();
  const { queue } = useConnection();
  const { user } = useAuth();
  const [hasActiveGames, setHasActiveGames] = useState(false);

  // Check if user has active games to adjust UI
  useEffect(() => {
    async function checkForActiveGames() {
      if (!user) {
        setHasActiveGames(false);
        return;
      }

      // try {
      //   const games = await GameService.getUserActiveGames(user.id);
      //   setHasActiveGames(games.length > 0);
      // } catch (error) {
      //   console.error('Error checking for active games:', error);
      // }
    }

    checkForActiveGames();
  }, [user]);

  return (
    <>
      <Head>
        <title>Ban Chess - A Unique Chess Variant</title>
        <meta name="description" content="Play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn" />
        <link rel="icon" href="/logo.png" />
      </Head>
      <Container maxWidth="lg">
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          py: 4
        }}>
          {/* Content area */}
          <Typography variant="h6" sx={{ color: 'grey.500', mb: 2, textAlign: 'center' }}>
            A unique chess variant where you can ban one of your opponent&apos;s moves each turn
          </Typography>

          <Grid container spacing={4} justifyContent="center">
            {/* Left column - Game board */}
            <Grid item xs={12} md={8}>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                alignItems: 'center'
              }}>
                <div className={`chess-container ${hasActiveGames && !game ? 'expanded-container' : ''}`}>
                  {game ? (
                    <LichessBoard />
                  ) : (
                    <Paper
                      elevation={2}
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        p: 4
                      }}
                    >
                      {hasActiveGames ? (
                        /* When there are active games, show only those */
                        <ActiveGames fullHeight />
                      ) : (
                        /* When no active games, show welcome message */
                        <>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 1
                          }}>
                            <Typography variant="h5" gutterBottom>
                              Welcome to Ban Chess
                            </Typography>
                            <Typography variant="body1" align="center" sx={{ mb: 2 }}>
                              Click &quot;Play&quot; below to find an opponent and start a new game.
                            </Typography>
                            {queue.inQueue && (
                              <Typography variant="body2" color="text.secondary">
                                Finding opponent... {queue.position > 0 && `(${queue.position}/${queue.size})`}
                              </Typography>
                            )}
                          </Box>
                        </>
                      )}
                    </Paper>
                  )}
                </div>
                <FindMatch />
              </Box>
            </Grid>

            {/* Right column - Stats and Login */}
            <Grid item xs={12} md={4}>
              <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                alignItems: 'center'
              }}>
                <ServerStats />
                <Login />
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </>
  );
}