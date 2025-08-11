import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, Chip, LinearProgress } from '@mui/material';
import { useGameStore } from '@/stores/gameStore';
import { useEffect, useState } from 'react';
import BlockIcon from '@mui/icons-material/Block';
import TimerIcon from '@mui/icons-material/Timer';

interface BanPhaseOverlayProps {
  timeRemaining?: number;
  isMyTurnToBan: boolean;
}

export default function BanPhaseOverlay({ timeRemaining, isMyTurnToBan }: BanPhaseOverlayProps) {
  const { phase, currentBannedMove, optimisticBan } = useGameStore();
  const [showBanAnimation, setShowBanAnimation] = useState(false);
  
  // Show ban animation when a ban is confirmed
  useEffect(() => {
    if (optimisticBan) {
      setShowBanAnimation(true);
      setTimeout(() => setShowBanAnimation(false), 1500);
    }
  }, [optimisticBan]);

  const isBanPhase = phase === 'selecting_ban' || phase === 'waiting_for_ban';
  
  return (
    <AnimatePresence mode="wait">
      {/* Ban Phase Indicator */}
      {isBanPhase && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: -60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box
            data-testid="ban-phase-indicator"
            sx={{
              bgcolor: isMyTurnToBan ? 'error.main' : 'background.paper',
              color: isMyTurnToBan ? 'error.contrastText' : 'text.primary',
              px: 3,
              py: 1.5,
              borderRadius: 2,
              boxShadow: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              border: '2px solid',
              borderColor: isMyTurnToBan ? 'error.dark' : 'divider',
            }}
          >
            <BlockIcon sx={{ fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {isMyTurnToBan 
                ? "Select opponent's move to ban" 
                : "Opponent is selecting a move to ban..."}
            </Typography>
            {timeRemaining && (
              <Chip
                icon={<TimerIcon />}
                label={`${Math.ceil(timeRemaining)}s`}
                color={timeRemaining < 10 ? 'error' : 'default'}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
            )}
          </Box>
        </motion.div>
      )}

      {/* Ban Animation */}
      {showBanAnimation && optimisticBan && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'backOut' }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              bgcolor: 'error.main',
              color: 'white',
              p: 3,
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 150,
              height: 150,
              boxShadow: '0 0 40px rgba(255,0,0,0.5)',
            }}
          >
            <BlockIcon sx={{ fontSize: 60, mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              BANNED
            </Typography>
            <Typography variant="body2">
              {optimisticBan.from}{optimisticBan.to}
            </Typography>
          </Box>
        </motion.div>
      )}

      {/* Current Ban Indicator (shows after ban is applied) */}
      {currentBannedMove && !isBanPhase && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 90,
          }}
        >
          <Chip
            icon={<BlockIcon />}
            label={`Banned: ${currentBannedMove.from}${currentBannedMove.to}`}
            color="error"
            variant="filled"
            sx={{ 
              fontWeight: 'bold',
              boxShadow: 2,
            }}
          />
        </motion.div>
      )}

      {/* Progress bar for ban timer */}
      {isBanPhase && timeRemaining && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            bgcolor: 'background.paper',
          }}
        >
          <LinearProgress
            variant="determinate"
            value={(timeRemaining / 30) * 100} // Assuming 30s ban timer
            color={isMyTurnToBan ? 'error' : 'primary'}
            sx={{ height: '100%' }}
          />
        </Box>
      )}
    </AnimatePresence>
  );
}