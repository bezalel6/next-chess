import React from 'react';
import { Box, Paper, Typography, Divider } from '@mui/material';
import PlayerPresenceIndicator from './PlayerPresenceIndicator';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';

export default function GamePlayersPanel() {
  const game = useUnifiedGameStore(s => s.game);
  const { user } = useAuth();

  if (!game || !user) return null;

  const isWhite = game.white_player_id === user.id;
  const isBlack = game.black_player_id === user.id;
  const isSpectator = !isWhite && !isBlack;

  const currentUserId = user.id;
  const opponentId = isWhite 
    ? game.black_player_id 
    : isBlack 
      ? game.white_player_id 
      : null;

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" gutterBottom>
        Players
      </Typography>
      
      <Divider sx={{ mb: 2 }} />

      {/* White Player */}
      <PlayerPresenceIndicator
        playerId={game.white_player_id}
        playerColor="white"
        isCurrentTurn={game.turn === 'white' && game.status === 'active'}
      />

      <Divider sx={{ my: 1 }} />

      {/* Black Player */}
      <PlayerPresenceIndicator
        playerId={game.black_player_id}
        playerColor="black"
        isCurrentTurn={game.turn === 'black' && game.status === 'active'}
      />

      {/* Game Status Info */}
      {game.status === 'active' && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {game.banning_player 
                ? `${game.banning_player === 'white' ? 'White' : 'Black'} is selecting a ban`
                : `${game.turn === 'white' ? 'White' : 'Black'}'s turn to move`}
            </Typography>
          </Box>
        </>
      )}

      {/* Spectator Notice */}
      {isSpectator && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            You are spectating this game
          </Typography>
        </>
      )}
    </Paper>
  );
}