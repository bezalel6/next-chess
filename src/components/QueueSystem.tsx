import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
  LinearProgress,
  Fade,
  Collapse,
  List,
  ListItem,
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
  ExpandMore,
  ExpandLess,
  TrendingUp,
  People,
  Psychology,
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
  const [activeGames, setActiveGames] = useState<GameWithOpponent[]>([]);
  const [hasActiveGames, setHasActiveGames] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingMatch, setCheckingMatch] = useState(false);
  const [showActiveGames, setShowActiveGames] = useState(false);
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

  // Check for active games
  useEffect(() => {
    async function checkActiveGames() {
      if (!user) {
        setHasActiveGames(false);
        setActiveGames([]);
        return;
      }

      setChecking(true);
      try {
        const games = await GameService.getUserActiveGames(user.id);
        setHasActiveGames(games.length > 0);

        if (games.length > 0) {
          const opponentIds = games.map((game) =>
            game.whitePlayer === user.id ? game.blackPlayer : game.whitePlayer
          );

          const usernames = await UserService.getUsernamesByIds(opponentIds);

          const gamesWithOpponents = games.map((game) => {
            const opponentId =
              game.whitePlayer === user.id
                ? game.blackPlayer
                : game.whitePlayer;
            return {
              ...game,
              opponentName: usernames[opponentId] || "Unknown Player",
            };
          });

          setActiveGames(gamesWithOpponents);
        }
      } catch (error) {
        console.error("Error checking active games:", error);
        setHasActiveGames(false);
      } finally {
        setChecking(false);
      }
    }

    checkActiveGames();
  }, [user]);

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
            disabled={hasActiveGames || checking}
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
              console.log(
                "Local game implemented:",
                !!gameActions.startLocalGame
              );
              if (gameActions.startLocalGame) {
                gameActions.startLocalGame();
                router.replace("/local-game");
              }
            }}
            size="large"
            disabled={hasActiveGames || checking}
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

        {hasActiveGames && (
          <Typography variant="caption" color="warning.main">
            You must finish your active games first
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

        {hasActiveGames && !queue.inQueue && !checkingMatch && (
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              color="warning"
              fullWidth
              onClick={() => setShowActiveGames(!showActiveGames)}
              endIcon={showActiveGames ? <ExpandLess /> : <ExpandMore />}
              sx={{
                mb: 2,
                py: 1.5,
                borderWidth: 2,
                "&:hover": {
                  borderWidth: 2,
                  bgcolor: "rgba(255, 133, 0, 0.08)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  width: "100%",
                }}
              >
                <TrendingUp />
                <Typography variant="body1" fontWeight={600}>
                  {activeGames.length} Active Game
                  {activeGames.length !== 1 ? "s" : ""}
                </Typography>
              </Box>
            </Button>

            <Collapse in={showActiveGames}>
              <List
                sx={{
                  bgcolor: "background.paper",
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {activeGames.map((game, index) => {
                  const isWhite = game.whitePlayer === user?.id;
                  const colorPlaying = isWhite ? "white" : "black";
                  const isMyTurn = game.turn === colorPlaying;

                  return (
                    <ListItem
                      key={game.id}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        bgcolor: isMyTurn
                          ? "rgba(76, 175, 80, 0.08)"
                          : "transparent",
                        borderBottom:
                          index < activeGames.length - 1 ? "1px solid" : "none",
                        borderColor: "divider",
                        py: 2,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          bgcolor: isMyTurn
                            ? "rgba(76, 175, 80, 0.12)"
                            : "rgba(255, 255, 255, 0.03)",
                        },
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 2 }}
                      >
                        <Avatar
                          sx={{
                            bgcolor: isMyTurn ? "success.main" : "grey.700",
                            width: 36,
                            height: 36,
                          }}
                        >
                          {game.opponentName[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight={500}>
                            vs {game.opponentName}
                          </Typography>
                          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                            <Chip
                              label={isMyTurn ? "Your turn" : "Their turn"}
                              size="small"
                              color={isMyTurn ? "success" : "default"}
                              sx={{ height: 20, fontSize: "0.75rem" }}
                            />
                            <Chip
                              label={colorPlaying}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.75rem" }}
                            />
                          </Box>
                        </Box>
                      </Box>
                      <Button
                        variant="contained"
                        color={isMyTurn ? "success" : "primary"}
                        size="small"
                        startIcon={<SportsEsports />}
                        onClick={() => handleJoinGame(game.id)}
                        sx={{
                          minWidth: 100,
                          fontWeight: 600,
                        }}
                      >
                        Resume
                      </Button>
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default QueueSystem;
