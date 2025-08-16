import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Snackbar, 
  Button, 
  Box, 
  Collapse,
  IconButton,
  Typography,
  Paper
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

interface ErrorToastProps {
  error: ErrorDetails | null;
  onClose: () => void;
  onReportBug: (errorDetails: ErrorDetails) => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ error, onClose, onReportBug }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) {
      setExpanded(false);
      setCopied(false);
    }
  }, [error]);

  const handleCopyError = () => {
    if (error) {
      const errorText = `Error: ${error.message}\n\nStack: ${error.stack || 'N/A'}\n\nComponent Stack: ${error.componentStack || 'N/A'}\n\nTimestamp: ${error.timestamp}`;
      navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!error) return null;

  return (
    <Snackbar
      open={!!error}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ 
        mt: 8,
        maxWidth: '90vw',
        width: expanded ? '600px' : 'auto'
      }}
    >
      <Paper 
        elevation={6}
        sx={{ 
          p: 2,
          backgroundColor: 'error.dark',
          color: 'error.contrastText',
          maxWidth: '100%',
          position: 'relative'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <ErrorOutlineIcon sx={{ mt: 0.5 }} />
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Error Detected
            </Typography>
            
            <Typography 
              variant="body2" 
              sx={{ 
                wordBreak: 'break-word',
                mb: 1,
                display: '-webkit-box',
                WebkitLineClamp: expanded ? 'none' : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {error.message}
            </Typography>

            <Collapse in={expanded}>
              <Box 
                sx={{ 
                  mt: 2,
                  p: 1.5,
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 1,
                  maxHeight: '300px',
                  overflow: 'auto'
                }}
              >
                <Typography variant="caption" component="pre" sx={{ 
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {error.stack || 'No stack trace available'}
                </Typography>
              </Box>
            </Collapse>

            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<BugReportIcon />}
                onClick={() => onReportBug(error)}
                sx={{ 
                  backgroundColor: 'error.light',
                  '&:hover': { backgroundColor: 'error.main' }
                }}
              >
                Report Bug
              </Button>
              
              <Button
                size="small"
                variant="outlined"
                startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setExpanded(!expanded)}
                sx={{ 
                  borderColor: 'error.contrastText',
                  color: 'error.contrastText'
                }}
              >
                {expanded ? 'Less' : 'Details'}
              </Button>

              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyError}
                sx={{ 
                  borderColor: 'error.contrastText',
                  color: 'error.contrastText'
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </Box>
          </Box>

          <IconButton
            size="small"
            onClick={onClose}
            sx={{ 
              color: 'error.contrastText',
              ml: 1
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Paper>
    </Snackbar>
  );
};

// Global error toast manager
class ErrorToastManager {
  private static instance: ErrorToastManager;
  private listeners: Set<(error: ErrorDetails | null) => void> = new Set();
  private currentError: ErrorDetails | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      // Listen for unhandled errors
      window.addEventListener('error', (event) => {
        this.showError({
          message: event.message,
          stack: event.error?.stack,
          timestamp: new Date().toISOString()
        });
      });

      // Listen for unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.showError({
          message: `Unhandled Promise Rejection: ${event.reason}`,
          stack: event.reason?.stack,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  static getInstance(): ErrorToastManager {
    if (!ErrorToastManager.instance) {
      ErrorToastManager.instance = new ErrorToastManager();
    }
    return ErrorToastManager.instance;
  }

  showError(error: ErrorDetails) {
    this.currentError = error;
    this.listeners.forEach(listener => listener(error));
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🔥 Error Toast');
      console.error('Message:', error.message);
      if (error.stack) console.log('Stack:', error.stack);
      console.groupEnd();
    }
  }

  hideError() {
    this.currentError = null;
    this.listeners.forEach(listener => listener(null));
  }

  subscribe(listener: (error: ErrorDetails | null) => void) {
    this.listeners.add(listener);
    // Send current state to new subscriber
    listener(this.currentError);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const errorToastManager = ErrorToastManager.getInstance();

// Hook to use error toast
export function useErrorToast() {
  const [error, setError] = useState<ErrorDetails | null>(null);

  useEffect(() => {
    return errorToastManager.subscribe(setError);
  }, []);

  return {
    error,
    showError: (error: ErrorDetails) => errorToastManager.showError(error),
    hideError: () => errorToastManager.hideError()
  };
}