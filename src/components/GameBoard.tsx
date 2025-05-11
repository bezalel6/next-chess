import { Box, Typography } from "@mui/material";
import LichessBoard from "./lichess-board";
import { useGame } from "@/contexts/GameContext";
import GameOverOverlay from "./GameOverOverlay";

const GameBoard = () => {
  const { game, myColor, playerUsernames } = useGame();

  // Determine which username to display for opponent and current player
  const opponentName = myColor === 'white' ? playerUsernames.black : playerUsernames.white;
  const myName = myColor === 'white' ? playerUsernames.white : playerUsernames.black;

  // Get current turn player name
  const currentTurnName = game?.turn === 'white' ? playerUsernames.white : playerUsernames.black;
  function Status() {
    return <>
      {game.banningPlayer && myColor === game.banningPlayer && <Typography sx={{ color: 'white' }}>
        Select a move to ban for your opponent
      </Typography>}
      <Typography sx={{ color: 'white' }}>
        Status: {game.status} • Current Turn: {currentTurnName} ({game.turn})
      </Typography>
    </>
  }
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
      </Box>
      {game.status === 'finished' && <GameOverOverlay />}

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
        flexDirection: "column",
        justifyContent: 'center',
        alignItems: 'center',
        p: 1,
        bgcolor: 'rgba(255,255,255,0.05)',
        borderRadius: 1
      }}>
        <Status />
      </Box>
    </Box>
  );
};

export default GameBoard; 