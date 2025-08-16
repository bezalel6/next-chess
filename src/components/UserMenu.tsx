import { useState, useEffect } from "react";
import type { MouseEvent } from "react";
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  ListItemIcon,
  CircularProgress,
  Avatar,
  Badge,
} from "@mui/material";
import {
  PersonOutline as PersonIcon,
  AccountCircle,
  Logout,
  Settings,
  Person,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/router";
import { FollowService } from "@/services/followService";

const UserMenu = () => {
  const { user, profileUsername, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    handleClose();
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setSigningOut(false);
    }
  };

  const handleProfile = () => {
    handleClose();
    if (profileUsername) {
      router.push(`/@${profileUsername}`);
    }
  };

  // Fetch following count
  useEffect(() => {
    const fetchFollowingCount = async () => {
      if (user?.id) {
        try {
          const stats = await FollowService.getFollowStats(user.id);
          setFollowingCount(stats.following_count);
        } catch (error) {
          console.error("Error fetching follow stats:", error);
        }
      }
    };

    fetchFollowingCount();
  }, [user]);

  if (!user) return null;

  const displayName = profileUsername || user.email;
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1,
          borderRadius: 2,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          transition: "all 0.3s ease",
          position: "relative",
          overflow: "hidden",
          ...(isAdmin && !open
            ? {
                background:
                  "linear-gradient(120deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06)) padding-box, " +
                  "linear-gradient(135deg, rgba(168,85,247,0.28) 0%, rgba(236,72,153,0.28) 25%, rgba(34,211,238,0.28) 50%, rgba(236,72,153,0.28) 75%, rgba(168,85,247,0.28) 100%) border-box, " +
                  "linear-gradient(120deg, #1a1a1a, #1b1b1b)",
                bgcolor: "transparent",
                backgroundClip: "padding-box, border-box, border-box",
                backgroundOrigin: "border-box",
                backgroundSize: "200% 200%, 200% 200%, auto",
                animation: "gradientShift 8s ease infinite",
                ['@keyframes gradientShift']: {
                  '0%': { backgroundPosition: "0% 50%, 0% 50%, 0% 0%" },
                  '50%': { backgroundPosition: "100% 50%, 100% 50%, 0% 0%" },
                  '100%': { backgroundPosition: "0% 50%, 0% 50%, 0% 0%" },
                },
              }
            : {
                bgcolor: "rgba(255, 255, 255, 0.05)",
              }),
          "&:hover": {
            borderColor: "rgba(255, 255, 255, 0.15)",
            transform: "translateY(-1px)",
            ...(isAdmin && !open
              ? { filter: "saturate(1.25) brightness(1.05)" }
              : { bgcolor: "rgba(255, 255, 255, 0.08)" }),
          },
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: "primary.main",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {initials}
        </Avatar>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontSize: "0.875rem",
            color: "rgba(255, 255, 255, 0.9)",
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </Typography>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        PaperProps={{
          elevation: 8,
          sx: {
            mt: 1.5,
            minWidth: 200,
            bgcolor: "background.paper",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            "& .MuiMenuItem-root": {
              py: 1.5,
              px: 2,
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor: "rgba(168, 85, 247, 0.08)",
              },
            },
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Profile</Typography>
        </MenuItem>

        <MenuItem onClick={() => router.push("/following")}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
            }}
          >
            <Typography variant="body2">Following</Typography>
            {followingCount > 0 && (
              <Badge
                badgeContent={followingCount}
                color="primary"
                sx={{
                  "& .MuiBadge-badge": {
                    position: "static",
                    transform: "none",
                    fontSize: "0.75rem",
                    height: 18,
                    minWidth: 18,
                  },
                }}
              />
            )}
          </Box>
        </MenuItem>

        <Divider sx={{ my: 1, borderColor: "rgba(255, 255, 255, 0.08)" }} />

        {isAdmin && (
          <MenuItem onClick={() => router.push("/admin")}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2">Admin Dashboard</Typography>
          </MenuItem>
        )}

        <Divider sx={{ my: 1, borderColor: "rgba(255, 255, 255, 0.08)" }} />

        <MenuItem onClick={handleSignOut} disabled={signingOut}>
          <ListItemIcon>
            {signingOut ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <Logout fontSize="small" color="error" />
            )}
          </ListItemIcon>
          <Typography variant="body2" color="error">
            {signingOut ? "Signing Out..." : "Sign Out"}
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserMenu;
