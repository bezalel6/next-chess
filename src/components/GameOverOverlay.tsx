import { Box, Typography, Fade, Slide } from "@mui/material";
import { useEffect, useState } from "react";
import { useGame } from "@/contexts/GameProvider";

const OVERLAY_DURATION = 1500; // ms

const GameOverOverlay = () => {
  const { game } = useGame();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (game && game.status === "finished") {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), OVERLAY_DURATION);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [game?.status]);

  return (
    <Fade in={visible} timeout={{ enter: 300, exit: 400 }}>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.85) 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 100,
          pointerEvents: "none",
        }}
      >
        <Slide in={visible} direction="down" timeout={{ enter: 300, exit: 400 }}>
          <Typography
            variant="h2"
            sx={{
              color: "#fff",
              fontWeight: "bold",
              letterSpacing: 2,
              textShadow: "0 4px 24px #000, 0 0 8px #fff8",
              mb: 0,
              p: 2,
              borderRadius: 2,
              background: "rgba(0,0,0,0.2)",
              boxShadow: 6,
              userSelect: "none",
            }}
          >
            Game Over
          </Typography>
        </Slide>
      </Box>
    </Fade>
  );
};

export default GameOverOverlay; 