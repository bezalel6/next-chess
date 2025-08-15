import {
  Box,
  Typography,
  Link,
  Button,
  useTheme,
  useMediaQuery,
  Fade,
  Slide,
  useScrollTrigger,
  AppBar,
} from "@mui/material";
import { PersonOutline as PersonIcon } from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContextV2";
import React, { useState, useEffect } from "react";
import TabDialog from "./TabDialog";
import UserLink from "./user-link";
import Logo from "./Logo";
import UserMenu from "./UserMenu";

// Hook for scroll-based header effects
function useScrollEffect() {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  return trigger;
}

const Header = () => {
  const { profileUsername } = useAuth();
  const { game, loading, myColor } = useGame();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isScrolled = useScrollEffect();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Display user info - prioritize game context over general user info
  const displayUserInfo = () => {
    if (game && !loading) {
      if (myColor) {
        return `${profileUsername || "You"} (${myColor})`;
      } else {
        return "Spectator";
      }
    }
    return profileUsername || "";
  };

  const navigationItems = [
    <HowToPlayDialog key="how-to-play" />,
    <AboutDialog key="about" />,
  ];

  if (!mounted) return null;

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: isScrolled
            ? "rgba(18, 18, 18, 0.95)"
            : "rgba(18, 18, 18, 0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: isScrolled
            ? "1px solid rgba(255, 255, 255, 0.12)"
            : "1px solid rgba(255, 255, 255, 0.08)",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundImage: "none",
          boxShadow: isScrolled ? "0 8px 32px rgba(0, 0, 0, 0.12)" : "none",
        }}
      >
        <Box
          sx={{
            maxWidth: "1300px",
            mx: "auto",
            width: "100%",
            px: { xs: 2, sm: 3, md: 4 },
          }}
        >
          {isMobile ? (
            // Mobile Column Layout
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                py: 2,
              }}
            >
              {/* Mobile Header Row */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <Fade in={mounted} timeout={600}>
                  <Box
                    sx={{
                      transition: "transform 0.3s ease",
                      "&:hover": {
                        transform: "scale(1.02)",
                      },
                    }}
                  >
                    <Logo size="small" />
                  </Box>
                </Fade>

                {/* Mobile User Menu */}
                {profileUsername && (
                  <Fade in={mounted} timeout={1000}>
                    <Box>
                      <UserMenu />
                    </Box>
                  </Fade>
                )}
              </Box>

              {/* Mobile Navigation Row */}
              <Slide direction="down" in={mounted} timeout={800}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    flexWrap: "wrap",
                    width: "100%",
                  }}
                >
                  {navigationItems.map((item, index) => (
                    <Fade key={index} in={mounted} timeout={900 + index * 100}>
                      <Box>{item}</Box>
                    </Fade>
                  ))}
                </Box>
              </Slide>
            </Box>
          ) : (
            // Desktop Grid Layout
            <Box
              sx={{
                minHeight: 72,
                display: "grid",
                gridTemplateColumns: "1fr 2fr 1fr",
                alignItems: "center",
                gap: 2,
              }}
            >
              {/* Desktop Left - Logo */}
              <Fade in={mounted} timeout={600}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    transition: "transform 0.3s ease",
                    "&:hover": {
                      transform: "scale(1.02)",
                    },
                  }}
                >
                  <Logo size="medium" />
                </Box>
              </Fade>

              {/* Desktop Center - Navigation */}
              <Slide direction="down" in={mounted} timeout={800}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    width: "100%",
                  }}
                >
                  {navigationItems.map((item, index) => (
                    <Fade key={index} in={mounted} timeout={900 + index * 100}>
                      <Box>{item}</Box>
                    </Fade>
                  ))}
                </Box>
              </Slide>

              {/* Desktop Right - User Info */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 2,
                }}
              >
                {/* Desktop User Menu */}
                {profileUsername && (
                  <Fade in={mounted} timeout={1000}>
                    <Box>
                      <UserMenu />
                    </Box>
                  </Fade>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </AppBar>
    </>
  );
};

