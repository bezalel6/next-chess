import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
  LinearProgress,
  Fade,
  Avatar,
  Chip,
  IconButton,
  Grow,
} from "@mui/material";
import {
  PlayCircleOutline,
  StopCircle,
  SportsEsports,
  Timer,
  Groups,
  EmojiEvents,
  People,
  Psychology,
  ExitToApp,
} from "@mui/icons-material";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { GameService } from "@/services/gameService";
import { UserService } from "@/services/userService";
import { useRouter } from "next/router";
import type { Game } from "@/types/game";

interface GameWithOpponent extends Game {
  opponentName: string;
}

const QueueSystem = () => {
  const { queue, matchDetails, handleQueueToggle, stats } = useConnection();
  const { user } = useAuth();
  const gameActions = useUnifiedGameStore((s) => s.actions);
  const [activeGame, setActiveGame] = useState<GameWithOpponent | null>(null);
  const [hasActiveGame, setHasActiveGame] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const [animatedPosition, setAnimatedPosition] = useState(0);
  const router = useRouter();

  // Animate queue position
  useEffect(() => {
    if (queue.inQueue && queue.position > 0) {
      const timer = setTimeout(() => {
        setAnimatedPosition(queue.position);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedPosition(0);
    }
  }, [queue.position, queue.inQueue]);

  // Check for active game (only one allowed)
  useEffect(() => {
    async function checkActiveGame() {
      if (!user) {
        setHasActiveGame(false);
        setActiveGame(null);
        return;
      }

      setChecking(true);
      try {
        const games = await GameService.getUserActiveGames(user.id);
        setHasActiveGame(games.length > 0);

        if (games.length > 0) {
          // Only one active game allowed, take the first one
          const game = games[0];
          const opponentId =
            game.whitePlayerId === user.id
              ? game.blackPlayerId
              : game.whitePlayerId;

          const usernames = await UserService.getUsernamesByIds([opponentId]);

          setActiveGame({
            ...game,
            opponentName: usernames[opponentId] || "Unknown Player",
          });
        } else {
          setActiveGame(null);
        }
      } catch (error) {
        console.error("Error checking active game:", error);
        setHasActiveGame(false);
        setActiveGame(null);
      } finally {
        setChecking(false);
      }
    }

    checkActiveGame();
  }, [user, isResigning]);

  // Handle match found
  useEffect(() => {
    if (matchDetails?.gameId) {
      setCheckingMatch(true);
      const redirectTimeout = setTimeout(() => {
        router.push(`/game/${matchDetails.gameId}`);
      }, 1500);
      return () => clearTimeout(redirectTimeout);
    }
  }, [matchDetails, router]);

  const handleJoinGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const handleResignGame = async () => {
    if (!activeGame || !user) return;
    
    setIsResigning(true);
    try {
      const playerColor = activeGame.whitePlayerId === user.id ? "white" : "black";
      await GameService.resign(activeGame.id, playerColor);
      // Refresh active game state
      setActiveGame(null);
      setHasActiveGame(false);
    } catch (error) {
      console.error("Error resigning game:", error);
    } finally {
      setIsResigning(false);
    }
  };

  const renderQueueStatus = () => {
    if (checkingMatch) {
      return (
        <Grow in={checkingMatch}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 4,
            }}
          >
            <Box sx={{ position: "relative" }}>
              <CircularProgress size={80} thickness={2} />
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <EmojiEvents sx={{ fontSize: 40, color: "primary.main" }} />
              </Box>
            </Box>
            <Typography variant="h5" color="primary" fontWeight={600}>
              Match Found!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Setting up your game...
            </Typography>
          </Box>
        </Grow>
      );
    }

    if (queue.inQueue) {
      return (
        <Fade in={queue.inQueue}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              py: 4,
            }}
          >
            <Box sx={{ position: "relative", width: 120, height: 120 }}>
              <CircularProgress
                variant="determinate"
                value={100}
                size={120}
                thickness={1}
                sx={{
                  color: "rgba(255, 255, 255, 0.1)",
                  position: "absolute",
                }}
              />
              <CircularProgress
                variant="indeterminate"
                size={120}
                thickness={2}
                sx={{
                  animationDuration: "3s",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Groups sx={{ fontSize: 32, mb: 0.5 }} />
                {queue.position > 0 && (
                  <Typography variant="caption" fontWeight={600}>
                    #{animatedPosition}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h6" gutterBottom>
                Finding opponent...
              </Typography>
              {queue.size > 0 && (
                <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                  <Chip
                    icon={<Timer />}
                    label="In Queue"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    icon={<Groups />}
                    label={`${queue.size} players`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              )}
            </Box>

            <Button
              variant="outlined"
              color="error"
              startIcon={<StopCircle />}
              onClick={handleQueueToggle}
              size="large"
              sx={{
                px: 4,
                py: 1.5,
                borderWidth: 2,
                "&:hover": {
                  borderWidth: 2,
                },
              }}
            >
              Cancel Queue
            </Button>
          </Box>
        </Fade>
      );
    }

    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          py: 4,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            mb: 2,
          }}
        >
          <SportsEsports sx={{ fontSize: 64, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={600}>
            Ready to Play?
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Join the queue to find an opponent and start a new game
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayCircleOutline />}
            onClick={handleQueueToggle}
            size="large"
            disabled={hasActiveGame || checking}
            sx={{
              px: 6,
              py: 2,
              fontSize: "1.25rem",
              fontWeight: 600,
              borderRadius: 3,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              boxShadow: "0 10px 40px rgba(102, 126, 234, 0.4)",
              transition: "all 0.3s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: "0 15px 50px rgba(102, 126, 234, 0.5)",
                background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
              },
              "&:disabled": {
                background: "rgba(255, 255, 255, 0.1)",
              },
            }}
          >
            Play Now
          </Button>

          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            or
          </Typography>

          <Button
            variant="outlined"
            color="secondary"
            startIcon={<Psychology />}
            onClick={() => {
              if (gameActions.startLocalGame) {
                gameActions.startLocalGame();
                router.replace("/local-game");
              }
            }}
            size="large"
            // disabled={hasActiveGame || checking}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: "1rem",
              fontWeight: 600,
              borderRadius: 3,
              borderColor: "secondary.main",
              color: "secondary.main",
              transition: "all 0.3s ease",
              "&:hover": {
                transform: "translateY(-2px)",
                backgroundColor: "rgba(156, 39, 176, 0.1)",
                borderColor: "secondary.light",
              },
              "&:disabled": {
                borderColor: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.3)",
              },
            }}
          >
            Local Game
          </Button>
        </Box>

        {hasActiveGame && (
          <Typography variant="caption" color="warning.main">
            You must finish your active game first
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 500, mx: "auto" }}>
      {/* Active Users Indicator */}
      {stats.activeUsers > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <Chip
            icon={<People />}
            label={`${stats.activeUsers} ${stats.activeUsers === 1 ? "Player" : "Players"} Online`}
            color="primary"
            variant="outlined"
            sx={{
              fontWeight: 500,
              px: 1,
              backdropFilter: "blur(10px)",
              background: "rgba(255, 255, 255, 0.03)",
              borderColor: "rgba(168, 85, 247, 0.3)",
            }}
          />
        </Box>
      )}

      <Paper
        elevation={8}
        sx={{
          p: 3,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 3,
          transition: "all 0.3s ease",
        }}
      >
        {renderQueueStatus()}

        {hasActiveGame && activeGame && !queue.inQueue && !checkingMatch && (
          <Box sx={{ mt: 3 }}>
            <Paper
              sx={{
                p: 2.5,
                background: "linear-gradient(135deg, rgba(255, 152, 0, 0.08) 0%, rgba(255, 193, 7, 0.05) 100%)",
                border: "2px solid",
                borderColor: "warning.main",
                borderRadius: 2,
              }}
            >
              <Typography 
                variant="subtitle2" 
                color="warning.main" 
                fontWeight={600}
                sx={{ mb: 2, textAlign: "center" }}
              >
                ACTIVE GAME
              </Typography>
              
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: activeGame.turn === (activeGame.whitePlayerId === user?.id ? "white" : "black") 
                        ? "success.main" 
                        : "grey.700",
                      width: 40,
                      height: 40,
                    }}
                  >
                    {activeGame.opponentName[0].toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight={600}>
                      vs {activeGame.opponentName}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                      <Chip
                        label={
                          activeGame.turn === (activeGame.whitePlayerId === user?.id ? "white" : "black")
                            ? "Your turn"
                            : "Their turn"
                        }
                        size="small"
                        color={
                          activeGame.turn === (activeGame.whitePlayerId === user?.id ? "white" : "black")
                            ? "success"
                            : "default"
                        }
                        sx={{ height: 22 }}
                      />
                      <Chip
                        label={activeGame.whitePlayerId === user?.id ? "White" : "Black"}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22 }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 1.5 }}>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<SportsEsports />}
                  onClick={() => handleJoinGame(activeGame.id)}
                  sx={{
                    fontWeight: 600,
                    py: 1.2,
                  }}
                >
                  Resume Game
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ExitToApp />}
                  onClick={handleResignGame}
                  disabled={isResigning}
                  sx={{
                    minWidth: 120,
                    fontWeight: 600,
                    py: 1.2,
                    borderWidth: 2,
                    "&:hover": {
                      borderWidth: 2,
                      bgcolor: "rgba(244, 67, 54, 0.08)",
                    },
                  }}
                >
                  {isResigning ? "Resigning..." : "Resign"}
                </Button>
              </Box>
            </Paper>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default QueueSystem;
