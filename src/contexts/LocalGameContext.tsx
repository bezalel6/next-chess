import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.ts';
import type { Square, PartialMove } from 'chess.ts/dist/types';

interface BannedMove {
  from: string;
  to: string;
  bannedBy: 'white' | 'black';
}

interface LocalMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  fen: string;
  moveNumber: number;
  playerColor: 'white' | 'black';
  bannedMove?: BannedMove;
}

interface LocalGameState {
  chess: Chess;
  currentPlayer: 'white' | 'black';
  phase: 'banning' | 'playing';
  bannedMove: BannedMove | null;
  moveHistory: LocalMove[];
  gameStatus: 'active' | 'checkmate' | 'stalemate' | 'draw';
  winner: 'white' | 'black' | null;
}

interface LocalGameContextType {
  gameState: LocalGameState | null;
  initializeGame: () => void;
  selectBan: (from: Square, to: Square) => void;
  makeMove: (from: Square, to: Square, promotion?: string) => boolean;
  resetGame: () => void;
  getPossibleMoves: () => PartialMove[];
  isMoveBanned: (from: Square, to: Square) => boolean;
  getGameStatusMessage: () => string;
}

const LocalGameContext = createContext<LocalGameContextType | undefined>(undefined);

export const LocalGameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<LocalGameState | null>(null);

  const initializeGame = useCallback(() => {
    const chess = new Chess();
    setGameState({
      chess,
      currentPlayer: 'white',
      phase: 'banning', // Black bans first move
      bannedMove: null,
      moveHistory: [],
      gameStatus: 'active',
      winner: null,
    });
  }, []);

  const selectBan = useCallback((from: Square, to: Square) => {
    if (!gameState || gameState.phase !== 'banning') return;

    const bannedBy = gameState.currentPlayer === 'white' ? 'black' : 'white';
    
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        bannedMove: { from, to, bannedBy },
        phase: 'playing',
      };
    });
  }, [gameState]);

  const makeMove = useCallback((from: Square, to: Square, promotion?: string): boolean => {
    if (!gameState || gameState.phase !== 'playing') return false;

    // Check if move is banned
    if (gameState.bannedMove && 
        gameState.bannedMove.from === from && 
        gameState.bannedMove.to === to) {
      return false;
    }

    try {
      const move = gameState.chess.move({ from, to, promotion });
      if (!move) return false;

      const newMoveHistory = [...gameState.moveHistory];
      const moveNumber = Math.floor(gameState.moveHistory.length / 2) + 1;
      
      newMoveHistory.push({
        from,
        to,
        promotion,
        san: move.san,
        fen: gameState.chess.fen(),
        moveNumber,
        playerColor: gameState.currentPlayer,
        bannedMove: gameState.bannedMove || undefined,
      });

      // Check game status
      let gameStatus: 'active' | 'checkmate' | 'stalemate' | 'draw' = 'active';
      let winner: 'white' | 'black' | null = null;

      if (gameState.chess.inCheckmate()) {
        gameStatus = 'checkmate';
        winner = gameState.currentPlayer;
      } else if (gameState.chess.inStalemate()) {
        gameStatus = 'stalemate';
      } else if (gameState.chess.inDraw()) {
        gameStatus = 'draw';
      }

      const nextPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

      setGameState({
        ...gameState,
        currentPlayer: nextPlayer,
        phase: gameStatus === 'active' ? 'banning' : 'playing',
        bannedMove: null,
        moveHistory: newMoveHistory,
        gameStatus,
        winner,
      });

      return true;
    } catch (error) {
      console.error('Invalid move:', error);
      return false;
    }
  }, [gameState]);

  const resetGame = useCallback(() => {
    initializeGame();
  }, [initializeGame]);

  const getPossibleMoves = useCallback((): PartialMove[] => {
    if (!gameState) return [];
    
    const moves = gameState.chess.moves({ verbose: true });
    
    // Filter out banned move if in playing phase
    if (gameState.phase === 'playing' && gameState.bannedMove) {
      return moves.filter(move => 
        !(move.from === gameState.bannedMove!.from && move.to === gameState.bannedMove!.to)
      );
    }
    
    return moves;
  }, [gameState]);

  const isMoveBanned = useCallback((from: Square, to: Square): boolean => {
    if (!gameState || !gameState.bannedMove) return false;
    return gameState.bannedMove.from === from && gameState.bannedMove.to === to;
  }, [gameState]);

  const getGameStatusMessage = useCallback((): string => {
    if (!gameState) return 'Game not started';

    if (gameState.gameStatus === 'checkmate') {
      return `Checkmate! ${gameState.winner === 'white' ? 'White' : 'Black'} wins!`;
    }
    if (gameState.gameStatus === 'stalemate') {
      return 'Stalemate! Game is a draw.';
    }
    if (gameState.gameStatus === 'draw') {
      return 'Draw!';
    }

    if (gameState.phase === 'banning') {
      const banningPlayer = gameState.currentPlayer === 'white' ? 'Black' : 'White';
      return `${banningPlayer} is choosing a move to ban...`;
    }

    if (gameState.phase === 'playing') {
      const currentPlayerStr = gameState.currentPlayer === 'white' ? 'White' : 'Black';
      const isInCheck = gameState.chess.inCheck();
      
      if (gameState.bannedMove) {
        const bannedMoveStr = `${gameState.bannedMove.from}${gameState.bannedMove.to}`;
        return `${currentPlayerStr} to move (${bannedMoveStr} is banned)${isInCheck ? ' - CHECK!' : ''}`;
      }
      
      return `${currentPlayerStr} to move${isInCheck ? ' - CHECK!' : ''}`;
    }

    return '';
  }, [gameState]);

  // Initialize game on mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  const value: LocalGameContextType = {
    gameState,
    initializeGame,
    selectBan,
    makeMove,
    resetGame,
    getPossibleMoves,
    isMoveBanned,
    getGameStatusMessage,
  };

  return (
    <LocalGameContext.Provider value={value}>
      {children}
    </LocalGameContext.Provider>
  );
};

export const useLocalGame = () => {
  const context = useContext(LocalGameContext);
  if (!context) {
    throw new Error('useLocalGame must be used within LocalGameProvider');
  }
  return context;
};