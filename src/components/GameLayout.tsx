import React from "react";
import { Box, Typography } from "@mui/material";
import GameBoard from "./GameBoard";
import BoardMoveInput from "./BoardMoveInput";
import RightSidebar from "./RightSidebar";
import DebugLog from "./DebugLog";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import GameChat from "./GameChat";
import BanPhaseOverlay from "./BanPhaseOverlay";
import GameStateIndicator from "./GameStateIndicator";
import styles from "@/styles/board.module.css";

// Left sidebar component
const LeftSidebar = () => {
  const game = useUnifiedGameStore((s) => s.game);

  // Calculate time ago
  const getTimeAgo = () => {
    if (!game?.startTime) return "just now";
    const created = new Date(game.startTime);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins === 1) return "1 minute ago";
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  // Get time control format (e.g., "10+0" for 10 minutes, no increment)
  const getTimeControl = () => {
    if (!game) return "10+0";

    // Check for time control in game object
    const initialTime = game.timeControl?.initialTime || 600000; // Default 10 minutes
    const increment = game.timeControl?.increment || 0;

    const minutes = Math.floor(initialTime / 60000);
    return `${minutes}+${increment}`;
  };

  // Determine game speed category
  const getGameSpeed = () => {
    const timeControl = getTimeControl();
    const [minutes] = timeControl.split("+").map(Number);

    if (minutes < 3) return "Bullet";
    if (minutes < 8) return "Blitz";
    if (minutes < 15) return "Rapid";
    return "Classical";
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 320,
        flexShrink: 0,
        gap: 2,
        height: "100%",
      }}
    >
      {/* Debug Log */}
      <Box
        sx={{
          flex: 0.5,
          minHeight: 0,
          margin: "0 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <GameChat gameId={game.id} />
      </Box>
    </Box>
  );
};

interface GameWithRecoveryProps {
  boardFlipped: boolean;
  onFlipBoard: () => void;
}

export default function GameLayout({
  boardFlipped,
  onFlipBoard,
}: GameWithRecoveryProps) {
  const game = useUnifiedGameStore((s) => s.game);
  const boardOrientation = useUnifiedGameStore((s) => s.boardOrientation);
  const myColor = useUnifiedGameStore((s) => s.myColor);
  const isLocalGame = useUnifiedGameStore((s) => s.mode === "local");
  const phase = useUnifiedGameStore((s) => s.phase);
  const canBan = useUnifiedGameStore(
    (s) => s.phase === "selecting_ban" && s.game?.status === "active"
  );

  // Center column (resizable) ref and persistence
  const centerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    try {
      const raw = localStorage.getItem("boardSize");
      const saved = raw ? Math.round(Number(raw)) : 600;
      const clamped = Math.max(400, Math.min(1200, saved));
      el.style.width = `${clamped}px`;
      document.documentElement.style.setProperty("--board-size", `${clamped}px`);
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
        display: "flex",
        flexDirection: "row",
        gap: 2,
        width: "100%",
        justifyContent: "center",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      {/* Subtle game state indicator */}
      <GameStateIndicator />
      
      {/* Left sidebar */}
      {!isLocalGame && <LeftSidebar />}

      {/* Center container - Board and controls */}
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
        <GameBoard
          orientation={
            boardFlipped
              ? (boardOrientation === "white" ? "black" : "white")
              : boardOrientation
          }
          onResizeHandleMouseDown={onHandleMouseDown}
        />
        <div className={styles.boardFold}>
          <Box sx={{ width: '100%' }}>
            <BanPhaseOverlay isMyTurnToBan={canBan} />
          </Box>
          <div className={styles.boardInputDock}>
            <BoardMoveInput />
          </div>
        </div>
        </div>
      </Box>

      {/* Right sidebar */}
      <RightSidebar boardFlipped={boardFlipped} onFlipBoard={onFlipBoard} />
    </Box>
  );
}
