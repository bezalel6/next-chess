import { Box } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import GamePanel from './GamePanel';
import TimeControl from './TimeControl';
import PlayerStatus from './PlayerStatus';
import { useGamePresence } from '@/services/presenceService';

interface RightSidebarProps {
  boardFlipped: boolean;
  onFlipBoard: () => void;
}


export default function RightSidebar({ boardFlipped, onFlipBoard }: RightSidebarProps) {
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const playerUsernames = useUnifiedGameStore(s => s.playerUsernames);
  const isLocalGame = useUnifiedGameStore(s => s.mode === 'local');
  const { opponentStatus, presenceService } = useGamePresence(game?.id || null);
  
  if (!game) return null;

  // Determine which player is on top based on board orientation
  const topColor = boardFlipped 
    ? (myColor === 'white' ? 'white' : 'black')
    : (myColor === 'white' ? 'black' : 'white');
  const bottomColor = topColor === 'white' ? 'black' : 'white';

  const topUsername = topColor === 'white' ? playerUsernames.white : playerUsernames.black;
  const bottomUsername = bottomColor === 'white' ? playerUsernames.white : playerUsernames.black;

  return (
    <Box sx={{ 
      width: 280,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      height: '100%',
    }}>
      {/* Top Player Info */}
      <Box sx={{
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        p: 1,
      }}>
        {/* Player Status */}
        <PlayerStatus
          username={topUsername || 'Player'}
          color={topColor}
          status={myColor === topColor ? 'online' : opponentStatus}
          isCurrentTurn={game?.turn === topColor}
        />
        
        {/* Time display */}
        <Box sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          borderRadius: 0.5,
          p: 1,
          mt: 0.5,
        }}>
          <TimeControl playerColor={topColor} />
        </Box>
      </Box>

      {/* Game Panel - Contains move history, navigation, and game actions */}
      <Box sx={{ 
        flex: 1,
        minHeight: 0, // Important for scrolling
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        overflow: 'hidden',
      }}>
        <GamePanel />
      </Box>

      {/* Bottom Player Info */}
      <Box sx={{
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        p: 1,
      }}>
        {/* Time display */}
        <Box sx={{
          bgcolor: 'rgba(0,0,0,0.3)',
          borderRadius: 0.5,
          p: 1,
          mb: 0.5,
        }}>
          <TimeControl playerColor={bottomColor} />
        </Box>
        
        {/* Player Status */}
        <PlayerStatus
          username={bottomUsername || 'Player'}
          color={bottomColor}
          status={myColor === bottomColor ? 'online' : opponentStatus}
          isCurrentTurn={game?.turn === bottomColor}
        />
      </Box>
    </Box>
  );
}