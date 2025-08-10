import React, { useState, useEffect } from "react";
import { Button, CircularProgress } from "@mui/material";
import { PersonAdd, PersonRemove } from "@mui/icons-material";
import { FollowService } from "@/services/followService";
import { useAuth } from "@/contexts/AuthContext";

interface FollowButtonProps {
  userId: string;
  username: string;
  size?: "small" | "medium" | "large";
  showIcon?: boolean;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  username,
  size = "medium",
  showIcon = true,
}) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || user.id === userId) {
        setChecking(false);
        return;
      }

      try {
        const following = await FollowService.isFollowing(userId);
        setIsFollowing(following);
      } catch (error) {
        console.error("Error checking follow status:", error);
      } finally {
        setChecking(false);
      }
    };

    checkFollowStatus();
  }, [userId, user]);

  const handleToggleFollow = async () => {
    if (!user || loading) return;

    setLoading(true);
    try {
      if (isFollowing) {
        await FollowService.unfollowUser(userId);
        setIsFollowing(false);
      } else {
        await FollowService.followUser(userId);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show button for self or when not logged in
  if (!user || user.id === userId) {
    return null;
  }

  if (checking) {
    return (
      <Button size={size} disabled>
        <CircularProgress size={16} />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={isFollowing ? "outlined" : "contained"}
      color={isFollowing ? "secondary" : "primary"}
      onClick={handleToggleFollow}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={16} />
        ) : showIcon ? (
          isFollowing ? (
            <PersonRemove />
          ) : (
            <PersonAdd />
          )
        ) : null
      }
      sx={{
        minWidth: showIcon ? 120 : 80,
        textTransform: "none",
      }}
    >
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
};

export default FollowButton;