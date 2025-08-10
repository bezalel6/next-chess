import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  CircularProgress,
  Paper,
  Divider,
} from "@mui/material";
import {
  Visibility,
  VideogameAsset,
  Person,
  PlayArrow,
} from "@mui/icons-material";
import { FollowService, type FollowedUser } from "@/services/followService";
import { useRouter } from "next/router";
import UserLink from "./user-link";

const FollowedUsersList: React.FC = () => {
  const router = useRouter();
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFollowedUsers();

    // Subscribe to real-time updates
    const subscription = FollowService.subscribeToFollowedUsersGames(() => {
      // Reload the list when a followed user's game status changes
      loadFollowedUsers();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadFollowedUsers = async () => {
    try {
      setLoading(true);
      const users = await FollowService.getFollowing();
      setFollowedUsers(users);
      setError(null);
    } catch (err) {
      console.error("Error loading followed users:", err);
      setError("Failed to load followed users");
    } finally {
      setLoading(false);
    }
  };

  const handleSpectate = (gameId: string) => {
    router.push(`/game/${gameId}?spectate=true`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (followedUsers.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Person sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No followed users yet
        </Typography>
        <Typography color="text.secondary">
          Start following other players to see their active games here
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Following ({followedUsers.length})
      </Typography>
      
      <List sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
        {followedUsers.map((user, index) => (
          <React.Fragment key={user.following_id}>
            {index > 0 && <Divider />}
            <ListItem
              sx={{
                py: 2,
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  {user.username[0].toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <UserLink username={user.username} />
                    <Chip
                      label={`Rating: ${user.rating}`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box mt={1}>
                    {user.active_game ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          icon={<VideogameAsset />}
                          label="In Game"
                          color="success"
                          size="small"
                          sx={{ animation: "pulse 2s infinite" }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          startIcon={<Visibility />}
                          onClick={() => handleSpectate(user.active_game!.game_id)}
                          sx={{ ml: 1 }}
                        >
                          Spectate
                        </Button>
                      </Box>
                    ) : (
                      <Chip
                        label="Not in game"
                        size="small"
                        variant="outlined"
                        color="default"
                      />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      Following since: {new Date(user.followed_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default FollowedUsersList;