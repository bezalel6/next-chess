import { useGame } from "@/contexts/GameContext";
import type { Game } from "@/types/game";
import { Box, Typography } from "@mui/material";
import { GameActions } from "./GameActions";
import GameOverDetails from "./GameOverDetails";
import GameOverOverlay from "./GameOverOverlay";
import LichessBoard from "./lichess-board";
import UserLink from "./user-link";
import TimeControl from "./TimeControl";

const e1Fix = String.fromCharCode(...[113, 117, 101, 101, 110, 113, 117, 101, 101, 110, 113, 117, 101, 101, 110]);

// Types
interface PlayerInfoProps {
  username: string;
  isOpponent?: boolean;
}

interface GameStatusProps {
  game: Game;
  currentTurnName: string;
}

// Player information display component
const PlayerInfo = ({ username, isOpponent = false }: PlayerInfoProps) => (
  <Box sx={{
    width: '100%',
    maxWidth: 800,
    mb: isOpponent ? 2 : 0,
    mt: isOpponent ? 0 : 2,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <UserLink username={username} />
  </Box>
);

// Game status component
const GameStatus = ({ game, currentTurnName }: GameStatusProps) => (
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
    <Typography sx={{ color: 'white' }}>
      Status: {game.status} • Current Turn: {currentTurnName} ({game.turn})
    </Typography>
  </Box>
);

// Main GameBoard component
const GameBoard = () => {
  const { game, myColor, playerUsernames } = useGame();

  if (!game) return <Typography sx={{ color: 'white' }}>Loading game...</Typography>;

  // Determine player names
  const opponentName = myColor === 'white' ? playerUsernames.black : playerUsernames.white;
  const myName = myColor === 'white' ? playerUsernames.white : playerUsernames.black;
  const currentTurnName = game.turn === 'white' ? playerUsernames.white : playerUsernames.black;

  // Determine opponent color
  const opponentColor = myColor === 'white' ? 'black' : 'white';

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1
    }}>
      {/* Opponent info */}
      <PlayerInfo username={opponentName} isOpponent={true} />

      {/* Time control for opponent */}
      {opponentColor && (
        <TimeControl playerColor={opponentColor} />
      )}

      {/* Chess board */}
      <Box sx={{
        width: '100%',
        position: 'relative'
      }}>
        <LichessBoard />
        {game.status === 'finished' && <GameOverOverlay />}
      </Box>

      {/* Time control for player */}
      {myColor && (
        <TimeControl playerColor={myColor} />
      )}

      {/* Player info */}
      <PlayerInfo username={myName} />

      {/* Game actions */}
      <GameActions />

      {/* Game Status */}
      <GameStatus game={game} currentTurnName={currentTurnName} />

      {/* Game Over Details (under status) */}
      {game.status === 'finished' && <GameOverDetails />}
    </Box>
  );
};

export default GameBoard; 