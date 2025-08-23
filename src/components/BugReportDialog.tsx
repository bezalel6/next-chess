import React, { lazy, Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';

// Lazy load the actual dialog component
const BugReportDialogInner = lazy(() => 
  import('./BugReportDialogInner').then(module => ({ 
    default: module.BugReportDialogInner 
  }))
);

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
  errorDetails?: {
    message: string;
    stack?: string;
    componentStack?: string;
    timestamp: string;
  };
}

// This wrapper only loads the actual dialog when it's opened
export const BugReportDialog: React.FC<BugReportDialogProps> = (props) => {
  // Don't render anything if dialog is not open
  if (!props.open) {
    return null;
  }

  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <BugReportDialogInner {...props} />
    </Suspense>
  );
}; 
