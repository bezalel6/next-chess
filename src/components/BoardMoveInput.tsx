import { useState, useCallback } from "react";
import { Box } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import type { Square } from "chess.ts/dist/types";
import { Chess } from "chess.ts";
import { useChessSounds } from "@/hooks/useChessSounds";

export default function BoardMoveInput() {
  const [value, setValue] = useState("");
  const game = useUnifiedGameStore((s) => s.game);
  const phase = useUnifiedGameStore((s) => s.phase);
  const executeGameOperation = useUnifiedGameStore((s) => s.executeGameOperation);
  const chess = useUnifiedGameStore((s) => s.chess);
  const { playMoveSound, playBan } = useChessSounds();

  const canBan = phase === "selecting_ban" && game?.status === "active";
  const canMove = phase === "making_move" && game?.status === "active";
  const enabled = canBan || canMove;

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!enabled) return;
      const raw = value.trim().toLowerCase();
      if (!raw) return;

      // Accept "e2e4" or "e2 e4"
      const match = raw.match(/^([a-h][1-8])\s*([a-h][1-8])$/);
      if (!match) {
        // basic invalid feedback by shaking border color via inline style is overkill; leave minimal
        return;
      }
      const [, from, to] = match;
      const operation = canBan ? "ban" : "move";

      // Pre-play sounds similar to board interactions
      const st = useUnifiedGameStore.getState();
      const isValid = st.isOperationValid?.(operation as any, from as Square, to as Square);
      if (isValid) {
        if (operation === "ban") {
          playBan();
        } else if (operation === "move") {
          try {
            const baseFen = chess?.fen();
            if (baseFen) {
              const sim = new Chess(baseFen);
              const mv = sim.move({ from: from as Square, to: to as Square, promotion: "q" as any });
              if (mv) playMoveSound(mv as any, sim as any);
            }
          } catch {}
        }
      }

      executeGameOperation(operation, from as Square, to as Square, "q");\r
      setValue("");
    },
    [value, canBan, enabled, executeGameOperation]
  );

  if (!game) return null;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={enabled ? "e2e4" : "waiting..."}
        disabled={!enabled}
        style={{
          padding: "8px 12px",
          borderRadius: "4px",
          border: `2px solid ${canBan ? "#ff6b6b" : canMove ? "#4CAF50" : "#666"}`,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: enabled ? "#fff" : "#999",
          fontSize: "14px",
          width: "150px",
          opacity: enabled ? 1 : 0.6,
          cursor: enabled ? "text" : "not-allowed",
        }}
        data-testid="board-move-input"
      />
      {/* Hidden submit to allow Enter key submission without extra buttons */}
      <button type="submit" style={{ display: "none" }} aria-hidden />
    </Box>
  );
}
