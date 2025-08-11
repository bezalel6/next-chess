import { Box, Paper, Typography, Chip, Divider } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import BlockIcon from '@mui/icons-material/Block';
import { useMemo } from 'react';

export default function BanTimeline() {
  const { banHistory, moveHistory } = useGameStore();
  
  // Combine moves and bans into a single timeline
  const timeline = useMemo(() => {
    const events: Array<{
      type: 'move' | 'ban';
      data: any;
      moveNumber: number;
      player: 'white' | 'black';
    }> = [];
    
    moveHistory.forEach((move, idx) => {
      const moveNumber = Math.floor(idx / 2) + 1;
      const player = idx % 2 === 0 ? 'white' : 'black';
      
      // Add ban that happened before this move
      const ban = banHistory.find(b => b.atMoveNumber === moveNumber && b.byPlayer !== player);
      if (ban) {
        events.push({
          type: 'ban',
          data: ban,
          moveNumber,
          player: ban.byPlayer,
        });
      }
      
      // Add the move
      events.push({
        type: 'move',
        data: move,
        moveNumber,
        player,
      });
    });
    
    return events.slice(-10); // Show last 10 events
  }, [banHistory, moveHistory]);
  
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        maxHeight: 400,
        overflowY: 'auto',
        width: 280,
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
        Ban Timeline
      </Typography>
      
      <AnimatePresence mode="popLayout">
        {timeline.map((event, idx) => (
          <motion.div
            key={`${event.type}-${idx}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: event.type === 'ban' 
                  ? 'error.main' 
                  : event.player === 'white' 
                    ? 'grey.100' 
                    : 'grey.900',
                color: event.type === 'ban' 
                  ? 'error.contrastText'
                  : event.player === 'white'
                    ? 'grey.900'
                    : 'grey.100',
              }}
            >
              {event.type === 'ban' ? (
                <>
                  <BlockIcon sx={{ fontSize: 16 }} />
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {event.data.byPlayer === 'white' ? 'W' : 'B'} banned
                  </Typography>
                  <Chip
                    label={`${event.data.from}${event.data.to}`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'inherit',
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                    }}
                  />
                </>
              ) : (
                <>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 20 }}>
                    {event.moveNumber}.
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {event.data.san}
                  </Typography>
                </>
              )}
            </Box>
            
            {idx < timeline.length - 1 && (
              <Box
                sx={{
                  width: 2,
                  height: 20,
                  bgcolor: 'divider',
                  mx: 'auto',
                  my: 0.5,
                }}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      
      {timeline.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
          No moves yet
        </Typography>
      )}
    </Paper>
  );
}