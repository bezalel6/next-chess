import { useCallback, useRef, useEffect } from "react";
import { Box } from "@mui/material";
import { useGame } from "@/contexts/GameProvider";
import { Chess } from "chess.ts";
import type { Square } from "chess.ts/dist/types";

export default function BoardMoveInput() {
  const { 
    game, 
    myColor, 
    canBan, 
    canMove, 
    makeMove, 
    banMove,
    previewBan,
  } = useGame();
  
  const testInputRef = useRef<HTMLInputElement>(null);

  // Parse current position
  const chess = game ? new Chess(game.currentFen) : null;

  // Get legal moves map
  const legalMoves = (() => {
    if (!chess || !game || game.status !== "active") return new Map();
    
    const moves = new Map<string, string[]>();
    
    if (canBan) {
      const opponentColor = myColor === "white" ? "black" : "white";
      chess.moves({ verbose: true }).forEach(move => {
        const piece = chess.get(move.from as Square);
        if (piece && piece.color === (opponentColor === "white" ? "w" : "b")) {
          const from = move.from;
          const to = move.to;
          const dests = moves.get(from) || [];
          moves.set(from, [...dests, to]);
        }
      });
    } else if (canMove) {
      chess.moves({ verbose: true }).forEach(move => {
        const from = move.from;
        const to = move.to;
        const dests = moves.get(from) || [];
        moves.set(from, [...dests, to]);
      });
    }
    
    return moves;
  })();

  // Handle piece movement
  const handleMove = useCallback((from: string, to: string) => {
    if (canBan) {
      banMove(from, to);
    } else if (canMove) {
      // Check for promotion
      const move = chess?.move({ 
        from: from as Square, 
        to: to as Square, 
        promotion: "q" 
      });
      if (move) {
        chess?.undo();
        if (move.promotion) {
          makeMove(from, to, "q");
        } else {
          makeMove(from, to);
        }
      }
    }
  }, [canBan, canMove, banMove, makeMove, chess]);

  // Handle square-based input
  const handleSquareInput = useCallback((input: string) => {
    if (!chess || !input.trim()) return false;
    
    const parts = input.trim().toLowerCase().split(/\s+/);
    
    // Single square - trigger selection
    if (parts.length === 1) {
      const square = parts[0];
      if (!/^[a-h][1-8]$/.test(square)) {
        return false;
      }
      
      if (canBan) {
        const dests = legalMoves.get(square);
        if (dests && dests.length > 0) {
          previewBan(square as Square, dests[0] as Square);
        }
      }
      
      return true;
    }
    
    // Two squares - execute move/ban
    if (parts.length === 2) {
      const [from, to] = parts;
      if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
        return false;
      }
      
      handleMove(from, to);
      
      if (testInputRef.current) {
        testInputRef.current.value = "";
      }
      return true;
    }
    
    return false;
  }, [chess, handleMove, canBan, legalMoves, previewBan]);

  // Test input handler
  const handleTestInput = useCallback(() => {
    const input = testInputRef.current;
    if (!input || !input.value.trim()) return;
    
    const success = handleSquareInput(input.value.trim());
    
    if (!success && testInputRef.current) {
      testInputRef.current.style.borderColor = "#ff0000";
      setTimeout(() => {
        if (testInputRef.current) {
          testInputRef.current.style.borderColor = canBan ? "#ff6b6b" : "#4CAF50";
        }
      }, 500);
    }
  }, [handleSquareInput, canBan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTestInput();
      }
    };
    
    const input = testInputRef.current;
    if (input) {
      input.addEventListener("keydown", handleKeyDown);
      return () => {
        input.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [handleTestInput]);

  // Don't show input if game is not active
  if (!game || game.status !== "active") return null;

  return (
    <Box
      sx={{
        mt: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          ref={testInputRef}
          type="text"
          data-testid="board-test-input"
          placeholder={canBan ? "e2 e4 (ban)" : "e2 e4 (move)"}
          style={{
            width: "120px",
            padding: "5px 8px",
            fontSize: "12px",
            fontFamily: "monospace",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#fff",
            border: `2px solid ${canBan ? "#ff6b6b" : "#4CAF50"}`,
            borderRadius: "4px",
            outline: "none",
            textAlign: "center",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = canBan ? "#ff4444" : "#66BB6A";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = canBan ? "#ff6b6b" : "#4CAF50";
          }}
        />
        <button
          data-testid="board-test-submit"
          onClick={handleTestInput}
          style={{
            padding: "5px 10px",
            fontSize: "12px",
            fontFamily: "monospace",
            backgroundColor: canBan ? "#ff6b6b" : "#4CAF50",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            outline: "none",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = canBan ? "#ff4444" : "#66BB6A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = canBan ? "#ff6b6b" : "#4CAF50";
          }}
        >
          {canBan ? "Ban" : "Move"}
        </button>
      </div>
      <div style={{
        fontSize: "9px",
        color: "#666",
        marginTop: "2px",
        fontFamily: "monospace",
      }}>
        square (e2) or move (e2 e4)
      </div>
    </Box>
  );
}