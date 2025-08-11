import { useState } from "react";
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

const UserMenu = () => {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [signingOut, setSigningOut] = useState(false);
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
    if (profile?.username) {
      router.push(`/user/${profile.username}`);
    }
  };

  if (!user || !profile) return null;

  const displayName = profile.username || user.email;
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
          bgcolor: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(8px)",
          cursor: "pointer",
          transition: "all 0.3s ease",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.08)",
            borderColor: "rgba(255, 255, 255, 0.15)",
            transform: "translateY(-1px)",
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
          <Typography variant="body2">Following</Typography>
        </MenuItem>

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