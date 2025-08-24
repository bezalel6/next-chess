import { useState } from 'react';
import { BanChess } from '@/lib/simple-ban-chess';

interface SimpleBoardProps {
  engine: BanChess;
  onAction: (from: string, to: string) => void;
}

const pieceUnicode: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

export default function SimpleBoard({ engine, onAction }: SimpleBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
  
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  // Parse FEN to get board position
  const fenParts = engine.fen().split(' ');
  const position = fenParts[0];
  
  const getPiece = (square: string): string => {
    const file = files.indexOf(square[0]);
    const rank = parseInt(square[1]) - 1;
    
    let currentFile = 0;
    let currentRank = 7;
    
    for (const char of position) {
      if (char === '/') {
        currentRank--;
        currentFile = 0;
      } else if ('12345678'.includes(char)) {
        currentFile += parseInt(char);
      } else {
        if (currentFile === file && currentRank === rank) {
          return pieceUnicode[char] || '';
        }
        currentFile++;
      }
    }
    return '';
  };
  
  const handleSquareClick = (square: string) => {
    if (!selectedSquare) {
      // First click - select square
      setSelectedSquare(square);
      
      // Highlight legal destinations
      const nextType = engine.nextActionType();
      if (nextType === 'move') {
        const moves = engine.legalMoves();
        const destinations = moves
          .filter(m => m.from === square)
          .map(m => m.to);
        setHighlightedSquares(destinations);
      } else {
        const bans = engine.legalBans();
        const destinations = bans
          .filter(b => b.from === square)
          .map(b => b.to);
        setHighlightedSquares(destinations);
      }
    } else {
      // Second click - make action
      if (highlightedSquares.includes(square)) {
        onAction(selectedSquare, square);
      }
      setSelectedSquare(null);
      setHighlightedSquares([]);
    }
  };
  
  return (
    <div style={{ 
      display: 'inline-block', 
      border: '2px solid #333',
      userSelect: 'none'
    }}>
      {ranks.map(rank => (
        <div key={rank} style={{ display: 'flex' }}>
          {files.map(file => {
            const square = file + rank;
            const isDark = (files.indexOf(file) + parseInt(rank)) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isHighlighted = highlightedSquares.includes(square);
            const piece = getPiece(square);
            
            return (
              <div
                key={square}
                data-square={square}
                onClick={() => handleSquareClick(square)}
                style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: isSelected ? '#ffff00' :
                                  isHighlighted ? '#90ee90' :
                                  isDark ? '#d18b47' : '#ffce9e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {piece}
                {isHighlighted && !piece && (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}