import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import type { Square } from 'chess.ts/dist/types';

export default function LocalGameOverTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const store = useUnifiedGameStore();
  const { game, phase, showGameOverModal } = store;

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    console.log(`[LocalGameOverTest] ${message}`);
  };

  // Test Ban Chess checkmate sequence
  const testBanChessCheckmate = async () => {
    addLog('Starting Ban Chess checkmate test...');
    store.initLocalGame();
    
    // Test sequence that leads to checkmate:
    // {banning: d2d4} 1. e4 {banning: e7e5} e6 {banning: f2f4} 2. Qh5 {banning: g7g6} a5 {banning: a2a4} 3. Qxf7+
    
    const sequence = [
      { type: 'ban', from: 'd2' as Square, to: 'd4' as Square, player: 'Black bans d2-d4' },
      { type: 'move', from: 'e2' as Square, to: 'e4' as Square, player: 'White plays e4' },
      { type: 'ban', from: 'e7' as Square, to: 'e5' as Square, player: 'White bans e7-e5' },
      { type: 'move', from: 'e7' as Square, to: 'e6' as Square, player: 'Black plays e6' },
      { type: 'ban', from: 'f2' as Square, to: 'f4' as Square, player: 'Black bans f2-f4' },
      { type: 'move', from: 'd1' as Square, to: 'h5' as Square, player: 'White plays Qh5' },
      { type: 'ban', from: 'g7' as Square, to: 'g6' as Square, player: 'White bans g7-g6' },
      { type: 'move', from: 'a7' as Square, to: 'a5' as Square, player: 'Black plays a5' },
      { type: 'ban', from: 'a2' as Square, to: 'a4' as Square, player: 'Black bans a2-a4' },
      { type: 'move', from: 'h5' as Square, to: 'f7' as Square, player: 'White plays Qxf7+' },
    ];

    for (const step of sequence) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (step.type === 'ban') {
        addLog(`${step.player}`);
        const result = store.executeBan(step.from, step.to);
        if (!result) {
          addLog(`❌ Ban failed: ${step.from}-${step.to}`);
          return;
        }
      } else {
        addLog(`${step.player}`);
        const result = store.executeMove(step.from, step.to);
        if (!result) {
          addLog(`❌ Move failed: ${step.from}-${step.to}`);
          return;
        }
      }

      // Check game state after each move
      const currentGame = useUnifiedGameStore.getState().game;
      const currentPhase = useUnifiedGameStore.getState().phase;
      
      if (currentGame?.status === 'finished') {
        addLog(`✅ GAME OVER DETECTED!`);
        addLog(`Result: ${currentGame.result}`);
        addLog(`Reason: ${currentGame.endReason}`);
        addLog(`Phase: ${currentPhase}`);
        addLog(`Modal shown: ${useUnifiedGameStore.getState().showGameOverModal}`);
        return;
      }
    }

    // Final check
    const finalGame = useUnifiedGameStore.getState().game;
    const finalPhase = useUnifiedGameStore.getState().phase;
    
    addLog('--- Final State ---');
    addLog(`Game status: ${finalGame?.status}`);
    addLog(`Phase: ${finalPhase}`);
    addLog(`Result: ${finalGame?.result || 'none'}`);
    addLog(`Modal shown: ${useUnifiedGameStore.getState().showGameOverModal}`);
    
    if (finalGame?.status !== 'finished') {
      addLog('❌ Game should be over but is not!');
    }
  };

  // Test standard stalemate
  const testStalemate = () => {
    addLog('Setting up stalemate position...');
    store.initLocalGame();
    
    // Set up a stalemate position: King vs King + Queen
    // Black king trapped, not in check but no legal moves
    store.setupTestPosition('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    
    const currentGame = useUnifiedGameStore.getState().game;
    const currentPhase = useUnifiedGameStore.getState().phase;
    
    addLog(`Game status: ${currentGame?.status}`);
    addLog(`Phase: ${currentPhase}`);
    addLog(`Result: ${currentGame?.result || 'none'}`);
    addLog(`End reason: ${currentGame?.endReason || 'none'}`);
    addLog(`Modal shown: ${useUnifiedGameStore.getState().showGameOverModal}`);
    
    if (currentGame?.status === 'finished' && currentGame?.endReason === 'stalemate') {
      addLog('✅ Stalemate correctly detected!');
    } else {
      addLog('❌ Stalemate not detected!');
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Local Game Over Detection Test
      </Typography>

      {game && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography><strong>Current Game Status:</strong> {game.status}</Typography>
          <Typography><strong>Phase:</strong> {phase}</Typography>
          <Typography><strong>Result:</strong> {game.result || 'none'}</Typography>
          <Typography><strong>End Reason:</strong> {game.endReason || 'none'}</Typography>
          <Typography><strong>Modal Flag:</strong> {showGameOverModal ? 'YES' : 'NO'}</Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button 
          variant="contained" 
          onClick={testBanChessCheckmate}
        >
          Test Ban Chess Checkmate
        </Button>
        
        <Button 
          variant="contained" 
          onClick={testStalemate}
        >
          Test Stalemate
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={() => {
            store.initLocalGame();
            setLogs([]);
            addLog('Reset to new game');
          }}
        >
          Reset Game
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={() => setLogs([])}
        >
          Clear Logs
        </Button>
      </Box>

      <Paper sx={{ p: 2, bgcolor: '#1a1a1a', maxHeight: 600, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 1, color: 'white' }}>
          Test Logs
        </Typography>
        {logs.map((log, index) => (
          <Typography 
            key={index} 
            sx={{ 
              fontFamily: 'monospace', 
              fontSize: '0.85rem',
              color: log.includes('✅') ? '#51cf66' : 
                     log.includes('❌') ? '#ff6b6b' : 
                     '#ffffff',
              mb: 0.5
            }}
          >
            {log}
          </Typography>
        ))}
      </Paper>
    </Box>
  );
}