import { useRef, useCallback, useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useUnifiedGameStore } from "@/stores/unifiedGameStore";
import type { Square } from "chess.ts/dist/types";

export default function BoardMoveInput() {
  const testInputRef = useRef<HTMLInputElement>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  
  // Get game state
  const game = useUnifiedGameStore(s => s.game);
  const mode = useUnifiedGameStore(s => s.mode);
  const phase = useUnifiedGameStore(s => s.phase);
  const executeGameOperation = useUnifiedGameStore(s => s.executeGameOperation);
  const selectSquare = useUnifiedGameStore(s => s.selectSquare);
  const clearHighlights = useUnifiedGameStore(s => s.clearHighlights);
  
  const canBan = phase === 'selecting_ban' && game?.status === 'active';
  const canMove = phase === 'making_move' && game?.status === 'active';
  
  // Handle square-based input (e.g., "e2" for selection, "e2 e4" for move/ban)
  const handleSquareInput = useCallback(() => {
    const input = testInputRef.current;
    if (!input || !input.value.trim()) return;
    
    const parts = input.value.trim().toLowerCase().split(/\s+/);
    
    // Single square - show available moves
    if (parts.length === 1) {
      const square = parts[0];
      // Validate square format
      if (!/^[a-h][1-8]$/.test(square)) {
        // Flash red border for invalid input
        input.style.borderColor = "#ff0000";
        setTimeout(() => {
          input.style.borderColor = canBan ? "#ff6b6b" : "#4CAF50";
        }, 500);
        return;
      }
      
      // Select the square to show available moves
      selectSquare(square as Square);
      setSelectedSquare(square as Square);
      // Don't clear input - wait for destination
      return;
    }
    
    // Two squares - execute move/ban
    if (parts.length === 2) {
      const [from, to] = parts;
      // Validate square formats
      if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
        // Flash red border for invalid input
        input.style.borderColor = "#ff0000";
        setTimeout(() => {
          input.style.borderColor = canBan ? "#ff6b6b" : "#4CAF50";
        }, 500);
        return;
      }
      
      // Execute the move/ban
      const operation = canBan ? 'ban' : 'move';
      const success = executeGameOperation(operation, from as Square, to as Square, 'q');
      
      if (success) {
        // Clear input and selection on success
        input.value = "";
        setSelectedSquare(null);
        clearHighlights();
      } else {
        // Flash red border for invalid move/ban
        input.style.borderColor = "#ff0000";
        setTimeout(() => {
          input.style.borderColor = canBan ? "#ff6b6b" : "#4CAF50";
        }, 500);
      }
    } else {
      // Invalid format - flash red
      input.style.borderColor = "#ff0000";
      setTimeout(() => {
        input.style.borderColor = canBan ? "#ff6b6b" : "#4CAF50";
      }, 500);
    }
  }, [canBan, executeGameOperation, selectSquare, clearHighlights]);
  
  // Handle Enter key press
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSquareInput();
    }
  }, [handleSquareInput]);
  
  useEffect(() => {
    const input = testInputRef.current;
    if (input) {
      input.addEventListener("keydown", handleKeyDown);
      return () => {
        input.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [handleKeyDown]);
  
  if (!game) return null;
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <input
        ref={testInputRef}
        type="text"
        placeholder={
          selectedSquare 
            ? `${selectedSquare} → ?` 
            : canBan 
              ? "e2 or e2 e4 (ban)" 
              : canMove 
                ? "e2 or e2 e4 (move)" 
                : "waiting..."
        }
        disabled={!canBan && !canMove}
        style={{
          padding: '8px 12px',
          borderRadius: '4px',
          border: `2px solid ${canBan ? '#ff6b6b' : canMove ? '#4CAF50' : '#666'}`,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: canBan || canMove ? '#fff' : '#999',
          fontSize: '14px',
          width: '150px',
          opacity: canBan || canMove ? 1 : 0.6,
          cursor: canBan || canMove ? 'text' : 'not-allowed',
        }}
        data-testid="board-move-input"
      />
    </Box>
  );
}