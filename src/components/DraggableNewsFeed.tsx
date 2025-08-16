import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import CloseIcon from '@mui/icons-material/Close';
import NewsFeed from './NewsFeed';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export default function DraggableNewsFeed() {
  const [position, setPosition] = useState<Position>({ x: 20, y: 100 });
  const [size, setSize] = useState<Size>({ width: 280, height: 'auto' as any });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ width: number; x: number }>({ width: 0, x: 0 });
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('newsFeedPosition');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed.position || position);
        setSize(parsed.size || size);
        setShowControls(false); // Hide controls if position was saved
      } catch (e) {
        console.error('Failed to parse saved position');
      }
    }
  }, []);

  // Save position to localStorage
  const savePosition = () => {
    localStorage.setItem('newsFeedPosition', JSON.stringify({ position, size }));
    setShowControls(false);
  };

  // Clear saved position
  const clearPosition = () => {
    localStorage.removeItem('newsFeedPosition');
    setShowControls(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      e.preventDefault();
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      width: size.width as number,
      x: e.clientX,
    });
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      } else if (isResizing) {
        const newWidth = Math.max(200, Math.min(500, resizeStart.width + (e.clientX - resizeStart.x)));
        setSize({ ...size, width: newWidth });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, size]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        zIndex: 1000,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: isDragging || isResizing ? 'none' : 'opacity 0.3s',
        '&:hover': {
          '& .controls': {
            opacity: 1,
          },
        },
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Controls overlay */}
      {showControls && (
        <Box
          className="controls"
          sx={{
            position: 'absolute',
            top: -40,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '4px 4px 0 0',
            p: 0.5,
            opacity: 1,
            transition: 'opacity 0.3s',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              className="drag-handle"
              sx={{
                color: 'white',
                cursor: 'grab',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
              }}
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'white', fontSize: '0.7rem' }}>
              Drag to position
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={savePosition}
              sx={{
                color: 'lime',
                padding: 0.5,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
              }}
              title="Save position"
            >
              ✓
            </IconButton>
            <IconButton
              size="small"
              onClick={clearPosition}
              sx={{
                color: 'white',
                padding: 0.5,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
              }}
              title="Hide controls"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Main content with border when controls are shown */}
      <Box
        sx={{
          position: 'relative',
          border: showControls ? '2px dashed rgba(255, 255, 255, 0.3)' : 'none',
          borderRadius: 1,
          padding: showControls ? 1 : 0,
          background: showControls ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
        }}
      >
        <NewsFeed />
        
        {/* Resize handle */}
        {showControls && (
          <Box
            onMouseDown={handleResizeMouseDown}
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              cursor: 'nwse-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.5)',
              '&:hover': {
                color: 'rgba(255, 255, 255, 0.8)',
              },
            }}
          >
            <AspectRatioIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
          </Box>
        )}
      </Box>

      {/* Instructions */}
      {showControls && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            p: 1,
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '0 0 4px 4px',
            color: 'white',
            fontSize: '0.7rem',
            textAlign: 'center',
          }}
        >
          Position the news feed where you want it, then click ✓ to save
        </Typography>
      )}
    </Box>
  );
}