import { Box, Paper, Typography, Chip, Divider } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import FlagIcon from '@mui/icons-material/Flag';

export default function LocalGameStatus() {
  const game = useUnifiedGameStore(s => s.game);
  const phase = useUnifiedGameStore(s => s.phase);
  const currentBannedMove = useUnifiedGameStore(s => s.currentBannedMove);
  const moveHistory = useUnifiedGameStore(s => s.moveHistory);
  
  if (!game) return null;
  
  // Determine whose action it is
  // In Ban Chess: Black bans first, then White moves, then White bans, then Black moves
  const getActivePlayer = () => {
    if (phase === 'selecting_ban') {
      // During ban phase, the banning player is active
      return game.banningPlayer === 'white' ? 'White' : 'Black';
    } else if (phase === 'making_move') {
      // During move phase, the player whose turn it is moves
      return game.turn === 'white' ? 'White' : 'Black';
    }
    return 'N/A';
  };
  
  const getPhaseLabel = () => {
    switch (phase) {
      case 'selecting_ban':
        return 'Selecting Ban';
      case 'making_move':
        return 'Making Move';
      case 'game_over':
        return 'Game Over';
      default:
        return 'Unknown';
    }
  };
  
  const getPhaseColor = () => {
    switch (phase) {
      case 'selecting_ban':
        return 'error';
      case 'making_move':
        return 'success';
      case 'game_over':
        return 'default';
      default:
        return 'default';
    }
  };
  
  const getPhaseIcon = () => {
    switch (phase) {
      case 'selecting_ban':
        return <BlockIcon fontSize="small" />;
      case 'making_move':
        return <SportsEsportsIcon fontSize="small" />;
      case 'game_over':
        return <FlagIcon fontSize="small" />;
      default:
        return null;
    }
  };
  
  // Count moves - in the beginning there are no moves yet
  const moveCount = moveHistory.length;
  
  return (
    <Paper sx={{ 
      p: 2, 
      bgcolor: '#2e2a24',
      border: 'none',
      color: '#bababa',
    }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon fontSize="small" />
        Game Status
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Current Phase */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Phase
          </Typography>
          <Chip 
            label={getPhaseLabel()}
            color={getPhaseColor()}
            size="small"
            icon={getPhaseIcon()}
            sx={{ mt: 0.5 }}
          />
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        {/* Active Player */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Active Player
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {getActivePlayer()}
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        {/* Current Turn */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Chess Turn
          </Typography>
          <Typography variant="body2">
            {game.turn === 'white' ? 'White' : 'Black'} to move
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        {/* Banning Player */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Banning Player
          </Typography>
          <Typography variant="body2">
            {game.banningPlayer ? (
              <>{game.banningPlayer === 'white' ? 'White' : 'Black'} is banning</>
            ) : (
              'No one (move phase)'
            )}
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        {/* Current Banned Move */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Banned Move
          </Typography>
          <Typography variant="body2" sx={{ color: currentBannedMove ? '#ff6b6b' : 'inherit' }}>
            {currentBannedMove ? `${currentBannedMove.from}${currentBannedMove.to}` : 'None'}
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        {/* Move Count */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Ply Count
          </Typography>
          <Typography variant="body2">
            {moveCount === 0 ? 'Game Start' : moveCount}
          </Typography>
        </Box>
        
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        
        {/* Game Status */}
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Game Status
          </Typography>
          <Typography variant="body2" sx={{ 
            color: game.status === 'active' ? '#4caf50' : 
                   game.status === 'finished' ? '#ff6b6b' : 
                   'inherit' 
          }}>
            {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}