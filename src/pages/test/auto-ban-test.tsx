import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { supabase } from '@/utils/supabase';
import { GameService } from '@/services/gameService';
import { useAuth } from '@/contexts/AuthContext';

export default function AutoBanTest() {
  const { signIn, user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const [gameId, setGameId] = useState<string>('');
  const channelRef = useRef<any>(null);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setLogs(prev => [`[${timestamp}] ${prefix} ${message}`, ...prev].slice(0, 100));
    console.log(`[AutoBanTest] ${message}`);
  };

  const cleanup = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  };

  useEffect(() => {
    return cleanup;
  }, []);

  const runTest = async () => {
    setTestStatus('running');
    setLogs([]);
    cleanup();

    try {
      // Step 1: Sign in with test auth if available
      addLog('Checking authentication...');
      
      if (!user) {
        // Try to sign in with test account using AuthContext
        try {
          await signIn('test@example.com', 'test123456');
          addLog('Signed in with test account', 'success');
        } catch (signInError) {
          addLog('No authentication available, using mock IDs', 'error');
        }
      }
      
      // Step 2: Create test user IDs
      addLog('Creating test user IDs...');
      const timestamp = Date.now();
      const user1Id = `test-white-${timestamp}`;
      const user2Id = `test-black-${timestamp}`;

      // Step 3: Create a test game
      addLog('Creating test game...');
      const testGameId = 'TEST' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setGameId(testGameId);

      const { error: createError } = await supabase
        .from('games')
        .insert({
          id: testGameId,
          white_player_id: user1Id,
          black_player_id: user2Id,
          status: 'active',
          turn: 'white',
          banning_player: 'black',
          current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: '',
        });

      if (createError) {
        addLog(`Failed to create game: ${createError.message}`, 'error');
        setTestStatus('failed');
        return;
      }

      addLog(`Game created: ${testGameId}`, 'success');

      // Step 4: Set up broadcast listener and database listener
      addLog('Setting up listeners...');
      let broadcastReceived = false;
      let pgnReceived = false;
      let databaseUpdateReceived = false;

      // Broadcast channel for ban events
      const channel = supabase
        .channel(`game:${testGameId}:test`)
        .on('broadcast', { event: 'ban' }, (payload) => {
          addLog(`Broadcast received: ${JSON.stringify(payload.payload)}`, 'success');
          broadcastReceived = true;
          if (payload.payload?.pgn) {
            pgnReceived = true;
            addLog(`PGN in broadcast: ${payload.payload.pgn}`, 'success');
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${testGameId}`
        }, (payload) => {
          addLog(`Database update received: ${JSON.stringify(payload.new)}`, 'success');
          databaseUpdateReceived = true;
        })
        .subscribe((status) => {
          addLog(`Channel status: ${status}`);
        });

      channelRef.current = channel;

      // Wait for subscription
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 5: Simulate ban move via API
      addLog('Executing ban move (e2-e4)...');
      
      // First try using the GameService if available
      try {
        const banResult = await GameService.banMove(testGameId, { from: 'e2', to: 'e4' });
        if (banResult) {
          addLog('Ban move executed via GameService', 'success');
          if (banResult.pgn) {
            addLog(`PGN from GameService: ${banResult.pgn}`, 'success');
          }
        }
      } catch (serviceError) {
        addLog(`GameService not available, using edge function: ${serviceError}`, 'info');
        
        // Fallback to edge function
        const { data: functionData, error: functionError } = await supabase.functions.invoke('game-operations', {
          body: {
            operation: 'banMove',
            gameId: testGameId,
            move: { from: 'e2', to: 'e4' }
          }
        });

        if (functionError) {
          addLog(`Edge function error: ${functionError.message}`, 'error');
        } else {
          addLog('Ban move executed via edge function', 'success');
          
          // Check the returned data
          if (functionData?.pgn) {
            addLog(`PGN in response: ${functionData.pgn}`, 'success');
          }
        }
      }

      // Step 6: Wait for propagation and check database
      addLog('Waiting for updates to propagate...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: gameData, error: fetchError } = await supabase
        .from('games')
        .select('pgn, current_banned_move')
        .eq('id', testGameId)
        .single();

      if (fetchError) {
        addLog(`Failed to fetch game: ${fetchError.message}`, 'error');
        setTestStatus('failed');
        return;
      }

      // Step 7: Verify results
      addLog('Verifying test results...');
      const tests = [
        {
          name: 'PGN contains ban comment',
          passed: gameData?.pgn && gameData.pgn.includes('banning: e2e4'),
          value: gameData?.pgn || 'No PGN'
        },
        {
          name: 'Current banned move is set',
          passed: gameData?.current_banned_move?.from === 'e2' && gameData?.current_banned_move?.to === 'e4',
          value: JSON.stringify(gameData?.current_banned_move || {})
        },
        {
          name: 'Database update received',
          passed: databaseUpdateReceived,
          value: databaseUpdateReceived ? 'Yes' : 'No'
        },
        {
          name: 'Broadcast was received',
          passed: broadcastReceived,
          value: broadcastReceived ? 'Yes' : 'No (May need broadcast implementation)'
        },
        {
          name: 'PGN in broadcast',
          passed: pgnReceived,
          value: pgnReceived ? 'Yes' : 'No (May need broadcast implementation)'
        }
      ];

      let allPassed = true;
      for (const test of tests) {
        if (test.passed) {
          addLog(`✅ ${test.name}: ${test.value}`, 'success');
        } else {
          addLog(`❌ ${test.name}: ${test.value}`, 'error');
          allPassed = false;
        }
      }

      // Step 8: Cleanup test game
      addLog('Cleaning up test game...');
      const { error: deleteError } = await supabase.from('games').delete().eq('id', testGameId);
      if (deleteError) {
        addLog(`Cleanup warning: ${deleteError.message}`, 'error');
      } else {
        addLog('Test game cleaned up', 'success');
      }

      setTestStatus(allPassed ? 'passed' : 'failed');
      addLog(`Test ${allPassed ? 'PASSED' : 'FAILED'}!`, allPassed ? 'success' : 'error');

    } catch (error) {
      addLog(`Test error: ${error}`, 'error');
      setTestStatus('failed');
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Automated Ban Synchronization Test
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Test Controls</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
          <Button 
            variant="contained" 
            onClick={runTest}
            disabled={testStatus === 'running'}
          >
            {testStatus === 'running' ? 'Running Test...' : 'Run Automated Test'}
          </Button>

          <Button 
            variant="outlined" 
            onClick={() => {
              setLogs([]);
              setTestStatus('idle');
              cleanup();
            }}
          >
            Clear
          </Button>

          {testStatus === 'passed' && (
            <Alert severity="success" sx={{ flex: 1 }}>
              All tests passed! Ban synchronization is working correctly.
            </Alert>
          )}

          {testStatus === 'failed' && (
            <Alert severity="error" sx={{ flex: 1 }}>
              Some tests failed. Check the logs for details.
            </Alert>
          )}

          {testStatus === 'running' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography>Test is running...</Typography>
            </Box>
          )}
        </Box>

        {gameId && (
          <Typography sx={{ mt: 2 }}>
            Test Game ID: <code>{gameId}</code>
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, bgcolor: '#1a1a1a', maxHeight: 600, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Test Logs ({logs.length})
        </Typography>
        {logs.map((log, index) => (
          <Typography 
            key={index} 
            sx={{ 
              fontFamily: 'monospace', 
              fontSize: '0.85rem',
              color: log.includes('❌') ? '#ff6b6b' : 
                     log.includes('✅') ? '#51cf66' :
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