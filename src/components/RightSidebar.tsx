import { Box, Typography, IconButton, Tooltip, Button, Chip } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import MoveHistoryV2 from './MoveHistoryV2';
import TimeControl from './TimeControl';
import CachedIcon from '@mui/icons-material/Cached';
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useState } from 'react';
import PlayerPresenceIndicatorV2 from './PlayerPresenceIndicatorV2';

interface RightSidebarProps {
  boardFlipped: boolean;
  onFlipBoard: () => void;
}


export default function RightSidebar({ boardFlipped, onFlipBoard }: RightSidebarProps) {
  const game = useUnifiedGameStore(s => s.game);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const playerUsernames = useUnifiedGameStore(s => s.playerUsernames);
  const isLocalGame = useUnifiedGameStore(s => s.mode === 'local');
  const actions = useUnifiedGameStore(s => s.actions);
  const [confirmAction, setConfirmAction] = useState<'resign' | 'draw' | null>(null);
  
  if (!game) return null;

  // Determine which player is on top based on board orientation
  const topColor = boardFlipped 
    ? (myColor === 'white' ? 'white' : 'black')
    : (myColor === 'white' ? 'black' : 'white');
  const bottomColor = topColor === 'white' ? 'black' : 'white';

  const topUsername = topColor === 'white' ? playerUsernames.white : playerUsernames.black;
  const bottomUsername = bottomColor === 'white' ? playerUsernames.white : playerUsernames.black;

  // Get player status
  const getPlayerStatus = (color: 'white' | 'black') => {
    const presence = color === 'white' ? whitePresence : blackPresence;
    const secondsSince = color === 'white' ? whiteSecondsSinceActive : blackSecondsSinceActive;
    const isCurrentTurn = game.turn === color && game.status === 'active';
    
    if (!presence) return { status: 'unknown', color: '#7a7a7a', icon: null, showTimer: false };
    
    if (secondsSince < 30) {
      return { status: 'online', color: 'success.main', icon: null, showTimer: false };
    } else if (secondsSince < WARNING_THRESHOLD_SECONDS) {
      return { status: 'idle', color: '#ffa726', icon: null, showTimer: false };
    } else if (secondsSince < STALE_THRESHOLD_SECONDS) {
      return { 
        status: 'warning', 
        color: '#ff9800', 
        icon: <ClockIcon fontSize="small" />,
        showTimer: true,
        time: secondsSince 
      };
    } else {
      return { 
        status: 'abandoned', 
        color: 'error.main', 
        icon: <WarningIcon fontSize="small" />,
        showTimer: true,
        time: secondsSince 
      };
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };
  
  const topStatus = getPlayerStatus(topColor);
  const bottomStatus = getPlayerStatus(bottomColor);

  // Draw offer UI
  const renderDrawControls = () => {
    if (!myColor || game.status !== 'active') return null;
    
    const opponentColor = myColor === 'white' ? 'black' : 'white';
    
    if (game.drawOfferedBy === myColor) {
      return (
        <Typography sx={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
          Draw offer sent
        </Typography>
      );
    }
    
    if (game.drawOfferedBy === opponentColor) {
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Accept Draw">
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => actions.acceptDraw()}
              startIcon={<CheckCircleIcon fontSize="small" />}
              sx={{ fontSize: '0.75rem', py: 0.25 }}
            >
              Accept
            </Button>
          </Tooltip>
          <Tooltip title="Decline Draw">
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => actions.declineDraw()}
              startIcon={<CancelIcon fontSize="small" />}
              sx={{ fontSize: '0.75rem', py: 0.25 }}
            >
              Decline
            </Button>
          </Tooltip>
        </Box>
      );
    }
    
    return (
      <Tooltip title={confirmAction === 'draw' ? "Confirm draw offer" : "Offer Draw"}>
        <IconButton 
          size="small" 
          onClick={() => {
            if (confirmAction === 'draw') {
              actions.offerDraw();
              setConfirmAction(null);
            } else {
              setConfirmAction('draw');
              // Auto-cancel confirmation after 3 seconds
              setTimeout(() => {
                setConfirmAction(prev => prev === 'draw' ? null : prev);
              }, 3000);
            }
          }}
          sx={confirmAction === 'draw' ? { 
            color: 'info.dark',
            bgcolor: 'rgba(33,150,243,0.15)',
            '&:hover': {
              bgcolor: 'rgba(33,150,243,0.25)',
            }
          } : {}}
        >
          {confirmAction === 'draw' ? <CheckCircleIcon fontSize="small" /> : <HandshakeIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    );
  };

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
        {/* Player Presence */}
        <PlayerPresenceIndicatorV2
          playerId={topColor === 'white' ? game?.whitePlayerId || '' : game?.blackPlayerId || ''}
          playerColor={topColor}
          isCurrentTurn={game?.turn === topColor}
          playerUsername={topUsername}
          isCurrentUser={myColor === topColor}
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

      {/* Move History (has its own navigation controls at the top) */}
      <Box sx={{ 
        flex: 1,
        minHeight: 0, // Important for scrolling
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 0.5,
        overflow: 'hidden',
      }}>
        <MoveHistoryV2 />
      </Box>

      {/* Game Actions - only show for active games */}
      {game.status === 'active' && myColor && (
        <Box sx={{
          bgcolor: 'rgba(255,255,255,0.03)',
          borderRadius: 0.5,
          p: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
        }}>
          {/* Flip board */}
          <Tooltip title="Flip board">
            <IconButton 
              size="small"
              onClick={onFlipBoard}
              sx={{ 
                bgcolor: boardFlipped ? 'rgba(255,255,255,0.1)' : 'transparent',
                '&:hover': {
                  bgcolor: boardFlipped ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                }
              }}
            >
              <CachedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          {/* Draw controls */}
          {renderDrawControls()}
          
          {/* Resign button */}
          <Tooltip title={confirmAction === 'resign' ? "Confirm resignation" : "Resign"}>
            <IconButton 
              size="small"
              onClick={() => {
                if (confirmAction === 'resign') {
                  actions.resign();
                  setConfirmAction(null);
                } else {
                  setConfirmAction('resign');
                  // Auto-cancel confirmation after 3 seconds
                  setTimeout(() => {
                    setConfirmAction(prev => prev === 'resign' ? null : prev);
                  }, 3000);
                }
              }}
              sx={confirmAction === 'resign' ? { 
                color: 'error.dark',
                bgcolor: 'rgba(255,0,0,0.15)',
                '&:hover': {
                  bgcolor: 'rgba(255,0,0,0.25)',
                }
              } : {
                color: 'error.main',
                '&:hover': {
                  bgcolor: 'rgba(255,0,0,0.1)',
                }
              }}
            >
              {confirmAction === 'resign' ? <CheckCircleIcon fontSize="small" /> : <FlagIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          
          {/* Shared cancel button - appears when any action needs confirmation */}
          {confirmAction && (
            <Tooltip title="Cancel">
              <IconButton
                size="small"
                onClick={() => setConfirmAction(null)}
                sx={{ 
                  ml: 'auto',  // Push to the end of the row
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                  }
                }}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

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
        
        {/* Player Presence */}
        <PlayerPresenceIndicatorV2
          playerId={bottomColor === 'white' ? game?.whitePlayerId || '' : game?.blackPlayerId || ''}
          playerColor={bottomColor}
          isCurrentTurn={game?.turn === bottomColor}
          playerUsername={bottomUsername}
          isCurrentUser={myColor === bottomColor}
        />
      </Box>
    </Box>
  );
}