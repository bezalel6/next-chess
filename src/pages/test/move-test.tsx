import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { GameService } from '@/services/gameService';
import { createClient } from '@supabase/supabase-js';

// For local testing, use the local Supabase instance
const localSupabase = createClient(
  'http://127.0.0.1:54321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);
import { Button, Container, Typography, Box, Paper } from '@mui/material';

export default function MoveTestPage() {
  const [gameId, setGameId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string>('');

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
    console.log(`[MoveTest] ${message}`);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsAuthenticated(true);
      setUserId(session.user.id);
      addLog(`Authenticated as ${session.user.email}`);
    } else {
      addLog('Not authenticated');
    }
  };

  const createTestGame = async () => {
    try {
      addLog('Creating test game...');
      
      // Get the current session from local Supabase for auth
      const { data: { session } } = await localSupabase.auth.getSession();
      if (!session) {
        addLog('Error: Not authenticated with local Supabase');
        return;
      }
      
      // Call the test-game edge function on local Supabase
      const { data, error } = await localSupabase.functions.invoke('test-game', {
        body: { withBan: false },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        addLog(`Error creating game: ${error.message}`);
        return;
      }

      if (!data.success || !data.game) {
        addLog(`Error: ${data.error || 'Failed to create game'}`);
        return;
      }

      setGameId(data.game.id);
      addLog(`Game created: ${data.game.id}`);
      addLog(`Game state: turn=${data.game.turn}, banning=${data.game.banning_player}`);
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    }
  };

  const testBanMove = async () => {
    if (!gameId) {
      addLog('No game ID set');
      return;
    }

    try {
      addLog('Testing ban move (e2e4)...');
      
      // Get the current session from local Supabase
      const { data: { session } } = await localSupabase.auth.getSession();
      if (!session) {
        addLog('Error: Not authenticated with local Supabase');
        return;
      }
      
      // Call the game-operations edge function directly on local Supabase
      const { data, error } = await localSupabase.functions.invoke('game-operations', {
        body: {
          operation: 'banMove',
          gameId,
          move: { from: 'e2', to: 'e4' }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        addLog(`Ban error: ${error.message}`);
        return;
      }
      
      addLog('Ban successful!');
      addLog(`Updated game: turn=${data.turn}, banning=${data.banning_player}`);
      addLog(`Current banned move: ${JSON.stringify(data.current_banned_move)}`);
    } catch (error: any) {
      addLog(`Ban error: ${error.message}`);
    }
  };

  const testMakeMove = async () => {
    if (!gameId) {
      addLog('No game ID set');
      return;
    }

    try {
      addLog('Testing move (d2d4)...');
      
      // Get the current session from local Supabase
      const { data: { session } } = await localSupabase.auth.getSession();
      if (!session) {
        addLog('Error: Not authenticated with local Supabase');
        return;
      }
      
      // Call the game-operations edge function directly on local Supabase
      const { data, error } = await localSupabase.functions.invoke('game-operations', {
        body: {
          operation: 'makeMove',
          gameId,
          move: { from: 'd2', to: 'd4' }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        addLog(`Move error: ${error.message}`);
        return;
      }
      
      addLog('Move successful!');
      addLog(`Updated game: turn=${data.turn}, banning=${data.banning_player}`);
      addLog(`PGN: ${data.pgn}`);
      addLog(`FEN: ${data.current_fen}`);
      addLog(`Last move: ${JSON.stringify(data.last_move)}`);
    } catch (error: any) {
      addLog(`Move error: ${error.message}`);
    }
  };

  const checkDatabase = async () => {
    if (!gameId) {
      addLog('No game ID set');
      return;
    }

    try {
      addLog('Checking database state...');
      
      // Check game table using local Supabase
      const { data: game, error: gameError } = await localSupabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        addLog(`Error fetching game: ${gameError.message}`);
      } else {
        addLog(`Game in DB: turn=${game.turn}, banning=${game.banning_player}`);
        addLog(`PGN: ${game.pgn || '(empty)'}`);
        addLog(`Last move: ${JSON.stringify(game.last_move)}`);
        addLog(`Banned move: ${JSON.stringify(game.current_banned_move)}`);
      }

      // Check moves table using local Supabase
      const { data: moves, error: movesError } = await localSupabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('ply_number', { ascending: true });

      if (movesError) {
        addLog(`Error fetching moves: ${movesError.message}`);
      } else {
        addLog(`Moves in DB: ${moves.length} records`);
        moves.forEach(move => {
          const moveInfo = move.san ? 
            `Move ${move.move_number}: ${move.san}` :
            `Ban at move ${move.move_number}: ${move.banned_from}${move.banned_to}`;
          addLog(moveInfo);
        });
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    }
  };

  const authenticateAsTestUser = async () => {
    try {
      addLog('Authenticating as test user on local Supabase...');
      
      // Use local Supabase for authentication
      const { data, error } = await localSupabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      });

      if (error) {
        // Try to create the user if it doesn't exist
        addLog('User not found, creating on local Supabase...');
        const { data: signUpData, error: signUpError } = await localSupabase.auth.signUp({
          email: 'test@example.com',
          password: 'testpassword123',
        });

        if (signUpError) {
          addLog(`Auth error: ${signUpError.message}`);
          return;
        }

        setIsAuthenticated(true);
        setUserId(signUpData.user!.id);
        addLog(`Created and authenticated as test user: ${signUpData.user!.id}`);
      } else {
        setIsAuthenticated(true);
        setUserId(data.user!.id);
        addLog(`Authenticated as test user: ${data.user!.id}`);
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Move Test Page - Debug Mode
        </Typography>
        
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {!isAuthenticated ? (
            <Button variant="contained" onClick={authenticateAsTestUser}>
              Authenticate Test User
            </Button>
          ) : (
            <>
              <Button variant="contained" onClick={createTestGame}>
                Create Test Game
              </Button>
              <Button 
                variant="outlined" 
                onClick={testBanMove}
                disabled={!gameId}
              >
                Test Ban (e2e4)
              </Button>
              <Button 
                variant="outlined" 
                onClick={testMakeMove}
                disabled={!gameId}
              >
                Test Move (d2d4)
              </Button>
              <Button 
                variant="outlined" 
                onClick={checkDatabase}
                disabled={!gameId}
              >
                Check Database
              </Button>
            </>
          )}
        </Box>

        {gameId && (
          <Typography variant="body1" sx={{ mb: 2 }}>
            Game ID: <code>{gameId}</code>
          </Typography>
        )}

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