// Enhanced Dialog Components with better button styling
const HowToPlayDialog = () => (
  <TabDialog
    title="How To Play"
    buttonProps={{
      variant: "outlined",
      size: "small",
      sx: {
        textTransform: "none",
        fontWeight: 500,
        fontSize: "0.95rem",
        px: 2.5,
        py: 1,
        borderRadius: 2,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))",
          opacity: 0,
          transition: "opacity 0.3s ease",
          zIndex: -1,
        },
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: "0 4px 20px rgba(168, 85, 247, 0.15)",
          "&::before": {
            opacity: 1,
          },
        },
        "&:active": {
          transform: "translateY(0)",
        },
      },
    }}
  >
    <Typography
      variant="h6"
      gutterBottom
      sx={{
        color: "primary.main",
        fontWeight: 600,
      }}
    >
      Welcome to BanChess!
    </Typography>
    <Typography
      variant="body1"
      paragraph
      sx={{
        lineHeight: 1.7,
        color: "rgba(255, 255, 255, 0.85)",
      }}
    >
      In BanChess, every move starts with the opponent selecting a legal move to
      become illegal
    </Typography>
    <Typography
      variant="subtitle1"
      gutterBottom
      sx={{
        fontWeight: 600,
        mt: 3,
        color: "rgba(255, 255, 255, 0.95)",
      }}
    >
      Game Rules:
    </Typography>
    <Box
      component="ol"
      sx={{
        pl: 2,
        "& li": {
          mb: 1.5,
          "&::marker": {
            color: "primary.main",
            fontWeight: 600,
          },
        },
      }}
    >
      <li>
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.95)" }}>
            Turn Sequence:
          </strong>{" "}
          Before EVERY move throughout the entire game, your opponent sees all
          your legal moves and selects ONE to ban.
        </Typography>
      </li>
      <li>
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.95)" }}>
            Continuous Banning:
          </strong>{" "}
          After each move is made, the other player now becomes the banning
          player for their opponent's next turn.
        </Typography>
      </li>
      <li>
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.95)" }}>
            Strategic Depth:
          </strong>{" "}
          You must constantly predict what your opponent wants to play and ban
          their most dangerous moves.
        </Typography>
      </li>
      <li>
        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.95)" }}>
            Victory:
          </strong>{" "}
          Checkmate your opponent to win, just like regular chess!
        </Typography>
      </li>
    </Box>
    <Typography
      variant="body2"
      sx={{
        mt: 3,
        fontStyle: "italic",
        color: "primary.light",
        textAlign: "center",
        p: 2,
        bgcolor: "rgba(168, 85, 247, 0.1)",
        borderRadius: 2,
        border: "1px solid rgba(168, 85, 247, 0.2)",
      }}
    >
      Every single move in Ban Chess requires adapting to your opponent's ban!
    </Typography>
  </TabDialog>
);

const AboutDialog = () => (
  <TabDialog
    title="About BanChess"
    buttonProps={{
      variant: "outlined",
      size: "small",
      sx: {
        textTransform: "none",
        fontWeight: 500,
        fontSize: "0.95rem",
        px: 2.5,
        py: 1,
        borderRadius: 2,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))",
          opacity: 0,
          transition: "opacity 0.3s ease",
          zIndex: -1,
        },
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: "0 4px 20px rgba(168, 85, 247, 0.15)",
          "&::before": {
            opacity: 1,
          },
        },
        "&:active": {
          transform: "translateY(0)",
        },
      },
    }}
  >
    <Typography
      variant="body1"
      paragraph
      sx={{
        lineHeight: 1.7,
        color: "rgba(255, 255, 255, 0.85)",
      }}
    >
      BanChess is an innovative chess variant that adds a strategic banning
      phase before traditional gameplay begins.
    </Typography>
    <Typography
      variant="body1"
      paragraph
      sx={{
        lineHeight: 1.7,
        color: "rgba(255, 255, 255, 0.85)",
      }}
    >
      Created for chess enthusiasts who love tactical thinking and want to
      experience chess in a completely new way.
    </Typography>
    <Box
      sx={{
        mt: 3,
        p: 3,
        bgcolor: "rgba(255, 255, 255, 0.03)",
        borderRadius: 2,
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <Typography
        variant="subtitle2"
        gutterBottom
        sx={{
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.95)",
          mb: 2,
        }}
      >
        Key Features:
      </Typography>
      <Box
        component="ul"
        sx={{
          pl: 2,
          m: 0,
          "& li": {
            mb: 1,
            "&::marker": {
              color: "primary.main",
            },
          },
        }}
      >
        <li>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            Strategic piece banning system
          </Typography>
        </li>
        <li>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            Real-time multiplayer gameplay
          </Typography>
        </li>
        <li>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            Spectator mode for watching games
          </Typography>
        </li>
        <li>
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            Modern, responsive interface
          </Typography>
        </li>
      </Box>
    </Box>
  </TabDialog>
);

export default Header;
