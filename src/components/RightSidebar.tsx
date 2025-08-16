import { Box } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import GamePanel from './GamePanel';
import { SingleClock } from './GameClock';
import PlayerStatus from './PlayerStatus';
import { useGamePresence } from '@/services/presenceService';
import { useClockSync } from '@/hooks/useClockSync';

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
  
  // Use clock synchronization hook
  const { clock, isConnected } = useClockSync({
    gameId: game?.id || '',
    timeControl: game?.timeControl || { initialTime: 600000, increment: 0 },
    myColor,
    enabled: !!game?.id && !!game?.timeControl,
  });
  
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
      width: 250,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.5,
      height: '100%',
      ml: 1,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Top Player Info */}
      <Box sx={{
        width: '100%',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        p: 0.75,
        flexShrink: 0,
      }}>
        {/* Player Status */}
        <PlayerStatus
          username={topUsername || 'Player'}
          color={topColor}
          status={myColor === topColor ? 'online' : opponentStatus}
          isCurrentTurn={game?.turn === topColor}
        />
        
        {/* Time display */}
        {game?.timeControl && (
          <Box sx={{
            bgcolor: 'rgba(0,0,0,0.3)',
            borderRadius: 0.5,
            p: 0.5,
            mt: 0.25,
          }}>
            <SingleClock
              color={topColor}
              timeControl={game.timeControl}
              isActive={clock.activeColor === topColor}
              isMyTurn={myColor === topColor}
              serverClock={{
                timeRemaining: topColor === 'white' ? clock.white.timeRemaining : clock.black.timeRemaining,
                turnStartTime: clock.activeColor === topColor ? Date.now() : null,
                lastUpdateTime: Date.now(),
                isRunning: clock.activeColor === topColor,
              }}
              preferences={{
                showTenths: true,
                showProgressBar: false,
                soundEnabled: false,
              }}
            />
          </Box>
        )}
      </Box>

      {/* Game Panel - Contains move history, navigation, and game actions - centered */}
      <Box sx={{ 
        width: '100%',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        overflow: 'hidden',
        display: 'flex',
        flexShrink: 0,
      }}>
        <GamePanel />
      </Box>

      {/* Bottom Player Info */}
      <Box sx={{
        width: '100%',
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        p: 0.75,
        flexShrink: 0,
      }}>
        {/* Time display */}
        {game?.timeControl && (
          <Box sx={{
            bgcolor: 'rgba(0,0,0,0.3)',
            borderRadius: 0.5,
            p: 0.5,
            mb: 0.25,
          }}>
            <SingleClock
              color={bottomColor}
              timeControl={game.timeControl}
              isActive={clock.activeColor === bottomColor}
              isMyTurn={myColor === bottomColor}
              serverClock={{
                timeRemaining: bottomColor === 'white' ? clock.white.timeRemaining : clock.black.timeRemaining,
                turnStartTime: clock.activeColor === bottomColor ? Date.now() : null,
                lastUpdateTime: Date.now(),
                isRunning: clock.activeColor === bottomColor,
              }}
              preferences={{
                showTenths: true,
                showProgressBar: false,
                soundEnabled: false,
              }}
            />
          </Box>
        )}
        
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