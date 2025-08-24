import { Box } from '@mui/material';
import { useMemo } from 'react';
import Image from 'next/image';

interface LocalChessBoardProps {
  fen: string;
  onSquareClick: (square: string) => void;
  highlightedSquares: string[];
  lastBan: { from: string; to: string } | null;
  orientation: 'white' | 'black';
  isBanMode?: boolean;  // True when selecting a ban, false when selecting a move
}

const pieceToImage: Record<string, string> = {
  'K': '/pieces/White/King.png',
  'Q': '/pieces/White/Queen.png',
  'R': '/pieces/White/Rook.png',
  'B': '/pieces/White/Bishop.png',
  'N': '/pieces/White/Knight.png',
  'P': '/pieces/White/Pawn.png',
  'k': '/pieces/Black/King.png',
  'q': '/pieces/Black/Queen.png',
  'r': '/pieces/Black/Rook.png',
  'b': '/pieces/Black/Bishop.png',
  'n': '/pieces/Black/Knight.png',
  'p': '/pieces/Black/Pawn.png',
};

export default function LocalChessBoard({
  fen,
  onSquareClick,
  highlightedSquares,
  lastBan,
  orientation,
  isBanMode = false,
}: LocalChessBoardProps) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = orientation === 'white' 
    ? ['8', '7', '6', '5', '4', '3', '2', '1']
    : ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  // Parse FEN to get board position
  const position = useMemo(() => {
    const fenParts = fen.split(' ');
    const boardStr = fenParts[0];
    const board: Record<string, string> = {};
    
    let rank = 7;
    let file = 0;
    
    for (const char of boardStr) {
      if (char === '/') {
        rank--;
        file = 0;
      } else if ('12345678'.includes(char)) {
        file += parseInt(char);
      } else {
        const square = files[file] + (rank + 1);
        board[square] = char;
        file++;
      }
    }
    
    return board;
  }, [fen]);
  
  const getSquareColor = (file: string, rank: string): string => {
    const fileIndex = files.indexOf(file);
    const rankNum = parseInt(rank);
    const isDark = (fileIndex + rankNum) % 2 === 0;
    
    const square = file + rank;
    
    // Don't highlight the selected source square
    if (highlightedSquares.includes(square)) {
      return isBanMode ? '#ffb3b3' : '#90ee90'; // Light red for possible bans, light green for possible moves
    }
    if (lastBan?.from === square || lastBan?.to === square) {
      return '#ff9999'; // Light red for last banned move
    }
    
    return isDark ? '#b58863' : '#f0d9b5';
  };
  
  return (
    <Box sx={{ 
      display: 'inline-block',
      border: '2px solid #333',
      boxShadow: 3,
      backgroundColor: '#333',
      p: 0.5,
    }}>
      {/* Rank labels */}
      <Box sx={{ display: 'flex' }}>
        <Box sx={{ width: 24 }} />
        {files.map(file => (
          <Box 
            key={file}
            sx={{ 
              width: 72, 
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 'bold',
            }}
          >
            {file}
          </Box>
        ))}
      </Box>
      
      {ranks.map(rank => (
        <Box key={rank} sx={{ display: 'flex' }}>
          {/* File label */}
          <Box 
            sx={{ 
              width: 24, 
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 'bold',
            }}
          >
            {rank}
          </Box>
          
          {files.map(file => {
            const square = file + rank;
            const piece = position[square];
            
            return (
              <Box
                key={square}
                onClick={() => onSquareClick(square)}
                sx={{
                  width: 72,
                  height: 72,
                  backgroundColor: getSquareColor(file, rank),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.2s',
                  position: 'relative',
                  '&:hover': {
                    filter: 'brightness(1.1)',
                  },
                }}
              >
                {piece && (
                  <Image
                    src={pieceToImage[piece]}
                    alt={piece}
                    width={60}
                    height={60}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      objectFit: 'contain',
                      width: '85%',
                      height: '85%',
                    }}
                  />
                )}
                
                {/* Highlight dot for possible moves/bans */}
                {highlightedSquares.includes(square) && !piece && (
                  <Box
                    sx={{
                      position: 'absolute',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: isBanMode 
                        ? 'rgba(255, 0, 0, 0.4)' 
                        : 'rgba(0, 0, 0, 0.3)',
                    }}
                  />
                )}
                
                {/* Capture/ban ring for pieces */}
                {highlightedSquares.includes(square) && piece && (
                  <Box
                    sx={{
                      position: 'absolute',
                      width: '90%',
                      height: '90%',
                      border: isBanMode 
                        ? '3px solid rgba(255, 0, 0, 0.4)' 
                        : '3px solid rgba(0, 0, 0, 0.3)',
                      borderRadius: '50%',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}