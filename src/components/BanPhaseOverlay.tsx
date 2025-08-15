import { motion, AnimatePresence } from "framer-motion";
import { Box, Typography, Chip } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import BlockIcon from "@mui/icons-material/Block";

interface BanPhaseOverlayProps {
  isMyTurnToBan: boolean;
}

export default function BanPhaseOverlay({
  isMyTurnToBan,
}: BanPhaseOverlayProps) {
  const phase = useUnifiedGameStore(s => s.phase);
  const game = useUnifiedGameStore(s => s.game);

  const isBanPhase = phase === "selecting_ban" || phase === "waiting_for_ban";

  return (
    <AnimatePresence mode="wait">
      {/* Ban Phase Indicator */}
      {isBanPhase && (
        <motion.div
          key="ban-phase-indicator"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: -110, // Further increased spacing to prevent clipping
            left: 0,
            right: 0,
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box
            data-testid="ban-phase-indicator"
            sx={{
              bgcolor: isMyTurnToBan ? "error.main" : "background.paper",
              color: isMyTurnToBan ? "error.contrastText" : "text.primary",
              px: 3,
              py: 1.5,
              borderRadius: 2,
              boxShadow: 4,
              display: "flex",
              alignItems: "center",
              gap: 2,
              border: "2px solid",
              borderColor: isMyTurnToBan ? "error.dark" : "divider",
            }}
          >
            <BlockIcon sx={{ fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              {isMyTurnToBan
                ? "Select opponent's move to ban"
                : "Opponent is selecting a move to ban..."}
            </Typography>
          </Box>
        </motion.div>
      )}

      {/* Current Ban Indicator (shows after ban is applied, during move phase) */}
      {game?.currentBannedMove && phase === "making_move" && (
        <motion.div
          key="current-ban-indicator"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 90,
          }}
        >
          <Chip
            icon={<BlockIcon />}
            label={`Banned: ${game.currentBannedMove.from}${game.currentBannedMove.to}`}
            color="error"
            variant="filled"
            sx={{
              fontWeight: "bold",
              boxShadow: 2,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
