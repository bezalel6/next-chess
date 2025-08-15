import { useState } from 'react';
import { Button, Container, Typography, Box, Paper } from '@mui/material';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabase';
import { invokeWithAuth } from '@/utils/supabase';

export default function GameTestPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [gameId, setGameId] = useState<string>('');
  const router = useRouter();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
    console.log(`[GameTest] ${message}`);
  };

  const testCreateGameViaAPI = async () => {
    try {
      addLog('Creating game via API route...');
      
      const response = await fetch('/api/test/create-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playAs: 'white' })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const data = await response.json();
      addLog(`Game created: ${data.gameId}`);
      addLog(`Authenticated as: ${data.playerColor}`);
      
      // Navigate to the game
      router.push(`/game/${data.gameId}`);
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    }
  };

  const testQuickGame = async () => {
    try {
      addLog('Creating quick test game...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addLog('Not authenticated, signing in...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'testpassword123'
        });
        
        if (error) throw error;
        addLog(`Signed in as ${data.user?.id}`);
      }

      // Create game using the edge function with both players as current user
      const { data, error } = await invokeWithAuth('game-operations', {
        body: {
          operation: 'createTestGame',
          gameId: `test-${Date.now()}`,
        }
      });

      if (error) throw error;
      
      addLog(`Test game created successfully`);
      if (data?.data?.id) {
        setGameId(data.data.id);
        addLog(`Game ID: ${data.data.id}`);
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    }
  };

  const testDirectInsert = async () => {
    try {
      addLog('Testing direct insert with authenticated user...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addLog('Not authenticated');
        return;
      }

      addLog(`User ID: ${user.id}`);
      
      const gameData = {
        id: `direct-test-${Date.now()}`,
        white_player_id: user.id,
        black_player_id: user.id,
        status: 'active' as const,
        turn: 'white' as const,
        banning_player: 'black' as const,
        current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: ''
      };

      const { data, error } = await supabase
        .from('games')
        .insert(gameData)
        .select()
        .single();

      if (error) {
        addLog(`Insert error: ${error.message}`);
        addLog(`Error code: ${error.code}`);
        addLog(`Error details: ${JSON.stringify(error.details)}`);
      } else {
        addLog('Game inserted successfully!');
        setGameId(data.id);
        addLog(`Game ID: ${data.id}`);
      }
    } catch (error: any) {
      addLog(`Exception: ${error.message}`);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Game Creation Test
        </Typography>
        
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={testCreateGameViaAPI}>
            Test via API Route
          </Button>
          <Button variant="contained" onClick={testQuickGame}>
            Test Quick Game
          </Button>
          <Button variant="contained" onClick={testDirectInsert}>
            Test Direct Insert
          </Button>
          {gameId && (
            <Button 
              variant="outlined" 
              onClick={() => router.push(`/game/${gameId}`)}
            >
              Go to Game
            </Button>
          )}
        </Box>

        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="h6" sx={{ mb: 1, color: 'white' }}>
            Logs:
          </Typography>
          {logs.map((log, index) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ 
                fontFamily: 'monospace', 
                color: log.includes('Error') || log.includes('error') ? '#ff6b6b' : '#4fc3f7',
                whiteSpace: 'pre-wrap'
              }}
            >
              {log}
            </Typography>
          ))}
        </Paper>
      </Box>
    </Container>
  );
}