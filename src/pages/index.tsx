import Head from "next/head";
import LichessBoard from "@/components/lichess-board";
import QueueSystem from "@/components/QueueSystem";
import AuthForm from "@/components/auth-form";
import ServerStats from "@/components/server-stats";
import {
  Box,
  Container,
  Typography,
  Fade,
  Paper,
} from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

export default function Home() {
  const { game } = useGame();
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If there's an active game, show the board
  if (game) {
    return (
      <>
        <Head>
          <title>Ban Chess - Game in Progress</title>
          <meta
            name="description"
            content="Play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn"
          />
          <link rel="icon" href="/logo.png" />
        </Head>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              py: 4,
            }}
          >
            <LichessBoard />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Ban Chess - A Unique Chess Variant</title>
        <meta
          name="description"
          content="Play Ban Chess - the unique chess variant where you can ban one of your opponent's moves each turn"
        />
        <link rel="icon" href="/logo.png" />
      </Head>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minHeight: "calc(100vh - 200px)",
            py: 4,
          }}
        >
          {/* Title and Description */}
          <Fade in={mounted} timeout={600}>
            <Box
              sx={{
                textAlign: "center",
                mb: 6,
                mt: 2,
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 2,
                  fontSize: { xs: "2.5rem", md: "3.5rem" },
                }}
              >
                Ban Chess
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: "text.secondary",
                  maxWidth: 600,
                  mx: "auto",
                  fontWeight: 400,
                }}
              >
                A strategic chess variant where you ban your opponent's moves
                before the game begins
              </Typography>
            </Box>
          </Fade>

          {/* Main Content Area */}
          <Box
            sx={{
              display: "flex",
              gap: 4,
              width: "100%",
              maxWidth: 1200,
              flexDirection: { xs: "column", lg: "row" },
              alignItems: { xs: "center", lg: "flex-start" },
              justifyContent: "center",
              flex: 1,
            }}
          >
            {/* Left Side - Server Stats */}
            <Fade in={mounted} timeout={800}>
              <Box
                sx={{
                  width: { xs: "100%", sm: 350, lg: 280 },
                  display: { xs: "none", md: "block" },
                }}
              >
                <ServerStats />
              </Box>
            </Fade>

            {/* Center - Auth or Queue System */}
            <Fade in={mounted} timeout={1000}>
              <Box
                sx={{
                  flex: 1,
                  maxWidth: 500,
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isLoading ? (
                  <Paper
                    elevation={8}
                    sx={{
                      p: 6,
                      width: "100%",
                      background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 3,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography variant="body1" color="text.secondary">
                      Loading...
                    </Typography>
                  </Paper>
                ) : user ? (
                  <QueueSystem />
                ) : (
                  <Box sx={{ width: "100%" }}>
                    <Paper
                      elevation={8}
                      sx={{
                        p: 4,
                        background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                        backdropFilter: "blur(10px)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 3,
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          textAlign: "center",
                          mb: 3,
                          fontWeight: 600,
                        }}
                      >
                        Sign in to Play
                      </Typography>
                      <AuthForm redirectOnSuccess={false} />
                    </Paper>
                  </Box>
                )}
              </Box>
            </Fade>

            {/* Right Side - Placeholder for future features */}
            <Box
              sx={{
                width: { xs: "100%", sm: 350, lg: 280 },
                display: { xs: "none", lg: "block" },
              }}
            >
              {/* Space for future features like leaderboard, recent games, etc. */}
            </Box>
          </Box>

          {/* Mobile Server Stats */}
          <Fade in={mounted} timeout={1200}>
            <Box
              sx={{
                width: "100%",
                maxWidth: 400,
                display: { xs: "block", md: "none" },
                mt: 4,
              }}
            >
              <ServerStats />
            </Box>
          </Fade>
        </Box>
      </Container>
    </>
  );
}