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
  const showCurrentBan = game?.currentBannedMove && phase === "making_move";

  return (
    <Box
      sx={{
        height: 80, // Fixed height to prevent layout shifts
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        marginBottom: 2, // Space between banner and board
      }}
    >
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
              display: "flex",
              justifyContent: "center",
              width: "100%",
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
        {showCurrentBan && (
          <motion.div
            key="current-ban-indicator"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
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
    </Box>
  );
}
