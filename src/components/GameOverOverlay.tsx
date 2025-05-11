import { Box, Typography, Button } from "@mui/material";
import { useGame } from "@/contexts/GameContext";
import { useMemo } from "react";

const GameOverOverlay = () => {
  const { game, myColor, resetGame, playerUsernames } = useGame();

  // Generate the game result message based on result and player's color
  const gameResultInfo = useMemo(() => {
    if (!game || game.status !== 'finished') return null;

    let resultHeader = '';
    let resultDetail = '';
    let personalMessage = '';

    // Determine the result header (objective statement)
    if (game.result === 'white') {
      resultHeader = `${playerUsernames.white} won`;
      resultDetail = game.chess.inCheckmate() ? 'by checkmate' : 'by resignation';
    } else if (game.result === 'black') {
      resultHeader = `${playerUsernames.black} won`;
      resultDetail = game.chess.inCheckmate() ? 'by checkmate' : 'by resignation';
    } else {
      resultHeader = 'Game drawn';
      if (game.chess.inStalemate()) {
        resultDetail = 'by stalemate';
      } else if (game.chess.insufficientMaterial()) {
        resultDetail = 'by insufficient material';
      } else if (game.chess.inThreefoldRepetition()) {
        resultDetail = 'by threefold repetition';
      } else if (game.chess.inDraw()) {
        resultDetail = 'by 50-move rule';
      } else {
        resultDetail = 'by agreement';
      }
    }

    // Determine the personal message based on player's color and result
    if (myColor) {
      const opponentName = myColor === 'white' ? playerUsernames.black : playerUsernames.white;
      const isWinner = (myColor === 'white' && game.result === 'white') ||
        (myColor === 'black' && game.result === 'black');

      if (isWinner) {
        personalMessage = `Congratulations! You defeated ${opponentName}.`;
      } else if (game.result === 'draw') {
        personalMessage = `The game ended in a draw between you and ${opponentName}.`;
      } else {
        personalMessage = `Better luck next time against ${opponentName}!`;
      }
    } else {
      // Message for spectators
      personalMessage = `Game between ${playerUsernames.white} and ${playerUsernames.black} has ended.`;
    }

    return { resultHeader, resultDetail, personalMessage };
  }, [game, myColor, playerUsernames]);

  if (!gameResultInfo) return null;

  return (
    <Box sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 2,
      padding: 3,
      textAlign: 'center',
      backdropFilter: 'blur(4px)',
      zIndex: 100,
    }}>
      <Typography variant="h4" sx={{
        color: 'white',
        fontWeight: 'bold',
        mb: 1
      }}>
        Game Over
      </Typography>

      <Typography variant="h6" sx={{
        color: 'white',
        mb: 1
      }}>
        {gameResultInfo.resultHeader} {gameResultInfo.resultDetail}
      </Typography>

      <Typography variant="body1" sx={{
        color: 'white',
        mb: 3,
        opacity: 0.9
      }}>
        {gameResultInfo.personalMessage}
      </Typography>

      <Button
        variant="contained"
        color="primary"
        onClick={resetGame}
        sx={{
          mt: 2,
          textTransform: 'none'
        }}
      >
        Return Home
      </Button>
    </Box>
  );
};

export default GameOverOverlay; 