import { Box, Typography, Stack, Button, Tooltip, Chip } from "@mui/material";
import LichessBoard from "./lichess-board";
import { useGame } from "@/contexts/GameContext";
import GameOverOverlay from "./GameOverOverlay";
import FlagIcon from '@mui/icons-material/Flag';
import HandshakeIcon from '@mui/icons-material/Handshake';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';

const GameBoard = () => {
  const {
    game,
    myColor,
    isSpectator,
    playerUsernames,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw
  } = useGame();

  // Determine which username to display for opponent and current player
  const opponentName = myColor === 'white' ? playerUsernames.black : playerUsernames.white;
  const myName = myColor === 'white' ? playerUsernames.white : playerUsernames.black;

  // Get current turn player name
  const currentTurnName = game?.turn === 'white' ? playerUsernames.white : playerUsernames.black;

  // Game action buttons component
  const GameActions = () => {
    if (!game || game.status !== 'active' || !myColor) return null;

    // Determine opponent color
    const opponentColor = myColor === 'white' ? 'black' : 'white';

    return (
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {/* Resignation button always available */}
        <Tooltip title="Resign Game" arrow>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={resign}
            startIcon={<FlagIcon />}
            sx={{ minWidth: 40 }}
          >
            Resign
          </Button>
        </Tooltip>

        {/* Draw offer/response buttons */}
        {!game.drawOfferedBy && (
          <Tooltip title="Offer Draw" arrow>
            <Button
              variant="outlined"
              color="info"
              size="small"
              onClick={offerDraw}
              startIcon={<HandshakeIcon />}
              sx={{ minWidth: 40 }}
            >
              Offer Draw
            </Button>
          </Tooltip>
        )}

        {game.drawOfferedBy === myColor && (
          <Typography variant="body2" sx={{ color: 'white', fontStyle: 'italic', alignSelf: 'center' }}>
            Draw offer sent
          </Typography>
        )}

        {game.drawOfferedBy === opponentColor && (
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
        )}
      </Stack>
    );
  };

  function Status() {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ color: 'white' }}>
          Status: {game.status === 'active' ? 'In Progress' : 'Finished'} • Current Turn: {currentTurnName} ({game.turn})
        </Typography>

        {isSpectator && (
          <Chip
            icon={<VisibilityIcon />}
            label="You are watching as a spectator"
            color="info"
            size="small"
            sx={{ mt: 1 }}
          />
        )}

        {game.drawOfferedBy && isSpectator && (
          <Typography variant="body2" sx={{ color: 'white', fontStyle: 'italic' }}>
            {playerUsernames[game.drawOfferedBy]} has offered a draw
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1
    }}>
      {/* Player info - top */}
      <Box sx={{
        width: '100%',
        maxWidth: 800,
        mb: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {isSpectator ? (
          <Typography sx={{ color: 'white' }}>
            {playerUsernames.black}
          </Typography>
        ) : (
          <Typography sx={{ color: 'white' }}>
            {opponentName}
          </Typography>
        )}
      </Box>

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

      {/* Player info - bottom */}
      <Box sx={{
        width: '100%',
        maxWidth: 800,
        mt: 2,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {isSpectator ? (
          <Typography sx={{ color: 'white' }}>
            {playerUsernames.white}
          </Typography>
        ) : (
          <Typography sx={{ color: 'white' }}>
            {myName}
          </Typography>
        )}
      </Box>

      {/* Game actions - only for players */}
      {!isSpectator && (
        <Box sx={{
          width: '100%',
          maxWidth: 800,
          mt: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <GameActions />
        </Box>
      )}

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