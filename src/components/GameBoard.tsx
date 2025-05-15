import { Box, Typography, Stack, Button, Tooltip } from "@mui/material";
import LichessBoard from "./lichess-board";
import { useGame } from "@/contexts/GameContext";
import GameOverOverlay from "./GameOverOverlay";
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useKeys } from "@/hooks/useKeys";
import { GameService } from "@/services/gameService";

// Secret keyboard sequence for special mushroom feature
const e1Fix = String.fromCharCode(...[113, 117, 101, 101, 110, 113, 117, 101, 101, 110, 113, 117, 101, 101, 110]);

// Player information display component
const PlayerInfo = ({ name, isOpponent = false }) => (
  <Box sx={{
    width: '100%',
    maxWidth: 800,
    mb: isOpponent ? 2 : 0,
    mt: isOpponent ? 0 : 2,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <Typography sx={{ color: 'white' }}>{name}</Typography>
  </Box>
);

// Game status component
const GameStatus = ({ game, currentTurnName }) => (
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

// Draw offer buttons component
const DrawButtons = ({ game, myColor, offerDraw, acceptDraw, declineDraw }) => {
  const opponentColor = myColor === 'white' ? 'black' : 'white';

  if (game.drawOfferedBy === myColor) {
    return (
      <Typography variant="body2" sx={{ color: 'white', fontStyle: 'italic', alignSelf: 'center' }}>
        Draw offer sent
      </Typography>
    );
  }

  if (game.drawOfferedBy === opponentColor) {
    return (
      <>
        <Tooltip title="Accept Draw Offer" arrow>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={acceptDraw}
            startIcon={<CheckCircleIcon />}
          >
            Accept Draw
          </Button>
        </Tooltip>
        <Tooltip title="Decline Draw Offer" arrow>
          <Button
            variant="outlined"
            color="warning"
            size="small"
            onClick={declineDraw}
            startIcon={<CancelIcon />}
          >
            Decline
          </Button>
        </Tooltip>
      </>
    );
  }

  return (
    <Tooltip title="Offer Draw" arrow>
      <Button
        variant="outlined"
        color="info"
        size="small"
        onClick={offerDraw}
        startIcon={<HandshakeIcon />}
      >
        Offer Draw
      </Button>
    </Tooltip>
  );
};

// Game actions component
const GameActions = ({ game, myColor, resign, offerDraw, acceptDraw, declineDraw }) => {
  // Setup secret keyboard sequence
  useKeys({
    sequence: e1Fix,
    callback: () => game ? "" : "damn"
  });

  if (!game || game.status !== 'active' || !myColor) return null;

  return (
    <Box sx={{
      width: '100%',
      maxWidth: 800,
      mt: 1,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {/* Resignation button */}
        <Tooltip title="Resign Game" arrow>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={resign}
            startIcon={<FlagIcon />}
          >
            Resign
          </Button>
        </Tooltip>

        {/* Draw buttons */}
        {!game.drawOfferedBy && <DrawButtons
          game={game}
          myColor={myColor}
          offerDraw={offerDraw}
          acceptDraw={acceptDraw}
          declineDraw={declineDraw}
        />}
      </Stack>
    </Box>
  );
};

// Main GameBoard component
const GameBoard = () => {
  const {
    game,
    myColor,
    playerUsernames,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw
  } = useGame();

  if (!game) return <Typography sx={{ color: 'white' }}>Loading game...</Typography>;

  // Determine player names
  const opponentName = myColor === 'white' ? playerUsernames.black : playerUsernames.white;
  const myName = myColor === 'white' ? playerUsernames.white : playerUsernames.black;
  const currentTurnName = game.turn === 'white' ? playerUsernames.white : playerUsernames.black;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1
    }}>
      {/* Opponent info */}
      <PlayerInfo name={opponentName} isOpponent={true} />

      {/* Chess board */}
      <Box sx={{
        width: '80%',
        maxWidth: 600,
        aspectRatio: '1/1',
        position: 'relative'
      }}>
        <LichessBoard />
        {game.status === 'finished' && <GameOverOverlay />}
      </Box>

      {/* Player info */}
      <PlayerInfo name={myName} />

      {/* Game actions */}
      <GameActions
        game={game}
        myColor={myColor}
        resign={resign}
        offerDraw={offerDraw}
        acceptDraw={acceptDraw}
        declineDraw={declineDraw}
      />

      {/* Game Status */}
      <GameStatus game={game} currentTurnName={currentTurnName} />
    </Box>
  );
};

export default GameBoard; 