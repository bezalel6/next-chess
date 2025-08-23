import { useRef, useEffect, useCallback, useState } from "react";
import type React from "react";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import LichessBoard from "./LichessBoard";
import GameOverDetails from "./GameOverDetails";
import styles from "@/styles/board.module.css";
import type { Api } from "chessground/api";

interface GameBoardProps {
  orientation?: "white" | "black";
  onResizeHandleMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function GameBoard({ orientation, onResizeHandleMouseDown }: GameBoardProps) {
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const phase = useUnifiedGameStore(s => s.phase);
  
  const boardApiRef = useRef<Api | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number>();

  const boardOrientation = orientation || myColor || "white";


  // Handle board API and setup resize observer (also persist width)
  const handleBoardApi = useCallback((api: Api) => {
    boardApiRef.current = api;
    
    const container = frameRef.current;
    if (!container) return;

    const latestWidthRef = { current: NaN } as { current: number };
    let rafId: number | null = null;

    const scheduleResizeWork = (measuredWidth: number) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        api.redrawAll();
        rafId = null;
      });
    };

    const handleInitial = () => {
      // Use contentRect width via ResizeObserver for consistency; fallback to client rect
      const w = container.getBoundingClientRect().width;
      latestWidthRef.current = w;
      scheduleResizeWork(w);
    };

    // Initial redraw after mount
    requestAnimationFrame(handleInitial);

    // Observe container size changes and schedule work outside observer loop
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const w = Math.max(0, entry.contentRect?.width || container.getBoundingClientRect().width);
      if (!Number.isFinite(w)) return;
      if (Math.abs(w - latestWidthRef.current) < 0.5) return; // ignore jitter
      latestWidthRef.current = w;
      scheduleResizeWork(w);
    });

    resizeObserver.observe(container);

    // Store cleanup function on the API for later
    (api as any).__cleanup = () => {
      resizeObserver.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const api = boardApiRef.current as any;
      if (api?.__cleanup) {
        api.__cleanup();
      }
    };
  }, []);

  if (!game) {
    return (
      <div className={styles.boardLayout}>
        <div className={styles.boardFrame}>
          <div className={styles.loadingState}>
            Initializing board...
          </div>
        </div>
      </div>
    );
  }

  const isBanPhase = phase === 'selecting_ban' && game.status === 'active';

  return (
    <div className={styles.boardLayout}>
      <div 
        ref={frameRef}
        className={styles.boardFrame}
        data-phase={isBanPhase ? "ban" : "move"}
        data-testid="game-board"
        data-my-color={myColor}
        data-current-turn={game?.turn}
      >
        {/* Game over overlay */}
        {game.status === "finished" && (
          <div className={styles.gameOverOverlay}>
            <GameOverDetails />
          </div>
        )}

        {/* Board content */}
        <div className={styles.boardContent}>
          <LichessBoard 
            orientation={boardOrientation}
            onBoardApi={handleBoardApi}
          />
        </div>
        {/* Ban border overlay inside the board */}
        {isBanPhase && <div className={styles.banBorderOverlay} aria-hidden />}
        <div className={styles.resizeHandle} title="Drag to resize" onMouseDown={onResizeHandleMouseDown} />
      </div>
    </div>
  );
}
