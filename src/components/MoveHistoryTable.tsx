import { Box, Typography } from '@mui/material';

export interface HistoryEntry {
  turnNumber: number;
  whiteMove?: string;
  whiteBan?: string;  // Ban that White makes after moving
  blackMove?: string;
  blackBan?: string;  // Ban that Black makes (initially or after moving)
}

interface MoveHistoryTableProps {
  history: HistoryEntry[];
}

export default function MoveHistoryTable({ history }: MoveHistoryTableProps) {
  // Always show 4 rows minimum
  const displayRows = Math.max(4, history.length);
  
  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      pt: 2,
      px: 2,
    }}>
      {/* Column headers */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: '40px 1fr 1fr',
        borderBottom: '2px solid',
        borderColor: 'divider',
        pb: 1,
        mb: 0.5,
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
      
      {/* Move rows with fixed height for 4 visible rows */}
      <Box sx={{ 
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: '160px', // 4 rows * 40px
        maxHeight: '160px',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(0,0,0,0.05)',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: '3px',
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.3)',
          },
        },
      }}>
        {Array.from({ length: displayRows }, (_, idx) => {
          const entry = history[idx];
          
          return (
            <Box 
              key={idx}
              sx={{ 
                display: 'grid', 
                gridTemplateColumns: '40px 1fr 1fr',
                height: '40px',
                alignItems: 'stretch',
              }}
            >
              {/* Turn number with checkerboard pattern */}
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.03)',
                borderRight: '1px solid',
                borderColor: 'divider',
              }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {idx + 1}
                </Typography>
              </Box>
              
              {/* White's cell */}
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.03)',
                borderRight: '1px solid',
                borderColor: 'divider',
                px: 1,
              }}>
                {entry?.whiteBan && (
                  <Typography sx={{ 
                    color: 'error.main',
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}>
                    {entry.whiteBan}
                  </Typography>
                )}
                {entry?.whiteMove && (
                  <Typography sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}>
                    {entry.whiteMove}
                  </Typography>
                )}
              </Box>
              
              {/* Black's cell */}
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                backgroundColor: idx % 2 === 1 ? 'transparent' : 'rgba(0,0,0,0.03)',
                px: 1,
              }}>
                {entry?.blackBan && (
                  <Typography sx={{ 
                    color: 'error.main',
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}>
                    {entry.blackBan}
                  </Typography>
                )}
                {entry?.blackMove && (
                  <Typography sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}>
                    {entry.blackMove}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      
      {/* Legend */}
      <Box sx={{ 
        pt: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        textAlign: 'center',
      }}>
        <Typography variant="caption" color="text.secondary">
          ✖ Banned move → Actual move played
        </Typography>
      </Box>
    </Box>
  );
}