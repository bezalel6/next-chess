import { Box, Typography, IconButton, Tooltip, Button, Chip } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useGameActions } from '@/hooks/useGameActions';
import MoveHistoryV2 from './MoveHistoryV2';
import TimeControl from './TimeControl';
import ConfirmActionButton from './ConfirmActionButton';
import CachedIcon from '@mui/icons-material/Cached';
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
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
  const actions = useGameActions();
  const { opponentStatus, presenceService } = useGamePresence(game?.id || null);
  
  if (!game) return null;

  // Determine which player is on top based on board orientation
  const topColor = boardFlipped 
    ? (myColor === 'white' ? 'white' : 'black')
    : (myColor === 'white' ? 'black' : 'white');
  const bottomColor = topColor === 'white' ? 'black' : 'white';

  const topUsername = topColor === 'white' ? playerUsernames.white : playerUsernames.black;
  const bottomUsername = bottomColor === 'white' ? playerUsernames.white : playerUsernames.black;


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
      <ConfirmActionButton
        icon={<HandshakeIcon fontSize="small" />}
        tooltip="Offer Draw"
        confirmTooltip="Confirm draw offer"
        onConfirm={actions.offerDraw}
        color="info"
      />
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
          <ConfirmActionButton
            icon={<FlagIcon fontSize="small" />}
            tooltip="Resign"
            confirmTooltip="Confirm resignation"
            onConfirm={actions.resign}
            color="error"
          />
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