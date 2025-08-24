import { Box } from '@mui/material';
import { useState, useRef, useEffect } from 'react';
import LocalChessBoard from './LocalChessBoard';

interface ResizableChessBoardProps {
  fen: string;
  onSquareClick: (square: string) => void;
  highlightedSquares: string[];
  lastBan: { from: string; to: string } | null;
  orientation: 'white' | 'black';
  isBanMode?: boolean;
}

export default function ResizableChessBoard(props: ResizableChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(640);
  
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const maxWidth = container.offsetWidth;
        const maxHeight = window.innerHeight - 120; // Account for header
        const size = Math.min(maxWidth, maxHeight, 800);
        setBoardSize(Math.max(480, size));
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const scale = boardSize / 640; // Scale based on 80px squares (8 * 80 = 640)
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Box sx={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        width: 640,
        height: 640,
      }}>
        <LocalChessBoard {...props} />
      </Box>
    </Box>
  );
}