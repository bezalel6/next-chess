import React from 'react';
import { Box, Typography, Paper, Chip, List, ListItem, Divider } from '@mui/material';
import { useLocalGame } from '@/contexts/LocalGameContext';
import BlockIcon from '@mui/icons-material/Block';
import FlagIcon from '@mui/icons-material/Flag';

const LocalMoveHistory: React.FC = () => {
  const { gameState } = useLocalGame();

  if (!gameState) {
    return null;
  }

  // Group moves by pairs (white and black moves)
  const movePairs: Array<{ 
    moveNumber: number;
    white?: typeof gameState.moveHistory[0];
    black?: typeof gameState.moveHistory[0];
  }> = [];

  gameState.moveHistory.forEach((move) => {
    const pairIndex = move.moveNumber - 1;
    if (!movePairs[pairIndex]) {
      movePairs[pairIndex] = { moveNumber: move.moveNumber };
    }
    if (move.playerColor === 'white') {
      movePairs[pairIndex].white = move;
    } else {
      movePairs[pairIndex].black = move;
    }
  });

  return (
    <Paper sx={{ 
      p: 2, 
      bgcolor: '#2e2a24',
      border: 'none',
      color: '#bababa',
      height: 'fit-content',
    }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Move History
      </Typography>

      {/* Game Statistics */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip 
          label={`Moves: ${gameState.moveHistory.length}`}
          size="small"
          variant="outlined"
          sx={{ color: '#bababa', borderColor: 'rgba(255,255,255,0.2)' }}
        />
        {gameState.gameStatus !== 'active' && (
          <Chip 
            label={gameState.gameStatus === 'checkmate' 
              ? `${gameState.winner === 'white' ? 'White' : 'Black'} wins!` 
              : gameState.gameStatus
            }
            size="small"
            color={gameState.gameStatus === 'checkmate' ? 'success' : 'warning'}
          />
        )}
      </Box>

      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1.5 }} />

      {/* Move List */}
      {movePairs.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.6, textAlign: 'center', py: 2 }}>
          No moves yet. Black will ban White's first move.
        </Typography>
      ) : (
        <List sx={{ p: 0 }}>
          {movePairs.map((pair, index) => (
            <ListItem 
              key={index} 
              sx={{ 
                p: 0.5, 
                display: 'flex', 
                gap: 1,
                bgcolor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                borderRadius: 1,
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  minWidth: 25, 
                  fontWeight: 600,
                  opacity: 0.8,
                }}
              >
                {pair.moveNumber}.
              </Typography>
              
              <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
                {/* White's move */}
                <Box sx={{ flex: 1 }}>
                  {pair.white ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {pair.white.san}
                      </Typography>
                      {pair.white.bannedMove && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 0.5,
                            color: 'error.main',
                            opacity: 0.8,
                          }}
                        >
                          <BlockIcon sx={{ fontSize: 12 }} />
                          {pair.white.bannedMove.from}{pair.white.bannedMove.to}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ opacity: 0.3 }}>
                      ...
                    </Typography>
                  )}
                </Box>

                {/* Black's move */}
                <Box sx={{ flex: 1 }}>
                  {pair.black ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {pair.black.san}
                      </Typography>
                      {pair.black.bannedMove && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 0.5,
                            color: 'error.main',
                            opacity: 0.8,
                          }}
                        >
                          <BlockIcon sx={{ fontSize: 12 }} />
                          {pair.black.bannedMove.from}{pair.black.bannedMove.to}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ opacity: 0.3 }}>
                      ...
                    </Typography>
                  )}
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      )}

      {/* Legend */}
      {gameState.moveHistory.some(m => m.bannedMove) && (
        <>
          <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', mt: 2, mb: 1 }} />
          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.6 }}>
            <BlockIcon sx={{ fontSize: 14, color: 'error.main' }} />
            Shows the move that was banned before this move
          </Typography>
        </>
      )}
    </Paper>
  );
};

export default LocalMoveHistory;