import { Box, Typography } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import GamePanel from './GamePanel';
import { SingleClock } from './GameClock';

interface RightSidebarProps {
  boardFlipped: boolean;
  onFlipBoard: () => void;
}


export default function RightSidebar({ boardFlipped, onFlipBoard }: RightSidebarProps) {
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const playerUsernames = useUnifiedGameStore(s => s.playerUsernames);
  const isLocalGame = useUnifiedGameStore(s => s.mode === 'local');
  const opponentStatus = 'online' as const;
  
  // Simplified: rely on server times embedded in game (if present); no client clock sync
  const clock = {
    activeColor: game?.turn || 'white',
    white: { timeRemaining: game?.whiteTimeRemaining ?? game?.timeControl?.initialTime ?? 600000 },
    black: { timeRemaining: game?.blackTimeRemaining ?? game?.timeControl?.initialTime ?? 600000 },
  } as const;
  
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
      width: 320,
      display: 'flex',
      flexDirection: 'column',
      height: 'fit-content',
      alignSelf: 'center',
      
      bgcolor: '#262522',
      borderRadius: '0 8px 8px 0',
    }}>
      {/* Top Player - Opponent */}
      <Box sx={{
        width: '100%',
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: opponentStatus === 'online' ? '#629924' : '#666',
          }} />
          <Typography sx={{ 
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 500,
          }}>
            {topUsername || 'Opponent'}
          </Typography>
          <Typography sx={{ 
            color: '#999',
            fontSize: '0.9rem',
            ml: 'auto',
          }}>
            (69420)
          </Typography>
        </Box>
        
        {/* Clock */}
        {game?.timeControl && (
          <Box sx={{
            bgcolor: game?.turn === topColor ? '#3e3b37' : 'transparent',
            borderRadius: 1,
            p: 0.5,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <SingleClock
              color={topColor}
              timeControl={game.timeControl}
              isActive={clock.activeColor === topColor}
              isMyTurn={myColor === topColor}
              serverClock={{
                timeRemaining: topColor === 'white' ? clock.white.timeRemaining : clock.black.timeRemaining,
                turnStartTime: null,
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

      {/* Game Panel - Move History Table */}
      <Box sx={{ 
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        overflow: 'hidden',
        display: 'flex',
      }}>
        <GamePanel />
      </Box>

      {/* Bottom Player - Current Player */}
      <Box sx={{
        width: '100%',
        p: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Clock */}
        {game?.timeControl && (
          <Box sx={{
            bgcolor: game?.turn === bottomColor ? '#3e3b37' : 'transparent',
            borderRadius: 1,
            p: 0.5,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <SingleClock
              color={bottomColor}
              timeControl={game.timeControl}
              isActive={clock.activeColor === bottomColor}
              isMyTurn={myColor === bottomColor}
              serverClock={{
                timeRemaining: bottomColor === 'white' ? clock.white.timeRemaining : clock.black.timeRemaining,
                turnStartTime: null,
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
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: '#629924',
          }} />
          <Typography sx={{ 
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 500,
          }}>
            {bottomUsername || 'You'}
          </Typography>
          <Typography sx={{ 
            color: '#999',
            fontSize: '0.9rem',
            ml: 'auto',
          }}>
            (69420)
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}