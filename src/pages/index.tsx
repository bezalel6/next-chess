import Head from "next/head";
import styles from "./index.module.css";
import LichessBoard from "@/components/lichess-board";
import FindMatch from "@/components/find-match";
import Login from "@/components/login";
import ServerStats from "@/components/server-stats";
import { Box, Container, Grid } from "@mui/material";

export default function Home() {
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
                    <LichessBoard />
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

