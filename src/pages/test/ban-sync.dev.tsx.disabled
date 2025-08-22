import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, TextField, Alert } from '@mui/material';
import { useUnifiedGameStore } from '@/stores/unifiedGameStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import type { Square } from 'chess.ts/dist/types';
import { GameService } from '@/services/gameService';

export default function BanSyncTest() {
  const [gameId, setGameId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [testGameId, setTestGameId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [listeningChannel, setListeningChannel] = useState<any>(null);
  
  // Get store state
  const game = useUnifiedGameStore(s => s.game);
  const currentBannedMove = useUnifiedGameStore(s => s.currentBannedMove);
  const phase = useUnifiedGameStore(s => s.phase);
  const myColor = useUnifiedGameStore(s => s.myColor);
  const banHistory = useUnifiedGameStore(s => s.banHistory);
  
  const { user } = useAuth();
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
    console.log(`[BanSyncTest] ${message}`);
  };
  
  // For tests, call GameService directly; game sync is covered elsewhere
  const banMove = async (gid: string, from: string, to: string) => {
    return GameService.banMove(gid, { from: from as Square, to: to as Square });
  };
  
  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
      addLog(`User ID: ${user.id}`);
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (game) {
      addLog(`Game loaded: ${game.id}`);
      addLog(`Current FEN: ${game.currentFen}`);
      addLog(`Turn: ${game.turn}`);
      addLog(`Status: ${game.status}`);
      if (game.currentBannedMove) {
        addLog(`Current banned move from game: ${game.currentBannedMove.from}-${game.currentBannedMove.to}`);
      }
    }
  }, [game]);
  
  useEffect(() => {
    if (currentBannedMove) {
      addLog(`Store banned move updated: ${currentBannedMove.from}-${currentBannedMove.to}`);
    }
  }, [currentBannedMove]);
  
  useEffect(() => {
    addLog(`Phase changed to: ${phase}`);
  }, [phase]);
  
  useEffect(() => {
    if (banHistory.length > 0) {
      const lastBan = banHistory[banHistory.length - 1];
      addLog(`Ban history updated: ${lastBan.from}-${lastBan.to} by ${lastBan.byPlayer}`);
    }
  }, [banHistory]);
  
  const loadGame = () => {
    if (!gameId) {
      addLog('Error: No game ID provided');
      return;
    }
    setTestGameId(gameId);
    addLog(`Loading game: ${gameId}`);
  };
  
  const listenToBroadcasts = () => {
    if (!gameId) {
      addLog('Error: No game ID to listen to');
      return;
    }
    
    if (listeningChannel) {
      listeningChannel.unsubscribe();
      addLog('Unsubscribed from previous channel');
    }
    
    addLog(`Setting up broadcast listener for game: ${gameId}`);
    
    const channel = supabase
      .channel(`game:${gameId}:test`)
      .on('broadcast', { event: '*' }, (payload) => {
        addLog(`Broadcast received - Event: ${payload.event}`);
        addLog(`Payload: ${JSON.stringify(payload.payload)}`);
      })
      .on('broadcast', { event: 'ban' }, (payload) => {
        addLog(`BAN EVENT received!`);
        addLog(`Ban details: from=${payload.payload?.from}, to=${payload.payload?.to}`);
        addLog(`PGN included: ${payload.payload?.pgn ? 'Yes' : 'No'}`);
      })
      .on('broadcast', { event: 'move' }, (payload) => {
        addLog(`MOVE EVENT received!`);
        addLog(`Move details: from=${payload.payload?.from}, to=${payload.payload?.to}`);
      })
      .subscribe((status) => {
        addLog(`Channel subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          addLog('Successfully subscribed to broadcasts');
        }
      });
    
    setListeningChannel(channel);
  };
  
  const testBanMove = async () => {
    if (!testGameId) {
      addLog('Error: Load a game first');
      return;
    }
    
    // Try to ban e2-e4
    const from = 'e2';
    const to = 'e4';
    
    addLog(`Attempting to ban move: ${from}-${to}`);
    
    try {
      const data = await banMove(testGameId, from, to);
      addLog(`Ban success!`);
      addLog(`Response: ${JSON.stringify(data)}`);
    } catch (error) {
      addLog(`Error banning move: ${error}`);
    }
  };
  
  const sendTestBroadcast = async () => {
    if (!gameId) {
      addLog('Error: No game ID for broadcast');
      return;
    }
    
    const testChannel = supabase.channel(`game:${gameId}:unified`);
    
    addLog('Sending test ban broadcast...');
    
    const result = await testChannel.send({
      type: 'broadcast',
      event: 'ban',
      payload: {
        from: 'd2',
        to: 'd4',
        pgn: '1. e4 {banning: d2d4}',
      },
    });
    
    addLog(`Broadcast result: ${JSON.stringify(result)}`);
    
    testChannel.unsubscribe();
  };
  
  const checkPGN = () => {
    if (!game) {
      addLog('No game loaded');
      return;
    }
    
    addLog(`Current PGN: ${game.pgn || 'empty'}`);
    
    // Parse PGN for banned moves
    if (game.pgn) {
      const bannedMoveMatch = game.pgn.match(/\{banning: (\w+)(\w+)\}/g);
      if (bannedMoveMatch) {
        addLog(`Found banned moves in PGN: ${bannedMoveMatch.join(', ')}`);
      } else {
        addLog('No banned moves found in PGN');
      }
    }
  };
  
  const checkStoreState = () => {
    const state = useUnifiedGameStore.getState();
    addLog('=== Store State ===');
    addLog(`Mode: ${state.mode}`);
    addLog(`Phase: ${state.phase}`);
    addLog(`My Color: ${state.myColor}`);
    addLog(`Current Turn: ${state.currentTurn}`);
    addLog(`Current Banned Move: ${state.currentBannedMove ? 
      `${state.currentBannedMove.from}-${state.currentBannedMove.to}` : 'none'}`);
    addLog(`Ban History Length: ${state.banHistory.length}`);
    addLog(`Game ID: ${state.gameId}`);
    addLog(`Game PGN: ${state.game?.pgn || 'empty'}`);
  };
  
  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Ban Move Sync Test
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Test Controls</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Game ID"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            size="small"
            sx={{ width: 200 }}
          />
          
          <Button variant="contained" onClick={loadGame}>
            Load Game
          </Button>
          
          <Button variant="contained" onClick={listenToBroadcasts}>
            Listen to Broadcasts
          </Button>
          
          <Button variant="contained" onClick={testBanMove} disabled={!testGameId}>
            Test Ban e2-e4
          </Button>
          
          <Button variant="contained" onClick={sendTestBroadcast}>
            Send Test Broadcast
          </Button>
          
          <Button variant="outlined" onClick={checkPGN}>
            Check PGN
          </Button>
          
          <Button variant="outlined" onClick={checkStoreState}>
            Check Store State
          </Button>
          
          <Button variant="outlined" onClick={() => setLogs([])}>
            Clear Logs
          </Button>
        </Box>
      </Paper>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Current State</Typography>
        <Box sx={{ mt: 1 }}>
          <Typography>User ID: {userId || 'Not logged in'}</Typography>
          <Typography>Game ID: {testGameId || 'Not loaded'}</Typography>
          <Typography>Phase: {phase}</Typography>
          <Typography>My Color: {myColor || 'none'}</Typography>
          <Typography>Current Turn: {game?.turn || 'unknown'}</Typography>
          <Typography>
            Current Banned Move: {currentBannedMove ? 
              `${currentBannedMove.from}-${currentBannedMove.to}` : 'none'}
          </Typography>
          <Typography>Ban History Count: {banHistory.length}</Typography>
        </Box>
      </Paper>
      
      {game && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">Game Details</Typography>
          <Box sx={{ mt: 1 }}>
            <Typography>White: {game.whitePlayerId}</Typography>
            <Typography>Black: {game.blackPlayerId}</Typography>
            <Typography>Status: {game.status}</Typography>
            <Typography>FEN: {game.currentFen}</Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>
              PGN: {game.pgn || 'empty'}
            </Typography>
            {game.currentBannedMove && (
              <Typography>
                Game&apos;s Banned Move: {game.currentBannedMove.from}-{game.currentBannedMove.to}
              </Typography>
            )}
          </Box>
        </Paper>
      )}
      
      <Paper sx={{ p: 2, bgcolor: '#1a1a1a', maxHeight: 400, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Logs ({logs.length})
        </Typography>
        {logs.map((log, index) => (
          <Typography 
            key={index} 
            sx={{ 
              fontFamily: 'monospace', 
              fontSize: '0.85rem',
              color: log.includes('Error') ? '#ff6b6b' : 
                     log.includes('success') ? '#51cf66' :
                     log.includes('BAN EVENT') ? '#ffd43b' : 
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