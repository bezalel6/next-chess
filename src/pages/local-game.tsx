import React from "react";
import { Box, Container, Typography, Paper } from "@mui/material";
import { useRouter } from "next/router";
import { useEffect } from "react";
import GameBoard from "@/components/GameBoard";
import GamePanel from "@/components/GamePanel";
import BanPhaseOverlay from "@/components/BanPhaseOverlay";
import BoardMoveInput from "@/components/BoardMoveInput";
import InfoIcon from "@mui/icons-material/Info";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useChessSounds } from "@/hooks/useChessSounds";
import styles from "@/styles/board.module.css";

// Initialize local game immediately when component is created
if (typeof window !== "undefined") {
  const state = useUnifiedGameStore.getState();
  if (state.mode !== "local") {
    state.initLocalGame();
  }
}

export default function LocalGamePage() {
  const centerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    try {
      const raw = localStorage.getItem("boardSize");
      const saved = raw ? Math.round(Number(raw)) : 600;
      const clamped = Math.max(400, Math.min(1200, saved));
      el.style.width = `${clamped}px`;
      document.documentElement.style.setProperty(
        "--board-size",
        `${clamped}px`
      );
    } catch {}
    let rafId: number | null = null;
    const obs = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const w = entries[0].contentRect.width;
      if (!Number.isFinite(w)) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const c = Math.max(400, Math.min(1200, Math.round(w)));
        try {
          localStorage.setItem("boardSize", String(c));
          document.documentElement.style.setProperty("--board-size", `${c}px`);
        } catch {}
        rafId = null;
      });
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  const router = useRouter();
  const { playGameStart } = useChessSounds();

  // Play sound effect on mount
  useEffect(() => {
    playGameStart();
  }, [playGameStart]);

  // Get game state to determine board orientation
  const game = useUnifiedGameStore((s) => s.game);
  const phase = useUnifiedGameStore((s) => s.phase);
  const canBan = useUnifiedGameStore(
    (s) => s.phase === "selecting_ban" && s.game?.status === "active"
  );
  const boardOrientation = useUnifiedGameStore((s) => s.boardOrientation);

  const onHandleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const el = centerRef.current;
    if (!el) return;
    const startW = el.getBoundingClientRect().width;
    const clamp = (w: number) => Math.max(400, Math.min(1200, Math.round(w)));
    const onMove = (ev: MouseEvent) => {
      const next = clamp(startW + (ev.clientX - startX));
      el.style.width = `${next}px`;
      try {
        localStorage.setItem('boardSize', String(next));
        document.documentElement.style.setProperty('--board-size', `${next}px`);
      } catch {}
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <Box
      sx={{
        height: "calc(100vh - 64px)", // Account for header height
        bgcolor: "#161512",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {/* Main content area */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          p: 2,
        }}
      >
        <Container maxWidth={false}>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "center",
              flexWrap: { xs: "wrap", lg: "nowrap" },
            }}
          >
            {/* Left sidebar - Game Rules */}
            <Box
              sx={{
                width: { xs: "100%", lg: 280 },
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Paper
                sx={{
                  p: 2,
                  bgcolor: "#2e2a24",
                  border: "none",
                  color: "#bababa",
                }}
              >
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <InfoIcon fontSize="small" />
                  <Typography variant="h6">How to Play</Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <strong>Ban Chess Rules:</strong>
                </Typography>
                <Typography
                  variant="body2"
                  component="ol"
                  sx={{ pl: 2, "& li": { mb: 0.5 } }}
                >
                  <li>Black bans one of White&apos;s possible first moves</li>
                  <li>White makes their first move (avoiding the ban)</li>
                  <li>White then bans one of Black&apos;s possible moves</li>
                  <li>Black makes their move (avoiding the ban)</li>
                  <li>
                    Continue alternating: move, then ban opponent&apos;s next
                    move
                  </li>
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 1.5, opacity: 0.8 }}
                >
                  The banned move is highlighted in red. Click on pieces to
                  select moves to ban or make.
                </Typography>
              </Paper>

              <Paper
                sx={{
                  p: 2,
                  bgcolor: "#2e2a24",
                  border: "none",
                  color: "#bababa",
                }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <strong>Tips:</strong>
                </Typography>
                <Typography
                  variant="body2"
                  component="ul"
                  sx={{ pl: 2, "& li": { mb: 0.5 } }}
                >
                  <li>Ban critical defensive moves to create threats</li>
                  <li>Ban escape squares when checking</li>
                  <li>Consider banning castle moves at key moments</li>
                </Typography>
              </Paper>
            </Box>

            {/* Center - Game board */}
            <Box
              ref={centerRef}
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                width: "600px",
                flexShrink: 0,
                resize: "horizontal",
                overflow: "visible",
                minWidth: 400,
                maxWidth: "min(1200px, calc(100vh - var(--header-height)))",
              }}
            >
              <div className={styles.boardStack}>
                <GameBoard orientation={boardOrientation} onResizeHandleMouseDown={onHandleMouseDown} />
                {/* Ban notification banner - positioned under the board */}
                <div className={styles.boardFold}>
                  <Box sx={{ width: "100%" }}>
                    <BanPhaseOverlay isMyTurnToBan={canBan} />
                  </Box>
                  <div className={styles.boardInputDock}>
                    <BoardMoveInput />
                  </div>
                </div>
              </div>
            </Box>

            {/* Right sidebar - Integrated move history and PGN */}
            <Box
              sx={{
                width: { xs: "100%", lg: 280 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Paper
                sx={{
                  bgcolor: "#2e2a24",
                  border: "none",
                  color: "#bababa",
                  overflow: "hidden",
                }}
              >
                <GamePanel />
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
