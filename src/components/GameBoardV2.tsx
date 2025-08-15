import { Box } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import { useGameStore } from "@/stores/gameStore";
import LichessBoardV2 from "./LichessBoardV2";
import BanPhaseOverlay from "./BanPhaseOverlay";
import GameOverDetails from "./GameOverDetails";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useState, useEffect, useRef } from "react";

export default function GameBoardV2({
  orientation,
}: {
  orientation?: "white" | "black";
}) {
  // Use unified selectors
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const canBan = useUnifiedGameStore(s => s.phase === 'selecting_ban' && s.game?.status === 'active');
  const canMove = useUnifiedGameStore(s => {
    if (s.mode === 'local') {
      return s.phase === 'making_move' && s.game?.status === 'active';
    }
    const isMyTurn = s.mode !== 'spectator' && 
                    s.game?.turn === s.myColor && 
                    s.game?.status === 'active';
    return s.phase === 'making_move' && isMyTurn;
  });
  const [boardSize, setBoardSize] = useState(560);
  const [isResizing, setIsResizing] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Load saved board size from localStorage
  useEffect(() => {
    const savedSize = localStorage.getItem("boardSize");
    if (savedSize) {
      setBoardSize(parseInt(savedSize));
    }
  }, []);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = boardSize;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      // Use the larger delta to maintain square aspect ratio
      const delta = Math.max(deltaX, deltaY);
      const newSize = Math.min(800, Math.max(400, startSize + delta));
      setBoardSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem("boardSize", boardSize.toString());
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  if (!game) {
    return null;
  }

  const boardOrientation = orientation || myColor || "white";

  return (
    <Box sx={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      gap: 2,
      mt: 15, // Add margin-top to ensure ban notification banner has space
    }}>
      <Box
        sx={{
          position: "relative",
          width: boardSize,
          height: boardSize,
          bgcolor: "#2a2a2a",
          borderRadius: 0.5,
          userSelect: isResizing ? "none" : "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        ref={boardRef}
        data-testid="game-board"
        data-game-phase={canBan ? "ban" : canMove ? "move" : "waiting"}
        data-my-color={myColor}
        data-current-turn={game?.turn}
      >
        <BanPhaseOverlay isMyTurnToBan={canBan} />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <LichessBoardV2 orientation={boardOrientation} />
        </Box>

        {game.status === "finished" && <GameOverDetails />}

        {/* Resize handle */}
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            position: "absolute",
            bottom: 4,
            right: 4,
            width: 24,
            height: 24,
            cursor: "nwse-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            background: "rgba(0, 0, 0, 0.6)",
            borderRadius: "4px",
            backdropFilter: "blur(4px)",
            transition: "all 0.2s",
            "&:hover": {
              background: "rgba(0, 0, 0, 0.8)",
              transform: "scale(1.1)",
            },
          }}
        >
          <DragIndicatorIcon
            sx={{
              fontSize: 18,
              color: "rgba(255, 255, 255, 0.9)",
              transform: "rotate(45deg)",
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
