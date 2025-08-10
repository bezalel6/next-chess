import { useGame } from "@/contexts/GameContext";
import type { Game } from "@/types/game";
import { Box, Typography, Alert } from "@mui/material";
import { GameActions } from "./GameActions";
import GameOverDetails from "./GameOverDetails";
import GameOverOverlay from "./GameOverOverlay";
import LichessBoard from "./lichess-board";
import UserLink from "./user-link";
import TimeControl from "./TimeControl";

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

// Player information display component
const PlayerInfo = ({ username, isOpponent = false }: PlayerInfoProps) => (
  <Box
    sx={{
      width: "100%",
      maxWidth: 800,
      mb: isOpponent ? 2 : 0,
      mt: isOpponent ? 0 : 2,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <UserLink username={username} />
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
          <>
            {game.banningPlayer === myColor ? (
              <span style={{ 
                color: "#ff9800", 
                fontWeight: "bold",
              }}>
                🚫 Your turn to ban a move
              </span>
            ) : (
              <span style={{ 
                color: "#ffa726", 
                opacity: 0.9,
              }}>
                {game.banningPlayer === "white" ? "White" : "Black"} is banning
              </span>
            )}
          </>
        ) : (
          <>Current Turn: {currentTurnName} ({game.turn})</>
        )}
      </Typography>
    </Box>
  );
};

// Main GameBoard component
const GameBoard = () => {
  const { game, myColor, playerUsernames } = useGame();
  const isSpectator = !myColor;

  if (!game)
    return <Typography sx={{ color: "white" }}>Loading game...</Typography>;

  // Determine player names
  const opponentName =
    myColor === "white" ? playerUsernames.black : playerUsernames.white;
  const myName =
    myColor === "white" ? playerUsernames.white : playerUsernames.black;
  const currentTurnName =
    game.turn === "white" ? playerUsernames.white : playerUsernames.black;

  // Determine opponent color
  const opponentColor = myColor === "white" ? "black" : "white";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      {/* Spectator indicator */}
      {isSpectator && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 2, 
            maxWidth: 600,
            width: "90%",
          }}
        >
          👁️ You are spectating this game between {playerUsernames.white} and {playerUsernames.black}
        </Alert>
      )}

      {/* Opponent info */}
      <PlayerInfo username={isSpectator ? playerUsernames.black : opponentName} isOpponent={true} />

      {/* Time control for opponent/black */}
      <TimeControl playerColor={isSpectator ? "black" : opponentColor} />

      {/* Chess board with ban phase indicator as overlay */}
      <Box
        sx={{
          width: "100%",
          position: "relative",
        }}
      >
        {/* Ban phase indicator - only show prominent alert for banning player */}
        {game.banningPlayer === myColor && (
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
              Your turn to BAN - Select any opponent move!
            </Alert>
          </Box>
        )}
        <LichessBoard />
        {game.status === "finished" && <GameOverOverlay />}
      </Box>

      {/* Time control for player/white */}
      <TimeControl playerColor={isSpectator ? "white" : myColor!} />

      {/* Player info */}
      <PlayerInfo username={isSpectator ? playerUsernames.white : myName} />

      {/* Game actions */}
      <GameActions />

      {/* Game Status */}
      <GameStatus game={game} currentTurnName={currentTurnName} myColor={myColor} />

      {/* Game Over Details (under status) */}
      {game.status === "finished" && <GameOverDetails />}
    </Box>
  );
};

export default GameBoard;
