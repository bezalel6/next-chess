import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, Typography, Paper, Container } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Log to error reporting service (e.g., Sentry, LogRocket)
    this.logErrorToService(error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    // TODO: Add error reporting service integration
    // Example: Sentry.captureException(error, { extra: errorInfo });
    
    // For now, just log to console
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
      url: typeof window !== 'undefined' ? window.location.href : 'SSR'
    };
    
    console.error('Error logged:', errorData);
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default error UI
      return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              textAlign: 'center',
              backgroundColor: 'background.paper',
              borderRadius: 2
            }}
          >
            <ErrorOutlineIcon 
              sx={{ 
                fontSize: 64, 
                color: 'error.main',
                mb: 2
              }} 
            />
            
            <Typography variant="h4" gutterBottom color="error">
              Oops! Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" paragraph>
              We're sorry, but something unexpected happened. The error has been logged and we'll look into it.
            </Typography>

            {process.env.NODE_ENV === 'development' && (
              <Box 
                sx={{ 
                  mt: 3, 
                  p: 2, 
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  textAlign: 'left',
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              >
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                  Error Details (Development Only):
                </Typography>
                <Typography 
                  variant="body2" 
                  component="pre"
                  sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
              
              <Button
                variant="outlined"
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => window.location.href = '/'}
              >
                Go Home
              </Button>
            </Box>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;