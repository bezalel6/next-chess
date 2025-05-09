import { Box, Typography } from "@mui/material";
import LichessBoard from "./lichess-board";
import { useGame } from "@/contexts/GameContext";
import GameOverOverlay from "./GameOverOverlay";
import { useState, useEffect } from "react";
import { UserService } from "@/services/userService";

const GameBoard = () => {
  const { game, myColor } = useGame();
  const [playerNames, setPlayerNames] = useState<{
    white: string;
    black: string;
  }>({
    white: "White Player",
    black: "Black Player",
  });
  
  // Fetch player usernames when game data changes
  useEffect(() => {
    if (!game) return;
    
    const fetchUsernames = async () => {
      try {
        const usernames = await UserService.getUsernamesByIds([
          game.whitePlayer,
          game.blackPlayer
        ]);
        
        setPlayerNames({
          white: usernames[game.whitePlayer] || "White Player",
          black: usernames[game.blackPlayer] || "Black Player"
        });
      } catch (error) {
        console.error("Error fetching player usernames:", error);
      }
    };
    
    fetchUsernames();
  }, [game]);
  
  // Determine which username to display for opponent and current player
  const opponentName = myColor === 'white' ? playerNames.black : playerNames.white;
  const myName = myColor === 'white' ? playerNames.white : playerNames.black;
  
  // Get current turn player name
  const currentTurnName = game?.turn === 'white' ? playerNames.white : playerNames.black;
  
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
          {opponentName}
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
          {myName}
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
          Status: {game.status} • Current Turn: {currentTurnName} ({game.turn})
        </Typography>
      </Box>
    </Box>
  );
};

export default GameBoard; 