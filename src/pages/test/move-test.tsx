import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { GameService } from '@/services/gameService';
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
      
      // Create a test game directly in the database
      const { data: game, error } = await supabase
        .from('games')
        .insert({
          white_player_id: userId,
          black_player_id: userId, // Self-play for testing
          status: 'active',
          turn: 'white',
          banning_player: 'black', // Black bans first in Ban Chess
          current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        })
        .select()
        .single();

      if (error) {
        addLog(`Error creating game: ${error.message}`);
        return;
      }

      setGameId(game.id);
      addLog(`Game created: ${game.id}`);
      addLog(`Game state: turn=${game.turn}, banning=${game.banning_player}`);
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
      
      const result = await GameService.banMove(gameId, { from: 'e2', to: 'e4' });
      
      addLog('Ban successful!');
      addLog(`Updated game: turn=${result.turn}, banning=${result.banningPlayer}`);
      addLog(`Current banned move: ${JSON.stringify(result.currentBannedMove)}`);
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
      
      const result = await GameService.makeMove(gameId, { from: 'd2', to: 'd4' });
      
      addLog('Move successful!');
      addLog(`Updated game: turn=${result.turn}, banning=${result.banningPlayer}`);
      addLog(`PGN: ${result.pgn}`);
      addLog(`FEN: ${result.currentFen}`);
      addLog(`Last move: ${JSON.stringify(result.lastMove)}`);
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
      
      // Check game table
      const { data: game, error: gameError } = await supabase
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

      // Check moves table
      const { data: moves, error: movesError } = await supabase
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
      addLog('Authenticating as test user...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      });

      if (error) {
        // Try to create the user if it doesn't exist
        addLog('User not found, creating...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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