import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Chip, 
  Collapse, 
  IconButton, 
  Paper,
  Stack,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  WifiOff, 
  Wifi, 
  ExpandMore, 
  ExpandLess,
  Circle,
  Warning,
  CheckCircle,
  Error,
  Info
} from '@mui/icons-material';
import { useConnection } from '../contexts/ConnectionContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

interface ConnectionIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface HeartbeatState {
  lastBeat: number;
  isActive: boolean;
  roundTripTime: number | null;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ 
  position = 'top-left' 
}) => {
  const { stats, queue } = useConnection();
  const { session } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [heartbeat, setHeartbeat] = useState<HeartbeatState>({
    lastBeat: Date.now(),
    isActive: false,
    roundTripTime: null
  });
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [wasLongPress, setWasLongPress] = useState(false);

  // Monitor connection status based on session and heartbeat success
  useEffect(() => {
    if (!session) {
      setConnectionStatus('disconnected');
    } else {
      // If we have a session, assume connected until heartbeat fails
      setConnectionStatus('connected');
    }
  }, [session]);

  // Heartbeat monitoring
  useEffect(() => {
    if (!session) {
      setHeartbeat(prev => ({ ...prev, isActive: false }));
      return;
    }

    const performHeartbeat = async () => {
      const startTime = Date.now();
      try {
        setHeartbeat(prev => ({ ...prev, isActive: true }));
        
        // Simple ping to Supabase
        await supabase.from('profiles').select('id').limit(1);
        
        const endTime = Date.now();
        const rtt = endTime - startTime;
        
        setHeartbeat({
          lastBeat: endTime,
          isActive: false,
          roundTripTime: rtt
        });
        
        // Only update to connected if we're not already connected
        if (connectionStatus !== 'connected') {
          setConnectionStatus('connected');
        }
      } catch (error) {
        setHeartbeat(prev => ({ 
          ...prev, 
          isActive: false,
          roundTripTime: null 
        }));
        setConnectionStatus('disconnected');
      }
    };

    // Initial heartbeat
    performHeartbeat();
    const heartbeatInterval = setInterval(performHeartbeat, 8000); // Heartbeat every 8 seconds

    return () => clearInterval(heartbeatInterval);
  }, [session, connectionStatus]);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Circle sx={{ color: 'success.main', fontSize: 12 }} />;
      case 'disconnected':
        return <Circle sx={{ color: 'error.main', fontSize: 12 }} />;
      case 'connecting':
        return <CircularProgress size={12} sx={{ color: 'warning.main' }} />;
      default:
        return <Circle sx={{ color: 'warning.main', fontSize: 12 }} />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'disconnected': return 'error';
      case 'connecting': return 'warning';
      default: return 'default';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleMouseDown = () => {
    setWasLongPress(false);
    const timer = setTimeout(() => {
      setIsExpanded(true);
      setWasLongPress(true);
    }, 800); // 800ms long press
    setLongPressTimer(timer);
  };

  const handleMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleClick = () => {
    // Prevent click if it was a long press
    if (wasLongPress) {
      setWasLongPress(false);
      return;
    }
    
    if (isExpanded) {
      setIsExpanded(false);
    }
  };

  // Touch support for mobile
  const handleTouchStart = () => {
    setWasLongPress(false);
    const timer = setTimeout(() => {
      setIsExpanded(true);
      setWasLongPress(true);
    }, 800);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1300,
      transition: 'all 0.3s ease',
    };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: 16, left: 16 };
      case 'top-right':
        return { ...baseStyles, top: 16, right: 16 };
      case 'bottom-left':
        return { ...baseStyles, bottom: 16, left: 16 };
      case 'bottom-right':
        return { ...baseStyles, bottom: 16, right: 16 };
      default:
        return { ...baseStyles, top: 16, left: 16 };
    }
  };

  return (
    <Box sx={getPositionStyles()}>
      <Paper
        elevation={4}
        sx={{
          p: 0.75,
          borderRadius: 1.5,
          bgcolor: 'rgba(30, 30, 30, 0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          minWidth: isExpanded ? 200 : 80,
          maxWidth: isExpanded ? 320 : 100,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.2s ease',
          opacity: 0.85,
          '&:hover': {
            opacity: 1,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }
        }}
      >
        {/* Main Status Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          {getStatusIcon()}
          
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: '0.65rem', 
              color: 'text.secondary',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'connecting' ? '...' : 'OFF'}
          </Typography>

          {heartbeat.isActive && isExpanded && (
            <Circle 
              sx={{ 
                color: 'primary.main', 
                fontSize: 6,
                animation: 'pulse 1s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                  '100%': { opacity: 1 },
                }
              }} 
            />
          )}

          <Box sx={{ flex: 1 }} />
        </Box>

        {/* Expanded Debug View */}
        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom color="text.primary">
              Connection Details
            </Typography>
            
            <Stack spacing={1} sx={{ fontSize: '0.75rem' }}>
              {/* Connection Status */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Status:</Typography>
                <Typography variant="caption" color={`${getStatusColor()}.main`}>{connectionStatus}</Typography>
              </Box>

              {/* Heartbeat Info */}
              {heartbeat.roundTripTime && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Ping:</Typography>
                  <Typography variant="caption" color="text.primary">{heartbeat.roundTripTime}ms</Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Last Beat:</Typography>
                <Typography variant="caption" color="text.primary">{formatTime(heartbeat.lastBeat)}</Typography>
              </Box>

              {/* Active Users */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">Active Users:</Typography>
                <Typography variant="caption" color="primary.main">{stats.activeUsers}</Typography>
              </Box>

              {/* Queue Status */}
              {queue.inQueue && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">Queue Position:</Typography>
                  <Typography variant="caption" color="primary.main">{queue.position} / {queue.size}</Typography>
                </Box>
              )}

              <Divider sx={{ my: 1, borderColor: 'divider' }} />

              {/* Recent Activity Log */}
              <Typography variant="caption" fontWeight="bold" color="text.primary">
                Recent Activity:
              </Typography>
              
              <Box sx={{ maxHeight: 120, overflowY: 'auto' }}>
                {stats.log.slice(-5).reverse().map((entry, index) => (
                  <Box key={index} sx={{ mb: 0.5 }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block',
                        fontSize: '0.7rem',
                        color: 'text.secondary',
                        opacity: 0.9
                      }}
                    >
                      {formatTime(entry.timestamp)}: {entry.message}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Session Info */}
              {session && (
                <>
                  <Divider sx={{ my: 1, borderColor: 'divider' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">Session:</Typography>
                    <Typography variant="caption" color="success.main">Active</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">User ID:</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.primary' }}>
                      {session.user.id.slice(0, 8)}...
                    </Typography>
                  </Box>
                </>
              )}
            </Stack>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default ConnectionIndicator;