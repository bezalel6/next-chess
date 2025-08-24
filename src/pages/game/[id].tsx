import { useRouter } from 'next/router';
import { useState, useCallback, useEffect } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';
import { GameService } from '@/services/gameService';
import GameLayout from '@/components/GameLayout';
import type { HistoryEntry } from '@/components/MoveHistoryTable';
import type { Tables } from '@/types/database';

type GameData = Tables<'games'>;

export default function GamePage() {
  const router = useRouter();
  const { id: gameId } = router.query;
  const { user } = useAuth();
  
  const engine = useUnifiedGameStore(s => s.engine);
  const playAction = useUnifiedGameStore(s => s.playAction);
  
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [moveHistory, setMoveHistory] = useState<HistoryEntry[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
  const [lastBan, setLastBan] = useState<{ from: string; to: string } | null>(null);
  
  useGameSync(gameId as string);
  
  // Load game data and build move history
  useEffect(() => {
    if (!gameId || typeof gameId !== 'string') return;
    
    const loadGameData = async () => {
      const game = await GameService.loadGame(gameId);
      if (game) {
        setGameData(game);
        
        // Build move history from ban_history and move_history
        const history: HistoryEntry[] = [];
        const bans = (game.ban_history as any[]) || [];
        const moves = (game.move_history as any[]) || [];
        
        // Process history in sequence
        let turnNumber = 1;
        let currentEntry: Partial<HistoryEntry> = {};
        
        // Interleave bans and moves according to Ban Chess flow
        // Pattern: Black ban, White move, White ban, Black move, repeat...
        let banIndex = 0;
        let moveIndex = 0;
        
        while (banIndex < bans.length || moveIndex < moves.length) {
          // Black bans (restricts White's move)
          if (banIndex < bans.length && bans[banIndex]?.color === 'black') {
            currentEntry.turnNumber = turnNumber;
            currentEntry.whiteBan = `${bans[banIndex].from}→${bans[banIndex].to}`;
            banIndex++;
          }
          
          // White moves
          if (moveIndex < moves.length && moves[moveIndex]?.color === 'white') {
            currentEntry.whiteMove = moves[moveIndex].san || moves[moveIndex].uci;
            moveIndex++;
          }
          
          // White bans (restricts Black's move)
          if (banIndex < bans.length && bans[banIndex]?.color === 'white') {
            currentEntry.blackBan = `${bans[banIndex].from}→${bans[banIndex].to}`;
            banIndex++;
          }
          
          // Black moves
          if (moveIndex < moves.length && moves[moveIndex]?.color === 'black') {
            currentEntry.blackMove = moves[moveIndex].san || moves[moveIndex].uci;
            moveIndex++;
            
            // Complete turn after Black's move
            if (currentEntry.turnNumber) {
              history.push(currentEntry as HistoryEntry);
              currentEntry = {};
              turnNumber++;
            }
          }
          
          // Handle incomplete turns
          if (banIndex >= bans.length && moveIndex >= moves.length && currentEntry.turnNumber) {
            history.push(currentEntry as HistoryEntry);
            break;
          }
        }
        
        setMoveHistory(history);
        
        // Set last ban if there's a recent ban
        if (bans.length > 0) {
          const lastBanEntry = bans[bans.length - 1];
          if (lastBanEntry) {
            setLastBan({ from: lastBanEntry.from, to: lastBanEntry.to });
          }
        }
      }
    };
    
    loadGameData();
    
    // Subscribe to game updates
    const unsubscribe = GameService.subscribeToGame(gameId, (payload) => {
      if (payload.game || payload.new) {
        loadGameData();
      }
    });
    
    return unsubscribe;
  }, [gameId]);
  
  const handleSquareClick = useCallback(async (square: string) => {
    if (!engine || engine.gameOver()) return;
    
    const nextType = engine.nextActionType();
    
    if (!selectedSquare) {
      // First click - check if this square has any legal actions
      let destinations: string[] = [];
      
      if (nextType === 'move') {
        const moves = engine.legalMoves();
        destinations = moves
          .filter(m => m.from === square)
          .map(m => m.to);
      } else {
        const bans = engine.legalBans();
        destinations = bans
          .filter(b => b.from === square)
          .map(b => b.to);
      }
      
      // Only select the square if it has legal destinations
      if (destinations.length > 0) {
        setSelectedSquare(square);
        setHighlightedSquares(destinations);
      }
    } else {
      // Second click - make the action
      if (highlightedSquares.includes(square)) {
        const action = nextType === 'move'
          ? { move: { from: selectedSquare, to: square } }
          : { ban: { from: selectedSquare, to: square } };
        
        try {
          await playAction(action);
          
          // Update last ban if we just made a ban
          if (nextType === 'ban') {
            setLastBan({ from: selectedSquare, to: square });
          } else {
            setLastBan(null);
          }
        } catch (error) {
          console.error('Action failed:', error);
        }
      }
      
      // Clear selection
      setSelectedSquare(null);
      setHighlightedSquares([]);
    }
  }, [engine, selectedSquare, highlightedSquares, playAction]);
  
  if (!engine || !gameData) {
    return <div style={{ padding: '20px' }}>Loading game...</div>;
  }
  
  // Determine player colors
  const myColor = user?.id === gameData.white_player_id ? 'white' : 
                  user?.id === gameData.black_player_id ? 'black' : null;
  const orientation = myColor || 'white';
  
  const turn = engine.turn;
  const nextAction = engine.nextActionType();
  const isGameOver = engine.gameOver();
  const inCheck = engine.inCheck();
  const checkmate = engine.inCheckmate();
  const stalemate = engine.inStalemate();
  
  // Check if it's my turn
  const isMyTurn = myColor === turn;
  const boardDisabled = !isMyTurn || isGameOver;
  
  return (
    <GameLayout
      fen={engine.fen()}
      onSquareClick={handleSquareClick}
      highlightedSquares={highlightedSquares}
      lastBan={lastBan}
      orientation={orientation as 'white' | 'black'}
      isBanMode={nextAction === 'ban'}
      boardDisabled={boardDisabled}
      turn={turn}
      nextAction={nextAction}
      inCheck={inCheck}
      isGameOver={isGameOver}
      checkmate={checkmate}
      stalemate={stalemate}
      moveHistory={moveHistory}
    />
  );
}