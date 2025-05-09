import { Box, Typography } from "@mui/material";
import LichessBoard from "./lichess-board";
import { useGame } from "@/contexts/GameContext";
import GameOverOverlay from "./GameOverOverlay";

const GameBoard = () => {
  const { game, myColor } = useGame();
  
  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1
    }}>
      {/* Opponent info */}
      <Box sx={{ 
        width: '100%',
        maxWidth: 800,
        mb: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Typography sx={{ color: 'white' }}>
          {myColor === 'white' ? 'Opponent' : 'Player 1'}
        </Typography>
      </Box>
      
      {/* Chess board */}
      <Box sx={{ 
        width: '80%',
        maxWidth: 600,
        aspectRatio: '1/1',
        position: 'relative'
      }}>
        <LichessBoard />
        
        {/* Game over overlay */}
        {game.status === 'finished' && <GameOverOverlay />}
      </Box>
      
      {/* Player info */}
      <Box sx={{ 
        width: '100%',
        maxWidth: 800,
        mt: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Typography sx={{ color: 'white' }}>
          {myColor === 'black' ? 'Opponent' : 'Player 2'}
        </Typography>
      </Box>
      
      {/* Game Status */}
      <Box sx={{
        width: '100%',
        maxWidth: 800,
        mt: 3,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 1,
        bgcolor: 'rgba(255,255,255,0.05)',
        borderRadius: 1
      }}>
        <Typography sx={{ color: 'white' }}>
          Status: {game.status} • Turn: {game.turn} 
        </Typography>
      </Box>
    </Box>
  );
};

export default GameBoard; 