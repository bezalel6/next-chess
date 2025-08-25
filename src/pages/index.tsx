import Head from "next/head";
import AuthForm, { type AuthFormHandle } from "@/components/auth-form";
import MinimalNewsFeed from "@/components/MinimalNewsFeed";
import DraggableNewsFeed from "@/components/DraggableNewsFeed";
import Matchmaking, { type MatchmakingHandle } from "@/components/Matchmaking";
import { Box, Container, Typography, Fade, Paper, Button, Snackbar, Alert } from "@mui/material";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<string | null>(null);
  const [isAutomating, setIsAutomating] = useState(false);
  const authFormRef = useRef<AuthFormHandle>(null);
  const matchmakingRef = useRef<MatchmakingHandle>(null);
  
  // Enable draggable news feed with ?news=drag query param
  const isDraggable = router.query.news === 'drag';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Development-only keyboard shortcut for test automation
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handleKeyPress = async (e: KeyboardEvent) => {
      // Alt+Shift+Q (Quick test) - doesn't conflict with browser shortcuts
      if (e.altKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
        e.preventDefault();
        
        if (isAutomating) return;
        setIsAutomating(true);
        
        try {
          // Step 1: Sign out if logged in
          if (user) {
            setAutomationStatus('Signing out...');
            await signOut();
            // Wait for auth state to update
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Step 2: Sign in as guest
          setAutomationStatus('Signing in as guest...');
          if (authFormRef.current) {
            await authFormRef.current.triggerGuestSignIn();
            // Wait just a bit for auth state to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Step 3: Join matchmaking queue
          setAutomationStatus('Joining matchmaking queue...');
          // Try to find match immediately, with retries if component not ready
          let retries = 0;
          while (!matchmakingRef.current && retries < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (matchmakingRef.current) {
            await matchmakingRef.current.triggerFindMatch();
            setAutomationStatus('In queue - waiting for match...');
          }
          
          // Clear status after a few seconds
          setTimeout(() => setAutomationStatus(null), 3000);
        } catch (error) {
          console.error('Test automation failed:', error);
          setAutomationStatus('Automation failed');
          setTimeout(() => setAutomationStatus(null), 3000);
        } finally {
          setIsAutomating(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [user, signOut, isAutomating]);

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
                  <Matchmaking ref={matchmakingRef} />
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
                      <AuthForm ref={authFormRef} redirectOnSuccess={false} />
                      
                      <Box sx={{ 
                        mt: 3, 
                        pt: 3, 
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        textAlign: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Or play offline without an account
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => router.push('/local')}
                          sx={{ mt: 1 }}
                        >
                          Play Local Game
                        </Button>
                      </Box>
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
      
      {/* Test automation status indicator (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <Snackbar
          open={!!automationStatus}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert severity="info" sx={{ width: '100%' }}>
            Test Mode: {automationStatus}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}
