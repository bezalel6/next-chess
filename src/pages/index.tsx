import Head from "next/head";
import LichessBoardV2 from "@/components/LichessBoardV2";
import QueueSystem from "@/components/QueueSystem";
import AuthForm from "@/components/auth-form";
import BoardMoveInput from "@/components/BoardMoveInput";
import { Box, Container, Typography, Fade, Paper } from "@mui/material";
import { useGame } from "@/contexts/GameProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

export default function Home() {
  const { game } = useGame();
  const { user, loading } = useAuth();
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
            <Box sx={{ position: "relative" }}>
              <LichessBoardV2 orientation="white" />
            </Box>
            <BoardMoveInput />
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
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
              maxWidth: 600,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
            }}
          >
            {/* Center - Auth or Queue System */}
            <Fade in={mounted} timeout={1000}>
              <Box
                sx={{
                  width: "100%",
                  maxWidth: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {loading ? (
                  <Paper
                    elevation={8}
                    sx={{
                      p: 6,
                      width: "100%",
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
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
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
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
          </Box>
        </Box>
      </Container>
    </>
  );
}
