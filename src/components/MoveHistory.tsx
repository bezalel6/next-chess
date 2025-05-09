import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useGame } from "@/contexts/GameContext";
import { Chess } from "chess.ts";

interface FormattedMove {
  number: number;
  white: string;
  black: string;
}

const MoveHistory = () => {
  const { game } = useGame();
  const [moveHistory, setMoveHistory] = useState<FormattedMove[]>([]);
  
  // Update move history whenever the game state changes
  useEffect(() => {
    if (!game) return;
    
    // Use the game's PGN to generate move history
    const formatMovesFromPgn = () => {
      const chess = new Chess();
      
      // Load the current game state from PGN if available
      // If no PGN (new game), use the current game state
      if (game.chess && game.chess.history && typeof game.chess.history === 'function') {
        const moveHistory = game.chess.history({ verbose: true });
        const formattedMoves: FormattedMove[] = [];
        
        let moveNumber = 1;
        let currentPair: { white: string, black: string } = { white: "", black: "" };
        
        moveHistory.forEach((move, index) => {
          // Get the SAN notation for the move
          const sanNotation = move.san || "";
          
          if (index % 2 === 0) {
            // White's move
            currentPair = { white: sanNotation, black: "" };
            
            // If this is the last move and it's white's, add it now
            if (index === moveHistory.length - 1) {
              formattedMoves.push({
                number: moveNumber,
                white: currentPair.white,
                black: currentPair.black
              });
            }
          } else {
            // Black's move - complete the pair and add to formatted moves
            currentPair.black = sanNotation;
            formattedMoves.push({
              number: moveNumber,
              white: currentPair.white,
              black: currentPair.black
            });
            moveNumber++;
          }
        });
        
        setMoveHistory(formattedMoves);
      }
    };
    
    formatMovesFromPgn();
  }, [game]);

  return (
    <Box sx={{ 
      width: { xs: '100%', md: '200px' },
      height: { xs: 'auto', md: 'min(500px, 60vh)' },
      bgcolor: 'rgba(10,10,10,0.8)',
      borderRadius: 1,
      alignSelf: 'center',
      overflow: 'auto',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <Box sx={{
        p: 1,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        bgcolor: 'rgba(0,0,0,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 'bold' }}>
          Moves
        </Typography>
      </Box>
      
      {/* Move table */}
      <Box sx={{ width: '100%', display: 'table', borderCollapse: 'collapse' }}>
        {/* Table header */}
        <Box sx={{ display: 'table-row', bgcolor: 'rgba(0,0,0,0.2)' }}>
          <Box sx={{ display: 'table-cell', p: 1, width: '20%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
            #
          </Box>
          <Box sx={{ display: 'table-cell', p: 1, width: '40%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
            White
          </Box>
          <Box sx={{ display: 'table-cell', p: 1, width: '40%', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', textAlign: 'center' }}>
            Black
          </Box>
        </Box>
        
        {/* Game moves */}
        {moveHistory.map((move) => (
          <Box 
            key={move.number} 
            sx={{ 
              display: 'table-row',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
            }}
          >
            <Box sx={{ 
              display: 'table-cell', 
              p: 1, 
              color: 'rgba(255,255,255,0.5)', 
              borderBottom: '1px solid rgba(255,255,255,0.05)', 
              fontSize: '0.75rem',
              textAlign: 'center'
            }}>
              {move.number}
            </Box>
            <Box sx={{ 
              display: 'table-cell', 
              p: 1, 
              color: 'white', 
              borderBottom: '1px solid rgba(255,255,255,0.05)', 
              fontSize: '0.8rem',
              textAlign: 'center'
            }}>
              {move.white}
            </Box>
            <Box sx={{ 
              display: 'table-cell', 
              p: 1, 
              color: 'white', 
              borderBottom: '1px solid rgba(255,255,255,0.05)', 
              fontSize: '0.8rem',
              textAlign: 'center'
            }}>
              {move.black}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default MoveHistory; 