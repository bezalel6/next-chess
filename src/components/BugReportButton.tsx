import React, { useState } from 'react';
import { Fab, Tooltip, Badge } from '@mui/material';
import { BugReport as BugIcon } from '@mui/icons-material';
import { BugReportDialog } from './BugReportDialog';
import { useRouter } from 'next/router';

export const BugReportButton: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();
  
  const gameId = router.pathname.includes('/game/') 
    ? router.query.id as string 
    : undefined;

  return (
    <>
      <Tooltip title="Report a Bug" placement="left">
        <Fab
          color="secondary"
          size="medium"
          onClick={() => setDialogOpen(true)}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 24 },
            right: { xs: 16, sm: 24 },
            zIndex: 1200,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
          }}
        >
          <BugIcon />
        </Fab>
      </Tooltip>
      
      <BugReportDialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        gameId={gameId}
      />
    </>
  );
};