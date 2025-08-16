import React from 'react';
import { Box, CircularProgress, Typography, Backdrop } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

interface ScreenshotOverlayProps {
  open: boolean;
}

export const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ open }) => {
  return (
    <Backdrop
      open={open}
      sx={{
        zIndex: 9999,
        color: '#fff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(3px)',
        // Add a data attribute so html2canvas can ignore this
        '&[data-screenshot-overlay]': {
          display: open ? 'flex' : 'none',
        }
      }}
      data-screenshot-overlay="true"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          animation: 'fadeIn 0.3s ease-in-out',
          '@keyframes fadeIn': {
            from: { opacity: 0, transform: 'scale(0.9)' },
            to: { opacity: 1, transform: 'scale(1)' },
          }
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <CircularProgress 
            size={80} 
            thickness={4}
            sx={{
              color: 'primary.main',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <CameraAltIcon sx={{ fontSize: 32 }} />
          </Box>
        </Box>
        
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          Capturing Screenshot...
        </Typography>
        
        <Typography variant="body2" sx={{ opacity: 0.8, textAlign: 'center', maxWidth: 300 }}>
          Please wait while we capture the current page. This will only take a moment.
        </Typography>
      </Box>
    </Backdrop>
  );
};