import { Box } from '@mui/material';
import { useMemo } from 'react';
import Image from 'next/image';

interface BanChessBoardProps {
  fen: string;
  onSquareClick: (square: string) => void;
  highlightedSquares: string[];
  lastBan?: { from: string; to: string } | null;
  orientation?: 'white' | 'black';
  isBanMode?: boolean;
  disabled?: boolean;
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

export default function BanChessBoard({ 
  fen, 
  onSquareClick, 
  highlightedSquares = [], 
  lastBan,
  orientation = 'white',
  isBanMode = false,
  disabled = false
}: BanChessBoardProps) {
  // Parse FEN to get board position
  const position = useMemo(() => {
    const fenParts = fen.split(' ');
    const piecePlacement = fenParts[0];
    const ranks = piecePlacement.split('/');
    
    const board: Record<string, string> = {};
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rankNumbers = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    ranks.forEach((rank, rankIndex) => {
      let fileIndex = 0;
      for (const char of rank) {
        if (/\d/.test(char)) {
          fileIndex += parseInt(char);
        } else {
          const square = files[fileIndex] + rankNumbers[rankIndex];
          board[square] = char;
          fileIndex++;
        }
      }
    });
    
    return board;
  }, [fen]);

  // Determine board orientation
  const files = orientation === 'white' 
    ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const ranks = orientation === 'white'
    ? ['8', '7', '6', '5', '4', '3', '2', '1']
    : ['1', '2', '3', '4', '5', '6', '7', '8'];

  const getSquareColor = (file: string, rank: string) => {
    const fileIndex = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].indexOf(file);
    const rankIndex = ['1', '2', '3', '4', '5', '6', '7', '8'].indexOf(rank);
    const isLight = (fileIndex + rankIndex) % 2 === 0;
    
    // Normal board colors only - overlays will handle highlights
    return isLight ? 'var(--board-light-square)' : 'var(--board-dark-square)';
  };

  return (
    <Box sx={{ 
      display: 'inline-block',
      border: '2px solid #333',
      boxShadow: 3,
      backgroundColor: '#333',
      p: 0.5,
      opacity: disabled ? 0.7 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
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
      
      {/* Board squares */}
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
                onClick={() => !disabled && onSquareClick(square)}
                sx={{
                  width: 72,
                  height: 72,
                  backgroundColor: getSquareColor(file, rank),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: disabled ? 'default' : (piece || highlightedSquares.includes(square)) ? 'pointer' : 'default',
                  userSelect: 'none',
                  transition: 'background-color 0.2s',
                  position: 'relative',
                }}
              >
                {piece && (
                  <Image
                    src={pieceToImage[piece]}
                    alt={piece}
                    width={60}
                    height={60}
                    draggable={false}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      objectFit: 'contain',
                      width: '85%',
                      height: '85%',
                      userSelect: 'none',
                      WebkitUserDrag: 'none',
                    }}
                  />
                )}
                
                {/* Ban indication overlay */}
                {lastBan && (lastBan.from === square || lastBan.to === square) && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: `rgba(var(--ban-indicator-color), var(--ban-overlay-opacity))`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                
                {/* Highlight indicators for possible moves/bans - Lichess style */}
                {highlightedSquares.includes(square) && (
                  <>
                    {/* For empty squares - show semi-transparent circle */}
                    {!piece && (
                      <Box
                        sx={{
                          position: 'absolute',
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: isBanMode 
                            ? `rgba(var(--ban-indicator-color), var(--ban-indicator-opacity))` 
                            : `rgba(var(--move-indicator-color), var(--move-indicator-opacity))`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {/* For captures - show ring around square */}
                    {piece && (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          border: isBanMode 
                            ? `6px solid rgba(var(--ban-indicator-color), var(--ban-indicator-opacity))` 
                            : `6px solid rgba(var(--move-indicator-color), var(--move-indicator-opacity))`,
                          boxSizing: 'border-box',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </>
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}