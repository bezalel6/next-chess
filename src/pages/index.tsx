import Head from "next/head";
import QueueSystem from "@/components/QueueSystem";
import AuthForm from "@/components/auth-form";
import MinimalNewsFeed from "@/components/MinimalNewsFeed";
import DraggableNewsFeed from "@/components/DraggableNewsFeed";
import { Box, Container, Typography, Fade, Paper } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // Enable draggable news feed with ?news=drag query param
  const isDraggable = router.query.news === 'drag';

  useEffect(() => {
    setMounted(true);
  }, []);

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
                A strategic chess variant where you ban your opponent&apos;s moves
                before the game begins
              </Typography>
            </Box>
          </Fade>

          {/* Main Content Area - Using Grid for better control */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { 
                xs: "1fr", // Single column on mobile
                md: "280px 500px 280px" // 3 columns on desktop for all users
              },
              gap: 3,
              width: "100%",
              maxWidth: 1060,
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            {/* News Feed - Left column on desktop, below on mobile */}
            {!isDraggable ? (
              <Fade in={mounted} timeout={800}>
                <Box 
                  sx={{ 
                    gridColumn: { xs: 1, md: 1 },
                    gridRow: { xs: 2, md: 1 }, // Second row on mobile, first row on desktop
                    width: "100%",
                    maxWidth: { xs: 500, md: "none" },
                    margin: { xs: "0 auto", md: 0 },
                  }}
                >
                  <MinimalNewsFeed />
                </Box>
              </Fade>
            ) : (
              // Empty spacer when using draggable news feed
              <Box sx={{ display: { xs: "none", md: "block" } }} />
            )}

            {/* Center - Auth or Queue System (always centered) */}
            <Fade in={mounted} timeout={1000}>
              <Box
                sx={{
                  gridColumn: { xs: 1, md: 2 },
                  gridRow: { xs: 1, md: 1 }, // First row on mobile, first row on desktop
                  width: "100%",
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

            {/* Right column - Empty spacer for balance on desktop */}
            <Box sx={{ display: { xs: "none", md: "block" } }} />
          </Box>
        </Box>
      </Container>

      {/* Draggable News Feed - Rendered outside the main layout */}
      {user && isDraggable && mounted && <DraggableNewsFeed />}
    </>
  );
}
