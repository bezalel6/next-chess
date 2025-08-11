import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import { useGame } from '@/contexts/GameContextV2';
import { useGameStore } from '@/stores/gameStore';
import LichessBoardV2 from './LichessBoardV2';
import BanPhaseOverlay from './BanPhaseOverlay';
import BanTimeline from './BanTimeline';
import TimeControl from './TimeControl';
import GameOverOverlay from './GameOverOverlay';
import CachedIcon from '@mui/icons-material/Cached';
import ShareIcon from '@mui/icons-material/Share';
import ResignIcon from '@mui/icons-material/FlagOutlined';
import DrawIcon from '@mui/icons-material/Handshake';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function GameBoardV2() {
  const { game, myColor, isMyTurn, canBan, canMove, resign, offerDraw } = useGame();
  const { phase, currentBannedMove } = useGameStore();
  const [boardFlipped, setBoardFlipped] = useState(false);
  
  if (!game) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h5" sx={{ color: 'text.secondary' }}>
          Loading game...
        </Typography>
      </Box>
    );
  }

  const orientation = boardFlipped 
    ? (myColor === 'white' ? 'black' : 'white')
    : (myColor || 'white');

  return (
    <Box sx={{ display: 'flex', gap: 3, p: 2, maxWidth: 1400, mx: 'auto' }}>
      {/* Left sidebar - Ban Timeline */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <BanTimeline />
      </Box>

      {/* Center - Game Board */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Opponent info */}
        <Paper
          sx={{
            width: '100%',
            maxWidth: 560,
            p: 1.5,
            mb: 1,
            bgcolor: 'background.paper',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: 'success.main' 
            }} />
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              Opponent
            </Typography>
          </Box>
          <TimeControl 
            playerColor="black"
          />
        </Paper>

        {/* Board container with ban overlay */}
        <Box sx={{ position: 'relative', width: '100%', maxWidth: 560 }}>
          <BanPhaseOverlay 
            isMyTurnToBan={canBan}
            timeRemaining={30} // TODO: Get from actual timer
          />
          
          <motion.div
            animate={{ rotateY: boardFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <LichessBoardV2 orientation={orientation} />
          </motion.div>

          {game.status === 'finished' && (
            <GameOverOverlay />
          )}
        </Box>

        {/* Player info */}
        <Paper
          sx={{
            width: '100%',
            maxWidth: 560,
            p: 1.5,
            mt: 1,
            bgcolor: 'background.paper',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: 'primary.main' 
            }} />
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              You ({myColor})
            </Typography>
          </Box>
          <TimeControl 
            playerColor="white"
          />
        </Paper>

        {/* Board controls */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          mt: 2,
          width: '100%',
          maxWidth: 560,
          justifyContent: 'center',
        }}>
          <Tooltip title="Flip board">
            <IconButton 
              onClick={() => setBoardFlipped(!boardFlipped)}
              sx={{ 
                bgcolor: boardFlipped ? 'action.selected' : 'background.paper',
              }}
            >
              <CachedIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Offer draw">
            <IconButton 
              onClick={offerDraw}
              disabled={game.status !== 'active'}
            >
              <DrawIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Resign">
            <IconButton 
              onClick={resign}
              disabled={game.status !== 'active'}
              sx={{ color: 'error.main' }}
            >
              <ResignIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Share game">
            <IconButton onClick={() => navigator.clipboard.writeText(window.location.href)}>
              <ShareIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Right sidebar - Move History */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {/* We'll add move history component here */}
      </Box>
    </Box>
  );
}