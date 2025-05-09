import Head from "next/head";
import styles from "./index.module.css";
import LichessBoard from "@/components/lichess-board";
import FindMatch from "@/components/find-match";
import Login from "@/components/login";
import ServerStats from "@/components/server-stats";
import { Box, Container, Grid, Paper, Typography } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useConnection } from "@/contexts/ConnectionContext";

export default function Home() {
  const { game } = useGame();
  const { queue } = useConnection();

  return (
    <>
      <Head>
        <title>Chess 2.0</title>
        <meta name="description" content="Play chess online" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <Container maxWidth="lg">
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 4,
            py: 4
          }}>
            <h1 className={styles.title}>
              Chess<span className={styles.pinkSpan}>2.0</span>
            </h1>

            <Grid container spacing={4} justifyContent="center">
              {/* Left column - Game board */}
              <Grid item xs={12} md={8}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 3,
                  alignItems: 'center'
                }}>
                  <div className={styles.chessContainer}>
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
                          justifyContent: 'center',
                          alignItems: 'center',
                          p: 4
                        }}
                      >
                        <Typography variant="h5" gutterBottom>
                          Welcome to Chess 2.0
                        </Typography>
                        <Typography variant="body1" align="center" sx={{ mb: 2 }}>
                          Click &quot;Play&quot; below to find an opponent and start a new game.
                        </Typography>
                        {queue.inQueue && (
                          <Typography variant="body2" color="text.secondary">
                            Finding opponent... {queue.position > 0 && `(${queue.position}/${queue.size})`}
                          </Typography>
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
      </main>
    </>
  );
}

