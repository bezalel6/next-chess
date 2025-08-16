import { useState } from 'react';
import { Button, Box, Typography, Stack } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useErrorHandler } from '@/utils/errorLogger';

export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const { logError, logComponentError } = useErrorHandler();

  if (shouldThrow) {
    throw new Error('Test error: This is a deliberate error to test the ErrorBoundary!');
  }

  const triggerError = () => {
    setShouldThrow(true);
  };

  const triggerAsyncError = () => {
    setTimeout(() => {
      throw new Error('Async error: This error happens outside React rendering');
    }, 100);
  };

  const triggerPromiseRejection = () => {
    Promise.reject('Unhandled promise rejection test');
  };

  const triggerLoggedError = () => {
    try {
      // Simulate an error
      throw new Error('This error is caught and logged');
    } catch (error) {
      logComponentError(error, 'TestErrorPage', 'manual-trigger');
      alert('Error was logged! Check console in dev mode.');
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Error Handling Test Page
      </Typography>
      
      <Typography variant="body1" paragraph>
        Click the buttons below to test different error scenarios:
      </Typography>

      <Stack spacing={2}>
        <Button
          variant="contained"
          color="error"
          startIcon={<BugReportIcon />}
          onClick={triggerError}
          fullWidth
        >
          Throw React Error (Will trigger ErrorBoundary)
        </Button>

        <Button
          variant="outlined"
          color="error"
          onClick={triggerAsyncError}
        >
          Throw Async Error (Outside React - check console)
        </Button>

        <Button
          variant="outlined"
          color="warning"
          onClick={triggerPromiseRejection}
        >
          Trigger Unhandled Promise Rejection
        </Button>

        <Button
          variant="outlined"
          color="info"
          onClick={triggerLoggedError}
        >
          Trigger Logged Error (Won't crash app)
        </Button>
      </Stack>

      <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          What happens with each button:
        </Typography>
        <Typography variant="body2" component="ul">
          <li><strong>React Error:</strong> Triggers ErrorBoundary, shows friendly error page</li>
          <li><strong>Async Error:</strong> Logged to console, won't trigger ErrorBoundary</li>
          <li><strong>Promise Rejection:</strong> Caught by global handler, logged</li>
          <li><strong>Logged Error:</strong> Error is caught and logged without crashing</li>
        </Typography>
      </Box>
    </Box>
  );
}