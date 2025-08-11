import { useGame } from "@/contexts/GameContext";
import type { Game } from "@/types/game";
import { Box, Typography, Alert, Paper, Chip, IconButton, Tooltip } from "@mui/material";
import { GameActions } from "./GameActions";
import GameOverDetails from "./GameOverDetails";
import GameOverOverlay from "./GameOverOverlay";
import LichessBoard from "./lichess-board";
import UserLink from "./user-link";
import TimeControl from "./TimeControl";
import CachedIcon from '@mui/icons-material/Cached';
import ShareIcon from '@mui/icons-material/Share';
import TuneIcon from '@mui/icons-material/Tune';

const e1Fix = String.fromCharCode(
  ...[
    113, 117, 101, 101, 110, 113, 117, 101, 101, 110, 113, 117, 101, 101, 110,
  ],
);

// Types
interface PlayerInfoProps {
  username: string;
  isOpponent?: boolean;
}

interface GameStatusProps {
  game: Game;
  currentTurnName: string;
  myColor: "white" | "black" | null;
}

// Player card component - Lichess style with integrated time
const PlayerCard = ({ 
  username, 
  isOpponent = false, 
  rating = 1956,
  timeLeft,
  isCurrentTurn,
  color
}: PlayerInfoProps & { 
  rating?: number; 
  timeLeft?: string;
  isCurrentTurn?: boolean;
  color: 'white' | 'black';
}) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      p: 1.5,
      bgcolor: isCurrentTurn ? "rgba(255,255,255,0.06)" : "transparent",
      borderRadius: 0,
      minHeight: 56,
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ 
        width: 10, 
        height: 10, 
        borderRadius: "50%", 
        bgcolor: "#76ff03",
      }} />
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography sx={{ color: "#bababa", fontWeight: 500, fontSize: '1rem' }}>
          {username}
        </Typography>
        <Typography sx={{ color: "#888", fontSize: "0.9rem" }}>
          {rating}
        </Typography>
      </Box>
    </Box>
    {timeLeft && (
      <Typography sx={{ 
        fontFamily: 'monospace',
        fontSize: '1.8rem',
        fontWeight: isCurrentTurn ? 700 : 400,
        color: isCurrentTurn ? '#fff' : '#bababa',
        letterSpacing: '0.05em',
      }}>
        {timeLeft}
      </Typography>
    )}
  </Box>
);

// Game status component
const GameStatus = ({ game, currentTurnName, myColor }: GameStatusProps) => {
  const isBanPhase = game.banningPlayer !== null;

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 800,
        mt: 3,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        p: 1,
        bgcolor: "rgba(255,255,255,0.05)",
        borderRadius: 1,
      }}
    >
      <Typography sx={{ color: "white" }}>
        Status: {game.status} •{" "}
        {isBanPhase ? (
          <span
            style={{
              color: "#ff9800",
              fontWeight: "bold",
            }}
          >
            🚫 {game.banningPlayer === "white" ? "White" : "Black"} is selecting a move to ban
          </span>
        ) : (
          <>
            Current Turn: {currentTurnName} ({game.turn})
          </>
        )}
      </Typography>
    </Box>
  );
};

// Main GameBoard component
const GameBoard = () => {
  const { game, myColor, playerUsernames, isLocalGame, localGameOrientation, actions } =
    useGame();
  const isSpectator = !myColor && !isLocalGame;

  if (!game)
    return <Typography sx={{ color: "white" }}>Loading game...</Typography>;

  // Determine player names
  const opponentName = isLocalGame
    ? (localGameOrientation === "white" ? "Black" : "White")
    : myColor === "white"
      ? playerUsernames.black
      : playerUsernames.white;
  const myName = isLocalGame
    ? (localGameOrientation === "white" ? "White" : "Black")
    : myColor === "white"
      ? playerUsernames.white
      : playerUsernames.black;
  const currentTurnName = isLocalGame
    ? (game.turn === "white" ? "White" : "Black")
    : game.turn === "white"
      ? playerUsernames.white
      : playerUsernames.black;

  // Determine opponent color
  const opponentColor = myColor === "white" ? "black" : "white";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 560,
        maxWidth: "100%",
        bgcolor: 'rgba(0,0,0,0.2)',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Top player card */}
      <PlayerCard
        username={isSpectator ? playerUsernames.black : opponentName}
        isOpponent={true}
        isCurrentTurn={game.turn === opponentColor}
        color={opponentColor}
        rating={1956}
        timeLeft={!isLocalGame ? "00:54" : undefined}
      />

      {/* Chess board container */}
      <Box
        sx={{
          width: "100%",
          position: "relative",
          bgcolor: "transparent",
        }}
      >
        {/* Ban phase indicator - only show prominent alert for banning player */}
        {((isLocalGame && game.banningPlayer) || (!isLocalGame && game.banningPlayer === myColor)) && (
          <Box
            sx={{
              position: "absolute",
              top: "-50px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 15,
              width: "90%",
              maxWidth: 500,
            }}
          >
            <Alert
              severity="warning"
              icon={<span style={{ fontSize: "1.2rem" }}>🚫</span>}
              sx={{
                fontWeight: "bold",
                backgroundColor: "rgba(255, 152, 0, 0.95)",
                color: "black",
                border: "2px solid",
                borderColor: "warning.dark",
                boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
                "& .MuiAlert-icon": {
                  color: "black",
                },
              }}
            >
              {isLocalGame 
                ? `${game.banningPlayer === "white" ? "White" : "Black"}'s turn to BAN - Select opponent's move!`
                : "Your turn to BAN - Select any opponent move!"}
            </Alert>
          </Box>
        )}
        <LichessBoard />
        {game.status === "finished" && <GameOverOverlay />}
        
        {/* Board control buttons - Lichess style */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 0.5,
          p: 1,
          bgcolor: 'transparent',
        }}>
          <Tooltip title="Flip board">
            <IconButton
              size="small"
              onClick={() => actions.flipBoardOrientation?.()}
              sx={{ 
                color: '#888',
                bgcolor: (isLocalGame ? localGameOrientation === 'black' : myColor === 'black') 
                  ? 'rgba(255,255,255,0.1)' 
                  : 'transparent',
                '&:hover': { 
                  color: '#bababa',
                  bgcolor: (isLocalGame ? localGameOrientation === 'black' : myColor === 'black')
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.05)',
                },
              }}
            >
              <CachedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Analysis board">
            <IconButton
              size="small"
              sx={{ 
                color: '#888',
                '&:hover': { color: '#bababa' },
              }}
            >
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share">
            <IconButton
              size="small"
              sx={{ 
                color: '#888',
                '&:hover': { color: '#bababa' },
              }}
            >
              <ShareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Bottom player card */}
      <PlayerCard
        username={isSpectator ? playerUsernames.white : myName}
        isCurrentTurn={game.turn === myColor}
        color={myColor || "white"}
        rating={1970}
        timeLeft={!isLocalGame ? "00:50" : undefined}
      />
    </Box>
  );
};

export default GameBoard;
