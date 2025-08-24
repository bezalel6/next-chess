import { useState, useEffect } from 'react';
import { Button, Container, Paper, Typography, Box, Alert, Grid } from '@mui/material';
import { createClient } from '@supabase/supabase-js';

// Create two separate Supabase clients for two players
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default function TestTwoPlayers() {
  const [player1, setPlayer1] = useState<any>(null);
  const [player2, setPlayer2] = useState<any>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  
  // Create two players and a game
  const setupGame = async () => {
    try {
      // Create Player 1 client
      const client1 = createClient(supabaseUrl, supabaseAnonKey);
      const { data: auth1, error: error1 } = await client1.auth.signInAnonymously();
      if (error1) throw error1;
      
      // Create Player 2 client  
      const client2 = createClient(supabaseUrl, supabaseAnonKey);
      const { data: auth2, error: error2 } = await client2.auth.signInAnonymously();
      if (error2) throw error2;
      
      setPlayer1({
        id: auth1.user?.id,
        client: client1,
        session: auth1.session
      });
      
      setPlayer2({
        id: auth2.user?.id,
        client: client2,
        session: auth2.session
      });
      
      // Create a game between them
      const { data: game, error: gameError } = await client1
        .from('games')
        .insert({
          white_player_id: auth1.user?.id,
          black_player_id: auth2.user?.id,
          status: 'active',
          ban_chess_state: 'waiting_for_ban',
          turn: 'white',
          banning_player: 'black',
          current_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          time_control: { initial_time: 600000, increment: 0 },
          white_time_remaining: 600000,
          black_time_remaining: 600000
        })
        .select()
        .single();
        
      if (gameError) throw gameError;
      
      setGameId(game.id);
      setGameState(game);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  // Player 2 (Black) bans a move
  const blackBan = async () => {
    if (!player2 || !gameId) return;
    
    try {
      const { data, error } = await player2.client.functions.invoke('game-action', {
        body: { 
          gameId, 
          action: { ban: { from: 'd2', to: 'd4' } } 
        },
        headers: {
          Authorization: `Bearer ${player2.session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      setGameState(prev => ({ ...prev, ...data }));
      setError(null);
    } catch (err: any) {
      setError(`Black ban error: ${err.message}`);
    }
  };
  
  // Player 1 (White) makes a move
  const whiteMove = async () => {
    if (!player1 || !gameId) return;
    
    try {
      const { data, error } = await player1.client.functions.invoke('game-action', {
        body: { 
          gameId, 
          action: { move: { from: 'e2', to: 'e4' } } 
        },
        headers: {
          Authorization: `Bearer ${player1.session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      setGameState(prev => ({ ...prev, ...data }));
      setError(null);
    } catch (err: any) {
      setError(`White move error: ${err.message}`);
    }
  };
  
  // Player 1 (White) bans a move
  const whiteBan = async () => {
    if (!player1 || !gameId) return;
    
    try {
      const { data, error } = await player1.client.functions.invoke('game-action', {
        body: { 
          gameId, 
          action: { ban: { from: 'd7', to: 'd5' } } 
        },
        headers: {
          Authorization: `Bearer ${player1.session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      setGameState(prev => ({ ...prev, ...data }));
      setError(null);
    } catch (err: any) {
      setError(`White ban error: ${err.message}`);
    }
  };
  
  // Load existing game
  const loadExistingGame = async () => {
    const existingGameId = 'f9dc4d25-173a-4346-b20d-5595767507b2';
    setGameId(existingGameId);
    
    // For existing game, we'd need to authenticate as the actual players
    // This is just for demonstration
    setError('To play an existing game, you need to be authenticated as one of the original players');
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Two Player Test
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          <Button variant="contained" onClick={setupGame} sx={{ mr: 2 }}>
            Create New Game with 2 Players
          </Button>
          <Button variant="outlined" onClick={loadExistingGame}>
            Load Existing Game
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Player 1 (White)</Typography>
              {player1 && (
                <>
                  <Typography variant="body2">ID: {player1.id}</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Button 
                      variant="contained" 
                      onClick={whiteMove}
                      disabled={!gameId || gameState?.ban_chess_state !== 'waiting_for_move' || gameState?.turn !== 'white'}
                    >
                      Make Move (e2-e4)
                    </Button>
                    <Button 
                      variant="contained" 
                      onClick={whiteBan}
                      disabled={!gameId || gameState?.ban_chess_state !== 'waiting_for_ban' || gameState?.banning_player !== 'white'}
                      sx={{ ml: 1 }}
                    >
                      Ban Move (d7-d5)
                    </Button>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>
          
          <Grid item xs={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6">Player 2 (Black)</Typography>
              {player2 && (
                <>
                  <Typography variant="body2">ID: {player2.id}</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Button 
                      variant="contained" 
                      onClick={blackBan}
                      disabled={!gameId || gameState?.ban_chess_state !== 'waiting_for_ban' || gameState?.banning_player !== 'black'}
                    >
                      Ban Move (d2-d4)
                    </Button>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
        
        {gameId && (
          <Paper sx={{ p: 2, mt: 3, bgcolor: 'grey.100' }}>
            <Typography variant="h6">Game State</Typography>
            <Typography variant="body2">Game ID: {gameId}</Typography>
            <Typography variant="body2">State: {gameState?.ban_chess_state}</Typography>
            <Typography variant="body2">Turn: {gameState?.turn}</Typography>
            <Typography variant="body2">Banning Player: {gameState?.banning_player}</Typography>
            <Typography variant="body2">FEN: {gameState?.current_fen}</Typography>
          </Paper>
        )}
      </Paper>
    </Container>
  );
}