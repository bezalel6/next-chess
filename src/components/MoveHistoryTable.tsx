import { Box, Typography, Paper, Chip } from '@mui/material';
import { Block, CheckBox } from '@mui/icons-material';

export interface HistoryEntry {
  turnNumber: number;
  whiteMove?: string;
  whiteBan?: string;  // The ban that restricted this white move
  blackMove?: string;
  blackBan?: string;  // The ban that restricted this black move
}

interface MoveHistoryTableProps {
  history: HistoryEntry[];
  currentTurn?: number;
}

export default function MoveHistoryTable({ history, currentTurn }: MoveHistoryTableProps) {
  const formatMove = (move: string | undefined, isBan: boolean = false) => {
    if (!move) return '...';
    if (isBan) {
      // Format ban as "from→to"
      return move.includes('→') ? move : move;
    }
    return move;
  };

  return (
    <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Move History
      </Typography>
      
      <Box sx={{ 
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.4)',
          },
        },
      }}>
        {/* Header */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: '40px 1fr 1fr',
          gap: 1,
          borderBottom: '2px solid',
          borderColor: 'divider',
          pb: 1,
          mb: 1,
          position: 'sticky',
          top: 0,
          backgroundColor: 'background.paper',
          zIndex: 1,
        }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            #
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            White
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Black
          </Typography>
        </Box>
        
        {/* Move rows */}
        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
            No moves yet
          </Typography>
        ) : (
          history.map((entry, idx) => (
            <Box 
              key={idx}
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: '40px 1fr 1fr',
                gap: 1,
                py: 0.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                backgroundColor: idx === currentTurn ? 'action.selected' : 'transparent',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              {/* Turn number */}
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold',
                  textAlign: 'center',
                  alignSelf: 'center',
                }}
              >
                {entry.turnNumber}
              </Typography>
              
              {/* White's move (with ban that preceded it) */}
              <Box sx={{ px: 1 }}>
                {entry.whiteMove ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {entry.whiteBan && (
                      <>
                        <Block sx={{ fontSize: 12, color: 'error.main' }} />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'error.main',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                          }}
                        >
                          {formatMove(entry.whiteBan, true)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mx: 0.5 }}>
                          →
                        </Typography>
                      </>
                    )}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'medium',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatMove(entry.whiteMove)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    -
                  </Typography>
                )}
              </Box>
              
              {/* Black's move (with ban that preceded it) */}
              <Box sx={{ px: 1 }}>
                {entry.blackMove ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {entry.blackBan && (
                      <>
                        <Block sx={{ fontSize: 12, color: 'error.main' }} />
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'error.main',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                          }}
                        >
                          {formatMove(entry.blackBan, true)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mx: 0.5 }}>
                          →
                        </Typography>
                      </>
                    )}
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'medium',
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatMove(entry.blackMove)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    -
                  </Typography>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>
      
      {/* Legend */}
      <Box sx={{ 
        mt: 2, 
        pt: 2, 
        borderTop: '1px solid',
        borderColor: 'divider',
        textAlign: 'center',
      }}>
        <Typography variant="caption" color="text.secondary">
          <Block sx={{ fontSize: 12, color: 'error.main', verticalAlign: 'middle', display: 'inline' }} />
          {' '}Banned move → Actual move played
        </Typography>
      </Box>
    </Paper>
  );
}