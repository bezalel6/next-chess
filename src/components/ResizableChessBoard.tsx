import { Box } from '@mui/material';
import { useState, useRef, useEffect } from 'react';
import BanChessBoard from './BanChessBoard';

interface ResizableChessBoardProps {
  fen: string;
  onSquareClick: (square: string) => void;
  highlightedSquares: string[];
  lastBan?: { from: string; to: string } | null;
  orientation?: 'white' | 'black';
  isBanMode?: boolean;
  disabled?: boolean;
}

export default function ResizableChessBoard(props: ResizableChessBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(600);
  
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const maxWidth = container.offsetWidth;
        const size = Math.min(maxWidth, 600); // Fixed max size
        setBoardSize(Math.max(400, size));
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const scale = boardSize / 600; // Scale based on 75px squares (8 * 75 = 600)
  
  return (
    <Box 
      ref={containerRef}
      sx={{ 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Box sx={{ 
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        width: 600,
        height: 600,
      }}>
        <BanChessBoard {...props} />
      </Box>
    </Box>
  );
}